"use client";

import Link from "next/link";
import { CircleDot, Lock, Receipt, Route } from "lucide-react";
import { Button, Freshness, PageState, Panel, StatusBadge } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useAccountContext } from "@/components/account/account-context";
import { SellerScopeGate } from "@/components/account/seller-scope-gate";
import { useApiResource } from "@/hooks/use-api-resource";
import { isApiError } from "@/lib/api-client";
import { formatMinorUnits, subtractMinorUnits } from "./sales-metric-card";
import {
  formatOrderDate,
  sellerOrderStatusLabel,
  sellerOrderStatusTone,
  sellerOrderStatuses,
  type SellerOrderStatus,
} from "./sales-order-table";
import styles from "./sales.module.css";

const SALE_DETAIL_CONTRACT = "GET /v1/orders/{orderId}";

/** Transições espelhadas de modules/orders/src/order-state.ts (allowedOrderTransitions). */
const allowedTransitions: Readonly<Record<SellerOrderStatus, readonly SellerOrderStatus[]>> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["IN_DELIVERY", "DISPUTED"],
  IN_DELIVERY: ["COMPLETED", "DISPUTED"],
  DISPUTED: ["COMPLETED", "REFUNDED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
};

const deliveryLabels: Record<string, string> = {
  PENDING: "Nenhuma parte confirmou",
  BUYER_CONFIRMED: "Comprador confirmou",
  SELLER_CONFIRMED: "Você confirmou",
  BOTH_CONFIRMED: "As duas partes confirmaram",
};

interface SaleOrderEvent {
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  occurredAt: string;
}

interface SaleOrderDetail {
  orderId: string;
  publicCode: string;
  status: SellerOrderStatus;
  subtotalMinor: string;
  feeMinor: string;
  totalMinor: string;
  currency: string;
  placedAt: string;
  paidAt: string | null;
  completedAt: string | null;
  itemSummary: string | null;
  deliveryStatus: string | null;
  events: SaleOrderEvent[] | null;
  asOf: string;
}

function isSellerOrderStatus(value: unknown): value is SellerOrderStatus {
  return typeof value === "string" && (sellerOrderStatuses as readonly string[]).includes(value);
}

function parseEvents(value: unknown): SaleOrderEvent[] | null {
  if (!Array.isArray(value)) return null;
  const events: SaleOrderEvent[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.eventType !== "string" || typeof row.occurredAt !== "string") continue;
    if (Number.isNaN(Date.parse(row.occurredAt))) continue;
    events.push({
      eventType: row.eventType,
      fromStatus: typeof row.fromStatus === "string" ? row.fromStatus : null,
      toStatus: typeof row.toStatus === "string" ? row.toStatus : null,
      occurredAt: row.occurredAt,
    });
  }
  return events;
}

/**
 * A API devolve o detalhe em `{ order, items, timeline, delivery, asOf }`
 * (GET /v1/orders/{orderId}). Este leitor aceita esse envelope e também um objeto
 * plano, para a tela não quebrar se a resposta vier achatada.
 */
function orderDetailSource(payload: Record<string, unknown>): {
  order: Record<string, unknown>;
  events: unknown;
  deliveryStatus: string | null;
  asOf: unknown;
} {
  const envelope = payload.order;
  if (typeof envelope === "object" && envelope !== null) {
    const delivery = payload.delivery;
    const deliveryStatus =
      typeof delivery === "object" && delivery !== null
        ? (delivery as Record<string, unknown>).status
        : null;
    return {
      order: envelope as Record<string, unknown>,
      events: payload.timeline,
      deliveryStatus: typeof deliveryStatus === "string" ? deliveryStatus : null,
      asOf: payload.asOf,
    };
  }
  return {
    order: payload,
    events: payload.events,
    deliveryStatus: typeof payload.deliveryStatus === "string" ? payload.deliveryStatus : null,
    asOf: payload.asOf,
  };
}

/** Aceita o pedido apenas se os campos que a tela exibe estiverem dentro do contrato. */
export function parseSaleOrderDetail(payload: unknown): SaleOrderDetail | null {
  if (typeof payload !== "object" || payload === null) return null;
  const source = orderDetailSource(payload as Record<string, unknown>);
  const row = source.order;
  const { orderId, publicCode, status, subtotalMinor, feeMinor, totalMinor, currency, placedAt } =
    row;

  if (
    typeof orderId !== "string" ||
    typeof publicCode !== "string" ||
    !isSellerOrderStatus(status) ||
    typeof subtotalMinor !== "string" ||
    !/^\d+$/u.test(subtotalMinor) ||
    typeof feeMinor !== "string" ||
    !/^\d+$/u.test(feeMinor) ||
    typeof totalMinor !== "string" ||
    !/^\d+$/u.test(totalMinor) ||
    typeof currency !== "string" ||
    !/^[A-Z]{3}$/u.test(currency) ||
    typeof placedAt !== "string" ||
    Number.isNaN(Date.parse(placedAt))
  ) {
    return null;
  }

  return {
    orderId,
    publicCode,
    status,
    subtotalMinor,
    feeMinor,
    totalMinor,
    currency,
    placedAt,
    paidAt: typeof row.paidAt === "string" ? row.paidAt : null,
    completedAt: typeof row.completedAt === "string" ? row.completedAt : null,
    itemSummary: typeof row.itemSummary === "string" ? row.itemSummary : null,
    deliveryStatus: source.deliveryStatus,
    events: parseEvents(source.events),
    asOf: typeof source.asOf === "string" ? source.asOf : placedAt,
  };
}

