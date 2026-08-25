import type { PurchaseListItem } from "@/lib/api-types";

/**
 * Elegibilidade para avaliar um pedido — SCR-ACC-015.
 *
 * É a regra que impede fraude de reputação, e cada cláusula existe por um
 * motivo comercial concreto:
 *
 * - só quem foi PARTE do pedido avalia — senão qualquer um infla ou afunda
 *   um vendedor de fora;
 * - só depois de `COMPLETED` — avaliar antes da entrega transforma a nota em
 *   arma de negociação;
 * - uma avaliação por papel por pedido — senão o mesmo pedido vira dez notas;
 * - janela de edição fechada — nota editável para sempre não é histórico;
 * - comprador e vendedor são reputações SEPARADAS e nunca somadas.
 *
 * DUPLO CEGO: enquanto os dois lados não enviarem (ou o prazo não fechar),
 * nenhum vê a nota do outro. É o que impede retaliação — sem isso, o segundo
 * a avaliar responde à nota do primeiro em vez de avaliar a compra.
 *
 * NOTA ZERO É VÁLIDA. Sistemas erram tratando 0 como "sem nota"; aqui zero é
 * uma avaliação e `null` é ausência de avaliação. São coisas diferentes.
 */

export const REVIEW_WINDOW_DAYS = 30;
export const REVIEW_EDIT_WINDOW_DAYS = 7;
export const MIN_SCORE = 0;
export const MAX_SCORE = 5;

export type ReviewRole = "BUYER" | "SELLER";

export type IneligibleReason =
  | "ORDER_NOT_COMPLETED"
  | "REVIEW_WINDOW_CLOSED"
  | "ALREADY_REVIEWED"
  | "ORDER_DATE_UNKNOWN";

export interface EligibilityInput {
  readonly status: string;
  /** ISO-8601. Quando ausente, não se presume prazo. */
  readonly completedAt: string | null;
  readonly alreadyReviewed: boolean;
  readonly now: Date;
}

export type Eligibility =
  | { readonly eligible: true; readonly deadline: Date }
  | { readonly eligible: false; readonly reason: IneligibleReason; readonly message: string };

const MESSAGE: Record<IneligibleReason, string> = {
  ORDER_NOT_COMPLETED:
    "A avaliação abre depois que o pedido é concluído pelas duas confirmações de entrega.",
  REVIEW_WINDOW_CLOSED: `A janela de ${String(REVIEW_WINDOW_DAYS)} dias para avaliar este pedido terminou.`,
  ALREADY_REVIEWED: "Você já avaliou este pedido neste papel.",
  ORDER_DATE_UNKNOWN:
    "O servidor não informou a data de conclusão, então o prazo não pode ser calculado. Nenhuma data é presumida.",
};

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function reviewEligibility(input: EligibilityInput): Eligibility {
  if (input.status !== "COMPLETED") {
    return { eligible: false, reason: "ORDER_NOT_COMPLETED", message: MESSAGE.ORDER_NOT_COMPLETED };
  }
  if (input.alreadyReviewed) {
    return { eligible: false, reason: "ALREADY_REVIEWED", message: MESSAGE.ALREADY_REVIEWED };
  }
  if (!input.completedAt) {
    return { eligible: false, reason: "ORDER_DATE_UNKNOWN", message: MESSAGE.ORDER_DATE_UNKNOWN };
  }

  const completed = new Date(input.completedAt);
  if (Number.isNaN(completed.getTime())) {
    return { eligible: false, reason: "ORDER_DATE_UNKNOWN", message: MESSAGE.ORDER_DATE_UNKNOWN };
  }

  const deadline = addDays(completed, REVIEW_WINDOW_DAYS);
  if (input.now > deadline) {
    return { eligible: false, reason: "REVIEW_WINDOW_CLOSED", message: MESSAGE.REVIEW_WINDOW_CLOSED };
  }

  return { eligible: true, deadline };
}

/** Nota válida inclui ZERO. `null` é ausência de nota, não nota baixa. */
export function isValidScore(score: number | null): score is number {
  return (
    score !== null &&
    Number.isInteger(score) &&
    score >= MIN_SCORE &&
    score <= MAX_SCORE
  );
}

export interface ReviewableOrder {
  readonly order: PurchaseListItem;
  readonly eligibility: Eligibility;
}

/** Ordena o que pode ser avaliado primeiro; o resto segue com o motivo visível. */
export function reviewableOrders(
  orders: readonly PurchaseListItem[],
  now: Date,
  reviewedOrderIds: ReadonlySet<string> = new Set(),
): ReviewableOrder[] {
  return orders
    .map((order) => ({
      order,
      eligibility: reviewEligibility({
        status: order.status,
        completedAt: order.completedAt,
        alreadyReviewed: reviewedOrderIds.has(order.orderId),
        now,
      }),
    }))
    .sort((first, second) => Number(second.eligibility.eligible) - Number(first.eligibility.eligible));
}
