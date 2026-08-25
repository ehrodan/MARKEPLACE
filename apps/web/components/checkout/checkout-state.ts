/**
 * SCR-BUY-003 — estado do checkout. Módulo PURO: sem React, sem rede, sem relógio implícito.
 * Todo tempo entra por parâmetro (`now`) para o mapeamento ser determinístico e testável.
 *
 * FRONTEIRA PCI (escopo SAQ-A):
 * este módulo não modela — e a tela não renderiza — PAN, CVV, validade, titular ou
 * qualquer outro dado de cartão. O pagamento ocorre em sessão HOSPEDADA pelo PSP.
 * Aqui só existe o `Payment` publicado por `GET /v1/me/payments` (contrato
 * `financePaymentSchema` em packages/contracts/src/finance.ts) e a capability de
 * provider publicada por `GET /v1/finance/provider-capability`.
 *
 * REGRA CANÔNICA — docs/07-MAPA-DE-TELAS-E-FLUXOS.md §FL-05.5 e §FL-11.1:
 * "Retorno do navegador é apenas informativo; somente webhook autenticado confirma
 * payment.settled." Por isso `returnedFromProvider` NUNCA produz o estágio liquidado:
 * produz `CONFIRMING_WITH_PROVIDER`. Só `paymentStatus === "SETTLED"`, gravado a partir
 * do webhook verificado, produz `SETTLED_BY_WEBHOOK`.
 */

/** Espelha `financePaymentSchema.paymentStatus`. */
export type PaymentStatus = "PENDING" | "SETTLED" | "FAILED" | "CANCELLED" | "PAYMENT_QUARANTINED";

/** Espelha `financePaymentSchema.reconciliationStatus`. */
export type ReconciliationStatus = "PENDING" | "RECONCILED_PROVIDER" | "RECONCILED_MANUAL";

/** Espelha `providerCapabilitySchema`. */
export type ProviderCapabilityStatus = "AVAILABLE" | "CONTRACT_REQUIRED" | "UNSUPPORTED";

export type ProviderCapabilityReason =
  | "AVAILABLE"
  | "PROVIDER_CONTRACT_NOT_SELECTED"
  | "PROVIDER_CREDENTIALS_REQUIRED"
  | "PROVIDER_ADAPTER_NOT_INSTALLED";

export interface ProviderCapability {
  providerCode: string | null;
  status: ProviderCapabilityStatus;
  reasonCode: ProviderCapabilityReason;
}

/** Projeção de `GET /v1/me/payments` → `data[]`. Nenhum campo é inventado pela interface. */
export interface CheckoutPayment {
  paymentId: string;
  orderId: string;
  buyerUserId: string;
  sellerAccountId: string;
  providerCode: string | null;
  amountMinor: string;
  currency: string;
  paymentStatus: PaymentStatus;
  reconciliationStatus: ReconciliationStatus;
  settledAt: string | null;
  createdAt: string;
}

export interface CheckoutPaymentList {
  data: CheckoutPayment[];
  asOf: string;
}

/**
 * Projeção de `GET /v1/orders/{orderId}` — fonte canônica declarada no doc 07 (SCR-BUY-005).
 * `reservedUntil` corresponde a `orders.reserved_until` em modules/orders/src/schema.ts.
 * Enquanto a rota não estiver publicada, a decomposição não é exibida — nem inventada.
 */
export interface CheckoutOrderSummary {
  orderId: string;
  publicCode: string | null;
  status: string;
  subtotalMinor: string;
  feeMinor: string;
  totalMinor: string;
  currency: string;
  reservedUntil: string | null;
}

export const checkoutSteps = [
  { code: "REVIEW", label: "Revisar pedido" },
  { code: "POLICY", label: "Aceitar política" },
  { code: "PROVIDER", label: "Pagar no provedor" },
  { code: "CONFIRMATION", label: "Confirmação por webhook" },
] as const;

export type CheckoutStepCode = (typeof checkoutSteps)[number]["code"];

export type CheckoutStageCode =
  | "AWAITING_PAYMENT_SESSION"
  | "PAYMENT_SESSION_OPEN"
  | "CONFIRMING_WITH_PROVIDER"
  | "RESERVATION_EXPIRED"
  | "SETTLED_BY_WEBHOOK"
  | "RECOVERABLE_FAILURE"
  | "CANCELLED"
  | "QUARANTINED";

