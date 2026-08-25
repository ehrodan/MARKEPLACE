import type { StatusTone } from "@midas/ui";

/**
 * Contratos canônicos consultados pelas duas superfícies de reembolso.
 * Fonte: docs/01-PRD-MIDAS.md (RF-199, RF-200) e docs/07-MAPA-DE-TELAS-E-FLUXOS.md
 * (SCR-BUY-010, SCR-BUY-011).
 */
export const REFUND_LIST_CONTRACT = "GET /v1/me/refund-requests?cursor=&limit=&status=";
export const REFUND_DETAIL_CONTRACT = "GET /v1/refund-requests/{refundRequestId}";
export const REFUND_CREATE_CONTRACT = "POST /v1/orders/{orderId}/refund-requests";

/**
 * Estados da SOLICITAÇÃO, transcritos de docs/01-PRD-MIDAS.md:
 * `REQUESTED → UNDER_REVIEW → APPROVED | PARTIALLY_APPROVED | DENIED`, com
 * `UNDER_REVIEW → AWAITING_CUSTOMER_INFORMATION → UNDER_REVIEW` e
 * `PROCESSING → COMPLETED | FAILED`.
 *
 * Esta lista é só rótulo. A interface não guarda nem deduz transição: o estado
 * exibido é o que o servidor devolveu.
 */
export const refundRequestStatuses = [
  "REQUESTED",
  "UNDER_REVIEW",
  "AWAITING_CUSTOMER_INFORMATION",
  "APPROVED",
  "PARTIALLY_APPROVED",
  "DENIED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
] as const;

export type RefundRequestStatus = (typeof refundRequestStatuses)[number];

const statusLabels: Record<RefundRequestStatus, string> = {
  REQUESTED: "Solicitado",
  UNDER_REVIEW: "Em análise",
  AWAITING_CUSTOMER_INFORMATION: "Aguardando sua informação",
  APPROVED: "Aprovado",
  PARTIALLY_APPROVED: "Aprovado em parte",
  DENIED: "Recusado",
  PROCESSING: "Em execução",
  COMPLETED: "Concluído",
  FAILED: "Falhou",
};

/**
 * O que cada estado NÃO significa. `RefundRequest` é o pedido do comprador; o
 * refund do PSP devolve o dinheiro e o journal do ledger registra o efeito.
 * Vínculo entre eles não transforma um no outro (PRD, invariante 31).
 */
const statusMeanings: Record<RefundRequestStatus, string> = {
  REQUESTED:
    "A solicitação foi registrada. Nenhuma análise começou e nenhum valor saiu do pagamento.",
  UNDER_REVIEW:
    "A solicitação está em análise humana. Análise não é aprovação nem devolução de dinheiro.",
  AWAITING_CUSTOMER_INFORMATION:
    "A análise está parada esperando informação sua. Enquanto isso, nada é decidido nem devolvido.",
  APPROVED:
    "A decisão aprovou o valor integral. Aprovação não é dinheiro devolvido: a execução no provedor de pagamento é etapa separada.",
  PARTIALLY_APPROVED:
    "A decisão aprovou parte do valor. O valor aprovado vem do servidor; esta tela não calcula diferença nem projeta o restante.",
  DENIED: "A decisão recusou a solicitação. O motivo, quando informado, aparece sem reescrita.",
  PROCESSING:
    "A execução foi enviada ao provedor de pagamento. Ainda não há confirmação de devolução.",
  COMPLETED:
    "O provedor confirmou a devolução e o efeito foi registrado. É o único estado que afirma dinheiro devolvido.",
  FAILED:
    "A execução falhou. A falha não altera saldo por conta própria e não cria uma segunda solicitação.",
};

const statusTones: Record<RefundRequestStatus, StatusTone> = {
  REQUESTED: "warning",
  UNDER_REVIEW: "warning",
  AWAITING_CUSTOMER_INFORMATION: "warning",
  APPROVED: "success",
  PARTIALLY_APPROVED: "warning",
  DENIED: "danger",
  PROCESSING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
};

export function isRefundRequestStatus(value: unknown): value is RefundRequestStatus {
  return typeof value === "string" && (refundRequestStatuses as readonly string[]).includes(value);
}

export function refundStatusLabel(status: RefundRequestStatus): string {
  return statusLabels[status];
}

export function refundStatusMeaning(status: RefundRequestStatus): string {
  return statusMeanings[status];
}

export function refundStatusTone(status: RefundRequestStatus): StatusTone {
  return statusTones[status];
}

/** Estado em que a solicitação espera uma ação do comprador. */
export function refundAwaitsBuyer(status: RefundRequestStatus): boolean {
  return status === "AWAITING_CUSTOMER_INFORMATION";
}

export interface RefundRequestSummary {
  refundRequestId: string;
  orderId: string;
  status: RefundRequestStatus;
  requestedAmountMinor: string;
  currency: string;
  createdAt: string;
  /** Ausente quando o contrato não devolveu o campo. Nunca inferido do valor solicitado. */
  approvedAmountMinor: string | null;
  reasonCode: string | null;
  updatedAt: string | null;
}

