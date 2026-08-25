"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleSlash,
  CloudOff,
  RefreshCw,
  Tag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button, Freshness, PageState, Panel, StatusBadge, type StatusTone } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceLoading } from "@/components/resource-state";
import { formatMinorCurrency, formatQuantity } from "@/components/marketplace/formatters";
import type { PublicListing } from "@/components/marketplace/types";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date-format";
import {
  browserStorage,
  clearWatchOptIn,
  findOptIn,
  readFavorites,
  removeFavorite,
  setWatchOptIn,
  writeFavorites,
  type StoredFavorite,
  type StorageIssue,
  type WatchChannel,
} from "./favorites-storage";
import { WatchToggle, type WatchSyncMode } from "./watch-toggle";
import styles from "./favorites.module.css";

const WATCHLIST_PATH = "/v1/me/watchlist";

interface WatchlistResponse {
  data?: unknown;
  asOf?: unknown;
}

/**
 * Entrada de vigilância como `GET /v1/me/watchlist` devolve DE VERDADE
 * (apps/api/src/retention-routes.ts, `watchlistEntrySchema`): a conta guarda
 * AVISOS por (anúncio, tipo), identificados por `watchlistEntryId` — não uma
 * lista de favoritos. Título, slug e preço salvos são registro do dispositivo;
 * a API não os devolve, então nenhum favorito local nasce da conta.
 */
interface AccountWatchEntry {
  watchlistEntryId: string;
  listingId: string;
  channel: WatchChannel;
  /** `WATCHLIST_STATUSES` do módulo: ACTIVE | TRIGGERED | CANCELLED. */
  status: string;
}

type ListingCheck =
  | { status: "CHECKING" }
  | { status: "FOUND"; listing: PublicListing }
  | { status: "GONE" }
  | { status: "FAILED"; message: string };

/*
 * A watchlist real não afirma estado de anúncio (pausado x removido): ela devolve
 * apenas os avisos da pessoa. Sem essa projeção, "sumiu do catálogo público" é o
 * máximo que dá para dizer com honestidade — e é o que o estado abaixo diz.
 */
type FavoriteState =
  | "DISPONIVEL"
  | "PRECO_MUDOU"
  | "SEM_ESTOQUE"
  | "FORA_DO_CATALOGO"
  | "NAO_VERIFICADO"
  | "VERIFICANDO";

interface GroupDescriptor {
  label: string;
  tone: StatusTone;
  /** Uma frase explicando o estado — obrigatória, o rótulo nunca fica sozinho. */
  explanation: string;
  /**
   * Rótulo da ação principal deste estado. Cada estado tem a sua: o que fazer
   * com um item disponível não é o que fazer com um que o vendedor removeu.
   * `null` = não há ação principal honesta enquanto a verificação não termina.
   */
  action: string | null;
}

/** Ordem de leitura: o que dá para usar primeiro, o que acabou por último. */
const GROUP_ORDER: FavoriteState[] = [
  "DISPONIVEL",
  "PRECO_MUDOU",
  "SEM_ESTOQUE",
  "FORA_DO_CATALOGO",
  "NAO_VERIFICADO",
  "VERIFICANDO",
];

const GROUPS: Record<FavoriteState, GroupDescriptor> = {
  DISPONIVEL: {
    label: "Disponível",
    tone: "success",
    explanation: "Publicado, com estoque e pelo mesmo preço que você salvou.",
    action: "Abrir anúncio",
  },
  PRECO_MUDOU: {
    label: "Preço mudou",
    tone: "info",
    explanation: "Continua publicado, mas o preço de hoje é diferente do preço registrado quando você salvou.",
    action: "Conferir o preço atual",
  },
  SEM_ESTOQUE: {
    label: "Sem estoque",
    tone: "warning",
    explanation: "Continua publicado, porém o vendedor está com zero unidade disponível agora.",
    action: "Abrir anúncio esgotado",
  },
  FORA_DO_CATALOGO: {
    label: "Fora do catálogo público",
    tone: "warning",
    explanation: "O anúncio deixou de responder no catálogo público e esta tela não consegue distinguir pausa de remoção definitiva — nenhuma das duas é presumida.",
    action: "Procurar no catálogo público",
  },
  NAO_VERIFICADO: {
    label: "Não verificado",
    tone: "neutral",
    explanation: "A verificação falhou nesta sessão. O item continua salvo e nada foi presumido sobre preço ou estoque.",
    action: "Verificar de novo",
  },
  VERIFICANDO: {
    label: "Verificando",
    tone: "neutral",
    explanation: "Consultando o catálogo público para descobrir o estado atual de cada item salvo.",
    action: null,
  },
};

