// Sincronização do "guardar para depois" com o carrinho salvo da conta
// (módulo de retenção).
//
// Contrato real, conferido em apps/api/src/retention-routes.ts:
//   GET  /v1/me/saved-cart         → { savedCart: SavedCart | null, asOf }
//   POST /v1/me/saved-cart         → SavedCart   (corpo: { cartId, snapshot })
//   POST /v1/me/saved-cart/recover → SavedCart
//
// O servidor valida o corpo com zod e DESCARTA campos extras do snapshot: o
// que sobrevive por item é exatamente { listingId, quantity, unitPriceMinor,
// currency }. Título, slug e vendedor NÃO existem no snapshot da conta, então
// a restauração daqui nunca inventa linha nova — ela apenas religa a marca
// `savedForLater` em linhas já presentes, casadas por listingId (nunca
// duplicando), e conta em voz alta o que não pôde ser exibido.
//
// Dinheiro segue a regra do carrinho: string em unidades mínimas e toda
// aritmética via BigInt. Nenhum valor monetário passa por Number.

import {
  isMinorUnits,
  normalizeQuantity,
  type StorageLike,
  type StoredCartLine,
} from "./cart-storage";

export const SAVED_CART_PATH = "/v1/me/saved-cart";
export const SAVED_CART_RECOVER_PATH = "/v1/me/saved-cart/recover";

/** Chave do uuid que identifica este carrinho como origem (`sourceCartId`). */
export const CART_SOURCE_ID_KEY = "midas.carrinho.v1.origem";

/** Teto do contrato: `savedCartSnapshotSchema.items.max(100)`. */
export const MAX_SNAPSHOT_ITEMS = 100;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function currencyCode(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z]{3}$/u.test(value) ? value : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

// ------------------------------------------------------------------ envio

/** Item exatamente como `savedCartSnapshotSchema.items` aceita. */
export interface SavedCartSnapshotItem {
  listingId: string;
  quantity: number;
  unitPriceMinor: string;
  currency: string;
}

/** Corpo exato de `POST /v1/me/saved-cart`. */
export interface SavedCartPayload {
  cartId: string;
  snapshot: {
    currency: string;
    subtotalMinor: string;
    items: SavedCartSnapshotItem[];
  };
}

export type SavedCartPayloadIssue =
  /** Nenhum item guardado — o contrato exige ao menos um. */
  | "EMPTY"
  /** Moedas misturadas — o contrato exige uma única moeda por snapshot. */
  | "MIXED_CURRENCY"
  /** Alguma linha está fora do formato (id não-uuid, preço ou quantidade). */
  | "INVALID_LINE"
  /** O identificador do carrinho de origem não é um uuid. */
  | "INVALID_CART_ID"
  /** Mais itens do que o contrato aceita. */
  | "TOO_MANY_ITEMS";

export type SavedCartPayloadResult =
  | { payload: SavedCartPayload; issue: null }
  | { payload: null; issue: SavedCartPayloadIssue };

/**
 * Monta o corpo de `POST /v1/me/saved-cart` a partir das linhas guardadas.
 * O subtotal é a soma BigInt dos itens — o servidor confere e recusa total
 * que não fecha. Linha duplicada por `listingId` entra uma única vez.
 * Qualquer estado não representável no contrato devolve o motivo em vez de
 * enviar um corpo que a API recusaria ou, pior, um corpo adivinhado.
 */
