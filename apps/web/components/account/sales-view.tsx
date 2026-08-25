"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, Money, PageState, Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { StatusLabel } from "@/components/status-label";
import { useAccountContext } from "@/components/account/account-context";
import { SellerScopeGate } from "@/components/account/seller-scope-gate";
import { useApiResource } from "@/hooks/use-api-resource";
import type { SalesReadModel } from "@/lib/api-types";
import { formatDateTime } from "@/lib/date-format";
import { safeInternalHref } from "@/lib/internal-href";
import { DataProvenance } from "./data-provenance";
import styles from "./account-dashboard.module.css";

function ScopedSales() {
  const { selectedSeller } = useAccountContext();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const cursor = cursorHistory.at(-1);
  const basePath = selectedSeller
    ? `/v1/seller-accounts/${encodeURIComponent(selectedSeller.sellerAccountId)}/sales`
    : null;
  const path = basePath ? `${basePath}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}` : null;
  const resource = useApiResource<SalesReadModel>(path);

  if (resource.status !== "ready") {
    return resource.status === "error"
      ? <ResourceError error={resource.error} retry={resource.retry} />
      : <ResourceLoading label="Carregando vendas" />;
  }

  const page = resource.data;
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const statuses = [...new Set(page.data.map((item) => item.status))].sort();
  const filtered = page.data.filter((item) => {
    const matchesStatus = status === "ALL" || item.status === status;
    const matchesQuery = !normalizedQuery || [item.itemTitle, item.orderId]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
    return matchesStatus && matchesQuery;
  });

  return (
    <div className={styles.pageStack}>
      <DataProvenance
        source="GET /v1/seller-accounts/{sellerAccountId}/sales"
        scope={selectedSeller?.displayName ?? "SellerAccount selecionada"}
        asOf={page.asOf}
        freshness={page.freshness}
      />
      {page.freshness === "STALE" ? (
        <div className={styles.notice} role="status">
          <AlertTriangle aria-hidden="true" size={19} />
          <p>Esta projeção está desatualizada. Use o horário de corte acima antes de agir.</p>
        </div>
      ) : null}
      {page.metrics?.length ? (
        <section className={styles.metricGrid} aria-label="Métricas de vendas">
          {page.metrics.map((metric) => (
            <Panel className={styles.metricCard} as="article" key={metric.code}>
              <span className={styles.metricLabel}>{metric.label}</span>
              <strong className={styles.metricValue}>{metric.value.toLocaleString("pt-BR")} {metric.unit}</strong>
              <span className={styles.metricMeta}>Calculado pela projeção do servidor</span>
            </Panel>
          ))}
        </section>
      ) : null}
      <section className={styles.section} aria-labelledby="sales-orders-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="sales-orders-title">Pedidos vendidos</h2>
            <p>Bruto, líquido e estado permanecem vinculados ao pedido canônico.</p>
          </div>
        </div>
        {!page.data.length ? (
          <PageState kind="empty" title="Nenhuma venda encontrada" description="Somente pedidos reais desta SellerAccount aparecem aqui." />
        ) : (
          <>
            <div className={styles.toolbar} role="search" aria-label="Filtrar vendas desta página">
              <div className={styles.field}>
                <label htmlFor="sales-search">Buscar venda</label>
                <input
                  id="sales-search"
                  type="search"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); }}
                  placeholder="Produto ou identificador do pedido"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="sales-status">Estado</label>
                <select id="sales-status" value={status} onChange={(event) => { setStatus(event.target.value); }}>
                  <option value="ALL">Todos nesta página</option>
                  {statuses.map((itemStatus) => (
                    <option value={itemStatus} key={itemStatus}>{itemStatus.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </div>
              <span className={styles.resultCount} aria-live="polite">{filtered.length} de {page.data.length} vendas</span>
            </div>
            {!filtered.length ? (
              <PageState
                kind="empty"
                title="Nenhuma venda corresponde aos filtros"
                description="Altere a busca ou o estado para revisar esta página."
                actions={<Button variant="outline" onClick={() => { setQuery(""); setStatus("ALL"); }}>Limpar filtros</Button>}
              />
            ) : (
              <Panel className={styles.tablePanel}>
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <caption>Vendas da SellerAccount selecionada</caption>
                    <thead><tr><th scope="col">Pedido</th><th scope="col">Valor bruto</th><th scope="col">Estado</th><th scope="col">Criado em</th><th scope="col"><span className="sr-only">Ação</span></th></tr></thead>
                    <tbody>
                      {filtered.map((item) => {
                        const nextHref = safeInternalHref(item.nextActionHref);
                        return (
                          <tr key={item.orderId}>
                            <td className={styles.primaryCell}><strong>{item.itemTitle}</strong><small>{item.orderId}</small></td>
                            <td className={styles.numeric}>
                              <Money amountMinor={item.amountMinor} currency={item.currency} />
                              {item.netAmountMinor !== undefined ? <small className={styles.secondaryText}>Líquido: <Money amountMinor={item.netAmountMinor} currency={item.currency} /></small> : null}
                            </td>
                            <td><StatusLabel status={item.status} /></td>
                            <td className={styles.dateCell}><time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time></td>
                            <td className={styles.actionCell}>{nextHref ? <Link className="text-link" href={nextHref}>Abrir venda</Link> : <span className={styles.secondaryText}>Sem ação</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
            <nav className={styles.pager} aria-label="Paginação de vendas">
              <p>Página {cursorHistory.length + 1}. Escopo: {selectedSeller?.displayName}.</p>
              <div className={styles.pagerActions}>
                <Button size="small" variant="outline" disabled={!cursorHistory.length} onClick={() => { setCursorHistory((history) => history.slice(0, -1)); }}>Anterior</Button>
                <Button
                  size="small"
                  variant="outline"
                  disabled={!page.nextCursor}
                  onClick={() => {
                    const nextCursor = page.nextCursor;
                    if (typeof nextCursor === "string") setCursorHistory((history) => [...history, nextCursor]);
                  }}
                >
                  Próxima
                </Button>
              </div>
            </nav>
          </>
        )}
      </section>
    </div>
  );
}

export function SalesView() {
  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="VENDEDOR · OPERAÇÃO"
        title="Vendas"
        description="Pedidos e métricas do contexto selecionado, sem misturar SellerAccounts."
      />
      <SellerScopeGate><ScopedSales /></SellerScopeGate>
    </div>
  );
}
