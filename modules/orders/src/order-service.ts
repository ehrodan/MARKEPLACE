import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { appendAuditEvent } from "@midas/administration-audit";
import { catalogItems, listingCommercialSnapshots, listingPlans, listings } from "@midas/catalog";
import type { MidasDatabase, MidasTransaction } from "@midas/database";
import { withSerializableTransaction } from "@midas/database";
import { appendOutboxEvent } from "@midas/eventing";
import {
  AppProblem,
  createUuidV7,
  uuidV7Schema,
  type ActorContext,
} from "@midas/kernel";
import {
  assertActiveSellerMembership,
  assertOrderBuyer,
  assertOrderParticipant,
  orderNotFound,
  requireActorUserId,
} from "./authorization.js";
import {
  calculateFeeMinor,
  calculateLineTotalMinor,
  requirePurchasableListing,
  assertPositiveQuantity,
} from "./cart-service.js";
import {
  assertTransition,
  parseOrderStatus,
  type OrderStatus,
} from "./order-state.js";
import {
  cartLines,
  carts,
  deliveries,
  orderEvents,
  orderItems,
  orders,
  type DeliveryRow,
  type OrderEventRow,
  type OrderItemRow,
  type OrderRow,
} from "./schema.js";

/** Janela padrão de reserva de estoque de um pedido aguardando pagamento. */
export const defaultReservationMinutes = 30;

export type OrderServiceOptions = {
  reservationMinutes?: number;
};

export type PlaceOrderInput = {
  listingId: string;
  quantity: number;
  idempotencyKey: string;
};

export type PlaceOrderFromCartInput = {
  /** Vendedor cujo grupo do carrinho vira um pedido. Um pedido por vendedor. */
  sellerAccountId: string;
  idempotencyKey: string;
};

export type OrderPage = {
  data: OrderRow[];
  nextCursor: string | null;
  asOf: Date;
};

export type OrderDetail = {
  order: OrderRow;
  items: OrderItemRow[];
  timeline: OrderEventRow[];
  delivery: DeliveryRow | null;
  asOf: Date;
};

export type CommercialTerms = {
  source: "LISTING_SNAPSHOT" | "LISTING_PLAN";
  planCode: string;
  platformFeeRate: string;
};

export class OrderService {
  private readonly reservationMinutes: number;

  constructor(
    private readonly db: MidasDatabase,
    options: OrderServiceOptions = {},
  ) {
    this.reservationMinutes = options.reservationMinutes ?? defaultReservationMinutes;
  }

