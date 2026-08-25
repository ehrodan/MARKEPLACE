"use client";

/**
 * SCR-BUY-003 — /checkout/:paymentId
 *
 * ============================ FRONTEIRA PCI (auditável) ============================
 * Esta tela NUNCA renderiza campo de cartão. Não existe aqui input de PAN, CVV,
 * validade, titular ou bandeira, e nenhum desses dados trafega pelo domínio do Midas.
 * A captura acontece exclusivamente em SESSÃO HOSPEDADA pelo provedor de pagamento
 * (PSP), no domínio dele. O Midas guarda apenas a referência opaca do pagamento
 * (`providerCode` + `paymentId`) e o estado publicado por `GET /v1/me/payments`.
 * Qualquer PR que adicione um campo de cartão neste arquivo quebra o escopo SAQ-A e
 * deve ser rejeitado. Regra registrada em docs/07 §7 ("Checkout não coleta PAN/CVV
 * nem libera entrega por retorno do navegador") e docs/04.
 *
 * ====================== CONFIRMAÇÃO DE PAGAMENTO (auditável) ======================
 * O retorno do navegador vindo do PSP é APENAS INFORMATIVO. Somente o webhook
 * autenticado confirma a liquidação (docs/07 §FL-05.5 e §FL-11.1). Por isso o
 * parâmetro de retorno leva o estado para "Confirmando com o provedor" e nunca para
 * "pago". Nada nesta tela confirma pagamento por tempo decorrido.
 *
 * ============================== GATE G2 (fechado) ================================
 * Não há provedor de pagamento habilitado nem rota publicada para criar/retomar a
 * sessão hospedada. No lugar do botão de pagar, a tela declara o bloqueio com o
 * motivo real devolvido por `GET /v1/finance/provider-capability`.
 *
 * Motion: M0 (docs/07 §1.4). Nenhuma animação decorativa, nenhum cronômetro de
 * urgência, nenhuma contagem regressiva.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  ExternalLink,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button, PageState, StatusBadge } from "@midas/ui";
import { BrandWordmark } from "@/components/brand-wordmark";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useApiResource } from "@/hooks/use-api-resource";
import { isApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date-format";
import { CheckoutSummary } from "./checkout-summary";
import { PolicyAcceptance, type PolicySnapshot } from "./policy-acceptance";
import {
  checkOrderTotals,
  checkoutSteps,
  describeReservationDeadline,
  findPaymentById,
  projectOrderSummary,
  resolveCheckoutState,
  stepIndexOf,
  type CheckoutPaymentList,
  type CheckoutTone,
  type OrderDetailEnvelope,
  type ProviderCapability,
} from "./checkout-state";
import styles from "./checkout.module.css";

/** Contratos canônicos consultados por esta tela. */
const PAYMENTS_PATH = "GET /v1/me/payments";
const CAPABILITY_PATH = "GET /v1/finance/provider-capability";
const ORDER_PATH = "GET /v1/orders/{orderId}";
const POLICY_PATH = "GET /v1/policies/{policySlug}";

/**
 * Rota que criaria ou retomaria a sessão hospedada do PSP. Enquanto não existir na API,
 * nenhuma sessão é aberta e nenhum pagamento é simulado. Ligar isto sem a rota publicada
 * produziria um botão que promete o que o servidor não faz.
 */
const SESSION_CONTRACT_PUBLISHED: boolean = false;

/**
 * Snapshot versionado de política. O `PolicyRegistry` (SCR-PUB-011) ainda é PROPOSTO e
 * nenhuma rota publica versão e vigência. Carimbar uma versão inventada tornaria o aceite
 * inválido, então o componente declara o contrato ausente.
 */
const POLICY_SNAPSHOT: PolicySnapshot | null = null;

/** `financeUuidSchema` em packages/contracts/src/finance.ts — UUID versão 7. */
const PAYMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/** Prazo é releito a cada minuto: informação verificável, não cronômetro. */
const DEADLINE_REFRESH_MS = 60_000;

const toneToBadge: Record<CheckoutTone, "neutral" | "success" | "danger" | "warning" | "info"> = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
};

export interface CheckoutViewProps {
  paymentId: string;
  /** Verdadeiro quando a navegação chegou de volta do PSP. Estritamente informativo. */
  returnedFromProvider: boolean;
}

