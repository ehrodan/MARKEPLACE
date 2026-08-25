"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CloudOff, RefreshCw, ShieldCheck, Ticket } from "lucide-react";
import { Button, PageState, Panel, StatusBadge, type StatusTone } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { formatMinorCurrency, formatPublicDate, formatQuantity } from "@/components/marketplace/formatters";
import type { PublicListing } from "@/components/marketplace/types";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError } from "@/lib/api-client";
import { COPY } from "@/lib/copy-deck";
import {
  describeCartLine,
  effectiveUnitPriceMinor,
  priceDropMinor,
  type CartLineCheck,
} from "./cart-line";
import {
  CheckoutGroup,
  sellerLabel,
  type CartEntry,
  type GroupCheckoutState,
} from "./checkout-group";
import {
  activeLines,
  browserStorage,
  clearCart,
  groupBySeller,
  parseServerCart,
  preserveSavedMarks,
  readCart,
  removeCartLine,
  removeCartLines,
  savedLines,
  setLineQuantity,
  setLineSavedForLater,
  setLineUnitPrice,
  toMergePayload,
  totalItemCount,
  writeCart,
  type CartStorageIssue,
  type StoredCartLine,
} from "./cart-storage";
import {
  SAVED_CART_PATH,
  SAVED_CART_RECOVER_PATH,
  applySavedCartSnapshot,
  parseSavedCartEnvelope,
  parseSavedCartRecord,
  resolveCartSourceId,
  serverCartIdOf,
  toSavedCartPayload,
  type SavedCartPayloadIssue,
} from "./saved-cart-sync";
import styles from "./cart.module.css";

const CART_PATH = "/v1/me/cart";
const MERGE_PATH = "/v1/me/cart/merge";
const ORDERS_PATH = "/v1/orders";

const STORAGE_ISSUE_COPY: Record<CartStorageIssue, string> = {
  UNAVAILABLE: "Este navegador não permitiu gravar dados locais. O carrinho funciona nesta aba, mas não sobrevive a um recarregamento.",
  CORRUPTED: "O carrinho salvo neste dispositivo estava ilegível e foi descartado em vez de ser interpretado por adivinhação.",
  PARTIAL: "Parte do carrinho salvo neste dispositivo estava fora do formato e foi descartada. O que estava íntegro continua na lista.",
  QUOTA: "O armazenamento deste dispositivo está cheio e nada pôde ser gravado. O carrinho vale apenas para esta sessão.",
  TRIMMED: "O armazenamento deste dispositivo está cheio. Os itens mais antigos saíram do carrinho para caber os mais recentes.",
};

interface SyncState {
  mode: "DEVICE" | "ACCOUNT";
  tone: StatusTone;
  label: string;
  message: string;
  /** Contrato exato que ainda não respondeu, quando for o caso. */
  contract?: string;
}

interface OrderCommandResponse {
  data?: { orderId?: unknown; publicCode?: unknown } | undefined;
}

/**
 * Estado da sincronização do "guardado para depois" com o carrinho salvo da
 * conta (contratos GET/POST /v1/me/saved-cart e POST /v1/me/saved-cart/recover).
 * Sem sessão ou sem capability, a lista é 100% local — e a tela diz isso.
 */
type SavedCartUiState =
  | { kind: "CHECKING" }
  | { kind: "GUEST" }
  | { kind: "UNAVAILABLE"; detail: string; contract?: string }
  | { kind: "IDLE" }
  | { kind: "SAVING" }
  | { kind: "SYNCED"; savedAt: string; expiresAt: string; missing: number }
  | { kind: "FAILED"; detail: string };

const SAVED_PAYLOAD_ISSUE_COPY: Record<SavedCartPayloadIssue, string> = {
  EMPTY: "Não há item guardado para enviar à conta.",
  MIXED_CURRENCY: "Os itens guardados misturam moedas e o contrato do carrinho salvo exige uma única moeda por envio. Eles continuam valendo neste dispositivo.",
  INVALID_LINE: "Um dos itens guardados está fora do formato que o contrato da conta aceita (identificador, preço ou quantidade). Eles continuam valendo neste dispositivo.",
  INVALID_CART_ID: "Não foi possível identificar este carrinho com um uuid válido, exigência do contrato da conta.",
  TOO_MANY_ITEMS: "O contrato do carrinho salvo aceita até 100 itens por envio. Eles continuam valendo neste dispositivo.",
};

interface SavedSyncView {
  tone: StatusTone;
  label: string;
  message: string;
  contract?: string;
}

