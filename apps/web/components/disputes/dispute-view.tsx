"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CircleAlert,
  Gavel,
  Landmark,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { Button, Freshness, PageState, Panel, Skeleton, StatusBadge } from "@midas/ui";
import { useApiResource } from "@/hooks/use-api-resource";
import { isApiError, type ApiError } from "@/lib/api-client";
import { MinorMoney } from "@/components/operations/minor-money";
import { EvidencePanel, type EvidenceSubmitHandler } from "./evidence-panel";
import { DisputePhaseTrack, DisputeTimeline } from "./dispute-timeline";
import {
  actionsAllowedInPhase,
  counterpartRole,
  disputeActionDescriptions,
  disputeActionLabels,
  disputeDeadlines,
  disputeDenialGuidance,
  disputeOutcomeLabels,
  disputePhaseLabels,
  disputePhaseSummaries,
  disputePhases,
  disputeRoleLabels,
  disputeWindowStateLabels,
  disputeActionMatrix,
  financialCommandLabels,
  financialExecutionLabels,
  formatDisputeInstant,
  resolveEvidenceSubmission,
  summarizeEvidenceScope,
  summarizeExecution,
  type DisputeActionEvaluation,
  type DisputeDeadline,
  type DisputeDecision,
  type DisputeEvent,
  type DisputeEvidenceItem,
  type DisputeSnapshot,
  type EvidenceConstraints,
} from "./dispute-state";
import styles from "./disputes.module.css";

/**
 * Rota canônica declarada para SCR-BUY-007 em docs/07-MAPA-DE-TELAS-E-FLUXOS.md.
 * Enquanto a capability não é publicada, a leitura falha de forma tipada e a tela
 * assume o estado honesto — nenhuma fase, prazo ou evidência é simulada.
 */
const DISPUTE_RESOURCE = (disputeId: string) => `/v1/disputes/${encodeURIComponent(disputeId)}`;

interface DisputeResource {
  readonly dispute: DisputeSnapshot;
  readonly evidence: readonly DisputeEvidenceItem[];
  readonly events: readonly DisputeEvent[];
  readonly evidenceConstraints: EvidenceConstraints | null;
  /** Instante da leitura. Serve de relógio de referência: sem clock do cliente, sem cronômetro. */
  readonly asOf: string;
}

/* ------------------------------------------------- validação do contrato */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMember<T extends readonly string[]>(value: unknown, members: T): value is T[number] {
  return typeof value === "string" && (members as readonly string[]).includes(value);
}

const windowStates = ["NAO_ABERTA", "ABERTA", "PRORROGADA", "ENCERRADA"] as const;
const roles = ["COMPRADOR", "VENDEDOR"] as const;
const owners = ["COMPRADOR", "VENDEDOR", "STAFF"] as const;
const visibilities = ["PROPRIA", "COMPARTILHADA", "RESTRITA_A_STAFF"] as const;
const analysisStates = ["EM_QUARENTENA", "ACEITA", "REJEITADA"] as const;
const actors = ["COMPRADOR", "VENDEDOR", "STAFF", "SISTEMA"] as const;
const outcomes = ["COMPRADOR", "VENDEDOR", "DIVIDIDA"] as const;
const commandKinds = ["REFUND", "RELEASE", "SPLIT", "FREEZE"] as const;
const executionStates = ["NAO_INICIADA", "EM_EXECUCAO", "EXECUTADA", "REVERTIDA", "FALHOU"] as const;

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseWindow(value: unknown) {
  if (!isRecord(value) || !isMember(value.state, windowStates)) return null;
  return {
    state: value.state,
    opensAt: nullableString(value.opensAt),
    closesAt: nullableString(value.closesAt),
    closedByParty: value.closedByParty === true,
  };
}

/**
 * Rejeita payload fora do contrato em vez de renderizar estrutura parcial. Um campo
 * de escopo mal formado não pode virar evidência exibida por engano.
 */
