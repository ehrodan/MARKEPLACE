import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CatalogService } from "@midas/catalog";
import { createDatabase, defaultMigrationDirectories, runSqlMigrations } from "@midas/database";
import { IdentityService } from "@midas/identity";
import { createUuidV7, parsePublicId, type ActorContext } from "@midas/kernel";
import { SellerService } from "@midas/sellers";
import { CartService, OrderService } from "../src/index.js";

/**
 * RF: estoque alterado pelo fluxo de pedidos publica `catalog.listing.stock_changed` por
 * listing, na MESMA transação do débito/restauração (padrão outbox). Sem esse evento, o
 * motor de triggers da watchlist (apps/worker) só via mudança de estoque quando o vendedor
 * editava o anúncio — BACK_IN_STOCK nunca disparava por cancelamento devolvendo estoque.
 */

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("postgresql://")) {
  throw new Error("TEST_DATABASE_URL ou DATABASE_URL PostgreSQL é obrigatório.");
}

const database = createDatabase(databaseUrl, { max: 8 });
const identity = new IdentityService(database.db, {
  sessionTtlSeconds: 3_600,
  verificationTtlSeconds: 3_600,
  authRateLimitAttempts: 100,
  authRateLimitWindowSeconds: 60,
});
const sellers = new SellerService(database.db);
const catalog = new CatalogService(database.db);
const orders = new OrderService(database.db);
const carts = new CartService(database.db);

beforeAll(async () => {
  await runSqlMigrations(database.pool, defaultMigrationDirectories());
});

afterAll(async () => {
  await database.close();
});

type StockChangedPayload = {
  listingId: string;
  previousQuantityAvailable: number;
  quantityAvailable: number;
  orderId: string;
  reason: string;
};