function MoneyRow({
  label,
  amountMinor,
  currency,
  hint,
}: {
  label: string;
  amountMinor: string | null;
  currency: string;
  hint?: string;
}) {
  const formatted = amountMinor === null ? null : formatMinorUnits(amountMinor, currency);
  return (
    <div className={styles.moneyRow}>
      <dt>
        {label}
        {hint ? <small>{hint}</small> : null}
      </dt>
      <dd className={styles.numeric}>{formatted ?? "Não calculável"}</dd>
    </div>
  );
}

function StatusTrack({ status }: { status: SellerOrderStatus }) {
  const nextStates = allowedTransitions[status];
  return (
    <Panel className={styles.trackPanel} as="section" aria-labelledby="sale-track-title">
      <h2 id="sale-track-title" className={styles.panelHeading}>
        <Route aria-hidden="true" size={17} /> Onde este pedido está
      </h2>
      <p className={styles.trackCurrent}>
        <CircleDot aria-hidden="true" size={16} />
        <span>
          Estado atual:{" "}
          <StatusBadge tone={sellerOrderStatusTone(status)}>
            {sellerOrderStatusLabel(status)}
          </StatusBadge>
        </span>
      </p>
      {nextStates.length === 0 ? (
        <p className={styles.trackNote}>
          Este é um estado final na máquina de estados de pedidos. Nenhuma transição adicional é
          aceita pelo servidor.
        </p>
      ) : (
        <>
          <p className={styles.trackNote}>
            A partir daqui o servidor aceita apenas estas transições. Qualquer outro caminho é
            recusado com <code>ORDER_TRANSITION_NOT_ALLOWED</code>.
          </p>
          <ul className={styles.trackList}>
            {nextStates.map((next) => (
              <li key={next}>
                <StatusBadge tone={sellerOrderStatusTone(next)}>
                  {sellerOrderStatusLabel(next)}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function ScopedSaleDetail({ orderId }: { orderId: string }) {
  const { selectedSeller } = useAccountContext();
  const path = selectedSeller
    ? `/v1/orders/${encodeURIComponent(orderId)}`
    : null;
  const resource = useApiResource<unknown>(path);

  if (resource.status === "error") {
    const error = resource.error;
    if (
      isApiError(error) &&
      (error.problem.status === 404 || error.problem.code === "CAPABILITY_NOT_IMPLEMENTED")
    ) {
      return (
        <PageState
          kind="unavailable"
          title="Detalhe da venda ainda não publicado pela API"
          description={`Esta tela consome ${SALE_DETAIL_CONTRACT}. Enquanto o contrato não responder, nenhuma linha do tempo, valor líquido ou etapa de entrega é apresentada por suposição.`}
          actions={
            <Link className="button-link" href="/conta/vendas">
              Voltar ao painel de vendas
            </Link>
          }
        />
      );
    }
    return <ResourceError error={error} retry={resource.retry} />;
  }

  if (resource.status !== "ready") {
    return <ResourceLoading label="Carregando a venda" />;
  }

  const order = parseSaleOrderDetail(resource.data);
  if (!order) {
    return (
      <PageState
        kind="error"
        title="A resposta não corresponde ao contrato do pedido"
        description={`A API respondeu, mas os campos exigidos por ${SALE_DETAIL_CONTRACT} não vieram no formato esperado. Preferimos não exibir nada a exibir um valor incorreto sobre dinheiro.`}
        actions={
          <Button variant="outline" onClick={resource.retry}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  const net = subtractMinorUnits(order.totalMinor, order.feeMinor);
  const isHeld = order.status !== "COMPLETED";

  return (
    <div className={styles.detailGrid}>
      <div className={styles.detailMain}>
        <StatusTrack status={order.status} />

        <Panel className={styles.timelinePanel} as="section" aria-labelledby="sale-timeline-title">
          <h2 id="sale-timeline-title" className={styles.panelHeading}>
            Linha do tempo
          </h2>
          {order.events === null ? (
            <PageState
              kind="empty"
              title="Histórico de eventos não veio nesta resposta"
              description="A tabela orders.order_events guarda o histórico imutável. Enquanto o contrato não expuser esses registros, esta seção fica vazia em vez de reconstruir a sequência por dedução."
            />
          ) : order.events.length === 0 ? (
            <p className={styles.trackNote}>
              O servidor devolveu a lista de eventos vazia para este pedido.
            </p>
          ) : (
            <ol className={styles.timeline}>
              {order.events.map((event) => (
                <li key={`${event.eventType}-${event.occurredAt}`}>
                  <div className={styles.timelineHead}>
                    <strong>{event.eventType}</strong>
                    <time dateTime={event.occurredAt}>{formatOrderDate(event.occurredAt)}</time>
                  </div>
                  {event.fromStatus && event.toStatus ? (
                    <p className={styles.trackNote}>
                      {event.fromStatus} → {event.toStatus}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel className={styles.deliveryPanel} as="section" aria-labelledby="sale-delivery-title">
          <h2 id="sale-delivery-title" className={styles.panelHeading}>
            Entrega
          </h2>
          {order.deliveryStatus === null ? (
            <p className={styles.trackNote}>
              O estado da entrega não veio nesta resposta. A confirmação de entrega é feita na
              superfície de entrega do pedido, não aqui.
            </p>
          ) : (
            <p className={styles.trackCurrent}>
              <span>
                {deliveryLabels[order.deliveryStatus] ?? order.deliveryStatus}
              </span>
            </p>
          )}
        </Panel>
      </div>

      <aside className={styles.detailAside}>
        <Panel className={styles.summaryPanel} as="section" aria-labelledby="sale-money-title">
          <h2 id="sale-money-title" className={styles.panelHeading}>
            <Receipt aria-hidden="true" size={17} /> Valores do pedido
          </h2>
          <dl className={styles.moneyList}>
            <MoneyRow
              label="Subtotal"
              amountMinor={order.subtotalMinor}
              currency={order.currency}
              hint="Campo subtotalMinor"
            />
            <MoneyRow
              label="Taxa da plataforma"
              amountMinor={order.feeMinor}
              currency={order.currency}
              hint="Campo feeMinor"
            />
            <MoneyRow
              label="Total do pedido"
              amountMinor={order.totalMinor}
              currency={order.currency}
              hint="Campo totalMinor"
            />
            <MoneyRow
              label="Líquido previsto"
              amountMinor={net}
              currency={order.currency}
              hint="Total menos taxa, calculado sobre os campos acima"
            />
          </dl>
          <p className={styles.metricSource}>
            Origem: <code>{SALE_DETAIL_CONTRACT}</code>
          </p>
          <Freshness asOf={order.asOf} />
        </Panel>

        <Panel className={styles.holdPanel} as="section" aria-labelledby="sale-hold-title">
          <h2 id="sale-hold-title" className={styles.panelHeading}>
            <Lock aria-hidden="true" size={17} /> Retenção deste valor
          </h2>
          <p className={styles.holdIntro}>
            {isHeld
              ? "Enquanto o pedido não estiver concluído, o valor não entra no saldo disponível. A liberação depende das condições avaliadas no servidor."
              : "O pedido está concluído. A liberação ainda depende da janela de retenção e das demais condições avaliadas no servidor."}
          </p>
          <p className={styles.holdFootnote}>
            A data elegível de liberação só aparece quando o contrato financeiro publicar esse campo
            para o lote deste pedido. Esta tela não estima prazo nem mostra contagem regressiva.
          </p>
          <Link className="text-link" href="/conta/vendas">
            Ver as regras de retenção no painel
          </Link>
        </Panel>

        <Panel className={styles.summaryPanel} as="section" aria-labelledby="sale-meta-title">
          <h2 id="sale-meta-title" className={styles.panelHeading}>
            Identificação
          </h2>
          <dl className={styles.moneyList}>
            <div className={styles.moneyRow}>
              <dt>Código do pedido</dt>
              <dd>
                <code>{order.publicCode}</code>
              </dd>
            </div>
            <div className={styles.moneyRow}>
              <dt>Feito em</dt>
              <dd>
                <time dateTime={order.placedAt}>{formatOrderDate(order.placedAt)}</time>
              </dd>
            </div>
            {order.paidAt ? (
              <div className={styles.moneyRow}>
                <dt>Pago em</dt>
                <dd>
                  <time dateTime={order.paidAt}>{formatOrderDate(order.paidAt)}</time>
                </dd>
              </div>
            ) : null}
            {order.completedAt ? (
              <div className={styles.moneyRow}>
                <dt>Concluído em</dt>
                <dd>
                  <time dateTime={order.completedAt}>{formatOrderDate(order.completedAt)}</time>
                </dd>
              </div>
            ) : null}
          </dl>
        </Panel>
      </aside>
    </div>
  );
}

export function SaleDetailView({ orderId }: { orderId: string }) {
  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="VENDEDOR · VENDA"
        title="Detalhe da venda"
        description="Estado, valores e histórico de um pedido desta conta de venda."
        action={
          <Link className="text-link" href="/conta/vendas">
            Voltar ao painel
          </Link>
        }
      />
      <SellerScopeGate>
        <ScopedSaleDetail orderId={orderId} />
      </SellerScopeGate>
    </div>
  );
}
