/**
 * SCR-BUY-007 — devido processo da disputa.
 *
 * Módulo puro: sem React, sem rede, sem relógio implícito. Todo cálculo que depende
 * de tempo recebe `now` como parâmetro, para que fase, janela e prazo sejam testáveis
 * e para que a interface nunca precise de cronômetro (política de motion M0, doc 07 §1.4).
 *
 * Fontes canônicas:
 * - docs/07-MAPA-DE-TELAS-E-FLUXOS.md (SCR-BUY-007, fonte `/v1/disputes/{id}`);
 * - docs/01-PRD-MIDAS.md RF-139..RF-148 (abertura, evidência, janela, decisão, execução, recurso);
 * - docs/01-PRD-MIDAS.md §ciclo `ABERTA → EVIDENCIAS → EM_REVISAO → DECIDIDA → EXECUTADA → ENCERRADA`, com recurso.
 */

/* ------------------------------------------------------------------ fases */

export const disputePhases = [
  "ABERTA",
  "EVIDENCIAS",
  "EM_REVISAO",
  "DECIDIDA",
  "EXECUTADA",
  "RECURSO",
  "ENCERRADA",
] as const;

export type DisputePhase = (typeof disputePhases)[number];

export const disputePhaseLabels: Record<DisputePhase, string> = {
  ABERTA: "Aberta",
  EVIDENCIAS: "Envio de evidências",
  EM_REVISAO: "Em análise",
  DECIDIDA: "Decidida",
  EXECUTADA: "Decisão executada",
  RECURSO: "Recurso em análise",
  ENCERRADA: "Encerrada",
};

/** Explicação de processo — não descreve nenhuma disputa concreta. */
export const disputePhaseSummaries: Record<DisputePhase, string> = {
  ABERTA:
    "A disputa foi vinculada ao pedido. Ações incompatíveis do pedido e do lote financeiro ficam congeladas e o snapshot de pedido, anúncio, confirmações e políticas é preservado.",
  EVIDENCIAS:
    "Cada parte envia evidências dentro da própria janela. A ausência de uma parte é registrada de forma explícita e nenhum prazo presume que houve entrega.",
  EM_REVISAO:
    "A análise ocorre sobre as evidências recebidas. Uma parte pode ser chamada a responder a um pedido de esclarecimento dentro do prazo indicado.",
  DECIDIDA:
    "A decisão foi publicada com resultado, motivo, fundamentação e versão de política. Publicar a decisão não é o mesmo que executá-la no dinheiro.",
  EXECUTADA:
    "Os comandos financeiros da decisão foram emitidos de forma idempotente. Cada efeito tem estado próprio e referência de razão; nenhum saldo é editado à mão.",
  RECURSO:
    "Um recurso foi protocolado dentro da janela. A decisão anterior é preservada e a revisão corre em registro próprio.",
  ENCERRADA:
    "Não há mais janela de submissão nem de recurso. O histórico permanece acessível às partes e nada é apagado.",
};

export function disputePhaseIndex(phase: DisputePhase): number {
  return disputePhases.indexOf(phase);
}

export function isTerminalDisputePhase(phase: DisputePhase): boolean {
  return phase === "ENCERRADA";
}

/* ------------------------------------------------------------------ papéis */

export const disputeRoles = ["COMPRADOR", "VENDEDOR"] as const;

export type DisputeRole = (typeof disputeRoles)[number];

export const disputeRoleLabels: Record<DisputeRole, string> = {
  COMPRADOR: "Comprador",
  VENDEDOR: "Vendedor",
};

export function counterpartRole(role: DisputeRole): DisputeRole {
  return role === "COMPRADOR" ? "VENDEDOR" : "COMPRADOR";
}

/* ------------------------------------------------------------------ ações */

export const disputeActions = [
  "ENVIAR_EVIDENCIA",
  "ENCERRAR_SUBMISSAO",
  "RESPONDER_SOLICITACAO",
  "VER_DECISAO",
  "RECORRER",
  "EXPORTAR_PROPRIA_EVIDENCIA",
] as const;

export type DisputeAction = (typeof disputeActions)[number];