function parseDisputeResource(value: unknown): DisputeResource | null {
  if (!isRecord(value) || !isRecord(value.dispute)) return null;
  const raw = value.dispute;

  if (!isMember(raw.phase, disputePhases) || !isMember(raw.viewerRole, roles)) return null;
  if (typeof raw.disputeId !== "string" || typeof raw.orderId !== "string") return null;
  if (typeof raw.openedAt !== "string") return null;

  const evidenceWindow = parseWindow(raw.evidenceWindow);
  const counterpartEvidenceWindow = parseWindow(raw.counterpartEvidenceWindow);
  const appealWindow = parseWindow(raw.appealWindow);
  if (!evidenceWindow || !counterpartEvidenceWindow || !appealWindow) return null;

  const appealFiledBy = Array.isArray(raw.appealFiledBy)
    ? raw.appealFiledBy.filter((role): role is (typeof roles)[number] => isMember(role, roles))
    : [];

  let decision: DisputeDecision | null = null;
  if (isRecord(raw.decision)) {
    const source = raw.decision;
    if (
      !isMember(source.outcome, outcomes)
      || typeof source.reasonCode !== "string"
      || typeof source.rationale !== "string"
      || typeof source.policyVersion !== "string"
      || typeof source.decidedAt !== "string"
    ) return null;
    const effects = Array.isArray(source.effects) ? source.effects : [];
    const parsedEffects = effects.map((effect) => {
      if (
        !isRecord(effect)
        || !isMember(effect.commandKind, commandKinds)
        || !isMember(effect.state, executionStates)
        || typeof effect.amountMinor !== "string"
        || typeof effect.currency !== "string"
      ) return null;
      return {
        commandKind: effect.commandKind,
        state: effect.state,
        amountMinor: effect.amountMinor,
        currency: effect.currency,
        executedAt: nullableString(effect.executedAt),
        ledgerReference: nullableString(effect.ledgerReference),
      };
    });
    if (parsedEffects.some((effect) => effect === null)) return null;
    decision = {
      outcome: source.outcome,
      reasonCode: source.reasonCode,
      rationale: source.rationale,
      policyVersion: source.policyVersion,
      decidedAt: source.decidedAt,
      effects: parsedEffects.filter((effect) => effect !== null),
    };
  }

  const evidence = (Array.isArray(value.evidence) ? value.evidence : [])
    .map((item) => {
      if (
        !isRecord(item)
        || typeof item.evidenceId !== "string"
        || !isMember(item.owner, owners)
        || !isMember(item.visibility, visibilities)
        || typeof item.kind !== "string"
        || typeof item.submittedAt !== "string"
        || !isMember(item.analysisState, analysisStates)
      ) return null;
      return {
        evidenceId: item.evidenceId,
        owner: item.owner,
        visibility: item.visibility,
        kind: item.kind,
        submittedAt: item.submittedAt,
        sha256: nullableString(item.sha256),
        analysisState: item.analysisState,
      };
    });
  if (evidence.some((item) => item === null)) return null;

  const events = (Array.isArray(value.events) ? value.events : [])
    .map((item) => {
      if (
        !isRecord(item)
        || typeof item.eventId !== "string"
        || typeof item.at !== "string"
        || !isMember(item.phase, disputePhases)
        || !isMember(item.actor, actors)
        || typeof item.summary !== "string"
      ) return null;
      return {
        eventId: item.eventId,
        at: item.at,
        phase: item.phase,
        actor: item.actor,
        summary: item.summary,
      };
    });
  if (events.some((item) => item === null)) return null;

  let evidenceConstraints: EvidenceConstraints | null = null;
  if (isRecord(value.evidenceConstraints)) {
    const source = value.evidenceConstraints;
    const formats = Array.isArray(source.acceptedFormats)
      ? source.acceptedFormats.filter((format): format is string => typeof format === "string")
      : [];
    if (
      formats.length === 0
      || typeof source.maxFileBytes !== "number"
      || typeof source.maxItemsPerParty !== "number"
    ) return null;
    evidenceConstraints = {
      acceptedFormats: formats,
      maxFileBytes: source.maxFileBytes,
      maxItemsPerParty: source.maxItemsPerParty,
    };
  }

  return {
    dispute: {
      disputeId: raw.disputeId,
      orderId: raw.orderId,
      phase: raw.phase,
      viewerRole: raw.viewerRole,
      openedAt: raw.openedAt,
      evidenceWindow,
      counterpartEvidenceWindow,
      appealWindow,
      appealFiledBy,
      staffRequestPending: raw.staffRequestPending === true,
      decision,
    },
    evidence: evidence.filter((item) => item !== null),
    events: events.filter((item) => item !== null),
    evidenceConstraints,
    asOf: typeof value.asOf === "string" ? value.asOf : new Date(0).toISOString(),
  };
}

