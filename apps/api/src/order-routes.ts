import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { apiProblemSchema, sellerAccountIdSchema } from "@midas/contracts";
import type {
  CartCheckoutGroup,
  CartLineView,
  CartService,
  CartView,
  DeliveryRow,
  DeliveryService,
  OrderDetail,
  OrderRow,
  OrderService,
  OrderStatus,
} from "@midas/orders";
import { orderStatuses } from "@midas/orders";
import type { AuthenticatedSession } from "@midas/identity";
import { AppProblem, parsePublicId } from "@midas/kernel";
import { actorContext } from "./http/request-context.js";

export type RegisterOrderRoutesOptions = {
  carts: CartService;
  orders: OrderService;
  deliveries: DeliveryService;
  requireSession(request: FastifyRequest): Promise<AuthenticatedSession>;
  requireCsrf(request: FastifyRequest): void;
};

/* ============================================================
   Schemas de entrada
   ============================================================ */

const quantitySchema = z.number().int().min(1).max(999);

const addCartLineBodySchema = z.object({
  listingId: z.uuid(),
  quantity: quantitySchema,
});

const updateCartLineBodySchema = z.object({
  quantity: quantitySchema,
});

const mergeCartBodySchema = z.object({
  lines: z
    .array(z.object({ listingId: z.uuid(), quantity: quantitySchema }))
    .min(1)
    .max(100),
});

/**
 * A API devolve `sellerAccountId` em DOIS formatos hoje: `GET /v1/listings`
 * emite o id público com prefixo (`sac_...`), como manda `docs/17`, mas
 * `GET /v1/me/cart/checkout-groups` emite o UUID cru. Um cliente que leia o
 * vendedor do carrinho e o mande de volta não conseguiria fechar o pedido.
 *
 * Esta funcao aceita os dois enquanto a divergencia de contrato nao for
 * decidida — e a decisao esta registrada no handoff, nao escondida aqui.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function resolveSellerAccountId(raw: string): string {
  return UUID_PATTERN.test(raw) ? raw : parsePublicId("sellerAccount", raw);
}

const placeOrderFromCartBodySchema = z.object({
  // O comprador escolhe QUAL vendedor esta fechando: o carrinho e
  // multivendedor e cada grupo vira um pedido proprio.
  sellerAccountId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(8).max(200),
});

const placeOrderBodySchema = z.object({
  listingId: z.uuid(),
  quantity: quantitySchema,
  // Idempotência é responsabilidade do cliente: o mesmo clique repetido
  // precisa reusar a chave, senão a reserva de estoque duplica.
  idempotencyKey: z.string().trim().min(8).max(200),
});

const cancelOrderBodySchema = z
  .object({ reason: z.string().trim().min(1).max(500).optional() })
  .optional();

const confirmDeliveryBodySchema = z.object({
  role: z.enum(["BUYER", "SELLER"]),
});

const orderStatusSchema = z.enum(orderStatuses as unknown as [OrderStatus, ...OrderStatus[]]);

/* ============================================================
   Serializadores

   Dinheiro sai como string de minor units — nunca number, porque
   JSON.parse de bigint grande perde precisão no cliente.
   Data sai como ISO-8601.
   ============================================================ */

function serializeCartLine(line: CartLineView) {
  return {
    cartLineId: line.cartLineId,
    listingId: line.listingId,
    sellerAccountId: line.sellerAccountId,
    quantity: line.quantity,
    unitPriceMinor: line.unitPriceMinor.toString(),
    lineTotalMinor: line.lineTotalMinor.toString(),
    currentPriceMinor: line.currentPriceMinor.toString(),
    // A interface é obrigada a avisar quando o preço mudou desde que o item
    // entrou no carrinho. Silenciar mudança de preço é o que gera disputa.
    priceChanged: line.priceChanged,
    quantityAvailable: line.quantityAvailable,
    purchasable: line.purchasable,
    currency: line.currency,
    addedAt: line.addedAt.toISOString(),
    priceAsOf: line.priceAsOf.toISOString(),
    listing: line.listing,
    catalogItem: line.catalogItem,
  };
}

function serializeCheckoutGroup(group: CartCheckoutGroup) {
  return {
    sellerAccountId: group.sellerAccountId,
    sellerDisplayName: group.sellerDisplayName,
    currency: group.currency,
    itemCount: group.itemCount,
    subtotalMinor: group.subtotalMinor.toString(),
    lines: group.lines.map(serializeCartLine),
  };
}

