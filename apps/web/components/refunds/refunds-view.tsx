"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, PageState, Panel, StatusBadge } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { DataProvenance } from "@/components/account/data-provenance";
import { MinorMoney } from "@/components/operations/minor-money";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useApiResource } from "@/hooks/use-api-resource";
import { isApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date-format";
import styles from "@/components/account/account-dashboard.module.css";
import {
  REFUND_LIST_CONTRACT,
  isRefundRequestStatus,
  parseRefundRequestPage,
  refundAwaitsBuyer,
  refundRequestStatuses,
  refundStatusLabel,
  refundStatusTone,
  type RefundRequestStatus,
} from "./refund-request";

type StatusFilter = "ALL" | RefundRequestStatus;

/** O contrato aceita `status=`, então o filtro vai ao servidor em vez de recortar a página. */
function listPath(status: StatusFilter, cursor: string | undefined): string {
  const query = new URLSearchParams();
  if (status !== "ALL") query.set("status", status);
  if (cursor) query.set("cursor", cursor);
  const suffix = query.toString();
  return `/v1/me/refund-requests${suffix ? `?${suffix}` : ""}`;
}

function ContractNotPublished({ retry }: { retry: () => void }) {
  return (
    <PageState
      kind="unavailable"
      title="Solicitações de reembolso ainda não publicadas pela API"
      description={`Esta tela lê ${REFUND_LIST_CONTRACT}. Enquanto o contrato não responder, nenhuma solicitação, valor ou prazo é apresentado por suposição.`}
      reference={REFUND_LIST_CONTRACT}
      actions={
        <>
          <Button variant="outline" onClick={retry}>
            Tentar novamente
          </Button>
          <Link className="button-link" href="/conta/compras">
            Abrir minhas compras
          </Link>
        </>
      }
    />
  );
}

export function RefundsView() {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const cursor = cursorHistory.at(-1);
  const resource = useApiResource<unknown>(listPath(status, cursor));

  const header = (
    <PageHeader
      eyebrow="MINHA CONTA · COMPRADOR"
      title="Solicitações de reembolso"
      description="Cada linha é uma solicitação sua: o pedido que você fez à operação. A devolução do dinheiro é um fato financeiro separado, com estado próprio."
    />
  );

  if (resource.status === "error") {
    const error = resource.error;
    const notPublished =
      isApiError(error) &&
      (error.problem.status === 404 || error.problem.code === "CAPABILITY_NOT_IMPLEMENTED");
    return (
      <div className={styles.pageStack}>
        {header}
        {notPublished ? (
          <ContractNotPublished retry={resource.retry} />
        ) : (
          <ResourceError error={error} retry={resource.retry} />
        )}
      </div>
    );
  }

  if (resource.status !== "ready") {
    return (
      <div className={styles.pageStack}>
        {header}
        <ResourceLoading label="Carregando solicitações de reembolso" />
      </div>
    );
  }

  const page = parseRefundRequestPage(resource.data);
  if (!page) {
    return (
      <div className={styles.pageStack}>
        {header}
        <PageState
          kind="error"
          title="A resposta não corresponde ao contrato da lista"
          description={`A API respondeu, mas o envelope exigido por ${REFUND_LIST_CONTRACT} não veio no formato esperado. Preferimos não exibir nada a exibir um valor incorreto sobre dinheiro.`}
          reference={REFUND_LIST_CONTRACT}
          actions={
            <Button variant="outline" onClick={resource.retry}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  const filterLabel = status === "ALL" ? "todas as solicitações" : refundStatusLabel(status);

  return (
    <div className={styles.pageStack}>
      {header}
      {page.asOf ? (
        <DataProvenance
          source={REFUND_LIST_CONTRACT}
          scope={`somente solicitações em que você é o solicitante · ${filterLabel}`}
          asOf={page.asOf}
          freshness={page.freshness ?? undefined}
        />
      ) : (
        <p className={styles.secondaryText}>
          A resposta não trouxe <code>asOf</code>. Sem corte de leitura declarado pelo servidor, esta
          página não afirma a que momento os dados se referem.
        </p>
      )}

      <div className={styles.toolbar} role="search" aria-label="Filtrar solicitações no servidor">
        <div className={styles.field}>
          <label htmlFor="refund-status">Estado da solicitação</label>
          <select
            id="refund-status"
            value={status}
            onChange={(event) => {
              const chosen = event.target.value;
              setStatus(isRefundRequestStatus(chosen) ? chosen : "ALL");
              setCursorHistory([]);
            }}
          >
            <option value="ALL">Todos</option>
            {refundRequestStatuses.map((code) => (
              <option value={code} key={code}>
                {refundStatusLabel(code)}
              </option>
            ))}
          </select>
        </div>
        <span className={styles.resultCount} aria-live="polite">
          {page.items.length} solicitação(ões) nesta página
        </span>
      </div>

      {page.discarded > 0 ? (
        <p className={styles.errorText} role="status">
          {page.discarded} linha(s) desta página vieram fora do contrato e foram descartadas em vez
          de exibidas incompletas. O total acima já reflete o descarte.
        </p>
      ) : null}

      {page.items.length === 0 ? (
        <PageState
          kind="empty"
          title={
            status === "ALL"
              ? "Nenhuma solicitação de reembolso"
              : "Nenhuma solicitação neste estado"
          }
          description={
            status === "ALL"
              ? "A solicitação nasce no pedido, não aqui. Abra a compra correspondente para verificar se ela é elegível."
              : "O servidor não devolveu solicitação neste estado. Troque o filtro para ver os demais."
          }
          actions={
            <Link className="button-link" href="/conta/compras">
              Abrir minhas compras
            </Link>
          }
        />
      ) : (
        <Panel className={styles.tablePanel}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <caption>Solicitações devolvidas pela API</caption>
              <thead>
                <tr>
                  <th scope="col">Solicitação</th>
                  <th scope="col">Valor solicitado</th>
                  <th scope="col">Valor aprovado</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Criada em</th>
                  <th scope="col">
                    <span className="sr-only">Ação</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((item) => (
                  <tr key={item.refundRequestId}>
                    <td className={styles.primaryCell}>
                      <strong>{item.refundRequestId}</strong>
                      <small>Pedido {item.orderId}</small>
                    </td>
                    <td className={styles.numeric}>
                      <MinorMoney amountMinor={item.requestedAmountMinor} currency={item.currency} />
                    </td>
                    <td className={styles.numeric}>
                      {item.approvedAmountMinor === null ? (
                        <span className={styles.secondaryText}>Sem decisão nesta resposta</span>
                      ) : (
                        <MinorMoney
                          amountMinor={item.approvedAmountMinor}
                          currency={item.currency}
                        />
                      )}
                    </td>
                    <td>
                      <StatusBadge tone={refundStatusTone(item.status)}>
                        {refundStatusLabel(item.status)}
                      </StatusBadge>
                      {refundAwaitsBuyer(item.status) ? (
                        <small className={styles.secondaryText}>Depende de você</small>
                      ) : null}
                    </td>
                    <td className={styles.dateCell}>
                      <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
                    </td>
                    <td className={styles.actionCell}>
                      <Link
                        className="text-link"
                        href={`/conta/reembolsos/${encodeURIComponent(item.refundRequestId)}`}
                      >
                        Abrir solicitação
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <nav className={styles.pager} aria-label="Paginação de solicitações">
        <p>
          Página {cursorHistory.length + 1}. O filtro de estado é aplicado pelo servidor, não sobre a
          página já carregada.
        </p>
        <div className={styles.pagerActions}>
          <Button
            size="small"
            variant="outline"
            disabled={cursorHistory.length === 0}
            onClick={() => {
              setCursorHistory((history) => history.slice(0, -1));
            }}
          >
            Anterior
          </Button>
          <Button
            size="small"
            variant="outline"
            disabled={page.nextCursor === null}
            onClick={() => {
              const nextCursor = page.nextCursor;
              if (nextCursor !== null) {
                setCursorHistory((history) => [...history, nextCursor]);
              }
            }}
          >
            Próxima
          </Button>
        </div>
      </nav>
    </div>
  );
}
