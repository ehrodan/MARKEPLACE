/**
 * Contratos consultados pelas superfícies de extrato e retenções.
 * Fonte: docs/07-MAPA-DE-TELAS-E-FLUXOS.md (SCR-SEL-011, SCR-SEL-012).
 */
export const BALANCE_CONTRACT = "GET /v1/seller-accounts/{sellerAccountId}/finance/balance";
export const LEDGER_CONTRACT = "GET /v1/sales-balance/ledger?cursor=";
export const HOLDS_CONTRACT = "GET /v1/sales-balance/holds?cursor=";

/**
 * Espelho de `modules/finance/src/hold-policy.ts` (`HOLD_DURATION_HOURS`).
 * `apps/web` depende só de `@midas/ui`, então o valor não pode ser importado do
 * módulo de domínio — é duplicado de propósito, com a fonte nomeada. Se o
 * domínio mudar, o teste deste arquivo é o lugar que registra a divergência.
 */
export const HOLD_DURATION_HOURS = 168;

/**
 * Espelho de `HoldReleaseDecision.reasonCode`, na MESMA ordem em que
 * `evaluateHoldRelease()` decide. A ordem importa: o primeiro gate que bloqueia
 * é o motivo que o vendedor recebe, e a tela não pode sugerir que basta resolver
 * um gate posterior.
 */
export const holdBlockReasonOrder = [
  "HOLD_WINDOW_ACTIVE",
  "ORDER_NOT_COMPLETED",
  "PAYMENT_NOT_RECONCILED",
  "DISPUTE_OPEN",
  "CHARGEBACK_OPEN",
  "ACCOUNT_FROZEN",
] as const;

export type HoldBlockReason = (typeof holdBlockReasonOrder)[number];
export type HoldReason = HoldBlockReason | "ELIGIBLE";

interface HoldReasonCopy {
  label: string;
  meaning: string;
  /** O que o vendedor pode fazer. `null` quando não há ação dele — dizer que há seria falso. */
  sellerAction: string | null;
}

const reasonCopy: Record<HoldReason, HoldReasonCopy> = {
  HOLD_WINDOW_ACTIVE: {
    label: "Janela de retenção em curso",
    meaning: `A liberação conta ${String(HOLD_DURATION_HOURS)} horas a partir da liquidação do pagamento pelo provedor, não da data do pedido nem da entrega.`,
    sellerAction: null,
  },
  ORDER_NOT_COMPLETED: {
    label: "Pedido não concluído",
    meaning:
      "O pedido ainda não atingiu o estado concluído. Entrega confirmada por um lado só não conclui o pedido.",
    sellerAction: "Acompanhe a entrega e a confirmação do comprador no pedido.",
  },
  PAYMENT_NOT_RECONCILED: {
    label: "Pagamento não reconciliado",
    meaning:
      "O valor ainda não foi conferido contra o extrato do provedor de pagamento. Pagamento aprovado não é pagamento reconciliado.",
    sellerAction: null,
  },
  DISPUTE_OPEN: {
    label: "Disputa aberta",
    meaning:
      "Existe disputa em andamento sobre este valor. A liberação espera a decisão, e a decisão não é tomada nesta tela.",
    sellerAction: "Responda a disputa com evidência dentro do prazo do caso.",
  },
  CHARGEBACK_OPEN: {
    label: "Chargeback aberto",
    meaning:
      "O emissor do meio de pagamento contestou a cobrança. O prazo é do emissor, não da plataforma.",
    sellerAction: "Envie a documentação pedida no caso enquanto o prazo do emissor estiver aberto.",
  },
  ACCOUNT_FROZEN: {
    label: "Conta sob análise",
    meaning:
      "A conta está congelada por análise de risco ou conformidade. Nenhum valor é liberado enquanto o congelamento durar.",
    sellerAction: "Abra suporte para acompanhar a análise.",
  },
  ELIGIBLE: {
    label: "Elegível",
    meaning:
      "Todos os gates foram vencidos. Elegível significa que o ledger pode liberar; não significa que o dinheiro já saiu.",
    sellerAction: null,
  },
};

export function isHoldReason(value: unknown): value is HoldReason {
  return (
    typeof value === "string" &&
    (value === "ELIGIBLE" || (holdBlockReasonOrder as readonly string[]).includes(value))
  );
}

export function holdReasonLabel(reason: HoldReason): string {
  return reasonCopy[reason].label;
}

export function holdReasonMeaning(reason: HoldReason): string {
  return reasonCopy[reason].meaning;
}

export function holdReasonSellerAction(reason: HoldReason): string | null {
  return reasonCopy[reason].sellerAction;
}

export interface SellerBalanceFacts {
  sellerAccountId: string;
  currency: string;
  heldAmountMinor: string;
  availableAmountMinor: string;
  reservedAmountMinor: string;
  asOf: string;
}

const minorUnits = /^\d+$/u;
const currencyCode = /^[A-Z]{3}$/u;

/**
 * `useApiResource` faz cast, não validação. Aqui é dinheiro, então o contrato é
 * conferido campo a campo: valor fora do formato faz a leitura inteira falhar,
 * em vez de renderizar número errado. Recusa explicitamente `number` — dinheiro
 * em ponto flutuante é o começo de erro de centavo.
 */
export function readSellerBalance(payload: unknown): SellerBalanceFacts | null {
  if (typeof payload !== "object" || payload === null) return null;
  const row = payload as Record<string, unknown>;
  const {
    sellerAccountId,
    currency,
    heldAmountMinor,
    availableAmountMinor,
    reservedAmountMinor,
    asOf,
  } = row;

  if (
    typeof sellerAccountId !== "string" ||
    sellerAccountId.length === 0 ||
    typeof currency !== "string" ||
    !currencyCode.test(currency) ||
    typeof heldAmountMinor !== "string" ||
    !minorUnits.test(heldAmountMinor) ||
    typeof availableAmountMinor !== "string" ||
    !minorUnits.test(availableAmountMinor) ||
    typeof reservedAmountMinor !== "string" ||
    !minorUnits.test(reservedAmountMinor) ||
    typeof asOf !== "string" ||
    Number.isNaN(Date.parse(asOf))
  ) {
    return null;
  }

  return {
    sellerAccountId,
    currency,
    heldAmountMinor,
    availableAmountMinor,
    reservedAmountMinor,
    asOf,
  };
}

/** `true` quando o bucket tem valor. Comparação em BigInt: `"0"` é zero, `"00"` também. */
export function hasAmount(amountMinor: string): boolean {
  if (!minorUnits.test(amountMinor)) return false;
  return BigInt(amountMinor) > 0n;
}
