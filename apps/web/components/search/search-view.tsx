"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Compass, Filter, PackageSearch, Radar } from "lucide-react";
import { Button, Freshness, PageState, Panel, StatusBadge } from "@midas/ui";
import { formatMinorCurrency, itemTypeLabel } from "@/components/marketplace/formatters";
import { ListingCard } from "@/components/marketplace/listing-card";
import { MarketplaceError, MarketplaceLoading } from "@/components/marketplace/marketplace-states";
import type { PublicListing, PublicListingPage } from "@/components/marketplace/types";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError } from "@/lib/api-client";
import { COPY } from "@/lib/copy-deck";
import { SearchFilters } from "./search-filters";
import {
  CHANNEL_LABELS,
  SORT_LABELS,
  activeFacets,
  applySearch,
  parseSearchQuery,
  rarestTerm,
  relaxations,
  searchHref,
  withoutTerm,
  type FacetFormat,
  type SearchQueryState,
} from "./search-query";
import styles from "./search.module.css";

const PAGE_SIZE = 48;
const LISTINGS_PATH = `/v1/listings?limit=${String(PAGE_SIZE)}`;

/** Contrato que ainda falta para esta tela ter ranking próprio. */
const SEARCH_CONTRACT = "SCR-PUB-004 · GET /v1/search";
/** Contrato do canal de estoque próprio (SCR-PUB-003). */
const MIDAS_CONTRACT = "SCR-PUB-003 · GET /v1/channels/midas/listings";

interface LoadedSheet {
  listings: PublicListing[];
  nextCursor: string | null;
  asOf: string | null;
}

const EMPTY_SHEET: LoadedSheet = { listings: [], nextCursor: null, asOf: null };