export const disputeActionLabels: Record<DisputeAction, string> = {
  ENVIAR_EVIDENCIA: "Enviar evidência",
  ENCERRAR_SUBMISSAO: "Encerrar minha submissão",
  RESPONDER_SOLICITACAO: "Responder ao pedido de esclarecimento",
  VER_DECISAO: "Ver decisão e fundamentação",
  RECORRER: "Recorrer da decisão",
  EXPORTAR_PROPRIA_EVIDENCIA: "Exportar a minha própria evidência",
};

export const disputeActionDescriptions: Record<DisputeAction, string> = {
  ENVIAR_EVIDENCIA:
    "Anexar documento, imagem ou registro à sua submissão, dentro da sua janela e do limite publicado pela política.",
  ENCERRAR_SUBMISSAO:
    "Declarar que a sua submissão está completa antes do fim da janela. Encerrar não antecipa decisão nem prejudica o seu recurso.",
  RESPONDER_SOLICITACAO:
    "Responder a um esclarecimento pedido pela análise. Só fica disponível quando existe pedido pendente dirigido a você.",
  VER_DECISAO:
    "Ler o resultado, o motivo estruturado, a fundamentação e a versão de política aplicada, com os efeitos financeiros listados à parte.",
  RECORRER:
    "Pedir revisão da decisão dentro da janela de recurso. A decisão anterior é preservada e a revisão corre em registro próprio.",
  EXPORTAR_PROPRIA_EVIDENCIA:
    "Baixar o que você mesmo enviou, com hash e data de custódia. Continua disponível mesmo com a conta restrita (RF-146).",
};

/**
 * Ações que alteram o processo. `VER_DECISAO` e `EXPORTAR_PROPRIA_EVIDENCIA` são leitura
 * e sobrevivem ao encerramento — a parte nunca perde acesso ao próprio histórico.
 */
const readOnlyActions: ReadonlySet<DisputeAction> = new Set<DisputeAction>([
  "VER_DECISAO",
  "EXPORTAR_PROPRIA_EVIDENCIA",
]);

export function isReadOnlyDisputeAction(action: DisputeAction): boolean {
  return readOnlyActions.has(action);
}

/* ------------------------------------------------------- motivos de recusa */

export const disputeDenialReasons = [
  "FASE_NAO_PERMITE",
  "JANELA_DE_EVIDENCIA_NAO_ABERTA",
  "JANELA_DE_EVIDENCIA_ENCERRADA",
  "SUBMISSAO_ENCERRADA_PELA_PARTE",
  "PRAZO_EXPIRADO",
  "SEM_SOLICITACAO_PENDENTE",
  "DECISAO_NAO_PUBLICADA",
  "JANELA_DE_RECURSO_NAO_ABERTA",
  "JANELA_DE_RECURSO_ENCERRADA",
  "RECURSO_JA_PROTOCOLADO",
  "RECURSO_EM_ANALISE",
  "DISPUTA_ENCERRADA",
  "CAPACIDADE_NAO_PUBLICADA",
] as const;

export type DisputeDenialReason = (typeof disputeDenialReasons)[number];

export interface DisputeDenialGuidance {
  /** Rótulo curto do bloqueio. Nunca um botão cinza mudo. */
  readonly title: string;
  /** Por que a ação não cabe agora, em linguagem de processo. */
  readonly explanation: string;
  /** O que ainda cabe. `null` significa que não há ação alternativa nesta condição. */
  readonly fallback: DisputeAction | null;
}

