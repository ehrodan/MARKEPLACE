"use client";

import Link from "next/link";
import { PageState } from "@midas/ui";
import { ListingCard } from "@/components/marketplace/listing-card";
import { MarketplaceError, MarketplaceLoading } from "@/components/marketplace/marketplace-states";
import { itemTypeLabel } from "@/components/marketplace/formatters";
import type { PublicListingPage } from "@/components/marketplace/types";
import { useApiResource } from "@/hooks/use-api-resource";
import styles from "./landing-catalog.module.css";

/**
 * SCR-PUB-001: inventário real acima da dobra, sem entrada editorial longa.
 * A grade não usa reveal, tilt ou atraso: produto, preço e estoque precisam
 * aparecer assim que o contrato da API estiver pronto.
 */
const PREVIEW_SIZE = 20;

export function LandingCatalog() {
  const resource = useApiResource<PublicListingPage>(`/v1/listings?limit=${String(PREVIEW_SIZE)}`);

  return (
    <section className={styles.section} id="vitrine" aria-labelledby="landing-catalog-title">
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>CATÁLOGO PUBLICADO</span>
          <h2 id="landing-catalog-title">Ofertas publicadas</h2>
          <p>Preço, estoque e vendedor vindos do catálogo.</p>
        </div>
        <Link className={styles.allLink} href="/market">
          Ver inventário completo <span aria-hidden="true">↗</span>
        </Link>
      </header>

      {resource.status === "error" ? (
        <MarketplaceError error={resource.error} retry={resource.retry} scope="listing" />
      ) : resource.status !== "ready" ? (
        <MarketplaceLoading />
      ) : !resource.data.data.length ? (
        <PageState
          kind="empty"
          title="Nenhuma oferta publicada ainda"
          description="Assim que um vendedor publicar um anúncio, ele aparece aqui. Nada é exibido antes de existir."
          actions={<Link className="button-link" href="/vender/novo">Criar o primeiro anúncio</Link>}
        />
      ) : (
        <>
          <nav className={styles.categories} aria-label="Categorias desta vitrine">
            <Link className={styles.categoryChip} href="/market">
              Nesta vitrine ({resource.data.data.length})
            </Link>
            {[...new Set(
              resource.data.data
                .map((listing) => listing.catalogItem?.itemType)
                .filter((type): type is string => typeof type === "string"),
            )].map((type) => {
              const count = resource.data.data.filter(
                (listing) => listing.catalogItem?.itemType === type,
              ).length;

              return (
                <Link
                  className={styles.categoryChip}
                  href={`/buscar?tipo=${encodeURIComponent(type)}`}
                  key={type}
                >
                  {itemTypeLabel(type)} ({count})
                </Link>
              );
            })}
          </nav>

          <div className={styles.grid}>
            {resource.data.data.map((listing) => (
              <ListingCard listing={listing} key={listing.listingId} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