function mergeListings(current: PublicListing[], incoming: PublicListing[]): PublicListing[] {
  const byId = new Map(current.map((listing) => [listing.listingId, listing]));
  for (const listing of incoming) byId.set(listing.listingId, listing);
  return [...byId.values()];
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function SearchView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo(() => parseSearchQuery(searchParams), [searchParams]);

  /**
   * Toda mudança entra no histórico: voltar desfaz um critério por vez, que é
   * o caminho de recuperação mais barato para quem se perdeu na consulta.
   */
  const commit = useCallback((next: SearchQueryState) => {
    router.push(searchHref(pathname, next), { scroll: false });
  }, [pathname, router]);

  // O canal Midas não tem endpoint publicado: nada é buscado para não sugerir
  // que a ausência de resultado seja resposta do índice.
  const resource = useApiResource<PublicListingPage>(state.canal === "midas" ? null : LISTINGS_PATH);
  const page = resource.status === "ready" ? resource.data : null;

  const [sheet, setSheet] = useState<LoadedSheet>(EMPTY_SHEET);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationError, setPaginationError] = useState<string | null>(null);

  useEffect(() => {
    if (page === null) {
      setSheet(EMPTY_SHEET);
      return;
    }
    setSheet({ listings: page.data, nextCursor: page.nextCursor, asOf: page.asOf ?? null });
  }, [page]);

  const loadMore = useCallback(async () => {
    const cursor = sheet.nextCursor;
    if (cursor === null) return;
    setLoadingMore(true);
    setPaginationError(null);
    try {
      const nextPage = await apiRequest<PublicListingPage>(
        `/v1/listings?limit=${String(PAGE_SIZE)}&cursor=${encodeURIComponent(cursor)}`,
      );
      setSheet((current) => ({
        listings: mergeListings(current.listings, nextPage.data),
        nextCursor: nextPage.nextCursor,
        asOf: nextPage.asOf ?? current.asOf,
      }));
    } catch {
      setPaginationError("Não foi possível ampliar o conjunto consultado. Tente novamente.");
    } finally {
      setLoadingMore(false);
    }
  }, [sheet.nextCursor]);

  const currencies = useMemo(
    () => [...new Set(sheet.listings.map((listing) => listing.currency))],
    [sheet.listings],
  );
  const currency = currencies.length === 1 ? currencies.at(0) ?? null : null;

  const priceNotice = currency !== null
    ? null
    : currencies.length === 0
      ? "A faixa de preço abre quando os anúncios chegam e a moeda do conjunto é conhecida."
      : "Faixa de preço indisponível: os anúncios carregados usam mais de uma moeda e não são comparáveis por valor.";

  const format = useMemo<FacetFormat>(() => ({
    itemType: itemTypeLabel,
    price: (minorUnits) => (
      currency === null ? `${minorUnits} (unidade mínima)` : formatMinorCurrency(minorUnits, currency)
    ),
  }), [currency]);

  const itemTypes = useMemo(() => (
    [...new Set(sheet.listings
      .map((listing) => listing.catalogItem?.itemType)
      .filter((value): value is string => typeof value === "string"))]
      .sort((first, second) => itemTypeLabel(first).localeCompare(itemTypeLabel(second), "pt-BR"))
  ), [sheet.listings]);

  const facets = useMemo(() => activeFacets(state, format), [state, format]);
  const results = useMemo(() => applySearch(sheet.listings, state), [sheet.listings, state]);
  const exits = useMemo(() => relaxations(sheet.listings, state, format), [sheet.listings, state, format]);
  const rare = useMemo(() => rarestTerm(sheet.listings, state.q), [sheet.listings, state.q]);

  const filters = (
    <SearchFilters
      state={state}
      onChange={commit}
      itemTypes={itemTypes}
      facets={facets}
      currency={currency}
      priceNotice={priceNotice}
      busy={resource.status === "loading"}
    />
  );

  const contractNotice = (
    <Panel as="section" className={styles.contractNotice} aria-labelledby="busca-contrato-titulo">
      <div className={styles.contractIcon}><Radar aria-hidden="true" size={20} /></div>
      <div>
        <span className={styles.eyebrow}>ORIGEM DESTE RESULTADO</span>
        <h2 id="busca-contrato-titulo">O índice dedicado de busca ainda não está publicado.</h2>
        <p>
          Enquanto <code>GET /v1/search</code> não responde, esta tela resolve a consulta sobre{" "}
          <code>GET /v1/listings</code>: filtra e ordena, neste dispositivo, os anúncios publicados
          já carregados. Não há ranking comercial, correção ortográfica do servidor nem sugestão
          vinda de índice — e o resultado nunca é completado com item fora do critério pedido.
        </p>
        <p className={styles.contractReference}>Referência do contrato: {SEARCH_CONTRACT}</p>
      </div>
    </Panel>
  );

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="busca-titulo">
        <div>
          <span className={styles.eyebrow}><Compass aria-hidden="true" size={15} /> {COPY.search.field.kicker}</span>
          <h1 id="busca-titulo">{COPY.search.field.headline}</h1>
        </div>
        <p>{COPY.search.field.subhead}</p>
      </section>

      {filters}
      {contractNotice}

      {state.canal === "midas" ? (
        <PageState
          kind="unavailable"
          title={`Canal “${CHANNEL_LABELS.midas}” ainda não publicado`}
          description="O estoque próprio tem catálogo e contrato separados do P2P. Enquanto a capability não responde, esta tela não mistura os canais nem reaproveita anúncios de terceiros como se fossem do Midas."
          reference={MIDAS_CONTRACT}
          actions={
            <div className={styles.stateActions}>
              <Button onClick={() => { commit({ ...state, canal: "p2p" }); }}>
                Buscar no canal {CHANNEL_LABELS.p2p}
              </Button>
              <Link className="text-link" href="/market">{COPY.search.recovery.cta}</Link>
            </div>
          }
        />
      ) : resource.status === "error" ? (
        isApiError(resource.error) && (resource.error.problem.status === 404 || resource.error.problem.status === 501) ? (
          <PageState
            kind="unavailable"
            title="Capability de catálogo ainda não publicada"
            description="A leitura de anúncios publicados não respondeu neste ambiente. Os critérios continuam no endereço e voltam a valer assim que a fonte canônica estiver disponível."
            reference={resource.error.problem.correlationId ?? SEARCH_CONTRACT}
            actions={<Button onClick={resource.retry}>Tentar novamente</Button>}
          />
        ) : (
          <MarketplaceError error={resource.error} retry={resource.retry} scope="catalog" />
        )
      ) : resource.status === "ready" ? (
        <section className={styles.results} aria-labelledby="busca-resultados-titulo">
          <header className={styles.resultsHeader}>
            <div>
              <span className={styles.eyebrow}>RESULTADO DA CONSULTA</span>
              <h2 id="busca-resultados-titulo">
                {String(results.length)} {plural(results.length, "anúncio", "anúncios")}
              </h2>
            </div>
            <div className={styles.resultsMeta}>
              <StatusBadge tone="info">{CHANNEL_LABELS[state.canal]}</StatusBadge>
              <span>Ordem: {SORT_LABELS[state.ordem]}</span>
              {sheet.asOf === null ? null : <Freshness asOf={sheet.asOf} label="Catálogo lido" />}
            </div>
          </header>

          <p className={styles.count} role="status" aria-live="polite">
            {String(results.length)} {plural(results.length, "anúncio corresponde", "anúncios correspondem")}
            {state.q === "" ? " aos filtros" : ` a “${state.q}”`}
            {", entre "}{String(sheet.listings.length)}{" "}
            {plural(sheet.listings.length, "anúncio carregado", "anúncios carregados")} nesta consulta.
            {state.ordem === "correspondencia" && state.q !== ""
              ? " A ordem por correspondência é calculada nesta tela, não é ranking da plataforma."
              : ""}
          </p>

          {results.length === 0 ? (
            <div className={styles.recovery}>
              <PageState
                kind="empty"
                title={sheet.listings.length === 0 ? COPY.market.empty.headline : COPY.search.noResults.headline}
                description={sheet.listings.length === 0 ? COPY.market.empty.body : COPY.search.noResults.body}
                reference={SEARCH_CONTRACT}
              />

              {sheet.listings.length === 0 ? null : (
                <Panel as="section" className={styles.recoveryPanel} aria-labelledby="busca-recuperacao-titulo">
                  <span className={styles.eyebrow}><Filter aria-hidden="true" size={14} /> {COPY.search.recovery.kicker}</span>
                  <h3 id="busca-recuperacao-titulo">{COPY.search.recovery.headline}</h3>
                  <p>{COPY.search.recovery.body}</p>

                  {exits.length === 0 ? null : (
                    <ul className={styles.exits}>
                      {exits.map((exit) => (
                        <li key={exit.id}>
                          <Button
                            variant="outline"
                            fullWidth
                            onClick={() => { commit(exit.next); }}
                          >
                            Remover {exit.label.toLocaleLowerCase("pt-BR")} “{exit.value}”
                          </Button>
                          <span className={styles.exitCount}>
                            {exit.count === 0
                              ? "Continua sem resultado no conjunto carregado."
                              : `${String(exit.count)} ${plural(exit.count, "anúncio volta", "anúncios voltam")} ao resultado.`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {rare === null ? null : (
                    <div className={styles.rareTerm}>
                      <Button variant="outline" onClick={() => { commit(withoutTerm(state, rare)); }}>
                        Buscar sem “{rare}”
                      </Button>
                      <span className={styles.exitCount}>
                        É o termo com menos correspondências entre os anúncios carregados.
                      </span>
                    </div>
                  )}

                  <div className={styles.recoveryFooter}>
                    {sheet.nextCursor === null ? (
                      <span>
                        Todos os anúncios publicados que a API devolve já estão neste conjunto.
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        loading={loadingMore}
                        loadingLabel="Ampliando conjunto"
                        onClick={() => { void loadMore(); }}
                      >
                        Carregar mais anúncios e repetir a consulta
                      </Button>
                    )}
                    <Link className="text-link" href="/market">{COPY.search.recovery.cta}</Link>
                  </div>
                </Panel>
              )}
            </div>
          ) : (
            <div className={styles.cardGrid}>
              {results.map((listing) => <ListingCard listing={listing} key={listing.listingId} />)}
            </div>
          )}

          <div className={styles.loadMoreArea}>
            {paginationError === null ? null : (
              <p className={styles.paginationError} role="alert">{paginationError}</p>
            )}
            {sheet.nextCursor === null ? (
              <span>
                <PackageSearch aria-hidden="true" size={17} />{" "}
                A consulta cobre todos os anúncios publicados devolvidos pela API.
              </span>
            ) : (
              <Button
                variant="outline"
                loading={loadingMore}
                loadingLabel="Ampliando conjunto"
                onClick={() => { void loadMore(); }}
              >
                Carregar mais anúncios para ampliar a busca
              </Button>
            )}
          </div>
        </section>
      ) : (
        <MarketplaceLoading />
      )}
    </div>
  );
}
