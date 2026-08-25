// Watchlist local (SCR-ACC-009).
//
// Módulo puro: sem React, sem DOM implícito, sem rede. Guarda apenas o que o
// visitante realmente viu numa resposta da API pública (id, slug, título e o
// preço publicado no momento em que salvou). Nada aqui inventa registro,
// disponibilidade, contagem ou consentimento.
//
// Regra de consentimento (política de persuasão): um opt-in só existe se tiver
// carimbo de tempo e versão de política. Registro sem carimbo é descartado na
// leitura — nunca é ressuscitado como consentimento válido.

export const FAVORITES_STORAGE_KEY = "midas.favoritos.v1";
export const WATCH_POLICY_VERSION = "watchlist-optin-2026-08";
export const MAX_STORED_FAVORITES = 200;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type WatchChannel = "PRICE_DROP" | "BACK_IN_STOCK";

export interface WatchOptIn {
  channel: WatchChannel;
  /** Momento exato em que a pessoa marcou o aviso. Sem isto não há opt-in. */
  optedInAt: string;
  /** Versão da política vigente quando o aviso foi aceito. */
  policyVersion: string;
  /** Alvo opcional de queda de preço, em unidades mínimas. */
  targetPriceMinor?: string;
}

export interface StoredFavorite {
  listingId: string;
  publicSlug: string;
  title: string;
  /** Preço publicado no instante em que a pessoa salvou, em unidades mínimas. */
  savedPriceMinor: string;
  currency: string;
  savedAt: string;
  watch: WatchOptIn[];
}

export type StorageIssue =
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

export interface FavoritesReadResult {
  entries: StoredFavorite[];
  issue: StorageIssue | null;
  discarded: number;
}

export interface FavoritesWriteResult {
  /** O que ficou de fato em memória e, quando possível, no dispositivo. */
  entries: StoredFavorite[];
  issue: StorageIssue | null;
  discarded: number;
}

export type TargetPriceParse =
  | { ok: true; amountMinor: string | null }
  | { ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function minorUnits(value: unknown): string | null {
  return typeof value === "string" && /^\d{1,18}$/u.test(value) ? value : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function currencyCode(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z]{3}$/u.test(value) ? value : null;
}

function timeOf(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Nomes usados pelos navegadores quando a cota de armazenamento estoura. */
const QUOTA_ERROR_NAMES = new Set([
  "QuotaExceededError",
  "NS_ERROR_DOM_QUOTA_REACHED",
  "QUOTA_EXCEEDED_ERR",
]);

function isQuotaError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return QUOTA_ERROR_NAMES.has(error.name);
  }
  if (error instanceof Error) {
    return QUOTA_ERROR_NAMES.has(error.name) || /quota|exceeded/iu.test(error.message);
  }
  return false;
}

export function parseWatchOptIn(value: unknown): WatchOptIn | null {
  if (!isRecord(value)) return null;
  const channel = value.channel;
  if (channel !== "PRICE_DROP" && channel !== "BACK_IN_STOCK") return null;
  const optedInAt = isoTimestamp(value.optedInAt);
  const policyVersion = nonEmptyString(value.policyVersion);
  if (!optedInAt || !policyVersion) return null;
  const target = channel === "PRICE_DROP" ? minorUnits(value.targetPriceMinor) : null;
  return {
    channel,
    optedInAt,
    policyVersion,
    ...(target === null ? {} : { targetPriceMinor: target }),
  };
}

/**
 * Valida uma entrada vinda do dispositivo OU do servidor. Campo faltando ou
 * fora do formato descarta a entrada inteira em vez de completar com suposição.
 */
export function parseFavorite(value: unknown): StoredFavorite | null {
  if (!isRecord(value)) return null;
  const listingId = nonEmptyString(value.listingId);
  const publicSlug = nonEmptyString(value.publicSlug);
  const title = nonEmptyString(value.title);
  const savedPriceMinor = minorUnits(value.savedPriceMinor);
  const currency = currencyCode(value.currency);
  const savedAt = isoTimestamp(value.savedAt);
  if (!listingId || !publicSlug || !title || !savedPriceMinor || !currency || !savedAt) return null;

  const watch: WatchOptIn[] = [];
  if (Array.isArray(value.watch)) {
    for (const candidate of value.watch) {
      const optIn = parseWatchOptIn(candidate);
      if (!optIn) continue;
      if (watch.some((existing) => existing.channel === optIn.channel)) continue;
      watch.push(optIn);
    }
  }

  return { listingId, publicSlug, title, savedPriceMinor, currency, savedAt, watch };
}

export function sortFavorites(entries: StoredFavorite[]): StoredFavorite[] {
  return [...entries].sort((first, second) => timeOf(second.savedAt) - timeOf(first.savedAt));
}

