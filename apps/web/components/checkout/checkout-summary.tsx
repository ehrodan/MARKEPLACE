"use client";

/**
 * Resumo financeiro do checkout (SCR-BUY-003).
 *
 * Dinheiro sempre em unidades mínimas como string, comparado e formatado com BigInt.
 * Subtotal, taxa e total aparecem SEPARADOS. Quando a rota canônica do pedido ainda não
 * publica a decomposição, o resumo não apresenta um total "fechado": ele mostra apenas o
 * valor autorizado no `Payment` e declara qual contrato está faltando.
 */

import { TriangleAlert, ReceiptText } from "lucide-react";
import { StatusBadge } from "@midas/ui";
import {
  formatMinorUnits,
  type AmountConsistency,
  type CheckoutOrderSummary,
  type CheckoutPayment,
} from "./checkout-state";
import styles from "./checkout.module.css";

export interface CheckoutSummaryProps {
  payment: CheckoutPayment;
  /** `null` quando `GET /v1/orders/{orderId}` ainda não está publicado. */
  order: CheckoutOrderSummary | null;
  consistency: AmountConsistency;
  /** Rota canônica consultada para a decomposição. */
  contractPath: string;
}

export function CheckoutSummary({ payment, order, consistency, contractPath }: CheckoutSummaryProps) {
  return (
    <section className={styles.summaryCard} aria-labelledby="checkout-summary-title">
      <div className={styles.summaryHeading}>
        <ReceiptText aria-hidden="true" size={18} />
        <h2 id="checkout-summary-title">Resumo financeiro</h2>
        <StatusBadge tone={order ? "info" : "warning"}>
          {order ? "PEDIDO PUBLICADO" : "DECOMPOSIÇÃO NÃO PUBLICADA"}
        </StatusBadge>
      </div>

      {order ? (
        <dl className={styles.summaryList}>
          <div>
            <dt>Subtotal dos itens</dt>
            <dd className={styles.money}>{formatMinorUnits(order.subtotalMinor, order.currency)}</dd>
          </div>
          <div>
            <dt>Taxa da plataforma</dt>
            <dd className={styles.money}>{formatMinorUnits(order.feeMinor, order.currency)}</dd>
          </div>
          <div className={styles.summaryTotal}>
            <dt>Total do pedido</dt>
            <dd className={styles.money}>{formatMinorUnits(order.totalMinor, order.currency)}</dd>
          </div>
          <div>
            <dt>Valor autorizado no pagamento</dt>
            <dd className={styles.money}>{formatMinorUnits(payment.amountMinor, payment.currency)}</dd>
          </div>
        </dl>
      ) : (
        <>
          <p className={styles.summaryNotice} role="note">
            A decomposição entre subtotal e taxa vem do pedido, e essa leitura ainda não está publicada
            pela API. Nenhum valor foi estimado ou repartido pela interface: abaixo aparece somente o
            montante que o registro de pagamento realmente carrega.
          </p>
          <dl className={styles.summaryList}>
            <div className={styles.summaryTotal}>
              <dt>Valor autorizado no pagamento</dt>
              <dd className={styles.money}>{formatMinorUnits(payment.amountMinor, payment.currency)}</dd>
            </div>
          </dl>
        </>
      )}

      {consistency === "MISMATCH" ? (
        <p className={styles.summaryAlert} role="alert">
          <TriangleAlert aria-hidden="true" size={17} />
          O total do pedido e o valor autorizado no pagamento não fecham. O avanço está bloqueado até o
          servidor reconciliar os dois registros.
        </p>
      ) : null}

      {consistency === "UNVERIFIABLE" ? (
        <p className={styles.summaryAlert} role="alert">
          <TriangleAlert aria-hidden="true" size={17} />
          Algum valor não chegou em unidades mínimas inteiras, então a conferência aritmética não pôde
          ser feita. A interface não arredonda nem converte para concluir a soma.
        </p>
      ) : null}

      <p className={styles.contractNote}>
        Valores em unidades mínimas de <code>{payment.currency}</code>. Origem da decomposição:{" "}
        <code>{contractPath}</code>.
      </p>
    </section>
  );
}