function serializeCart(view: CartView) {
  return {
    cartId: view.cart.cartId,
    status: view.cart.status,
    currency: view.currency,
    itemCount: view.itemCount,
    subtotalMinor: view.subtotalMinor.toString(),
    // Um grupo por vendedor: cada grupo é um pedido separado no checkout.
    groups: view.groups.map(serializeCheckoutGroup),
    lines: view.lines.map(serializeCartLine),
    asOf: view.asOf.toISOString(),
  };
}

function serializeOrder(order: OrderRow) {
  return {
    orderId: order.orderId,
    publicCode: order.publicCode,
    sellerAccountId: order.sellerAccountId,
    status: order.status,
    // Subtotal, taxa e total sempre separados. Total sem decomposição
    // esconde a taxa da plataforma e quebra a promessa de transparência.
    subtotalMinor: order.subtotalMinor.toString(),
    feeMinor: order.feeMinor.toString(),
    totalMinor: order.totalMinor.toString(),
    currency: order.currency,
    reservedUntil: order.reservedUntil ? order.reservedUntil.toISOString() : null,
    placedAt: order.placedAt.toISOString(),
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    completedAt: order.completedAt ? order.completedAt.toISOString() : null,
    cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

function serializeDelivery(delivery: DeliveryRow) {
  return {
    deliveryId: delivery.deliveryId,
    orderId: delivery.orderId,
    status: delivery.status,
    // Os dois lados aparecem separados de propósito: a confirmação de um
    // não depende nem sugere a do outro.
    buyerConfirmedAt: delivery.buyerConfirmedAt
      ? delivery.buyerConfirmedAt.toISOString()
      : null,
    sellerConfirmedAt: delivery.sellerConfirmedAt
      ? delivery.sellerConfirmedAt.toISOString()
      : null,
    instructionRevealedAt: delivery.instructionRevealedAt
      ? delivery.instructionRevealedAt.toISOString()
      : null,
    createdAt: delivery.createdAt.toISOString(),
    updatedAt: delivery.updatedAt.toISOString(),
  };
}

function serializeOrderDetail(detail: OrderDetail) {
  return {
    order: serializeOrder(detail.order),
    items: detail.items.map((item) => ({
      orderItemId: item.orderItemId,
      listingId: item.listingId,
      catalogItemId: item.catalogItemId,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor.toString(),
      totalMinor: item.totalMinor.toString(),
      currency: item.currency,
      listingSnapshot: item.listingSnapshot,
    })),
    // A timeline traz somente fatos gravados pelo servidor. Evento futuro
    // não entra aqui — a interface o mostra como pendente, não como ocorrido.
    timeline: detail.timeline.map((event) => ({
      orderEventId: event.orderEventId,
      eventType: event.eventType,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      payload: event.payload,
      occurredAt: event.occurredAt.toISOString(),
    })),
    delivery: detail.delivery ? serializeDelivery(detail.delivery) : null,
    asOf: detail.asOf.toISOString(),
  };
}

/* ============================================================
   Rotas

   Autorização (anti-BOLA): recurso de outro usuário responde 404, nunca
   403. Um 403 confirmaria a existência do pedido alheio, o que já é
   vazamento. O domínio (@midas/orders) lança o problema; aqui apenas
   não se acrescenta informação.
   ============================================================ */

export function registerOrderRoutes(
  app: FastifyInstance,
  options: RegisterOrderRoutesOptions,
): void {
  // ===== CARRINHO =====

  app.get(
    "/v1/me/cart",
    {
      schema: {
        operationId: "getMyCart",
        response: { 200: z.any(), 401: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const view = await options.carts.getOrCreateCart(actorContext(request, session));
      return serializeCart(view);
    },
  );

  app.get(
    "/v1/me/cart/checkout-groups",
    {
      schema: {
        operationId: "listMyCheckoutGroups",
        response: {
          200: z.object({ data: z.array(z.any()), asOf: z.iso.datetime() }),
          401: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const result = await options.carts.listCheckoutGroups(actorContext(request, session));
      return {
        data: result.data.map(serializeCheckoutGroup),
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.post(
    "/v1/me/cart/lines",
    {
      schema: {
        operationId: "addCartLine",
        body: addCartLineBodySchema,
        response: {
          201: z.any(),
          401: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const body = request.body as z.infer<typeof addCartLineBodySchema>;
      const view = await options.carts.addLine(
        { listingId: body.listingId, quantity: body.quantity },
        actorContext(request, session),
      );
      return reply.status(201).send(serializeCart(view));
    },
  );

  app.patch(
    "/v1/me/cart/lines/:cartLineId",
    {
      schema: {
        operationId: "updateCartLineQuantity",
        params: z.object({ cartLineId: z.uuid() }),
        body: updateCartLineBodySchema,
        response: {
          200: z.any(),
          401: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = request.params as { cartLineId: string };
      const body = request.body as z.infer<typeof updateCartLineBodySchema>;
      const view = await options.carts.updateLineQuantity(
        { cartLineId: params.cartLineId, quantity: body.quantity },
        actorContext(request, session),
      );
      return serializeCart(view);
    },
  );

  app.delete(
    "/v1/me/cart/lines/:cartLineId",
    {
      schema: {
        operationId: "removeCartLine",
        params: z.object({ cartLineId: z.uuid() }),
        response: { 200: z.any(), 401: apiProblemSchema, 404: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = request.params as { cartLineId: string };
      const view = await options.carts.removeLine(
        params.cartLineId,
        actorContext(request, session),
      );
      return serializeCart(view);
    },
  );

  // Merge do carrinho de visitante ao logar. O visitante mantém o carrinho
  // local; sem este merge, logar apagaria a intenção de compra dele.
  app.post(
    "/v1/me/cart/merge",
    {
      schema: {
        operationId: "mergeGuestCart",
        body: mergeCartBodySchema,
        response: { 200: z.any(), 401: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const body = request.body as z.infer<typeof mergeCartBodySchema>;
      const result = await options.carts.mergeGuestLines(
        { lines: body.lines },
        actorContext(request, session),
      );
      return {
        ...serializeCart(result),
        // Linha descartada devolve o motivo: item despublicado, sem estoque,
        // moeda divergente. A interface precisa explicar, não sumir com o item.
        skipped: result.skipped,
      };
    },
  );

  // ===== PEDIDOS =====

  app.post(
    "/v1/orders",
    {
      schema: {
        operationId: "placeOrder",
        body: placeOrderBodySchema,
        response: {
          201: z.any(),
          401: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
          500: apiProblemSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const body = request.body as z.infer<typeof placeOrderBodySchema>;
      const order = await options.orders.placeOrder(
        {
          listingId: body.listingId,
          quantity: body.quantity,
          idempotencyKey: body.idempotencyKey,
        },
        actorContext(request, session),
      );
      return reply.status(201).send(serializeOrder(order));
    },
  );

  app.post(
    "/v1/me/cart/checkout-groups/:sellerAccountId/orders",
    {
      schema: {
        operationId: "placeOrderFromCartGroup",
        params: z.object({ sellerAccountId: z.string().trim().min(1) }),
        body: placeOrderFromCartBodySchema,
        response: {
          201: z.any(),
          401: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
          500: apiProblemSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = request.params as { sellerAccountId: string };
      const body = request.body as z.infer<typeof placeOrderFromCartBodySchema>;
      // O vendedor do caminho manda. O do corpo existe so para o cliente
      // declarar a mesma intencao duas vezes; divergencia e erro do cliente,
      // nao algo a resolver em silencio escolhendo um dos dois.
      if (params.sellerAccountId !== body.sellerAccountId) {
        throw new AppProblem({
          status: 422,
          code: "CART_GROUP_SELLER_MISMATCH",
          title: "Dados inconsistentes",
          detail: "O vendedor do caminho e o do corpo precisam ser o mesmo.",
        });
      }
      const order = await options.orders.placeOrderFromCartGroup(
        {
          sellerAccountId: resolveSellerAccountId(params.sellerAccountId),
          idempotencyKey: body.idempotencyKey,
        },
        actorContext(request, session),
      );
      return reply.status(201).send(serializeOrder(order));
    },
  );

  app.get(
    "/v1/me/purchases",
    {
      schema: {
        operationId: "listMyPurchases",
        querystring: z.object({
          status: orderStatusSchema.optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          cursor: z.uuid().optional(),
        }),
        response: {
          200: z.object({
            data: z.array(z.any()),
            nextCursor: z.string().nullable(),
            asOf: z.iso.datetime(),
          }),
          401: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const query = request.query as {
        status?: OrderStatus | undefined;
        limit: number;
        cursor?: string | undefined;
      };
      const result = await options.orders.listPurchases(actorContext(request, session), {
        status: query.status,
        limit: query.limit,
        cursor: query.cursor,
      });
      return {
        data: result.data.map(serializeOrder),
        nextCursor: result.nextCursor,
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.get(
    "/v1/orders/:orderId",
    {
      schema: {
        operationId: "getOrderDetail",
        params: z.object({ orderId: z.uuid() }),
        response: { 200: z.any(), 401: apiProblemSchema, 404: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const params = request.params as { orderId: string };
      const detail = await options.orders.getOrderDetail(
        params.orderId,
        actorContext(request, session),
      );
      return serializeOrderDetail(detail);
    },
  );

  app.post(
    "/v1/orders/:orderId/cancel",
    {
      schema: {
        operationId: "cancelOrder",
        params: z.object({ orderId: z.uuid() }),
        body: cancelOrderBodySchema,
        response: {
          200: z.any(),
          401: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = request.params as { orderId: string };
      const body = (request.body ?? {}) as z.infer<typeof cancelOrderBodySchema>;
      const order = await options.orders.cancelOrder(
        params.orderId,
        actorContext(request, session),
        { reason: body?.reason },
      );
      return serializeOrder(order);
    },
  );

  app.get(
    "/v1/seller-accounts/:sellerAccountId/orders",
    {
      schema: {
        operationId: "listSellerOrders",
        params: z.object({ sellerAccountId: sellerAccountIdSchema }),
        querystring: z.object({
          status: orderStatusSchema.optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          cursor: z.uuid().optional(),
        }),
        response: {
          200: z.object({
            data: z.array(z.any()),
            nextCursor: z.string().nullable(),
            asOf: z.iso.datetime(),
          }),
          401: apiProblemSchema,
          404: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const params = request.params as { sellerAccountId: string };
      const query = request.query as {
        status?: OrderStatus | undefined;
        limit: number;
        cursor?: string | undefined;
      };
      const result = await options.orders.listSellerOrders(
        parsePublicId("sellerAccount", params.sellerAccountId),
        actorContext(request, session),
        { status: query.status, limit: query.limit, cursor: query.cursor },
      );
      return {
        data: result.data.map(serializeOrder),
        nextCursor: result.nextCursor,
        asOf: result.asOf.toISOString(),
      };
    },
  );

  // ===== ENTREGA =====

  app.get(
    "/v1/orders/:orderId/delivery",
    {
      schema: {
        operationId: "getOrderDelivery",
        params: z.object({ orderId: z.uuid() }),
        response: { 200: z.any(), 401: apiProblemSchema, 404: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const params = request.params as { orderId: string };
      const delivery = await options.deliveries.getDelivery(
        params.orderId,
        actorContext(request, session),
      );
      if (!delivery) {
        throw new AppProblem({
          status: 404,
          code: "ORDER_DELIVERY_NOT_FOUND",
          title: "Entrega não encontrada",
          detail: "Este pedido ainda não tem etapa de entrega ativa.",
        });
      }
      return serializeDelivery(delivery);
    },
  );

  // Confirmação independente por papel. Idempotente: reconfirmar não muda
  // estado nem duplica evento. Quando ambos confirmam, o domínio transiciona
  // o pedido para COMPLETED e emite funds.hold_started.
  app.post(
    "/v1/orders/:orderId/delivery/confirmations",
    {
      schema: {
        operationId: "confirmOrderDelivery",
        params: z.object({ orderId: z.uuid() }),
        body: confirmDeliveryBodySchema,
        response: {
          200: z.any(),
          401: apiProblemSchema,
          404: apiProblemSchema,
          409: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = request.params as { orderId: string };
      const body = request.body as z.infer<typeof confirmDeliveryBodySchema>;
      const delivery = await options.deliveries.confirmDelivery(
        params.orderId,
        body.role,
        actorContext(request, session),
      );
      return serializeDelivery(delivery);
    },
  );
}
