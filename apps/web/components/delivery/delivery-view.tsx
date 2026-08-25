"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, MessageSquare, Scale, ShieldCheck, UserRound } from "lucide-react";
import { Button, Freshness, PageState, Panel, PanelKicker, Skeleton, StatusBadge } from "@midas/ui";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError, type ApiError } from "@/lib/api-client";
import { ConfirmationPanel } from "./confirmation-panel";
import { CustodyCard } from "./custody-card";
import {
  UNPUBLISHED_CAPABILITIES,
  deliveryEndpoints,
  describeDeliveryState,
  describeViewerTurn,
  formatAbsoluteInstant,
  isDisputedOrder,
  orderEventLabel,
  partyLabel,
  resolveDeliveryState,
  resolveViewerParty,
  type DeliveryEnvelope,
  type DeliveryParty,
  type DeliveryPayload,
  type DeliveryState,
  type OrderDetailEnvelope,
  type OrderEventPayload,
  type OrderPayload,
  type SellerAccountListEnvelope,
} from "./delivery-state";
import styles from "./delivery.module.css";

const HELP_HREF = "/ajuda";

function DeliveryLoading() {
  return (
    <div className={styles.loading} aria-busy="true" aria-label="Carregando a entrega do pedido">
      <Skeleton height="3rem" />
      <div className={styles.loadingGrid}>
        <div className={styles.loadingColumn}>
          <Skeleton height="22rem" />
          <Skeleton height="16rem" />
        </div>
        <Skeleton height="20rem" />
      </div>
    </div>
  );
}

/**
 * Pedido de outra pessoa devolve exatamente o mesmo estado de "não encontrado"
 * que pedido inexistente: `assertOrderParticipant` responde 404 justamente para
 * não confirmar a existência do pedido a quem não é parte. A tela repete esse
 * comportamento e nunca transforma 403 em mensagem diferenciada.
 */
function DeliveryErrorState({
  error,
  retry,
  orderId,
}: {
  error: Error | ApiError;
  retry: () => void;
  orderId: string;
}) {
  if (!isApiError(error)) {
    return (
      <PageState
        kind="offline"
        title="Não foi possível alcançar a entrega deste pedido"
        description="A conexão com a API falhou. Nenhuma confirmação, marco ou liberação de pacote foi presumida pela interface."
        actions={<Button onClick={retry}>Tentar novamente</Button>}
      />
    );
  }

  const { problem } = error;
  const referenceProps = problem.correlationId ? { reference: problem.correlationId } : {};

  if (problem.status === 401) {
    return (
      <PageState
        kind="forbidden"
        title="Sua sessão precisa ser renovada"
        description="Entre novamente para acessar a entrega deste pedido. Nenhum dado do pedido foi exibido."
        actions={
          <Link className="button-link" href="/entrar">
            Entrar
          </Link>
        }
        {...referenceProps}
      />
    );
  }

  if (problem.code === "CAPABILITY_NOT_IMPLEMENTED") {
    return (
      <PageState
        kind="unavailable"
        title="Leitura do pedido ainda não publicada pela API"
        description="A tela consome GET /v1/orders/{orderId} e POST /v1/orders/{orderId}/delivery/confirmations (SCR-BUY-006). O backend não expôs essa leitura neste corte e nenhuma confirmação, marco ou pacote fictício foi criado no lugar."
        actions={
          <>
            <Button onClick={retry}>Tentar novamente</Button>
            <Link className="text-link" href="/conta/compras">
              Voltar para Minhas compras
            </Link>
          </>
        }
        {...referenceProps}
      />
    );
  }

  if (problem.status === 404 || problem.status === 403) {
    return (
      <PageState
        kind="empty"
        title="Pedido não encontrado"
        description="Este endereço não corresponde a um pedido acessível na sua sessão. A entrega segura é visível apenas para o comprador e para o vendedor daquele pedido."
        actions={
          <Link className="button-link" href="/conta/compras">
            Voltar para Minhas compras
          </Link>
        }
        {...referenceProps}
      />
    );
  }

  if (problem.status === 503) {
    return (
      <PageState
        kind="unavailable"
        title="Dependência da entrega indisponível"
        description={
          problem.detail ||
          `A fonte canônica não respondeu para o pedido ${orderId}. A confirmação permanece bloqueada até uma leitura válida.`
        }
        actions={<Button onClick={retry}>Tentar novamente</Button>}
        {...referenceProps}
      />
    );
  }

  return (
    <PageState
      kind="error"
      title={problem.title || "Não foi possível carregar a entrega"}
      description={
        problem.detail || "Tente novamente. Nenhum estado de confirmação foi presumido pela interface."
      }
      actions={<Button onClick={retry}>Tentar novamente</Button>}
      {...referenceProps}
    />
  );
}

