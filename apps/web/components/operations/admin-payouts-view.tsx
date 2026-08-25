"use client";

import { useRef, useState, type SyntheticEvent } from "react";
import { ClipboardCheck, ShieldCheck, X } from "lucide-react";
import { Button, PageState, Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceLoading } from "@/components/resource-state";
import { StatusLabel } from "@/components/status-label";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date-format";
import type { PayoutCapability, PayoutRequest, PayoutRequestList } from "./finance-types";
import { MinorMoney } from "./minor-money";
import { OperationsResourceError } from "./operations-resource-state";
import { OperationsSourceBar } from "./operations-source-bar";
import styles from "./operations-dashboard.module.css";

type PayoutStatusFilter = "ALL" | PayoutRequest["payoutStatus"];
type EvidenceAction = "EXECUTE" | "CONFIRM";

const statusOptions: Array<{ value: PayoutStatusFilter; label: string }> = [
  { value: "REQUESTED", label: "Solicitados" },
  { value: "UNDER_REVIEW", label: "Em revisão" },
  { value: "INFORMATION_REQUIRED", label: "Informação necessária" },
  { value: "APPROVED", label: "Aprovados" },
  { value: "EXECUTING", label: "Em execução" },
  { value: "CONFIRMATION_PENDING", label: "Aguardando confirmação" },
  { value: "PAID", label: "Pagos" },
  { value: "FAILED", label: "Falhos" },
  { value: "RETURNED", label: "Devolvidos" },
  { value: "REJECTED", label: "Rejeitados" },
  { value: "CANCELED", label: "Cancelados" },
  { value: "ALL", label: "Todos" },
];

function actionErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.problem.detail || error.problem.title;
  return error instanceof Error ? error.message : "A operação não foi concluída.";
}

