/**
 * Preço de combo — aritmética pura em BigInt.
 *
 * A regra antifraude que define este arquivo: a economia SÓ pode ser
 * calculada contra a soma dos preços VIGENTES dos itens. A função não
 * aceita um preço de referência arbitrário, então é impossível calcular
 * "economia" contra um valor inflado ou contra um "de/por" que nunca foi
 * praticado. Isso não é escrúpulo: preço de referência falso é infração
 * de CDC e o `docs/03 §10` já proíbe.
 *
 * Dinheiro em minor units string. Nunca Number: o total de um combo em
 * centavos passa de Number.MAX_SAFE_INTEGER com folga em moeda fraca.
 */

export type BundlePricingReason =
  | "EMPTY_BUNDLE"
  | "INVALID_AMOUNT"
  | "CURRENCY_MISMATCH"
  | "TOTAL_ABOVE_SUM";

export interface BundleLine {
  readonly listingId: string;
  readonly quantity: number;
  readonly unitPriceMinor: string;
  readonly currency: string;
}

export interface BundlePricing {
  /** Soma dos preços vigentes × quantidade. É a ÚNICA base de comparação. */
  readonly subtotalMinor: string;
  /** Total cobrado pelo conjunto. */
  readonly bundleTotalMinor: string;
  /** subtotal − total. Nunca negativo. */
  readonly savingsMinor: string;
  /** Percentual truncado para baixo. Superdeclarar desconto é enganoso. */
  readonly savingsPercent: number;
  readonly currency: string;
  /** Texto obrigatório: contra o que a economia foi calculada. */
  readonly basis: string;
  readonly itemCount: number;
}

export type BundlePricingResult =
  | { readonly ok: true; readonly pricing: BundlePricing }
  | { readonly ok: false; readonly reason: BundlePricingReason };

function parseMinor(value: string): bigint | null {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  try {
    return BigInt(value.trim());
  } catch {
    return null;
  }
}

function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 999;
}

/**
 * @param lines itens do combo, com o preço vigente de cada um
 * @param bundleTotalMinor total cobrado pelo conjunto
 */
export function computeBundlePricing(
  lines: readonly BundleLine[],
  bundleTotalMinor: string,
): BundlePricingResult {
  if (lines.length === 0) return { ok: false, reason: "EMPTY_BUNDLE" };

  const first = lines[0];
  if (!first) return { ok: false, reason: "EMPTY_BUNDLE" };
  const currency = first.currency;

  let subtotal = 0n;
  let itemCount = 0;

  for (const line of lines) {
    // Moedas diferentes nunca se somam. Um combo misto não tem total.
    if (line.currency !== currency) return { ok: false, reason: "CURRENCY_MISMATCH" };
    if (!isValidQuantity(line.quantity)) return { ok: false, reason: "INVALID_AMOUNT" };

    const unit = parseMinor(line.unitPriceMinor);
    if (unit === null) return { ok: false, reason: "INVALID_AMOUNT" };

    subtotal += unit * BigInt(line.quantity);
    itemCount += line.quantity;
  }

  const total = parseMinor(bundleTotalMinor);
  if (total === null) return { ok: false, reason: "INVALID_AMOUNT" };

  // Combo mais caro que a soma das partes não é combo. Recusa em vez de
  // devolver economia negativa, que a interface poderia exibir errado.
  if (total > subtotal) return { ok: false, reason: "TOTAL_ABOVE_SUM" };

  const savings = subtotal - total;
  const savingsPercent = subtotal === 0n ? 0 : Number((savings * 100n) / subtotal);

  return {
    ok: true,
    pricing: {
      subtotalMinor: subtotal.toString(),
      bundleTotalMinor: total.toString(),
      savingsMinor: savings.toString(),
      savingsPercent,
      currency,
      basis: `Comparado à soma dos preços vigentes dos ${String(lines.length)} itens (${currency}).`,
      itemCount,
    },
  };
}

/**
 * A interface só pode usar a palavra "economia" quando isto é verdade.
 * Combo sem desconto real mostra o total, não uma economia de zero.
 */
export function hasRealSavings(pricing: BundlePricing): boolean {
  return parseMinor(pricing.savingsMinor) !== null && BigInt(pricing.savingsMinor) > 0n;
}