  /**
   * Cria o pedido reservando estoque de forma atômica.
   * Idempotente por `idempotencyKey`: repetir a chamada devolve o mesmo pedido.
   */
  async placeOrder(input: PlaceOrderInput, actor: ActorContext): Promise<OrderRow> {
    const buyerUserId = requireActorUserId(actor);
    const quantity = assertPositiveQuantity(input.quantity);
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
    const orderId = createUuidV7();
    const now = new Date();

    const placedOrderId = await withSerializableTransaction(this.db, async (transaction) => {
      const [replay] = await transaction
        .select()
        .from(orders)
        .where(eq(orders.idempotencyKey, idempotencyKey))
        .for("update");

      if (replay) {
        if (replay.buyerUserId !== buyerUserId) {
          throw conflict(
            "ORDER_IDEMPOTENCY_KEY_CONFLICT",
            "Esta chave de idempotência já pertence a outro comprador.",
          );
        }
        return replay.orderId;
      }

      const listing = await requirePurchasableListing(transaction, input.listingId, true);
      const [catalogItem] = await transaction
        .select({
          catalogItemId: catalogItems.catalogItemId,
          publicSlug: catalogItems.publicSlug,
          displayName: catalogItems.displayName,
          gameOrigin: catalogItems.gameOrigin,
          itemType: catalogItems.itemType,
          rarity: catalogItems.rarity,
          craftQuality: catalogItems.craftQuality,
          tombstonedAt: catalogItems.tombstonedAt,
        })
        .from(catalogItems)
        .where(eq(catalogItems.catalogItemId, listing.catalogItemId))
        .limit(1);

      if (!catalogItem || catalogItem.tombstonedAt !== null) {
        throw conflict("CATALOG_ITEM_NOT_AVAILABLE", "O item do catálogo não está disponível.");
      }

      // Reserva atômica: só decrementa se ainda houver a quantidade pedida.
      const reserved = await transaction
        .update(listings)
        .set({
          quantityAvailable: sql`${listings.quantityAvailable} - ${quantity}`,
          updatedAt: now,
        })
        .where(
          and(eq(listings.listingId, listing.listingId), gte(listings.quantityAvailable, quantity)),
        )
        .returning({ quantityAvailable: listings.quantityAvailable });

      if (reserved.length === 0) {
        throw conflict(
          "LISTING_INSUFFICIENT_QUANTITY",
          "O anúncio não possui mais a quantidade solicitada.",
        );
      }

      const terms = await loadCommercialTerms(transaction, listing.listingId, listing.listingPlanId);
      const subtotalMinor = calculateLineTotalMinor(listing.priceMinor, quantity);
      const feeMinor = calculateFeeMinor(subtotalMinor, terms.platformFeeRate);
      const reservedUntil = new Date(now.getTime() + this.reservationMinutes * 60_000);

      await transaction.insert(orders).values({
        orderId,
        publicCode: buildOrderPublicCode(orderId),
        buyerUserId,
        sellerAccountId: listing.sellerAccountId,
        status: "PENDING_PAYMENT",
        subtotalMinor,
        feeMinor,
        totalMinor: subtotalMinor,
        currency: listing.currency,
        idempotencyKey,
        reservedUntil,
        placedAt: now,
        paidAt: null,
        completedAt: null,
        cancelledAt: null,
        cancelReason: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });

      await transaction.insert(orderItems).values({
        orderItemId: createUuidV7(),
        orderId,
        listingId: listing.listingId,
        catalogItemId: listing.catalogItemId,
        quantity,
        unitPriceMinor: listing.priceMinor,
        totalMinor: subtotalMinor,
        currency: listing.currency,
        listingSnapshot: {
          listingId: listing.listingId,
          publicSlug: listing.publicSlug,
          listingStatus: listing.listingStatus,
          sellerAccountId: listing.sellerAccountId,
          priceMinor: listing.priceMinor.toString(),
          currency: listing.currency,
          planCode: terms.planCode,
          platformFeeRate: terms.platformFeeRate,
          commercialTermsSource: terms.source,
          catalogItem: {
            catalogItemId: catalogItem.catalogItemId,
            publicSlug: catalogItem.publicSlug,
            displayName: catalogItem.displayName,
            gameOrigin: catalogItem.gameOrigin,
            itemType: catalogItem.itemType,
            rarity: catalogItem.rarity,
            craftQuality: catalogItem.craftQuality,
          },
          capturedAt: now.toISOString(),
        },
      });

      await recordOrderEvent(transaction, {
        orderId,
        eventType: "order.placed",
        fromStatus: null,
        toStatus: "PENDING_PAYMENT",
        actorUserId: buyerUserId,
        occurredAt: now,
        payload: {
          listingId: listing.listingId,
          quantity,
          subtotalMinor: subtotalMinor.toString(),
          feeMinor: feeMinor.toString(),
          currency: listing.currency,
          reservedUntil: reservedUntil.toISOString(),
        },
      });

      await appendOutboxEvent(
        transaction,
        {
          eventType: "order.placed",
          schemaVersion: 1,
          aggregateType: "Order",
          aggregateId: orderId,
          aggregateVersion: 1,
          occurredAt: now,
          sellerAccountId: listing.sellerAccountId,
          ownerModule: "orders",
          dataClassification: "INTERNAL",
          payload: {
            orderId,
            buyerUserId,
            sellerAccountId: listing.sellerAccountId,
            listingId: listing.listingId,
            quantity,
            subtotalMinor: subtotalMinor.toString(),
            feeMinor: feeMinor.toString(),
            totalMinor: subtotalMinor.toString(),
            currency: listing.currency,
            reservedUntil: reservedUntil.toISOString(),
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "orders.order.place",
          resourceType: "Order",
          resourceId: orderId,
          sellerAccountId: listing.sellerAccountId,
          afterRedacted: {
            status: "PENDING_PAYMENT",
            listingId: listing.listingId,
            quantity,
            totalMinor: subtotalMinor.toString(),
            currency: listing.currency,
          },
          dataClassification: "INTERNAL",
        },
        actor,
      );

      return orderId;
    });

    return this.requireOrderById(placedOrderId);
  }

  /**
   * Fecha UM grupo do carrinho — um vendedor — como um pedido.
   *
   * Esta era a lacuna do fluxo de compra: o carrinho já agrupava por vendedor
   * (`listCheckoutGroups`), mas `placeOrder` só aceitava um anúncio, então não
   * havia caminho de "carrinho com N itens" para "pedido". Comprar dois itens
   * do mesmo vendedor exigia dois pedidos.
   *
   * Um pedido POR VENDEDOR, e não um pedido para o carrinho inteiro, porque
   * cada vendedor tem sua própria comissão, seu próprio prazo, sua própria
   * entrega e seu próprio direito de cancelar. Um pedido que atravessasse
   * vendedores não teria dono para nenhuma dessas decisões.
   *
   * Tudo em UMA transação serializável: ou o grupo inteiro vira pedido com o
   * estoque reservado, ou nada acontece. Reservar parte do carrinho e falhar no
   * resto deixaria estoque preso sem pedido que o justificasse.
   */
  async placeOrderFromCartGroup(
    input: PlaceOrderFromCartInput,
    actor: ActorContext,
  ): Promise<OrderRow> {
    const buyerUserId = requireActorUserId(actor);
    const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
    const orderId = createUuidV7();
    const now = new Date();

    const placedOrderId = await withSerializableTransaction(this.db, async (transaction) => {
      const [replay] = await transaction
        .select()
        .from(orders)
        .where(eq(orders.idempotencyKey, idempotencyKey))
        .for("update");

      if (replay) {
        if (replay.buyerUserId !== buyerUserId) {
          throw conflict(
            "ORDER_IDEMPOTENCY_KEY_CONFLICT",
            "Esta chave de idempotência já pertence a outro comprador.",
          );
        }
        return replay.orderId;
      }

      const [cart] = await transaction
        .select()
        .from(carts)
        .where(and(eq(carts.userId, buyerUserId), eq(carts.status, "ACTIVE")))
        .limit(1);

      if (!cart) {
        throw conflict("CART_EMPTY", "Não há carrinho ativo para fechar.");
      }

      // `for update` nas linhas do grupo: duas abas do mesmo comprador não
      // fecham o mesmo grupo duas vezes.
      const groupLines = await transaction
        .select()
        .from(cartLines)
        .where(
          and(
            eq(cartLines.cartId, cart.cartId),
            eq(cartLines.sellerAccountId, input.sellerAccountId),
          ),
        )
        .orderBy(asc(cartLines.addedAt), asc(cartLines.cartLineId))
        .for("update");

      if (groupLines.length === 0) {
        throw conflict(
          "CART_GROUP_EMPTY",
          "Este vendedor não tem itens no seu carrinho.",
        );
      }

      let subtotalMinor = 0n;
      let currency: string | null = null;
      let feeRate: CommercialTerms | null = null;
      const itemRows: (typeof orderItems.$inferInsert)[] = [];

      for (const line of groupLines) {
        const quantity = assertPositiveQuantity(line.quantity);
        const listing = await requirePurchasableListing(transaction, line.listingId, true);

        if (listing.sellerAccountId !== input.sellerAccountId) {
          // A linha do carrinho guarda o vendedor de quando foi adicionada. Se
          // o anúncio trocou de dono, o grupo deixou de ser o que a pessoa viu.
          throw conflict(
            "CART_LINE_SELLER_CHANGED",
            "Um item do carrinho mudou de vendedor. Revise o carrinho.",
          );
        }

        const [catalogItem] = await transaction
          .select({
            catalogItemId: catalogItems.catalogItemId,
            publicSlug: catalogItems.publicSlug,
            displayName: catalogItems.displayName,
            gameOrigin: catalogItems.gameOrigin,
            itemType: catalogItems.itemType,
            rarity: catalogItems.rarity,
            craftQuality: catalogItems.craftQuality,
            tombstonedAt: catalogItems.tombstonedAt,
          })
          .from(catalogItems)
          .where(eq(catalogItems.catalogItemId, listing.catalogItemId))
          .limit(1);

        if (!catalogItem || catalogItem.tombstonedAt !== null) {
          throw conflict("CATALOG_ITEM_NOT_AVAILABLE", "O item do catálogo não está disponível.");
        }

        if (currency && currency !== listing.currency) {
          // Um pedido tem uma moeda. Somar moedas diferentes produziria um
          // total que não existe.
          throw conflict(
            "CART_GROUP_MIXED_CURRENCY",
            "Os itens deste vendedor estão em moedas diferentes.",
          );
        }
        currency = listing.currency;

        const reserved = await transaction
          .update(listings)
          .set({
            quantityAvailable: sql`${listings.quantityAvailable} - ${quantity}`,
            updatedAt: now,
          })
          .where(
            and(
              eq(listings.listingId, listing.listingId),
              gte(listings.quantityAvailable, quantity),
            ),
          )
          .returning({ quantityAvailable: listings.quantityAvailable });

        if (reserved.length === 0) {
          throw conflict(
            "LISTING_INSUFFICIENT_QUANTITY",
            "O anúncio não possui mais a quantidade solicitada.",
          );
        }

        const terms = await loadCommercialTerms(
          transaction,
          listing.listingId,
          listing.listingPlanId,
        );
        feeRate ??= terms;
        const lineTotalMinor = calculateLineTotalMinor(listing.priceMinor, quantity);
        subtotalMinor += lineTotalMinor;

        itemRows.push({
          orderItemId: createUuidV7(),
          orderId,
          listingId: listing.listingId,
          catalogItemId: listing.catalogItemId,
          quantity,
          unitPriceMinor: listing.priceMinor,
          totalMinor: lineTotalMinor,
          currency: listing.currency,
          listingSnapshot: {
            listingId: listing.listingId,
            publicSlug: listing.publicSlug,
            listingStatus: listing.listingStatus,
            sellerAccountId: listing.sellerAccountId,
            priceMinor: listing.priceMinor.toString(),
            currency: listing.currency,
            planCode: terms.planCode,
            platformFeeRate: terms.platformFeeRate,
            commercialTermsSource: terms.source,
            catalogItem: {
              catalogItemId: catalogItem.catalogItemId,
              publicSlug: catalogItem.publicSlug,
              displayName: catalogItem.displayName,
              gameOrigin: catalogItem.gameOrigin,
              itemType: catalogItem.itemType,
              rarity: catalogItem.rarity,
              craftQuality: catalogItem.craftQuality,
            },
            capturedAt: now.toISOString(),
          },
        });
      }

      if (!currency || !feeRate) {
        throw conflict("CART_GROUP_EMPTY", "Este vendedor não tem itens no seu carrinho.");
      }

      // A comissão incide sobre o subtotal do PEDIDO, uma vez, e não por linha:
      // arredondar por item cobraria centavos a mais a cada linha.
      const feeMinor = calculateFeeMinor(subtotalMinor, feeRate.platformFeeRate);
      const reservedUntil = new Date(now.getTime() + this.reservationMinutes * 60_000);

      await transaction.insert(orders).values({
        orderId,
        publicCode: buildOrderPublicCode(orderId),
        buyerUserId,
        sellerAccountId: input.sellerAccountId,
        status: "PENDING_PAYMENT",
        subtotalMinor,
        feeMinor,
        totalMinor: subtotalMinor,
        currency,
        idempotencyKey,
        reservedUntil,
        placedAt: now,
        paidAt: null,
        completedAt: null,
        cancelledAt: null,
        cancelReason: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });

      await transaction.insert(orderItems).values(itemRows);

      // As linhas saem do carrinho porque viraram pedido. Deixá-las lá faria a
      // pessoa comprar duas vezes o mesmo item.
      await transaction
        .delete(cartLines)
        .where(
          and(
            eq(cartLines.cartId, cart.cartId),
            eq(cartLines.sellerAccountId, input.sellerAccountId),
          ),
        );

      // Se este era o último grupo, o carrinho cumpriu seu papel e vira
      // CONVERTED. Sem isto ele ficaria `ACTIVE` e vazio para sempre — e um
      // carrinho ativo vazio é exatamente o que a projeção de recuperação de
      // `docs/14 §5` procura para mandar lembrete. A pessoa receberia
      // "você esqueceu algo" logo depois de comprar.
      const [remaining] = await transaction
        .select({ total: sql<number>`count(*)::int` })
        .from(cartLines)
        .where(eq(cartLines.cartId, cart.cartId));

      if ((remaining?.total ?? 0) === 0) {
        await transaction
          .update(carts)
          .set({ status: "CONVERTED", updatedAt: now, version: cart.version + 1 })
          .where(eq(carts.cartId, cart.cartId));
      }

      await recordOrderEvent(transaction, {
        orderId,
        eventType: "order.placed",
        fromStatus: null,
        toStatus: "PENDING_PAYMENT",
        actorUserId: buyerUserId,
        occurredAt: now,
        payload: {
          origin: "CART_GROUP",
          sellerAccountId: input.sellerAccountId,
          itemCount: itemRows.length,
          subtotalMinor: subtotalMinor.toString(),
          feeMinor: feeMinor.toString(),
          currency,
          reservedUntil: reservedUntil.toISOString(),
        },
      });

      await appendOutboxEvent(
        transaction,
        {
          eventType: "order.placed",
          schemaVersion: 1,
          aggregateType: "Order",
          aggregateId: orderId,
          aggregateVersion: 1,
          occurredAt: now,
          sellerAccountId: input.sellerAccountId,
          ownerModule: "orders",
          dataClassification: "INTERNAL",
          payload: {
            orderId,
            buyerUserId,
            sellerAccountId: input.sellerAccountId,
            origin: "CART_GROUP",
            itemCount: itemRows.length,
            subtotalMinor: subtotalMinor.toString(),
            feeMinor: feeMinor.toString(),
            totalMinor: subtotalMinor.toString(),
            currency,
            reservedUntil: reservedUntil.toISOString(),
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "orders.order.place",
          resourceType: "Order",
          resourceId: orderId,
          sellerAccountId: input.sellerAccountId,
          afterRedacted: {
            status: "PENDING_PAYMENT",
            origin: "CART_GROUP",
            itemCount: itemRows.length,
            totalMinor: subtotalMinor.toString(),
            currency,
          },
          dataClassification: "INTERNAL",
        },
        actor,
      );

      return orderId;
    });

    return this.requireOrderById(placedOrderId);
  }

  async listPurchases(
    actor: ActorContext,
    options: { status?: OrderStatus | undefined; cursor?: string | undefined; limit?: number | undefined } = {},
  ): Promise<OrderPage> {
    const buyerUserId = requireActorUserId(actor);
    const asOf = new Date();
    const limit = normalizeLimit(options.limit);
    const conditions = [eq(orders.buyerUserId, buyerUserId)];
    if (options.status) conditions.push(eq(orders.status, options.status));
    if (options.cursor) conditions.push(lt(orders.orderId, parseCursor(options.cursor)));

    const rows = await this.db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.orderId))
      .limit(limit + 1);

    return buildPage(rows, limit, asOf);
  }

