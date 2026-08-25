// Carrinho do dispositivo (SCR-BUY-012).
//
// Módulo PURO: sem React, sem DOM implícito, sem rede, sem relógio implícito.
// Guarda apenas o que veio de uma resposta real da API pública no instante em
// que o item entrou no carrinho (id, slug, título, vendedor, preço publicado).
// Nada aqui inventa preço, disponibilidade, desconto, prazo ou vendedor.
//
// REGRAS DE DINHEIRO
// Valor monetário é sempre string em unidades mínimas e toda aritmética passa
// por BigInt. Nenhuma conversão para Number acontece neste arquivo — nem na
// leitura, nem no merge, nem na soma de subtotal.
//
// REGRA DE RECONHECIMENTO DE MUDANÇA
// O preço guardado aqui é o preço que a pessoa viu ao adicionar. A revalidação
// contra o catálogo compara este valor com o preço vigente; enquanto forem
// diferentes, a divergência continua visível e o grupo fica travado. Aceitar a
// mudança é justamente gravar o preço novo (`setLineUnitPrice`) — não existe
// caminho que apague a diferença em silêncio.

export const CART_STORAGE_KEY = "midas.carrinho.v1";
export const MAX_CART_LINES = 100;
export const MAX_LINE_QUANTITY = 999;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoredCartLine {
  listingId: string;
  publicSlug: string;
  title: string;
  sellerAccountId: string;
  /** Nome público do vendedor, quando a resposta que originou a linha o trouxe. */
  sellerDisplayName?: string;
  /** Preço unitário publicado no instante em que o item entrou no carrinho. */
  unitPriceMinor: string;
  currency: string;
  quantity: number;
  addedAt: string;
  /** Guardado para depois: permanece no carrinho, fora dos grupos de checkout. */
  savedForLater?: boolean;
  /** Identificador da linha no carrinho do servidor, quando a conta responde. */
  cartLineId?: string;
}

export type CartStorageIssue =
  /** O navegador não expõe armazenamento (modo privado, bloqueio, SSR). */
  | "UNAVAILABLE"
  /** O conteúdo salvo não era JSON válido ou não era uma lista. */
  | "CORRUPTED"
  /** Parte das entradas salvas era inválida e foi descartada. */
  | "PARTIAL"
  /** A cota do dispositivo estourou e nada pôde ser gravado. */
  | "QUOTA"
  /** A cota do dispositivo estourou e as entradas mais antigas saíram. */
  | "TRIMMED";

export interface CartStorageResult {
  lines: StoredCartLine[];
  issue: CartStorageIssue | null;
  discarded: number;
}

/** Forma mínima que o agrupamento por vendedor precisa enxergar. */
export interface CartMoneyLine {
  listingId: string;
  sellerAccountId: string;
  sellerDisplayName?: string;
  unitPriceMinor: string;
  currency: string;
  quantity: number;
}

export interface CartSellerGroup<T extends CartMoneyLine> {
  sellerAccountId: string;
  /** `null` quando nenhuma resposta trouxe o nome público do vendedor. */
  sellerDisplayName: string | null;
  /** `null` quando o grupo mistura moedas — soma seria mentira. */
  currency: string | null;
  mixedCurrency: boolean;
  itemCount: number;
  /** `null` quando alguma linha é incomparável (moeda misturada ou valor inválido). */
  subtotalMinor: string | null;
  lines: T[];
}

export interface CartMergeLine {
  listingId: string;
  quantity: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Unidades mínimas: só dígitos, sem sinal, sem separador, sem notação científica. */
export function isMinorUnits(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,24}$/u.test(value);
}

function currencyCode(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z]{3}$/u.test(value) ? value : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function timeOf(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isQuotaError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    const legacyCode = Reflect.get(error, "code");
    return (
      error.name === "QuotaExceededError"
      || error.name === "NS_ERROR_DOM_QUOTA_REACHED"
      || legacyCode === 22
      || legacyCode === 1014
    );
  }
  if (error instanceof Error) return /quota|exceeded/iu.test(`${error.name} ${error.message}`);
  return false;
}

/**
 * Quantidade válida = inteiro de 1 a `MAX_LINE_QUANTITY`.
 * Zero, negativo, fracionário, `NaN`, texto e valor fora da faixa devolvem
 * `null`: a tela pede correção em vez de arredondar por conta própria.
 */
export function normalizeQuantity(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return null;
  if (value < 1 || value > MAX_LINE_QUANTITY) return null;
  return value;
}

