import { describe, expect, it } from "vitest";
import {
  actionsAllowedInPhase,
  allowedDisputeActions,
  counterpartRole,
  disputeActions,
  disputeDeadlines,
  disputeDenialGuidance,
  disputeDenialReasons,
  disputePhaseIndex,
  disputePhaseLabels,
  disputePhaseSummaries,
  disputePhases,
  disputeRoles,
  evaluateDisputeAction,
  evaluateDisputeWindow,
  evaluateEvidenceAccess,
  isTerminalDisputePhase,
  resolveEvidenceSubmission,
  summarizeEvidenceScope,
  summarizeExecution,
  visibleEvidence,
  type DisputeEvidenceItem,
  type DisputePhase,
  type DisputeSnapshot,
  type DisputeWindow,
} from "./dispute-state";

const NOW = "2026-05-10T12:00:00.000Z";
const PAST = "2026-05-08T12:00:00.000Z";
const FUTURE = "2026-05-14T12:00:00.000Z";

function openWindow(closesAt: string | null = FUTURE): DisputeWindow {
  return { state: "ABERTA", opensAt: PAST, closesAt, closedByParty: false };
}

function closedWindow(): DisputeWindow {
  return { state: "ENCERRADA", opensAt: PAST, closesAt: PAST, closedByParty: false };
}

function futureWindow(): DisputeWindow {
  return { state: "NAO_ABERTA", opensAt: FUTURE, closesAt: null, closedByParty: false };
}

function snapshot(overrides: Partial<DisputeSnapshot> = {}): DisputeSnapshot {
  return {
    disputeId: "dsp_test",
    orderId: "ord_test",
    phase: "EVIDENCIAS",
    viewerRole: "COMPRADOR",
    openedAt: PAST,
    evidenceWindow: openWindow(),
    counterpartEvidenceWindow: openWindow(),
    appealWindow: futureWindow(),
    appealFiledBy: [],
    staffRequestPending: false,
    decision: null,
    ...overrides,
  };
}

const decision = {
  outcome: "DIVIDIDA" as const,
  reasonCode: "ITEM_PARCIALMENTE_ENTREGUE",
  rationale: "Fundamentação registrada pela análise.",
  policyVersion: "disputes/2026-01",
  decidedAt: PAST,
  effects: [],
};

describe("catálogo de fases, papéis e ações", () => {
  it("mantém a ordem canônica do ciclo de vida", () => {
    expect([...disputePhases]).toEqual([
      "ABERTA",
      "EVIDENCIAS",
      "EM_REVISAO",
      "DECIDIDA",
      "EXECUTADA",
      "RECURSO",
      "ENCERRADA",
    ]);
    expect(disputePhaseIndex("ABERTA")).toBe(0);
    expect(disputePhaseIndex("ENCERRADA")).toBe(disputePhases.length - 1);
    expect(disputePhases.filter(isTerminalDisputePhase)).toEqual(["ENCERRADA"]);
  });

  it("descreve toda fase, todo motivo de recusa e todo papel", () => {
    for (const phase of disputePhases) {
      expect(disputePhaseLabels[phase]).toBeTruthy();
      expect(disputePhaseSummaries[phase].length).toBeGreaterThan(30);
    }
    for (const reason of disputeDenialReasons) {
      const guidance = disputeDenialGuidance[reason];
      expect(guidance.title).toBeTruthy();
      expect(guidance.explanation.length).toBeGreaterThan(30);
    }
    expect(counterpartRole("COMPRADOR")).toBe("VENDEDOR");
    expect(counterpartRole("VENDEDOR")).toBe("COMPRADOR");
  });
});

describe("matriz fase x ação (portão de fase)", () => {
  const expected: Record<DisputePhase, readonly string[]> = {
    ABERTA: ["ENVIAR_EVIDENCIA", "ENCERRAR_SUBMISSAO", "EXPORTAR_PROPRIA_EVIDENCIA"],
    EVIDENCIAS: [
      "ENVIAR_EVIDENCIA",
      "ENCERRAR_SUBMISSAO",
      "RESPONDER_SOLICITACAO",
      "EXPORTAR_PROPRIA_EVIDENCIA",
    ],
    EM_REVISAO: ["RESPONDER_SOLICITACAO", "EXPORTAR_PROPRIA_EVIDENCIA"],
    DECIDIDA: ["VER_DECISAO", "RECORRER", "EXPORTAR_PROPRIA_EVIDENCIA"],
    EXECUTADA: ["VER_DECISAO", "RECORRER", "EXPORTAR_PROPRIA_EVIDENCIA"],
    RECURSO: [
      "ENVIAR_EVIDENCIA",
      "ENCERRAR_SUBMISSAO",
      "RESPONDER_SOLICITACAO",
      "VER_DECISAO",
      "EXPORTAR_PROPRIA_EVIDENCIA",
    ],
    ENCERRADA: ["VER_DECISAO", "EXPORTAR_PROPRIA_EVIDENCIA"],
  };

  it.each(disputePhases)("fase %s libera exatamente as ações previstas", (phase) => {
    expect([...actionsAllowedInPhase(phase)]).toEqual(expected[phase]);
  });
});

