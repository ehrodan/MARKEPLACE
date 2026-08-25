/**
 * Estado do pedido traduzido em: rótulo, explicação e PRÓXIMA AÇÃO.
 *
 * Existe porque o princípio 2 da marca é "você sabe onde está". Um status cru
 * (`IN_DELIVERY`) não diz de quem é a vez. Esta tabela diz.
 *
 * Puro e sem I/O de propósito: é a única fonte da tradução, e as duas telas
 * (lista e detalhe) leem daqui em vez de repetir o `switch`.
 */

export type OrderStatusTone = "info" | "warning" | "success" | "danger" | "neutral";

export interface OrderStatusView {
  readonly label: string;
  readonly tone: OrderStatusTone;
  /** Uma frase, no indicativo, sobre o que é verdade agora. */
  readonly explanation: string;
  /** Quem tem a bola. `null` quando nada é esperado de ninguém. */
  readonly waitingOn: "BUYER" | "SELLER" | "PLATFORM" | null;
  /** Rótulo da próxima ação do comprador. `null` quando não há ação dele. */
  readonly nextAction: string | null;
}

const UNKNOWN: OrderStatusView = {
  label: "Estado não reconhecido",
  tone: "warning",
  explanation:
    "O servidor devolveu um estado que esta versão da interface não conhece. Nada é presumido.",
  waitingOn: null,
  nextAction: null,
};

const ORDER_STATUS: Record<string, OrderStatusView> = {
  PENDING_PAYMENT: {
    label: "Aguardando pagamento",
    tone: "warning",
    explanation: "A unidade está reservada para você até o prazo indicado.",
    waitingOn: "BUYER",
    nextAction: "Concluir pagamento",
  },
  PAID: {
    label: "Pago",
    tone: "info",
    explanation: "O pagamento foi confirmado e a etapa de entrega vai abrir.",
    waitingOn: "SELLER",
    nextAction: null,
  },
  IN_DELIVERY: {
    label: "Em entrega",
    tone: "info",
    explanation: "A entrega está em curso e depende de confirmação dos dois lados.",
    waitingOn: "BUYER",
    nextAction: "Conferir e confirmar recebimento",
  },
  COMPLETED: {
    label: "Concluído",
    tone: "success",
    explanation: "Os dois lados confirmaram e o pedido foi encerrado.",
    waitingOn: null,
    nextAction: "Avaliar a compra",
  },
  CANCELLED: {
    label: "Cancelado",
    tone: "neutral",
    explanation: "O pedido foi cancelado e a unidade voltou ao estoque.",
    waitingOn: null,
    nextAction: null,
  },
  DISPUTED: {
    label: "Em disputa",
    tone: "danger",
    explanation: "Existe uma disputa aberta neste pedido, com prazos próprios.",
    waitingOn: "PLATFORM",
    nextAction: "Acompanhar a disputa",
  },
  REFUNDED: {
    label: "Reembolsado",
    tone: "neutral",
    explanation: "A decisão de reembolso foi executada para este pedido.",
    waitingOn: null,
    nextAction: null,
  },
};

export function orderStatusView(status: string): OrderStatusView {
  return ORDER_STATUS[status] ?? UNKNOWN;
}

export interface DeliveryStatusView {
  readonly label: string;
  readonly buyerConfirmed: boolean;
  readonly sellerConfirmed: boolean;
  readonly explanation: string;
}

const DELIVERY_STATUS: Record<string, DeliveryStatusView> = {
  PENDING: {
    label: "Aguardando as duas confirmações",
    buyerConfirmed: false,
    sellerConfirmed: false,
    explanation: "Nenhum lado confirmou ainda. Cada um confirma o seu, de forma independente.",
  },
  BUYER_CONFIRMED: {
    label: "Você confirmou",
    buyerConfirmed: true,
    sellerConfirmed: false,
    explanation: "Sua confirmação está registrada. Falta a do vendedor.",
  },
  SELLER_CONFIRMED: {
    label: "Vendedor confirmou",
    buyerConfirmed: false,
    sellerConfirmed: true,
    explanation: "O vendedor confirmou. Sua confirmação ainda é necessária.",
  },
  BOTH_CONFIRMED: {
    label: "Confirmado pelos dois lados",
    buyerConfirmed: true,
    sellerConfirmed: true,
    explanation: "As duas confirmações foram registradas e o pedido foi concluído.",
  },
};

const DELIVERY_UNKNOWN: DeliveryStatusView = {
  label: "Estado de entrega não reconhecido",
  buyerConfirmed: false,
  sellerConfirmed: false,
  explanation: "Esta versão da interface não conhece este estado. Nada é presumido.",
};

export function deliveryStatusView(status: string): DeliveryStatusView {
  return DELIVERY_STATUS[status] ?? DELIVERY_UNKNOWN;
}