export const disputeDenialGuidance: Record<DisputeDenialReason, DisputeDenialGuidance> = {
  FASE_NAO_PERMITE: {
    title: "Fora da fase",
    explanation:
      "Esta ação pertence a outra fase do processo. A fase atual está indicada no acompanhamento acima e muda por decisão da análise ou por prazo, não por insistência.",
    fallback: "EXPORTAR_PROPRIA_EVIDENCIA",
  },
  JANELA_DE_EVIDENCIA_NAO_ABERTA: {
    title: "Janela de evidência ainda não aberta",
    explanation:
      "A submissão abre em data indicada no painel de prazos. Você pode preparar os arquivos agora, respeitando formatos e limites publicados junto do registro da disputa.",
    fallback: "EXPORTAR_PROPRIA_EVIDENCIA",
  },
  JANELA_DE_EVIDENCIA_ENCERRADA: {
    title: "Janela de evidência encerrada",
    explanation:
      "O período de submissão terminou e nada foi apagado: tudo o que você enviou permanece nos autos e será considerado. Se a decisão sair contrária, o caminho é o recurso.",
    fallback: "RECORRER",
  },
  SUBMISSAO_ENCERRADA_PELA_PARTE: {
    title: "Você encerrou a sua submissão",
    explanation:
      "Você declarou a submissão completa. Novos anexos por esta via não são aceitos, mas um pedido de esclarecimento da análise reabre a resposta e o recurso continua disponível.",
    fallback: "RECORRER",
  },
  PRAZO_EXPIRADO: {
    title: "Prazo vencido",
    explanation:
      "O prazo desta ação venceu na data indicada no painel de prazos. O vencimento não presume culpa nem entrega: apenas fecha esta via específica.",
    fallback: "RECORRER",
  },
  SEM_SOLICITACAO_PENDENTE: {
    title: "Sem pedido de esclarecimento pendente",
    explanation:
      "A análise não pediu esclarecimento dirigido a você. Se houver pedido, ele aparece aqui com prazo próprio e você é notificado.",
    fallback: null,
  },
  DECISAO_NAO_PUBLICADA: {
    title: "Decisão ainda não publicada",
    explanation:
      "Nenhuma decisão foi publicada nesta disputa. Enquanto isso, nada é presumido a favor de nenhuma das partes.",
    fallback: null,
  },
  JANELA_DE_RECURSO_NAO_ABERTA: {
    title: "Recurso ainda não disponível",
    explanation:
      "O recurso abre depois que a decisão é publicada. A data de abertura aparece no painel de prazos.",
    fallback: "VER_DECISAO",
  },
  JANELA_DE_RECURSO_ENCERRADA: {
    title: "Janela de recurso encerrada",
    explanation:
      "O prazo de recurso terminou. A decisão e a fundamentação continuam acessíveis a você, e o histórico da disputa não é apagado.",
    fallback: "VER_DECISAO",
  },
  RECURSO_JA_PROTOCOLADO: {
    title: "Você já recorreu",
    explanation:
      "Cada parte recorre uma vez por decisão. O seu recurso está registrado e a revisão corre em registro próprio, preservando a decisão anterior.",
    fallback: "VER_DECISAO",
  },
  RECURSO_EM_ANALISE: {
    title: "Recurso em análise",
    explanation:
      "Há recurso em curso nesta disputa. Um novo recurso sobre a mesma decisão não é aceito enquanto a revisão não terminar.",
    fallback: "VER_DECISAO",
  },
  DISPUTA_ENCERRADA: {
    title: "Disputa encerrada",
    explanation:
      "Não há mais janela de submissão nem de recurso. Você mantém acesso ao pedido, à decisão e à sua própria evidência.",
    fallback: "EXPORTAR_PROPRIA_EVIDENCIA",
  },
  CAPACIDADE_NAO_PUBLICADA: {
    title: "Registro de disputa indisponível",
    explanation:
      "A fonte canônica `/v1/disputes/{id}` (SCR-BUY-007) ainda não está publicada nesta instalação. Nenhuma fase, prazo ou evidência foi presumida no lugar dos dados reais.",
    fallback: null,
  },
};

/* ---------------------------------------------------------------- janelas */

export type DisputeWindowState = "NAO_ABERTA" | "ABERTA" | "PRORROGADA" | "ENCERRADA";

export const disputeWindowStateLabels: Record<DisputeWindowState, string> = {
  NAO_ABERTA: "Ainda não aberta",
  ABERTA: "Aberta",
  PRORROGADA: "Prorrogada",
  ENCERRADA: "Encerrada",
};

export interface DisputeWindow {
  readonly state: DisputeWindowState;
  /** Instante ISO-8601 de abertura, quando o servidor informa. */
  readonly opensAt: string | null;
  /** Instante ISO-8601 de fechamento, já considerando prorrogação. */
  readonly closesAt: string | null;
  /** A própria parte declarou a submissão completa antes do fim da janela. */
  readonly closedByParty: boolean;
}

type WindowKind = "EVIDENCIA" | "RECURSO";

export type DisputeWindowAvailability =
  | { readonly open: true; readonly closesAt: string | null }
  | { readonly open: false; readonly reason: DisputeDenialReason };

