"use client";

import { useRef, useState, type SyntheticEvent } from "react";
import { FileCheck2, ShieldCheck, X } from "lucide-react";
import { Button, PageState, Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceLoading } from "@/components/resource-state";
import { StatusLabel } from "@/components/status-label";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date-format";
import type { PaymentResolutionCase, PaymentResolutionCaseList } from "./finance-types";
import { OperationsResourceError } from "./operations-resource-state";
import { OperationsSourceBar } from "./operations-source-bar";
import styles from "./operations-dashboard.module.css";

type CaseStatusFilter = "OPEN" | "APPROVED" | "REJECTED";
type Decision = "APPROVE" | "REJECT";

function actionErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.problem.detail || error.problem.title;
  return error instanceof Error ? error.message : "A operação não foi concluída.";
}

export function AdminPaymentsView() {
  const [status, setStatus] = useState<CaseStatusFilter>("OPEN");
  const [paymentId, setPaymentId] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [evidenceLocator, setEvidenceLocator] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<PaymentResolutionCase | null>(null);
  const [decision, setDecision] = useState<Decision>("APPROVE");
  const [reviewReason, setReviewReason] = useState("");
  const [deciding, setDeciding] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const endpoint = `/v1/admin/payment-resolution-cases?status=${status}`;
  const resource = useApiResource<PaymentResolutionCaseList>(endpoint);

  const createCase = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    setConfirmation(null);
    try {
      const created = await apiRequest<PaymentResolutionCase>(
        `/v1/admin/payments/${encodeURIComponent(paymentId.trim())}/resolution-cases`,
        {
          method: "POST",
          body: JSON.stringify({ reasonCode: reasonCode.trim(), evidenceLocator: evidenceLocator.trim() }),
        },
      );
      setPaymentId("");
      setReasonCode("");
      setEvidenceLocator("");
      setStatus("OPEN");
      setConfirmation(`Caso ${created.resolutionCaseId} aberto pela API.`);
      resource.retry();
    } catch (error) {
      setCreateError(actionErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const openDecision = (item: PaymentResolutionCase, trigger: HTMLButtonElement) => {
    setSelectedCase(item);
    setDecision("APPROVE");
    setReviewReason("");
    setDecisionError(null);
    lastTriggerRef.current = trigger;
    dialogRef.current?.showModal();
  };

  const decideCase = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    if (!selectedCase) return;
    setDeciding(true);
    setDecisionError(null);
    setConfirmation(null);
    try {
      const updated = await apiRequest<PaymentResolutionCase>(
        `/v1/admin/payment-resolution-cases/${encodeURIComponent(selectedCase.resolutionCaseId)}/decisions`,
        {
          method: "POST",
          body: JSON.stringify({ decision, reviewReason: reviewReason.trim() }),
        },
      );
      dialogRef.current?.close();
      setConfirmation(`Caso ${updated.resolutionCaseId} atualizado para ${updated.caseStatus} pela API.`);
      resource.retry();
    } catch (error) {
      setDecisionError(actionErrorMessage(error));
    } finally {
      setDeciding(false);
    }
  };

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="ADMIN · PAGAMENTOS"
        title="Resolução manual de pagamentos"
        description="Abra casos com evidência e decida em segunda pessoa. A aprovação percorre a mesma liquidação e o mesmo hold do fluxo automático."
      />
      <div className={styles.notice} role="note">
        <ShieldCheck aria-hidden="true" size={19} />
        <p>Maker-checker é obrigatório: quem abre o caso não pode aprová-lo ou rejeitá-lo. A API revalida o grant e registra auditoria.</p>
      </div>
      <Panel className={styles.formPanel}>
        <div>
          <h2>Abrir caso de resolução</h2>
          <p>Use apenas uma evidência verificável. Nenhum pagamento é confirmado ao preencher este formulário.</p>
        </div>
        <form className={styles.formGrid} onSubmit={(event) => { void createCase(event); }}>
          <div className={styles.field}>
            <label htmlFor="resolution-payment-id">ID do pagamento</label>
            <input id="resolution-payment-id" value={paymentId} onChange={(event) => { setPaymentId(event.target.value); }} required />
          </div>
          <div className={styles.field}>
            <label htmlFor="resolution-reason">Código do motivo</label>
            <input id="resolution-reason" value={reasonCode} onChange={(event) => { setReasonCode(event.target.value); }} maxLength={120} placeholder="PAYMENT_CONFIRMED_EXTERNALLY" required />
          </div>
          <div className={styles.field}>
            <label htmlFor="resolution-evidence">Localizador da evidência</label>
            <input id="resolution-evidence" value={evidenceLocator} onChange={(event) => { setEvidenceLocator(event.target.value); }} maxLength={1000} placeholder="Referência no repositório autorizado" required />
          </div>
          <Button type="submit" loading={creating} loadingLabel="Abrindo caso">Abrir caso</Button>
        </form>
        {createError ? <p className={styles.errorText} role="alert">{createError}</p> : null}
        {confirmation ? <p className={styles.successText} role="status">{confirmation}</p> : null}
      </Panel>
      <div className={styles.filterRow}>
        <div className={styles.field}>
          <label htmlFor="case-status">Estado da fila</label>
          <select id="case-status" value={status} onChange={(event) => { setStatus(event.target.value as CaseStatusFilter); }}>
            <option value="OPEN">Abertos</option>
            <option value="APPROVED">Aprovados</option>
            <option value="REJECTED">Rejeitados</option>
          </select>
        </div>
        {resource.status === "ready" ? <span className={styles.count} aria-live="polite">{resource.data.data.length} casos retornados</span> : null}
      </div>
      {resource.status !== "ready" ? (
        resource.status === "error"
          ? <OperationsResourceError error={resource.error} retry={resource.retry} />
          : <ResourceLoading label="Carregando casos de resolução" />
      ) : (
        <>
          <OperationsSourceBar source={`GET ${endpoint}`} scope={`grant financeiro · ${status}`} asOf={resource.data.asOf} />
          {!resource.data.data.length ? (
            <PageState kind="empty" title={`Nenhum caso ${status.toLocaleLowerCase("pt-BR")}`} description="A fila canônica retornou zero registros para este estado." />
          ) : (
            <Panel className={styles.tablePanel}>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <caption>Casos de resolução manual de pagamentos</caption>
                  <thead><tr><th scope="col">Caso</th><th scope="col">Motivo e evidência</th><th scope="col">Estado</th><th scope="col">Criado em</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
                  <tbody>
                    {resource.data.data.map((item) => (
                      <tr key={item.resolutionCaseId}>
                        <td className={styles.primary}><strong>{item.resolutionCaseId}</strong><small>Pagamento {item.paymentId}</small></td>
                        <td><strong>{item.reasonCode}</strong><span className={styles.code} title={item.evidenceLocator}>{item.evidenceLocator}</span></td>
                        <td><StatusLabel status={item.caseStatus} /></td>
                        <td><time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time></td>
                        <td className={styles.actionCell}>{item.caseStatus === "OPEN" ? <Button size="small" variant="outline" onClick={(event) => { openDecision(item, event.currentTarget); }}>Revisar</Button> : <span className={styles.secondary}>{item.reviewedAt ? formatDateTime(item.reviewedAt) : "Sem revisão"}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
      <dialog ref={dialogRef} className={styles.modal} aria-labelledby="decision-title" onClose={() => { lastTriggerRef.current?.focus(); }}>
        <form onSubmit={(event) => { void decideCase(event); }}>
          <header className={styles.modalHeader}>
            <h2 id="decision-title">Decidir caso de pagamento</h2>
            <Button type="button" size="small" variant="ghost" aria-label="Fechar decisão" onClick={() => { dialogRef.current?.close(); }} iconBefore={<X aria-hidden="true" size={18} />}>Fechar</Button>
          </header>
          <div className={styles.modalBody}>
            <div className={styles.dialogContext}><strong>Pagamento em revisão</strong><code>{selectedCase?.paymentId}</code><span>{selectedCase?.reasonCode}</span></div>
            <div className={styles.guardrail}><FileCheck2 aria-hidden="true" size={18} /><span>A decisão só produz efeito depois da resposta válida da API. Conflitos de segregação de função retornam 403.</span></div>
            <div className={styles.field}>
              <label htmlFor="resolution-decision">Decisão</label>
              <select id="resolution-decision" value={decision} onChange={(event) => { setDecision(event.target.value as Decision); }}>
                <option value="APPROVE">Aprovar pagamento confirmado</option>
                <option value="REJECT">Rejeitar evidência</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="resolution-review-reason">Justificativa da revisão</label>
              <textarea id="resolution-review-reason" value={reviewReason} onChange={(event) => { setReviewReason(event.target.value); }} maxLength={500} required />
            </div>
            {decisionError ? <p className={styles.errorText} role="alert">{decisionError}</p> : null}
          </div>
          <footer className={styles.modalActions}>
            <Button type="button" variant="ghost" onClick={() => { dialogRef.current?.close(); }}>Cancelar</Button>
            <Button type="submit" variant={decision === "REJECT" ? "danger" : "primary"} loading={deciding} loadingLabel="Registrando decisão">Registrar decisão</Button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