export function toSavedCartPayload(
  cartId: string,
  lines: readonly StoredCartLine[],
): SavedCartPayloadResult {
  if (!isUuid(cartId)) return { payload: null, issue: "INVALID_CART_ID" };

  const items: SavedCartSnapshotItem[] = [];
  const seen = new Set<string>();
  let currency: string | null = null;
  let subtotal = 0n;

  for (const line of lines) {
    if (seen.has(line.listingId)) continue;
    seen.add(line.listingId);

    const quantity = normalizeQuantity(line.quantity);
    if (!isUuid(line.listingId) || quantity === null || !isMinorUnits(line.unitPriceMinor)) {
      return { payload: null, issue: "INVALID_LINE" };
    }
    if (currency === null) currency = line.currency;
    if (line.currency !== currency) return { payload: null, issue: "MIXED_CURRENCY" };

    subtotal += BigInt(line.unitPriceMinor) * BigInt(quantity);
    items.push({
      listingId: line.listingId,
      quantity,
      unitPriceMinor: line.unitPriceMinor,
      currency: line.currency,
    });
  }

  if (items.length === 0 || currency === null) return { payload: null, issue: "EMPTY" };
  if (items.length > MAX_SNAPSHOT_ITEMS) return { payload: null, issue: "TOO_MANY_ITEMS" };

  return {
    payload: { cartId, snapshot: { currency, subtotalMinor: subtotal.toString(), items } },
    issue: null,
  };
}

// ---------------------------------------------------------------- leitura

export interface ParsedSavedCart {
  savedCartId: string;
  cartId: string;
  status: string;
  itemCount: number;
  subtotalMinor: string;
  currency: string;
  savedAt: string;
  /** Validade real do snapshot, vinda do servidor. */
  expiresAt: string;
  items: SavedCartSnapshotItem[];
  /** Itens do snapshot que chegaram fora do formato e foram descartados. */
  discardedItems: number;
}

export type SavedCartEnvelopeResult =
  | { savedCart: ParsedSavedCart | null; issue: null }
  | { savedCart: null; issue: "CORRUPTED" };

function parseSnapshotItem(value: unknown): SavedCartSnapshotItem | null {
  if (!isRecord(value)) return null;
  const quantity = normalizeQuantity(value.quantity);
  const currency = currencyCode(value.currency);
  const listingId =
    typeof value.listingId === "string" && value.listingId.trim() !== "" ? value.listingId : null;
  if (listingId === null || quantity === null || currency === null) return null;
  if (!isMinorUnits(value.unitPriceMinor)) return null;
  return { listingId, quantity, unitPriceMinor: value.unitPriceMinor, currency };
}

/**
 * Lê um `SavedCart` serializado (resposta de POST e de recover, ou o campo
 * `savedCart` do envelope de GET). Campo obrigatório fora do formato devolve
 * `null` — fail-closed, nada é completado por suposição. Item de snapshot
 * inválido é descartado e contado, nunca convertido.
 */
export function parseSavedCartRecord(value: unknown): ParsedSavedCart | null {
  if (!isRecord(value)) return null;
  const savedCartId =
    typeof value.savedCartId === "string" && value.savedCartId.trim() !== ""
      ? value.savedCartId
      : null;
  const cartId = typeof value.cartId === "string" && value.cartId.trim() !== "" ? value.cartId : null;
  const status = typeof value.status === "string" && value.status.trim() !== "" ? value.status : null;
  const currency = currencyCode(value.currency);
  const savedAt = isoTimestamp(value.savedAt);
  const expiresAt = isoTimestamp(value.expiresAt);
  const itemCount =
    typeof value.itemCount === "number" && Number.isSafeInteger(value.itemCount) && value.itemCount >= 0
      ? value.itemCount
      : null;
  if (!savedCartId || !cartId || !status || !currency || !savedAt || !expiresAt) return null;
  if (itemCount === null || !isMinorUnits(value.subtotalMinor)) return null;

  const snapshot = isRecord(value.snapshot) ? value.snapshot : null;
  if (!snapshot || !Array.isArray(snapshot.items)) return null;

  const items: SavedCartSnapshotItem[] = [];
  let discardedItems = 0;
  for (const candidate of snapshot.items) {
    const item = parseSnapshotItem(candidate);
    if (!item || items.some((existing) => existing.listingId === item.listingId)) {
      discardedItems += 1;
      continue;
    }
    items.push(item);
  }

  return {
    savedCartId,
    cartId,
    status,
    itemCount,
    subtotalMinor: value.subtotalMinor,
    currency,
    savedAt,
    expiresAt,
    items,
    discardedItems,
  };
}