describe("simetria entre comprador e vendedor", () => {
  it.each(disputePhases)("na fase %s os dois papéis recebem o mesmo conjunto de ações com janelas iguais", (phase) => {
    const base = { phase, decision, appealWindow: openWindow(), staffRequestPending: true };
    const buyer = allowedDisputeActions(snapshot({ ...base, viewerRole: "COMPRADOR" }), NOW);
    const seller = allowedDisputeActions(snapshot({ ...base, viewerRole: "VENDEDOR" }), NOW);
    expect(buyer).toEqual(seller);
  });

  it("assimetria vem do estado da instância, não do papel", () => {
    const state = snapshot({
      phase: "DECIDIDA",
      decision,
      appealWindow: openWindow(),
      appealFiledBy: ["COMPRADOR"],
    });
    expect(evaluateDisputeAction("RECORRER", { ...state, viewerRole: "COMPRADOR" }, NOW)).toMatchObject({
      allowed: false,
      reason: "RECURSO_JA_PROTOCOLADO",
    });
    expect(evaluateDisputeAction("RECORRER", { ...state, viewerRole: "VENDEDOR" }, NOW)).toMatchObject({
      allowed: true,
      reason: null,
    });
  });
});

describe("janela de evidência", () => {
  it("permite envio com janela aberta e devolve o prazo real", () => {
    const evaluation = evaluateDisputeAction("ENVIAR_EVIDENCIA", snapshot(), NOW);
    expect(evaluation).toEqual({
      action: "ENVIAR_EVIDENCIA",
      allowed: true,
      reason: null,
      deadline: FUTURE,
    });
  });

  it("trata janela marcada como aberta mas vencida como prazo expirado", () => {
    const evaluation = evaluateDisputeAction(
      "ENVIAR_EVIDENCIA",
      snapshot({ evidenceWindow: openWindow(PAST) }),
      NOW,
    );
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.reason).toBe("PRAZO_EXPIRADO");
  });

  it("distingue janela não aberta de janela encerrada", () => {
    expect(evaluateDisputeAction("ENVIAR_EVIDENCIA", snapshot({ evidenceWindow: futureWindow() }), NOW).reason)
      .toBe("JANELA_DE_EVIDENCIA_NAO_ABERTA");
    expect(evaluateDisputeAction("ENVIAR_EVIDENCIA", snapshot({ evidenceWindow: closedWindow() }), NOW).reason)
      .toBe("JANELA_DE_EVIDENCIA_ENCERRADA");
  });

  it("aceita prorrogação como janela ativa", () => {
    const availability = evaluateDisputeWindow(
      { state: "PRORROGADA", opensAt: PAST, closesAt: FUTURE, closedByParty: false },
      "EVIDENCIA",
      NOW,
    );
    expect(availability).toEqual({ open: true, closesAt: FUTURE });
  });

  it("submissão encerrada pela parte bloqueia anexo espontâneo mas não a resposta à análise", () => {
    const state = snapshot({
      evidenceWindow: { state: "ABERTA", opensAt: PAST, closesAt: FUTURE, closedByParty: true },
      staffRequestPending: true,
    });
    expect(evaluateDisputeAction("ENVIAR_EVIDENCIA", state, NOW).reason).toBe("SUBMISSAO_ENCERRADA_PELA_PARTE");
    expect(evaluateDisputeAction("RESPONDER_SOLICITACAO", state, NOW).allowed).toBe(true);
  });

  it("responder exige pedido pendente dirigido à parte", () => {
    expect(evaluateDisputeAction("RESPONDER_SOLICITACAO", snapshot(), NOW).reason).toBe("SEM_SOLICITACAO_PENDENTE");
  });
});

