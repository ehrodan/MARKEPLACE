import { describe, expect, it } from "vitest";

import {
  readSessionList,
  sessionState,
  sessionStateLabel,
  sessionStateMeaning,
} from "./session-facts";

const hour = 3_600_000;

function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

describe("sessionState", () => {
  const now = new Date("2026-08-24T03:00:00.000Z");

  it("prazo vencido é expirada, mesmo marcada como atual pelo servidor", () => {
    const state = sessionState(
      {
        sessionId: "s1",
        createdAt: "2026-08-20T03:00:00.000Z",
        expiresAt: "2026-08-23T03:00:00.000Z",
        current: true,
      },
      now,
    );
    expect(state).toBe("EXPIRED");
  });

  it("separa a sessão deste navegador das outras ativas", () => {
    const base = { createdAt: "2026-08-24T02:00:00.000Z", expiresAt: "2026-08-25T02:00:00.000Z" };
    expect(sessionState({ sessionId: "s2", ...base, current: true }, now)).toBe("CURRENT");
    expect(sessionState({ sessionId: "s3", ...base, current: false }, now)).toBe("ACTIVE");
  });

  it("tem rótulo e significado para os três estados", () => {
    for (const state of ["CURRENT", "ACTIVE", "EXPIRED"] as const) {
      expect(sessionStateLabel(state).length).toBeGreaterThan(0);
      expect(sessionStateMeaning(state).length).toBeGreaterThan(0);
    }
  });

  it("nunca afirma que aprovação de prazo devolve identidade do usuário", () => {
    expect(sessionStateMeaning("ACTIVE")).toContain("Não é possível afirmar quem");
  });
});

describe("readSessionList", () => {
  it("ordena para revisão: atual, ativas recentes, expiradas no fim", () => {
    const read = readSessionList({
      data: [
        {
          sessionId: "expirada",
          createdAt: isoFromNow(-72 * hour),
          expiresAt: isoFromNow(-hour),
          current: false,
        },
        {
          sessionId: "ativa-antiga",
          createdAt: isoFromNow(-10 * hour),
          expiresAt: isoFromNow(10 * hour),
          current: false,
        },
        {
          sessionId: "atual",
          createdAt: isoFromNow(-hour),
          expiresAt: isoFromNow(23 * hour),
          current: true,
        },
        {
          sessionId: "ativa-nova",
          createdAt: isoFromNow(-2 * hour),
          expiresAt: isoFromNow(22 * hour),
          current: false,
        },
      ],
      asOf: "2026-08-24T03:00:00.000Z",
    });

    expect(read?.sessions.map((session) => session.sessionId)).toEqual([
      "atual",
      "ativa-nova",
      "ativa-antiga",
      "expirada",
    ]);
    expect(read?.activeCount).toBe(3);
    expect(read?.expiredCount).toBe(1);
    expect(read?.asOf).toBe("2026-08-24T03:00:00.000Z");
    expect(read?.discarded).toBe(0);
  });

  it("descarta e conta linha fora do contrato", () => {
    const read = readSessionList({
      data: [
        { sessionId: "ok", createdAt: isoFromNow(-hour), expiresAt: isoFromNow(hour), current: true },
        { sessionId: "sem-prazo", createdAt: isoFromNow(-hour), current: false },
        { sessionId: 42, createdAt: isoFromNow(-hour), expiresAt: isoFromNow(hour), current: false },
        null,
      ],
    });

    expect(read?.sessions).toHaveLength(1);
    expect(read?.discarded).toBe(3);
    expect(read?.asOf).toBeNull();
  });

  it("recusa envelope sem lista", () => {
    expect(readSessionList({ sessions: [] })).toBeNull();
    expect(readSessionList(null)).toBeNull();
  });
});