function describeSavedSync(state: SavedCartUiState): SavedSyncView {
  switch (state.kind) {
    case "CHECKING":
      return {
        tone: "neutral",
        label: "Conferindo a conta",
        message: "Verificando se a sua conta tem um carrinho salvo.",
      };
    case "GUEST":
      return {
        tone: "info",
        label: "Somente neste dispositivo",
        message: "Você não está em uma sessão autenticada. Os itens guardados valem neste navegador e nada foi enviado para conta alguma.",
      };
    case "UNAVAILABLE":
      return {
        tone: "warning",
        label: "Conta indisponível",
        message: state.detail,
        ...(state.contract === undefined ? {} : { contract: state.contract }),
      };
    case "IDLE":
      return {
        tone: "neutral",
        label: "Nada salvo na conta",
        message: "A sua conta não tem carrinho salvo ativo. Ao guardar um item, esta lista é enviada para a conta.",
      };
    case "SAVING":
      return {
        tone: "neutral",
        label: "Enviando",
        message: "Atualizando o carrinho salvo da sua conta.",
      };
    case "FAILED":
      return { tone: "warning", label: "Não sincronizado", message: state.detail };
    case "SYNCED": {
      const savedAtLabel = formatPublicDate(state.savedAt);
      const expiresLabel = formatPublicDate(state.expiresAt);
      const base = `Guardados salvos na sua conta${savedAtLabel === null ? "" : ` em ${savedAtLabel}`}${expiresLabel === null ? "" : `, válidos até ${expiresLabel}`}.`;
      const missing = state.missing > 0
        ? ` ${formatQuantity(state.missing)} ${state.missing === 1 ? "item do carrinho salvo da conta não pôde ser exibido" : "itens do carrinho salvo da conta não puderam ser exibidos"} aqui: o snapshot da conta não carrega título nem anúncio.`
        : "";
      return { tone: "success", label: "Salvo na sua conta", message: `${base}${missing}` };
    }
  }
}

function buildEntries(
  lines: readonly StoredCartLine[],
  checks: Partial<Record<string, CartLineCheck>>,
): CartEntry[] {
  return lines.map((line) => {
    const check = checks[line.listingId];
    const status = describeCartLine(line, check);
    const fresh = check?.status === "FOUND" ? check.listing.seller?.displayName ?? null : null;
    const displayName = fresh ?? line.sellerDisplayName ?? null;
    return {
      listingId: line.listingId,
      sellerAccountId: line.sellerAccountId,
      unitPriceMinor: effectiveUnitPriceMinor(line, status),
      currency: status.currentCurrency ?? line.currency,
      quantity: line.quantity,
      ...(displayName === null ? {} : { sellerDisplayName: displayName }),
      line,
      status,
    };
  });
}

function newIdempotencyKey(seed: string): string {
  const cryptoApi = typeof globalThis.crypto === "undefined" ? null : globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  return `${seed}-${String(Date.now())}`;
}

function readOrderCode(response: OrderCommandResponse): string | null {
  const data = response.data;
  if (!data) return null;
  if (typeof data.publicCode === "string" && data.publicCode.trim() !== "") return data.publicCode;
  if (typeof data.orderId === "string" && data.orderId.trim() !== "") return data.orderId;
  return null;
}

