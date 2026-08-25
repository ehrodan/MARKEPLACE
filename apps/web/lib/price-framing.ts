/**
 * Enquadramento de desconto — "Regra do 100" (Jonah Berger, via Big Black Book 3).
 *
 * O mesmo desconto é percebido como maior ou menor conforme a forma de exibição:
 * abaixo de 100 unidades da moeda, a PORCENTAGEM parece maior ("50% off" > "R$ 23 off");
 * acima de 100, o VALOR ABSOLUTO parece maior ("R$ 500 de desconto" > "25%").
 *
 * Limites honestos codificados aqui, porque `docs/03-DIRECAO-DE-ARTE.md` §10 proíbe
 * design manipulativo e o CDC pune preço de referência falso:
 *
 * 1. Sem âncora real, não há enquadramento. Nunca se inventa um "de" para criar um "por".
 * 2. Âncora menor ou igual ao preço atual devolve `kind: "none"` — não existe desconto.
 * 3. A porcentagem é truncada para baixo. Superdeclarar desconto é propaganda enganosa;
 *    41,9% é exibido como 41%, nunca como 42%.
 * 4. Toda decisão devolve `basis`, para que a interface seja obrigada a mostrar
 *    contra o que a economia foi calculada.
 *
 * Dinheiro sempre em minor units como string (centavos), aritmética em BigInt.
 * Number nunca entra em cálculo monetário.
 */

/** Limiar da Regra do 100 em minor units: 100 unidades da moeda = 10 000 centavos. */
export const RULE_OF_100_THRESHOLD_MINOR = 10_000n;

/** Desconto abaixo deste piso não é destacado: ruído visual sem ganho percebido. */
export const MINIMUM_HIGHLIGHTED_PERCENT = 5;

export type DiscountFrameKind = "percent" | "absolute" | "none";

export type NoDiscountReason =
  | "ANCHOR_MISSING"
  | "ANCHOR_NOT_HIGHER"
  | "INVALID_AMOUNT"
  | "CURRENCY_MISMATCH"
  | "BELOW_MINIMUM";

export interface DiscountFrameInput {
  /** Preço vigente, em minor units. */
  readonly currentPriceMinor: string;
  /**
   * Preço de referência REALMENTE praticado antes, em minor units.
   * Ausente quando não existe âncora verificável — e nesse caso não há enquadramento.
   */
  readonly anchorPriceMinor?: string | null;
  readonly currency: string;
  /** Moeda da âncora, quando vier de outra fonte. Divergência invalida o cálculo. */
  readonly anchorCurrency?: string | null;
}

export interface DiscountFrame {
  readonly kind: DiscountFrameKind;
  /** Economia em minor units. "0" quando não há desconto. */
  readonly savingsMinor: string;
  /** Percentual truncado para baixo. 0 quando não há desconto. */
  readonly savingsPercent: number;
  /**
   * Contra o que a economia foi calculada. A interface é obrigada a exibir.
   * `null` somente quando `kind === "none"`.
   */
  readonly basis: string | null;
  /** Presente apenas quando `kind === "none"`. */
  readonly reason?: NoDiscountReason;
}

function parseMinor(value: string | null | undefined): bigint | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

function noFrame(reason: NoDiscountReason): DiscountFrame {
  return { kind: "none", savingsMinor: "0", savingsPercent: 0, basis: null, reason };
}

/**
 * Decide se e como um desconto deve ser exibido.
 *
 * Não formata moeda: a interface formata com o componente `Money` do design system,
 * que já resolve locale e minor units.
 */
export function frameDiscount(input: DiscountFrameInput): DiscountFrame {
  const current = parseMinor(input.currentPriceMinor);
  if (current === null || current < 0n) return noFrame("INVALID_AMOUNT");

  if (input.anchorPriceMinor === undefined || input.anchorPriceMinor === null) {
    return noFrame("ANCHOR_MISSING");
  }

  const anchor = parseMinor(input.anchorPriceMinor);
  if (anchor === null || anchor <= 0n) return noFrame("INVALID_AMOUNT");

  const anchorCurrency = input.anchorCurrency ?? input.currency;
  if (anchorCurrency !== input.currency) return noFrame("CURRENCY_MISMATCH");

  if (anchor <= current) return noFrame("ANCHOR_NOT_HIGHER");

  const savings = anchor - current;

  // Truncamento para baixo: nunca superdeclarar desconto.
  const percent = Number((savings * 100n) / anchor);
  if (percent < MINIMUM_HIGHLIGHTED_PERCENT) return noFrame("BELOW_MINIMUM");

  // Regra do 100 aplicada sobre a ÂNCORA, que é o número que o cliente
  // usa como referência de magnitude.
  const kind: DiscountFrameKind =
    anchor < RULE_OF_100_THRESHOLD_MINOR ? "percent" : "absolute";

  return {
    kind,
    savingsMinor: savings.toString(),
    savingsPercent: percent,
    basis: `Comparado ao preço anterior praticado nesta oferta (${input.currency}).`,
  };
}

/**
 * Enquadra a economia de um conjunto montado (combo).
 *
 * A base é obrigatoriamente a SOMA DOS PREÇOS VIGENTES dos itens — não se aceita
 * um preço de referência arbitrário, para que seja impossível calcular economia
 * contra valor inflado.
 */
export function frameBundleSavings(input: {
  readonly itemPricesMinor: readonly string[];
  readonly bundleTotalMinor: string;
  readonly currency: string;
}): DiscountFrame {
  if (input.itemPricesMinor.length === 0) return noFrame("ANCHOR_MISSING");

  let sum = 0n;
  for (const price of input.itemPricesMinor) {
    const parsed = parseMinor(price);
    if (parsed === null || parsed < 0n) return noFrame("INVALID_AMOUNT");
    sum += parsed;
  }

  const frame = frameDiscount({
    currentPriceMinor: input.bundleTotalMinor,
    anchorPriceMinor: sum.toString(),
    currency: input.currency,
  });

  if (frame.kind === "none") return frame;

  return {
    ...frame,
    basis: `Comparado à soma dos preços vigentes dos ${String(input.itemPricesMinor.length)} itens (${input.currency}).`,
  };
}
