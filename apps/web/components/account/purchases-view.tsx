"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, PageState, Panel, StatusBadge } from "@midas/ui";
import { MinorMoney } from "@/components/operations/minor-money";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useApiResource } from "@/hooks/use-api-resource";
import type { CursorPage, PurchaseListItem } from "@/lib/api-types";
import { formatDateTime } from "@/lib/date-format";
import { orderStatusView } from "@/lib/order-status";
import { DataProvenance } from "./data-provenance";
import styles from "./account-dashboard.module.css";

export function PurchasesView() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const cursor = cursorHistory.at(-1);
  const path = `/v1/me/purchases${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
  const resource = useApiResource<CursorPage<PurchaseListItem>>(path);

  if (resource.status !== "ready") {
    return (
      <div className={styles.pageStack}>
        <PageHeader
          eyebrow="MINHA CONTA · COMPRADOR"
          title="Compras"
          description="Pedidos vinculados à sua identidade, com estado e próxima ação confirmados pelo servidor."
        />
        {resource.status === "error"
          ? <ResourceError error={resource.error} retry={resource.retry} />
          : <ResourceLoading label="Carregando compras" />}
      </div>
    );
  }

  const page = resource.data;
  const statuses = [...new Set(page.data.map((item) => item.status))].sort();
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = page.data.filter((item) => {
    const matchesStatus = status === "ALL" || item.status === status;
    const searchableValues = [item.publicCode, item.orderId, item.sellerAccountId]
      .filter((value): value is string => Boolean(value));
    const matchesQuery = !normalizedQuery || searchableValues
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
    return matchesStatus && matchesQuery;
  });

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="MINHA CONTA · COMPRADOR"
        title="Compras"
        description="Pedidos vinculados à sua identidade, com estado e próxima ação confirmados pelo servidor."
      />
      <DataProvenance
        source="GET /v1/me/purchases"
        scope="somente pedidos em que você é comprador"
        asOf={page.asOf}
        freshness={page.freshness}
      />
      {!page.data.length ? (
        <PageState
          kind="empty"
          title="Nenhuma compra encontrada"
          description="Seus pedidos reais aparecerão aqui depois que forem criados pela API."
          actions={<Link className="button-link" href="/">Explorar o marketplace</Link>}
        />
      ) : (
        <>
          <div className={styles.toolbar} role="search" aria-label="Filtrar compras desta página">
            <div className={styles.field}>
              <label htmlFor="purchase-search">Buscar pedido</label>
              <input
                id="purchase-search"
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); }}
                placeholder="Produto, vendedor ou identificador"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="purchase-status">Estado</label>
              <select id="purchase-status" value={status} onChange={(event) => { setStatus(event.target.value); }}>
                <option value="ALL">Todos nesta página</option>
                {statuses.map((itemStatus) => (
                  <option value={itemStatus} key={itemStatus}>{itemStatus.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <span className={styles.resultCount} aria-live="polite">
              {filtered.length} de {page.data.length} pedidos
            </span>
          </div>
          {!filtered.length ? (
            <PageState
              kind="empty"
              title="Nenhum pedido corresponde aos filtros"
              description="Altere a busca ou o estado. O conjunto original da API não foi modificado."
              actions={<Button variant="outline" onClick={() => { setQuery(""); setStatus("ALL"); }}>Limpar filtros</Button>}
            />
          ) : (
            <Panel className={styles.tablePanel}>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <caption>Compras retornadas pela API</caption>
                  <thead>
                    <tr>
                      <th scope="col">Pedido</th>
                      <th scope="col">Valor</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Criado em</th>
                      <th scope="col"><span className="sr-only">Ação</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const status = orderStatusView(item.status);
                      return (
                        <tr key={item.orderId}>
                          <td className={styles.primaryCell}>
                            <strong>{item.publicCode}</strong>
                            <small>{status.explanation}</small>
                          </td>
                          <td className={styles.numeric}><MinorMoney amountMinor={item.totalMinor} currency={item.currency} /></td>
                          <td><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                          <td className={styles.dateCell}><time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time></td>
                          <td className={styles.actionCell}>
                            <Link className="text-link" href={`/conta/compras/${encodeURIComponent(item.orderId)}`}>
                              {status.nextAction ?? "Abrir pedido"}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
          <nav className={styles.pager} aria-label="Paginação de compras">
            <p>Página {cursorHistory.length + 1}. Filtros atuam somente sobre a página carregada.</p>
            <div className={styles.pagerActions}>
              <Button
                size="small"
                variant="outline"
                disabled={cursorHistory.length === 0}
                onClick={() => { setCursorHistory((history) => history.slice(0, -1)); }}
              >
                Anterior
              </Button>
              <Button
                size="small"
                variant="outline"
                disabled={!page.nextCursor}
                onClick={() => {
                  const nextCursor = page.nextCursor;
                  if (typeof nextCursor === "string") {
                    setCursorHistory((history) => [...history, nextCursor]);
                  }
                }}
              >
                Próxima
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