describe("decisão e recurso", () => {
  it("não expõe decisão inexistente", () => {
    expect(evaluateDisputeAction("VER_DECISAO", snapshot({ phase: "DECIDIDA" }), NOW).reason)
      .toBe("DECISAO_NAO_PUBLICADA");
    expect(evaluateDisputeAction("RECORRER", snapshot({ phase: "DECIDIDA", appealWindow: openWindow() }), NOW).reason)
      .toBe("DECISAO_NAO_PUBLICADA");
  });

  it("bloqueia recurso com janela vencida sem apagar o acesso à decisão", () => {
    const state = snapshot({ phase: "EXECUTADA", decision, appealWindow: closedWindow() });
    expect(evaluateDisputeAction("RECORRER", state, NOW).reason).toBe("JANELA_DE_RECURSO_ENCERRADA");
    expect(evaluateDisputeAction("VER_DECISAO", state, NOW).allowed).toBe(true);
    expect(disputeDenialGuidance.JANELA_DE_RECURSO_ENCERRADA.fallback).toBe("VER_DECISAO");
  });

  it("recusa recurso novo enquanto há revisão em curso", () => {
    const state = snapshot({ phase: "RECURSO", decision, appealWindow: openWindow() });
    expect(evaluateDisputeAction("RECORRER", state, NOW).reason).toBe("RECURSO_EM_ANALISE");
  });

  it("disputa encerrada bloqueia mutação e preserva leitura do histórico", () => {
    const state = snapshot({ phase: "ENCERRADA", decision, appealWindow: openWindow() });
    for (const action of disputeActions) {
      const evaluation = evaluateDisputeAction(action, state, NOW);
      if (action === "VER_DECISAO" || action === "EXPORTAR_PROPRIA_EVIDENCIA") {
        expect(evaluation.allowed).toBe(true);
      } else {
        expect(evaluation).toMatchObject({ allowed: false, reason: "DISPUTA_ENCERRADA" });
      }
    }
  });

  it("exportar a própria evidência sobrevive a todas as fases", () => {
    for (const phase of disputePhases) {
      expect(evaluateDisputeAction("EXPORTAR_PROPRIA_EVIDENCIA", snapshot({ phase }), NOW).allowed).toBe(true);
    }
  });
});

describe("decidido não é executado", () => {
  it("sem comando emitido a execução permanece não iniciada", () => {
    expect(summarizeExecution([])).toEqual({ state: "NAO_INICIADA", settled: false });
  });

  it("um comando pendente impede declarar a execução concluída", () => {
    const result = summarizeExecution([
      { commandKind: "REFUND", state: "EXECUTADA", amountMinor: "12000", currency: "BRL", executedAt: PAST, ledgerReference: "led_1" },
      { commandKind: "RELEASE", state: "EM_EXECUCAO", amountMinor: "3000", currency: "BRL", executedAt: null, ledgerReference: null },
    ]);
    expect(result).toEqual({ state: "EM_EXECUCAO", settled: false });
  });

  it("falha e reversão vencem estados otimistas", () => {
    expect(summarizeExecution([
      { commandKind: "SPLIT", state: "EXECUTADA", amountMinor: "1", currency: "BRL", executedAt: PAST, ledgerReference: "led_2" },
      { commandKind: "REFUND", state: "FALHOU", amountMinor: "1", currency: "BRL", executedAt: null, ledgerReference: null },
    ]).state).toBe("FALHOU");
    expect(summarizeExecution([
      { commandKind: "REFUND", state: "REVERTIDA", amountMinor: "1", currency: "BRL", executedAt: PAST, ledgerReference: "led_3" },
    ]).state).toBe("REVERTIDA");
  });

  it("só declara liquidado quando todo comando foi executado", () => {
    expect(summarizeExecution([
      { commandKind: "REFUND", state: "EXECUTADA", amountMinor: "12000", currency: "BRL", executedAt: PAST, ledgerReference: "led_4" },
    ])).toEqual({ state: "EXECUTADA", settled: true });
  });
});

describe("prazos", () => {
  it("classifica prazo do servidor sem inventar nenhum", () => {
    const deadlines = disputeDeadlines(
      snapshot({
        evidenceWindow: openWindow(FUTURE),
        counterpartEvidenceWindow: openWindow(PAST),
        appealWindow: futureWindow(),
      }),
      NOW,
    );
    expect(deadlines.map((deadline) => [deadline.id, deadline.state, deadline.at])).toEqual([
      ["EVIDENCIA_PROPRIA", "EM_CURSO", FUTURE],
      ["EVIDENCIA_OUTRA_PARTE", "EXPIRADO", PAST],
      ["RECURSO", "SEM_PRAZO", null],
    ]);
  });

  it("nomeia a janela da outra parte pelo papel oposto ao leitor", () => {
    const asSeller = disputeDeadlines(snapshot({ viewerRole: "VENDEDOR" }), NOW);
    expect(asSeller[1]?.label).toContain("comprador");
  });
});

