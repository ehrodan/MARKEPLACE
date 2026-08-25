"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageState, Panel, Reveal, StatusBadge } from "@midas/ui";
import { primaryImageAsset, safeAssetUrl } from "@/components/marketplace/formatters";
import { ListingCard } from "@/components/marketplace/listing-card";
import { MarketplaceError, MarketplaceLoading } from "@/components/marketplace/marketplace-states";
import { RecommendationRail } from "@/components/recommendations/recommendation-rail";
import type {
  PublicCatalogAsset,
  PublicCatalogItem,
  PublicListing,
  PublicListingPage,
} from "@/components/marketplace/types";
import { useApiResource } from "@/hooks/use-api-resource";
import styles from "./item.module.css";

/**
 * SCR-PUB-005 — página do ITEM-BASE.
 *
 * Distinção que a tela existe para sustentar: o item-base é o objeto canônico
 * do catálogo; o anúncio é a oferta de UM vendedor sobre esse item. Um item
 * tem N ofertas. Confundir os dois é o erro conceitual que quebra a leitura
 * de preço num marketplace.
 *
 * Motion: perfil M2 (docs/07 §1.4) — entrada de seção permitida. Preço nunca
 * anima.
 */

type OfferSort = "PRICE_ASC" | "PRICE_DESC" | "RECENT";

function compareMinor(first: string, second: string): number {
  try {
    const a = BigInt(first);
    const b = BigInt(second);
    return a === b ? 0 : a < b ? -1 : 1;
  } catch {
    return first.localeCompare(second, "pt-BR", { numeric: true });
  }
}