export type CheckoutBlockCode =
  | "POLICY_ACCEPTANCE_REQUIRED"
  | "PROVIDER_CONTRACT_NOT_SELECTED"
  | "PROVIDER_CREDENTIALS_REQUIRED"
  | "PROVIDER_ADAPTER_NOT_INSTALLED"
  | "PAYMENT_SESSION_CONTRACT_REQUIRED"
  | "RESERVATION_WINDOW_CLOSED"
  | "ORDER_TOTAL_MISMATCH"
  | "PAYMENT_UNDER_REVIEW"
  | "PAYMENT_TERMINAL";

export type CheckoutActionCode =
  | "CREATE_PROVIDER_SESSION"
  | "RESUME_PROVIDER_SESSION"
  | "REFRESH_PAYMENT_STATUS"
  | "OPEN_ORDER";

export type CheckoutTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface CheckoutBlock {
  code: CheckoutBlockCode;
  message: string;
}

export interface CheckoutAction {
  code: CheckoutActionCode;
  label: string;
  description: string;
}

export interface CheckoutState {
  stage: CheckoutStageCode;
  step: CheckoutStepCode;
  label: string;
  explanation: string;
  tone: CheckoutTone;
  /** Ação primária permitida. `null` quando há bloqueio: a tela mostra os motivos, nunca um botão mudo. */
  action: CheckoutAction | null;
  blocks: readonly CheckoutBlock[];
  allowsCancellation: boolean;
  cancellationNote: string;
  /** Frase que reafirma quem confirma o pagamento. Nunca omitida. */
  settlementNote: string;
}

export interface CheckoutStateInput {
  payment: CheckoutPayment;
  capability: ProviderCapability;
  /** Resumo do pedido, ou `null` quando a rota canônica ainda não publica a leitura. */
  order: CheckoutOrderSummary | null;
  policyAccepted: boolean;
  /** Verdadeiro quando a pessoa voltou do PSP. Informativo — jamais confirma pagamento. */
  returnedFromProvider: boolean;
  /** Falso enquanto não existir rota publicada para criar ou retomar a sessão hospedada. */
  sessionContractPublished: boolean;
  /** `allowedActions` enviado pelo servidor. Sem ele, nenhuma ação é presumida. */
  serverAllowedActions: readonly string[];
  now: Date;
}

const providerBlockMessages: Record<ProviderCapabilityReason, string> = {
  AVAILABLE: "O provedor de pagamento respondeu como disponível.",
  PROVIDER_CONTRACT_NOT_SELECTED:
    "Nenhum provedor de pagamento foi contratado neste ambiente. Sem contrato ativo não existe sessão hospedada para abrir.",
  PROVIDER_CREDENTIALS_REQUIRED:
    "O provedor selecionado está sem credenciais homologadas. A sessão de pagamento permanece fechada até a habilitação.",
  PROVIDER_ADAPTER_NOT_INSTALLED:
    "O adaptador do provedor selecionado não está instalado nesta API. Nenhuma sessão de pagamento pode ser aberta.",
};

const providerBlockCodes: Record<ProviderCapabilityReason, CheckoutBlockCode> = {
  AVAILABLE: "PROVIDER_CONTRACT_NOT_SELECTED",
  PROVIDER_CONTRACT_NOT_SELECTED: "PROVIDER_CONTRACT_NOT_SELECTED",
  PROVIDER_CREDENTIALS_REQUIRED: "PROVIDER_CREDENTIALS_REQUIRED",
  PROVIDER_ADAPTER_NOT_INSTALLED: "PROVIDER_ADAPTER_NOT_INSTALLED",
};

const reconciliationNotes: Record<ReconciliationStatus, string> = {
  PENDING: "A conciliação com o extrato do provedor ainda está pendente no financeiro.",
  RECONCILED_PROVIDER: "A conciliação foi fechada por consulta ao próprio provedor.",
  RECONCILED_MANUAL: "A conciliação foi fechada manualmente pelo financeiro, com registro auditável.",
};

/** Regra do doc 07 repetida em toda a tela: quem confirma é o webhook, não o navegador. */
export const SETTLEMENT_RULE =
  "Somente o webhook autenticado do provedor confirma o pagamento. O retorno do navegador é informativo e não libera o pedido.";