export function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readFavorites(storage: StorageLike | null): FavoritesReadResult {
  if (!storage) return { entries: [], issue: "UNAVAILABLE", discarded: 0 };

  let raw: string | null;
  try {
    raw = storage.getItem(FAVORITES_STORAGE_KEY);
  } catch {
    return { entries: [], issue: "UNAVAILABLE", discarded: 0 };
  }
  if (raw === null) return { entries: [], issue: null, discarded: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { entries: [], issue: "CORRUPTED", discarded: 0 };
  }
  if (!Array.isArray(parsed)) return { entries: [], issue: "CORRUPTED", discarded: 0 };

  const entries: StoredFavorite[] = [];
  let discarded = 0;
  for (const candidate of parsed) {
    const favorite = parseFavorite(candidate);
    if (!favorite || entries.some((existing) => existing.listingId === favorite.listingId)) {
      discarded += 1;
      continue;
    }
    entries.push(favorite);
  }

  return {
    entries: sortFavorites(entries),
    issue: discarded > 0 ? "PARTIAL" : null,
    discarded,
  };
}

/**
 * Grava a lista. Quando a cota do dispositivo estoura, remove as entradas mais
 * antigas até caber e devolve quantas saíram — a tela precisa poder dizer isso
 * em voz alta, em vez de perder favoritos em silêncio.
 */
export function writeFavorites(
  storage: StorageLike | null,
  entries: StoredFavorite[],
): FavoritesWriteResult {
  const ordered = sortFavorites(entries);
  if (!storage) return { entries: ordered, issue: "UNAVAILABLE", discarded: 0 };

  let candidate = ordered.slice(0, MAX_STORED_FAVORITES);

  for (;;) {
    const discarded = ordered.length - candidate.length;
    try {
      storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(candidate));
      return { entries: candidate, issue: discarded > 0 ? "TRIMMED" : null, discarded };
    } catch (error: unknown) {
      if (!isQuotaError(error)) return { entries: ordered, issue: "UNAVAILABLE", discarded: 0 };
      if (candidate.length === 0) {
        return { entries: ordered, issue: "QUOTA", discarded: ordered.length };
      }
      const step = Math.max(1, Math.ceil(candidate.length / 4));
      candidate = candidate.slice(0, candidate.length - step);
    }
  }
}

function mergeWatch(local: WatchOptIn[], remote: WatchOptIn[]): WatchOptIn[] {
  const byChannel = new Map<WatchChannel, WatchOptIn>();
  for (const optIn of [...local, ...remote]) {
    const current = byChannel.get(optIn.channel);
    if (!current || timeOf(optIn.optedInAt) > timeOf(current.optedInAt)) {
      byChannel.set(optIn.channel, optIn);
    }
  }
  return [...byChannel.values()];
}

function mergeEntry(local: StoredFavorite, remote: StoredFavorite): StoredFavorite {
  return {
    listingId: remote.listingId,
    publicSlug: remote.publicSlug,
    title: remote.title,
    savedPriceMinor: remote.savedPriceMinor,
    currency: remote.currency,
    // A pessoa salvou primeiro em algum lugar: preserva o registro mais antigo.
    savedAt: timeOf(local.savedAt) <= timeOf(remote.savedAt) ? local.savedAt : remote.savedAt,
    // Última escolha explícita por canal vence. Merge nunca cria opt-in novo.
    watch: mergeWatch(local.watch, remote.watch),
  };
}

/**
 * Une a lista do dispositivo com a lista da conta ao entrar. O servidor é a
 * fonte para título e preço salvos; o dispositivo contribui com o que ainda não
 * subiu. Nenhum lado apaga o outro.
 */
export function mergeFavorites(local: StoredFavorite[], remote: StoredFavorite[]): StoredFavorite[] {
  const byId = new Map<string, StoredFavorite>();
  for (const entry of local) byId.set(entry.listingId, entry);
  for (const entry of remote) {
    const existing = byId.get(entry.listingId);
    byId.set(entry.listingId, existing ? mergeEntry(existing, entry) : entry);
  }
  return sortFavorites([...byId.values()]);
}

export function upsertFavorite(entries: StoredFavorite[], entry: StoredFavorite): StoredFavorite[] {
  const others = entries.filter((existing) => existing.listingId !== entry.listingId);
  return sortFavorites([entry, ...others]);
}

export function removeFavorite(entries: StoredFavorite[], listingId: string): StoredFavorite[] {
  return entries.filter((entry) => entry.listingId !== listingId);
}

export function findOptIn(entry: StoredFavorite, channel: WatchChannel): WatchOptIn | null {
  return entry.watch.find((optIn) => optIn.channel === channel) ?? null;
}

/** O que outra superfície precisa informar para salvar um favorito. */
export interface FavoriteDraft {
  listingId: string;
  publicSlug: string;
  title: string;
  /** Preço publicado lido na resposta da API no instante do clique. */
  savedPriceMinor: string;
  currency: string;
  savedAt: string;
}

/**
 * Entrada de uma chamada só para qualquer tela que ofereça "favoritar" — hoje a
 * página do anúncio (docs/coordenacao/WIRING-favoritos.md). Lê o dispositivo,
 * insere e regrava, tratando cota e conteúdo corrompido no caminho.
 *
 * Salvar de novo um item já salvo é no-op deliberado: manteria o preço e a data
 * de referência coerentes entre si e, principalmente, favoritar NUNCA pode
 * ligar nem regravar um opt-in de aviso por efeito colateral.
 */
