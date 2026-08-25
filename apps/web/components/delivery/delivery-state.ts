/**
 * SCR-BUY-006 — entrega segura com custódia: máquina de estados da tela.
 *
 * Módulo puro: sem React, sem fetch, sem decisão dependente do relógio local.
 * A autoridade é sempre o servidor. Aqui só traduzimos o que o contrato REAL
 * devolve para uma leitura em pt-BR que responde três perguntas sem rodeio:
 * o que está acontecendo, QUEM pode agir e QUAL é a próxima ação.
 *
 * Contrato de origem (lido, não presumido):
 * - `GET  /v1/orders/{orderId}`                        → apps/api/src/order-routes.ts, serializeOrderDetail
 * - `GET  /v1/orders/{orderId}/delivery`               → serializeDelivery (ou `null` antes do pagamento)
 * - `POST /v1/orders/{orderId}/delivery/confirmations` → corpo `{ role: "BUYER" | "SELLER" }`
 * - `GET  /v1/me/seller-accounts`                      → apps/api/src/app.ts
 *
 * Regras de domínio espelhadas de modules/orders/src (order-state.ts,
 * delivery-service.ts, authorization.ts):
 * - a entrega só existe depois do pagamento confirmado (`ensureDeliveryForPaidOrder`);
 * - cada papel confirma o seu, de forma independente e idempotente
 *   (`applyDeliveryConfirmation`);
 * - a confirmação só é aceita com o pedido em PAID ou IN_DELIVERY; qualquer
 *   outro estado devolve 409 DELIVERY_NOT_CONFIRMABLE;
 * - dupla confirmação sem disputa produz `order.completed` e `funds.hold_started`;
 * - quem não é comprador nem membro ativo da conta vendedora recebe 404, nunca 403.
 */

export type DeliveryParty = "BUYER" | "SELLER";

export type DeliveryState =
  | "PENDING"
  | "BUYER_CONFIRMED"
  | "SELLER_CONFIRMED"
  | "BOTH_CONFIRMED"
  | "DISPUTED";

export type DeliveryTone = "neutral" | "info" | "success" | "danger";

/* ------------------------------------------------------------------ */
/* Corpos reais devolvidos pela API                                    */
/* ------------------------------------------------------------------ */

