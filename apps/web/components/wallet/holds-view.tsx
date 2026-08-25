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
import {
  BALANCE_CONTRACT,
  HOLDS_CONTRACT,
  HOLD_DURATION_HOURS,
  hasAmount,
  holdBlockReasonOrder,
  holdReasonLabel,
  holdReasonMeaning,
  holdReasonSellerAction,
  readSellerBalance,
} from "./hold-facts";

function ScopedHolds() {
  const { selectedSeller } = useAccountContext();
  const endpoint = selectedSeller
    ? `/v1/seller-accounts/${encodeURIComponent(selectedSeller.sellerAccountId)}/finance/balance`
    : null;
  const resource = useApiResource<unknown>(endpoint);

  if (resource.status === "error") {
    return <ResourceError error={resource.error} retry={resource.retry} />;
  }
  if (resource.status !== "ready") {
    return <ResourceLoading label="Carregando saldo em retenção" />;
  }

  const balance = readSellerBalance(resource.data);
  if (!balance) {
    return (
      <PageState
        kind="error"
        title="A resposta de saldo não corresponde ao contrato"
        description={`O envelope exigido por ${BALANCE_CONTRACT} não veio no formato esperado. Nenhum valor é exibido: número errado sobre dinheiro retido é pior que valor ausente.`}
        reference={BALANCE_CONTRACT}
        actions={
          <Button variant="outline" onClick={resource.retry}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const held = hasAmount(balance.heldAmountMinor);

  return (
    <div className={styles.pageStack}>
      <DataProvenance
        source={BALANCE_CONTRACT}
        scope={selectedSeller?.displayName ?? balance.sellerAccountId}
        asOf={balance.asOf}
      />

      <section className={styles.metricGrid} aria-label={`Retenção em ${balance.currency}`}>
        <Panel className={styles.metricCard} as="article">
          <span className={styles.metricLabel}>Em retenção agora</span>
          <strong className={styles.metricValue}>
            <MinorMoney amountMinor={balance.heldAmountMinor} currency={balance.currency} />
          </strong>
          <span className={styles.metricMeta}>
            Total lido do ledger. A interface não soma, antecipa nem libera saldo.
          </span>
        </Panel>
        <Panel className={styles.metricCard} as="article">
          <span className={styles.metricLabel}>Já disponível</span>
          <strong className={styles.metricValue}>
            <MinorMoney amountMinor={balance.availableAmountMinor} currency={balance.currency} />
          </strong>
          <span className={styles.metricMeta}>
            Bucket separado. Retenção não vira disponível por passagem de tempo isolada.
          </span>
        </Panel>
      </section>

      {held ? null : (
        <PageState
          kind="empty"
          title="Nenhum valor em retenção"
          description="O ledger não devolveu saldo retido para esta conta de venda neste momento."
        />
      )}

      <Panel className={styles.section} as="section" aria-labelledby="hold-policy-title">
        <div className={styles.sectionHeader}>
          <h2 id="hold-policy-title">Por que o valor fica retido</h2>
        </div>
        <p className={styles.notice}>
          A janela é de {HOLD_DURATION_HOURS} horas contadas da <strong>liquidação do pagamento pelo
          provedor</strong> — não da data do pedido, não da entrega, não da conclusão. Vencida a
          janela, a liberação ainda depende dos gates abaixo, avaliados nesta ordem exata. O primeiro
          que bloqueia é o motivo que vale; resolver um gate posterior não adianta o anterior.
        </p>
        <ol className={styles.holdList}>
          {holdBlockReasonOrder.map((reason, index) => {
            const action = holdReasonSellerAction(reason);
            return (
              <li className={styles.holdRow} key={reason}>
                <div>
                  <strong>
                    {index + 1}. {holdReasonLabel(reason)}
                  </strong>
                  <small className={styles.secondaryText}>{holdReasonMeaning(reason)}</small>
                  <small className={action === null ? styles.secondaryText : styles.successText}>
                    {action ?? "Nada a fazer do seu lado: depende de processo interno ou de terceiro."}
                  </small>
                </div>
              </li>
            );
          })}
        </ol>
        <p className={styles.secondaryText}>
          Regra espelhada de <code>modules/finance/src/hold-policy.ts</code>. Há teste que falha se o
          domínio mudar a duração, os motivos ou a ordem.
        </p>
      </Panel>

      <Panel className={styles.section} as="section" aria-labelledby="hold-lots-title">
        <div className={styles.sectionHeader}>
          <h2 id="hold-lots-title">Retenção lote por lote</h2>
        </div>
        <p className={styles.secondaryText}>
          O detalhe por lote — qual venda, qual valor, qual data de elegibilidade e qual gate está
          bloqueando cada um — depende de {HOLDS_CONTRACT}, que ainda não existe. Enquanto isso, esta
          tela mostra o total real e explica a regra, sem distribuir o total entre lotes por
          estimativa.
        </p>
        <p className={styles.secondaryText}>
          Previsão de liberação por lote também não é exibida por dedução: previsão não é promessa, e o
          doc de produto proíbe transformá-la em contagem regressiva.
        </p>
        <div className={styles.pagerActions}>
          <Link className="button-link" href="/conta/carteira">
            Voltar ao saldo
          </Link>
          <Link className="button-link" href="/conta/carteira/extrato">
            Abrir extrato
          </Link>
          <Link className="button-link" href="/conta/suporte">
            Abrir suporte
          </Link>
        </div>
      </Panel>
    </div>
  );
}

export function HoldsView() {
  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="VENDEDOR · FINANCEIRO"
        title="Retenções"
        description="Quanto está retido, por que está retido e o que precisa acontecer para liberar."
      />
      <SellerScopeGate>
        <ScopedHolds />
      </SellerScopeGate>
    </div>
  );
}