export function CartView() {
  // `null` = o dispositivo ainda não foi lido. Evita piscar "carrinho vazio"
  // antes de saber o que existe de fato.
  const [lines, setLines] = useState<StoredCartLine[] | null>(null);
  const [storageIssue, setStorageIssue] = useState<{ issue: CartStorageIssue; discarded: number } | null>(null);
  const [checks, setChecks] = useState<Partial<Record<string, CartLineCheck>>>({});
  const [announcement, setAnnouncement] = useState("");
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [groupStates, setGroupStates] = useState<Record<string, GroupCheckoutState>>({});
  const [mergeWarning, setMergeWarning] = useState<string | null>(null);
  const [accountAdopted, setAccountAdopted] = useState(false);
  const [savedCartState, setSavedCartState] = useState<SavedCartUiState>({ kind: "CHECKING" });

  const mountedRef = useRef(true);
  const checksRef = useRef<Partial<Record<string, CartLineCheck>>>({});
  const linesRef = useRef<StoredCartLine[]>([]);
  const mergedRef = useRef(false);
  const restoredRef = useRef(false);
  const savedCartStateRef = useRef<SavedCartUiState>({ kind: "CHECKING" });
  const savedSyncSeqRef = useRef(0);
  /** Ação de guardar feita enquanto o GET da conta ainda respondia. */
  const pendingSavedSyncRef = useRef<readonly StoredCartLine[] | null>(null);
  const idempotencyRef = useRef(new Map<string, string>());
  const announcedRef = useRef<string | null>(null);
  linesRef.current = lines ?? [];

  const cartResource = useApiResource<unknown>(CART_PATH);
  const savedCartResource = useApiResource<unknown>(SAVED_CART_PATH);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    const result = readCart(browserStorage());
    setLines(result.lines);
    setStorageIssue(result.issue ? { issue: result.issue, discarded: result.discarded } : null);
  }, []);

  /** Grava no dispositivo (modo visitante) ou apenas em memória (modo conta). */
  const persist = useCallback((next: StoredCartLine[], deviceBacked: boolean): StoredCartLine[] => {
    if (!deviceBacked) {
      setLines(next);
      return next;
    }
    const result = writeCart(browserStorage(), next);
    setLines(result.lines);
    setStorageIssue(result.issue ? { issue: result.issue, discarded: result.discarded } : null);
    return result.lines;
  }, []);

  const updateCheck = useCallback((listingId: string, check: CartLineCheck) => {
    if (!mountedRef.current) return;
    checksRef.current = { ...checksRef.current, [listingId]: check };
    setChecks(checksRef.current);
  }, []);

  // ---------------------------------------------------------------- conta
  const serverCart = useMemo(
    () => (cartResource.status === "ready" ? parseServerCart(cartResource.data) : null),
    [cartResource.status, cartResource.data],
  );

  const accountReady = serverCart !== null && serverCart.issue !== "CORRUPTED";

  // Merge dispositivo → conta ao entrar, uma vez por sessão de leitura.
  useEffect(() => {
    if (!accountReady || lines === null || mergedRef.current) return;
    mergedRef.current = true;

    const local = linesRef.current;
    if (local.length === 0) {
      setLines(serverCart.lines);
      setAccountAdopted(true);
      return;
    }

    void (async () => {
      try {
        const merged = await apiRequest<unknown>(MERGE_PATH, {
          method: "POST",
          body: JSON.stringify(toMergePayload(local)),
        });
        if (!mountedRef.current) return;
        const parsed = parseServerCart(merged);
        if (parsed.issue === "CORRUPTED") {
          setMergeWarning("A conta respondeu ao envio do carrinho local, mas fora do formato do contrato. O carrinho deste dispositivo continua valendo.");
          return;
        }
        setLines(parsed.lines);
        setAccountAdopted(true);
        clearCart(browserStorage());
      } catch (error: unknown) {
        if (!mountedRef.current) return;
        const detail = isApiError(error)
          ? `${error.problem.title}${error.problem.detail ? ` — ${error.problem.detail}` : ""}`
          : error instanceof Error ? error.message : "motivo não informado";
        setMergeWarning(`O carrinho deste dispositivo não pôde ser enviado para a conta (${detail}). Nada foi perdido: os itens continuam aqui.`);
      }
    })();
  }, [accountReady, lines, serverCart]);

  const deviceBacked = !accountAdopted;

  const sync = useMemo<SyncState>(() => {
    if (accountAdopted) {
      return {
        mode: "ACCOUNT",
        tone: "success",
        label: "Carrinho da conta",
        message: "Este carrinho está na sua conta. O que você guarda para depois também é enviado para o carrinho salvo da conta; o estado real desse envio aparece na própria seção Guardados para depois.",
      };
    }
    if (cartResource.status === "loading" || cartResource.status === "idle") {
      return {
        mode: "DEVICE",
        tone: "neutral",
        label: "Conferindo a conta",
        message: "Verificando se existe carrinho publicado para a sua conta. Enquanto isso, o carrinho deste dispositivo já está utilizável.",
      };
    }
    if (cartResource.status === "ready") {
      return {
        mode: "DEVICE",
        tone: "warning",
        label: "Formato inesperado",
        message: "A conta respondeu, mas fora do formato do contrato do carrinho. Nenhuma linha foi adivinhada a partir dessa resposta.",
        contract: `GET ${CART_PATH}`,
      };
    }

    const error = cartResource.error;
    if (isApiError(error)) {
      const { problem } = error;
      if (problem.status === 401 || problem.status === 403) {
        return {
          mode: "DEVICE",
          tone: "info",
          label: "Carrinho deste dispositivo",
          message: "Você não está em uma sessão autenticada. O carrinho fica salvo neste navegador e é enviado para a sua conta assim que você entrar.",
        };
      }
      if (problem.status === 404 || problem.status === 501 || problem.code === "CAPABILITY_NOT_IMPLEMENTED") {
        return {
          mode: "DEVICE",
          tone: "warning",
          label: "Sincronização pendente de capability",
          message: "A leitura do carrinho da conta ainda não foi publicada pela API. Esta tela opera inteira no modo visitante e nada é inventado no lugar da resposta que falta.",
          contract: `GET ${CART_PATH}`,
        };
      }
      return {
        mode: "DEVICE",
        tone: "warning",
        label: "Conta não confirmada",
        message: `Não foi possível confirmar o carrinho da sua conta agora: ${problem.title}. O carrinho deste dispositivo continua valendo.`,
        contract: `GET ${CART_PATH}`,
      };
    }

    return {
      mode: "DEVICE",
      tone: "warning",
      label: "Conta não confirmada",
      message: "A conexão com a API falhou ao consultar o carrinho da conta. O carrinho deste dispositivo continua valendo.",
      contract: `GET ${CART_PATH}`,
    };
  }, [accountAdopted, cartResource.status, cartResource.error]);

  // ------------------------------------------- carrinho salvo da conta
  // O merge acima é do carrinho ATIVO; este bloco cuida do "guardado para
  // depois", que a conta persiste como snapshot de retenção.
  const mergeSettled = !accountReady || accountAdopted || mergeWarning !== null;

  const savedCartEnvelope = useMemo(
    () => (savedCartResource.status === "ready" ? parseSavedCartEnvelope(savedCartResource.data) : null),
    [savedCartResource.status, savedCartResource.data],
  );

  /** Atualiza estado + ref no mesmo instante: quem sincroniza lê o ref. */
  const setSavedCartUi = useCallback((next: SavedCartUiState) => {
    savedCartStateRef.current = next;
    setSavedCartState(next);
  }, []);

  // Tradução do GET /v1/me/saved-cart em estado dito por extenso.
  useEffect(() => {
    if (savedCartResource.status === "idle" || savedCartResource.status === "loading") return;
    if (savedCartResource.status === "error") {
      const error = savedCartResource.error;
      if (isApiError(error)) {
        const { problem } = error;
        if (problem.status === 401 || problem.status === 403) {
          setSavedCartUi({ kind: "GUEST" });
          return;
        }
        if (problem.status === 404 || problem.status === 501 || problem.code === "CAPABILITY_NOT_IMPLEMENTED") {
          setSavedCartUi({
            kind: "UNAVAILABLE",
            detail: "A API de carrinho salvo ainda não foi publicada nesta versão. Os itens guardados valem neste dispositivo e nada é simulado no lugar da resposta que falta.",
            contract: `GET ${SAVED_CART_PATH}`,
          });
          return;
        }
        setSavedCartUi({
          kind: "UNAVAILABLE",
          detail: `Não foi possível ler o carrinho salvo da sua conta: ${problem.title}. Os itens guardados continuam valendo neste dispositivo.`,
          contract: `GET ${SAVED_CART_PATH}`,
        });
        return;
      }
      setSavedCartUi({
        kind: "UNAVAILABLE",
        detail: "A conexão com a API falhou ao ler o carrinho salvo da conta. Os itens guardados continuam valendo neste dispositivo.",
        contract: `GET ${SAVED_CART_PATH}`,
      });
      return;
    }
    if (savedCartEnvelope === null) return;
    if (savedCartEnvelope.issue === "CORRUPTED") {
      setSavedCartUi({
        kind: "UNAVAILABLE",
        detail: "A conta respondeu, mas fora do formato do contrato do carrinho salvo. Nada foi restaurado a partir dessa resposta.",
        contract: `GET ${SAVED_CART_PATH}`,
      });
      return;
    }
    if (savedCartEnvelope.savedCart === null || savedCartEnvelope.savedCart.status !== "ACTIVE") {
      setSavedCartUi({ kind: "IDLE" });
    }
    // Snapshot ATIVO: o efeito de restauração abaixo assume e publica SYNCED.
  }, [savedCartResource.status, savedCartResource.error, savedCartEnvelope, setSavedCartUi]);

  /**
   * Envia o estado atual do "guardado para depois" para a conta. Lista vazia
   * com snapshot ativo na conta = a pessoa retomou tudo: marca como recuperado
   * (`/recover`) em vez de deixar um snapshot mentindo por lá. Sem sessão ou
   * sem capability confirmada, não envia nada — modo 100% local, dito na tela.
   * Com a leitura da conta ainda em voo (CHECKING), a ação fica retida em
   * `pendingSavedSyncRef` e é reenviada quando o estado real chegar.
   */
  const syncSavedCart = useCallback((nextLines: readonly StoredCartLine[]) => {
    const current = savedCartStateRef.current;
    if (current.kind === "CHECKING") {
      // A leitura da conta ainda está em voo. A ação não é descartada: fica
      // retida e é reenviada assim que o estado real chegar (efeito abaixo).
      pendingSavedSyncRef.current = nextLines;
      return;
    }
    if (current.kind === "GUEST" || current.kind === "UNAVAILABLE") return;

    const saved = savedLines(nextLines);
    const seq = savedSyncSeqRef.current + 1;
    savedSyncSeqRef.current = seq;

    if (saved.length === 0) {
      if (current.kind === "IDLE") return;
      void apiRequest<unknown>(SAVED_CART_RECOVER_PATH, { method: "POST" })
        .then(() => {
          if (mountedRef.current && seq === savedSyncSeqRef.current) setSavedCartUi({ kind: "IDLE" });
        })
        .catch((error: unknown) => {
          if (!mountedRef.current || seq !== savedSyncSeqRef.current) return;
          if (isApiError(error) && error.problem.status === 404) {
            // Já não havia snapshot ativo: o estado final é o mesmo.
            setSavedCartUi({ kind: "IDLE" });
            return;
          }
          const detail = isApiError(error)
            ? `${error.problem.title}${error.problem.detail ? ` — ${error.problem.detail}` : ""}`
            : error instanceof Error ? error.message : "motivo não informado";
          setSavedCartUi({ kind: "FAILED", detail: `O carrinho salvo da conta não pôde ser marcado como retomado: ${detail}` });
        });
      return;
    }

    const sourceId = resolveCartSourceId(
      browserStorage(),
      serverCartIdOf(cartResource.status === "ready" ? cartResource.data : null),
    );
    if (sourceId === null) {
      setSavedCartUi({
        kind: "FAILED",
        detail: "Este navegador não permitiu criar um identificador estável para o carrinho, exigido pelo contrato da conta. Os itens guardados continuam valendo neste dispositivo.",
      });
      return;
    }

    const built = toSavedCartPayload(sourceId, saved);
    if (built.payload === null) {
      setSavedCartUi({ kind: "FAILED", detail: SAVED_PAYLOAD_ISSUE_COPY[built.issue] });
      return;
    }

    setSavedCartUi({ kind: "SAVING" });
    void apiRequest<unknown>(SAVED_CART_PATH, { method: "POST", body: JSON.stringify(built.payload) })
      .then((response) => {
        if (!mountedRef.current || seq !== savedSyncSeqRef.current) return;
        const record = parseSavedCartRecord(response);
        if (record === null) {
          setSavedCartUi({
            kind: "FAILED",
            detail: "A conta respondeu ao envio, mas fora do formato do contrato do carrinho salvo. O estado exato na conta não pôde ser confirmado.",
          });
          return;
        }
        setSavedCartUi({ kind: "SYNCED", savedAt: record.savedAt, expiresAt: record.expiresAt, missing: 0 });
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || seq !== savedSyncSeqRef.current) return;
        if (isApiError(error) && (error.problem.status === 401 || error.problem.status === 403)) {
          setSavedCartUi({ kind: "GUEST" });
          return;
        }
        const detail = isApiError(error)
          ? `${error.problem.title}${error.problem.detail ? ` — ${error.problem.detail}` : ""}`
          : error instanceof Error ? error.message : "motivo não informado";
        setSavedCartUi({ kind: "FAILED", detail: `O envio para a conta falhou: ${detail}. Os itens guardados continuam valendo neste dispositivo.` });
      });
  }, [cartResource.status, cartResource.data, setSavedCartUi]);

  // Restauração, uma vez por leitura, DEPOIS do merge do carrinho ativo:
  // religa a marca por listingId (nunca duplica linha) e sobe para a conta o
  // que só existia aqui. O que o snapshot tem e esta tela não consegue exibir
  // é contado e dito — nunca reconstruído por adivinhação.
  useEffect(() => {
    if (restoredRef.current) return;
    if (lines === null || savedCartEnvelope === null || savedCartEnvelope.issue === "CORRUPTED") return;
    if (cartResource.status === "idle" || cartResource.status === "loading") return;
    if (!mergeSettled) return;
    restoredRef.current = true;

    const active = savedCartEnvelope.savedCart !== null && savedCartEnvelope.savedCart.status === "ACTIVE"
      ? savedCartEnvelope.savedCart
      : null;

    let currentLines = linesRef.current;
    if (active !== null) {
      const result = applySavedCartSnapshot(currentLines, active.items);
      if (result.restored > 0) {
        currentLines = persist(result.lines, deviceBacked);
        setAnnouncement(`${formatQuantity(result.restored)} ${result.restored === 1 ? "item guardado para depois foi restaurado" : "itens guardados para depois foram restaurados"} do carrinho salvo da sua conta.`);
      }
      setSavedCartUi({
        kind: "SYNCED",
        savedAt: active.savedAt,
        expiresAt: active.expiresAt,
        missing: result.missing + active.discardedItems,
      });
    }

    const snapshotIds = new Set((active === null ? [] : active.items).map((item) => item.listingId));
    const extras = savedLines(currentLines).filter((line) => !snapshotIds.has(line.listingId));
    if (extras.length > 0) syncSavedCart(currentLines);
  }, [lines, savedCartEnvelope, cartResource.status, mergeSettled, deviceBacked, persist, setSavedCartUi, syncSavedCart]);

  // Reenvio da ação retida: quem guardou um item enquanto o GET da conta ainda
  // respondia não pode ter a escolha descartada em silêncio. Assim que o estado
  // real chega, a lista exata que a pessoa produziu é enviada — ou descartada
  // NOMEADAMENTE quando não há sessão/capability (a tela já diz que a lista é
  // 100% local nesses estados).
  useEffect(() => {
    const pending = pendingSavedSyncRef.current;
    if (pending === null || savedCartState.kind === "CHECKING") return;
    pendingSavedSyncRef.current = null;
    if (savedCartState.kind === "GUEST" || savedCartState.kind === "UNAVAILABLE") return;
    syncSavedCart(pending);
  }, [savedCartState, syncSavedCart]);

  // --------------------------------------------------- revalidação de preço
  const verificationKey = useMemo(
    () => (lines ?? []).map((line) => `${line.listingId}:${line.publicSlug}`).join("|"),
    [lines],
  );

  useEffect(() => {
    if (lines === null) return;
    const pending = linesRef.current.filter((line) => checksRef.current[line.listingId] === undefined);
    if (pending.length === 0) return;
    for (const line of pending) updateCheck(line.listingId, { status: "CHECKING" });

    void Promise.all(pending.map(async (line) => {
      try {
        const listing = await apiRequest<PublicListing>(
          `/v1/listings/${encodeURIComponent(line.publicSlug)}`,
        );
        updateCheck(line.listingId, { status: "FOUND", listing });
      } catch (error: unknown) {
        if (isApiError(error) && error.problem.status === 404) {
          updateCheck(line.listingId, { status: "GONE" });
          return;
        }
        updateCheck(line.listingId, {
          status: "FAILED",
          message: error instanceof Error ? error.message : "a verificação não pôde ser concluída.",
        });
      }
    }));
  }, [lines, updateCheck, verificationKey]);

  const recheck = useCallback((line: StoredCartLine) => {
    const { [line.listingId]: _dropped, ...rest } = checksRef.current;
    checksRef.current = rest;
    setChecks(rest);
  }, []);

  const recheckAll = useCallback(() => {
    checksRef.current = {};
    setChecks({});
    announcedRef.current = null;
  }, []);

  // --------------------------------------------------------------- projeção
  const entries = useMemo(
    () => buildEntries(activeLines(lines ?? []), checks),
    [checks, lines],
  );
  const groups = useMemo(() => groupBySeller(entries), [entries]);
  const saved = useMemo(() => savedLines(lines ?? []), [lines]);
  const savedEntries = useMemo(() => buildEntries(saved, checks), [checks, saved]);

  // Anúncio único ao fim da revalidação: quantos itens exigem atenção.
  useEffect(() => {
    if (lines === null || lines.length === 0) return;
    const pending = lines.some((line) => {
      const check = checks[line.listingId];
      return check === undefined || check.status === "CHECKING";
    });
    if (pending) return;
    const key = lines.map((line) => `${line.listingId}:${String(line.quantity)}:${line.unitPriceMinor}`).join("|");
    if (announcedRef.current === key) return;
    announcedRef.current = key;
    const blocking = entries.filter((entry) => entry.status.blocksCheckout).length;
    setAnnouncement(blocking === 0
      ? `Revisão concluída: ${formatQuantity(entries.length)} ${entries.length === 1 ? "item confirmado" : "itens confirmados"} pelo catálogo.`
      : `Revisão concluída: ${formatQuantity(blocking)} ${blocking === 1 ? "item precisa" : "itens precisam"} da sua confirmação antes de virar pedido.`);
  }, [checks, entries, lines]);

  const announceSubtotal = useCallback((next: StoredCartLine[], line: StoredCartLine, prefix: string) => {
    const nextGroups = groupBySeller(buildEntries(activeLines(next), checksRef.current));
    const group = nextGroups.find((candidate) => candidate.sellerAccountId === line.sellerAccountId);
    if (!group || group.subtotalMinor === null || group.currency === null) {
      setAnnouncement(`${prefix} Subtotal deste vendedor indisponível.`);
      return;
    }
    setAnnouncement(`${prefix} Subtotal de ${sellerLabel(group)}: ${formatMinorCurrency(group.subtotalMinor, group.currency)}.`);
  }, []);

  // -------------------------------------------------------------- mutações
  const runRemote = useCallback(async (
    line: StoredCartLine,
    request: () => Promise<unknown>,
  ): Promise<boolean> => {
    setBusyListingId(line.listingId);
    setMutationError(null);
    try {
      const response = await request();
      if (!mountedRef.current) return false;
      const parsed = parseServerCart(response);
      if (parsed.issue === "CORRUPTED") {
        setMutationError("A conta respondeu fora do formato do contrato do carrinho. Nada foi alterado nesta tela.");
        return false;
      }
      // A projeção do servidor não carrega "guardado para depois": a marca
      // local é reaplicada por listingId para não apagar a escolha da pessoa.
      setLines(preserveSavedMarks(linesRef.current, parsed.lines));
      return true;
    } catch (error: unknown) {
      if (!mountedRef.current) return false;
      const detail = isApiError(error)
        ? `${error.problem.title}${error.problem.detail ? ` — ${error.problem.detail}` : ""}`
        : error instanceof Error ? error.message : "motivo não informado";
      setMutationError(`A alteração não foi aplicada no carrinho da sua conta: ${detail}`);
      return false;
    } finally {
      if (mountedRef.current) setBusyListingId(null);
    }
  }, []);

  const handleQuantityChange = useCallback((line: StoredCartLine, quantity: number) => {
    const next = setLineQuantity(linesRef.current, line.listingId, quantity);
    if (deviceBacked || line.cartLineId === undefined) {
      const applied = persist(next, deviceBacked);
      announceSubtotal(applied, line, `${line.title}: ${formatQuantity(quantity)} ${quantity === 1 ? "unidade" : "unidades"}.`);
      return;
    }
    const cartLineId = line.cartLineId;
    void runRemote(line, () => apiRequest<unknown>(
      `${CART_PATH}/lines/${encodeURIComponent(cartLineId)}`,
      { method: "PATCH", body: JSON.stringify({ quantity }) },
    )).then((ok) => {
      if (ok) announceSubtotal(next, line, `${line.title}: ${formatQuantity(quantity)} ${quantity === 1 ? "unidade" : "unidades"}.`);
    });
  }, [announceSubtotal, deviceBacked, persist, runRemote]);

  const handleAcceptPrice = useCallback((line: StoredCartLine) => {
    const check = checksRef.current[line.listingId];
    if (!check || check.status !== "FOUND") return;
    const listing = check.listing;
    const next = setLineUnitPrice(linesRef.current, line.listingId, listing.priceMinor, listing.currency);
    const applied = persist(next, deviceBacked);
    announceSubtotal(
      applied,
      line,
      `Novo preço aceito para ${line.title}: ${formatMinorCurrency(listing.priceMinor, listing.currency)} por unidade.`,
    );
  }, [announceSubtotal, deviceBacked, persist]);

  const handleSaveForLater = useCallback((line: StoredCartLine, savedForLater: boolean) => {
    const next = setLineSavedForLater(linesRef.current, line.listingId, savedForLater);
    const applied = persist(next, deviceBacked);
    // Com sessão confirmada, a lista de guardados também vai para a conta.
    syncSavedCart(applied);
    setAnnouncement(savedForLater
      ? `${line.title} foi guardado para depois e saiu do pedido deste vendedor.`
      : `${line.title} voltou para o pedido deste vendedor.`);
  }, [deviceBacked, persist, syncSavedCart]);

  const handleRemove = useCallback((line: StoredCartLine) => {
    const next = removeCartLine(linesRef.current, line.listingId);
    const wasSaved = line.savedForLater === true;
    if (deviceBacked || line.cartLineId === undefined) {
      const applied = persist(next, deviceBacked);
      if (wasSaved) syncSavedCart(applied);
      announceSubtotal(applied, line, `${line.title} foi removido do carrinho.`);
      return;
    }
    const cartLineId = line.cartLineId;
    void runRemote(line, () => apiRequest<unknown>(
      `${CART_PATH}/lines/${encodeURIComponent(cartLineId)}`,
      { method: "DELETE" },
    )).then((ok) => {
      if (ok) {
        if (wasSaved) syncSavedCart(next);
        announceSubtotal(next, line, `${line.title} foi removido do carrinho.`);
      }
    });
  }, [announceSubtotal, deviceBacked, persist, runRemote, syncSavedCart]);

  const startCheckout = useCallback((group: { sellerAccountId: string; lines: CartEntry[] }) => {
    setGroupStates((current) => ({ ...current, [group.sellerAccountId]: { status: "WORKING" } }));
    setMutationError(null);

    void (async () => {
      const created: string[] = [];
      const codes: string[] = [];

      for (const entry of group.lines) {
        const seed = `${entry.line.listingId}:${String(entry.line.quantity)}:${entry.unitPriceMinor}`;
        const existingKey = idempotencyRef.current.get(seed);
        const idempotencyKey = existingKey ?? newIdempotencyKey(entry.line.listingId);
        idempotencyRef.current.set(seed, idempotencyKey);

        try {
          const response = await apiRequest<OrderCommandResponse>(ORDERS_PATH, {
            method: "POST",
            body: JSON.stringify({
              listingId: entry.line.listingId,
              quantity: entry.line.quantity,
              idempotencyKey,
            }),
          });
          created.push(entry.line.listingId);
          const code = readOrderCode(response);
          if (code !== null) codes.push(code);
        } catch (error: unknown) {
          if (!mountedRef.current) return;
          if (created.length > 0) persist(removeCartLines(linesRef.current, created), deviceBacked);
          const partial = created.length > 0
            ? ` ${formatQuantity(created.length)} de ${formatQuantity(group.lines.length)} ${group.lines.length === 1 ? "pedido foi criado" : "pedidos foram criados"} e saíram do carrinho; o restante não avançou.`
            : " Nenhum pedido foi criado e nada saiu do carrinho.";

          if (isApiError(error)) {
            const { problem } = error;
            const capability = problem.status === 404 || problem.status === 501 || problem.code === "CAPABILITY_NOT_IMPLEMENTED";
            setGroupStates((current) => ({
              ...current,
              [group.sellerAccountId]: {
                status: "FAILED",
                title: capability ? "Comando de pedido ainda não publicado." : problem.title,
                detail: capability
                  ? `A API não expôs POST ${ORDERS_PATH} nesta versão.${partial}`
                  : `${problem.detail ?? "A API recusou o comando."}${partial}`,
                ...(problem.correlationId === undefined ? {} : { reference: problem.correlationId }),
              },
            }));
            return;
          }

          setGroupStates((current) => ({
            ...current,
            [group.sellerAccountId]: {
              status: "FAILED",
              title: "A conexão com a API falhou.",
              detail: `${error instanceof Error ? error.message : "Motivo não informado."}${partial}`,
            },
          }));
          return;
        }
      }

      if (!mountedRef.current) return;
      persist(removeCartLines(linesRef.current, created), deviceBacked);
      setGroupStates((current) => ({
        ...current,
        [group.sellerAccountId]: { status: "DONE", orderCodes: codes },
      }));
      setAnnouncement(`Pedido criado para este vendedor. ${formatQuantity(created.length)} ${created.length === 1 ? "item saiu" : "itens saíram"} do carrinho.`);
    })();
  }, [deviceBacked, persist]);

  // ----------------------------------------------------------------- render
  const activeCount = totalItemCount(activeLines(lines ?? []));
  const savedSyncView = describeSavedSync(savedCartState);
  const header = COPY.cart.header;

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow={header.kicker}
        title={header.headline}
        description={header.subhead}
        meta={
          <span className={styles.headerMeta}>
            {formatQuantity(activeCount)} {activeCount === 1 ? "unidade" : "unidades"}
            {" · "}
            {formatQuantity(groups.length)} {groups.length === 1 ? "pedido separado" : "pedidos separados"}
          </span>
        }
        action={
          <Button
            variant="outline"
            iconBefore={<RefreshCw aria-hidden="true" size={16} />}
            onClick={recheckAll}
          >
            Reconferir preço e estoque
          </Button>
        }
      />

      <p className={styles.headerBody}>{header.body}</p>

      <p className={styles.liveRegion} aria-live="polite" role="status">{announcement}</p>

      <Panel className={styles.banner}>
        <CloudOff aria-hidden="true" size={18} />
        <div>
          <StatusBadge tone={sync.tone}>{sync.label}</StatusBadge>
          <p>{sync.message}</p>
          {sync.contract ? <p><code>{sync.contract}</code></p> : null}
          {mergeWarning ? <p>{mergeWarning}</p> : null}
        </div>
      </Panel>

      {storageIssue ? (
        <Panel className={styles.banner}>
          <ShieldCheck aria-hidden="true" size={18} />
          <div>
            <StatusBadge tone="warning">Armazenamento local</StatusBadge>
            <p>{STORAGE_ISSUE_COPY[storageIssue.issue]}</p>
            {storageIssue.discarded > 0 ? (
              <p>{formatQuantity(storageIssue.discarded)} {storageIssue.discarded === 1 ? "registro" : "registros"} fora do formato.</p>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {mutationError ? <p className={styles.mutationError} role="alert">{mutationError}</p> : null}

      {lines === null ? (
        <p className={styles.loading} aria-busy="true">Lendo o carrinho deste dispositivo.</p>
      ) : lines.length === 0 ? (
        <PageState
          kind="empty"
          title={COPY.cart.empty.headline}
          description={`${COPY.cart.empty.subhead} ${COPY.cart.empty.body}`}
          actions={<Link className="button-link" href="/market">{COPY.cart.empty.cta}</Link>}
        />
      ) : (
        <>
          <section className={styles.groups} aria-label="Grupos de checkout por vendedor">
            {groups.length === 0 ? (
              <PageState
                kind="empty"
                title="Nenhum item ativo no carrinho"
                description="Todos os itens estão guardados para depois. Traga um deles de volta para formar um pedido."
              />
            ) : groups.map((group, index) => (
              <CheckoutGroup
                key={group.sellerAccountId}
                group={group}
                position={index + 1}
                groupCount={groups.length}
                state={groupStates[group.sellerAccountId] ?? { status: "IDLE" }}
                busyListingId={busyListingId}
                onStartCheckout={startCheckout}
                onQuantityChange={handleQuantityChange}
                onAcceptPrice={handleAcceptPrice}
                onSaveForLater={handleSaveForLater}
                onRemove={handleRemove}
                onRecheck={recheck}
              />
            ))}
          </section>

          {savedEntries.length > 0 ? (
            <section className={styles.savedSection} aria-labelledby="carrinho-guardados">
              <h2 id="carrinho-guardados">Guardados para depois</h2>
              <p>Estes itens continuam no carrinho, fora dos pedidos, e seguem sendo reconferidos junto com o resto.</p>
              <p className={styles.savedSync}>
                <StatusBadge tone={savedSyncView.tone}>{savedSyncView.label}</StatusBadge>
                <span>
                  {savedSyncView.message}
                  {savedSyncView.contract === undefined ? null : <> <code>{savedSyncView.contract}</code></>}
                </span>
              </p>
              <ul className={styles.savedList}>
                {savedEntries.map((entry) => {
                  const drop = priceDropMinor(entry.line, entry.status);
                  return (
                  <li key={entry.line.listingId}>
                    <span>{entry.line.title}</span>
                    <StatusBadge tone={entry.status.tone}>{entry.status.label}</StatusBadge>
                    {drop === null ? null : (
                      <StatusBadge tone="success">
                        Preço caiu {formatMinorCurrency(drop, entry.line.currency)} desde que você adicionou
                      </StatusBadge>
                    )}
                    <span className={styles.savedPrice}>
                      {formatMinorCurrency(entry.unitPriceMinor, entry.currency)} × {formatQuantity(entry.line.quantity)}
                    </span>
                    <Button
                      size="small"
                      variant="outline"
                      onClick={() => { handleSaveForLater(entry.line, false); }}
                    >
                      Voltar ao pedido
                      <span className="ui-visually-hidden">: {entry.line.title}</span>
                    </Button>
                    <Button
                      size="small"
                      variant="ghost"
                      onClick={() => { handleRemove(entry.line); }}
                    >
                      Remover
                      <span className="ui-visually-hidden"> {entry.line.title} do carrinho</span>
                    </Button>
                  </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <div className={styles.explainers}>
        <Panel className={styles.explainer}>
          <span className={styles.explainerKicker}>{COPY.cart.priceRevalidation.kicker}</span>
          <h2>{COPY.cart.priceRevalidation.headline}</h2>
          <p>{COPY.cart.priceRevalidation.body}</p>
          <p className={styles.explainerNote}>{COPY.cart.priceRevalidation.microcopy}</p>
        </Panel>

        <Panel className={styles.explainer}>
          <span className={styles.explainerKicker}>{COPY.cart.sellerGroups.kicker}</span>
          <h2>{COPY.cart.sellerGroups.headline}</h2>
          <p>{COPY.cart.sellerGroups.body}</p>
          <p className={styles.explainerNote}>
            Complemento e item relacionado nunca entram sozinhos: enquanto não houver contrato publicado para relações
            de catálogo, nada é acrescentado a este carrinho sem uma ação sua.
          </p>
        </Panel>

        <Panel className={styles.explainer}>
          <span className={styles.explainerKicker}>CUPOM</span>
          <h2>Cupom fica para quando houver contrato.</h2>
          <div className={styles.couponField}>
            <label htmlFor="carrinho-cupom">Código do cupom</label>
            <input
              id="carrinho-cupom"
              type="text"
              disabled
              placeholder="Indisponível nesta versão"
              aria-describedby="carrinho-cupom-nota"
            />
          </div>
          <p id="carrinho-cupom-nota" className={styles.explainerNote}>
            <Ticket aria-hidden="true" size={15} /> Nenhum endpoint de cupom foi publicado no contrato desta onda.
            O campo fica desabilitado em vez de aceitar um código que a plataforma não validaria.
          </p>
        </Panel>
      </div>
    </div>
  );
}
