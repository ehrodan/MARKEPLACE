/**
 * Consciência de gasto.
 *
 * Não é bloqueio nem controle parental: é espelho. O teto é definido pelo
 * PRÓPRIO usuário, e o motor de recomendação o respeita.
 *
 * Por que isto existe num módulo de merchandising: este é um marketplace de
 * item de jogo, setor com risco documentado de gasto compulsivo e sob atenção
 * regulatória no Brasil. Um motor que empurra combo sem nenhum freio é o tipo
 * de coisa que vira ação coletiva. Cliente quebrado não volta; cliente que
 * confia volta. O freio é retenção de longo prazo, não perda de venda.
 */

export type SpendState = "UNDER" | "NEAR" | "REACHED" | "NO_LIMIT";

/** A partir de quantos por cento do teto o estado vira NEAR. */
export const NEAR_LIMIT_PERCENT = 80;

export interface SpendFacts {
  readonly spentMinor: string;
  /** `null` = o usuário não definiu teto. Ausência não é zero. */
  readonly limitMinor: string | null;
  readonly currency: string;
}

export interface SpendAwareness {
  readonly state: SpendState;
  readonly spentMinor: string;
  readonly limitMinor: string | null;
  /** `null` quando não há teto definido. */
  readonly remainingMinor: string | null;
  readonly usedPercent: number | null;
  readonly currency: string;
  /** Motor de recomendação lê isto. `true` suprime upsell. */
  readonly suppressUpsell: boolean;
}

function parseMinor(value: string | null): bigint | null {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  try {
    return BigInt(value.trim());
  } catch {
    return null;
  }
}

export function evaluateSpend(facts: SpendFacts): SpendAwareness {
  const spent = parseMinor(facts.spentMinor) ?? 0n;
  const limit = parseMinor(facts.limitMinor);

  // Sem teto definido: informa o gasto, não sugere nada, não suprime nada.
  // Ausência de limite não vira limite zero.
  if (limit === null || limit === 0n) {
    return {
      state: "NO_LIMIT",
      spentMinor: spent.toString(),
      limitMinor: null,
      remainingMinor: null,
      usedPercent: null,
      currency: facts.currency,
      suppressUpsell: false,
    };
  }

  const usedPercent = Number((spent * 100n) / limit);
  const remaining = spent >= limit ? 0n : limit - spent;
  const state: SpendState =
    spent >= limit ? "REACHED" : usedPercent >= NEAR_LIMIT_PERCENT ? "NEAR" : "UNDER";

  return {
    state,
    spentMinor: spent.toString(),
    limitMinor: limit.toString(),
    remainingMinor: remaining.toString(),
    usedPercent,
    currency: facts.currency,
    // Só REACHED suprime. NEAR informa, não censura — o teto é do usuário,
    // e avisar antes de atingir é útil; parar de sugerir antes seria paternalismo.
    suppressUpsell: state === "REACHED",
  };
}
