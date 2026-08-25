"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CircleDot } from "lucide-react";
import { Freshness, Money, PageState, Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { StatusLabel } from "@/components/status-label";
import { greetingFor } from "@/components/personalization/nick";
import { useApiResource } from "@/hooks/use-api-resource";
import type { AccountOverview } from "@/lib/api-types";
import { formatDateTime } from "@/lib/date-format";
import { safeInternalHref } from "@/lib/internal-href";

export function OverviewView() {
  const resource = useApiResource<AccountOverview>("/v1/me/overview");
  if (resource.status !== "ready") {
    if (resource.status === "error") return <><PageHeader eyebrow="MINHA CONTA" title="Visão geral" description="Situação, alertas e próximas ações da sua conta." /><ResourceError error={resource.error} retry={resource.retry} /></>;
    return <ResourceLoading label="Carregando visão geral" />;
  }
  const overview = resource.data;
  return (
    <>
      <PageHeader eyebrow="MINHA CONTA" title={greetingFor(overview.displayName).headline} description="O que exige atenção agora, com origem e atualização visíveis." meta={<Freshness asOf={overview.asOf} state={overview.freshness} />} />
      {overview.freshness === "STALE" ? <div className="capability-banner"><AlertTriangle aria-hidden="true" size={19} /><span>Esta projeção está desatualizada. Consulte o horário acima antes de tomar decisões.</span></div> : null}
      {overview.alerts?.map((alert) => {
        const href = safeInternalHref(alert.href);
        return <Panel className="capability-banner" key={alert.id} role="status"><AlertTriangle aria-hidden="true" size={19} /><div><strong>{alert.title}</strong><br /><span>{alert.description}</span>{href ? <> · <Link className="text-link" href={href}>Abrir</Link></> : null}</div></Panel>;
      })}
      {overview.balanceBuckets?.length ? <section aria-labelledby="overview-balance-title"><div className="section-heading"><div><h2 id="overview-balance-title">Saldo de vendas</h2><p>Valores por estado contábil retornados pelo servidor.</p></div><Link className="text-link" href="/conta/carteira">Ver detalhes <ArrowRight aria-hidden="true" size={16} /></Link></div><div className="metric-grid">{overview.balanceBuckets.map((bucket) => <Panel className="metric-card" as="article" key={bucket.code}><span className="metric-card__label">{bucket.label}</span><Money className="metric-card__value" amountMinor={bucket.amountMinor} currency={bucket.currency} /><StatusLabel status={bucket.code} /></Panel>)}</div></section> : null}
      <section className="section-stack" aria-labelledby="next-actions-title">
        <div className="section-heading"><div><h2 id="next-actions-title">Próximas ações</h2><p>Somente comandos derivados do estado real.</p></div></div>
        {!overview.actionItems?.length ? <PageState kind="empty" title="Nada exige ação agora" description="Quando uma compra, venda, saque ou disputa precisar de você, ela aparecerá aqui." /> : <Panel><ul className="activity-list">{overview.actionItems.map((item) => { const href = safeInternalHref(item.href); return <li key={item.id}><CircleDot aria-hidden="true" size={18} /><div><p><strong>{item.title}</strong></p>{item.description ? <small>{item.description}</small> : null}</div><div>{href ? <Link className="text-link" href={href}>Abrir</Link> : <StatusLabel status={item.status} />}</div></li>; })}</ul></Panel>}
      </section>
      {overview.recentActivity?.length ? <section className="section-stack" aria-labelledby="activity-title"><div className="section-heading"><div><h2 id="activity-title">Atividade recente</h2><p>Eventos permitidos para sua identidade.</p></div></div><Panel><ul className="activity-list">{overview.recentActivity.map((item) => <li key={item.id}><CircleDot aria-hidden="true" size={18} /><div><p>{item.title}</p>{item.description ? <small>{item.description}</small> : null}</div>{item.occurredAt ? <time dateTime={item.occurredAt}>{formatDateTime(item.occurredAt)}</time> : <StatusLabel status={item.status} />}</li>)}</ul></Panel></section> : null}
    </>
  );
}