export const CANCELLATION_CONTRACT_NOTE =
  "O servidor não publicou ação de cancelamento para este pagamento. Enquanto allowedActions não trouxer a permissão, a tela não oferece o cancelamento.";

// ---------------------------------------------------------------------------
// Dinheiro: sempre string em unidades mínimas, comparado e formatado com BigInt.
// ---------------------------------------------------------------------------

const MINOR_UNITS_PATTERN = /^-?\d+$/u;

export function isMinorUnits(value: string): boolean {
  return MINOR_UNITS_PATTERN.test(value);
}

/** Formata unidades mínimas sem passar por `Number` — seguro para qualquer magnitude. */
export function formatMinorUnits(amountMinor: string, currency: string, locale = "pt-BR"): string {
  if (!isMinorUnits(amountMinor)) return `${currency} ${amountMinor}`;
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    const scale = 10n ** BigInt(fractionDigits);
    const value = BigInt(amountMinor);
    const negative = value < 0n;
    const absolute = negative ? -value : value;
    const major = new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 })
      .format(absolute / scale);
    const fraction = (absolute % scale).toString().padStart(fractionDigits, "0");
    let integerWritten = false;
    const rendered = formatter
      .formatToParts(0)
      .map((part) => {
        if (part.type === "integer" && !integerWritten) {
          integerWritten = true;
          return major;
        }
        if (part.type === "fraction") return fraction;
        return part.value;
      })
      .join("");
    return negative ? `−${rendered}` : rendered;
  } catch {
    return `${currency} ${amountMinor}`;
  }
}

export function addMinorUnits(first: string, second: string): string | null {
  if (!isMinorUnits(first) || !isMinorUnits(second)) return null;
  return (BigInt(first) + BigInt(second)).toString();
}

export type AmountConsistency = "MATCHES" | "MISMATCH" | "NOT_PUBLISHED" | "UNVERIFIABLE";

/**
 * Confere a integridade do dinheiro antes de qualquer avanço:
 * subtotal + taxa === total, e total === valor autorizado no pagamento.
 */
export function checkOrderTotals(
  order: CheckoutOrderSummary | null,
  payment: CheckoutPayment,
): AmountConsistency {
  if (!order) return "NOT_PUBLISHED";
  if (order.currency !== payment.currency) return "MISMATCH";
  const parts = [order.subtotalMinor, order.feeMinor, order.totalMinor, payment.amountMinor];
  if (parts.some((value) => !isMinorUnits(value))) return "UNVERIFIABLE";
  if (BigInt(order.subtotalMinor) + BigInt(order.feeMinor) !== BigInt(order.totalMinor)) return "MISMATCH";
  if (BigInt(order.totalMinor) !== BigInt(payment.amountMinor)) return "MISMATCH";
  return "MATCHES";
}

// ---------------------------------------------------------------------------
// Prazo de reserva
// ---------------------------------------------------------------------------

