import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CatalogService } from "@midas/catalog";
import { createDatabase, defaultMigrationDirectories, runSqlMigrations } from "@midas/database";
import { IdentityService } from "@midas/identity";
import { createUuidV7, parsePublicId, type ActorContext } from "@midas/kernel";
import { OrderService } from "@midas/orders";
import { WatchlistService } from "@midas/retention";
import { SellerService } from "@midas/sellers";
import { createRetentionTriggerDependencies } from "../src/retention-trigger-adapters.js";
import {
  LISTING_STOCK_CHANGED_EVENT_TYPE,
  LISTING_UPDATED_EVENT_TYPE,
  RETENTION_TRIGGER_CONSUMER_ID,
  runRetentionTriggerCycle,
} from "../src/retention-trigger.js";

/**
 * Circuito completo com PostgreSQL real: o fluxo de pedidos debita/devolve estoque
 * publicando `catalog.listing.stock_changed` no outbox, e o motor de triggers consome:
 *
 *   - débito de compra (2→0) NÃO é notícia — nenhum BACK_IN_STOCK falso;
 *   - devolução por cancelamento (0→2) é a transição real 0→N — BACK_IN_STOCK entregue
 *     no feed com a quantidade verdadeira, e a vigilância fecha.
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
const watchlist = new WatchlistService(database.db);

beforeAll(async () => {
  await runSqlMigrations(database.pool, defaultMigrationDirectories());
});

afterAll(async () => {
  await database.close();
});

describe("motor de triggers consome eventos de estoque do fluxo de pedidos", () => {
  it("débito não dispara; devolução 0→N entrega BACK_IN_STOCK e fecha a vigilância", async () => {
    const suffix = randomUUID().slice(0, 8);
    const owner = await provisionUser(`trigger-owner-${suffix}@example.test`);
    const buyer = await provisionUser(`trigger-buyer-${suffix}@example.test`);
    const watcher = await provisionUser(`trigger-watcher-${suffix}@example.test`);
    await grantCatalogPlatformRole(owner.userId, suffix);

    const seller = await sellers.createSellerAccount(
      owner.userId,
      { displayName: `Loja Trigger ${suffix}`, accountType: "INDIVIDUAL" },
      actor(owner.userId, owner.sessionId),
    );
    const sellerAccountId = parsePublicId("sellerAccount", seller.sellerAccountId);

    const catalogItem = await catalog.createCatalogItem(
      {
        publicSlug: `trigger-item-${suffix}`,
        displayName: `Item Trigger ${suffix}`,
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
        publicSlug: `trigger-listing-${suffix}`,
        catalogItemId: catalogItem.catalogItemId,
        sellerAccountId,
        listingPlanId,
        priceMinor: 150_000n,
        currency: "BRL",
        quantityAvailable: 2,
      },
      actor(owner.userId, owner.sessionId),
    );
    await database.pool.query(
      `update catalog.listings
          set listing_status = 'PUBLISHED', published_at = clock_timestamp()
        where listing_id = $1`,
      [listing.listingId],
    );

    // Vigilância REAL armada antes dos eventos (o filtro de oportunidade compara createdAt).
    const entry = await watchlist.watch(
      {
        userId: watcher.userId,
        listingId: listing.listingId,
        catalogItemId: catalogItem.catalogItemId,
        kind: "BACK_IN_STOCK",
        currency: "BRL",
        referencePriceMinor: 150_000n,
      },
      actor(watcher.userId, watcher.sessionId),
    );

    // O banco local acumula eventos de outras rodadas; o consumidor é um só por design
    // (inbox receipt por evento). Ack prévio isola o teste sem mudar o contrato.
    await ackAllPendingListingEvents();

    // Compra que ZERA o estoque (2→0): evento consumido, nada entregue.
    const order = await orders.placeOrder(
      { listingId: listing.listingId, quantity: 2, idempotencyKey: `trigger-place-${suffix}` },
      actor(buyer.userId, buyer.sessionId),
    );

    const deps = createRetentionTriggerDependencies(database);
    const debitCycle = await runRetentionTriggerCycle(deps);
    expect(debitCycle.failed).toEqual([]);
    expect(debitCycle.invalid).toEqual([]);
    expect(debitCycle.processed).toBeGreaterThanOrEqual(1);
    expect(debitCycle.delivered).toBe(0);
    await expect(backInStockNotifications(watcher.userId)).resolves.toHaveLength(0);
    await expect(watchStatus(entry.watchlistEntryId)).resolves.toBe("ACTIVE");

    // Cancelamento devolve o estoque (0→2): transição real, aviso entregue, vigilância fecha.
    await orders.cancelOrder(order.orderId, actor(buyer.userId, buyer.sessionId));

    const restoreCycle = await runRetentionTriggerCycle(deps);
    expect(restoreCycle.failed).toEqual([]);
    expect(restoreCycle.invalid).toEqual([]);
    expect(restoreCycle.delivered).toBe(1);
    expect(restoreCycle.closedWatches).toBe(1);

    const delivered = await backInStockNotifications(watcher.userId);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.body).toContain("2 unidades disponíveis");
    expect(delivered[0]?.related_ref).toBe(listing.listingId);
    await expect(watchStatus(entry.watchlistEntryId)).resolves.toBe("TRIGGERED");

    // Replay do ciclo: eventos já têm receipt, nada duplica.
    const replayCycle = await runRetentionTriggerCycle(deps);
    expect(replayCycle.fetched).toBe(0);
    await expect(backInStockNotifications(watcher.userId)).resolves.toHaveLength(1);
  }, 45_000);
});

async function ackAllPendingListingEvents(): Promise<void> {
  await database.pool.query(
    `insert into eventing.inbox_receipts (consumer_id, event_id)
     select $1, event_id from eventing.outbox_events where event_type = any($2)
     on conflict do nothing`,
    [RETENTION_TRIGGER_CONSUMER_ID, [LISTING_UPDATED_EVENT_TYPE, LISTING_STOCK_CHANGED_EVENT_TYPE]],
  );
}

async function backInStockNotifications(
  userId: string,
): Promise<{ body: string; related_ref: string | null }[]> {
  const result = await database.pool.query<{ body: string; related_ref: string | null }>(
    `select body, related_ref from retention.notifications
      where user_id = $1 and kind = 'BACK_IN_STOCK'
      order by created_at`,
    [userId],
  );
  return result.rows;
}

async function watchStatus(watchlistEntryId: string): Promise<string> {
  const result = await database.pool.query<{ status: string }>(
    "select status from retention.watchlist_entries where watchlist_entry_id = $1",
    [watchlistEntryId],
  );
  const status = result.rows[0]?.status;
  if (!status) throw new Error("Vigilância ausente.");
  return status;
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
    [roleId, `trigger-integration-${suffix}-${roleId}`],
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