/* ---------------------------------------------------------------- blocos */

function DisputeChrome({ orderId, children }: { orderId: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Trilha de navegação">
        <Link href={`/conta/compras/${encodeURIComponent(orderId)}`}>
          <ArrowLeft aria-hidden="true" size={15} /> Voltar ao pedido
        </Link>
        <span aria-hidden="true">/</span>
        <span>Disputa</span>
      </nav>
      {children}
    </div>
  );
}

function DisputeHeading({
  orderId,
  disputeId,
  phaseBadge,
  meta,
}: {
  orderId: string;
  disputeId: string;
  phaseBadge: ReactNode;
  meta: ReactNode;
}) {
  return (
    <header className={styles.heading}>
      <div>
        <span className={styles.eyebrow}>SCR-BUY-007 · Disputa do pedido</span>
        <h1 id="disputa-titulo">Disputa {disputeId}</h1>
        <p className={styles.headingLead}>
          Esta tela mostra a fase do processo, o prazo real de cada janela, o que você pode fazer agora e como
          recorrer. Enquanto a disputa corre, o valor do pedido <strong>{orderId}</strong> permanece congelado.
        </p>
        {meta}
      </div>
      <div className={styles.headingBadge}>{phaseBadge}</div>
    </header>
  );
}

function ActionRow({
  evaluation,
  control,
}: {
  evaluation: DisputeActionEvaluation;
  control: ReactNode;
}) {
  const guidance = evaluation.reason ? disputeDenialGuidance[evaluation.reason] : null;
  return (
    <li className={styles.actionRow} data-allowed={evaluation.allowed ? "sim" : "nao"}>
      <div className={styles.actionCopy}>
        <div className={styles.actionHead}>
          <strong>{disputeActionLabels[evaluation.action]}</strong>
          <StatusBadge tone={evaluation.allowed ? "success" : "neutral"}>
            {evaluation.allowed ? "Disponível agora" : "Indisponível agora"}
          </StatusBadge>
        </div>
        <p>{disputeActionDescriptions[evaluation.action]}</p>
        {evaluation.allowed && evaluation.deadline ? (
          <p className={styles.actionDeadline}>
            <CalendarClock aria-hidden="true" size={15} />
            Prazo desta ação: <time dateTime={evaluation.deadline}>{formatDisputeInstant(evaluation.deadline)}</time>
          </p>
        ) : null}
        {guidance ? (
          <div className={styles.actionBlocked}>
            <p>
              <CircleAlert aria-hidden="true" size={15} />
              <span><strong>{guidance.title}.</strong> {guidance.explanation}</span>
            </p>
            {guidance.fallback ? (
              <p className={styles.actionFallback}>
                O que ainda cabe: <strong>{disputeActionLabels[guidance.fallback]}</strong>.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {control ? <div className={styles.actionControl}>{control}</div> : null}
    </li>
  );
}

function DeadlinesPanel({ deadlines, headingId }: { deadlines: readonly DisputeDeadline[]; headingId: string }) {
  return (
    <Panel as="section" className={styles.panel} aria-labelledby={headingId}>
      <header className={styles.panelHead}>
        <h3 id={headingId}>Prazos</h3>
        <p className={styles.panelLead}>
          Datas vindas do servidor, em data e hora. Esta tela não exibe contagem regressiva: prazo é informação de
          processo, não pressão.
        </p>
      </header>
      <dl className={styles.deadlineList}>
        {deadlines.map((deadline) => (
          <div key={deadline.id}>
            <dt>{deadline.label}</dt>
            <dd>
              {deadline.at ? (
                <time dateTime={deadline.at}>{formatDisputeInstant(deadline.at)}</time>
              ) : (
                <span>Sem prazo informado pela fonte canônica</span>
              )}
              <span className={styles.deadlineState}>
                {disputeWindowStateLabels[deadline.windowState]}
                {deadline.state === "EXPIRADO" ? " · prazo vencido" : ""}
                {deadline.state === "EM_CURSO" ? " · prazo em curso" : ""}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/**
 * Decisão e execução financeira em blocos separados por exigência de clareza:
 * decidir não move dinheiro, e dizer o contrário gera reclamação legítima.
 */
function DecisionPanel({ decision, headingId }: { decision: DisputeDecision; headingId: string }) {
  const execution = summarizeExecution(decision.effects);
  return (
    <Panel as="section" id="decisao" className={styles.panel} aria-labelledby={headingId}>
      <header className={styles.panelHead}>
        <h3 id={headingId}>Decisão e efeito financeiro</h3>
        <p className={styles.panelLead}>
          O que foi decidido e o que já foi executado no dinheiro são coisas diferentes, e aparecem separadas.
        </p>
      </header>

      <div className={styles.decisionSplit}>
        <article className={styles.decisionBlock}>
          <h4><Gavel aria-hidden="true" size={16} /> O que foi decidido</h4>
          <dl>
            <div>
              <dt>Resultado</dt>
              <dd>{disputeOutcomeLabels[decision.outcome]}</dd>
            </div>
            <div>
              <dt>Motivo estruturado</dt>
              <dd><code>{decision.reasonCode}</code></dd>
            </div>
            <div>
              <dt>Política aplicada</dt>
              <dd><code>{decision.policyVersion}</code></dd>
            </div>
            <div>
              <dt>Publicada em</dt>
              <dd><time dateTime={decision.decidedAt}>{formatDisputeInstant(decision.decidedAt)}</time></dd>
            </div>
          </dl>
          <p className={styles.rationale}>{decision.rationale}</p>
        </article>

        <article className={styles.decisionBlock}>
          <h4><Landmark aria-hidden="true" size={16} /> O que já foi executado no dinheiro</h4>
          <p className={styles.executionState}>
            <StatusBadge tone={execution.settled ? "success" : execution.state === "FALHOU" ? "danger" : "warning"}>
              {financialExecutionLabels[execution.state]}
            </StatusBadge>
            <span>
              {execution.settled
                ? "Todos os comandos financeiros da decisão foram concluídos."
                : "A decisão está publicada, mas os comandos financeiros ainda não se concluíram integralmente."}
            </span>
          </p>
          {decision.effects.length === 0 ? (
            <p className={styles.emptyNote}>
              Nenhum comando financeiro foi emitido até aqui. Nada mudou no seu saldo por conta desta decisão.
            </p>
          ) : (
            <ul className={styles.effectList}>
              {decision.effects.map((effect, index) => (
                <li key={`${effect.commandKind}-${effect.ledgerReference ?? String(index)}`}>
                  <div className={styles.effectHead}>
                    <strong>{financialCommandLabels[effect.commandKind]}</strong>
                    <MinorMoney amountMinor={effect.amountMinor} currency={effect.currency} />
                  </div>
                  <span className={styles.effectState}>{financialExecutionLabels[effect.state]}</span>
                  <span className={styles.effectMeta}>
                    {effect.executedAt ? (
                      <>Executado em <time dateTime={effect.executedAt}>{formatDisputeInstant(effect.executedAt)}</time></>
                    ) : (
                      "Ainda sem data de execução"
                    )}
                    {effect.ledgerReference ? <> · razão <code>{effect.ledgerReference}</code></> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </Panel>
  );
}

function ProcessPolicy({ headingId }: { headingId: string }) {
  return (
    <Panel as="section" className={styles.panel} aria-labelledby={headingId}>
      <header className={styles.panelHead}>
        <h3 id={headingId}>O que cada parte pode fazer em cada fase</h3>
        <p className={styles.panelLead}>
          Regra de processo, idêntica para comprador e vendedor. O que difere entre as partes é a janela de cada uma,
          o pedido de esclarecimento dirigido e quem já recorreu — nunca o direito em si.
        </p>
      </header>
      <div className={styles.policyTableWrap}>
        <table className={styles.policyTable}>
          <caption className={styles.tableCaption}>
            Ações admitidas por fase. A disponibilidade real ainda depende da janela, do prazo e do estado da sua disputa.
          </caption>
          <thead>
            <tr>
              <th scope="col">Fase</th>
              <th scope="col">{disputeRoleLabels.COMPRADOR} e {disputeRoleLabels.VENDEDOR}</th>
            </tr>
          </thead>
          <tbody>
            {disputePhases.map((phase) => (
              <tr key={phase}>
                <th scope="row">{disputePhaseLabels[phase]}</th>
                <td>
                  <ul>
                    {actionsAllowedInPhase(phase).map((action) => (
                      <li key={action}>{disputeActionLabels[action]}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AppealGuide({ headingId }: { headingId: string }) {
  return (
    <Panel as="section" className={styles.panel} aria-labelledby={headingId}>
      <header className={styles.panelHead}>
        <h3 id={headingId}>Como recorrer</h3>
      </header>
      <ol className={styles.guideList}>
        <li>A decisão é publicada com resultado, motivo estruturado, fundamentação e versão da política aplicada.</li>
        <li>Cada parte pode recorrer uma vez, dentro da janela indicada no painel de prazos.</li>
        <li>O recurso preserva a decisão anterior e corre em registro próprio; quando possível, é analisado por outra pessoa.</li>
        <li>Conta restrita ou banida mantém acesso ao pedido, à evidência necessária, ao suporte e ao recurso.</li>
        <li>Nenhum histórico é apagado, e nenhuma informação da outra parte é revelada fora do escopo da política.</li>
      </ol>
    </Panel>
  );
}

/* -------------------------------------------------------------- estados */

function DisputeLoading() {
  return (
    <section className={styles.loading} aria-busy="true" aria-label="Carregando disputa">
      <Skeleton height="3rem" />
      <Skeleton height="12rem" />
      <div className={styles.loadingGrid}>
        <Skeleton height="20rem" />
        <Skeleton height="20rem" />
      </div>
    </section>
  );
}

function DisputeUnavailable({
  error,
  retry,
  disputeId,
}: {
  error: Error | ApiError | null;
  retry: () => void;
  disputeId: string;
}) {
  if (error && !isApiError(error)) {
    return (
      <PageState
        kind="offline"
        title="Não foi possível alcançar o registro da disputa"
        description={`A conexão com a API falhou ao ler ${DISPUTE_RESOURCE(disputeId)}. Nenhuma fase, prazo ou evidência foi exibida no lugar dos dados reais.`}
        actions={<Button onClick={retry}>Tentar novamente</Button>}
      />
    );
  }

  const problem = error && isApiError(error) ? error.problem : null;

  if (!problem || problem.status === 404 || problem.code === "CAPABILITY_NOT_IMPLEMENTED") {
    return (
      <PageState
        kind="unavailable"
        title="CONTRACT_REQUIRED"
        description={`A fonte canônica ${DISPUTE_RESOURCE(disputeId)} ainda não está publicada. O processo abaixo é a política vigente da disputa: fases, janelas, escopo de evidência e recurso. Nenhum dado de disputa foi presumido.`}
        reference={problem?.correlationId ?? "SCR-BUY-007"}
        actions={
          <div className={styles.stateActions}>
            <Button onClick={retry}>Tentar novamente</Button>
            <Link className="text-link" href="/ajuda">Central de ajuda</Link>
          </div>
        }
      />
    );
  }

  if (problem.status === 403) {
    return (
      <PageState
        kind="forbidden"
        title="Acesso não autorizado a esta disputa"
        description={problem.detail || "Apenas as partes do pedido acessam esta disputa, e cada uma dentro do próprio escopo. A tentativa foi registrada."}
        reference={problem.correlationId ?? "SCR-BUY-007"}
        actions={<Link className="button-link" href="/conta/compras">Voltar às minhas compras</Link>}
      />
    );
  }

  return (
    <PageState
      kind="error"
      title={problem.title || "Não foi possível carregar a disputa"}
      description={problem.detail || "Tente novamente. Nenhuma fase, prazo ou evidência foi presumida pela interface."}
      reference={problem.correlationId ?? "SCR-BUY-007"}
      actions={<Button onClick={retry}>Tentar novamente</Button>}
    />
  );
}

/* ------------------------------------------------------------ superfície */

export function DisputeView({ orderId, disputeId }: { orderId: string; disputeId: string }) {
  const resource = useApiResource<unknown>(DISPUTE_RESOURCE(disputeId));
  const parsed = resource.status === "ready" ? parseDisputeResource(resource.data) : null;

  /**
   * Mutações de disputa (anexar, encerrar submissão, responder, recorrer) dependem de
   * comandos que a API ainda não publicou. Enquanto `null`, nenhum controle de envio é
   * renderizado — a tela prefere explicar o processo a oferecer um botão que não age.
   */
  const submitEvidence: EvidenceSubmitHandler | null = null;

  if (resource.status === "idle" || resource.status === "loading") {
    return (
      <DisputeChrome orderId={orderId}>
        <div role="status" aria-live="polite" className={styles.srStatus}>Carregando a disputa.</div>
        <DisputeLoading />
      </DisputeChrome>
    );
  }

  if (!parsed) {
    const contractError = resource.status === "error" ? resource.error : null;
    return (
      <DisputeChrome orderId={orderId}>
        <DisputeHeading
          orderId={orderId}
          disputeId={disputeId}
          phaseBadge={<StatusBadge tone="warning">Registro indisponível</StatusBadge>}
          meta={
            <p className={styles.headingNote}>
              <ShieldCheck aria-hidden="true" size={15} />
              Fonte canônica: <code>{DISPUTE_RESOURCE(disputeId)}</code>
            </p>
          }
        />

        <div role="status" aria-live="polite">
          <DisputeUnavailable error={contractError} retry={resource.retry} disputeId={disputeId} />
        </div>

        <div className={styles.layout}>
          <div className={styles.main}>
            <Panel as="section" className={styles.panel} aria-labelledby="fases-processo">
              <header className={styles.panelHead}>
                <h3 id="fases-processo"><ScrollText aria-hidden="true" size={16} /> Fases da disputa</h3>
                <p className={styles.panelLead}>
                  Sequência do processo, sem afirmar em que ponto esta disputa está. A fase real aparece assim que o
                  registro for lido da fonte canônica.
                </p>
              </header>
              <DisputePhaseTrack current={null} headingId="fases-processo" />
            </Panel>

            <ProcessPolicy headingId="politica-fases" />

            <EvidencePanel
              viewerRole="COMPRADOR"
              scope={null}
              submission={{ state: "SEM_REGISTRO" }}
              onSubmit={null}
              headingId="evidencias-politica"
            />

            <Panel as="section" className={styles.panel} aria-labelledby="historico-processo">
              <header className={styles.panelHead}>
                <h3 id="historico-processo">Histórico</h3>
              </header>
              <DisputeTimeline events={[]} headingId="historico-processo" />
            </Panel>
          </div>

          <aside className={styles.aside} aria-label="Referências do processo">
            <AppealGuide headingId="recurso-guia" />
            <Panel as="section" className={styles.panel} aria-labelledby="garantias-processo">
              <header className={styles.panelHead}>
                <h3 id="garantias-processo"><BookOpen aria-hidden="true" size={16} /> Garantias do processo</h3>
              </header>
              <ul className={styles.guaranteeList}>
                <li>Abertura congela ações incompatíveis do pedido e do lote financeiro.</li>
                <li>Cada parte vê a própria submissão e apenas o que a política libera da outra.</li>
                <li>Prazo vencido fecha uma via específica; não presume culpa nem entrega.</li>
                <li>Decisão publicada e execução financeira são registros distintos.</li>
                <li>Leitura, exportação, decisão e recurso são auditados.</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </DisputeChrome>
    );
  }

  const { dispute, evidence, events, evidenceConstraints, asOf } = parsed;
  const matrix = disputeActionMatrix(dispute, asOf);
  const deadlines = disputeDeadlines(dispute, asOf);
  const scope = summarizeEvidenceScope(evidence, dispute.viewerRole);
  const submission = resolveEvidenceSubmission(dispute, evidenceConstraints, asOf);
  const seeDecision = matrix.find((evaluation) => evaluation.action === "VER_DECISAO");

  return (
    <DisputeChrome orderId={dispute.orderId}>
      <DisputeHeading
        orderId={dispute.orderId}
        disputeId={dispute.disputeId}
        phaseBadge={<StatusBadge tone="info">{disputePhaseLabels[dispute.phase]}</StatusBadge>}
        meta={
          <div className={styles.headingMeta}>
            <span>
              Você acompanha como <strong>{disputeRoleLabels[dispute.viewerRole].toLocaleLowerCase("pt-BR")}</strong>;
              a outra parte é o {disputeRoleLabels[counterpartRole(dispute.viewerRole)].toLocaleLowerCase("pt-BR")}.
            </span>
            <span>Aberta em <time dateTime={dispute.openedAt}>{formatDisputeInstant(dispute.openedAt)}</time></span>
            <Freshness asOf={asOf} label="Situação lida em" />
          </div>
        }
      />

      <div className={styles.layout}>
        <div className={styles.main}>
          <Panel as="section" className={styles.panel} aria-labelledby="fase-atual">
            <header className={styles.panelHead}>
              <h3 id="fase-atual">Onde a disputa está</h3>
              <p className={styles.panelLead}>{disputePhaseSummaries[dispute.phase]}</p>
            </header>
            <DisputePhaseTrack current={dispute.phase} headingId="fase-atual" />
          </Panel>

          <Panel as="section" className={styles.panel} aria-labelledby="acoes-agora">
            <header className={styles.panelHead}>
              <h3 id="acoes-agora">O que você pode fazer agora</h3>
              <p className={styles.panelLead}>
                Avaliado contra a fase, a sua janela e o prazo lido do servidor. Quando uma via está fechada, a tela diz
                por quê e o que ainda cabe.
              </p>
            </header>
            <ul className={styles.actionList}>
              {matrix.map((evaluation) => (
                <ActionRow
                  key={evaluation.action}
                  evaluation={evaluation}
                  control={
                    evaluation.action === "VER_DECISAO" && evaluation.allowed ? (
                      <a className="button-link" href="#decisao">Ir para a decisão</a>
                    ) : null
                  }
                />
              ))}
            </ul>
            {matrix.some((evaluation) => evaluation.allowed && evaluation.action !== "VER_DECISAO") ? (
              <p className={styles.commandNote}>
                <CircleAlert aria-hidden="true" size={15} />
                A execução destas ações depende dos comandos de <code>{DISPUTE_RESOURCE(dispute.disputeId)}</code>.
                Enquanto não estiverem publicados, nenhum controle de envio é oferecido aqui.
              </p>
            ) : null}
          </Panel>

          <EvidencePanel
            viewerRole={dispute.viewerRole}
            scope={scope}
            submission={submission}
            onSubmit={submitEvidence}
            headingId="evidencias"
          />

          {dispute.decision && seeDecision?.allowed ? (
            <DecisionPanel decision={dispute.decision} headingId="decisao-titulo" />
          ) : null}

          <Panel as="section" className={styles.panel} aria-labelledby="historico">
            <header className={styles.panelHead}>
              <h3 id="historico">Histórico da disputa</h3>
              <p className={styles.panelLead}>
                Registro do que já aconteceu, com data e autor por papel. Identidade e conteúdo restrito não aparecem.
              </p>
            </header>
            <DisputeTimeline events={events} headingId="historico" />
          </Panel>
        </div>

        <aside className={styles.aside} aria-label="Prazos e recurso">
          <DeadlinesPanel deadlines={deadlines} headingId="prazos" />
          <AppealGuide headingId="recurso" />
          <ProcessPolicy headingId="politica-fases-atual" />
        </aside>
      </div>
    </DisputeChrome>
  );
}
