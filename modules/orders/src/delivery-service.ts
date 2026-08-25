import { eq } from "drizzle-orm";
import { appendAuditEvent } from "@midas/administration-audit";
import type { MidasDatabase, MidasTransaction } from "@midas/database";
import { withSerializableTransaction } from "@midas/database";
import { appendOutboxEvent } from "@midas/eventing";
import { AppProblem, createUuidV7, type ActorContext } from "@midas/kernel";
import { assertDeliveryRole, assertOrderParticipant, orderNotFound } from "./authorization.js";
import { lockOrder, recordOrderEvent } from "./order-service.js";
import {
  applyDeliveryConfirmation,
  assertTransition,
  isDeliveryComplete,
  parseDeliveryStatus,
  parseOrderStatus,
  type DeliveryRole,
  type DeliveryStatus,
} from "./order-state.js";
import { deliveries, orders, type DeliveryRow, type OrderRow } from "./schema.js";

export class DeliveryService {
  constructor(private readonly db: MidasDatabase) {}

  /** Entrega do pedido; `null` enquanto o pagamento não abriu a entrega. */
  async getDelivery(orderId: string, actor: ActorContext): Promise<DeliveryRow | null> {
    const [order] = await this.db
      .select({
        orderId: orders.orderId,
        buyerUserId: orders.buyerUserId,
        sellerAccountId: orders.sellerAccountId,
      })
      .from(orders)
      .where(eq(orders.orderId, orderId))
      .limit(1);
    if (!order) throw orderNotFound();
    await assertOrderParticipant(this.db, actor, order);

    const [delivery] = await this.db
      .select()
      .from(deliveries)
      .where(eq(deliveries.orderId, orderId))
      .limit(1);
    return delivery ?? null;
  }