/** Converte o que foi digitado no campo. Só dígitos são aceitos. */
export function parseQuantityInput(input: string): number | null {
  const cleaned = input.trim();
  if (!/^\d{1,4}$/u.test(cleaned)) return null;
  return normalizeQuantity(Number.parseInt(cleaned, 10));
}

/**
 * Valida uma entrada vinda do dispositivo OU do servidor. Campo faltando ou
 * fora do formato descarta a linha inteira em vez de completar com suposição.
 */
export function parseCartLine(value: unknown): StoredCartLine | null {
  if (!isRecord(value)) return null;
  const listingId = nonEmptyString(value.listingId);
  const publicSlug = nonEmptyString(value.publicSlug);
  const title = nonEmptyString(value.title);
  const sellerAccountId = nonEmptyString(value.sellerAccountId);
  const currency = currencyCode(value.currency);
  const addedAt = isoTimestamp(value.addedAt);
  const quantity = normalizeQuantity(value.quantity);
  if (!listingId || !publicSlug || !title || !sellerAccountId || !currency || !addedAt) return null;
  if (quantity === null || !isMinorUnits(value.unitPriceMinor)) return null;

  const sellerDisplayName = nonEmptyString(value.sellerDisplayName);
  const cartLineId = nonEmptyString(value.cartLineId);
  return {
    listingId,
    publicSlug,
    title,
    sellerAccountId,
    unitPriceMinor: value.unitPriceMinor,
    currency,
    quantity,
    addedAt,
    ...(sellerDisplayName === null ? {} : { sellerDisplayName }),
    ...(value.savedForLater === true ? { savedForLater: true } : {}),
    ...(cartLineId === null ? {} : { cartLineId }),
  };
}

/** Ordem de leitura do carrinho: primeiro item adicionado no topo, como um comprovante. */
export function sortCartLines(lines: readonly StoredCartLine[]): StoredCartLine[] {
  return [...lines].sort((first, second) => {
    const delta = timeOf(first.addedAt) - timeOf(second.addedAt);
    return delta === 0 ? first.listingId.localeCompare(second.listingId) : delta;
  });
}

export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readCart(storage: StorageLike | null): CartStorageResult {
  if (!storage) return { lines: [], issue: "UNAVAILABLE", discarded: 0 };

  let raw: string | null;
  try {
    raw = storage.getItem(CART_STORAGE_KEY);
  } catch {
    return { lines: [], issue: "UNAVAILABLE", discarded: 0 };
  }
  if (raw === null) return { lines: [], issue: null, discarded: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { lines: [], issue: "CORRUPTED", discarded: 0 };
  }
  if (!Array.isArray(parsed)) return { lines: [], issue: "CORRUPTED", discarded: 0 };

  const lines: StoredCartLine[] = [];
  let discarded = 0;
  for (const candidate of parsed) {
    const line = parseCartLine(candidate);
    if (!line || lines.some((existing) => existing.listingId === line.listingId)) {
      discarded += 1;
      continue;
    }
    lines.push(line);
  }

  return {
    lines: sortCartLines(lines),
    issue: discarded > 0 ? "PARTIAL" : null,
    discarded,
  };
}

/**
 * Grava o carrinho. Quando a cota do dispositivo estoura, remove as linhas mais
 * antigas até caber e devolve quantas saíram — a tela precisa poder dizer isso
 * em voz alta, em vez de perder item escolhido em silêncio.
 */
export function writeCart(storage: StorageLike | null, lines: readonly StoredCartLine[]): CartStorageResult {
  const ordered = sortCartLines(lines);
  if (!storage) return { lines: ordered, issue: "UNAVAILABLE", discarded: 0 };

  let candidate = ordered.slice(0, MAX_CART_LINES);

  for (;;) {
    const discarded = ordered.length - candidate.length;
    try {
      storage.setItem(CART_STORAGE_KEY, JSON.stringify(candidate));
      return { lines: candidate, issue: discarded > 0 ? "TRIMMED" : null, discarded };
    } catch (error: unknown) {
      if (!isQuotaError(error)) return { lines: ordered, issue: "UNAVAILABLE", discarded: 0 };
      if (candidate.length === 0) return { lines: ordered, issue: "QUOTA", discarded: ordered.length };
      const step = Math.max(1, Math.ceil(candidate.length / 4));
      candidate = candidate.slice(0, candidate.length - step);
    }
  }
}

