"use client";

import { useRef, useState, type SyntheticEvent } from "react";
import { Info } from "lucide-react";
import { Button, PageState, Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { StatusLabel } from "@/components/status-label";
import { useAccountContext } from "@/components/account/account-context";
import { SellerScopeGate } from "@/components/account/seller-scope-gate";
import { parseTwoDecimalAmount } from "@/components/operations/amount-input";
import type { PayoutCapability, PayoutRequest, PayoutRequestList, SellerBalance } from "@/components/operations/finance-types";
import { MinorMoney } from "@/components/operations/minor-money";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date-format";
import { DataProvenance } from "./data-provenance";
import styles from "./account-dashboard.module.css";

function actionErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.problem.detail || error.problem.title;
  return error instanceof Error ? error.message : "A solicitação não foi concluída.";
}

const payoutCapabilityReasons: Record<PayoutCapability["reasonCode"], string> = {
  AVAILABLE: "Execução manual homologada disponível para BRL no Brasil.",
  PAYOUT_CONTRACT_NOT_SELECTED: "Nenhum contrato de execução de saque foi selecionado.",
  PAYOUT_CREDENTIALS_REQUIRED: "A execução de saque aguarda credenciais homologadas.",
  PAYOUT_MODE_UNSUPPORTED: "O modo de execução manual não é suportado para este destino.",
};

