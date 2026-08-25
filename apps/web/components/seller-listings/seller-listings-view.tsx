"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, RefreshCw, Send } from "lucide-react";
import { Button, Panel, StatusBadge } from "@midas/ui";
import { useAccountContext } from "@/components/account/account-context";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError } from "@/lib/api-client";
import { formatMinorString } from "./price";
import type { ListingStatus, SellerListing, SellerListingsResponse } from "./types";
import styles from "./seller-listings.module.css";

const statusLabels: Record<ListingStatus, string> = {
  DRAFT: "Rascunho",
  REVIEW: "Em revisão",
  PUBLISHED: "Publicado",
  PAUSED: "Pausado",
  SOLD: "Vendido",
  TOMBSTONE: "Encerrado",
};

const itemTypeLabels: Record<string, string> = {
  WEAPON: "Arma",
  SKIN: "Skin",
  STICKER: "Adesivo",
  KEY: "Chave",
  CASE: "Caixa",
  OTHER: "Item",
};

function statusTone(status: ListingStatus): "neutral" | "success" | "warning" | "info" {
  if (status === "PUBLISHED" || status === "SOLD") return "success";
  if (status === "DRAFT" || status === "REVIEW") return "warning";
  if (status === "PAUSED") return "info";
  return "neutral";
}

