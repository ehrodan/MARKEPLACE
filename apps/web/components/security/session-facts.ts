import type { SessionSummary } from "@/lib/api-types";

/**
 * Contratos consultados pelas superfícies de segurança da conta.
 * Fonte: docs/07-MAPA-DE-TELAS-E-FLUXOS.md (SCR-ACC-006, SCR-ACC-007, SCR-ACC-008).
 */
export const SESSION_LIST_CONTRACT = "GET /v1/me/sessions";
export const DEVICE_LIST_CONTRACT = "GET /v1/me/devices";

/**
 * O contrato `sessionSchema` (packages/contracts/src/account.ts) devolve apenas
 * `sessionId`, `createdAt`, `expiresAt` e `current`. Não há IP, agente, local nem
 * último uso. Portanto esta tela NÃO pode dizer "de onde" a sessão veio — e diz
 * isso em voz alta em vez de sugerir um sinal que não existe.
 */
export const sessionSignalsAbsent = [
  "endereço de origem",
  "dispositivo e navegador",
  "local aproximado",
  "último uso",
] as const;

export type SessionState = "CURRENT" | "ACTIVE" | "EXPIRED";

export interface SessionFact {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  state: SessionState;
}

/**
 * Estado derivado de dois fatos do servidor: `current` e `expiresAt` contra o
 * instante informado. Nada é guardado no cliente.
 */
export function sessionState(session: SessionSummary, now: Date): SessionState {
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isNaN(expiresAt) && expiresAt <= now.getTime()) return "EXPIRED";
  return session.current ? "CURRENT" : "ACTIVE";
}

const stateLabels: Record<SessionState, string> = {
  CURRENT: "Esta sessão",
  ACTIVE: "Ativa",
  EXPIRED: "Expirada",
};

const stateMeanings: Record<SessionState, string> = {
  CURRENT: "É a sessão deste navegador agora. Encerrá-la exige sair da conta.",
  ACTIVE: "O servidor ainda aceita esta sessão. Não é possível afirmar quem a está usando.",
  EXPIRED:
    "O prazo terminou. O servidor recusa esta sessão, mesmo que ela continue listada até a limpeza.",
};

export function sessionStateLabel(state: SessionState): string {
  return stateLabels[state];
}

export function sessionStateMeaning(state: SessionState): string {
  return stateMeanings[state];
}

/**
 * Ordena para revisão de segurança: a sessão atual primeiro, depois as ativas
 * mais recentes, e as expiradas no fim. Linha fora do contrato é descartada e
 * contada — sessão exibida pela metade é pior que sessão não exibida.
 */
export function readSessionList(payload: unknown): {
  sessions: SessionFact[];
  discarded: number;
  asOf: string | null;
  activeCount: number;
  expiredCount: number;
} | null {
  if (typeof payload !== "object" || payload === null) return null;
  const envelope = payload as Record<string, unknown>;
  if (!Array.isArray(envelope.data)) return null;

  const now = new Date();
  const sessions: SessionFact[] = [];
  let discarded = 0;

  for (const entry of envelope.data) {
    if (typeof entry !== "object" || entry === null) {
      discarded += 1;
      continue;
    }
    const row = entry as Record<string, unknown>;
    const { sessionId, createdAt, expiresAt, current } = row;
    if (
      typeof sessionId !== "string" ||
      sessionId.length === 0 ||
      typeof createdAt !== "string" ||
      Number.isNaN(Date.parse(createdAt)) ||
      typeof expiresAt !== "string" ||
      Number.isNaN(Date.parse(expiresAt)) ||
      typeof current !== "boolean"
    ) {
      discarded += 1;
      continue;
    }
    const summary: SessionSummary = { sessionId, createdAt, expiresAt, current };
    sessions.push({ sessionId, createdAt, expiresAt, state: sessionState(summary, now) });
  }

  const rank: Record<SessionState, number> = { CURRENT: 0, ACTIVE: 1, EXPIRED: 2 };
  sessions.sort((left, right) => {
    if (rank[left.state] !== rank[right.state]) return rank[left.state] - rank[right.state];
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });

  const asOf = typeof envelope.asOf === "string" && !Number.isNaN(Date.parse(envelope.asOf))
    ? envelope.asOf
    : null;

  return {
    sessions,
    discarded,
    asOf,
    activeCount: sessions.filter((session) => session.state !== "EXPIRED").length,
    expiredCount: sessions.filter((session) => session.state === "EXPIRED").length,
  };
}