export interface RefundAttempt {
  refundAttemptId: string;
  status: string;
  occurredAt: string;
  providerReference: string | null;
  failureCode: string | null;
}

export interface RefundRequestDetail extends RefundRequestSummary {
  description: string | null;
  decidedAt: string | null;
  decisionRationale: string | null;
  /** `null` = o contrato não expôs tentativas. `[]` = o servidor afirmou que não há nenhuma. */
  attempts: RefundAttempt[] | null;
  relatedTicketId: string | null;
  relatedDisputeId: string | null;
  asOf: string | null;
}

const minorUnits = /^\d+$/u;
const currencyCode = /^[A-Z]{3}$/u;

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function optionalTimestamp(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function optionalMinor(value: unknown): string | null {
  return typeof value === "string" && minorUnits.test(value) ? value : null;
}

function parseSummaryRow(value: unknown): RefundRequestSummary | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const { refundRequestId, orderId, status, requestedAmountMinor, currency, createdAt } = row;

  if (
    typeof refundRequestId !== "string" ||
    refundRequestId.length === 0 ||
    typeof orderId !== "string" ||
    orderId.length === 0 ||
    !isRefundRequestStatus(status) ||
    typeof requestedAmountMinor !== "string" ||
    !minorUnits.test(requestedAmountMinor) ||
    typeof currency !== "string" ||
    !currencyCode.test(currency) ||
    typeof createdAt !== "string" ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  return {
    refundRequestId,
    orderId,
    status,
    requestedAmountMinor,
    currency,
    createdAt,
    approvedAmountMinor: optionalMinor(row.approvedAmountMinor),
    reasonCode: optionalString(row.reasonCode),
    updatedAt: optionalTimestamp(row.updatedAt),
  };
}

/**
 * Lê a página de solicitações. Linha fora do contrato é DESCARTADA e contada, em
 * vez de virar linha com campo vazio — dinheiro exibido errado é pior que
 * dinheiro não exibido.
 */
export function parseRefundRequestPage(payload: unknown): {
  items: RefundRequestSummary[];
  discarded: number;
  nextCursor: string | null;
  asOf: string | null;
  freshness: "READY" | "STALE" | null;
} | null {
  if (typeof payload !== "object" || payload === null) return null;
  const envelope = payload as Record<string, unknown>;
  if (!Array.isArray(envelope.data)) return null;

  const items: RefundRequestSummary[] = [];
  let discarded = 0;
  for (const entry of envelope.data) {
    const parsed = parseSummaryRow(entry);
    if (parsed) {
      items.push(parsed);
    } else {
      discarded += 1;
    }
  }

  const freshness = envelope.freshness;
  return {
    items,
    discarded,
    nextCursor: optionalString(envelope.nextCursor),
    asOf: optionalTimestamp(envelope.asOf),
    freshness: freshness === "READY" || freshness === "STALE" ? freshness : null,
  };
}

function parseAttempts(value: unknown): RefundAttempt[] | null {
  if (!Array.isArray(value)) return null;
  const attempts: RefundAttempt[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const occurredAt = optionalTimestamp(row.occurredAt);
    if (typeof row.refundAttemptId !== "string" || typeof row.status !== "string" || !occurredAt) {
      continue;
    }
    attempts.push({
      refundAttemptId: row.refundAttemptId,
      status: row.status,
      occurredAt,
      providerReference: optionalString(row.providerReference),
      failureCode: optionalString(row.failureCode),
    });
  }
  return attempts;
}

/** Aceita o envelope `{ refundRequest, attempts, asOf }` e também o objeto plano. */
export function parseRefundRequestDetail(payload: unknown): RefundRequestDetail | null {
  if (typeof payload !== "object" || payload === null) return null;
  const envelope = payload as Record<string, unknown>;
  const nested = envelope.refundRequest;
  const source =
    typeof nested === "object" && nested !== null ? (nested as Record<string, unknown>) : envelope;

  const summary = parseSummaryRow(source);
  if (!summary) return null;

  const decision = source.decision;
  const decisionRow =
    typeof decision === "object" && decision !== null ? (decision as Record<string, unknown>) : null;

  const attemptsSource = Array.isArray(envelope.attempts) ? envelope.attempts : source.attempts;

  return {
    ...summary,
    approvedAmountMinor:
      summary.approvedAmountMinor ?? optionalMinor(decisionRow?.approvedAmountMinor),
    description: optionalString(source.description),
    decidedAt: optionalTimestamp(source.decidedAt) ?? optionalTimestamp(decisionRow?.decidedAt),
    decisionRationale:
      optionalString(source.decisionRationale) ?? optionalString(decisionRow?.rationale),
    attempts: parseAttempts(attemptsSource),
    relatedTicketId: optionalString(source.relatedTicketId),
    relatedDisputeId: optionalString(source.relatedDisputeId),
    asOf: optionalTimestamp(envelope.asOf) ?? optionalTimestamp(source.asOf),
  };
}