export function ItemView({ slug }: { slug: string }) {
  const [sort, setSort] = useState<OfferSort>("PRICE_ASC");

  const item = useApiResource<PublicCatalogItem>(
    `/v1/catalog/items/${encodeURIComponent(slug)}`,
  );
  const catalogItemId = item.status === "ready" ? item.data.catalogItemId : null;

  // Sequencial de propósito: a rota de assets é indexada por id, que só
  // existe depois do item resolver.
  const assets = useApiResource<PublicCatalogAsset[]>(
    catalogItemId ? `/v1/catalog/items/${encodeURIComponent(catalogItemId)}/assets` : null,
  );
  const offers = useApiResource<PublicListingPage>(catalogItemId ? "/v1/listings?limit=200" : null);

  const itemOffers = useMemo(() => {
    if (offers.status !== "ready" || !catalogItemId) return [];
    const own = offers.data.data.filter(
      (listing: PublicListing) => listing.catalogItemId === catalogItemId,
    );
    return [...own].sort((first, second) => {
      if (sort === "PRICE_ASC") return compareMinor(first.priceMinor, second.priceMinor);
      if (sort === "PRICE_DESC") return compareMinor(second.priceMinor, first.priceMinor);
      const firstTime = first.publishedAt ? Date.parse(first.publishedAt) : 0;
      const secondTime = second.publishedAt ? Date.parse(second.publishedAt) : 0;
      return secondTime - firstTime;
    });
  }, [offers, catalogItemId, sort]);

  if (item.status !== "ready") {
    return item.status === "error"
      ? <MarketplaceError error={item.error} retry={item.retry} scope="catalog" />
      : <MarketplaceLoading detail />;
  }

  const data = item.data;
  // Só asset aprovado e URL em origem permitida entram na página.
  const approvedAssets = assets.status === "ready"
    ? assets.data.filter((asset) => !asset.approvalStatus || asset.approvalStatus === "APPROVED")
    : [];
  const imageAsset = primaryImageAsset(approvedAssets);
  const primaryImageUrl = imageAsset ? safeAssetUrl(imageAsset.storageUri) : null;

  return (
    <div className={`${styles.page} ed-ground ed-ground--vignette`}>
      <nav className={styles.breadcrumbs} aria-label="Trilha de navegação">
        <Link href="/market">Marketplace</Link>
        <span aria-hidden="true">/</span>
        <span>{data.displayName}</span>
      </nav>

      {/* Grade de leitura em Z: identidade (z1) -> mídia (z2)
          -> especificação (z3) -> ofertas e ação (z4). */}
      <section className="ed-z ed-figure" aria-labelledby="item-title">
        <span className="ed-z__trace" aria-hidden="true" />

        <Reveal className="ed-z1">
          <span className="ed-kicker">ITEM DO CATÁLOGO · {data.gameOrigin}</span>
          <h1 className="ed-mega" id="item-title">{data.displayName}</h1>
          {data.description ? <p className="ed-lede">{data.description}</p> : null}
          <p className="ed-cta-note">
            Esta é a página do item. Cada oferta abaixo pertence a um vendedor
            diferente, com preço e disponibilidade próprios.
          </p>
        </Reveal>

        <Reveal className="ed-z2">
          <div className={`${styles.media} ed-bleed`}>
            {primaryImageUrl ? (
              <img src={primaryImageUrl} alt={data.displayName} loading="lazy" decoding="async" />
            ) : (
              <PageState
                kind="empty"
                title="Sem mídia aprovada"
                description="Nenhum arquivo aprovado foi publicado para este item."
              />
            )}
          </div>
        </Reveal>

        <Reveal className="ed-z3">
          <h2 className="ed-title">Especificação</h2>
          <dl className={styles.specs}>
            <div><dt>Origem</dt><dd>{data.gameOrigin}</dd></div>
            <div><dt>Tipo</dt><dd>{data.itemType}</dd></div>
            <div><dt>Raridade</dt><dd>{data.rarity ?? "não informada"}</dd></div>
            <div><dt>Qualidade</dt><dd>{data.craftQuality ?? "não informada"}</dd></div>
            <div><dt>Identificador</dt><dd><code>{data.publicSlug}</code></dd></div>
          </dl>
        </Reveal>

        <div className="ed-z4">
          <Reveal>
            <Panel className={styles.offerSummary} as="aside">
              <span className="ed-kicker">OFERTAS PARA ESTE ITEM</span>
              {offers.status === "ready" ? (
                <>
                  <strong className={styles.offerCount}>
                    {itemOffers.length === 1 ? "1 oferta publicada" : `${String(itemOffers.length)} ofertas publicadas`}
                  </strong>
                  <p className="ed-cta-note">
                    A ordenação por menor preço não afirma qual é a melhor
                    compra: float, procedência e reputação do vendedor entram
                    na decisão.
                  </p>
                </>
              ) : (
                <p className="ed-cta-note">Carregando ofertas publicadas.</p>
              )}
            </Panel>
          </Reveal>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="item-offers-title">
        <header className={styles.sectionHeader}>
          <div>
            <span className="ed-kicker">COMPARE ANTES DE DECIDIR</span>
            <h2 className="ed-headline" id="item-offers-title">Ofertas deste item</h2>
          </div>
          <label className={styles.sortField}>
            <span>Ordenar por</span>
            <select
              value={sort}
              onChange={(event) => { setSort(event.target.value as OfferSort); }}
            >
              <option value="PRICE_ASC">Menor preço</option>
              <option value="PRICE_DESC">Maior preço</option>
              <option value="RECENT">Publicadas recentemente</option>
            </select>
          </label>
        </header>

        {offers.status === "error" ? (
          <MarketplaceError error={offers.error} retry={offers.retry} scope="listing" />
        ) : offers.status !== "ready" ? (
          <MarketplaceLoading />
        ) : !itemOffers.length ? (
          <PageState
            kind="empty"
            title="Nenhuma oferta publicada agora"
            description="Este item existe no catálogo, mas nenhum vendedor tem oferta publicada neste momento."
            actions={<Link className="button-link" href="/market">Ver o marketplace</Link>}
          />
        ) : (
          <div className={styles.offerGrid}>
            {itemOffers.map((listing) => <ListingCard key={listing.listingId} listing={listing} />)}
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="item-history-title">
        <header className={styles.sectionHeader}>
          <div>
            <span className="ed-kicker">HISTÓRICO</span>
            <h2 className="ed-title" id="item-history-title">Histórico de preço</h2>
          </div>
          <StatusBadge tone="warning">Fonte não publicada</StatusBadge>
        </header>
        {/* Nenhum gráfico é desenhado sem série real. Curva inventada em
            página de item é o pior tipo de dado falso: parece verificável. */}
        <PageState
          kind="unavailable"
          title="Série histórica ainda não publicada"
          description="A leitura de preço por período depende de uma fonte licenciada que ainda não está disponível. Nenhum valor é estimado aqui."
          reference="SCR-PUB-005"
        />
      </section>

      {/* Loop de continuidade: quem chegou até aqui já demonstrou interesse
          real neste tipo de item. Slot permitido nesta rota (M2, pública). */}
      {offers.status === "ready" ? (
        <RecommendationRail
          slot="ANCHOR_ITEM"
          candidates={offers.data.data}
          anchor={{
            catalogItemId: data.catalogItemId,
            gameOrigin: data.gameOrigin,
            itemType: data.itemType,
            priceMinor: itemOffers[0]?.priceMinor ?? null,
          }}
        />
      ) : null}

      <div className="ed-next-door">
        <p className="ed-next-door__label">Continue de onde faz sentido:</p>
        <div className={styles.nextActions}>
          <Link className="text-link" href="/market">Ver todo o marketplace</Link>
          <Link className="text-link" href="/buscar">Buscar outro item</Link>
        </div>
      </div>
    </div>
  );
}