  async listSellerOrders(
    sellerAccountId: string,
    actor: ActorContext,
    options: { status?: OrderStatus | undefined; cursor?: string | undefined; limit?: number | undefined } = {},
  ): Promise<OrderPage> {
    await assertActiveSellerMembership(this.db, actor, sellerAccountId);
    const asOf = new Date();
    const limit = normalizeLimit(options.limit);
    const conditions = [eq(orders.sellerAccountId, sellerAccountId)];
    if (options.status) conditions.push(eq(orders.status, options.status));
    if (options.cursor) conditions.push(lt(orders.orderId, parseCursor(options.cursor)));

    const rows = await this.db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.orderId))
      .limit(limit + 1);

    return buildPage(rows, limit, asOf);
  }

  async getOrderDetail(orderId: string, actor: ActorContext): Promise<OrderDetail> {
    const asOf = new Date();
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.orderId, orderId))
      .limit(1);
    if (!order) throw orderNotFound();
    await assertOrderParticipant(this.db, actor, order);

    const [items, timeline, delivery] = await Promise.all([
      this.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
        .orderBy(asc(orderItems.orderItemId)),
      this.db
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.orderId, orderId))
        .orderBy(asc(orderEvents.occurredAt), asc(orderEvents.orderEventId)),
      this.db
        .select()
        .from(deliveries)
        .where(eq(deliveries.orderId, orderId))
        .limit(1),
    ]);

    return { order, items, timeline, delivery: delivery[0] ?? null, asOf };
  }

  /** Cancelamento pelo comprador antes do pagamento: devolve o estoque reservado. */
  async cancelOrder(
    orderId: string,
    actor: ActorContext,
    options: { reason?: string | undefined } = {},
  ): Promise<OrderRow> {
    await withSerializableTransaction(this.db, async (transaction) => {
      const order = await lockOrder(transaction, orderId);
      assertOrderBuyer(actor, order);
      await cancelOrderInTransaction(transaction, order, actor, {
        reasonCode: options.reason ?? "BUYER_CANCELLED",
        auditAction: "orders.order.cancel",
      });
    });

    return this.requireOrderById(orderId);
  }

  /**
   * Confirmação de pagamento (comando do módulo financeiro).
   * Libera a reserva por tempo e abre a entrega com as instruções reveladas.
   */
  async markPaid(
    orderId: string,
    actor: ActorContext,
    options: { paidAt?: Date | undefined } = {},
  ): Promise<OrderRow> {
    await withSerializableTransaction(this.db, async (transaction) => {
      const order = await lockOrder(transaction, orderId);
      const currentStatus = parseOrderStatus(order.status);
      if (currentStatus === "PAID") return;
      assertTransition(currentStatus, "PAID");

      const paidAt = options.paidAt ?? new Date();
      const nextVersion = order.version + 1;

      await transaction
        .update(orders)
        .set({
          status: "PAID",
          paidAt,
          reservedUntil: null,
          version: nextVersion,
          updatedAt: paidAt,
        })
        .where(eq(orders.orderId, orderId));

      const [existingDelivery] = await transaction
        .select({ deliveryId: deliveries.deliveryId })
        .from(deliveries)
        .where(eq(deliveries.orderId, orderId))
        .limit(1);

      if (!existingDelivery) {
        await transaction.insert(deliveries).values({
          deliveryId: createUuidV7(),
          orderId,
          status: "PENDING",
          buyerConfirmedAt: null,
          sellerConfirmedAt: null,
          instructionRevealedAt: paidAt,
          version: 1,
          createdAt: paidAt,
          updatedAt: paidAt,
        });
      }

      await recordOrderEvent(transaction, {
        orderId,
        eventType: "order.paid",
        fromStatus: currentStatus,
        toStatus: "PAID",
        actorUserId: actor.actorUserId ?? null,
        occurredAt: paidAt,
        payload: {
          totalMinor: order.totalMinor.toString(),
          currency: order.currency,
          paidAt: paidAt.toISOString(),
        },
      });

      await appendOutboxEvent(
        transaction,
        {
          eventType: "order.paid",
          schemaVersion: 1,
          aggregateType: "Order",
          aggregateId: orderId,
          aggregateVersion: nextVersion,
          occurredAt: paidAt,
          sellerAccountId: order.sellerAccountId,
          ownerModule: "orders",
          dataClassification: "INTERNAL",
          payload: {
            orderId,
            buyerUserId: order.buyerUserId,
            sellerAccountId: order.sellerAccountId,
            totalMinor: order.totalMinor.toString(),
            feeMinor: order.feeMinor.toString(),
            currency: order.currency,
            paidAt: paidAt.toISOString(),
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "orders.order.mark_paid",
          resourceType: "Order",
          resourceId: orderId,
          sellerAccountId: order.sellerAccountId,
          beforeRedacted: { status: currentStatus },
          afterRedacted: { status: "PAID", paidAt: paidAt.toISOString() },
          dataClassification: "INTERNAL",
        },
        actor,
      );
    });

    return this.requireOrderById(orderId);
  }

  /**
   * Varredura de reservas vencidas: cancela pedidos não pagos e devolve o estoque.
   * Devolve os ids cancelados nesta passada.
   */
  async cancelExpiredReservations(
    actor: ActorContext,
    options: { now?: Date | undefined; limit?: number | undefined } = {},
  ): Promise<string[]> {
    const now = options.now ?? new Date();
    const limit = normalizeLimit(options.limit);
    const candidates = await this.db
      .select({ orderId: orders.orderId })
      .from(orders)
      .where(and(eq(orders.status, "PENDING_PAYMENT"), lte(orders.reservedUntil, now)))
      .orderBy(asc(orders.reservedUntil), asc(orders.orderId))
      .limit(limit);

    const cancelled: string[] = [];
    for (const candidate of candidates) {
      const done = await withSerializableTransaction(this.db, async (transaction) => {
        const order = await lockOrder(transaction, candidate.orderId);
        if (order.status !== "PENDING_PAYMENT") return false;
        if (order.reservedUntil === null || order.reservedUntil > now) return false;
        await cancelOrderInTransaction(transaction, order, actor, {
          reasonCode: "RESERVATION_EXPIRED",
          auditAction: "orders.order.expire_reservation",
          occurredAt: now,
        });
        return true;
      });
      if (done) cancelled.push(candidate.orderId);
    }
    return cancelled;
  }

  async getOrderById(orderId: string): Promise<OrderRow | null> {
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.orderId, orderId))
      .limit(1);
    return order ?? null;
  }

  private async requireOrderById(orderId: string): Promise<OrderRow> {
    const order = await this.getOrderById(orderId);
    if (!order) throw orderNotFound();
    return order;
  }
}