function parseInstant(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

/**
 * Avalia uma janela contra `now`. Uma janela marcada como aberta mas com fechamento no
 * passado é tratada como prazo vencido — o estado persistido nunca vence o relógio.
 */
export function evaluateDisputeWindow(
  window: DisputeWindow,
  kind: WindowKind,
  now: string,
): DisputeWindowAvailability {
  const notOpen: DisputeDenialReason =
    kind === "EVIDENCIA" ? "JANELA_DE_EVIDENCIA_NAO_ABERTA" : "JANELA_DE_RECURSO_NAO_ABERTA";
  const closed: DisputeDenialReason =
    kind === "EVIDENCIA" ? "JANELA_DE_EVIDENCIA_ENCERRADA" : "JANELA_DE_RECURSO_ENCERRADA";

  if (window.state === "NAO_ABERTA") return { open: false, reason: notOpen };
  if (window.state === "ENCERRADA") return { open: false, reason: closed };
  if (kind === "EVIDENCIA" && window.closedByParty) {
    return { open: false, reason: "SUBMISSAO_ENCERRADA_PELA_PARTE" };
  }

  const nowTime = parseInstant(now);
  const opensAt = parseInstant(window.opensAt);
  const closesAt = parseInstant(window.closesAt);

  if (nowTime !== null && opensAt !== null && nowTime < opensAt) {
    return { open: false, reason: notOpen };
  }
  if (nowTime !== null && closesAt !== null && nowTime > closesAt) {
    return { open: false, reason: "PRAZO_EXPIRADO" };
  }

  return { open: true, closesAt: window.closesAt };
}

/* -------------------------------------------------- decisão x execução */

export type DisputeOutcome = "COMPRADOR" | "VENDEDOR" | "DIVIDIDA";

export const disputeOutcomeLabels: Record<DisputeOutcome, string> = {
  COMPRADOR: "Favorável ao comprador",
  VENDEDOR: "Favorável ao vendedor",
  DIVIDIDA: "Dividida entre as partes",
};

export type FinancialCommandKind = "REFUND" | "RELEASE" | "SPLIT" | "FREEZE";

export const financialCommandLabels: Record<FinancialCommandKind, string> = {
  REFUND: "Reembolso ao comprador",
  RELEASE: "Liberação ao vendedor",
  SPLIT: "Divisão entre as partes",
  FREEZE: "Retenção do valor",
};

export type FinancialExecutionState =
  | "NAO_INICIADA"
  | "EM_EXECUCAO"
  | "EXECUTADA"
  | "REVERTIDA"
  | "FALHOU";

export const financialExecutionLabels: Record<FinancialExecutionState, string> = {
  NAO_INICIADA: "Ainda não executada",
  EM_EXECUCAO: "Em execução",
  EXECUTADA: "Executada",
  REVERTIDA: "Revertida",
  FALHOU: "Falhou",
};

export interface DisputeFinancialEffect {
  readonly commandKind: FinancialCommandKind;
  readonly state: FinancialExecutionState;
  /** Valor em unidades menores, em string, para não perder precisão (BigInt-safe). */
  readonly amountMinor: string;
  readonly currency: string;
  readonly executedAt: string | null;
  readonly ledgerReference: string | null;
}

export interface DisputeDecision {
  readonly outcome: DisputeOutcome;
  readonly reasonCode: string;
  readonly rationale: string;
  readonly policyVersion: string;
  readonly decidedAt: string;
  readonly effects: readonly DisputeFinancialEffect[];
}

/**
 * Separa o que foi DECIDIDO do que já foi EXECUTADO no dinheiro (RF-143 x RF-144).
 * Confundir os dois é a origem clássica de reclamação: a decisão pode existir sem
 * que um único centavo tenha se movido.
 */
export function summarizeExecution(
  effects: readonly DisputeFinancialEffect[],
): { readonly state: FinancialExecutionState; readonly settled: boolean } {
  if (effects.length === 0) return { state: "NAO_INICIADA", settled: false };
  if (effects.some((effect) => effect.state === "FALHOU")) return { state: "FALHOU", settled: false };
  if (effects.some((effect) => effect.state === "REVERTIDA")) return { state: "REVERTIDA", settled: false };
  if (effects.some((effect) => effect.state === "EM_EXECUCAO")) return { state: "EM_EXECUCAO", settled: false };
  if (effects.every((effect) => effect.state === "EXECUTADA")) return { state: "EXECUTADA", settled: true };
  return { state: "NAO_INICIADA", settled: false };
}

/* ------------------------------------------------------------- snapshot */

export interface DisputeSnapshot {
  readonly disputeId: string;
  readonly orderId: string;
  readonly phase: DisputePhase;
  /** Papel de quem está lendo a tela. Determina escopo de evidência e ações. */
  readonly viewerRole: DisputeRole;
  readonly openedAt: string;
  /** Janela de submissão do próprio papel. */
  readonly evidenceWindow: DisputeWindow;
  /** Metadado processual da outra parte: estado e prazo, nunca conteúdo. */
  readonly counterpartEvidenceWindow: DisputeWindow;
  readonly appealWindow: DisputeWindow;
  readonly appealFiledBy: readonly DisputeRole[];
  readonly staffRequestPending: boolean;
  readonly decision: DisputeDecision | null;
}

/* ------------------------------------------------- matriz fase x papel */

/**
 * Portão de fase por ação. A simetria entre comprador e vendedor é intencional:
 * devido processo bilateral. A assimetria real vive nas janelas por papel,
 * no pedido de esclarecimento dirigido e em quem já recorreu.
 */
const actionPhaseGate: Record<DisputeAction, readonly DisputePhase[]> = {
  ENVIAR_EVIDENCIA: ["ABERTA", "EVIDENCIAS", "RECURSO"],
  ENCERRAR_SUBMISSAO: ["ABERTA", "EVIDENCIAS", "RECURSO"],
  RESPONDER_SOLICITACAO: ["EVIDENCIAS", "EM_REVISAO", "RECURSO"],
  VER_DECISAO: ["DECIDIDA", "EXECUTADA", "RECURSO", "ENCERRADA"],
  RECORRER: ["DECIDIDA", "EXECUTADA"],
  EXPORTAR_PROPRIA_EVIDENCIA: [...disputePhases],
};

/** Ações que a fase admite, antes de olhar janela, prazo e estado da instância. */
export function actionsAllowedInPhase(phase: DisputePhase): readonly DisputeAction[] {
  return disputeActions.filter((action) => actionPhaseGate[action].includes(phase));
}

export interface DisputeActionEvaluation {
  readonly action: DisputeAction;
  readonly allowed: boolean;
  /** Motivo nomeado quando a ação não é permitida. `null` quando permitida. */
  readonly reason: DisputeDenialReason | null;
  /** Prazo real que rege a ação, quando o servidor informa. Nunca é contagem regressiva. */
  readonly deadline: string | null;
}

function denied(action: DisputeAction, reason: DisputeDenialReason): DisputeActionEvaluation {
  return { action, allowed: false, reason, deadline: null };
}

export function evaluateDisputeAction(
  action: DisputeAction,
  snapshot: DisputeSnapshot,
  now: string,
): DisputeActionEvaluation {
  if (isTerminalDisputePhase(snapshot.phase) && !isReadOnlyDisputeAction(action)) {
    return denied(action, "DISPUTA_ENCERRADA");
  }

  if (action === "RECORRER" && snapshot.phase === "RECURSO") {
    return denied(action, "RECURSO_EM_ANALISE");
  }

  if (!actionPhaseGate[action].includes(snapshot.phase)) {
    return denied(action, "FASE_NAO_PERMITE");
  }

  switch (action) {
    case "EXPORTAR_PROPRIA_EVIDENCIA":
      return { action, allowed: true, reason: null, deadline: null };

    case "VER_DECISAO":
      if (!snapshot.decision) return denied(action, "DECISAO_NAO_PUBLICADA");
      return { action, allowed: true, reason: null, deadline: null };

    case "ENVIAR_EVIDENCIA":
    case "ENCERRAR_SUBMISSAO": {
      const availability = evaluateDisputeWindow(snapshot.evidenceWindow, "EVIDENCIA", now);
      if (!availability.open) return denied(action, availability.reason);
      return { action, allowed: true, reason: null, deadline: availability.closesAt };
    }

    case "RESPONDER_SOLICITACAO": {
      if (!snapshot.staffRequestPending) return denied(action, "SEM_SOLICITACAO_PENDENTE");
      const availability = evaluateDisputeWindow(snapshot.evidenceWindow, "EVIDENCIA", now);
      // Pedido de esclarecimento reabre a resposta mesmo com a submissão encerrada
      // pela própria parte: responder à análise não é anexar novo material espontâneo.
      if (!availability.open && availability.reason !== "SUBMISSAO_ENCERRADA_PELA_PARTE") {
        return denied(action, availability.reason);
      }
      return { action, allowed: true, reason: null, deadline: snapshot.evidenceWindow.closesAt };
    }

    case "RECORRER": {
      if (!snapshot.decision) return denied(action, "DECISAO_NAO_PUBLICADA");
      if (snapshot.appealFiledBy.includes(snapshot.viewerRole)) {
        return denied(action, "RECURSO_JA_PROTOCOLADO");
      }
      const availability = evaluateDisputeWindow(snapshot.appealWindow, "RECURSO", now);
      if (!availability.open) return denied(action, availability.reason);
      return { action, allowed: true, reason: null, deadline: availability.closesAt };
    }

    default: {
      const exhaustive: never = action;
      return denied(exhaustive, "FASE_NAO_PERMITE");
    }
  }
}

export function disputeActionMatrix(
  snapshot: DisputeSnapshot,
  now: string,
): readonly DisputeActionEvaluation[] {
  return disputeActions.map((action) => evaluateDisputeAction(action, snapshot, now));
}

export function allowedDisputeActions(
  snapshot: DisputeSnapshot,
  now: string,
): readonly DisputeAction[] {
  return disputeActionMatrix(snapshot, now)
    .filter((evaluation) => evaluation.allowed)
    .map((evaluation) => evaluation.action);
}

/* ---------------------------------------------------------------- prazos */

export type DisputeDeadlineState = "SEM_PRAZO" | "EM_CURSO" | "EXPIRADO";

export interface DisputeDeadline {
  readonly id: "EVIDENCIA_PROPRIA" | "EVIDENCIA_OUTRA_PARTE" | "RECURSO";
  readonly label: string;
  /** Instante ISO-8601 vindo do servidor. Renderizado como data e hora, nunca como cronômetro. */
  readonly at: string | null;
  readonly state: DisputeDeadlineState;
  readonly windowState: DisputeWindowState;
}

function deadlineState(at: string | null, now: string): DisputeDeadlineState {
  const atTime = parseInstant(at);
  const nowTime = parseInstant(now);
  if (atTime === null || nowTime === null) return "SEM_PRAZO";
  return nowTime > atTime ? "EXPIRADO" : "EM_CURSO";
}

/**
 * Prazos reais do processo. Não deriva prazo nenhum: só reporta o que o servidor enviou,
 * classificado contra `now`. Ausência de prazo é dita, não preenchida.
 */
export function disputeDeadlines(snapshot: DisputeSnapshot, now: string): readonly DisputeDeadline[] {
  return [
    {
      id: "EVIDENCIA_PROPRIA",
      label: "Sua janela de evidência",
      at: snapshot.evidenceWindow.closesAt,
      state: deadlineState(snapshot.evidenceWindow.closesAt, now),
      windowState: snapshot.evidenceWindow.state,
    },
    {
      id: "EVIDENCIA_OUTRA_PARTE",
      label: `Janela de evidência do ${disputeRoleLabels[counterpartRole(snapshot.viewerRole)].toLocaleLowerCase("pt-BR")}`,
      at: snapshot.counterpartEvidenceWindow.closesAt,
      state: deadlineState(snapshot.counterpartEvidenceWindow.closesAt, now),
      windowState: snapshot.counterpartEvidenceWindow.state,
    },
    {
      id: "RECURSO",
      label: "Janela de recurso",
      at: snapshot.appealWindow.closesAt,
      state: deadlineState(snapshot.appealWindow.closesAt, now),
      windowState: snapshot.appealWindow.state,
    },
  ];
}

/* ------------------------------------------------------ escopo de evidência */

export type EvidenceOwner = DisputeRole | "STAFF";

export const evidenceOwnerLabels: Record<EvidenceOwner, string> = {
  COMPRADOR: "Comprador",
  VENDEDOR: "Vendedor",
  STAFF: "Equipe de análise",
};

/**
 * `PROPRIA` — visível apenas a quem enviou e à análise.
 * `COMPARTILHADA` — a política liberou a peça para as duas partes.
 * `RESTRITA_A_STAFF` — nota ou anotação interna: nunca sai para nenhuma das partes.
 */
export type EvidenceVisibility = "PROPRIA" | "COMPARTILHADA" | "RESTRITA_A_STAFF";

export type EvidenceAnalysisState = "EM_QUARENTENA" | "ACEITA" | "REJEITADA";

export const evidenceAnalysisLabels: Record<EvidenceAnalysisState, string> = {
  EM_QUARENTENA: "Em quarentena",
  ACEITA: "Aceita para análise",
  REJEITADA: "Rejeitada",
};

export interface DisputeEvidenceItem {
  readonly evidenceId: string;
  readonly owner: EvidenceOwner;
  readonly visibility: EvidenceVisibility;
  /** Rótulo de tipo, sem nome de arquivo original nem metadado pessoal. */
  readonly kind: string;
  readonly submittedAt: string;
  /** Hash de cadeia de custódia, quando o servidor expõe. */
  readonly sha256: string | null;
  readonly analysisState: EvidenceAnalysisState;
}

export type EvidenceHiddenReason = "ESCOPO_DA_OUTRA_PARTE" | "NOTA_INTERNA_DE_ANALISE";

export const evidenceHiddenExplanations: Record<EvidenceHiddenReason, string> = {
  ESCOPO_DA_OUTRA_PARTE:
    "Peça enviada pela outra parte e não liberada pela política de compartilhamento. A existência é registrada; o conteúdo não é exibido a você.",
  NOTA_INTERNA_DE_ANALISE:
    "Anotação interna da equipe de análise. Não é exibida a nenhuma das partes em nenhuma fase.",
};

export type EvidenceAccess =
  | { readonly visible: true }
  | { readonly visible: false; readonly reason: EvidenceHiddenReason };

/**
 * Requisito de segurança: cada lado vê a própria submissão e apenas o que a política
 * liberou da outra. Nota interna de análise nunca vaza, nem para quem ganhou a disputa.
 */
export function evaluateEvidenceAccess(
  item: DisputeEvidenceItem,
  viewer: DisputeRole,
): EvidenceAccess {
  if (item.visibility === "RESTRITA_A_STAFF") {
    return { visible: false, reason: "NOTA_INTERNA_DE_ANALISE" };
  }
  if (item.owner === viewer) return { visible: true };
  if (item.visibility === "COMPARTILHADA") return { visible: true };
  return { visible: false, reason: "ESCOPO_DA_OUTRA_PARTE" };
}

export function visibleEvidence(
  items: readonly DisputeEvidenceItem[],
  viewer: DisputeRole,
): readonly DisputeEvidenceItem[] {
  return items.filter((item) => evaluateEvidenceAccess(item, viewer).visible);
}

export interface EvidenceScopeSummary {
  readonly own: readonly DisputeEvidenceItem[];
  readonly shared: readonly DisputeEvidenceItem[];
  /** Quantidade de peças da outra parte fora do seu escopo. Metadado de processo, sem conteúdo. */
  readonly withheldFromCounterpart: number;
  /** Quantidade de anotações internas. Contada para transparência, jamais exibida. */
  readonly internalNotes: number;
}

export function summarizeEvidenceScope(
  items: readonly DisputeEvidenceItem[],
  viewer: DisputeRole,
): EvidenceScopeSummary {
  const own: DisputeEvidenceItem[] = [];
  const shared: DisputeEvidenceItem[] = [];
  let withheldFromCounterpart = 0;
  let internalNotes = 0;

  for (const item of items) {
    const access = evaluateEvidenceAccess(item, viewer);
    if (!access.visible) {
      if (access.reason === "NOTA_INTERNA_DE_ANALISE") internalNotes += 1;
      else withheldFromCounterpart += 1;
      continue;
    }
    if (item.owner === viewer) own.push(item);
    else shared.push(item);
  }

  return { own, shared, withheldFromCounterpart, internalNotes };
}

/* ------------------------------------------------ submissão de evidência */

export interface EvidenceConstraints {
  /** Extensões ou tipos aceitos, exatamente como a política publicou. */
  readonly acceptedFormats: readonly string[];
  readonly maxFileBytes: number;
  readonly maxItemsPerParty: number;
}

/**
 * O formulário de anexo só existe no estado `HABILITADA`, e esse estado exige
 * `constraints`. Assim o tipo garante o requisito de acessibilidade: formato e
 * limite aparecem antes de qualquer escolha de arquivo.
 */
export type EvidenceSubmission =
  | {
      readonly state: "HABILITADA";
      readonly constraints: EvidenceConstraints;
      readonly deadline: string | null;
    }
  | { readonly state: "BLOQUEADA"; readonly reason: DisputeDenialReason }
  | { readonly state: "SEM_REGISTRO" };

export function resolveEvidenceSubmission(
  snapshot: DisputeSnapshot,
  constraints: EvidenceConstraints | null,
  now: string,
): EvidenceSubmission {
  const evaluation = evaluateDisputeAction("ENVIAR_EVIDENCIA", snapshot, now);
  if (!evaluation.allowed) {
    return { state: "BLOQUEADA", reason: evaluation.reason ?? "FASE_NAO_PERMITE" };
  }
  if (!constraints) return { state: "BLOQUEADA", reason: "CAPACIDADE_NAO_PUBLICADA" };
  return { state: "HABILITADA", constraints, deadline: evaluation.deadline };
}

/* ----------------------------------------------------------- eventos */

export type DisputeEventActor = EvidenceOwner | "SISTEMA";

export const disputeEventActorLabels: Record<DisputeEventActor, string> = {
  COMPRADOR: "Comprador",
  VENDEDOR: "Vendedor",
  STAFF: "Equipe de análise",
  SISTEMA: "Sistema",
};

export interface DisputeEvent {
  readonly eventId: string;
  readonly at: string;
  readonly phase: DisputePhase;
  readonly actor: DisputeEventActor;
  /** Texto já escopado pelo servidor: sem identidade, sem PII, sem conteúdo restrito. */
  readonly summary: string;
}

/* ------------------------------------------------------------ apresentação */

const instantFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

/**
 * Data e hora absolutas do prazo. Nunca "faltam X horas": a política de motion M0
 * e a regra antimanipulação proíbem cronômetro de urgência em disputa (doc 03 §10).
 */
export function formatDisputeInstant(value: string | null): string {
  if (!value) return "sem data informada";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return instantFormatter.format(new Date(time));
}

/* -------------------------------------------- validação local de anexo */

export type EvidenceFileRejection =
  | "FORMATO_NAO_ACEITO"
  | "TAMANHO_ACIMA_DO_LIMITE"
  | "LIMITE_DE_PECAS_ATINGIDO"
  | "ARQUIVO_VAZIO";

export const evidenceFileRejectionLabels: Record<EvidenceFileRejection, string> = {
  FORMATO_NAO_ACEITO: "Formato não aceito pela política desta disputa.",
  TAMANHO_ACIMA_DO_LIMITE: "Arquivo acima do tamanho máximo publicado.",
  LIMITE_DE_PECAS_ATINGIDO: "Você já atingiu o limite de peças desta submissão.",
  ARQUIVO_VAZIO: "O arquivo selecionado está vazio.",
};

function normalizeFormat(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR").replace(/^\./, "");
}

function fileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLocaleLowerCase("pt-BR") : "";
}

/**
 * Checagem local antes do envio, contra os limites que o servidor publicou.
 * Não substitui a validação e a quarentena do servidor: apenas evita que a pessoa
 * descubra o problema depois de esperar um upload.
 */
export function validateEvidenceFile(
  file: { readonly name: string; readonly size: number },
  constraints: EvidenceConstraints,
  alreadySubmitted: number,
): EvidenceFileRejection | null {
  if (alreadySubmitted >= constraints.maxItemsPerParty) return "LIMITE_DE_PECAS_ATINGIDO";
  if (file.size <= 0) return "ARQUIVO_VAZIO";
  if (file.size > constraints.maxFileBytes) return "TAMANHO_ACIMA_DO_LIMITE";

  const accepted = constraints.acceptedFormats.map(normalizeFormat);
  if (accepted.length === 0) return null;
  const extension = fileExtension(file.name);
  const matches = accepted.some((format) => format === extension || format.endsWith(`/${extension}`));
  return matches ? null : "FORMATO_NAO_ACEITO";
}

/** Tamanho legível para instrução de upload. Base 1024, sem arredondar para menos. */
export function formatByteLimit(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "limite não informado";
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 || Number.isInteger(value) ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded.toLocaleString("pt-BR")} ${units[unit]}`;
}