function TurnPanel({
  state,
  viewer,
}: {
  state: DeliveryState;
  viewer: DeliveryParty | null;
}) {
  const descriptor = describeDeliveryState(state);
  const turn = describeViewerTurn(state, viewer);

  return (
    <Panel as="section" className={styles.turnPanel} aria-labelledby="delivery-turn-title">
      <PanelKicker>DE QUEM É A VEZ</PanelKicker>
      <h2 id="delivery-turn-title" className={styles.panelTitle}>
        {turn.headline}
      </h2>
      <p className={styles.panelLead}>{turn.detail}</p>
      <dl className={styles.turnFacts}>
        <div>
          <dt>Estado</dt>
          <dd>
            <StatusBadge tone={descriptor.tone}>{descriptor.label}</StatusBadge>
          </dd>
        </div>
        <div>
          <dt>O que isso significa</dt>
          <dd>{descriptor.explanation}</dd>
        </div>
        <div>
          <dt>Quem pode agir</dt>
          <dd>{descriptor.whoCanAct}</dd>
        </div>
        <div>
          <dt>Próxima ação</dt>
          <dd>{descriptor.nextAction}</dd>
        </div>
        <div>
          <dt>Seu papel neste pedido</dt>
          <dd>{viewer ? partyLabel(viewer) : "Não verificado nesta sessão"}</dd>
        </div>
      </dl>
    </Panel>
  );
}

function DisputePanel({ order }: { order: OrderPayload }) {
  if (!isDisputedOrder(order)) return null;
  return (
    <Panel as="section" className={styles.disputePanel} aria-labelledby="delivery-dispute-title">
      <PanelKicker>DISPUTA EM ANDAMENTO</PanelKicker>
      <h2 id="delivery-dispute-title" className={styles.panelTitle}>
        Este pedido está em disputa
      </h2>
      <p className={styles.panelLead}>
        <Scale aria-hidden="true" size={15} /> O pedido {order.publicCode} está em DISPUTED. As
        confirmações ficam suspensas e nenhuma liberação de valor acontece automaticamente enquanto
        não houver decisão.
      </p>
      <p className={styles.actionReason}>
        O contrato publicado não expõe o identificador da disputa por esta leitura, então a tela não
        monta um link para uma disputa que ela não conhece.
      </p>
      <Link className="text-link" href={HELP_HREF}>
        Acompanhar pela central de ajuda
      </Link>
    </Panel>
  );
}

