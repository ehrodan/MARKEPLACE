"use client";

import Link from "next/link";
import { Button, PageState, Panel, StatusBadge } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { DataProvenance } from "@/components/account/data-provenance";
import { MinorMoney } from "@/components/operations/minor-money";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { StatusLabel } from "@/components/status-label";
import { useApiResource } from "@/hooks/use-api-resource";
import { isApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date-format";
import styles from "@/components/account/account-dashboard.module.css";
import {
  REFUND_DETAIL_CONTRACT,
  parseRefundRequestDetail,
  refundStatusLabel,
  refundStatusMeaning,
  refundStatusTone,
  type RefundRequestDetail,
} from "./refund-request";

const ORDER_DETAIL_CONTRACT = "GET /v1/orders/{orderId}";

function Header({ refundRequestId }: { refundRequestId: string }) {
  return (
    <PageHeader
      eyebrow="MINHA CONTA · REEMBOLSO"
      title="Solicitação de reembolso"
      description={`Solicitação ${refundRequestId}. Esta tela mostra o pedido que você fez, a decisão da operação e a execução financeira como três fatos separados.`}
    />
  );
}

/**
 * A execução financeira é um fato diferente da decisão. Aprovado com execução
 * falha é estado normal, e a tela precisa dizer isso — se fundir os dois, o
 * comprador lê "aprovado" e conclui que o dinheiro caiu.
 */
function ExecutionSection({ refund }: { refund: RefundRequestDetail }) {
  return (
    <Panel className={styles.section} as="section" aria-labelledby="refund-execution-title">
      <div className={styles.sectionHeader}>
        <h2 id="refund-execution-title">Execução financeira</h2>
      </div>
      {refund.attempts === null ? (
        <p className={styles.secondaryText}>
          O contrato não expôs tentativas de execução nesta resposta. Ausência de tentativa não é o
          mesmo que tentativa sem sucesso, então esta seção não afirma nenhuma das duas.
        </p>
      ) : refund.attempts.length === 0 ? (
        <p className={styles.secondaryText}>
          O servidor afirmou que não existe nenhuma tentativa de execução até agora. Decisão
          favorável não devolve dinheiro por si: a devolução ocorre no provedor de pagamento e é
          registrada no ledger.
        </p>
      ) : (
        <ul className={styles.holdList}>
          {refund.attempts.map((attempt) => (
            <li className={styles.holdRow} key={attempt.refundAttemptId}>
              <div>
                <StatusLabel status={attempt.status} />
                <small className={styles.secondaryText}>
                  {attempt.providerReference === null
                    ? "Sem referência do provedor nesta resposta"
                    : `Referência do provedor: ${attempt.providerReference}`}
                </small>
                {attempt.failureCode === null ? null : (
                  <small className={styles.errorText}>Falha: {attempt.failureCode}</small>
                )}
              </div>
              <time dateTime={attempt.occurredAt}>{formatDateTime(attempt.occurredAt)}</time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function RefundDetailView({ refundRequestId }: { refundRequestId: string }) {
  const resource = useApiResource<unknown>(
    `/v1/refund-requests/${encodeURIComponent(refundRequestId)}`,
  );

  if (resource.status === "error") {
    const error = resource.error;
    const notPublished =
      isApiError(error) &&
      (error.problem.status === 404 || error.problem.code === "CAPABILITY_NOT_IMPLEMENTED");
    return (
      <div className={styles.pageStack}>
        <Header refundRequestId={refundRequestId} />
        {notPublished ? (
          <PageState
            kind="unavailable"
            title="Detalhe da solicitação ainda não publicado pela API"
            description={`Esta tela lê ${REFUND_DETAIL_CONTRACT}. Um 404 aqui pode significar contrato ausente ou solicitação inexistente, e a tela se recusa a escolher entre as duas hipóteses.`}
            reference={REFUND_DETAIL_CONTRACT}
            actions={
              <>
                <Button variant="outline" onClick={resource.retry}>
                  Tentar novamente
                </Button>
                <Link className="button-link" href="/conta/reembolsos">
                  Voltar às solicitações
                </Link>
              </>
            }
          />
        ) : (
          <ResourceError error={error} retry={resource.retry} />
        )}
      </div>
    );
  }

  if (resource.status !== "ready") {
    return (
      <div className={styles.pageStack}>
        <Header refundRequestId={refundRequestId} />
        <ResourceLoading label="Carregando a solicitação" />
      </div>
    );
  }

  const refund = parseRefundRequestDetail(resource.data);
  if (!refund) {
    return (
      <div className={styles.pageStack}>
        <Header refundRequestId={refundRequestId} />
        <PageState
          kind="error"
          title="A resposta não corresponde ao contrato da solicitação"
          description={`A API respondeu, mas os campos exigidos por ${REFUND_DETAIL_CONTRACT} não vieram no formato esperado. Nenhum valor é exibido por dedução.`}
          reference={REFUND_DETAIL_CONTRACT}
          actions={
            <Button variant="outline" onClick={resource.retry}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.pageStack}>
      <Header refundRequestId={refund.refundRequestId} />
      {refund.asOf ? (
        <DataProvenance
          source={REFUND_DETAIL_CONTRACT}
          scope="somente solicitações em que você é o solicitante"
          asOf={refund.asOf}
        />
      ) : (
        <p className={styles.secondaryText}>
          A resposta não trouxe <code>asOf</code>. Sem corte de leitura declarado pelo servidor, esta
          tela não afirma a que momento os dados se referem.
        </p>
      )}

      <Panel className={styles.section} as="section" aria-labelledby="refund-status-title">
        <div className={styles.sectionHeader}>
          <h2 id="refund-status-title">Estado da solicitação</h2>
          <StatusBadge tone={refundStatusTone(refund.status)}>
            {refundStatusLabel(refund.status)}
          </StatusBadge>
        </div>
        <p className={styles.notice}>{refundStatusMeaning(refund.status)}</p>
      </Panel>

      <Panel className={styles.section} as="section" aria-labelledby="refund-request-title">
        <div className={styles.sectionHeader}>
          <h2 id="refund-request-title">O que você pediu</h2>
        </div>
        <dl className={styles.metricGrid}>
          <div className={styles.metricCard}>
            <dt className={styles.metricLabel}>Valor solicitado</dt>
            <dd className={styles.metricValue}>
              <MinorMoney amountMinor={refund.requestedAmountMinor} currency={refund.currency} />
            </dd>
            <dd className={styles.metricMeta}>Valor que você pediu, na moeda do pedido.</dd>
          </div>
          <div className={styles.metricCard}>
            <dt className={styles.metricLabel}>Valor aprovado</dt>
            <dd className={styles.metricValue}>
              {refund.approvedAmountMinor === null ? (
                "Sem decisão nesta resposta"
              ) : (
                <MinorMoney amountMinor={refund.approvedAmountMinor} currency={refund.currency} />
              )}
            </dd>
            <dd className={styles.metricMeta}>
              Vem da decisão da operação. Esta tela não calcula, não arredonda e não projeta
              diferença entre solicitado e aprovado.
            </dd>
          </div>
          <div className={styles.metricCard}>
            <dt className={styles.metricLabel}>Criada em</dt>
            <dd className={styles.metricValue}>
              <time dateTime={refund.createdAt}>{formatDateTime(refund.createdAt)}</time>
            </dd>
            <dd className={styles.metricMeta}>
              {refund.updatedAt === null
                ? "A resposta não trouxe data de atualização."
                : `Última atualização em ${formatDateTime(refund.updatedAt)}.`}
            </dd>
          </div>
        </dl>
        <p className={styles.secondaryText}>
          {refund.reasonCode === null
            ? "A resposta não trouxe o motivo estruturado da solicitação."
            : `Motivo registrado: ${refund.reasonCode}.`}
        </p>
        {refund.description === null ? null : (
          <p className={styles.notice}>{refund.description}</p>
        )}
      </Panel>

      <Panel className={styles.section} as="section" aria-labelledby="refund-decision-title">
        <div className={styles.sectionHeader}>
          <h2 id="refund-decision-title">Decisão da operação</h2>
        </div>
        {refund.decidedAt === null ? (
          <p className={styles.secondaryText}>
            Nenhuma decisão foi registrada nesta resposta. Sem decisão, não há valor aprovado nem
            prazo de devolução — e esta tela não estima nenhum dos dois.
          </p>
        ) : (
          <>
            <p className={styles.metricValue}>
              Decidida em <time dateTime={refund.decidedAt}>{formatDateTime(refund.decidedAt)}</time>
            </p>
            <p className={refund.decisionRationale === null ? styles.secondaryText : styles.notice}>
              {refund.decisionRationale ?? "A decisão não trouxe justificativa nesta resposta."}
            </p>
          </>
        )}
      </Panel>

      <ExecutionSection refund={refund} />

      <Panel className={styles.section} as="section" aria-labelledby="refund-related-title">
        <div className={styles.sectionHeader}>
          <h2 id="refund-related-title">Objetos relacionados</h2>
        </div>
        <p className={styles.secondaryText}>
          Referência por identificador, sem copiar estado nem evidência de um objeto para outro.
        </p>
        <ul className={styles.holdList}>
          <li className={styles.holdRow}>
            <span>Pedido {refund.orderId}</span>
            <Link
              className="text-link"
              href={`/conta/compras/${encodeURIComponent(refund.orderId)}`}
            >
              Abrir pedido
            </Link>
          </li>
          <li className={styles.holdRow}>
            <span>
              {refund.relatedTicketId === null
                ? "Nenhum ticket vinculado nesta resposta"
                : `Ticket ${refund.relatedTicketId}`}
            </span>
            {refund.relatedTicketId === null ? null : (
              <Link
                className="text-link"
                href={`/conta/suporte/${encodeURIComponent(refund.relatedTicketId)}`}
              >
                Abrir ticket
              </Link>
            )}
          </li>
          <li className={styles.holdRow}>
            <span>
              {refund.relatedDisputeId === null
                ? "Nenhuma disputa vinculada nesta resposta"
                : `Disputa ${refund.relatedDisputeId}`}
            </span>
            {refund.relatedDisputeId === null ? null : (
              <Link
                className="text-link"
                href={`/pedidos/${encodeURIComponent(refund.orderId)}/disputa/${encodeURIComponent(refund.relatedDisputeId)}`}
              >
                Abrir disputa
              </Link>
            )}
          </li>
        </ul>
        <p className={styles.secondaryText}>
          Ticket não vira disputa e solicitação não vira refund do provedor. O estado do pedido é
          lido em {ORDER_DETAIL_CONTRACT}, não deduzido daqui.
        </p>
      </Panel>

      <nav className={styles.pagerActions} aria-label="Navegação da solicitação">
        <Link className="button-link" href="/conta/reembolsos">
          Voltar às solicitações
        </Link>
      </nav>
    </div>
  );
}
