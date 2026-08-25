/**
 * Estado da busca pública (SCR-PUB-004) — núcleo puro.
 *
 * Por que a URL é a fonte da verdade: `docs/07-MAPA-DE-TELAS-E-FLUXOS.md`
 * (fluxo 1 de descoberta) exige que canal, filtros e recorte viajem no
 * endereço, para a consulta ser compartilhável, favoritável e recuperável pelo
 * botão voltar. Este módulo só traduz `URLSearchParams` <-> estado e resolve a
 * consulta sobre uma lista já carregada. Não faz IO, não conhece React.
 *
 * Regra de honestidade: nada aqui inventa relevância de plataforma. A ordem
 * `correspondencia` é uma contagem local de termos sobre os anúncios já
 * carregados, rotulada como tal na interface. O ranking dedicado pertence a
 * `GET /v1/search`, que ainda não está publicado.
 *
 * Dinheiro: sempre em minor units como string, comparado com BigInt.
 */

import type { PublicListing } from "@/components/marketplace/types";

export const SEARCH_CHANNELS = ["p2p", "midas"] as const;
export type SearchChannel = (typeof SEARCH_CHANNELS)[number];

export const SEARCH_SORTS = ["recentes", "correspondencia", "preco-asc", "preco-desc"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

/** Rótulo de cada canal. `midas` depende de `GET /v1/channels/midas/listings`. */
export const CHANNEL_LABELS: Readonly<Record<SearchChannel, string>> = {
  p2p: "Entre pessoas",
  midas: "Vendido pelo Midas",
};

export const SORT_LABELS: Readonly<Record<SearchSort, string>> = {
  recentes: "Publicados recentemente",
  correspondencia: "Correspondência ao termo",
  "preco-asc": "Menor preço",
  "preco-desc": "Maior preço",
};

export const MAX_QUERY_LENGTH = 120;
export const MAX_QUERY_TERMS = 8;

const MAX_PRICE_DIGITS = 18;
const ITEM_TYPE_PATTERN = /^[A-Z0-9_]{1,40}$/u;
const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;

export interface SearchQueryState {
  /** Termo digitado, preservado como o usuário escreveu. */
  readonly q: string;
  /** Código canônico de `catalogItem.itemType`, ou `null` para todos. */
  readonly tipo: string | null;
  readonly canal: SearchChannel;
  readonly ordem: SearchSort;
  /** Piso de preço em minor units (string de dígitos), ou `null`. */
  readonly precoMinMinor: string | null;
  /** Teto de preço em minor units (string de dígitos), ou `null`. */
  readonly precoMaxMinor: string | null;
}

export const DEFAULT_SEARCH_QUERY: SearchQueryState = {
  q: "",
  tipo: null,
  canal: "p2p",
  ordem: "recentes",
  precoMinMinor: null,
  precoMaxMinor: null,
};

/** Contrato mínimo satisfeito por `URLSearchParams` e por `ReadonlyURLSearchParams`. */
export interface SearchParamSource {
  get(name: string): string | null;
}

function isChannel(value: string): value is SearchChannel {
  return (SEARCH_CHANNELS as readonly string[]).includes(value);
}

function isSort(value: string): value is SearchSort {
  return (SEARCH_SORTS as readonly string[]).includes(value);
}

/** Remove controle/formatação invisível e colapsa espaços. Nunca lança. */
export function normalizeQueryText(raw: string): string {
  return raw
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
}

/** Normaliza dígitos de minor units. Valor inválido vira `null`, sem quebrar a página. */
export function normalizeMinorUnits(raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;
  if (!/^\d+$/u.test(value)) return null;
  if (value.length > MAX_PRICE_DIGITS) return null;
  return BigInt(value).toString();
}

function compareMinorStrings(first: string, second: string): number {
  const a = BigInt(first);
  const b = BigInt(second);
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Lê o estado da busca a partir dos parâmetros da URL.
 * Todo valor inválido cai no default correspondente: a página resolve a
 * consulta possível em vez de exibir erro por endereço malformado.
 */
export function parseSearchQuery(source: SearchParamSource): SearchQueryState {
  const q = normalizeQueryText(source.get("q") ?? "");

  const rawTipo = (source.get("tipo") ?? "").trim().toUpperCase();
  const tipo = ITEM_TYPE_PATTERN.test(rawTipo) ? rawTipo : null;

  const rawCanal = (source.get("canal") ?? "").trim().toLowerCase();
  const canal = isChannel(rawCanal) ? rawCanal : DEFAULT_SEARCH_QUERY.canal;

  const rawOrdem = (source.get("ordem") ?? "").trim().toLowerCase();
  const ordem = isSort(rawOrdem) ? rawOrdem : DEFAULT_SEARCH_QUERY.ordem;

  let precoMinMinor: string | null = null;
  let precoMaxMinor: string | null = null;
  const rawPreco = (source.get("preco") ?? "").trim();
  if (rawPreco !== "") {
    const parts = rawPreco.split("-");
    if (parts.length === 2) {
      const min = normalizeMinorUnits(parts.at(0) ?? "");
      const max = normalizeMinorUnits(parts.at(1) ?? "");
      // Faixa invertida é reparada, não descartada: o intervalo pedido é o mesmo.
      if (min !== null && max !== null && compareMinorStrings(min, max) > 0) {
        precoMinMinor = max;
        precoMaxMinor = min;
      } else {
        precoMinMinor = min;
        precoMaxMinor = max;
      }
    }
  }

  return { q, tipo, canal, ordem, precoMinMinor, precoMaxMinor };
}

/** Serializa apenas o que difere do default, em ordem estável. */
export function serializeSearchQuery(state: SearchQueryState): string {
  const params = new URLSearchParams();
  if (state.q !== "") params.set("q", state.q);
  if (state.tipo !== null) params.set("tipo", state.tipo);
  if (state.canal !== DEFAULT_SEARCH_QUERY.canal) params.set("canal", state.canal);
  if (state.ordem !== DEFAULT_SEARCH_QUERY.ordem) params.set("ordem", state.ordem);
  if (state.precoMinMinor !== null || state.precoMaxMinor !== null) {
    params.set("preco", `${state.precoMinMinor ?? ""}-${state.precoMaxMinor ?? ""}`);
  }
  return params.toString();
}

/** Endereço completo da consulta, pronto para `router.push` ou `href`. */
export function searchHref(pathname: string, state: SearchQueryState): string {
  const query = serializeSearchQuery(state);
  return query === "" ? pathname : `${pathname}?${query}`;
}

export function hasActiveFilters(state: SearchQueryState): boolean {
  return state.q !== ""
    || state.tipo !== null
    || state.precoMinMinor !== null
    || state.precoMaxMinor !== null;
}

/* ------------------------------------------------------------------ */
/* Conversão entre unidade maior digitada e minor units canônicas      */
/* ------------------------------------------------------------------ */

/**
 * Casas decimais reais da moeda, lidas do `Intl` — não é constante inventada.
 * Código inválido cai em 2, que é o default do próprio `Intl` para moeda
 * desconhecida de três letras.
 */
export function currencyFractionDigits(currency: string): number {
  try {
    const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency });
    return formatter.resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * "1.299,90" / "1299.90" / "1299" -> minor units.
 * Devolve `null` para entrada que não é um valor monetário — o campo mostra
 * a recusa em vez de aplicar um filtro que o usuário não pediu.
 */
export function majorToMinorUnits(raw: string, fractionDigits: number): string | null {
  const value = raw.trim().replace(/\s/gu, "");
  if (value === "") return null;

  const separator = /[.,](?=\d*$)/u.exec(value);
  const decimalIndex = separator?.index ?? -1;
  const integerPart = (decimalIndex === -1 ? value : value.slice(0, decimalIndex))
    .replace(/[.,]/gu, "");
  const fractionPart = decimalIndex === -1 ? "" : value.slice(decimalIndex + 1);

  if (!/^\d+$/u.test(integerPart)) return null;
  if (fractionPart !== "" && !/^\d+$/u.test(fractionPart)) return null;
  if (fractionPart.length > fractionDigits) return null;
  if (integerPart.length + fractionDigits > MAX_PRICE_DIGITS) return null;

  return BigInt(integerPart + fractionPart.padEnd(fractionDigits, "0")).toString();
}

/** Minor units -> texto para preencher o campo de volta a partir da URL. */
export function minorUnitsToMajor(minor: string, fractionDigits: number): string {
  const normalized = normalizeMinorUnits(minor);
  if (normalized === null) return "";
  if (fractionDigits <= 0) return normalized;
  const padded = normalized.padStart(fractionDigits + 1, "0");
  const integerPart = padded.slice(0, padded.length - fractionDigits);
  const fractionPart = padded.slice(padded.length - fractionDigits);
  return `${integerPart},${fractionPart}`;
}

/* ------------------------------------------------------------------ */
/* Resolução da consulta sobre os anúncios já carregados               */
/* ------------------------------------------------------------------ */

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

/** Termos distintos da consulta, dobrados para comparação. */
export function queryTerms(q: string): readonly string[] {
  const terms = fold(normalizeQueryText(q))
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 0);
  return [...new Set(terms)].slice(0, MAX_QUERY_TERMS);
}

/** Campos do anúncio que a busca percorre, por peso decrescente. */
export function listingFields(listing: PublicListing): {
  readonly title: string;
  readonly taxonomy: string;
  readonly origin: string;
} {
  const item = listing.catalogItem;
  return {
    title: fold(item?.displayName ?? ""),
    taxonomy: fold([item?.itemType, item?.rarity, item?.craftQuality, item?.gameOrigin]
      .filter((value): value is string => typeof value === "string")
      .join(" ")),
    origin: fold([listing.publicSlug, listing.seller?.displayName, listing.listingPlan?.displayName]
      .filter((value): value is string => typeof value === "string")
      .join(" ")),
  };
}

/** Pontuação local do termo. Não é ranking de plataforma. */
export function matchScore(listing: PublicListing, terms: readonly string[]): number {
  if (terms.length === 0) return 0;
  const fields = listingFields(listing);
  let score = 0;
  for (const term of terms) {
    if (fields.title.includes(term)) score += 4;
    if (fields.taxonomy.includes(term)) score += 2;
    if (fields.origin.includes(term)) score += 1;
  }
  return score;
}

/** Um anúncio corresponde quando contém TODOS os termos em algum campo. */
export function matchesTerms(listing: PublicListing, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const fields = listingFields(listing);
  const haystack = `${fields.title} ${fields.taxonomy} ${fields.origin}`;
  return terms.every((term) => haystack.includes(term));
}

export function matchesItemType(listing: PublicListing, tipo: string | null): boolean {
  if (tipo === null) return true;
  return listing.catalogItem?.itemType === tipo;
}

/**
 * Preço fora da faixa é excluído. Preço que não é minor units legível também:
 * com limite pedido, um valor ilegível não pode ser afirmado como dentro.
 */
export function matchesPrice(
  listing: PublicListing,
  minMinor: string | null,
  maxMinor: string | null,
): boolean {
  if (minMinor === null && maxMinor === null) return true;
  const price = normalizeMinorUnits(listing.priceMinor);
  if (price === null) return false;
  if (minMinor !== null && compareMinorStrings(price, minMinor) < 0) return false;
  if (maxMinor !== null && compareMinorStrings(price, maxMinor) > 0) return false;
  return true;
}

function publishedTime(listing: PublicListing): number {
  const published = listing.publishedAt;
  if (typeof published !== "string") return 0;
  const parsed = Date.parse(published);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function comparePrice(first: PublicListing, second: PublicListing): number {
  const a = normalizeMinorUnits(first.priceMinor);
  const b = normalizeMinorUnits(second.priceMinor);
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compareMinorStrings(a, b);
}

export function filterListings(
  listings: readonly PublicListing[],
  state: SearchQueryState,
): PublicListing[] {
  const terms = queryTerms(state.q);
  return listings.filter((listing) => (
    matchesTerms(listing, terms)
    && matchesItemType(listing, state.tipo)
    && matchesPrice(listing, state.precoMinMinor, state.precoMaxMinor)
  ));
}

export function sortListings(
  listings: readonly PublicListing[],
  state: SearchQueryState,
): PublicListing[] {
  const terms = queryTerms(state.q);
  const ordered = [...listings];
  ordered.sort((first, second) => {
    if (state.ordem === "preco-asc") {
      const byPrice = comparePrice(first, second);
      if (byPrice !== 0) return byPrice;
    }
    if (state.ordem === "preco-desc") {
      const byPrice = comparePrice(second, first);
      if (byPrice !== 0) return byPrice;
    }
    if (state.ordem === "correspondencia") {
      const byScore = matchScore(second, terms) - matchScore(first, terms);
      if (byScore !== 0) return byScore;
    }
    return publishedTime(second) - publishedTime(first);
  });
  return ordered;
}

export function applySearch(
  listings: readonly PublicListing[],
  state: SearchQueryState,
): PublicListing[] {
  return sortListings(filterListings(listings, state), state);
}

/** Quantos anúncios carregados contêm este termo. */
export function termMatchCount(listings: readonly PublicListing[], term: string): number {
  return listings.filter((listing) => matchesTerms(listing, [term])).length;
}

/**
 * Termo com menos correspondências no conjunto carregado — o candidato natural
 * a ser removido quando a consulta não devolve nada. Só existe com 2+ termos:
 * retirar o único termo seria limpar a busca, não recuperá-la.
 */
export function rarestTerm(listings: readonly PublicListing[], q: string): string | null {
  const terms = queryTerms(q);
  if (terms.length < 2) return null;
  let rarest: string | null = null;
  let smallest = Number.POSITIVE_INFINITY;
  for (const term of terms) {
    const count = termMatchCount(listings, term);
    if (count < smallest) {
      smallest = count;
      rarest = term;
    }
  }
  return rarest;
}

/** Reescreve a consulta sem um termo, preservando os demais como digitados. */
export function withoutTerm(state: SearchQueryState, term: string): SearchQueryState {
  const target = fold(term);
  const kept = normalizeQueryText(state.q)
    .split(" ")
    .filter((word) => word !== "" && fold(word.replace(/[^\p{L}\p{N}]+/gu, "")) !== target)
    .join(" ");
  return { ...state, q: kept };
}

/* ------------------------------------------------------------------ */
/* Facetas ativas e caminhos de recuperação                            */
/* ------------------------------------------------------------------ */

export type FacetId = "q" | "tipo" | "precoMin" | "precoMax";

export interface SearchFacet {
  readonly id: FacetId;
  /** Nome do critério, para leitor de tela e para o chip. */
  readonly label: string;
  /** Valor legível já formatado pelo chamador. */
  readonly value: string;
  /** Estado resultante de remover apenas esta faceta. */
  readonly next: SearchQueryState;
}

export interface FacetFormat {
  readonly itemType: (value: string) => string;
  readonly price: (minorUnits: string) => string;
}

/** Formatação neutra, útil em teste e enquanto a moeda do conjunto é desconhecida. */
export const rawFacetFormat: FacetFormat = {
  itemType: (value) => value,
  price: (minorUnits) => minorUnits,
};

export function activeFacets(
  state: SearchQueryState,
  format: FacetFormat = rawFacetFormat,
): readonly SearchFacet[] {
  const facets: SearchFacet[] = [];
  if (state.q !== "") {
    facets.push({ id: "q", label: "Termo", value: state.q, next: { ...state, q: "" } });
  }
  if (state.tipo !== null) {
    facets.push({
      id: "tipo",
      label: "Tipo",
      value: format.itemType(state.tipo),
      next: { ...state, tipo: null },
    });
  }
  if (state.precoMinMinor !== null) {
    facets.push({
      id: "precoMin",
      label: "Preço mínimo",
      value: format.price(state.precoMinMinor),
      next: { ...state, precoMinMinor: null },
    });
  }
  if (state.precoMaxMinor !== null) {
    facets.push({
      id: "precoMax",
      label: "Preço máximo",
      value: format.price(state.precoMaxMinor),
      next: { ...state, precoMaxMinor: null },
    });
  }
  return facets;
}

export interface Relaxation extends SearchFacet {
  /** Quantos anúncios carregados voltariam ao resultado sem esta faceta. */
  readonly count: number;
}

/**
 * Caminhos de saída para o resultado vazio: uma faceta por vez, com a
 * contagem real que ela libera. Ordenado pelo que mais devolve resultado.
 */
export function relaxations(
  listings: readonly PublicListing[],
  state: SearchQueryState,
  format: FacetFormat = rawFacetFormat,
): readonly Relaxation[] {
  return activeFacets(state, format)
    .map((facet) => ({ ...facet, count: filterListings(listings, facet.next).length }))
    .sort((first, second) => second.count - first.count);
}
