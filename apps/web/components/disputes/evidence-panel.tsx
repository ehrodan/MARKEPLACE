"use client";

import { useId, useRef, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { CircleAlert, FileCheck, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button, Panel, StatusBadge } from "@midas/ui";
import {
  disputeActionLabels,
  disputeDenialGuidance,
  evidenceAnalysisLabels,
  evidenceHiddenExplanations,
  evidenceOwnerLabels,
  formatByteLimit,
  formatDisputeInstant,
  validateEvidenceFile,
  evidenceFileRejectionLabels,
  type DisputeDenialReason,
  type DisputeEvidenceItem,
  type DisputeRole,
  type EvidenceConstraints,
  type EvidenceScopeSummary,
  type EvidenceSubmission,
} from "./dispute-state";
import styles from "./disputes.module.css";

export type EvidenceSubmitHandler = (input: { file: File; description: string }) => Promise<void>;

function ConstraintList({ constraints, id }: { constraints: EvidenceConstraints; id: string }) {
  return (
    <div className={styles.constraints} id={id}>
      <strong>Antes de escolher o arquivo</strong>
      <ul>
        <li>
          Formatos aceitos:{" "}
          <span className={styles.constraintValue}>{constraints.acceptedFormats.join(", ")}</span>
        </li>
        <li>
          Tamanho máximo por arquivo:{" "}
          <span className={styles.constraintValue}>{formatByteLimit(constraints.maxFileBytes)}</span>
        </li>
        <li>
          Limite de peças na sua submissão:{" "}
          <span className={styles.constraintValue}>{constraints.maxItemsPerParty}</span>
        </li>
        <li>
          Todo anexo passa por quarentena antes de ser considerado, e recebe hash de custódia.
          Não anexe senha, token, documento de identidade ou dado de pagamento.
        </li>
      </ul>
    </div>
  );
}

function SubmissionForm({
  constraints,
  deadline,
  alreadySubmitted,
  onSubmit,
}: {
  constraints: EvidenceConstraints;
  deadline: string | null;
  alreadySubmitted: number;
  onSubmit: EvidenceSubmitHandler;
}) {
  const constraintsId = useId();
  const fileId = useId();
  const descriptionId = useId();
  const feedbackId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setConfirmation(null);
    const file = event.currentTarget.files?.[0];
    if (!file) {
      setError(null);
      return;
    }
    const rejection = validateEvidenceFile(file, constraints, alreadySubmitted);
    setError(rejection ? evidenceFileRejectionLabels[rejection] : null);
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmation(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("evidencia");
    const rawDescription = data.get("descricao");
    const description = typeof rawDescription === "string" ? rawDescription.trim() : "";

    if (!(file instanceof File) || file.size === 0) {
      setError("Selecione um arquivo para anexar à sua submissão.");
      return;
    }
    const rejection = validateEvidenceFile(file, constraints, alreadySubmitted);
    if (rejection) {
      setError(evidenceFileRejectionLabels[rejection]);
      return;
    }
    if (!description) {
      setError("Descreva em uma frase o que esta peça demonstra. A análise lê a descrição junto do arquivo.");
      return;
    }

    setError(null);
    setSending(true);
    try {
      await onSubmit({ file, description });
      setConfirmation("Peça registrada na sua submissão. Ela entra em quarentena antes de ser considerada.");
      formRef.current?.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "O envio não foi concluído. Nada foi anexado.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form ref={formRef} className={styles.submissionForm} onSubmit={(event) => { void handleSubmit(event); }} noValidate>
      <ConstraintList constraints={constraints} id={constraintsId} />

      <div className={styles.field}>
        <label htmlFor={fileId}>Arquivo da evidência</label>
        <input
          id={fileId}
          name="evidencia"
          type="file"
          accept={constraints.acceptedFormats.map((format) => (format.includes("/") ? format : `.${format.replace(/^\./, "")}`)).join(",")}
          aria-describedby={`${constraintsId} ${feedbackId}`}
          aria-invalid={error ? true : undefined}
          onChange={handleFileChange}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={descriptionId}>O que esta peça demonstra</label>
        <textarea
          id={descriptionId}
          name="descricao"
          rows={3}
          aria-describedby={feedbackId}
          aria-invalid={error ? true : undefined}
        />
      </div>

      <div className={styles.feedback} id={feedbackId} role="status" aria-live="polite">
        {error ? (
          <p className={styles.feedbackError}>
            <TriangleAlert aria-hidden="true" size={16} />
            <span><strong>Não enviado.</strong> {error}</span>
          </p>
        ) : null}
        {confirmation ? (
          <p className={styles.feedbackOk}>
            <FileCheck aria-hidden="true" size={16} />
            <span>{confirmation}</span>
          </p>
        ) : null}
        {!error && !confirmation ? (
          <p className={styles.feedbackHint}>
            Prazo desta submissão: <strong>{formatDisputeInstant(deadline)}</strong>. Encerrar a submissão é opcional
            e não antecipa decisão.
          </p>
        ) : null}
      </div>

      <Button type="submit" loading={sending} loadingLabel="Enviando">
        Anexar à minha submissão
      </Button>
    </form>
  );
}

function BlockedSubmission({ reason }: { reason: DisputeDenialReason }) {
  const guidance = disputeDenialGuidance[reason];
  return (
    <div className={styles.blocked} role="status">
      <span className={styles.blockedIcon} aria-hidden="true"><Lock size={18} /></span>
      <div>
        <strong>{guidance.title}</strong>
        <p>{guidance.explanation}</p>
        {guidance.fallback ? (
          <p className={styles.blockedFallback}>
            <CircleAlert aria-hidden="true" size={15} />
            O que ainda cabe: <strong>{disputeActionLabels[guidance.fallback]}</strong>.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EvidenceList({
  title,
  items,
  emptyNote,
}: {
  title: string;
  items: readonly DisputeEvidenceItem[];
  emptyNote: string;
}) {
  return (
    <div className={styles.evidenceGroup}>
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className={styles.emptyNote}>{emptyNote}</p>
      ) : (
        <ul className={styles.evidenceList}>
          {items.map((item) => (
            <li key={item.evidenceId}>
              <div className={styles.evidenceHead}>
                <strong>{item.kind}</strong>
                <StatusBadge tone={item.analysisState === "REJEITADA" ? "danger" : item.analysisState === "ACEITA" ? "success" : "warning"}>
                  {evidenceAnalysisLabels[item.analysisState]}
                </StatusBadge>
              </div>
              <dl className={styles.evidenceMeta}>
                <div>
                  <dt>Enviada por</dt>
                  <dd>{evidenceOwnerLabels[item.owner]}</dd>
                </div>
                <div>
                  <dt>Recebida em</dt>
                  <dd><time dateTime={item.submittedAt}>{formatDisputeInstant(item.submittedAt)}</time></dd>
                </div>
                <div>
                  <dt>Hash de custódia</dt>
                  <dd><code>{item.sha256 ?? "não informado"}</code></dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Painel de evidências com escopo bilateral.
 *
 * Regra de segurança implementada aqui: só chegam a este componente as peças que
 * `summarizeEvidenceScope` já liberou para o papel de quem lê. Peça da outra parte fora
 * do escopo e nota interna de análise entram apenas como contagem, jamais como conteúdo.
 */
export function EvidencePanel({
  viewerRole,
  scope,
  submission,
  onSubmit,
  headingId,
}: {
  viewerRole: DisputeRole;
  scope: EvidenceScopeSummary | null;
  submission: EvidenceSubmission;
  onSubmit: EvidenceSubmitHandler | null;
  headingId: string;
}) {
  return (
    <Panel as="section" className={styles.panel} aria-labelledby={headingId}>
      <header className={styles.panelHead}>
        <h3 id={headingId}>Evidências</h3>
        <p className={styles.panelLead}>
          Você vê o que enviou e o que a política liberou da outra parte. Nada além disso é exibido, em nenhuma fase,
          nem depois da decisão.
        </p>
      </header>

      <p className={styles.scopeNotice}>
        <ShieldCheck aria-hidden="true" size={16} />
        <span>
          Escopo aplicado ao papel <strong>{viewerRole === "COMPRADOR" ? "comprador" : "vendedor"}</strong>. Identidade,
          contato e anotação interna da análise não são expostos a nenhuma das partes.
        </span>
      </p>

      {scope ? (
        <>
          <EvidenceList
            title="Enviadas por você"
            items={scope.own}
            emptyNote="Você ainda não anexou nenhuma peça a esta disputa."
          />
          <EvidenceList
            title="Liberadas para as duas partes"
            items={scope.shared}
            emptyNote="Nenhuma peça foi liberada para as duas partes até aqui."
          />
          {scope.withheldFromCounterpart > 0 || scope.internalNotes > 0 ? (
            <p className={styles.withheld}>
              <Lock aria-hidden="true" size={15} />
              <span>
                {scope.withheldFromCounterpart > 0
                  ? `${scope.withheldFromCounterpart.toLocaleString("pt-BR")} peça(s) da outra parte fora do seu escopo. ${evidenceHiddenExplanations.ESCOPO_DA_OUTRA_PARTE} `
                  : ""}
                {scope.internalNotes > 0
                  ? `${scope.internalNotes.toLocaleString("pt-BR")} anotação(ões) interna(s) de análise. ${evidenceHiddenExplanations.NOTA_INTERNA_DE_ANALISE}`
                  : ""}
              </span>
            </p>
          ) : null}
        </>
      ) : (
        <p className={styles.emptyNote}>
          <Lock aria-hidden="true" size={15} />
          Nenhuma peça foi carregada: sem registro de disputa não há evidência a exibir, e nada é simulado no lugar.
        </p>
      )}

      <div className={styles.submissionArea}>
        <h4>Enviar evidência</h4>
        {submission.state === "HABILITADA" && onSubmit !== null ? (
          <SubmissionForm
            constraints={submission.constraints}
            deadline={submission.deadline}
            alreadySubmitted={scope?.own.length ?? 0}
            onSubmit={onSubmit}
          />
        ) : (
          <>
            <p className={styles.constraintsMissing}>
              Formatos aceitos, tamanho máximo e limite de peças são publicados junto do registro da disputa
              (<code>/v1/disputes/{"{id}"}</code>). Nenhum limite foi presumido nesta tela.
            </p>
            <BlockedSubmission
              reason={submission.state === "BLOQUEADA" ? submission.reason : "CAPACIDADE_NAO_PUBLICADA"}
            />
          </>
        )}
      </div>
    </Panel>
  );
}
