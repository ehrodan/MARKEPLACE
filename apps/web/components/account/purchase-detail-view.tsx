"use client";

import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { PageState, Panel, StatusBadge } from "@midas/ui";
import { MinorMoney } from "@/components/operations/minor-money";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { StatusLabel, readableStatus } from "@/components/status-label";
import { useApiResource } from "@/hooks/use-api-resource";
import type { OrderDetailResponse } from "@/lib/api-types";
import { formatDateTime } from "@/lib/date-format";
import { deliveryStatusView, orderStatusView } from "@/lib/order-status";
import { DataProvenance } from "./data-provenance";
import { repurchaseActionFor, snapshotTitle } from "./repurchase";
import styles from "./account-dashboard.module.css";

export function PurchaseDetailView({ orderId }: { orderId: string }) {
  const resource = useApiResource<OrderDetailResponse>(
    `/v1/orders/${encodeURIComponent(orderId)}`,
  );

  const header = (
    <PageHeader
      eyebrow="MINHA CONTA · COMPRADOR"
      title="Detalhe do pedido"
      description="Resumo, valores, timeline e entrega deste pedido, como o servidor registrou."
    />
  );

  if (resource.status !== "ready") {
    return (
      <div className={styles.pageStack}>
        {header}
        {resource.status === "error"
          ? <ResourceError error={resource.error} retry={resource.retry} />
          : <ResourceLoading label="Carregando pedido" />}
      </div>
    );
  }

  const { order, items, timeline, delivery, asOf } = resource.data;
  const status = orderStatusView(order.status);

  return (
    <div className={styles.pageStack}>
      {header}
      <DataProvenance
        source="GET /v1/orders/{orderId}"
        scope="somente pedidos em que você é parte"
        asOf={asOf}
      />

      <section className={styles.section} aria-labelledby="purchase-state-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="purchase-state-title">Pedido {order.publicCode}</h2>
            <p>{status.explanation}</p>
          </div>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>

        {/* Próxima ação é o diferencial da tela: ninguém deve sair daqui
            sem saber de quem é a vez. */}
        <Panel className={styles.notice} as="div">
          <strong>
            {status.nextAction
              ? `Próxima ação sua: ${status.nextAction}`
              : "Nenhuma ação sua é necessária agora."}
          </strong>
          <p>
            {status.waitingOn === "BUYER"
              ? "O pedido aguarda você."
              : status.waitingOn === "SELLER"
                ? "O pedido aguarda o vendedor."
                : status.waitingOn === "PLATFORM"
                  ? "O pedido está em análise da plataforma."
                  : "Este pedido não tem etapa pendente."}
          </p>
          {order.reservedUntil ? (
            <p>Reserva válida até {formatDateTime(order.reservedUntil)}.</p>
          ) : null}
        </Panel>
      </section>

      <section className={styles.section} aria-labelledby="purchase-money-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="purchase-money-title">Valores</h2>
            <p>Subtotal, taxa da plataforma e total, sempre separados.</p>
          </div>
        </div>
        <div className={styles.metricGrid}>
          <Panel className={styles.metricCard} as="article">
            <span className={styles.metricLabel}>Subtotal</span>
            <strong className={styles.metricValue}>
              <MinorMoney amountMinor={order.subtotalMinor} currency={order.currency} />
            </strong>
          </Panel>
          <Panel className={styles.metricCard} as="article">
            <span className={styles.metricLabel}>Taxa da plataforma</span>
            <strong className={styles.metricValue}>
              <MinorMoney amountMinor={order.feeMinor} currency={order.currency} />
            </strong>
          </Panel>
          <Panel className={styles.metricCard} as="article">
            <span className={styles.metricLabel}>Total</span>
            <strong className={styles.metricValue}>
              <MinorMoney amountMinor={order.totalMinor} currency={order.currency} />
            </strong>
          </Panel>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="purchase-items-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="purchase-items-title">Itens</h2>
            <p>Dados congelados no momento da compra.</p>
          </div>
        </div>
        {!items.length ? (
          <PageState
            kind="empty"
            title="Nenhum item retornado"
            description="O servidor não devolveu itens para este pedido."
          />
        ) : (
          <Panel className={styles.tablePanel}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <caption>Itens do pedido {order.publicCode}</caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Quantidade</th>
                    <th scope="col">Preço unitário</th>
                    <th scope="col">Total</th>
                    <th scope="col"><span className="sr-only">Recompra</span></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const title = snapshotTitle(item.listingSnapshot);
                    /* Recompra (RF-262/263): derivada só do snapshot real do
                       pedido. O rótulo diz o que o clique faz — nenhum preço
                       atual é mostrado sem buscar. */
                    const repurchase = repurchaseActionFor(item.listingSnapshot);
                    return (
                      <tr key={item.orderItemId}>
                        <td className={styles.primaryCell}>
                          {title ?? <span className={styles.secondaryText}>Título não registrado no snapshot</span>}
                        </td>
                        <td className={styles.numeric}>{item.quantity}</td>
                        <td className={styles.numeric}>
                          <MinorMoney amountMinor={item.unitPriceMinor} currency={item.currency} />
                        </td>
                        <td className={styles.numeric}>
                          <MinorMoney amountMinor={item.totalMinor} currency={item.currency} />
                        </td>
                        <td className={styles.actionCell}>
                          {repurchase ? (
                            <Link className="text-link" href={repurchase.href}>
                              {repurchase.kind === "OFFER"
                                ? <ArrowRight aria-hidden="true" size={16} />
                                : <Search aria-hidden="true" size={16} />}
                              {repurchase.label}
                            </Link>
                          ) : (
                            <span className={styles.secondaryText}>Sem referência para recompra</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </section>

      <section className={styles.section} aria-labelledby="purchase-delivery-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="purchase-delivery-title">Entrega</h2>
            <p>As duas confirmações são independentes.</p>
          </div>
        </div>
        {!delivery ? (
          <PageState
            kind="empty"
            title="Etapa de entrega ainda não aberta"
            description="A entrega abre depois que o pagamento é confirmado pelo provedor."
            reference="SCR-BUY-006"
          />
        ) : (
          <Panel as="div" className={styles.notice}>
            <strong>{deliveryStatusView(delivery.status).label}</strong>
            <p>{deliveryStatusView(delivery.status).explanation}</p>
            <ul className={styles.holdList}>
              <li className={styles.holdRow}>
                <span>Sua confirmação</span>
                <span>
                  {delivery.buyerConfirmedAt
                    ? formatDateTime(delivery.buyerConfirmedAt)
                    : "pendente"}
                </span>
              </li>
              <li className={styles.holdRow}>
                <span>Confirmação do vendedor</span>
                <span>
                  {delivery.sellerConfirmedAt
                    ? formatDateTime(delivery.sellerConfirmedAt)
                    : "pendente"}
                </span>
              </li>
            </ul>
            <Link className="button-link" href={`/pedidos/${encodeURIComponent(order.orderId)}/entrega`}>
              Abrir a entrega
            </Link>
          </Panel>
        )}
      </section>

      <section className={styles.section} aria-labelledby="purchase-timeline-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="purchase-timeline-title">Timeline</h2>
            <p>Somente eventos gravados pelo servidor. O que não aconteceu não aparece.</p>
          </div>
        </div>
        {!timeline.length ? (
          <PageState
            kind="empty"
            title="Nenhum evento registrado"
            description="Este pedido ainda não gerou eventos no servidor."
          />
        ) : (
          <ol className={styles.holdList}>
            {timeline.map((event) => (
              <li className={styles.holdRow} key={event.orderEventId}>
                <span className={styles.primaryCell}>
                  {readableStatus(event.eventType)}
                  {event.fromStatus && event.toStatus ? (
                    <small className={styles.secondaryText}>
                      {readableStatus(event.fromStatus)} para {readableStatus(event.toStatus)}
                    </small>
                  ) : null}
                </span>
                <span className={styles.dateCell}>
                  <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className={styles.pagerActions}>
        <Link className="text-link" href="/conta/compras">Voltar para compras</Link>
        {order.status === "COMPLETED" ? (
          <Link className="text-link" href="/conta/avaliacoes">Avaliar esta compra</Link>
        ) : null}
        <Link className="text-link" href="/conta/suporte">Abrir suporte</Link>
      </div>
    </div>
  );
}

export function PurchaseStatusSummary({ status }: { status: string }) {
  const view = orderStatusView(status);
  return <StatusBadge tone={view.tone}>{view.label}</StatusBadge>;
}

export { StatusLabel };