describe("catalog.listing.stock_changed no fluxo de pedidos com PostgreSQL real", () => {
  it("débito na compra, restauração no cancelamento e estoque anterior na edição", async () => {
    const suffix = randomUUID().slice(0, 8);
    const owner = await provisionUser(`stock-owner-${suffix}@example.test`);
    const buyer = await provisionUser(`stock-buyer-${suffix}@example.test`);
    await grantCatalogPlatformRole(owner.userId, suffix);

    const seller = await sellers.createSellerAccount(
      owner.userId,
      { displayName: `Loja Stock ${suffix}`, accountType: "INDIVIDUAL" },
      actor(owner.userId, owner.sessionId),
    );
    const sellerAccountId = parsePublicId("sellerAccount", seller.sellerAccountId);

    const catalogItem = await catalog.createCatalogItem(
      {
        publicSlug: `stock-item-${suffix}`,
        displayName: `Item Stock ${suffix}`,
        gameOrigin: "CS2",
        itemType: "WEAPON",
      },
      actor(owner.userId, owner.sessionId),
    );

    const basicPlan = await database.pool.query<{ listing_plan_id: string }>(
      "select listing_plan_id from catalog.listing_plans where plan_code = 'BASIC' limit 1",
    );
    const listingPlanId = basicPlan.rows[0]?.listing_plan_id;
    if (!listingPlanId) throw new Error("Plano BASIC não foi seedado.");

    const listing = await catalog.createListing(
      {
        publicSlug: `stock-listing-${suffix}`,
        catalogItemId: catalogItem.catalogItemId,
        sellerAccountId,
        listingPlanId,
        priceMinor: 12_500n,
        currency: "BRL",
        quantityAvailable: 3,
      },
      actor(owner.userId, owner.sessionId),
    );
    // Publicação real exige assets APPROVED (fluxo do catálogo, fora do escopo daqui):
    // o teste força o estado PUBLISHED que o fluxo de compra pressupõe.
    await database.pool.query(
      `update catalog.listings
          set listing_status = 'PUBLISHED', published_at = clock_timestamp()
        where listing_id = $1`,
      [listing.listingId],
    );

    // Compra que ZERA o estoque: evento de débito com previous=3 → new=0.
    const order = await orders.placeOrder(
      { listingId: listing.listingId, quantity: 3, idempotencyKey: `stock-place-${suffix}` },
      actor(buyer.userId, buyer.sessionId),
    );

    let events = await stockChangedEvents(listing.listingId);
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toMatchObject({
      listingId: listing.listingId,
      previousQuantityAvailable: 3,
      quantityAvailable: 0,
      orderId: order.orderId,
      reason: "ORDER_PLACED",
    });
    expect(events[0]?.owner_module).toBe("orders");
    expect(events[0]?.aggregate_type).toBe("Listing");
    await expect(listingQuantity(listing.listingId)).resolves.toBe(0);

    // Compra recusada por falta de estoque: transação inteira desfeita, NENHUM evento novo.
    await expect(
      orders.placeOrder(
        { listingId: listing.listingId, quantity: 1, idempotencyKey: `stock-fail-${suffix}` },
        actor(buyer.userId, buyer.sessionId),
      ),
    ).rejects.toMatchObject({ code: "LISTING_INSUFFICIENT_QUANTITY" });
    await expect(stockChangedEvents(listing.listingId)).resolves.toHaveLength(1);

    // Cancelamento devolve o estoque: transição 0→3 com o estoque anterior no payload.
    await orders.cancelOrder(order.orderId, actor(buyer.userId, buyer.sessionId));

    events = await stockChangedEvents(listing.listingId);
    expect(events).toHaveLength(2);
    expect(events[1]?.payload).toMatchObject({
      listingId: listing.listingId,
      previousQuantityAvailable: 0,
      quantityAvailable: 3,
      orderId: order.orderId,
      reason: "ORDER_CANCELLED",
    });
    await expect(listingQuantity(listing.listingId)).resolves.toBe(3);

    // Edição do vendedor: catalog.listing.updated agora carrega o estoque anterior,
    // permitindo ao consumidor distinguir a transição real 0→N.
    await catalog.updateListing(
      { listingId: listing.listingId, quantityAvailable: 7 },
      actor(owner.userId, owner.sessionId),
    );
    const updated = await database.pool.query<{ payload: Record<string, unknown> }>(
      `select payload from eventing.outbox_events
        where event_type = 'catalog.listing.updated' and aggregate_id = $1
        order by recorded_at desc, event_id desc limit 1`,
      [listing.listingId],
    );
    expect(updated.rows[0]?.payload).toMatchObject({
      listingId: listing.listingId,
      previousQuantityAvailable: 3,
      quantityAvailable: 7,
    });
  }, 30_000);

  it("fechamento de grupo do carrinho publica um evento de estoque por listing", async () => {
    const suffix = randomUUID().slice(0, 8);
    const owner = await provisionUser(`cart-owner-${suffix}@example.test`);
    const buyer = await provisionUser(`cart-buyer-${suffix}@example.test`);
    await grantCatalogPlatformRole(owner.userId, suffix);

    const seller = await sellers.createSellerAccount(
      owner.userId,
      { displayName: `Loja Cart ${suffix}`, accountType: "INDIVIDUAL" },
      actor(owner.userId, owner.sessionId),
    );
    const sellerAccountId = parsePublicId("sellerAccount", seller.sellerAccountId);

    const catalogItem = await catalog.createCatalogItem(
      {
        publicSlug: `cart-item-${suffix}`,
        displayName: `Item Cart ${suffix}`,
        gameOrigin: "CS2",
        itemType: "WEAPON",
      },
      actor(owner.userId, owner.sessionId),
    );
    const basicPlan = await database.pool.query<{ listing_plan_id: string }>(
      "select listing_plan_id from catalog.listing_plans where plan_code = 'BASIC' limit 1",
    );
    const listingPlanId = basicPlan.rows[0]?.listing_plan_id;
    if (!listingPlanId) throw new Error("Plano BASIC não foi seedado.");

    const listingIds: string[] = [];
    for (const index of [1, 2]) {
      const listing = await catalog.createListing(
        {
          publicSlug: `cart-listing-${String(index)}-${suffix}`,
          catalogItemId: catalogItem.catalogItemId,
          sellerAccountId,
          listingPlanId,
          priceMinor: 10_000n,
          currency: "BRL",
          quantityAvailable: 5,
        },
        actor(owner.userId, owner.sessionId),
      );
      await database.pool.query(
        `update catalog.listings
            set listing_status = 'PUBLISHED', published_at = clock_timestamp()
          where listing_id = $1`,
        [listing.listingId],
      );
      listingIds.push(listing.listingId);
    }
    const [firstListingId, secondListingId] = listingIds;
    if (!firstListingId || !secondListingId) throw new Error("Listings não provisionados.");

    const buyerActor = actor(buyer.userId, buyer.sessionId);
    for (const listingId of listingIds) {
      await carts.addLine({ listingId, quantity: 2 }, buyerActor);
    }

    const order = await orders.placeOrderFromCartGroup(
      { sellerAccountId, idempotencyKey: `cart-place-${suffix}` },
      buyerActor,
    );

    for (const listingId of listingIds) {
      const events = await stockChangedEvents(listingId);
      expect(events).toHaveLength(1);
      expect(events[0]?.payload).toMatchObject({
        listingId,
        previousQuantityAvailable: 5,
        quantityAvailable: 3,
        orderId: order.orderId,
        reason: "ORDER_PLACED",
      });
    }

    // Cancelamento devolve as DUAS linhas, um evento por listing.
    await orders.cancelOrder(order.orderId, buyerActor);
    for (const listingId of listingIds) {
      const events = await stockChangedEvents(listingId);
      expect(events).toHaveLength(2);
      expect(events[1]?.payload).toMatchObject({
        listingId,
        previousQuantityAvailable: 3,
        quantityAvailable: 5,
        reason: "ORDER_CANCELLED",
      });
    }
  }, 30_000);
});