describe("escopo de evidência", () => {
  const items: readonly DisputeEvidenceItem[] = [
    { evidenceId: "ev_1", owner: "COMPRADOR", visibility: "PROPRIA", kind: "Captura de tela", submittedAt: PAST, sha256: "a1", analysisState: "ACEITA" },
    { evidenceId: "ev_2", owner: "VENDEDOR", visibility: "PROPRIA", kind: "Comprovante", submittedAt: PAST, sha256: "b2", analysisState: "ACEITA" },
    { evidenceId: "ev_3", owner: "VENDEDOR", visibility: "COMPARTILHADA", kind: "Registro de entrega", submittedAt: PAST, sha256: "c3", analysisState: "ACEITA" },
    { evidenceId: "ev_4", owner: "STAFF", visibility: "RESTRITA_A_STAFF", kind: "Nota interna", submittedAt: PAST, sha256: null, analysisState: "ACEITA" },
    { evidenceId: "ev_5", owner: "STAFF", visibility: "COMPARTILHADA", kind: "Pedido de esclarecimento", submittedAt: PAST, sha256: null, analysisState: "ACEITA" },
    { evidenceId: "ev_6", owner: "COMPRADOR", visibility: "RESTRITA_A_STAFF", kind: "Anotação sobre o comprador", submittedAt: PAST, sha256: null, analysisState: "ACEITA" },
  ];

  it("nunca entrega peça da outra parte fora do escopo liberado", () => {
    expect(visibleEvidence(items, "COMPRADOR").map((item) => item.evidenceId)).toEqual(["ev_1", "ev_3", "ev_5"]);
    expect(visibleEvidence(items, "VENDEDOR").map((item) => item.evidenceId)).toEqual(["ev_2", "ev_3", "ev_5"]);
  });

  it("nota interna de análise não vaza para nenhum papel", () => {
    for (const role of disputeRoles) {
      for (const item of items.filter((candidate) => candidate.visibility === "RESTRITA_A_STAFF")) {
        expect(evaluateEvidenceAccess(item, role)).toEqual({
          visible: false,
          reason: "NOTA_INTERNA_DE_ANALISE",
        });
      }
    }
  });

  it("peça própria restrita à análise também não volta para o autor", () => {
    const ownRestricted = items.find((item) => item.evidenceId === "ev_6");
    expect(ownRestricted).toBeDefined();
    expect(evaluateEvidenceAccess(ownRestricted as DisputeEvidenceItem, "COMPRADOR")).toEqual({
      visible: false,
      reason: "NOTA_INTERNA_DE_ANALISE",
    });
  });

  it("resume o escopo separando próprio, compartilhado e retido", () => {
    expect(summarizeEvidenceScope(items, "COMPRADOR")).toMatchObject({
      withheldFromCounterpart: 1,
      internalNotes: 2,
    });
    const summary = summarizeEvidenceScope(items, "COMPRADOR");
    expect(summary.own.map((item) => item.evidenceId)).toEqual(["ev_1"]);
    expect(summary.shared.map((item) => item.evidenceId)).toEqual(["ev_3", "ev_5"]);
  });

  it("o total visível somado ao retido cobre todas as peças", () => {
    for (const role of disputeRoles) {
      const summary = summarizeEvidenceScope(items, role);
      const total = summary.own.length + summary.shared.length + summary.withheldFromCounterpart + summary.internalNotes;
      expect(total).toBe(items.length);
    }
  });
});

describe("afordância de submissão", () => {
  it("sem registro carregado a submissão é bloqueada com motivo de capacidade", () => {
    expect(resolveEvidenceSubmission(snapshot(), null, NOW)).toEqual({
      state: "BLOQUEADA",
      reason: "CAPACIDADE_NAO_PUBLICADA",
    });
  });

  it("só habilita o formulário quando há janela aberta e restrições publicadas", () => {
    const constraints = { acceptedFormats: ["PNG"], maxFileBytes: 1024, maxItemsPerParty: 3 };
    expect(resolveEvidenceSubmission(snapshot(), constraints, NOW)).toEqual({
      state: "HABILITADA",
      constraints,
      deadline: FUTURE,
    });
    expect(resolveEvidenceSubmission(snapshot({ evidenceWindow: closedWindow() }), constraints, NOW)).toEqual({
      state: "BLOQUEADA",
      reason: "JANELA_DE_EVIDENCIA_ENCERRADA",
    });
  });
});