function TimelinePanel({ timeline }: { timeline: OrderEventPayload[] }) {
  if (timeline.length === 0) return null;
  return (
    <Panel as="section" className={styles.eventsPanel} aria-labelledby="delivery-events-title">
      <PanelKicker>EVENTOS REGISTRADOS</PanelKicker>
      <h2 id="delivery-events-title" className={styles.panelTitle}>
        Linha do tempo do servidor
      </h2>
      <ol className={styles.eventList}>
        {timeline.map((event) => {
          const occurredAt = formatAbsoluteInstant(event.occurredAt);
          return (
            <li key={event.orderEventId}>
              <strong>{orderEventLabel(event.eventType)}</strong>
              {occurredAt ? <time dateTime={event.occurredAt}>{occurredAt}</time> : null}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function ChannelPanel() {
  return (
    <Panel as="section" className={styles.helpPanel} aria-labelledby="delivery-channel-title">
      <PanelKicker>COMBINADO DA ENTREGA</PanelKicker>
      <h2 id="delivery-channel-title" className={styles.panelTitle}>
        Onde as instruções ficam
      </h2>
      <p className={styles.panelLead}>
        <MessageSquare aria-hidden="true" size={15} /> {UNPUBLISHED_CAPABILITIES.sendInstruction}
      </p>
      <Link className="text-link" href="/mensagens">
        Abrir mensagens
      </Link>
    </Panel>
  );
}

export function DeliveryView({ orderId }: { orderId: string }) {
  const endpoints = deliveryEndpoints(orderId);
  const detail = useApiResource<OrderDetailEnvelope>(endpoints.orderDetail);
  const sellerAccounts = useApiResource<SellerAccountListEnvelope>(endpoints.sellerAccounts);

  // Guardamos a última leitura válida para que um refresh não apague a tela e
  // deixe o usuário sem saber em que estado a entrega dele está.
  const [snapshot, setSnapshot] = useState<OrderDetailEnvelope | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (detail.status === "ready") setSnapshot(detail.data);
  }, [detail.status, detail.data]);

  const envelope = detail.status === "ready" ? detail.data : snapshot;
  const order = envelope?.data.order ?? null;
  const delivery = envelope?.data.delivery ?? null;
  const timeline = envelope?.data.timeline ?? [];

  const viewer = order
    ? resolveViewerParty(
        order,
        sellerAccounts.status === "ready" ? sellerAccounts.data.data : null,
      )
    : null;

  function mutationMessage(error: unknown): string {
    if (isApiError(error)) {
      const { problem } = error;
      if (problem.status === 403 || problem.status === 404) {
        return "Esta ação não está mais disponível para o seu acesso neste pedido. Recarregue a tela para ver o estado atual.";
      }
      if (problem.status === 409) {
        return (
          problem.detail ||
          "O estado do pedido mudou enquanto você agia. Recarregue a tela antes de tentar de novo."
        );
      }
      return problem.detail || problem.title;
    }
    return error instanceof Error ? error.message : "Falha desconhecida ao falar com a API.";
  }

  function applyDelivery(updated: DeliveryPayload) {
    setSnapshot((current) =>
      current ? { ...current, data: { ...current.data, delivery: updated } } : current,
    );
  }

  function confirmDelivery() {
    if (!viewer) return;
    setConfirming(true);
    setActionError(null);
    void (async () => {
      try {
        const response = await apiRequest<DeliveryEnvelope>(endpoints.confirmations, {
          method: "POST",
          body: JSON.stringify({ role: viewer }),
        });
        if (response.data) applyDelivery(response.data);
        // A confirmação pode concluir o pedido e acrescentar eventos; relemos a
        // fonte canônica em vez de deduzir o novo estado do pedido na interface.
        detail.retry();
      } catch (error: unknown) {
        setActionError(mutationMessage(error));
      } finally {
        setConfirming(false);
      }
    })();
  }

  const backHref = viewer === "SELLER" ? "/conta/vendas" : "/conta/compras";
  const backLabel = viewer === "SELLER" ? "Minhas vendas" : "Minhas compras";
  const heading = order ? order.publicCode : orderId;

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href={backHref}>
          <ArrowLeft aria-hidden="true" size={15} /> {backLabel}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Entrega do pedido {heading}</span>
      </nav>

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <ShieldCheck aria-hidden="true" size={15} /> ENTREGA SEGURA · SCR-BUY-006
          </span>
          <h1>Entrega do pedido {heading}</h1>
          <p>
            Custódia do pacote e duas confirmações independentes: a do comprador e a do vendedor.
            Nenhuma delas vale pela outra.
          </p>
        </div>
        {order && envelope ? (
          <div className={styles.headerMeta}>
            <span className={styles.roleTag}>
              <UserRound aria-hidden="true" size={15} />{" "}
              {viewer
                ? `Você é ${partyLabel(viewer).toLocaleLowerCase("pt-BR")} neste pedido`
                : "Papel não verificado nesta sessão"}
            </span>
            <Freshness asOf={envelope.asOf} label="Leitura" />
          </div>
        ) : null}
      </header>

      {order && envelope ? (
        <div className={styles.grid}>
          <div className={styles.mainColumn}>
            <CustodyCard
              order={order}
              delivery={delivery}
              state={resolveDeliveryState(order, delivery)}
            />
            <ConfirmationPanel
              order={order}
              delivery={delivery}
              state={resolveDeliveryState(order, delivery)}
              viewer={viewer}
              confirming={confirming}
              actionError={actionError}
              onConfirm={confirmDelivery}
              helpHref={HELP_HREF}
            />
          </div>

          <aside className={styles.sideColumn} aria-label="Situação e saída de conflito">
            <TurnPanel state={resolveDeliveryState(order, delivery)} viewer={viewer} />
            <DisputePanel order={order} />
            <Panel as="section" className={styles.helpPanel} aria-labelledby="delivery-help-title">
              <PanelKicker>SAÍDA DE CONFLITO</PanelKicker>
              <h2 id="delivery-help-title" className={styles.panelTitle}>
                Discordar é um caminho previsto
              </h2>
              <p className={styles.panelLead}>
                <Scale aria-hidden="true" size={15} /> Reportar problema e abrir disputa ficam junto
                do botão de confirmar, com o mesmo destaque. Leve o código {order.publicCode} para a
                central de ajuda.
              </p>
              {sellerAccounts.status === "error" ? (
                <p className={styles.actionReason}>
                  <AlertTriangle aria-hidden="true" size={14} /> A leitura das suas contas vendedoras
                  falhou, então a tela não afirma qual é o seu papel neste pedido e não oferece
                  confirmação em nome de um papel não verificado.
                </p>
              ) : null}
              <Link className="text-link" href={HELP_HREF}>
                Central de ajuda
              </Link>
            </Panel>
            <ChannelPanel />
            <TimelinePanel timeline={timeline} />
          </aside>
        </div>
      ) : detail.status === "error" ? (
        <DeliveryErrorState error={detail.error} retry={detail.retry} orderId={orderId} />
      ) : (
        <DeliveryLoading />
      )}
    </div>
  );
}
