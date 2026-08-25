"use client";

import Link from "next/link";
import { Button, PageState, Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { DataProvenance } from "@/components/account/data-provenance";
import { useAccountContext } from "@/components/account/account-context";
import { SellerScopeGate } from "@/components/account/seller-scope-gate";
import { MinorMoney } from "@/components/operations/minor-money";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useApiResource } from "@/hooks/use-api-resource";
import styles from "@/components/account/account-dashboard.module.css";
import { BALANCE_CONTRACT, LEDGER_CONTRACT, readSellerBalance } from "./hold-facts";

/**
 * Colunas que o extrato precisa ter quando `LEDGER_CONTRACT` existir. Fonte:
 * docs/07 SCR-SEL-011 ("bruto, comissão, tarifa PSP, ajuste e líquido com
 * origem") e RF-175. Estão listadas para o vendedor saber o que vai poder
 * conferir — nenhuma delas é calculada aqui.
 */
const ledgerColumns = [
  { label: "Bruto", detail: "Valor do pedido antes de qualquer dedução." },
  { label: "Comissão Midas", detail: "Tarifa da plataforma, separada do principal de terceiros." },
  { label: "Tarifa do provedor", detail: "Custo cobrado pelo PSP na transação." },
  { label: "Ajuste", detail: "Estorno, refund, chargeback ou lançamento compensatório." },
  { label: "Líquido", detail: "O que sobra para a conta de venda, com a origem do lançamento." },
] as const;

function ScopedStatement() {
  const { selectedSeller } = useAccountContext();
  const balanceEndpoint = selectedSeller
    ? `/v1/seller-accounts/${encodeURIComponent(selectedSeller.sellerAccountId)}/finance/balance`
    : null;
  const resource = useApiResource<unknown>(balanceEndpoint);

  const balancePanel = () => {
    if (resource.status === "error") {
      return <ResourceError error={resource.error} retry={resource.retry} />;
    }
    if (resource.status !== "ready") {
      return <ResourceLoading label="Carregando saldo atual" />;
    }
    const balance = readSellerBalance(resource.data);
    if (!balance) {
      return (
        <PageState
          kind="error"
          title="A resposta de saldo não corresponde ao contrato"
          description={`O envelope exigido por ${BALANCE_CONTRACT} não veio no formato esperado, então nenhum valor é exibido.`}
          reference={BALANCE_CONTRACT}
          actions={
            <Button variant="outline" onClick={resource.retry}>
              Tentar novamente
            </Button>
          }
        />
      );
    }
    return (
      <>
        <DataProvenance
          source={BALANCE_CONTRACT}
          scope={selectedSeller?.displayName ?? balance.sellerAccountId}
          asOf={balance.asOf}
        />
        <section className={styles.metricGrid} aria-label={`Saldo em ${balance.currency}`}>
          <Panel className={styles.metricCard} as="article">
            <span className={styles.metricLabel}>Disponível</span>
            <strong className={styles.metricValue}>
              <MinorMoney amountMinor={balance.availableAmountMinor} currency={balance.currency} />
            </strong>
            <span className={styles.metricMeta}>Liberado pelo ledger.</span>
          </Panel>
          <Panel className={styles.metricCard} as="article">
            <span className={styles.metricLabel}>Em retenção</span>
            <strong className={styles.metricValue}>
              <MinorMoney amountMinor={balance.heldAmountMinor} currency={balance.currency} />
            </strong>
            <span className={styles.metricMeta}>Sujeito à política de liberação.</span>
          </Panel>
          <Panel className={styles.metricCard} as="article">
            <span className={styles.metricLabel}>Reservado</span>
            <strong className={styles.metricValue}>
              <MinorMoney amountMinor={balance.reservedAmountMinor} currency={balance.currency} />
            </strong>
            <span className={styles.metricMeta}>Comprometido por solicitação em andamento.</span>
          </Panel>
        </section>
        <p className={styles.secondaryText}>
          Estes três números são o <strong>saldo agora</strong>. Saldo não é extrato: ele não explica
          como cada valor chegou aqui, e a explicação lançamento por lançamento é o que falta.
        </p>
      </>
    );
  };

  return (
    <div className={styles.pageStack}>
      {balancePanel()}

      <PageState
        kind="unavailable"
        title="Extrato ainda não publicado pela API"
        description={`O extrato lançamento por lançamento depende de ${LEDGER_CONTRACT}, que ainda não existe. Nenhuma linha é reconstruída a partir do saldo: derivar lançamento de total é invenção, e aqui é dinheiro.`}
        reference={LEDGER_CONTRACT}
        actions={
          <Link className="button-link" href="/conta/carteira/retencoes">
            Ver retenções
          </Link>
        }
      />

      <Panel className={styles.section} as="section" aria-labelledby="statement-columns-title">
        <div className={styles.sectionHeader}>
          <h2 id="statement-columns-title">O que o extrato vai mostrar</h2>
        </div>
        <ul className={styles.holdList}>
          {ledgerColumns.map((column) => (
            <li className={styles.holdRow} key={column.label}>
              <div>
                <strong>{column.label}</strong>
                <small className={styles.secondaryText}>{column.detail}</small>
              </div>
            </li>
          ))}
        </ul>
        <p className={styles.secondaryText}>
          Cada lançamento aponta para a origem — pedido, pagamento, refund, payout ou ajuste — em vez
          de copiar o estado desses objetos. Contestação de lançamento é feita por suporte, não por
          edição de saldo: nenhuma interface altera ledger.
        </p>
      </Panel>

      <Panel className={styles.section} as="section" aria-labelledby="statement-export-title">
        <div className={styles.sectionHeader}>
          <h2 id="statement-export-title">Exportação</h2>
        </div>
        <p className={styles.secondaryText}>
          A exportação do extrato exige grant e verificação adicional (step-up), e fica registrada em
          auditoria. Como o contrato de leitura ainda não existe, não há botão de exportar aqui —
          oferecer um que não gera arquivo só desperdiçaria a confiança de quem precisa fechar o mês.
        </p>
        <div className={styles.pagerActions}>
          <Link className="button-link" href="/conta/carteira">
            Voltar ao saldo
          </Link>
          <Link className="button-link" href="/conta/suporte">
            Abrir suporte
          </Link>
        </div>
      </Panel>
    </div>
  );
}

export function StatementView() {
  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="VENDEDOR · FINANCEIRO"
        title="Extrato"
        description="Como cada valor entrou e saiu da conta de venda, com origem por lançamento."
      />
      <SellerScopeGate>
        <ScopedStatement />
      </SellerScopeGate>
    </div>
  );
}