const STORAGE_ISSUE_COPY: Record<StorageIssue, string> = {
  UNAVAILABLE: "Este navegador não permitiu gravar dados locais. Sua lista funciona nesta aba, mas não sobrevive a um recarregamento.",
  CORRUPTED: "O conteúdo salvo neste dispositivo estava ilegível e foi descartado em vez de ser interpretado por adivinhação.",
  PARTIAL: "Parte do conteúdo salvo neste dispositivo estava fora do formato e foi descartada. O que estava íntegro continua na lista.",
  QUOTA: "O armazenamento deste dispositivo está cheio e nada pôde ser gravado. A lista vale apenas para esta sessão.",
  TRIMMED: "O armazenamento deste dispositivo está cheio. Os favoritos mais antigos saíram para caber os mais recentes.",
};

function isMinorUnits(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,18}$/u.test(value);
}

/**
 * Aceita só o que dá para conferir contra `watchlistEntrySchema`. `ANY_OFFER`
 * existe na API mas não tem canal local correspondente — a entrada é ignorada
 * aqui em vez de virar um canal inventado.
 */
function parseAccountWatchEntry(raw: unknown): AccountWatchEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const watchlistEntryId = typeof record.watchlistEntryId === "string" && record.watchlistEntryId !== ""
    ? record.watchlistEntryId
    : null;
  const listingId = typeof record.listingId === "string" && record.listingId !== "" ? record.listingId : null;
  const channel = record.kind === "PRICE_DROP" || record.kind === "BACK_IN_STOCK" ? record.kind : null;
  const status = typeof record.status === "string" && record.status !== "" ? record.status : null;
  if (!watchlistEntryId || !listingId || !channel || !status) return null;
  return { watchlistEntryId, listingId, channel, status };
}

/** Chave de deduplicação da conta: a API upserta por (anúncio, tipo). */
function accountEntryKey(listingId: string, channel: WatchChannel): string {
  return `${listingId}:${channel}`;
}

/** -1 caiu · 0 igual · 1 subiu · null incomparável (moeda diferente ou valor inválido). */
function comparePrice(entry: StoredFavorite, listing: PublicListing): -1 | 0 | 1 | null {
  if (listing.currency !== entry.currency || !isMinorUnits(listing.priceMinor)) return null;
  const saved = BigInt(entry.savedPriceMinor);
  const current = BigInt(listing.priceMinor);
  if (saved === current) return 0;
  return current < saved ? -1 : 1;
}

function resolveState(
  entry: StoredFavorite,
  check: ListingCheck | undefined,
): FavoriteState {
  if (!check || check.status === "CHECKING") return "VERIFICANDO";
  if (check.status === "FAILED") return "NAO_VERIFICADO";
  if (check.status === "GONE") return "FORA_DO_CATALOGO";
  if (check.listing.quantityAvailable <= 0) return "SEM_ESTOQUE";
  return comparePrice(entry, check.listing) === 0 ? "DISPONIVEL" : "PRECO_MUDOU";
}

/** Um aviso só é oferecido quando ainda pode acontecer de verdade. */
function channelsFor(state: FavoriteState, entry: StoredFavorite): WatchChannel[] {
  const enabled = entry.watch.map((optIn) => optIn.channel);
  const offered: WatchChannel[] = state === "DISPONIVEL" || state === "PRECO_MUDOU"
    ? ["PRICE_DROP"]
    : state === "SEM_ESTOQUE"
      ? ["BACK_IN_STOCK", "PRICE_DROP"]
      : state === "FORA_DO_CATALOGO"
        ? ["BACK_IN_STOCK"]
        : [];
  // Um opt-in já dado nunca fica sem botão de desligar, seja qual for o estado.
  for (const channel of enabled) {
    if (!offered.includes(channel)) offered.push(channel);
  }
  return offered;
}

