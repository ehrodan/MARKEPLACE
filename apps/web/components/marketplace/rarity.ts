/**
 * Escada de raridade: o domínio fala em constantes, a interface fala em cor.
 *
 * Este módulo é a única ponte entre as duas, e existe para que a cor nunca seja
 * a ÚNICA portadora da informação — cada nível devolve também um rótulo em
 * português e uma posição na escada. Quem não distingue as matizes lê o texto e
 * a posição; quem distingue, lê mais rápido. É a mesma informação por dois
 * canais, que é o que a acessibilidade exige e o que o benchmark faz.
 *
 * A lista de valores vem do CHECK de `catalog.catalog_items.rarity`. Se o banco
 * ganhar um nível novo, o teste desta pasta quebra — de propósito.
 */

export const RARITY_ORDER = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
  "MYTHIC",
  "CONTRABAND",
] as const;

export type Rarity = (typeof RARITY_ORDER)[number];

const LABELS: Record<Rarity, string> = {
  COMMON: "comum",
  UNCOMMON: "incomum",
  RARE: "raro",
  EPIC: "épico",
  LEGENDARY: "lendário",
  MYTHIC: "mítico",
  CONTRABAND: "contrabando",
};

export interface RarityPresentation {
  /** Valor canônico do domínio, para `data-rarity` no CSS. */
  readonly value: Rarity;
  /** Rótulo em português, visível — a cor nunca informa sozinha. */
  readonly label: string;
  /** 1..7. Também é dito em texto, para não depender de percepção de cor. */
  readonly step: number;
  readonly total: number;
}

function isRarity(value: string): value is Rarity {
  return (RARITY_ORDER as readonly string[]).includes(value);
}

/**
 * Devolve `null` para ausência — e ausência é diferente de "comum".
 * Um adesivo sem raridade declarada não pode ser exibido como o nível mais
 * baixo: isso seria inventar um dado que o vendedor não forneceu.
 */
export function rarityPresentation(raw: string | null | undefined): RarityPresentation | null {
  if (typeof raw !== "string") return null;
  const upper = raw.trim().toUpperCase();
  if (!isRarity(upper)) return null;
  return {
    value: upper,
    label: LABELS[upper],
    step: RARITY_ORDER.indexOf(upper) + 1,
    total: RARITY_ORDER.length,
  };
}