function ScopedPayouts() {
  const { selectedSeller } = useAccountContext();
  const sellerAccountId = selectedSeller?.sellerAccountId;
  const encodedSellerId = sellerAccountId ? encodeURIComponent(sellerAccountId) : null;
  const listEndpoint = encodedSellerId ? `/v1/seller-accounts/${encodedSellerId}/payouts` : null;
  const balanceEndpoint = encodedSellerId ? `/v1/seller-accounts/${encodedSellerId}/finance/balance?currency=BRL` : null;
  const payouts = useApiResource<PayoutRequestList>(listEndpoint);
  const balance = useApiResource<SellerBalance>(balanceEndpoint);
  const capability = useApiResource<PayoutCapability>("/v1/finance/payout-capability?countryCode=BR&currency=BRL&mode=EXTERNAL_MANUAL");
  const requestKeyRef = useRef<string | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  if (payouts.status !== "ready") {
    return payouts.status === "error"
      ? <ResourceError error={payouts.error} retry={payouts.retry} />
      : <ResourceLoading label="Carregando solicitações de saque" />;
  }

  const submitPayout = async (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    event.preventDefault();
    if (!listEndpoint || balance.status !== "ready") return;
    const amountMinor = parseTwoDecimalAmount(amount);
    if (!amountMinor) {
      setActionError("Informe um valor positivo com no máximo duas casas decimais.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    setConfirmation(null);
    try {
      const idempotencyKey = requestKeyRef.current ?? crypto.randomUUID();
      requestKeyRef.current = idempotencyKey;
      const created = await apiRequest<PayoutRequest>(listEndpoint, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ amountMinor, currency: balance.data.currency, destinationCountry: "BR" }),
      });
      requestKeyRef.current = null;
      setAmount("");
      setConfirmation(`Solicitação ${created.payoutRequestId} registrada pela API.`);
      payouts.retry();
      balance.retry();
    } catch (error) {
      setActionError(actionErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const page = payouts.data;
  return (
    <div className={styles.pageStack}>
      <DataProvenance
        source="GET /v1/seller-accounts/{sellerAccountId}/payouts"
        scope={selectedSeller?.displayName ?? sellerAccountId ?? "SellerAccount"}
        asOf={page.asOf}
      />
      <div className={styles.notice} role="note">
        <Info aria-hidden="true" size={19} />
        <p>O saque apenas cria uma solicitação. Claim, conferência e baixa são operações administrativas separadas e auditáveis.</p>
      </div>
      <section className={styles.requestGrid} aria-labelledby="payout-request-title">
        <Panel className={styles.requestPanel}>
          <div>
            <h2 id="payout-request-title">Solicitar saque</h2>
            <p>O servidor valida membership, saldo disponível e idempotência antes de reservar qualquer valor.</p>
          </div>
          {balance.status === "error" ? (
            <ResourceError error={balance.error} retry={balance.retry} />
          ) : capability.status === "error" ? (
            <ResourceError error={capability.error} retry={capability.retry} />
          ) : balance.status !== "ready" || capability.status !== "ready" ? (
            <ResourceLoading label="Validando moeda, saldo e capacidade de saque" />
          ) : capability.data.status !== "AVAILABLE" ? (
            <PageState
              kind="unavailable"
              title="Solicitação bloqueada com segurança"
              description={payoutCapabilityReasons[capability.data.reasonCode]}
            />
          ) : (
            <form className={styles.formStack} onSubmit={(event) => { void submitPayout(event); }}>
              <div className={styles.balanceInline}>
                <span>Disponível segundo o ledger</span>
                <strong><MinorMoney amountMinor={balance.data.availableAmountMinor} currency={balance.data.currency} /></strong>
              </div>
              <div className={styles.field}>
                <label htmlFor="payout-amount">Valor ({balance.data.currency})</label>
                <input
                  id="payout-amount"
                  name="amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  value={amount}
                  onChange={(event) => { requestKeyRef.current = null; setAmount(event.target.value); }}
                  aria-describedby="payout-amount-help"
                  required
                />
                <small id="payout-amount-help">Use até duas casas decimais. A aprovação depende da conferência do servidor.</small>
              </div>
              {actionError ? <p className={styles.errorText} role="alert">{actionError}</p> : null}
              {confirmation ? <p className={styles.successText} role="status">{confirmation}</p> : null}
              <Button type="submit" loading={submitting} loadingLabel="Enviando solicitação">Solicitar saque</Button>
            </form>
          )}
        </Panel>
      </section>
      <section className={styles.section} aria-labelledby="payout-list-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="payout-list-title">Histórico de solicitações</h2>
            <p>Estados retornados pela API para o contexto selecionado.</p>
          </div>
        </div>
        {!page.data.length ? (
          <PageState kind="empty" title="Nenhuma solicitação de saque" description="Solicitações reais desta SellerAccount aparecerão aqui depois de registradas." />
        ) : (
          <Panel className={styles.tablePanel}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <caption>Solicitações de saque da SellerAccount selecionada</caption>
                <thead><tr><th scope="col">Solicitação</th><th scope="col">Valor</th><th scope="col">Estado</th><th scope="col">Criada em</th><th scope="col">Operação</th></tr></thead>
                <tbody>
                  {page.data.map((item) => (
                    <tr key={item.payoutRequestId}>
                      <td className={styles.primaryCell}><strong>{item.payoutRequestId}</strong><small>{item.destinationCountry} · versão {item.version}</small></td>
                      <td className={styles.numeric}><MinorMoney amountMinor={item.amountMinor} currency={item.currency} /></td>
                      <td><StatusLabel status={item.payoutStatus} /></td>
                      <td className={styles.dateCell}><time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time></td>
                      <td className={styles.secondaryText}>{item.completedAt ? <>Pago em <time dateTime={item.completedAt}>{formatDateTime(item.completedAt)}</time></> : item.approvedAt ? <>Aprovado em <time dateTime={item.approvedAt}>{formatDateTime(item.approvedAt)}</time></> : item.claimedAt ? <>Em revisão desde <time dateTime={item.claimedAt}>{formatDateTime(item.claimedAt)}</time></> : "Aguardando operação"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </section>
    </div>
  );
}

export function PayoutsView() {
  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="VENDEDOR · FINANCEIRO"
        title="Saques"
        description="Solicite e acompanhe saques dentro da SellerAccount selecionada."
      />
      <SellerScopeGate><ScopedPayouts /></SellerScopeGate>
    </div>
  );
}