const CHANNEL_NAMES: Record<WatchChannel, string> = {
  PRICE_DROP: "Aviso de queda de preço",
  BACK_IN_STOCK: "Aviso de volta ao estoque",
};

export function FavoritesView() {
  const [entries, setEntries] = useState<StoredFavorite[] | null>(null);
  const [storageIssue, setStorageIssue] = useState<{ issue: StorageIssue; discarded: number } | null>(null);
  const [checks, setChecks] = useState<ReadonlyMap<string, ListingCheck>>(new Map());
  const [announcement, setAnnouncement] = useState("");
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState(0);

  const checksRef = useRef<ReadonlyMap<string, ListingCheck>>(new Map());
  const mountedRef = useRef(true);
  /**
   * (listingId, canal) → watchlistEntryId. É o identificador que o DELETE da API
   * exige. Alimentado pela leitura da conta e pelas respostas 201 dos POSTs desta
   * sessão. Ausência de chave = a conta não tem esse aviso (nada a remover lá).
   */
  const accountEntryIdsRef = useRef<Map<string, string>>(new Map());
  const entriesRef = useRef<StoredFavorite[]>([]);
  entriesRef.current = entries ?? [];

  const watchlist = useApiResource<WatchlistResponse>(WATCHLIST_PATH);
  const accountSynced = watchlist.status === "ready";
  const syncMode: WatchSyncMode = accountSynced ? "ACCOUNT" : "DEVICE_ONLY";

  useEffect(() => () => { mountedRef.current = false; }, []);

  const applyStorageResult = useCallback((issue: StorageIssue | null, discarded: number) => {
    setStorageIssue(issue ? { issue, discarded } : null);
  }, []);

  const persist = useCallback((next: StoredFavorite[]): StoredFavorite[] => {
    const result = writeFavorites(browserStorage(), next);
    setEntries(result.entries);
    applyStorageResult(result.issue, result.discarded);
    return result.entries;
  }, [applyStorageResult]);

  useEffect(() => {
    const result = readFavorites(browserStorage());
    setEntries(result.entries);
    applyStorageResult(result.issue, result.discarded);
  }, [applyStorageResult]);

  const updateCheck = useCallback((listingId: string, check: ListingCheck) => {
    if (!mountedRef.current) return;
    const next = new Map(checksRef.current);
    next.set(listingId, check);
    checksRef.current = next;
    setChecks(next);
  }, []);

  /*
   * Indexa os avisos que a conta já tem, pelo id que o DELETE exige. Entrada
   * CANCELLED não entra: não há nada para remover dela.
   *
   * PENDÊNCIA HONESTA: a resposta não traz `policyVersion` nem slug/título, então
   * um aviso ligado em OUTRO dispositivo não é importado como opt-in local (não
   * há evidência de política para gravar). Ele continua valendo na conta e o id
   * indexado aqui permite desligá-lo desta tela quando o canal for desligado.
   */
  useEffect(() => {
    if (watchlist.status !== "ready") return;
    const payload = Array.isArray(watchlist.data.data) ? watchlist.data.data : [];
    for (const raw of payload) {
      const parsed = parseAccountWatchEntry(raw);
      if (!parsed || parsed.status === "CANCELLED") continue;
      accountEntryIdsRef.current.set(accountEntryKey(parsed.listingId, parsed.channel), parsed.watchlistEntryId);
    }
  }, [watchlist.status, watchlist.data]);

  const verificationKey = useMemo(
    () => (entries ?? []).map((entry) => `${entry.listingId}:${entry.publicSlug}`).join("|"),
    [entries],
  );

  // Verificação item a item contra o catálogo público: é o que separa
  // "disponível" de "sem estoque" e de "saiu do catálogo".
  useEffect(() => {
    if (entries === null) return;
    const pending = entriesRef.current.filter((entry) => !checksRef.current.has(entry.listingId));
    if (pending.length === 0) return;
    for (const entry of pending) updateCheck(entry.listingId, { status: "CHECKING" });

    void Promise.all(pending.map(async (entry) => {
      try {
        const listing = await apiRequest<PublicListing>(
          `/v1/listings/${encodeURIComponent(entry.publicSlug)}`,
        );
        updateCheck(entry.listingId, { status: "FOUND", listing });
      } catch (error: unknown) {
        if (isApiError(error) && error.problem.status === 404) {
          updateCheck(entry.listingId, { status: "GONE" });
          return;
        }
        updateCheck(entry.listingId, {
          status: "FAILED",
          message: error instanceof Error ? error.message : "A verificação não pôde ser concluída.",
        });
      }
    }));
  }, [entries, updateCheck, verificationKey, verifyToken]);

  const reportSyncFailure = useCallback((error: unknown) => {
    if (!mountedRef.current) return;
    setSyncWarning(
      error instanceof Error
        ? `A alteração ficou salva neste dispositivo, mas a conta não confirmou: ${error.message}`
        : "A alteração ficou salva neste dispositivo, mas a conta não confirmou o registro.",
    );
  }, []);

  /**
   * Upsert de UM canal na conta, no corpo que `POST /v1/me/watchlist` valida:
   * `{ listingId, kind, targetPriceMinor? }` — nunca o favorito inteiro. A API
   * upserta por (anúncio, tipo) e devolve o `watchlistEntryId` do registro.
   */
  const pushWatch = useCallback(async (listingId: string, channel: WatchChannel, targetPriceMinor: string | null) => {
    if (!accountSynced) return;
    try {
      const created = await apiRequest<{ watchlistEntryId?: unknown }>(WATCHLIST_PATH, {
        method: "POST",
        body: JSON.stringify({
          listingId,
          kind: channel,
          // A API rejeita alvo fora de PRICE_DROP; o campo só viaja quando existe.
          ...(channel === "PRICE_DROP" && targetPriceMinor !== null ? { targetPriceMinor } : {}),
        }),
      });
      if (typeof created.watchlistEntryId === "string" && created.watchlistEntryId !== "") {
        accountEntryIdsRef.current.set(accountEntryKey(listingId, channel), created.watchlistEntryId);
      }
      if (mountedRef.current) setSyncWarning(null);
    } catch (error: unknown) {
      reportSyncFailure(error);
    }
  }, [accountSynced, reportSyncFailure]);

  /**
   * `DELETE /v1/me/watchlist/:watchlistEntryId` — o id da ENTRADA, não o do
   * anúncio. Sem id conhecido não há o que remover na conta: ou ela nunca teve o
   * aviso, ou ele foi criado com a sincronização pendente e nunca subiu.
   */
  const pushUnwatch = useCallback(async (listingId: string, channel: WatchChannel) => {
    if (!accountSynced) return;
    const key = accountEntryKey(listingId, channel);
    const watchlistEntryId = accountEntryIdsRef.current.get(key);
    if (watchlistEntryId === undefined) return;
    try {
      await apiRequest(`${WATCHLIST_PATH}/${encodeURIComponent(watchlistEntryId)}`, { method: "DELETE" });
      accountEntryIdsRef.current.delete(key);
      if (mountedRef.current) setSyncWarning(null);
    } catch (error: unknown) {
      // 404 = a conta já não tem a entrada; o objetivo (não vigiar) está cumprido.
      if (isApiError(error) && error.problem.status === 404) {
        accountEntryIdsRef.current.delete(key);
        if (mountedRef.current) setSyncWarning(null);
        return;
      }
      reportSyncFailure(error);
    }
  }, [accountSynced, reportSyncFailure]);

  function handleRemove(entry: StoredFavorite) {
    const next = persist(removeFavorite(entriesRef.current, entry.listingId));
    const rest = new Map(checksRef.current);
    rest.delete(entry.listingId);
    checksRef.current = rest;
    setChecks(rest);
    setAnnouncement(`${entry.title} saiu dos seus favoritos. Restam ${formatQuantity(next.length)} itens salvos.`);
    // O favorito em si vive no dispositivo; na conta o que existe são os avisos.
    void pushUnwatch(entry.listingId, "PRICE_DROP");
    void pushUnwatch(entry.listingId, "BACK_IN_STOCK");
  }

  function handleEnable(entry: StoredFavorite, channel: WatchChannel, targetPriceMinor: string | null) {
    const optedInAt = new Date().toISOString();
    persist(setWatchOptIn(entriesRef.current, entry.listingId, channel, {
      optedInAt,
      targetPriceMinor,
    }));
    const tail = accountSynced
      ? " Todo envio traz descadastro de um clique."
      : " O registro fica neste dispositivo e nenhuma mensagem é enviada enquanto a sincronização com a conta estiver pendente.";
    setAnnouncement(`${CHANNEL_NAMES[channel]} ligado para ${entry.title}.${tail}`);
    void pushWatch(entry.listingId, channel, targetPriceMinor);
  }

  function handleDisable(entry: StoredFavorite, channel: WatchChannel) {
    persist(clearWatchOptIn(entriesRef.current, entry.listingId, channel));
    setAnnouncement(`${CHANNEL_NAMES[channel]} desligado para ${entry.title}.`);
    void pushUnwatch(entry.listingId, channel);
  }

  function handleRecheck(entry: StoredFavorite) {
    const rest = new Map(checksRef.current);
    rest.delete(entry.listingId);
    checksRef.current = rest;
    setChecks(rest);
    setVerifyToken((token) => token + 1);
    setAnnouncement(`Verificando novamente o estado de ${entry.title}.`);
  }

  const grouped = useMemo(() => {
    const map = new Map<FavoriteState, StoredFavorite[]>();
    for (const entry of entries ?? []) {
      const state = resolveState(entry, checks.get(entry.listingId));
      const bucket = map.get(state);
      if (bucket) bucket.push(entry);
      else map.set(state, [entry]);
    }
    return map;
  }, [checks, entries]);

  const storageReady = entries !== null;
  const accountSettled = watchlist.status === "ready" || watchlist.status === "error";

  const header = (
    <PageHeader
      eyebrow="MINHA CONTA"
      title="Favoritos e avisos"
      description="Cada item salvo aparece com o estado real do anúncio — disponível, preço alterado, sem estoque ou fora do catálogo público. Nada sai da lista sem explicação e nenhum aviso vem marcado."
      meta={accountSynced && typeof watchlist.data.asOf === "string" ? (
        <Freshness asOf={watchlist.data.asOf} state="READY" />
      ) : undefined}
    />
  );

  if (!storageReady || !accountSettled) {
    return <>{header}<ResourceLoading label="Carregando favoritos" /></>;
  }

  const total = entries.length;

  return (
    <>
      {header}

      <p className={styles.liveRegion} role="status" aria-live="polite">{announcement}</p>

      <SyncBanner status={watchlist.status} error={watchlist.status === "error" ? watchlist.error : null} retry={watchlist.retry} />

      {syncWarning ? (
        <Panel className={styles.banner} role="status">
          <CloudOff aria-hidden="true" size={19} />
          <div><strong>Alteração não confirmada pela conta</strong><br /><span>{syncWarning}</span></div>
        </Panel>
      ) : null}

      {storageIssue ? (
        <Panel className={styles.banner} role="status">
          <TriangleAlert aria-hidden="true" size={19} />
          <div>
            <strong>Armazenamento deste dispositivo</strong><br />
            <span>
              {STORAGE_ISSUE_COPY[storageIssue.issue]}
              {storageIssue.discarded > 0
                ? ` Itens afetados: ${formatQuantity(storageIssue.discarded)}.`
                : ""}
            </span>
          </div>
        </Panel>
      ) : null}

      {total === 0 ? (
        <PageState
          kind="empty"
          title="Você ainda não salvou nenhum item"
          description="Favoritar acontece na página do anúncio. Depois de salvar, esta tela passa a comparar o preço e a disponibilidade que você viu com o que o catálogo publica hoje."
          actions={<Link className="button-link" href="/market">Explorar ofertas publicadas</Link>}
        />
      ) : (
        <div className={styles.groups}>
          {GROUP_ORDER.map((state) => {
            const items = grouped.get(state);
            if (!items || items.length === 0) return null;
            const group = GROUPS[state];
            const headingId = `favoritos-${state.toLocaleLowerCase("pt-BR")}`;
            return (
              <section className={styles.group} key={state} aria-labelledby={headingId}>
                <div className={styles.groupHeading}>
                  <StatusBadge tone={group.tone}>{group.label}</StatusBadge>
                  <h2 id={headingId}>
                    {group.label} · {formatQuantity(items.length)} {items.length === 1 ? "item" : "itens"}
                  </h2>
                  <p>{group.explanation}</p>
                </div>
                <ul className={styles.cardList}>
                  {items.map((entry) => (
                    <li key={entry.listingId}>
                      <FavoriteCard
                        entry={entry}
                        state={state}
                        check={checks.get(entry.listingId)}
                        syncMode={syncMode}
                        onRemove={() => { handleRemove(entry); }}
                        onRecheck={() => { handleRecheck(entry); }}
                        onEnable={(channel, target) => { handleEnable(entry, channel, target); }}
                        onDisable={(channel) => { handleDisable(entry, channel); }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function SyncBanner({
  status,
  error,
  retry,
}: {
  status: "idle" | "loading" | "ready" | "error";
  error: Error | null;
  retry: () => void;
}) {
  if (status === "ready") {
    return (
      <Panel className={styles.banner} role="status">
        <Tag aria-hidden="true" size={19} />
        <div>
          <strong>Avisos sincronizados com a sua conta</strong><br />
          <span>
            Os avisos ligados aqui passam a valer na conta, e desligar aqui desliga lá.
            A lista de favoritos em si — título e preço que você salvou — fica neste
            dispositivo: a conta ainda não guarda essa lista.
          </span>
        </div>
      </Panel>
    );
  }

  const problem = error && isApiError(error) ? error.problem : null;
  const pendingCapability = problem !== null
    && (problem.status === 404 || problem.code === "CAPABILITY_NOT_IMPLEMENTED");
  const unauthenticated = problem !== null && (problem.status === 401 || problem.status === 403);

  return (
    <Panel className={styles.banner} role="status">
      <CloudOff aria-hidden="true" size={19} />
      <div>
        <strong>
          {unauthenticated
            ? "Sua lista está apenas neste dispositivo"
            : "Sincronização com a conta pendente"}
        </strong><br />
        <span>
          {unauthenticated ? (
            <>
              Esta sessão não está autenticada, então os favoritos ficam guardados só neste navegador.
              Ao entrar, eles são unidos à lista da conta sem apagar nenhum lado.
            </>
          ) : pendingCapability ? (
            <>
              A API ainda não publicou <code>GET {WATCHLIST_PATH}</code>. A lista funciona por completo
              neste dispositivo; a distinção entre anúncio pausado e removido em definitivo depende dessa
              leitura e não será presumida aqui.
            </>
          ) : (
            <>
              {problem?.detail || problem?.title || "A leitura da lista da conta falhou nesta sessão."}
              {" "}A lista continua funcionando neste dispositivo e nada foi presumido.
            </>
          )}
        </span>
        <span className={styles.bannerActions}>
          {unauthenticated ? <Link className="text-link" href="/entrar">Entrar</Link> : null}
          {!pendingCapability && !unauthenticated
            ? <Button variant="ghost" size="small" onClick={retry}>Tentar sincronizar de novo</Button>
            : null}
        </span>
      </div>
    </Panel>
  );
}

function FavoriteCard({
  entry,
  state,
  check,
  syncMode,
  onRemove,
  onRecheck,
  onEnable,
  onDisable,
}: {
  entry: StoredFavorite;
  state: FavoriteState;
  check: ListingCheck | undefined;
  syncMode: WatchSyncMode;
  onRemove: () => void;
  onRecheck: () => void;
  onEnable: (channel: WatchChannel, targetPriceMinor: string | null) => void;
  onDisable: (channel: WatchChannel) => void;
}) {
  const group = GROUPS[state];
  const href = `/anuncios/${encodeURIComponent(entry.publicSlug)}`;
  const listing = check?.status === "FOUND" ? check.listing : null;
  const direction = listing ? comparePrice(entry, listing) : null;
  // Diferença exata entre o preço salvo e o publicado — só existe quando a queda
  // é real e na mesma moeda (comparePrice já garantiu os dois formatos).
  const dropMinor = listing !== null && direction === -1
    ? (BigInt(entry.savedPriceMinor) - BigInt(listing.priceMinor)).toString()
    : null;
  const openable = state === "DISPONIVEL" || state === "PRECO_MUDOU" || state === "SEM_ESTOQUE";
  const channels = channelsFor(state, entry);

  return (
    <article
      className={styles.card}
      data-state={state}
      aria-busy={state === "VERIFICANDO" ? true : undefined}
    >
      <div className={styles.cardHead}>
        <StatusBadge tone={group.tone}>{group.label}</StatusBadge>
        <h3 className={styles.cardTitle}>
          {openable ? <Link href={href}>{entry.title}</Link> : entry.title}
        </h3>
        <p className={styles.cardExplanation}>{group.explanation}</p>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Preço quando você salvou</dt>
          <dd>
            {formatMinorCurrency(entry.savedPriceMinor, entry.currency)}
            {" · "}
            <time dateTime={entry.savedAt}>{formatDateTime(entry.savedAt)}</time>
          </dd>
        </div>
        {listing ? (
          <div>
            <dt>Preço publicado agora</dt>
            <dd>
              {formatMinorCurrency(listing.priceMinor, listing.currency)}
              {direction === 1 ? " · maior que o preço salvo" : null}
              {direction === null ? " · moeda diferente da registrada, sem comparação possível" : null}
              {dropMinor !== null ? (
                <StatusBadge className={styles.priceDrop} tone="success">
                  Preço caiu {formatMinorCurrency(dropMinor, entry.currency)} desde que você salvou
                </StatusBadge>
              ) : null}
            </dd>
          </div>
        ) : null}
        {listing ? (
          <div>
            <dt>Unidades disponíveis</dt>
            <dd>{formatQuantity(listing.quantityAvailable)}</dd>
          </div>
        ) : null}
        {check?.status === "FAILED" ? (
          <div>
            <dt>Motivo da falha</dt>
            <dd>{check.message}</dd>
          </div>
        ) : null}
      </dl>

      {channels.length > 0 ? (
        <div className={styles.watchGroup}>
          {channels.map((channel) => (
            <WatchToggle
              key={channel}
              itemTitle={entry.title}
              channel={channel}
              optIn={findOptIn(entry, channel)}
              currency={entry.currency}
              referencePriceMinor={entry.savedPriceMinor}
              syncMode={syncMode}
              onEnable={({ targetPriceMinor }) => { onEnable(channel, targetPriceMinor); }}
              onDisable={() => { onDisable(channel); }}
            />
          ))}
        </div>
      ) : null}

      <div className={styles.cardActions}>
        {openable && group.action ? (
          <Link className="button-link" href={href}>{group.action}</Link>
        ) : null}
        {state === "FORA_DO_CATALOGO" ? (
          <Link className="button-link" href="/market">
            {group.action} <ArrowRight aria-hidden="true" size={15} />
          </Link>
        ) : null}
        {state === "NAO_VERIFICADO" ? (
          <Button variant="outline" size="small" iconBefore={<RefreshCw aria-hidden="true" size={15} />} onClick={onRecheck}>
            {group.action}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="small"
          iconBefore={state === "FORA_DO_CATALOGO"
            ? <CircleSlash aria-hidden="true" size={15} />
            : <Trash2 aria-hidden="true" size={15} />}
          aria-label={`Remover ${entry.title} dos favoritos`}
          onClick={onRemove}
        >
          Remover
        </Button>
      </div>
    </article>
  );
}