export function clearCart(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Sem armazenamento não há o que limpar; a lista em memória já foi trocada.
  }
}

/** Soma inteira em unidades mínimas. `null` quando alguma parcela é inválida. */
export function addMinor(first: string, second: string): string | null {
  if (!isMinorUnits(first) || !isMinorUnits(second)) return null;
  return (BigInt(first) + BigInt(second)).toString();
}

/** Total da linha = preço unitário × quantidade, em BigInt. */
export function lineTotalMinor(line: Pick<CartMoneyLine, "unitPriceMinor" | "quantity">): string | null {
  if (!isMinorUnits(line.unitPriceMinor)) return null;
  const quantity = normalizeQuantity(line.quantity);
  if (quantity === null) return null;
  return (BigInt(line.unitPriceMinor) * BigInt(quantity)).toString();
}

/**
 * Agrupamento por vendedor — a espinha dorsal desta tela.
 * Cada `sellerAccountId` vira um grupo de checkout com subtotal próprio, porque
 * entrega, retenção, reembolso e disputa acompanham o pedido daquele vendedor.
 * Grupo com moedas diferentes fica sem subtotal (`null`): somar seria inventar
 * uma conversão que a plataforma não faz.
 */
export function groupBySeller<T extends CartMoneyLine>(lines: readonly T[]): CartSellerGroup<T>[] {
  const groups: CartSellerGroup<T>[] = [];
  const index = new Map<string, CartSellerGroup<T>>();

  for (const line of lines) {
    let group = index.get(line.sellerAccountId);
    if (!group) {
      group = {
        sellerAccountId: line.sellerAccountId,
        sellerDisplayName: null,
        currency: line.currency,
        mixedCurrency: false,
        itemCount: 0,
        subtotalMinor: "0",
        lines: [],
      };
      index.set(line.sellerAccountId, group);
      groups.push(group);
    }

    group.lines.push(line);
    group.itemCount += line.quantity;
    if (group.sellerDisplayName === null && typeof line.sellerDisplayName === "string") {
      group.sellerDisplayName = line.sellerDisplayName;
    }
    if (group.currency !== null && group.currency !== line.currency) {
      group.mixedCurrency = true;
      group.currency = null;
    }

    const total = lineTotalMinor(line);
    if (group.subtotalMinor === null || total === null || group.mixedCurrency) {
      group.subtotalMinor = null;
    } else {
      group.subtotalMinor = addMinor(group.subtotalMinor, total);
    }
  }

  return groups;
}

export function activeLines(lines: readonly StoredCartLine[]): StoredCartLine[] {
  return lines.filter((line) => line.savedForLater !== true);
}

export function savedLines(lines: readonly StoredCartLine[]): StoredCartLine[] {
  return lines.filter((line) => line.savedForLater === true);
}

