import { AppProblem } from "@midas/kernel";

/**
 * Máquina de estados de pedidos e entregas.
 * Módulo puro: nenhuma dependência de banco, rede ou relógio externo.
 */

export const orderStatuses = [
  "PENDING_PAYMENT",
  "PAID",
  "IN_DELIVERY",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
  "REFUNDED",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export const deliveryStatuses = [
  "PENDING",
  "BUYER_CONFIRMED",
  "SELLER_CONFIRMED",
  "BOTH_CONFIRMED",
] as const;

export type DeliveryStatus = (typeof deliveryStatuses)[number];

export type DeliveryRole = "BUYER" | "SELLER";

const allowedOrderTransitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["IN_DELIVERY", "DISPUTED"],
  IN_DELIVERY: ["COMPLETED", "DISPUTED"],
  DISPUTED: ["COMPLETED", "REFUNDED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
};

const terminalOrderStatuses: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
]);

export function isOrderStatus(value: string): value is OrderStatus {
  return (orderStatuses as readonly string[]).includes(value);
}

export function isDeliveryStatus(value: string): value is DeliveryStatus {
  return (deliveryStatuses as readonly string[]).includes(value);
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return terminalOrderStatuses.has(status);
}

export function allowedTransitionsFrom(status: OrderStatus): readonly OrderStatus[] {
  return allowedOrderTransitions[status];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowedOrderTransitions[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (canTransition(from, to)) return;
  throw new AppProblem({
    status: 409,
    code: "ORDER_TRANSITION_NOT_ALLOWED",
    title: "Transição de pedido inválida",
    detail: `O pedido está em ${from} e não pode ir para ${to}.`,
  });
}

/** Converte o texto persistido em status tipado, falhando alto se o banco tiver valor inesperado. */
export function parseOrderStatus(value: string): OrderStatus {
  if (isOrderStatus(value)) return value;
  throw new AppProblem({
    status: 500,
    code: "ORDER_STATUS_UNKNOWN",
    title: "Estado de pedido desconhecido",
    detail: "O pedido possui um estado que não pertence à máquina de estados.",
  });
}

export function parseDeliveryStatus(value: string): DeliveryStatus {
  if (isDeliveryStatus(value)) return value;
  throw new AppProblem({
    status: 500,
    code: "DELIVERY_STATUS_UNKNOWN",
    title: "Estado de entrega desconhecido",
    detail: "A entrega possui um estado que não pertence à máquina de estados.",
  });
}

export function hasRoleConfirmed(status: DeliveryStatus, role: DeliveryRole): boolean {
  if (status === "BOTH_CONFIRMED") return true;
  if (role === "BUYER") return status === "BUYER_CONFIRMED";
  return status === "SELLER_CONFIRMED";
}

/**
 * Aplica a confirmação de um papel. Idempotente: repetir o mesmo papel devolve o estado atual.
 */
export function applyDeliveryConfirmation(
  status: DeliveryStatus,
  role: DeliveryRole,
): DeliveryStatus {
  if (hasRoleConfirmed(status, role)) return status;
  if (status === "PENDING") return role === "BUYER" ? "BUYER_CONFIRMED" : "SELLER_CONFIRMED";
  return "BOTH_CONFIRMED";
}

export function isDeliveryComplete(status: DeliveryStatus): boolean {
  return status === "BOTH_CONFIRMED";
}