export interface OrderPayload {
  orderId: string;
  publicCode: string;
  buyerUserId: string;
  sellerAccountId: string;
  status: string;
  subtotalMinor: string;
  feeMinor: string;
  totalMinor: string;
  currency: string;
  reservedUntil: string | null;
  placedAt: string;
  paidAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryPayload {
  deliveryId: string;
  orderId: string;
  status: string;
  buyerConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  instructionRevealedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderEventPayload {
  orderEventId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  occurredAt: string;
}

export interface OrderDetailEnvelope {
  data: {
    order: OrderPayload;
    timeline: OrderEventPayload[];
    delivery: DeliveryPayload | null;
  };
  asOf: string;
}

export interface DeliveryEnvelope {
  data: DeliveryPayload | null;
  asOf: string;
}

export interface SellerAccountSummary {
  sellerAccountId: string;
}

export interface SellerAccountListEnvelope {
  data: SellerAccountSummary[];
  asOf: string;
}

/* ------------------------------------------------------------------ */
/* Descritores de estado                                               */
/* ------------------------------------------------------------------ */

export interface DeliveryStateDescriptor {
  state: DeliveryState;
  tone: DeliveryTone;
  /** Rótulo curto do estado. */
  label: string;
  /** O que este estado significa, sem eufemismo. */
  explanation: string;
  /** Quem pode agir, em texto. */
  whoCanAct: string;
  /** Quem pode agir, em dados. */
  actors: readonly DeliveryParty[];
  /** Qual é a próxima ação concreta. */
  nextAction: string;
}

export interface ViewerTurn {
  isYourTurn: boolean;
  headline: string;
  detail: string;
}

export interface ActionAvailability {
  allowed: boolean;
  /** Motivo textual quando `allowed` é falso. Vazio quando é permitido. */
  reason: string;
}

const DELIVERY_STATES: readonly string[] = [
  "PENDING",
  "BUYER_CONFIRMED",
  "SELLER_CONFIRMED",
  "BOTH_CONFIRMED",
];

const descriptors: Record<DeliveryState, DeliveryStateDescriptor> = {
  PENDING: {
    state: "PENDING",
    tone: "neutral",
    label: "Aguardando as duas confirmações",
    explanation:
      "A entrega está aberta e nenhum dos dois lados confirmou ainda. Cada parte registra a própria confirmação; uma não vale pela outra.",
    whoCanAct: "Comprador e vendedor, cada um no seu próprio registro",
    actors: ["BUYER", "SELLER"],
    nextAction:
      "Conferir a entrega e registrar a sua confirmação, ou reportar problema se algo estiver errado.",
  },
  BUYER_CONFIRMED: {
    state: "BUYER_CONFIRMED",
    tone: "info",
    label: "Comprador confirmou",
    explanation:
      "A confirmação do comprador está registrada. A do vendedor continua pendente e é independente: não foi dada nem dispensada pela do comprador.",
    whoCanAct: "Vendedor",
    actors: ["SELLER"],
    nextAction:
      "O vendedor registra a própria confirmação, ou reporta problema se discordar do que foi entregue.",
  },
  SELLER_CONFIRMED: {
    state: "SELLER_CONFIRMED",
    tone: "info",
    label: "Vendedor confirmou",
    explanation:
      "A confirmação do vendedor está registrada. A do comprador continua pendente e é independente: não foi dada nem dispensada pela do vendedor.",
    whoCanAct: "Comprador",
    actors: ["BUYER"],
    nextAction:
      "O comprador confere o que recebeu e registra a própria confirmação, ou reporta problema se discordar.",
  },
  BOTH_CONFIRMED: {
    state: "BOTH_CONFIRMED",
    tone: "success",
    label: "Confirmação dupla concluída",
    explanation:
      "Os dois lados confirmaram de forma independente e não há disputa aberta. Com isso o servidor conclui o pedido e inicia a retenção dos valores do vendedor.",
    whoCanAct: "Nenhuma das partes precisa agir",
    actors: [],
    nextAction:
      "Acompanhar o pedido. A saída de conflito continua disponível enquanto o pedido admitir contestação.",
  },
  DISPUTED: {
    state: "DISPUTED",
    tone: "danger",
    label: "Disputa aberta",
    explanation:
      "O pedido está em disputa. As confirmações ficam suspensas e nenhuma liberação de valor acontece automaticamente enquanto não houver decisão.",
    whoCanAct: "As partes do pedido e a equipe de disputas",
    actors: ["BUYER", "SELLER"],
    nextAction: "Acompanhar a disputa e responder ao que for solicitado na análise.",
  },
};

/* ------------------------------------------------------------------ */
/* Derivações                                                          */
/* ------------------------------------------------------------------ */

export function partyLabel(party: DeliveryParty): string {
  return party === "BUYER" ? "Comprador" : "Vendedor";
}

export function otherParty(party: DeliveryParty): DeliveryParty {
  return party === "BUYER" ? "SELLER" : "BUYER";
}

export function describeDeliveryState(state: DeliveryState): DeliveryStateDescriptor {
  return descriptors[state];
}

/**
 * Papel de quem está olhando.
 *
 * A API não devolve "você é comprador ou vendedor" neste corte. A derivação é
 * segura porque `assertOrderParticipant` responde 404 para quem não participa:
 * se a leitura do pedido chegou até aqui, o visitante é uma das duas partes.
 * Cruzamos a conta vendedora do pedido com `GET /v1/me/seller-accounts`; sem
 * essa lista devolvemos `null` e a tela assume que não sabe, em vez de chutar.
 */
export function resolveViewerParty(
  order: Pick<OrderPayload, "sellerAccountId">,
  sellerAccounts: readonly SellerAccountSummary[] | null,
): DeliveryParty | null {
  if (sellerAccounts === null) return null;
  const manages = sellerAccounts.some(
    (account) => account.sellerAccountId === order.sellerAccountId,
  );
  return manages ? "SELLER" : "BUYER";
}

export function isDisputedOrder(order: Pick<OrderPayload, "status">): boolean {
  return order.status === "DISPUTED";
}

/** Confirmação registrada de um dos lados, lida do corpo real da entrega. */
export function confirmedAtOf(
  delivery: DeliveryPayload | null,
  party: DeliveryParty,
): string | null {
  if (!delivery) return null;
  return party === "BUYER" ? delivery.buyerConfirmedAt : delivery.sellerConfirmedAt;
}

/**
 * `status` textual da entrega manda; quando o valor não pertence à máquina de
 * estados do domínio, caímos nos carimbos de confirmação em vez de assumir
 * "pendente" — presumir estado é o mesmo que inventar dado.
 */
export function hasPartyConfirmed(
  delivery: DeliveryPayload | null,
  party: DeliveryParty,
): boolean {
  if (!delivery) return false;
  if (DELIVERY_STATES.includes(delivery.status)) {
    if (delivery.status === "BOTH_CONFIRMED") return true;
    if (party === "BUYER") return delivery.status === "BUYER_CONFIRMED";
    return delivery.status === "SELLER_CONFIRMED";
  }
  return confirmedAtOf(delivery, party) !== null;
}

/** Disputa vence qualquer confirmação: o pedido em DISPUTED suspende os dois lados. */
export function resolveDeliveryState(
  order: Pick<OrderPayload, "status">,
  delivery: DeliveryPayload | null,
): DeliveryState {
  if (isDisputedOrder(order)) return "DISPUTED";
  const buyer = hasPartyConfirmed(delivery, "BUYER");
  const seller = hasPartyConfirmed(delivery, "SELLER");
  if (buyer && seller) return "BOTH_CONFIRMED";
  if (buyer) return "BUYER_CONFIRMED";
  if (seller) return "SELLER_CONFIRMED";
  return "PENDING";
}

/** Responde, para quem está olhando a tela, "é a minha vez?". */
export function describeViewerTurn(
  state: DeliveryState,
  viewer: DeliveryParty | null,
): ViewerTurn {
  if (viewer === null) {
    return {
      isYourTurn: false,
      headline: "Não foi possível confirmar o seu papel neste pedido",
      detail:
        "A leitura de GET /v1/me/seller-accounts falhou, então a tela não afirma se você é comprador ou vendedor. Os dois estados de confirmação continuam visíveis; nenhuma ação é oferecida em nome de um papel não verificado.",
    };
  }

  const other = partyLabel(otherParty(viewer)).toLocaleLowerCase("pt-BR");

  if (state === "DISPUTED") {
    return {
      isYourTurn: false,
      headline: "A disputa está em análise",
      detail: "Nenhuma confirmação é exigida de você enquanto a disputa não for decidida.",
    };
  }

  if (state === "BOTH_CONFIRMED") {
    return {
      isYourTurn: false,
      headline: "Não há nada pendente para você",
      detail: "As duas confirmações independentes já foram registradas neste pedido.",
    };
  }

  const viewerConfirmed =
    viewer === "BUYER" ? state === "BUYER_CONFIRMED" : state === "SELLER_CONFIRMED";
  if (viewerConfirmed) {
    return {
      isYourTurn: false,
      headline: "Sua confirmação já está registrada",
      detail: `Falta a confirmação do ${other}. Ela é independente e não depende da sua.`,
    };
  }

  const otherConfirmed =
    viewer === "BUYER" ? state === "SELLER_CONFIRMED" : state === "BUYER_CONFIRMED";
  return {
    isYourTurn: true,
    headline: "É a sua vez de confirmar",
    detail: otherConfirmed
      ? `O ${other} já confirmou o lado dele. A confirmação dele não substitui a sua.`
      : "Nenhum dos dois lados confirmou ainda. Confira a entrega e registre o seu lado.",
  };
}

/* ------------------------------------------------------------------ */
/* Custódia e pacote de uso único                                      */
/* ------------------------------------------------------------------ */

/**
 * `NOT_OPENED` = ainda não existe entrega (pagamento não confirmado).
 * `SEALED`     = entrega aberta, mas o servidor não carimbou a liberação.
 * `RELEASED`   = a instrução autorizada JÁ foi liberada, uma única vez.
 */
export type PackageDisclosure = "NOT_OPENED" | "SEALED" | "RELEASED";

export function packageDisclosure(delivery: DeliveryPayload | null): PackageDisclosure {
  if (!delivery) return "NOT_OPENED";
  return delivery.instructionRevealedAt === null ? "SEALED" : "RELEASED";
}

/**
 * Capacidades que esta tela precisaria e que o contrato publicado NÃO expõe.
 * Ficam nomeadas para a interface dizer a verdade em vez de simular botão.
 */
export const UNPUBLISHED_CAPABILITIES = {
  packageContent:
    "GET /v1/orders/{orderId}/delivery devolve apenas o carimbo instructionRevealedAt — o conteúdo do pacote não trafega por esta leitura, e não existe POST de revelação no contrato publicado.",
  sendInstruction:
    "Não existe rota publicada para enviar instrução dentro da entrega. Enquanto ela não existir, o combinado permanece no canal de mensagens do pedido.",
  reportProblem:
    "Não existe rota publicada para registrar problema na entrega. O caminho verificável hoje é a central de ajuda, com o código público do pedido em mãos.",
  openDispute:
    "Não existe rota publicada para abrir disputa a partir desta tela. A abertura é feita pela central de ajuda; quando o pedido entra em DISPUTED, esta tela passa a mostrar o estado de disputa.",
} as const;

/* ------------------------------------------------------------------ */
/* Disponibilidade de ações                                            */
/* ------------------------------------------------------------------ */

/** Estados do pedido em que o domínio aceita confirmação (delivery-service.ts). */
const CONFIRMABLE_ORDER_STATUSES: readonly string[] = ["PAID", "IN_DELIVERY"];

export function confirmAvailability(input: {
  order: Pick<OrderPayload, "status">;
  delivery: DeliveryPayload | null;
  viewer: DeliveryParty | null;
}): ActionAvailability {
  const { order, delivery, viewer } = input;

  if (viewer === null) {
    return {
      allowed: false,
      reason:
        "Seu papel neste pedido não pôde ser verificado, então nenhuma confirmação é oferecida em seu nome.",
    };
  }
  if (isDisputedOrder(order)) {
    return {
      allowed: false,
      reason: "A confirmação fica suspensa enquanto a disputa está em análise.",
    };
  }
  if (!delivery) {
    return {
      allowed: false,
      reason:
        "A entrega deste pedido ainda não foi aberta. Ela é criada quando o pagamento é confirmado.",
    };
  }
  if (hasPartyConfirmed(delivery, viewer)) {
    return { allowed: false, reason: "Sua confirmação já foi registrada e não é repetida." };
  }
  if (!CONFIRMABLE_ORDER_STATUSES.includes(order.status)) {
    return {
      allowed: false,
      reason: `O pedido está em ${order.status} e o domínio não aceita confirmação de entrega neste estado.`,
    };
  }
  return { allowed: true, reason: "" };
}

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

/**
 * Prazo e marco em data e hora absolutas, com fuso explícito.
 * Nunca contagem regressiva: prazo é informação verificável, não urgência.
 */
export function formatAbsoluteInstant(
  value: string | null | undefined,
  locale = "pt-BR",
): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(parsed);
}

const ORDER_EVENT_LABELS: Readonly<Record<string, string>> = {
  "order.placed": "Pedido registrado",
  "order.paid": "Pagamento confirmado",
  "order.in_delivery": "Entrega aberta em custódia",
  "order.delivery.confirmed": "Confirmação de entrega registrada",
  "order.completed": "Pedido concluído pelas duas confirmações",
  "order.cancelled": "Pedido cancelado",
  "order.disputed": "Disputa aberta",
  "order.refunded": "Pedido reembolsado",
};

/** Sem rótulo conhecido, mostramos o tipo cru do evento — não inventamos texto. */
export function orderEventLabel(eventType: string): string {
  return ORDER_EVENT_LABELS[eventType] ?? eventType;
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export interface DeliveryEndpoints {
  orderDetail: string;
  delivery: string;
  confirmations: string;
  sellerAccounts: string;
}

export function deliveryEndpoints(orderId: string): DeliveryEndpoints {
  const encoded = encodeURIComponent(orderId);
  return {
    orderDetail: `/v1/orders/${encoded}`,
    delivery: `/v1/orders/${encoded}/delivery`,
    confirmations: `/v1/orders/${encoded}/delivery/confirmations`,
    sellerAccounts: "/v1/me/seller-accounts",
  };
}