/** Soma de unidades das linhas informadas. */
export function totalItemCount(lines: readonly StoredCartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function findCartLine(lines: readonly StoredCartLine[], listingId: string): StoredCartLine | null {
  return lines.find((line) => line.listingId === listingId) ?? null;
}

/**
 * Adiciona ou soma a quantidade de um item já presente. O teto por linha é
 * `MAX_LINE_QUANTITY`; ultrapassar não é erro silencioso, a quantidade para no
 * teto e quem chamou consegue comparar o que pediu com o que ficou.
 */
export function upsertCartLine(
  lines: readonly StoredCartLine[],
  line: StoredCartLine,
): StoredCartLine[] {
  const existing = findCartLine(lines, line.listingId);
  if (!existing) return sortCartLines([...lines, line]);
  const quantity = Math.min(existing.quantity + line.quantity, MAX_LINE_QUANTITY);
  return sortCartLines(lines.map((current) => (
    current.listingId === line.listingId
      ? { ...current, ...line, addedAt: existing.addedAt, quantity }
      : current
  )));
}

export function setLineQuantity(
  lines: readonly StoredCartLine[],
  listingId: string,
  quantity: number,
): StoredCartLine[] {
  const normalized = normalizeQuantity(quantity);
  if (normalized === null) return [...lines];
  return lines.map((line) => (line.listingId === listingId ? { ...line, quantity: normalized } : line));
}

/** Aceitar o preço vigente é gravar o preço vigente. Não há outro caminho. */
export function setLineUnitPrice(
  lines: readonly StoredCartLine[],
  listingId: string,
  unitPriceMinor: string,
  currency: string,
): StoredCartLine[] {
  if (!isMinorUnits(unitPriceMinor) || currencyCode(currency) === null) return [...lines];
  return lines.map((line) => (
    line.listingId === listingId ? { ...line, unitPriceMinor, currency } : line
  ));
}

export function setLineSavedForLater(
  lines: readonly StoredCartLine[],
  listingId: string,
  savedForLater: boolean,
): StoredCartLine[] {
  return lines.map((line) => {
    if (line.listingId !== listingId) return line;
    const { savedForLater: _current, ...rest } = line;
    return savedForLater ? { ...rest, savedForLater: true } : rest;
  });
}

export function removeCartLine(lines: readonly StoredCartLine[], listingId: string): StoredCartLine[] {
  return lines.filter((line) => line.listingId !== listingId);
}

export function removeCartLines(
  lines: readonly StoredCartLine[],
  listingIds: readonly string[],
): StoredCartLine[] {
  const removed = new Set(listingIds);
  return lines.filter((line) => !removed.has(line.listingId));
}

/**
 * Une o carrinho do dispositivo com o carrinho da conta ao entrar.
 * Regras (nenhum lado apaga o outro):
 * - o servidor é a fonte de título, vendedor, preço, moeda e `cartLineId`;
 * - a quantidade que fica é a maior das duas, porque as duas foram escolhidas
 *   pela mesma pessoa e reduzir seria descartar uma escolha em silêncio;
 * - `addedAt` mantém o registro mais antigo;
 * - `savedForLater` é marca do dispositivo e sobrevive ao merge.
 */
export function mergeCartLines(
  local: readonly StoredCartLine[],
  remote: readonly StoredCartLine[],
): StoredCartLine[] {
  const byListing = new Map<string, StoredCartLine>();
  for (const line of local) byListing.set(line.listingId, line);

  for (const line of remote) {
    const existing = byListing.get(line.listingId);
    if (!existing) {
      byListing.set(line.listingId, line);
      continue;
    }
    const quantity = Math.min(Math.max(existing.quantity, line.quantity), MAX_LINE_QUANTITY);
    byListing.set(line.listingId, {
      ...line,
      quantity,
      addedAt: timeOf(existing.addedAt) <= timeOf(line.addedAt) ? existing.addedAt : line.addedAt,
      ...(existing.savedForLater === true ? { savedForLater: true } : {}),
    });
  }

  return sortCartLines([...byListing.values()]);
}

/** Corpo de `POST /v1/me/cart/merge`: só id do anúncio e quantidade. */
export function toMergePayload(lines: readonly StoredCartLine[]): { lines: CartMergeLine[] } {
  return {
    lines: lines.map((line) => ({ listingId: line.listingId, quantity: line.quantity })),
  };
}

/**
 * Lê o carrinho publicado por `GET /v1/me/cart`.
 * Aceita a projeção `CartView` do módulo `@midas/orders` (campos `lines[]` com
 * `listing`/`catalogItem` aninhados) e devolve as linhas que passaram na
 * validação. Dinheiro precisa chegar como string de unidades mínimas: número
 * de ponto flutuante é recusado em vez de convertido.
 */
export function parseServerCart(payload: unknown): CartStorageResult {
  const envelope = isRecord(payload) ? payload.data ?? payload : null;
  if (!isRecord(envelope) || !Array.isArray(envelope.lines)) {
    return { lines: [], issue: "CORRUPTED", discarded: 0 };
  }

  const lines: StoredCartLine[] = [];
  let discarded = 0;
  for (const candidate of envelope.lines) {
    if (!isRecord(candidate)) {
      discarded += 1;
      continue;
    }
    const listing = isRecord(candidate.listing) ? candidate.listing : {};
    const catalogItem = isRecord(candidate.catalogItem) ? candidate.catalogItem : {};
    const line = parseCartLine({
      listingId: candidate.listingId,
      publicSlug: listing.publicSlug,
      title: catalogItem.displayName,
      sellerAccountId: candidate.sellerAccountId,
      sellerDisplayName: candidate.sellerDisplayName,
      unitPriceMinor: candidate.unitPriceMinor,
      currency: candidate.currency,
      quantity: candidate.quantity,
      addedAt: candidate.addedAt,
      cartLineId: candidate.cartLineId,
    });
    if (!line || lines.some((existing) => existing.listingId === line.listingId)) {
      discarded += 1;
      continue;
    }
    lines.push(line);
  }

  return {
    lines: sortCartLines(lines),
    issue: discarded > 0 ? "PARTIAL" : null,
    discarded,
  };
}