export function CheckoutView({ paymentId, returnedFromProvider }: CheckoutViewProps) {
  const payments = useApiResource<CheckoutPaymentList>("/v1/me/payments");
  const capability = useApiResource<ProviderCapability>("/v1/finance/provider-capability");

  const payment = payments.status === "ready" ? findPaymentById(payments.data, paymentId) : null;
  // O corpo é o envelope `{ data: { order, items, timeline, delivery }, asOf }`; o resumo
  // financeiro mora em `data.order` e é projetado com verificação de forma.
  const order = useApiResource<OrderDetailEnvelope>(
    payment ? `/v1/orders/${encodeURIComponent(payment.orderId)}` : null,
  );

  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const timer = setInterval(() => { setNow(new Date()); }, DEADLINE_REFRESH_MS);
    return () => { clearInterval(timer); };
  }, []);

  // Requisito de acessibilidade: ao falhar, o foco vai para o resumo do erro.
  useEffect(() => {
    if (actionError) errorSummaryRef.current?.focus();
  }, [actionError]);

  const orderData = order.status === "ready" ? projectOrderSummary(order.data) : null;
  // A rota respondeu, mas o corpo não trouxe `data.order` com os campos monetários do
  // contrato. Isso é diferente de "rota não publicada" e é dito com essas palavras.
  const orderShapeUnreadable = order.status === "ready" && orderData === null;
  const orderError = order.status === "error" ? order.error : null;
  // 404 / CAPABILITY_NOT_IMPLEMENTED significa "rota ainda não publicada": a decomposição
  // simplesmente não é exibida. Qualquer outra falha é anunciada, para não esconder que o
  // total ficou sem conferência.
  const orderMissingCapability = orderError !== null
    && isApiError(orderError)
    && (orderError.problem.status === 404 || orderError.problem.code === "CAPABILITY_NOT_IMPLEMENTED");

  const state = useMemo(() => {
    if (!payment || capability.status !== "ready") return null;
    return resolveCheckoutState({
      payment,
      capability: capability.data,
      order: orderData,
      policyAccepted,
      returnedFromProvider,
      sessionContractPublished: SESSION_CONTRACT_PUBLISHED,
      serverAllowedActions: [],
      now,
    });
  }, [capability, now, orderData, payment, policyAccepted, returnedFromProvider]);

  const deadline = describeReservationDeadline(orderData?.reservedUntil ?? null, now);
  const consistency = payment ? checkOrderTotals(orderData, payment) : "NOT_PUBLISHED";

  function refreshFromServer() {
    setActionError(null);
    payments.retry();
    capability.retry();
    order.retry();
    setRefreshNotice(`Nova leitura solicitada ao servidor em ${formatDateTime(new Date().toISOString())}.`);
  }

  if (!PAYMENT_ID_PATTERN.test(paymentId)) {
    return (
      <CheckoutShell>
        <PageState
          kind="empty"
          title="Identificador de pagamento inválido"
          description="O endereço não corresponde ao formato de identificador que a API emite para pagamentos. Nenhuma consulta foi feita com esse valor."
          actions={<Link className="button-link" href="/conta/compras">Ver minhas compras</Link>}
          reference={paymentId}
        />
      </CheckoutShell>
    );
  }

  if (payments.status === "error") {
    return (
      <CheckoutShell>
        <ResourceError error={payments.error} retry={payments.retry} />
      </CheckoutShell>
    );
  }

  if (capability.status === "error") {
    return (
      <CheckoutShell>
        <ResourceError error={capability.error} retry={capability.retry} />
      </CheckoutShell>
    );
  }

  if (payments.status !== "ready") {
    return (
      <CheckoutShell>
        <ResourceLoading label="Carregando pagamento, pedido e capacidade do provedor" />
      </CheckoutShell>
    );
  }

  if (capability.status !== "ready") {
    return (
      <CheckoutShell>
        <ResourceLoading label="Consultando a capacidade do provedor de pagamento" />
      </CheckoutShell>
    );
  }

  if (!payment) {
    return (
      <CheckoutShell>
        <PageState
          kind="empty"
          title="Pagamento não encontrado nesta conta"
          description={`A leitura ${PAYMENTS_PATH} devolve apenas os pagamentos da pessoa autenticada e nenhum deles corresponde a este identificador. Nada foi presumido a respeito de um pagamento de terceiros.`}
          actions={<Link className="button-link" href="/conta/compras">Ver minhas compras</Link>}
          reference={paymentId}
        />
      </CheckoutShell>
    );
  }

  if (!state) {
    return (
      <CheckoutShell>
        <ResourceLoading label="Resolvendo o estado do pagamento" />
      </CheckoutShell>
    );
  }

  const currentStepIndex = stepIndexOf(state.step);
  const currentStep = currentStepIndex >= 0 ? checkoutSteps[currentStepIndex] : undefined;
  const stepAnnouncement = currentStep
    ? `Etapa ${String(currentStepIndex + 1)} de ${String(checkoutSteps.length)}: ${currentStep.label}. Estado: ${state.label}.`
    : `Estado: ${state.label}.`;

  return (
    <CheckoutShell>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>SCR-BUY-003 · Checkout protegido</span>
          <h1 id="checkout-title">Concluir o pagamento com o provedor</h1>
          <p>
            Você revisa os valores aqui e paga no ambiente do provedor. O Midas não recebe, não exibe e
            não armazena dados de cartão.
          </p>
        </div>
        <StatusBadge tone={toneToBadge[state.tone]}>{state.label}</StatusBadge>
      </header>

      <nav className={styles.stepper} aria-label="Etapas do checkout">
        <ol>
          {checkoutSteps.map((step, index) => {
            const done = index < currentStepIndex;
            const active = index === currentStepIndex;
            return (
              <li
                key={step.code}
                className={`${styles.step} ${done ? styles.stepDone : ""} ${active ? styles.stepActive : ""}`.trim()}
                aria-current={active ? "step" : undefined}
              >
                <span className={styles.stepIndex} aria-hidden="true">{index + 1}</span>
                <span className={styles.stepLabel}>{step.label}</span>
              </li>
            );
          })}
        </ol>
      </nav>

      <p className="ui-visually-hidden" role="status">{stepAnnouncement}</p>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <section className={styles.stateCard} aria-labelledby="checkout-state-title">
            <div className={styles.stateHeading}>
              <ShieldCheck aria-hidden="true" size={18} />
              <h2 id="checkout-state-title">Estado do pagamento</h2>
              <StatusBadge tone={toneToBadge[state.tone]}>{state.stage}</StatusBadge>
            </div>
            <p className={styles.stateExplanation}>{state.explanation}</p>
            <p className={styles.settlementRule}>
              <LockKeyhole aria-hidden="true" size={16} />
              {state.settlementNote}
            </p>

            {state.blocks.length > 0 ? (
              <PageState
                kind="unavailable"
                title="Pagamento indisponível neste momento"
                description="A sessão de pagamento não pode ser aberta. Os motivos devolvidos pelo servidor estão listados abaixo — nenhum deles foi contornado ou simulado pela interface."
                reference={state.stage}
                actions={
                  <ul className={styles.blockList}>
                    {state.blocks.map((block) => (
                      <li key={block.code}>
                        <code>{block.code}</code>
                        <span>{block.message}</span>
                      </li>
                    ))}
                  </ul>
                }
              />
            ) : null}

            {actionError ? (
              <p className={styles.actionError} role="alert" tabIndex={-1} ref={errorSummaryRef}>
                <TriangleAlert aria-hidden="true" size={17} />
                {actionError}
              </p>
            ) : null}

            <div className={styles.stateActions}>
              {state.action?.code === "OPEN_ORDER" ? (
                <Link className="button-link" href={`/conta/compras/${encodeURIComponent(payment.orderId)}`}>
                  {state.action.label}
                </Link>
              ) : null}

              {state.action?.code === "REFRESH_PAYMENT_STATUS" ? (
                <Button
                  iconBefore={<RefreshCw aria-hidden="true" size={16} />}
                  onClick={refreshFromServer}
                >
                  {state.action.label}
                </Button>
              ) : null}

              {state.action?.code === "CREATE_PROVIDER_SESSION" || state.action?.code === "RESUME_PROVIDER_SESSION" ? (
                <Button
                  iconBefore={<ExternalLink aria-hidden="true" size={16} />}
                  onClick={() => {
                    // Só alcançável se SESSION_CONTRACT_PUBLISHED virar verdadeiro sem a rota existir.
                    setActionError(
                      "A rota que abre a sessão hospedada do provedor não está publicada nesta API. Nenhuma sessão foi criada e nenhum pagamento foi simulado.",
                    );
                  }}
                >
                  {state.action.label}
                </Button>
              ) : null}

              {state.action ? <p className={styles.actionDescription}>{state.action.description}</p> : null}
            </div>

            {refreshNotice ? <p className={styles.refreshNotice} role="status">{refreshNotice}</p> : null}

            <p className={styles.contractNote}>{state.cancellationNote}</p>
          </section>

          <PolicyAcceptance
            policy={POLICY_SNAPSHOT}
            accepted={policyAccepted}
            onAcceptedChange={setPolicyAccepted}
            contractPath={POLICY_PATH}
          />

          <section className={styles.identityCard} aria-labelledby="checkout-identity-title">
            <h2 id="checkout-identity-title">Pedido e pagamento</h2>
            <dl className={styles.identityList}>
              <div>
                <dt>Pagamento</dt>
                <dd><code>{payment.paymentId}</code></dd>
              </div>
              <div>
                <dt>Pedido</dt>
                <dd><code>{orderData?.publicCode ?? payment.orderId}</code></dd>
              </div>
              <div>
                <dt>Situação no servidor</dt>
                <dd>{payment.paymentStatus}</dd>
              </div>
              <div>
                <dt>Conciliação</dt>
                <dd>{payment.reconciliationStatus}</dd>
              </div>
              <div>
                <dt>Provedor vinculado</dt>
                <dd>{payment.providerCode ?? "Nenhum provedor vinculado ainda"}</dd>
              </div>
              <div>
                <dt>Pagamento criado em</dt>
                <dd>{formatDateTime(payment.createdAt)}</dd>
              </div>
              {payment.settledAt ? (
                <div>
                  <dt>Liquidado em</dt>
                  <dd>{formatDateTime(payment.settledAt)}</dd>
                </div>
              ) : null}
              {orderData ? (
                <div>
                  <dt>Situação do pedido</dt>
                  <dd>{orderData.status}</dd>
                </div>
              ) : null}
            </dl>
            <Link className="text-link" href={`/conta/compras/${encodeURIComponent(payment.orderId)}`}>
              Ver os itens deste pedido
            </Link>
          </section>
        </div>

        <aside className={styles.sideColumn} aria-label="Resumo e prazos">
          <CheckoutSummary
            payment={payment}
            order={orderData}
            consistency={consistency}
            contractPath={ORDER_PATH}
          />

          {orderShapeUnreadable ? (
            <p className={styles.summaryAlert} role="alert">
              <TriangleAlert aria-hidden="true" size={17} />
              A leitura do pedido respondeu, mas o corpo não trouxe a decomposição de subtotal, taxa e
              total no formato do contrato. Nenhum valor foi deduzido para preencher a lacuna.{" "}
              <button type="button" className="text-link" onClick={() => { order.retry(); }}>
                Tentar novamente
              </button>
            </p>
          ) : null}

          {orderError !== null && !orderMissingCapability ? (
            <p className={styles.summaryAlert} role="alert">
              <TriangleAlert aria-hidden="true" size={17} />
              A leitura do pedido falhou, então a decomposição não pôde ser conferida.{" "}
              <button type="button" className="text-link" onClick={() => { order.retry(); }}>
                Tentar novamente
              </button>
            </p>
          ) : null}

          {deadline ? (
            <section className={styles.deadlineCard} aria-labelledby="checkout-deadline-title">
              <div className={styles.deadlineHeading}>
                <Clock3 aria-hidden="true" size={18} />
                <h2 id="checkout-deadline-title">Prazo de reserva</h2>
              </div>
              <p className={styles.deadlineAbsolute}>
                <time dateTime={deadline.reservedUntil}>{formatDateTime(deadline.reservedUntil)}</time>
              </p>
              <p className={styles.deadlineRemaining}>{deadline.remainingLabel}</p>
              <p className={styles.contractNote}>
                Prazo enviado pelo servidor no campo <code>reservedUntil</code> do pedido. O texto é
                atualizado a cada minuto e não confirma nem cancela nada por si só.
              </p>
            </section>
          ) : null}

          <section className={styles.pciCard} aria-labelledby="checkout-pci-title">
            <div className={styles.deadlineHeading}>
              <LockKeyhole aria-hidden="true" size={18} />
              <h2 id="checkout-pci-title">Onde os dados de cartão são digitados</h2>
            </div>
            <p>
              No ambiente do provedor de pagamento, nunca nesta página. O Midas não renderiza campo de
              cartão, não recebe número, código de segurança ou validade e não guarda esses dados.
            </p>
            <p>
              A confirmação chega por webhook autenticado do provedor. Voltar do provedor pelo navegador
              não conclui a compra.
            </p>
          </section>

          <section className={styles.provenanceCard} aria-labelledby="checkout-provenance-title">
            <h2 id="checkout-provenance-title">Origem dos dados</h2>
            <ul>
              <li><code>{PAYMENTS_PATH}</code> · leitura de {formatDateTime(payments.data.asOf)}</li>
              <li>
                <code>{CAPABILITY_PATH}</code> · {capability.data.status}
                {capability.data.providerCode ? ` · ${capability.data.providerCode}` : ""}
              </li>
              <li>
                <code>{ORDER_PATH}</code> ·{" "}
                {orderData
                  ? "decomposição lida do envelope data.order"
                  : orderShapeUnreadable
                    ? "respondeu sem data.order no formato do contrato"
                    : "não publicado neste corte"}
              </li>
              <li><code>{POLICY_PATH}</code> · não publicado neste corte</li>
            </ul>
          </section>
        </aside>
      </div>
    </CheckoutShell>
  );
}

function CheckoutShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <BrandWordmark />
          <Link className="text-link" href="/carrinho">
            <ArrowLeft aria-hidden="true" size={16} /> Voltar ao carrinho
          </Link>
        </div>
      </header>
      <main className={styles.main} id="conteudo-principal">
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