  /**
   * Confirma a entrega no papel informado. Idempotente por papel: repetir a
   * confirmação não gera novo evento. Quando ambos confirmam, o pedido vai
   * para COMPLETED e são emitidos `order.completed` e `funds.hold_started`.
   */
  async confirmDelivery(
    orderId: string,
    role: DeliveryRole,
    actor: ActorContext,
  ): Promise<DeliveryRow> {
    await withSerializableTransaction(this.db, async (transaction) => {
      const order = await lockOrder(transaction, orderId);
      await assertDeliveryRole(transaction, actor, order, role);

      const delivery = await lockDelivery(transaction, orderId);
      const currentDeliveryStatus = parseDeliveryStatus(delivery.status);
      const nextDeliveryStatus = applyDeliveryConfirmation(currentDeliveryStatus, role);
      if (nextDeliveryStatus === currentDeliveryStatus) return;

      const now = new Date();
      const workingOrder = await this.startDeliveryIfNeeded(transaction, order, actor, now);
      const orderStatus = parseOrderStatus(workingOrder.status);
      if (orderStatus !== "IN_DELIVERY") {
        throw new AppProblem({
          status: 409,
          code: "DELIVERY_NOT_CONFIRMABLE",
          title: "Entrega não confirmável",
          detail: `O pedido está em ${orderStatus} e não aceita confirmação de entrega.`,
        });
      }

      const deliveryVersion = delivery.version + 1;
      const buyerConfirmedAt =
        role === "BUYER" ? (delivery.buyerConfirmedAt ?? now) : delivery.buyerConfirmedAt;
      const sellerConfirmedAt =
        role === "SELLER" ? (delivery.sellerConfirmedAt ?? now) : delivery.sellerConfirmedAt;

      await transaction
        .update(deliveries)
        .set({
          status: nextDeliveryStatus,
          buyerConfirmedAt,
          sellerConfirmedAt,
          version: deliveryVersion,
          updatedAt: now,
        })
        .where(eq(deliveries.deliveryId, delivery.deliveryId));

      await recordOrderEvent(transaction, {
        orderId,
        eventType: "order.delivery.confirmed",
        fromStatus: orderStatus,
        toStatus: orderStatus,
        actorUserId: actor.actorUserId ?? null,
        occurredAt: now,
        payload: {
          deliveryId: delivery.deliveryId,
          role,
          fromDeliveryStatus: currentDeliveryStatus,
          toDeliveryStatus: nextDeliveryStatus,
        },
      });

      await appendOutboxEvent(
        transaction,
        {
          eventType: "order.delivery.confirmed",
          schemaVersion: 1,
          aggregateType: "Delivery",
          aggregateId: delivery.deliveryId,
          aggregateVersion: deliveryVersion,
          occurredAt: now,
          sellerAccountId: workingOrder.sellerAccountId,
          ownerModule: "orders",
          dataClassification: "INTERNAL",
          payload: {
            orderId,
            deliveryId: delivery.deliveryId,
            role,
            deliveryStatus: nextDeliveryStatus,
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "orders.delivery.confirm",
          resourceType: "Delivery",
          resourceId: delivery.deliveryId,
          sellerAccountId: workingOrder.sellerAccountId,
          beforeRedacted: { deliveryStatus: currentDeliveryStatus },
          afterRedacted: { deliveryStatus: nextDeliveryStatus, role },
          dataClassification: "INTERNAL",
        },
        actor,
      );

      if (isDeliveryComplete(nextDeliveryStatus)) {
        await this.completeOrder(transaction, workingOrder, actor, now, nextDeliveryStatus);
      }
    });

    const delivery = await this.findDelivery(orderId);
    if (!delivery) throw deliveryNotFound();
    return delivery;
  }

  private async findDelivery(orderId: string): Promise<DeliveryRow | null> {
    const [delivery] = await this.db
      .select()
      .from(deliveries)
      .where(eq(deliveries.orderId, orderId))
      .limit(1);
    return delivery ?? null;
  }

  /** PAID -> IN_DELIVERY na primeira confirmação de qualquer um dos lados. */
  private async startDeliveryIfNeeded(
    transaction: MidasTransaction,
    order: OrderRow,
    actor: ActorContext,
    now: Date,
  ): Promise<OrderRow> {
    const currentStatus = parseOrderStatus(order.status);
    if (currentStatus !== "PAID") return order;
    assertTransition(currentStatus, "IN_DELIVERY");

    const nextVersion = order.version + 1;
    await transaction
      .update(orders)
      .set({ status: "IN_DELIVERY", version: nextVersion, updatedAt: now })
      .where(eq(orders.orderId, order.orderId));

    await recordOrderEvent(transaction, {
      orderId: order.orderId,
      eventType: "order.in_delivery",
      fromStatus: currentStatus,
      toStatus: "IN_DELIVERY",
      actorUserId: actor.actorUserId ?? null,
      occurredAt: now,
      payload: { startedAt: now.toISOString() },
    });

    await appendOutboxEvent(
      transaction,
      {
        eventType: "order.in_delivery",
        schemaVersion: 1,
        aggregateType: "Order",
        aggregateId: order.orderId,
        aggregateVersion: nextVersion,
        occurredAt: now,
        sellerAccountId: order.sellerAccountId,
        ownerModule: "orders",
        dataClassification: "INTERNAL",
        payload: {
          orderId: order.orderId,
          buyerUserId: order.buyerUserId,
          sellerAccountId: order.sellerAccountId,
          startedAt: now.toISOString(),
        },
      },
      actor,
    );

    return { ...order, status: "IN_DELIVERY", version: nextVersion, updatedAt: now };
  }

  private async completeOrder(
    transaction: MidasTransaction,
    order: OrderRow,
    actor: ActorContext,
    now: Date,
    deliveryStatus: DeliveryStatus,
  ): Promise<void> {
    const currentStatus = parseOrderStatus(order.status);
    assertTransition(currentStatus, "COMPLETED");

    const nextVersion = order.version + 1;
    await transaction
      .update(orders)
      .set({ status: "COMPLETED", completedAt: now, version: nextVersion, updatedAt: now })
      .where(eq(orders.orderId, order.orderId));

    await recordOrderEvent(transaction, {
      orderId: order.orderId,
      eventType: "order.completed",
      fromStatus: currentStatus,
      toStatus: "COMPLETED",
      actorUserId: actor.actorUserId ?? null,
      occurredAt: now,
      payload: {
        deliveryStatus,
        completedAt: now.toISOString(),
        totalMinor: order.totalMinor.toString(),
        currency: order.currency,
      },
    });

    await appendOutboxEvent(
      transaction,
      {
        eventType: "order.completed",
        schemaVersion: 1,
        aggregateType: "Order",
        aggregateId: order.orderId,
        aggregateVersion: nextVersion,
        occurredAt: now,
        sellerAccountId: order.sellerAccountId,
        ownerModule: "orders",
        dataClassification: "INTERNAL",
        payload: {
          orderId: order.orderId,
          buyerUserId: order.buyerUserId,
          sellerAccountId: order.sellerAccountId,
          totalMinor: order.totalMinor.toString(),
          feeMinor: order.feeMinor.toString(),
          currency: order.currency,
          completedAt: now.toISOString(),
        },
      },
      actor,
    );

    await appendOutboxEvent(
      transaction,
      {
        eventType: "funds.hold_started",
        schemaVersion: 1,
        aggregateType: "Order",
        aggregateId: order.orderId,
        aggregateVersion: nextVersion,
        occurredAt: now,
        sellerAccountId: order.sellerAccountId,
        ownerModule: "orders",
        dataClassification: "FINANCIAL",
        payload: {
          orderId: order.orderId,
          buyerUserId: order.buyerUserId,
          sellerAccountId: order.sellerAccountId,
          subtotalMinor: order.subtotalMinor.toString(),
          feeMinor: order.feeMinor.toString(),
          totalMinor: order.totalMinor.toString(),
          currency: order.currency,
          startedAt: now.toISOString(),
        },
      },
      actor,
    );

    await appendAuditEvent(
      transaction,
      {
        action: "orders.order.complete",
        resourceType: "Order",
        resourceId: order.orderId,
        sellerAccountId: order.sellerAccountId,
        beforeRedacted: { status: currentStatus },
        afterRedacted: {
          status: "COMPLETED",
          completedAt: now.toISOString(),
          totalMinor: order.totalMinor.toString(),
          currency: order.currency,
        },
        dataClassification: "INTERNAL",
      },
      actor,
    );
  }
}

async function lockDelivery(
  transaction: MidasTransaction,
  orderId: string,
): Promise<DeliveryRow> {
  const [delivery] = await transaction
    .select()
    .from(deliveries)
    .where(eq(deliveries.orderId, orderId))
    .for("update");
  if (!delivery) throw deliveryNotFound();
  return delivery;
}

function deliveryNotFound(): AppProblem {
  return new AppProblem({
    status: 404,
    code: "DELIVERY_NOT_FOUND",
    title: "Entrega não encontrada",
    detail: "A entrega é aberta quando o pagamento do pedido é confirmado.",
  });
}

/** Cria a entrega de um pedido já pago (uso interno de reprocessamento). */
export async function ensureDeliveryForPaidOrder(
  transaction: MidasTransaction,
  orderId: string,
  revealedAt: Date,
): Promise<void> {
  const [existing] = await transaction
    .select({ deliveryId: deliveries.deliveryId })
    .from(deliveries)
    .where(eq(deliveries.orderId, orderId))
    .limit(1);
  if (existing) return;

  await transaction.insert(deliveries).values({
    deliveryId: createUuidV7(),
    orderId,
    status: "PENDING",
    buyerConfirmedAt: null,
    sellerConfirmedAt: null,
    instructionRevealedAt: revealedAt,
    version: 1,
    createdAt: revealedAt,
    updatedAt: revealedAt,
  });
}