export function AdminPayoutsView() {
  const [status, setStatus] = useState<PayoutStatusFilter>("REQUESTED");
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [evidenceAction, setEvidenceAction] = useState<EvidenceAction | null>(null);
  const [externalReference, setExternalReference] = useState("");
  const [evidenceLocator, setEvidenceLocator] = useState("");
  const [evidenceSha256, setEvidenceSha256] = useState("");
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const endpoint = status === "ALL" ? "/v1/admin/payouts" : `/v1/admin/payouts?status=${status}`;
  const resource = useApiResource<PayoutRequestList>(endpoint);
  const capability = useApiResource<PayoutCapability>("/v1/finance/payout-capability?countryCode=BR&currency=BRL&mode=EXTERNAL_MANUAL");
  const executionAvailable = capability.status === "ready" && capability.data.status === "AVAILABLE";

  const transitionPayout = async (item: PayoutRequest, action: "claim" | "approve") => {
    setMutatingId(item.payoutRequestId);
    setActionError(null);
    setConfirmation(null);
    try {
      const updated = await apiRequest<PayoutRequest>(`/v1/admin/payouts/${encodeURIComponent(item.payoutRequestId)}/${action}`, { method: "POST" });
      const label = action === "claim" ? "assumida para revisão" : "aprovada";
      setConfirmation(`Solicitação ${updated.payoutRequestId} ${label} pela API.`);
      resource.retry();
    } catch (error) {
      setActionError(actionErrorMessage(error));
    } finally {
      setMutatingId(null);
    }
  };

  const openEvidenceAction = (item: PayoutRequest, action: EvidenceAction, trigger: HTMLButtonElement) => {
    setSelectedPayout(item);
    setEvidenceAction(action);
    setExternalReference("");
    setEvidenceLocator("");
    setEvidenceSha256("");
    setEvidenceError(null);
    idempotencyKeyRef.current = crypto.randomUUID();
    lastTriggerRef.current = trigger;
    dialogRef.current?.showModal();
  };

  const invalidateIdempotencyKey = () => {
    idempotencyKeyRef.current = crypto.randomUUID();
  };

  const submitEvidence = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    if (!selectedPayout || !evidenceAction || !executionAvailable) return;
    setSubmittingEvidence(true);
    setEvidenceError(null);
    setConfirmation(null);
    try {
      const execution = evidenceAction === "EXECUTE";
      const path = execution ? "executions" : "confirmations";
      const body = execution
        ? {
            externalReference: externalReference.trim(),
            evidenceLocator: evidenceLocator.trim(),
            evidenceSha256: evidenceSha256.trim(),
          }
        : {
            confirmationEvidenceLocator: evidenceLocator.trim(),
            confirmationEvidenceSha256: evidenceSha256.trim(),
          };
      const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
      idempotencyKeyRef.current = idempotencyKey;
      const updated = await apiRequest<PayoutRequest>(
        `/v1/admin/payouts/${encodeURIComponent(selectedPayout.payoutRequestId)}/${path}`,
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify(body),
        },
      );
      dialogRef.current?.close();
      const resultLabel = execution ? "execução registrada" : "confirmação homologada";
      setConfirmation(`Solicitação ${updated.payoutRequestId}: ${resultLabel} pela API.`);
      resource.retry();
    } catch (error) {
      setEvidenceError(actionErrorMessage(error));
    } finally {
      setSubmittingEvidence(false);
    }
  };

  const actionFor = (item: PayoutRequest) => {
    if (item.payoutStatus === "REQUESTED") {
      return <Button size="small" variant="outline" loading={mutatingId === item.payoutRequestId} loadingLabel="Assumindo" onClick={() => { void transitionPayout(item, "claim"); }}>Fazer claim</Button>;
    }
    if (item.payoutStatus === "UNDER_REVIEW") {
      return <Button size="small" variant="outline" loading={mutatingId === item.payoutRequestId} loadingLabel="Aprovando" onClick={() => { void transitionPayout(item, "approve"); }}>Aprovar</Button>;
    }
    if (item.payoutStatus === "APPROVED") {
      return <Button size="small" disabled={!executionAvailable} title={executionAvailable ? undefined : "Capability de execução indisponível"} onClick={(event) => { openEvidenceAction(item, "EXECUTE", event.currentTarget); }}>Registrar execução</Button>;
    }
    if (item.payoutStatus === "CONFIRMATION_PENDING") {
      return <Button size="small" disabled={!executionAvailable} title={executionAvailable ? undefined : "Capability de confirmação indisponível"} onClick={(event) => { openEvidenceAction(item, "CONFIRM", event.currentTarget); }}>Confirmar pagamento</Button>;
    }
    return <span className={styles.secondary}>{item.completedAt ? formatDateTime(item.completedAt) : "Sem ação disponível"}</span>;
  };

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="ADMIN · SAQUES"
        title="Fila operacional de saques"
        description="Claim, revisão, aprovação, execução e confirmação permanecem em etapas separadas e auditáveis."
      />
      <div className={styles.notice} role="note">
        <ShieldCheck aria-hidden="true" size={19} />
        <p>O estado PAID só é alcançado depois de confirmação por fonte homologada. Referência manual isolada nunca baixa saldo.</p>
      </div>
      {capability.status === "ready" ? (
        <div className={styles.notice} role="status">
          <ClipboardCheck aria-hidden="true" size={19} />
          <p>Execução EXTERNAL_MANUAL BR/BRL: <strong>{capability.data.status}</strong> · {capability.data.reasonCode}</p>
        </div>
      ) : capability.status === "error" ? (
        <div className={styles.notice} role="alert"><ClipboardCheck aria-hidden="true" size={19} /><p>Não foi possível validar a capability de execução. Execução e confirmação permanecem bloqueadas.</p></div>
      ) : null}
      <div className={styles.filterRow}>
        <div className={styles.field}>
          <label htmlFor="payout-status">Estado da fila</label>
          <select id="payout-status" value={status} onChange={(event) => { setStatus(event.target.value as PayoutStatusFilter); }}>
            {statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </div>
        {resource.status === "ready" ? <span className={styles.count} aria-live="polite">{resource.data.data.length} solicitações retornadas</span> : null}
      </div>
      {actionError ? <p className={styles.errorText} role="alert">{actionError}</p> : null}
      {confirmation ? <p className={styles.successText} role="status">{confirmation}</p> : null}
      {resource.status !== "ready" ? (
        resource.status === "error"
          ? <OperationsResourceError error={resource.error} retry={resource.retry} />
          : <ResourceLoading label="Carregando fila de saques" />
      ) : (
        <>
          <OperationsSourceBar source={`GET ${endpoint}`} scope="fila protegida por grant de plataforma" asOf={resource.data.asOf} />
          {!resource.data.data.length ? (
            <PageState kind="empty" title="Nenhuma solicitação neste estado" description="A fila canônica retornou zero registros para o filtro selecionado." />
          ) : (
            <Panel className={styles.tablePanel}>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <caption>Solicitações administrativas de saque</caption>
                  <thead><tr><th scope="col">Solicitação</th><th scope="col">SellerAccount</th><th scope="col">Valor</th><th scope="col">Estado</th><th scope="col">Criada em</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
                  <tbody>
                    {resource.data.data.map((item) => (
                      <tr key={item.payoutRequestId}>
                        <td className={styles.primary}><strong>{item.payoutRequestId}</strong><small>{item.destinationCountry} · versão {item.version}</small></td>
                        <td><code className={styles.code}>{item.sellerAccountId}</code></td>
                        <td className={styles.money}><MinorMoney amountMinor={item.amountMinor} currency={item.currency} /></td>
                        <td><StatusLabel status={item.payoutStatus} /></td>
                        <td><time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time></td>
                        <td className={styles.actionCell}>{actionFor(item)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
      <dialog ref={dialogRef} className={styles.modal} aria-labelledby="payout-evidence-title" onClose={() => { setSelectedPayout(null); setEvidenceAction(null); lastTriggerRef.current?.focus(); }}>
        <form onSubmit={(event) => { void submitEvidence(event); }}>
          <header className={styles.modalHeader}>
            <h2 id="payout-evidence-title">{evidenceAction === "EXECUTE" ? "Registrar execução externa" : "Confirmar pagamento homologado"}</h2>
            <Button type="button" size="small" variant="ghost" aria-label="Fechar operação" onClick={() => { dialogRef.current?.close(); }} iconBefore={<X aria-hidden="true" size={18} />}>Fechar</Button>
          </header>
          <div className={styles.modalBody}>
            <div className={styles.dialogContext}><strong>Solicitação selecionada</strong><code>{selectedPayout?.payoutRequestId}</code>{selectedPayout ? <MinorMoney amountMinor={selectedPayout.amountMinor} currency={selectedPayout.currency} /> : null}</div>
            <div className={styles.guardrail}><ClipboardCheck aria-hidden="true" size={18} /><span>{evidenceAction === "EXECUTE" ? "A execução só avança se referência e prova forem validadas pelo modo homologado." : "A confirmação consulta a fonte homologada; sem retorno PAID, o saldo não será baixado."}</span></div>
            {evidenceAction === "EXECUTE" ? (
              <div className={styles.field}>
                <label htmlFor="payout-external-reference">Referência externa da transferência</label>
                <input id="payout-external-reference" value={externalReference} onChange={(event) => { invalidateIdempotencyKey(); setExternalReference(event.target.value); }} maxLength={300} required />
              </div>
            ) : null}
            <div className={styles.field}>
              <label htmlFor="payout-evidence-locator">Localizador da evidência</label>
              <input id="payout-evidence-locator" value={evidenceLocator} onChange={(event) => { invalidateIdempotencyKey(); setEvidenceLocator(event.target.value); }} maxLength={1000} required />
            </div>
            <div className={styles.field}>
              <label htmlFor="payout-evidence-sha">SHA-256 da evidência</label>
              <input id="payout-evidence-sha" value={evidenceSha256} onChange={(event) => { invalidateIdempotencyKey(); setEvidenceSha256(event.target.value); }} minLength={64} maxLength={64} pattern="[0-9a-fA-F]{64}" autoComplete="off" required />
              <small>Exatamente 64 caracteres hexadecimais.</small>
            </div>
            {evidenceError ? <p className={styles.errorText} role="alert">{evidenceError}</p> : null}
          </div>
          <footer className={styles.modalActions}>
            <Button type="button" variant="ghost" onClick={() => { dialogRef.current?.close(); }}>Cancelar</Button>
            <Button type="submit" loading={submittingEvidence} loadingLabel="Validando evidência">{evidenceAction === "EXECUTE" ? "Registrar execução" : "Consultar e confirmar"}</Button>
          </footer>
        </form>
      </dialog>
    </div>
  );
}
