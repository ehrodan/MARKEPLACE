"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PackageSearch, Search, SlidersHorizontal, Store } from "lucide-react";
import { Button, PageState, StatusBadge } from "@midas/ui";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api-client";
import { formatPublicDate, itemTypeLabel, listingTitle } from "./formatters";
import { ListingCard } from "./listing-card";
import { MarketplaceError, MarketplaceLoading } from "./marketplace-states";
import type { PublicListing, PublicListingPage } from "./types";
import styles from "./marketplace.module.css";

const PAGE_SIZE = 24;

type AvailabilityFilter = "ALL" | "AVAILABLE" | "OUT_OF_STOCK";
type SortMode = "RECENT" | "PRICE_ASC" | "PRICE_DESC";

function searchableListing(listing: PublicListing): string {
  return [
    listingTitle(listing),
    listing.publicSlug,
    listing.catalogItem?.gameOrigin,
    listing.catalogItem?.itemType,
    listing.catalogItem?.rarity,
    listing.seller?.displayName,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase("pt-BR");
}

function compareMinorAmounts(first: PublicListing, second: PublicListing): number {
  try {
    const firstAmount = BigInt(first.priceMinor);
    const secondAmount = BigInt(second.priceMinor);
    if (firstAmount === secondAmount) return 0;
    return firstAmount < secondAmount ? -1 : 1;
  } catch {
    return first.priceMinor.localeCompare(second.priceMinor, "pt-BR", { numeric: true });
  }
}

function comparePublishedAt(first: PublicListing, second: PublicListing): number {
  const firstTime = first.publishedAt ? Date.parse(first.publishedAt) : 0;
  const secondTime = second.publishedAt ? Date.parse(second.publishedAt) : 0;
  return secondTime - firstTime;
}

function mergeListings(current: PublicListing[], incoming: PublicListing[]): PublicListing[] {
  const byId = new Map(current.map((listing) => [listing.listingId, listing]));
  for (const listing of incoming) byId.set(listing.listingId, listing);
  return [...byId.values()];
}

function CatalogResults({ initialPage }: { initialPage: PublicListingPage }) {
  const [listings, setListings] = useState(initialPage.data);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [asOf, setAsOf] = useState(initialPage.asOf);
  const [query, setQuery] = useState("");
  const [itemType, setItemType] = useState("ALL");
  const [availability, setAvailability] = useState<AvailabilityFilter>("ALL");
  const [sort, setSort] = useState<SortMode>("RECENT");
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationError, setPaginationError] = useState<string | null>(null);

  // Contagem real de ofertas por tipo, derivada dos anuncios carregados.
  // DNA transportado em clean room dos benchmarks de docs/06 e docs/20: o
  // usuario ve onde ha liquidez ANTES de clicar, em vez de escolher uma
  // categoria e descobrir que esta vazia. A contagem e sempre do conjunto
  // real; nenhum numero e estimado.
  const itemTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const listing of listings) {
      const type = listing.catalogItem?.itemType;
      if (typeof type !== "string") continue;
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((first, second) => itemTypeLabel(first.value).localeCompare(itemTypeLabel(second.value), "pt-BR"));
  }, [listings]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const matches = listings.filter((listing) => {
      const matchesQuery = !normalizedQuery || searchableListing(listing).includes(normalizedQuery);
      const matchesType = itemType === "ALL" || listing.catalogItem?.itemType === itemType;
      const matchesAvailability = availability === "ALL"
        || (availability === "AVAILABLE" && listing.quantityAvailable > 0)
        || (availability === "OUT_OF_STOCK" && listing.quantityAvailable === 0);
      return matchesQuery && matchesType && matchesAvailability;
    });

    return [...matches].sort((first, second) => {
      if (sort === "PRICE_ASC") return compareMinorAmounts(first, second);
      if (sort === "PRICE_DESC") return compareMinorAmounts(second, first);
      return comparePublishedAt(first, second);
    });
  }, [availability, itemType, listings, query, sort]);

  function clearFilters() {
    setQuery("");
    setItemType("ALL");
    setAvailability("ALL");
    setSort("RECENT");
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setPaginationError(null);
    try {
      const nextPage = await apiRequest<PublicListingPage>(
        `/v1/listings?limit=${String(PAGE_SIZE)}&cursor=${encodeURIComponent(nextCursor)}`,
      );
      setListings((current) => mergeListings(current, nextPage.data));
      setNextCursor(nextPage.nextCursor);
      if (nextPage.asOf) setAsOf(nextPage.asOf);
    } catch {
      setPaginationError("Não foi possível carregar mais anúncios. Tente novamente.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (listings.length === 0) {
    return (
      <PageState
        kind="empty"
        title="Nenhum anúncio publicado"
        description="Ainda não há ofertas disponíveis. Volte em breve ou publique o primeiro anúncio."
        actions={<Link className="button-link" href="/vender/novo">Criar um anúncio</Link>}
      />
    );
  }

  const capturedAt = formatPublicDate(asOf);

  return (
    <>
      <section className={styles.filters} aria-labelledby="catalog-filter-title">
        <div className={styles.filterHeading}>
          <SlidersHorizontal aria-hidden="true" size={18} />
          <div>
            <h2 id="catalog-filter-title">Filtrar ofertas</h2>
            <p>Encontre rapidamente uma oferta entre os anúncios exibidos.</p>
          </div>
        </div>
        <div className={styles.filterGrid} role="search" aria-label="Filtrar anúncios">
          <div className={`${styles.field} ${styles.searchField}`}>
            <label htmlFor="market-search">Buscar no catálogo</label>
            <div className={styles.inputWithIcon}>
              <Search aria-hidden="true" size={17} />
              <input
                id="market-search"
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); }}
                placeholder="Item, jogo ou vendedor"
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="market-item-type">Tipo de item</label>
            <select id="market-item-type" value={itemType} onChange={(event) => { setItemType(event.target.value); }}>
              <option value="ALL">Todos os tipos ({listings.length})</option>
              {itemTypes.map(({ value, count }) => (
                <option value={value} key={value}>
                  {itemTypeLabel(value)} ({count})
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="market-availability">Disponibilidade</label>
            <select
              id="market-availability"
              value={availability}
              onChange={(event) => { setAvailability(event.target.value as AvailabilityFilter); }}
            >
              <option value="ALL">Todas as ofertas</option>
              <option value="AVAILABLE">Em estoque</option>
              <option value="OUT_OF_STOCK">Sem estoque</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="market-sort">Ordenar</label>
            <select id="market-sort" value={sort} onChange={(event) => { setSort(event.target.value as SortMode); }}>
              <option value="RECENT">Publicados recentemente</option>
              <option value="PRICE_ASC">Menor preço</option>
              <option value="PRICE_DESC">Maior preço</option>
            </select>
          </div>
        </div>
      </section>

      <section className={styles.results} aria-labelledby="catalog-results-title">
        <header className={styles.resultsHeader}>
          <div>
            <span className={styles.sectionEyebrow}>OFERTAS PUBLICADAS</span>
            <h2 id="catalog-results-title">
              {filtered.length} {filtered.length === 1 ? "anúncio" : "anúncios"}
            </h2>
          </div>
          <div className={styles.resultsMeta}>
            <StatusBadge tone="success">Catálogo atualizado</StatusBadge>
            <span aria-live="polite">{filtered.length} de {listings.length} exibidos</span>
            {capturedAt ? <time dateTime={asOf}>Atualizado em {capturedAt}</time> : null}
          </div>
        </header>

        {filtered.length === 0 ? (
          <PageState
            kind="empty"
            title="Nenhuma oferta corresponde aos filtros"
            description="Altere os critérios ou limpe os filtros para ver todas as ofertas."
            actions={<Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>}
          />
        ) : (
          <div className={styles.cardGrid}>
            {filtered.map((listing) => <ListingCard listing={listing} key={listing.listingId} />)}
          </div>
        )}

        <div className={styles.loadMoreArea}>
          {paginationError ? <p className={styles.paginationError} role="alert">{paginationError}</p> : null}
          {nextCursor ? (
            <Button
              variant="outline"
              loading={loadingMore}
              loadingLabel="Carregando ofertas"
              onClick={() => { void loadMore(); }}
            >
              Carregar mais anúncios
            </Button>
          ) : (
            <span><PackageSearch aria-hidden="true" size={17} /> Você chegou ao fim dos anúncios.</span>
          )}
        </div>
      </section>
    </>
  );
}

export function MarketView() {
  const resource = useApiResource<PublicListingPage>(`/v1/listings?limit=${String(PAGE_SIZE)}`);

  return (
    <div className={styles.catalogPage}>
      <section className={styles.catalogHero} aria-labelledby="market-title">
        <div>
          <span className={styles.heroKicker}><Store aria-hidden="true" size={15} /> MARKETPLACE</span>
          <h1 id="market-title">Itens digitais,<br /><em>ofertas reais.</em></h1>
        </div>
        <p>
          Compare preço, disponibilidade, plano e vendedor antes de escolher a oferta ideal.
        </p>
      </section>

      {resource.status === "error" ? (
        <MarketplaceError error={resource.error} retry={resource.retry} scope="catalog" />
      ) : resource.status === "ready" ? (
        <CatalogResults initialPage={resource.data} />
      ) : (
        <MarketplaceLoading />
      )}
    </div>
  );
}