/**
 * Lê o envelope de `GET /v1/me/saved-cart`. `savedCart: null` é estado
 * honesto (a pessoa não tem carrinho salvo), nunca erro. Resposta fora do
 * contrato é CORRUPTED — nada é restaurado a partir dela.
 */
export function parseSavedCartEnvelope(payload: unknown): SavedCartEnvelopeResult {
  if (!isRecord(payload) || !("savedCart" in payload)) return { savedCart: null, issue: "CORRUPTED" };
  if (payload.savedCart === null) return { savedCart: null, issue: null };
  const savedCart = parseSavedCartRecord(payload.savedCart);
  if (savedCart === null) return { savedCart: null, issue: "CORRUPTED" };
  return { savedCart, issue: null };
}

// ------------------------------------------------------------ restauração

export interface SavedCartRestoreResult {
  lines: StoredCartLine[];
  /** Linhas que ganharam a marca "guardado para depois" agora. */
  restored: number;
  /** Itens do snapshot que já estavam guardados aqui — nada a fazer. */
  alreadySaved: number;
  /** Itens do snapshot sem linha correspondente neste carrinho. */
  missing: number;
}

/**
 * Aplica o snapshot da conta sobre as linhas locais, casando por `listingId`.
 * Nunca cria linha (o snapshot não carrega título/slug/vendedor), nunca
 * duplica, nunca altera quantidade nem preço — preço vigente continua vindo
 * da revalidação do catálogo, porque o snapshot não é fonte de verdade de
 * preço. Item sem linha local é contado em `missing` para a tela dizer isso.
 */
export function applySavedCartSnapshot(
  lines: readonly StoredCartLine[],
  items: readonly SavedCartSnapshotItem[],
): SavedCartRestoreResult {
  const byListing = new Map(lines.map((line) => [line.listingId, line]));
  const toMark = new Set<string>();
  const seen = new Set<string>();
  let restored = 0;
  let alreadySaved = 0;
  let missing = 0;

  for (const item of items) {
    if (seen.has(item.listingId)) continue;
    seen.add(item.listingId);
    const line = byListing.get(item.listingId);
    if (line === undefined) {
      missing += 1;
      continue;
    }
    if (line.savedForLater === true) {
      alreadySaved += 1;
      continue;
    }
    toMark.add(item.listingId);
    restored += 1;
  }

  if (toMark.size === 0) return { lines: [...lines], restored, alreadySaved, missing };
  return {
    lines: lines.map((line) => (toMark.has(line.listingId) ? { ...line, savedForLater: true } : line)),
    restored,
    alreadySaved,
    missing,
  };
}

// ------------------------------------------------------- origem do carrinho

/** Lê o `cartId` publicado por `GET /v1/me/cart`, quando veio no contrato. */
export function serverCartIdOf(payload: unknown): string | null {
  const envelope = isRecord(payload) ? payload.data ?? payload : null;
  return isRecord(envelope) && isUuid(envelope.cartId) ? envelope.cartId : null;
}

/**
 * Identificador estável deste carrinho como origem do snapshot. O módulo de
 * retenção trata `sourceCartId` como uuid simples, sem FK — salvar de novo
 * com a mesma origem atualiza o snapshot em vez de duplicar. Prefere o
 * `cartId` da conta quando ele existe; sem ele, gera e fixa um uuid do
 * dispositivo. Sem `crypto.randomUUID` ou sem armazenamento devolve `null`:
 * a tela diz que não há como identificar a origem, nunca inventa formato.
 */
export function resolveCartSourceId(
  storage: StorageLike | null,
  serverCartId: string | null,
): string | null {
  if (isUuid(serverCartId)) return serverCartId;
  if (!storage) return null;
  try {
    const existing = storage.getItem(CART_SOURCE_ID_KEY);
    if (isUuid(existing)) return existing;
    const cryptoApi = typeof globalThis.crypto === "undefined" ? null : globalThis.crypto;
    if (!cryptoApi || typeof cryptoApi.randomUUID !== "function") return null;
    const generated = cryptoApi.randomUUID();
    storage.setItem(CART_SOURCE_ID_KEY, generated);
    return generated;
  } catch {
    return null;
  }
}