function requestMessage(error: unknown): string {
  if (isApiError(error)) return error.problem.detail || error.problem.title;
  return "Não foi possível publicar o anúncio. Tente novamente.";
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export function SellerListingsView() {
  const { selectedSeller } = useAccountContext();
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | ListingStatus>("ALL");
  const [publishingId, setPublishingId] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const cursor = cursorHistory.at(-1);
  const endpoint = selectedSeller
    ? `/v1/seller-accounts/${encodeURIComponent(selectedSeller.sellerAccountId)}/listings${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`
    : null;
  const resource = useApiResource<SellerListingsResponse>(endpoint);

  useEffect(() => {
    setCursorHistory([]);
    setQuery("");
    setStatus("ALL");
    setActionError(undefined);
    setNotice(undefined);
  }, [selectedSeller?.sellerAccountId]);

  useEffect(() => {
    if (notice && resource.status === "ready") noticeRef.current?.focus();
  }, [notice, resource.status]);

  const filtered = useMemo(() => {
    if (resource.status !== "ready") return [];
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return resource.data.data.filter((listing) => {
      const matchesStatus = status === "ALL" || listing.listingStatus === status;
      const matchesQuery = !normalized || [
        listing.publicSlug,
        listing.catalogItem?.displayName,
        listing.listingId,
      ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalized));
      return matchesStatus && matchesQuery;
    });
  }, [query, resource, status]);

  if (!selectedSeller) return <ResourceLoading label="Carregando sua loja" />;
  const seller = selectedSeller;
  if (resource.status === "loading" || resource.status === "idle") {
    return <ResourceLoading label="Carregando seus anúncios" />;
  }
  if (resource.status === "error") return <ResourceError error={resource.error} retry={resource.retry} />;
  if (!resource.data) return <ResourceLoading label="Carregando seus anúncios" />;

  async function publish(listing: SellerListing) {
    setPublishingId(listing.listingId);
    setActionError(undefined);
    setNotice(undefined);
    try {
      const updated = await apiRequest<SellerListing>(
        `/v1/listings/${encodeURIComponent(listing.listingId)}/publish`,
        { method: "POST" },
      );
      setNotice(`${updated.catalogItem?.displayName ?? updated.publicSlug} foi publicado.`);
      resource.retry();
    } catch (error) {
      setActionError(requestMessage(error));
    } finally {
      setPublishingId(undefined);
    }
  }

  const response = resource.data;
  const listings = response.data;
  if (!listings.length) {
    return (
      <section className={styles.emptyState}>
        <span className={styles.eyebrow}>ÁREA DO VENDEDOR · MEUS ANÚNCIOS</span>
        <h1>Você ainda não tem anúncios.</h1>
        <p>Crie um rascunho, revise os detalhes e publique quando estiver pronto.</p>
        <Link className={styles.primaryAction} href={`/vender/novo?sellerAccountId=${encodeURIComponent(seller.sellerAccountId)}`}>
          <Plus aria-hidden="true" size={18} /> Criar anúncio
        </Link>
      </section>
    );
  }

  const counts = listings.reduce<Partial<Record<ListingStatus, number>>>((result, listing) => {
    result[listing.listingStatus] = (result[listing.listingStatus] ?? 0) + 1;
    return result;
  }, {});

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>ÁREA DO VENDEDOR · MEUS ANÚNCIOS</span>
          <h1>Acompanhe seus anúncios.</h1>
          <p>Veja o que está publicado e o que ainda precisa de revisão em {seller.displayName}.</p>
        </div>
        <Link className={styles.primaryAction} href={`/vender/novo?sellerAccountId=${encodeURIComponent(seller.sellerAccountId)}`}>
          <Plus aria-hidden="true" size={18} /> Novo anúncio
        </Link>
      </header>

      <section className={styles.metrics} aria-label="Resumo desta página">
        <Panel as="div" className={styles.metricCard}><small>Anúncios</small><strong>{listings.length}</strong><span>nesta página</span></Panel>
        <Panel as="div" className={styles.metricCard}><small>Publicados</small><strong>{counts.PUBLISHED ?? 0}</strong><span>visíveis na vitrine</span></Panel>
        <Panel as="div" className={styles.metricCard}><small>Aguardando publicação</small><strong>{(counts.DRAFT ?? 0) + (counts.REVIEW ?? 0)}</strong><span>para revisar</span></Panel>
      </section>

      <section className={styles.listSection} aria-labelledby="seller-listings-title">
        <div className={styles.listHeading}>
          <div>
            <h2 id="seller-listings-title">Todos os anúncios</h2>
            <p>Última atualização: {formatUpdatedAt(response.asOf)}</p>
          </div>
          <Button variant="ghost" size="small" iconBefore={<RefreshCw aria-hidden="true" size={16} />} onClick={resource.retry}>Atualizar</Button>
        </div>

        <div className={styles.filters} role="search" aria-label="Filtrar anúncios carregados">
          <div className={styles.field}>
            <label htmlFor="listing-search">Buscar nesta página</label>
            <input id="listing-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); }} placeholder="Nome ou endereço do anúncio" />
          </div>
          <div className={styles.field}>
            <label htmlFor="listing-status">Situação</label>
            <select id="listing-status" value={status} onChange={(event) => { setStatus(event.target.value as "ALL" | ListingStatus); }}>
              <option value="ALL">Todos</option>
              {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </div>
          <span className={styles.resultCount} aria-live="polite">{filtered.length} de {listings.length} anúncios</span>
        </div>

        {actionError ? <p className={styles.errorBanner} role="alert">{actionError}</p> : null}
        {notice ? <p ref={noticeRef} className={styles.successBanner} role="status" tabIndex={-1}>{notice}</p> : null}

        {!filtered.length ? (
          <div className={styles.filteredEmpty}>
            <p>Nenhum anúncio corresponde aos filtros desta página.</p>
            <Button variant="outline" size="small" onClick={() => { setQuery(""); setStatus("ALL"); }}>Limpar filtros</Button>
          </div>
        ) : (
          <ul className={styles.listingsList}>
            {filtered.map((listing) => {
              const publishable = listing.listingStatus === "DRAFT" || listing.listingStatus === "REVIEW";
              return (
                <li key={listing.listingId}>
                  <Panel className={styles.listingCard}>
                    <div className={styles.listingLead}>
                      <span className={styles.itemKind}>{itemTypeLabels[listing.catalogItem?.itemType ?? "OTHER"] ?? "Item"}</span>
                      <h3>{listing.catalogItem?.displayName ?? listing.publicSlug}</h3>
                      <span className={styles.listingAddress}>/{listing.publicSlug}</span>
                    </div>
                    <div className={styles.listingFacts}>
                      <div><small>Preço</small><strong>{formatMinorString(listing.priceMinor, listing.currency)}</strong></div>
                      <div><small>Disponível</small><strong>{listing.quantityAvailable - listing.quantitySold}</strong></div>
                      <div><small>Situação</small><StatusBadge tone={statusTone(listing.listingStatus)}>{statusLabels[listing.listingStatus]}</StatusBadge></div>
                    </div>
                    <div className={styles.cardActions}>
                      {publishable ? (
                        <Button
                          size="small"
                          loading={publishingId === listing.listingId}
                          loadingLabel="Publicando"
                          iconBefore={<Send aria-hidden="true" size={15} />}
                          onClick={() => { void publish(listing); }}
                        >
                          Publicar
                        </Button>
                      ) : null}
                      {listing.listingStatus === "PUBLISHED" ? (
                        <Link className={styles.textAction} href={`/anuncios/${encodeURIComponent(listing.publicSlug)}`}>
                          Abrir <ExternalLink aria-hidden="true" size={14} />
                        </Link>
                      ) : null}
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}

        <nav className={styles.pager} aria-label="Paginação de anúncios">
          <p>Página {cursorHistory.length + 1}</p>
          <div>
            <Button variant="outline" size="small" disabled={!cursorHistory.length} onClick={() => { setCursorHistory((history) => history.slice(0, -1)); }}>Anterior</Button>
            <Button variant="outline" size="small" disabled={!response.nextCursor} onClick={() => { const next = response.nextCursor; if (next) setCursorHistory((history) => [...history, next]); }}>Próxima</Button>
          </div>
        </nav>
      </section>
    </div>
  );
}