export interface ReservationDeadline {
  /** ISO original enviado pelo servidor, para renderização absoluta. */
  reservedUntil: string;
  expired: boolean;
  /**
   * Texto ESTÁTICO e grosseiro do tempo restante ("Cerca de 2 horas restantes").
   * Deliberadamente sem segundos: prazo verificável, nunca cronômetro de urgência
   * (docs/03 §10 e docs/07 §1.4 — SCR-BUY-003 é M0).
   */
  remainingLabel: string;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function plural(value: number, singular: string, pluralForm: string): string {
  return `${String(value)} ${value === 1 ? singular : pluralForm}`;
}

/** Retorna `null` quando o servidor não enviou prazo: sem dado do servidor, nada é exibido. */
export function describeReservationDeadline(
  reservedUntil: string | null | undefined,
  now: Date,
): ReservationDeadline | null {
  if (!reservedUntil) return null;
  const deadlineTime = new Date(reservedUntil).getTime();
  if (Number.isNaN(deadlineTime)) return null;

  const remaining = deadlineTime - now.getTime();
  if (remaining <= 0) {
    return { reservedUntil, expired: true, remainingLabel: "Prazo encerrado" };
  }
  if (remaining < MINUTE_MS) {
    return { reservedUntil, expired: false, remainingLabel: "Menos de 1 minuto restante" };
  }
  if (remaining < HOUR_MS) {
    const minutes = Math.floor(remaining / MINUTE_MS);
    return {
      reservedUntil,
      expired: false,
      remainingLabel: `Cerca de ${plural(minutes, "minuto restante", "minutos restantes")}`,
    };
  }
  if (remaining < DAY_MS) {
    const hours = Math.floor(remaining / HOUR_MS);
    return {
      reservedUntil,
      expired: false,
      remainingLabel: `Cerca de ${plural(hours, "hora restante", "horas restantes")}`,
    };
  }
  const days = Math.floor(remaining / DAY_MS);
  return {
    reservedUntil,
    expired: false,
    remainingLabel: `Cerca de ${plural(days, "dia restante", "dias restantes")}`,
  };
}

// ---------------------------------------------------------------------------
// Seleção do pagamento
// ---------------------------------------------------------------------------

/**
 * Envelope real de `GET /v1/orders/{orderId}`.
 *
 * A rota declara `response: { 200: z.object({ data: z.any(), asOf }) }` em
 * apps/api/src/order-routes.ts, e `serializeOrderDetail` monta
 * `{ data: { order, items, timeline, delivery }, asOf }`. O resumo do checkout mora em
 * `data.order` — NÃO na raiz. Como o servidor publica o miolo como `z.any()` e não o
 * valida, a projeção confere a forma campo a campo: qualquer ausência derruba o resumo
 * para `null` e a tela declara a decomposição como indisponível, em vez de imprimir
 * `undefined` no lugar de dinheiro.
 */
export interface OrderDetailEnvelope {
  data?: unknown;
  asOf?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Lê uma string obrigatória e não vazia. Qualquer outra coisa é tratada como ausente. */
function readRequiredString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Lê um campo que o contrato declara anulável. Tipo inesperado vira `null`, nunca um palpite. */
function readNullableString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Projeta o resumo financeiro a partir do envelope do pedido.
 * Retorna `null` quando o corpo não traz `data.order` com os campos monetários que o
 * checkout precisa — a ausência é reportada como tal, jamais preenchida.
 */
export function projectOrderSummary(
  envelope: OrderDetailEnvelope | null | undefined,
): CheckoutOrderSummary | null {
  const data = asRecord(envelope?.data);
  if (!data) return null;
  const order = asRecord(data["order"]);
  if (!order) return null;

  const orderId = readRequiredString(order, "orderId");
  const status = readRequiredString(order, "status");
  const currency = readRequiredString(order, "currency");
  const subtotalMinor = readRequiredString(order, "subtotalMinor");
  const feeMinor = readRequiredString(order, "feeMinor");
  const totalMinor = readRequiredString(order, "totalMinor");

  if (!orderId || !status || !currency || !subtotalMinor || !feeMinor || !totalMinor) return null;

  return {
    orderId,
    publicCode: readNullableString(order, "publicCode"),
    status,
    subtotalMinor,
    feeMinor,
    totalMinor,
    currency,
    reservedUntil: readNullableString(order, "reservedUntil"),
  };
}

export function findPaymentById(list: CheckoutPaymentList, paymentId: string): CheckoutPayment | null {
  return list.data.find((payment) => payment.paymentId === paymentId) ?? null;
}

export function stepIndexOf(step: CheckoutStepCode): number {
  return checkoutSteps.findIndex((entry) => entry.code === step);
}

// ---------------------------------------------------------------------------
// Mapeamento de estado
// ---------------------------------------------------------------------------

function resolveStage(input: CheckoutStateInput, expired: boolean): CheckoutStageCode {
  const { payment, returnedFromProvider } = input;
  if (payment.paymentStatus === "PAYMENT_QUARANTINED") return "QUARANTINED";
  if (payment.paymentStatus === "SETTLED") return "SETTLED_BY_WEBHOOK";
  if (payment.paymentStatus === "CANCELLED") return "CANCELLED";
  if (payment.paymentStatus === "FAILED") return "RECOVERABLE_FAILURE";
  // A partir daqui o pagamento está PENDING no servidor.
  // O retorno do navegador vem ANTES do prazo: enquanto o provedor ainda pode confirmar,
  // afirmar "reserva vencida" seria uma conclusão que a interface não tem autoridade para tirar.
  if (returnedFromProvider) return "CONFIRMING_WITH_PROVIDER";
  if (expired) return "RESERVATION_EXPIRED";
  if (payment.providerCode) return "PAYMENT_SESSION_OPEN";
  return "AWAITING_PAYMENT_SESSION";
}

function resolveStep(stage: CheckoutStageCode, policyAccepted: boolean): CheckoutStepCode {
  switch (stage) {
    case "AWAITING_PAYMENT_SESSION":
      return policyAccepted ? "PROVIDER" : "POLICY";
    case "PAYMENT_SESSION_OPEN":
    case "RECOVERABLE_FAILURE":
      return "PROVIDER";
    case "CONFIRMING_WITH_PROVIDER":
    case "SETTLED_BY_WEBHOOK":
    case "QUARANTINED":
      return "CONFIRMATION";
    case "RESERVATION_EXPIRED":
    case "CANCELLED":
      return "REVIEW";
  }
}

const sessionStages: ReadonlySet<CheckoutStageCode> = new Set<CheckoutStageCode>([
  "AWAITING_PAYMENT_SESSION",
  "PAYMENT_SESSION_OPEN",
  "RECOVERABLE_FAILURE",
]);

function resolveBlocks(
  input: CheckoutStateInput,
  stage: CheckoutStageCode,
  deadline: ReservationDeadline | null,
  totals: AmountConsistency,
): CheckoutBlock[] {
  if (stage === "QUARANTINED") {
    return [{
      code: "PAYMENT_UNDER_REVIEW",
      message:
        "O pagamento entrou em quarentena financeira. A análise é conduzida pelo time financeiro e nenhuma ação de pagamento é liberada nesta tela.",
    }];
  }

  if (stage === "CANCELLED") {
    return [{
      code: "PAYMENT_TERMINAL",
      message: "O servidor registrou este pagamento como cancelado. Uma nova cobrança exige um novo pedido.",
    }];
  }

  if (stage === "RESERVATION_EXPIRED") {
    return [{
      code: "RESERVATION_WINDOW_CLOSED",
      message:
        "A janela de reserva enviada pelo servidor terminou. O pagamento segue pendente no servidor: só ele pode cancelar ou liquidar.",
    }];
  }

  if (!sessionStages.has(stage)) return [];

  const blocks: CheckoutBlock[] = [];

  // Todos os motivos são listados juntos: a pessoa vê na mesma leitura o que depende
  // dela (o aceite) e o que não depende (contrato de provedor e de sessão).
  if (input.capability.status !== "AVAILABLE") {
    blocks.push({
      code: providerBlockCodes[input.capability.reasonCode],
      message: providerBlockMessages[input.capability.reasonCode],
    });
  }

  if (!input.sessionContractPublished) {
    blocks.push({
      code: "PAYMENT_SESSION_CONTRACT_REQUIRED",
      message:
        "A API ainda não publica a rota que cria ou retoma a sessão hospedada do provedor. Nenhum pagamento é simulado enquanto o contrato não existir.",
    });
  }

  if (!input.policyAccepted) {
    blocks.push({
      code: "POLICY_ACCEPTANCE_REQUIRED",
      message: "O aceite da política de compra ainda não foi registrado nesta sessão.",
    });
  }

  if (deadline?.expired) {
    blocks.push({
      code: "RESERVATION_WINDOW_CLOSED",
      message: "A janela de reserva enviada pelo servidor terminou.",
    });
  }

  if (totals === "MISMATCH") {
    blocks.push({
      code: "ORDER_TOTAL_MISMATCH",
      message:
        "O resumo do pedido e o valor autorizado no pagamento não fecham. Nenhum avanço é permitido enquanto os valores divergirem.",
    });
  }

  return blocks;
}

function describeStage(
  stage: CheckoutStageCode,
  payment: CheckoutPayment,
): { label: string; explanation: string; tone: CheckoutTone } {
  switch (stage) {
    case "AWAITING_PAYMENT_SESSION":
      return {
        label: "Aguardando sessão de pagamento",
        tone: "neutral",
        explanation:
          "O pagamento consta como pendente no servidor e nenhuma sessão hospedada foi aberta ainda.",
      };
    case "PAYMENT_SESSION_OPEN":
      return {
        label: "Sessão de pagamento criada",
        tone: "info",
        explanation: payment.providerCode
          ? `O pagamento está vinculado ao provedor ${payment.providerCode} e permanece pendente. A sessão hospedada pode ser retomada sem recomeçar o pedido.`
          : "O pagamento está vinculado a uma sessão hospedada e permanece pendente.",
      };
    case "CONFIRMING_WITH_PROVIDER":
      return {
        label: "Confirmando com o provedor",
        tone: "info",
        explanation:
          "Você voltou da sessão hospedada do provedor. Esse retorno é informativo: o pagamento continua pendente até o webhook autenticado chegar e ser conciliado.",
      };
    case "RESERVATION_EXPIRED":
      return {
        label: "Prazo de reserva encerrado",
        tone: "warning",
        explanation:
          "O prazo de reserva enviado pelo servidor terminou e o pagamento continua pendente. A tela não conclui nem cancela nada por conta do relógio do navegador.",
      };
    case "SETTLED_BY_WEBHOOK":
      return {
        label: "Pagamento confirmado pelo provedor",
        tone: "success",
        explanation: `O webhook autenticado do provedor confirmou a liquidação. ${reconciliationNotes[payment.reconciliationStatus]}`,
      };
    case "RECOVERABLE_FAILURE":
      return {
        label: "Pagamento não concluído",
        tone: "danger",
        explanation:
          "O provedor recusou ou encerrou a tentativa anterior. O pedido continua registrado e uma nova tentativa pode ser aberta quando o provedor estiver habilitado.",
      };
    case "CANCELLED":
      return {
        label: "Pagamento cancelado",
        tone: "danger",
        explanation:
          "O servidor registrou o cancelamento deste pagamento. Nenhuma cobrança permanece em aberto por esta tela.",
      };
    case "QUARANTINED":
      return {
        label: "Pagamento em quarentena",
        tone: "warning",
        explanation:
          "O financeiro colocou este pagamento em quarentena para conferência com o provedor. O caso é resolvido pela operação, não por esta tela.",
      };
  }
}

function resolveAction(stage: CheckoutStageCode, blocked: boolean): CheckoutAction | null {
  switch (stage) {
    case "AWAITING_PAYMENT_SESSION":
      return blocked
        ? null
        : {
            code: "CREATE_PROVIDER_SESSION",
            label: "Abrir checkout seguro do provedor",
            description: "Os dados de pagamento são digitados no ambiente do provedor, nunca aqui.",
          };
    case "PAYMENT_SESSION_OPEN":
      return blocked
        ? null
        : {
            code: "RESUME_PROVIDER_SESSION",
            label: "Retomar checkout seguro do provedor",
            description: "A sessão hospedada já existe e continua de onde parou.",
          };
    case "RECOVERABLE_FAILURE":
      return blocked
        ? null
        : {
            code: "CREATE_PROVIDER_SESSION",
            label: "Abrir nova tentativa no provedor",
            description: "Uma nova sessão hospedada é criada para o mesmo pedido.",
          };
    case "CONFIRMING_WITH_PROVIDER":
    case "RESERVATION_EXPIRED":
    case "QUARANTINED":
      return {
        code: "REFRESH_PAYMENT_STATUS",
        label: "Atualizar status do pagamento",
        description: "Relê o estado gravado pelo servidor. Nada é concluído pela interface.",
      };
    case "SETTLED_BY_WEBHOOK":
      return {
        code: "OPEN_ORDER",
        label: "Abrir o pedido",
        description: "A entrega e as confirmações acontecem na tela do pedido.",
      };
    case "CANCELLED":
      return null;
  }
}

export function resolveCheckoutState(input: CheckoutStateInput): CheckoutState {
  const deadline = describeReservationDeadline(input.order?.reservedUntil ?? null, input.now);
  const totals = checkOrderTotals(input.order, input.payment);
  const stage = resolveStage(input, deadline?.expired ?? false);
  const blocks = resolveBlocks(input, stage, deadline, totals);
  const descriptor = describeStage(stage, input.payment);
  const allowsCancellation = input.serverAllowedActions.includes("PAYMENT_CANCEL");

  return {
    stage,
    step: resolveStep(stage, input.policyAccepted),
    label: descriptor.label,
    explanation: descriptor.explanation,
    tone: descriptor.tone,
    action: resolveAction(stage, blocks.length > 0),
    blocks,
    allowsCancellation,
    cancellationNote: allowsCancellation
      ? "O servidor autorizou o cancelamento deste pagamento."
      : CANCELLATION_CONTRACT_NOTE,
    settlementNote: SETTLEMENT_RULE,
  };
}
