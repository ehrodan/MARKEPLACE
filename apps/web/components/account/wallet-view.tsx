"use client";

import { Info, Landmark, LockKeyhole } from "lucide-react";
import { Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useAccountContext } from "@/components/account/account-context";
import { SellerScopeGate } from "@/components/account/seller-scope-gate";
import { MinorMoney } from "@/components/operations/minor-money";
import type { SellerBalance } from "@/components/operations/finance-types";
import { useApiResource } from "@/hooks/use-api-resource";
import { DataProvenance } from "./data-provenance";
import styles from "./account-dashboard.module.css";

function ScopedWallet() {
  const { selectedSeller } = useAccountContext();
  const endpoint = selectedSeller
    ? `/v1/seller-accounts/${encodeURIComponent(selectedSeller.sellerAccountId)}/finance/balance`
    : null;
  const resource = useApiResource<SellerBalance>(endpoint);

  if (resource.status !== "ready") {
    return resource.status === "error"
      ? <ResourceError error={resource.error} retry={resource.retry} />
      : <ResourceLoading label="Carregando saldo financeiro" />;
  }

  const balance = resource.data;
  return (
    <div className={styles.pageStack}>
      <DataProvenance
        source="GET /v1/seller-accounts/{sellerAccountId}/finance/balance"
        scope={selectedSeller?.displayName ?? balance.sellerAccountId}
        asOf={balance.asOf}
      />
      <section className={styles.metricGrid} aria-label={`Saldo em ${balance.currency}`}>
        <Panel className={styles.metricCard} as="article">
          <span className={styles.metricLabel}>Disponível para saque</span>
          <strong className={styles.metricValue}><MinorMoney amountMinor={balance.availableAmountMinor} currency={balance.currency} /></strong>
          <span className={styles.metricMeta}>Valor liberado pelo ledger</span>
        </Panel>
        <Panel className={styles.metricCard} as="article">
          <span className={styles.metricLabel}>Em hold</span>
          <strong className={styles.metricValue}><MinorMoney amountMinor={balance.heldAmountMinor} currency={balance.currency} /></strong>
          <span className={styles.metricMeta}>Ainda sujeito à política de liberação</span>
        </Panel>
        <Panel className={styles.metricCard} as="article">
          <span className={styles.metricLabel}>Reservado</span>
          <strong className={styles.metricValue}><MinorMoney amountMinor={balance.reservedAmountMinor} currency={balance.currency} /></strong>
          <span className={styles.metricMeta}>Comprometido por solicitações em andamento</span>
        </Panel>
      </section>
      <div className={styles.notice} role="note">
        <LockKeyhole aria-hidden="true" size={19} />
        <p>Os três buckets vêm separados do ledger. A interface não soma, antecipa nem libera saldo localmente.</p>
      </div>
      <div className={styles.notice} role="note">
        <Info aria-hidden="true" size={19} />
        <p>Este contrato resume o saldo atual. Datas por lote e motivos individuais de hold só serão exibidos quando a API publicar essa leitura canônica.</p>
      </div>
    </div>
  );
}

export function WalletView() {
  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="VENDEDOR · FINANCEIRO"
        title="Carteira de vendas"
        description="Saldo contábil real da SellerAccount selecionada, sem misturar tenants."
        meta={<span><Landmark aria-hidden="true" size={15} /> Ledger por moeda</span>}
      />
      <SellerScopeGate><ScopedWallet /></SellerScopeGate>
    </div>
  );
}