async function stockChangedEvents(listingId: string): Promise<
  { payload: StockChangedPayload; owner_module: string; aggregate_type: string }[]
> {
  const result = await database.pool.query<{
    payload: StockChangedPayload;
    owner_module: string;
    aggregate_type: string;
  }>(
    `select payload, owner_module, aggregate_type from eventing.outbox_events
      where event_type = 'catalog.listing.stock_changed' and aggregate_id = $1
      order by recorded_at, event_id`,
    [listingId],
  );
  return result.rows;
}

async function listingQuantity(listingId: string): Promise<number> {
  const result = await database.pool.query<{ quantity_available: number }>(
    "select quantity_available from catalog.listings where listing_id = $1",
    [listingId],
  );
  const quantity = result.rows[0]?.quantity_available;
  if (quantity === undefined) throw new Error("Listing ausente.");
  return quantity;
}

function actor(userId: string, sessionId: string): ActorContext {
  return { correlationId: randomUUID(), actorUserId: userId, sessionId, ipPrefix: "127.0.0.0/24" };
}

async function provisionUser(email: string) {
  const registration = await identity.register(
    {
      email,
      password: "Senha-Midas-Longa!2026",
      displayName: email.split("@")[0] ?? email,
      acceptedTermsVersion: "terms-2026-08",
    },
    { correlationId: randomUUID() },
  );
  if (!registration.verificationToken) throw new Error("token ausente");
  await identity.verifyEmail(registration.verificationToken, { correlationId: randomUUID() });
  const session = await identity.login(email, "Senha-Midas-Longa!2026", {
    correlationId: randomUUID(),
  });
  return { userId: parsePublicId("user", session.userId), sessionId: session.sessionId };
}

async function grantCatalogPlatformRole(userId: string, suffix: string): Promise<void> {
  const roleId = createUuidV7();
  await database.pool.query(
    `insert into iam.roles (role_id, role_code, role_scope, version)
     values ($1, $2, 'PLATFORM', 'integration-v1')`,
    [roleId, `stock-events-${suffix}-${roleId}`],
  );
  await database.pool.query(
    `insert into iam.role_permissions (role_id, permission_code) values ($1, 'catalog.items.manage')`,
    [roleId],
  );
  await database.pool.query(
    `insert into iam.user_role_assignments
       (assignment_id, user_id, role_id, assignment_status, valid_from)
     values ($1, $2, $3, 'ACTIVE', clock_timestamp() - interval '1 second')`,
    [createUuidV7(), userId, roleId],
  );
}