/* ------------------------------------------------------------------ */
/* Internos compartilhados com DeliveryService                         */
/* ------------------------------------------------------------------ */

export async function lockOrder(
  transaction: MidasTransaction,
  orderId: string,
): Promise<OrderRow> {
  const [order] = await transaction
    .select()
    .from(orders)
    .where(eq(orders.orderId, orderId))
    .for("update");
  if (!order) throw orderNotFound();
  return order;
}

export async function recordOrderEvent(
  transaction: MidasTransaction,
  input: {
    orderId: string;
    eventType: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus | null;
    actorUserId: string | null;
    occurredAt: Date;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await transaction.insert(orderEvents).values({
    orderEventId: createUuidV7(),
    orderId: input.orderId,
    eventType: input.eventType,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorUserId: input.actorUserId,
    payload: input.payload,
    occurredAt: input.occurredAt,
  });
}

async function cancelOrderInTransaction(
  transaction: MidasTransaction,
  order: OrderRow,
  actor: ActorContext,
  options: { reasonCode: string; auditAction: string; occurredAt?: Date },
): Promise<void> {
  const currentStatus = parseOrderStatus(order.status);
  assertTransition(currentStatus, "CANCELLED");

  const occurredAt = options.occurredAt ?? new Date();
  const nextVersion = order.version + 1;

  const items = await transaction
    .select({ listingId: orderItems.listingId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.orderId));

  for (const item of items) {
    await transaction
      .update(listings)
      .set({
        quantityAvailable: sql`${listings.quantityAvailable} + ${item.quantity}`,
        updatedAt: occurredAt,
      })
      .where(eq(listings.listingId, item.listingId));
  }

  await transaction
    .update(orders)
    .set({
      status: "CANCELLED",
      cancelledAt: occurredAt,
      cancelReason: options.reasonCode,
      reservedUntil: null,
      version: nextVersion,
      updatedAt: occurredAt,
    })
    .where(eq(orders.orderId, order.orderId));

  await recordOrderEvent(transaction, {
    orderId: order.orderId,
    eventType: "order.cancelled",
    fromStatus: currentStatus,
    toStatus: "CANCELLED",
    actorUserId: actor.actorUserId ?? null,
    occurredAt,
    payload: {
      reasonCode: options.reasonCode,
      restoredLines: items.length,
    },
  });

  await appendOutboxEvent(
    transaction,
    {
      eventType: "order.cancelled",
      schemaVersion: 1,
      aggregateType: "Order",
      aggregateId: order.orderId,
      aggregateVersion: nextVersion,
      occurredAt,
      sellerAccountId: order.sellerAccountId,
      ownerModule: "orders",
      dataClassification: "INTERNAL",
      payload: {
        orderId: order.orderId,
        buyerUserId: order.buyerUserId,
        sellerAccountId: order.sellerAccountId,
        reasonCode: options.reasonCode,
        cancelledAt: occurredAt.toISOString(),
        restoredLines: items.length,
      },
    },
    actor,
  );

  await appendAuditEvent(
    transaction,
    {
      action: options.auditAction,
      resourceType: "Order",
      resourceId: order.orderId,
      sellerAccountId: order.sellerAccountId,
      beforeRedacted: { status: currentStatus },
      afterRedacted: { status: "CANCELLED", reasonCode: options.reasonCode },
      reasonCode: options.reasonCode,
      dataClassification: "INTERNAL",
    },
    actor,
  );
}

async function loadCommercialTerms(
  transaction: MidasTransaction,
  listingId: string,
  listingPlanId: string,
): Promise<CommercialTerms> {
  const [snapshot] = await transaction
    .select({
      planCode: listingCommercialSnapshots.planCode,
      platformFeeRate: listingCommercialSnapshots.platformFeeRate,
    })
    .from(listingCommercialSnapshots)
    .where(eq(listingCommercialSnapshots.listingId, listingId))
    .limit(1);

  if (snapshot) {
    return {
      source: "LISTING_SNAPSHOT",
      planCode: snapshot.planCode,
      platformFeeRate: snapshot.platformFeeRate,
    };
  }

  const [plan] = await transaction
    .select({
      planCode: listingPlans.planCode,
      platformFeeRate: listingPlans.platformFeeRate,
    })
    .from(listingPlans)
    .where(eq(listingPlans.listingPlanId, listingPlanId))
    .limit(1);

  if (plan) {
    return {
      source: "LISTING_PLAN",
      planCode: plan.planCode,
      platformFeeRate: plan.platformFeeRate,
    };
  }

  throw new AppProblem({
    status: 500,
    code: "ORDER_COMMERCIAL_TERMS_UNAVAILABLE",
    title: "Termos comerciais indisponíveis",
    detail: "O anúncio não possui plano nem snapshot comercial para calcular a comissão.",
  });
}

/* ------------------------------------------------------------------ */
/* Auxiliares puros                                                    */
/* ------------------------------------------------------------------ */

/** Código público legível derivado do próprio identificador do pedido. */
export function buildOrderPublicCode(orderId: string): string {
  const hex = orderId.replaceAll("-", "").toUpperCase();
  return `MID-${hex.slice(-16, -8)}-${hex.slice(-8)}`;
}

export function normalizeIdempotencyKey(key: string): string {
  const normalized = key.trim();
  if (normalized.length === 0 || normalized.length > 200) {
    throw new AppProblem({
      status: 422,
      code: "IDEMPOTENCY_KEY_INVALID",
      title: "Chave de idempotência inválida",
      detail: "Informe uma chave de idempotência com 1 a 200 caracteres.",
      fieldErrors: [{ field: "idempotencyKey", message: "Informe de 1 a 200 caracteres." }],
    });
  }
  return normalized;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return 20;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new AppProblem({
      status: 422,
      code: "PAGE_LIMIT_INVALID",
      title: "Limite inválido",
      detail: "O limite de página precisa ser um inteiro entre 1 e 100.",
      fieldErrors: [{ field: "limit", message: "Use um inteiro entre 1 e 100." }],
    });
  }
  return limit;
}

function parseCursor(cursor: string): string {
  const parsed = uuidV7Schema.safeParse(cursor);
  if (!parsed.success) {
    throw new AppProblem({
      status: 422,
      code: "CURSOR_INVALID",
      title: "Cursor inválido",
      detail: "O cursor de paginação não é um identificador válido.",
      fieldErrors: [{ field: "cursor", message: "Use o nextCursor devolvido pela página anterior." }],
    });
  }
  return parsed.data;
}

function buildPage(rows: OrderRow[], limit: number, asOf: Date): OrderPage {
  const hasNext = rows.length > limit;
  const data = hasNext ? rows.slice(0, limit) : rows;
  const lastOrder = data.at(-1);
  return {
    data,
    nextCursor: hasNext && lastOrder ? lastOrder.orderId : null,
    asOf,
  };
}

function conflict(code: string, detail: string): AppProblem {
  return new AppProblem({
    status: 409,
    code,
    title: "Conflito de negócio",
    detail,
  });
}