export function saveFavoriteToDevice(
  storage: StorageLike | null,
  draft: FavoriteDraft,
): FavoritesWriteResult {
  const current = readFavorites(storage);
  const parsed = parseFavorite({ ...draft, watch: [] });
  if (!parsed) return { entries: current.entries, issue: "CORRUPTED", discarded: 0 };
  if (current.entries.some((entry) => entry.listingId === parsed.listingId)) {
    return { entries: current.entries, issue: current.issue, discarded: current.discarded };
  }
  return writeFavorites(storage, upsertFavorite(current.entries, parsed));
}

/** Contraparte de `saveFavoriteToDevice`, também em uma chamada só. */
export function removeFavoriteFromDevice(
  storage: StorageLike | null,
  listingId: string,
): FavoritesWriteResult {
  return writeFavorites(storage, removeFavorite(readFavorites(storage).entries, listingId));
}

/** Consulta usada pela superfície de origem para desenhar o toggle. */
export function isFavoriteOnDevice(storage: StorageLike | null, listingId: string): boolean {
  return readFavorites(storage).entries.some((entry) => entry.listingId === listingId);
}

export function setWatchOptIn(
  entries: StoredFavorite[],
  listingId: string,
  channel: WatchChannel,
  options: { optedInAt: string; policyVersion?: string; targetPriceMinor?: string | null },
): StoredFavorite[] {
  const target = channel === "PRICE_DROP" ? (options.targetPriceMinor ?? null) : null;
  const optIn: WatchOptIn = {
    channel,
    optedInAt: options.optedInAt,
    policyVersion: options.policyVersion ?? WATCH_POLICY_VERSION,
    ...(target === null ? {} : { targetPriceMinor: target }),
  };
  return entries.map((entry) => (
    entry.listingId === listingId
      ? { ...entry, watch: [...entry.watch.filter((item) => item.channel !== channel), optIn] }
      : entry
  ));
}

export function clearWatchOptIn(
  entries: StoredFavorite[],
  listingId: string,
  channel: WatchChannel,
): StoredFavorite[] {
  return entries.map((entry) => (
    entry.listingId === listingId
      ? { ...entry, watch: entry.watch.filter((item) => item.channel !== channel) }
      : entry
  ));
}

/**
 * Converte o alvo de preço digitado em unidades mínimas, sem passar por Number.
 * Entrada vazia é válida e significa "qualquer queda"; entrada malformada é
 * rejeitada para que a tela peça correção em vez de adivinhar um valor.
 */
const DIGITS = /^\d+$/u;
/** Milhar em pt-BR: 1.234 · 1.234.567 — nunca 1.2.3. */
const GROUPED_THOUSANDS = /^\d{1,3}(?:\.\d{3})+$/u;

function splitDecimal(value: string): { integer: string; fraction: string } | null {
  const dot = value.indexOf(".");
  if (dot < 0) return DIGITS.test(value) ? { integer: value, fraction: "" } : null;
  const integer = value.slice(0, dot);
  const fraction = value.slice(dot + 1);
  if (!DIGITS.test(integer) || !DIGITS.test(fraction)) return null;
  return { integer, fraction };
}

export function parseTargetPriceMinor(input: string, fractionDigits = 2): TargetPriceParse {
  const cleaned = input.trim().replace(/\s/gu, "");
  if (cleaned === "") return { ok: true, amountMinor: null };
  if (!/^\d[\d.,]*$/u.test(cleaned)) return { ok: false };

  let normalized: string;
  if (cleaned.includes(",")) {
    const comma = cleaned.indexOf(",");
    if (comma !== cleaned.lastIndexOf(",")) return { ok: false };
    const head = cleaned.slice(0, comma);
    const tail = cleaned.slice(comma + 1);
    if (!DIGITS.test(head) && !GROUPED_THOUSANDS.test(head)) return { ok: false };
    if (!DIGITS.test(tail)) return { ok: false };
    normalized = `${head.replaceAll(".", "")}.${tail}`;
  } else if (cleaned.includes(".")) {
    const lastDot = cleaned.lastIndexOf(".");
    const tail = cleaned.slice(lastDot + 1);
    // Ponto único com poucas casas = separador decimal; caso contrário, milhar.
    if (cleaned.indexOf(".") === lastDot && tail.length > 0 && tail.length <= fractionDigits) {
      normalized = cleaned;
    } else if (GROUPED_THOUSANDS.test(cleaned)) {
      normalized = cleaned.replaceAll(".", "");
    } else {
      return { ok: false };
    }
  } else {
    normalized = cleaned;
  }

  const parts = splitDecimal(normalized);
  if (!parts || parts.fraction.length > fractionDigits) return { ok: false };
  const amountMinor = `${parts.integer}${parts.fraction.padEnd(fractionDigits, "0")}`
    .replace(/^0+(?=\d)/u, "");
  return { ok: true, amountMinor };
}
