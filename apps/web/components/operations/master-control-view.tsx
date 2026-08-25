"use client";

import Link from "next/link";
import { BadgeDollarSign, Landmark, PlugZap } from "lucide-react";
import { Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceLoading } from "@/components/resource-state";
import { StatusLabel } from "@/components/status-label";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/date-format";
import type { PaymentResolutionCaseList, PayoutCapability, PayoutRequestList, ProviderCapability } from "./finance-types";
import { OperationsResourceError } from "./operations-resource-state";
import styles from "./operations-dashboard.module.css";

const capabilityReasons: Record<ProviderCapability["reasonCode"], string> = {
  AVAILABLE: "Adapter e credenciais disponíveis para operação.",
  PROVIDER_CONTRACT_NOT_SELECTED: "Nenhum contrato de provider foi selecionado.",
  PROVIDER_CREDENTIALS_REQUIRED: "O provider exige credenciais válidas antes de operar.",
  PROVIDER_ADAPTER_NOT_INSTALLED: "O adapter do provider ainda não está instalado.",
};

const payoutCapabilityReasons: Record<PayoutCapability["reasonCode"], string> = {
  AVAILABLE: "Execução externa e confirmação homologada estão disponíveis.",
  PAYOUT_CONTRACT_NOT_SELECTED: "Nenhum contrato de payout foi selecionado.",
  PAYOUT_CREDENTIALS_REQUIRED: "O modo de payout aguarda credenciais homologadas.",
  PAYOUT_MODE_UNSUPPORTED: "O modo externo manual não é suportado para BR/BRL.",
};

export function MasterControlView() {
  const capability = useApiResource<ProviderCapability>("/v1/finance/provider-capability");
  const payoutCapability = useApiResource<PayoutCapability>("/v1/finance/payout-capability?countryCode=BR&currency=BRL&mode=EXTERNAL_MANUAL");
  const paymentCases = useApiResource<PaymentResolutionCaseList>("/v1/admin/payment-resolution-cases?status=OPEN");
  const payoutRequests = useApiResource<PayoutRequestList>("/v1/admin/payouts?status=REQUESTED");
  const firstError = capability.status === "error"
    ? capability
    : payoutCapability.status === "error"
      ? payoutCapability
      : paymentCases.status === "error"
      ? paymentCases
      : payoutRequests.status === "error"
        ? payoutRequests
        : null;

  if (firstError) {
    return (
      <div className={styles.pageStack}>
        <PageHeader eyebrow="MASTER · CONTROLE" title="Visão de controle" description="Saúde financeira e filas protegidas por grants de plataforma." />
        <OperationsResourceError
          error={firstError.error}
          retry={() => { capability.retry(); payoutCapability.retry(); paymentCases.retry(); payoutRequests.retry(); }}
        />
      </div>
    );
  }

  if (capability.status !== "ready" || payoutCapability.status !== "ready" || paymentCases.status !== "ready" || payoutRequests.status !== "ready") {
    return (
      <div className={styles.pageStack}>
        <PageHeader eyebrow="MASTER · CONTROLE" title="Visão de controle" description="Saúde financeira e filas protegidas por grants de plataforma." />
        <ResourceLoading label="Carregando visão master" />
      </div>
    );
  }

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="MASTER · CONTROLE"
        title="Visão de controle"
        description="Provider e filas financeiras consultados diretamente nas superfícies administrativas canônicas."
      />
      <section className={styles.summaryGrid} aria-label="Resumo operacional real">
        <Panel className={styles.summaryCard} as="article">
          <span><PlugZap aria-hidden="true" size={16} /> Provider de pagamento</span>
          <strong>{capability.data.providerCode ?? "Não selecionado"}</strong>
          <StatusLabel status={capability.data.status} />
        </Panel>
        <Panel className={styles.summaryCard} as="article">
          <span><BadgeDollarSign aria-hidden="true" size={16} /> Casos abertos</span>
          <strong>{paymentCases.data.data.length.toLocaleString("pt-BR")}</strong>
          <small>Corte em {formatDateTime(paymentCases.data.asOf)}</small>
          <Link className="text-link" href="/admin/pagamentos">Abrir fila de pagamentos</Link>
        </Panel>
        <Panel className={styles.summaryCard} as="article">
          <span><Landmark aria-hidden="true" size={16} /> Saques solicitados</span>
          <strong>{payoutRequests.data.data.length.toLocaleString("pt-BR")}</strong>
          <small>Corte em {formatDateTime(payoutRequests.data.asOf)}</small>
          <Link className="text-link" href="/admin/saques">Abrir fila de saques</Link>
        </Panel>
      </section>
      <section className={styles.capabilityGrid} aria-labelledby="provider-capability-title">
        <Panel className={styles.capabilityCard} as="article">
          <div className={styles.capabilityHeader}>
            <div><h2 id="provider-capability-title">Capacidade do provider</h2></div>
            <StatusLabel status={capability.data.status} />
          </div>
          <p>{capabilityReasons[capability.data.reasonCode]}</p>
          <code className={styles.code}>{capability.data.reasonCode}</code>
          <small>Fonte: GET /v1/finance/provider-capability</small>
        </Panel>
        <Panel className={styles.capabilityCard} as="article">
          <div className={styles.capabilityHeader}>
            <div><h2>Capacidade de payout BR/BRL</h2></div>
            <StatusLabel status={payoutCapability.data.status} />
          </div>
          <p>{payoutCapabilityReasons[payoutCapability.data.reasonCode]}</p>
          <code className={styles.code}>{payoutCapability.data.reasonCode}</code>
          <small>Fonte: GET /v1/finance/payout-capability · EXTERNAL_MANUAL</small>
        </Panel>
        <Panel className={styles.capabilityCard} as="article">
          <div className={styles.capabilityHeader}>
            <div><h2>Guardrails ativos</h2></div>
          </div>
          <p>Resolução manual e baixa de saque permanecem separadas em filas com grant, CSRF, maker-checker e evidência exigidos pelo servidor.</p>
          <div className={styles.buttonRow}>
            <Link className="text-link" href="/admin/pagamentos">Pagamentos</Link>
            <Link className="text-link" href="/admin/saques">Saques</Link>
          </div>
        </Panel>
      </section>
    </div>
  );
}
