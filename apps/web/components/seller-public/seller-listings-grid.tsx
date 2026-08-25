"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { PackageSearch, SlidersHorizontal } from "lucide-react";
import { Button, PageState, Reveal, ShineCard } from "@midas/ui";
import { ListingCard } from "@/components/marketplace/listing-card";
import { itemTypeLabel } from "@/components/marketplace/formatters";
import type { PublicListing } from "@/components/marketplace/types";
import { COPY } from "@/lib/copy-deck";
import styles from "./seller-public.module.css";

type AvailabilityFilter = "ALL" | "AVAILABLE" | "OUT_OF_STOCK";

export interface SellerListingsGridProps {
  /** Anúncios já filtrados e higienizados por `sanitizePublicListings`. */
  readonly listings: readonly PublicListing[];
  /** Nome público do vendedor, ou `null` quando não há nome publicável. */
  readonly sellerName: string | null;
  /** Paginação e avisos de cobertura, renderizados dentro da seção. */
  readonly footer: ReactNode;
}

export function SellerListingsGrid({ listings, sellerName, footer }: SellerListingsGridProps) {
  const [itemType, setItemType] = useState("ALL");
  const [availability, setAvailability] = useState<AvailabilityFilter>("ALL");

  const itemTypes = useMemo(() => (
    [...new Set(listings
      .map((listing) => listing.catalogItem?.itemType)
      .filter((value): value is string => typeof value === "string"))]
      .sort((first, second) => itemTypeLabel(first).localeCompare(itemTypeLabel(second), "pt-BR"))
  ), [listings]);

  const filtered = useMemo(() => listings.filter((listing) => {
    const matchesType = itemType === "ALL" || listing.catalogItem?.itemType === itemType;
    const matchesAvailability = availability === "ALL"
      || (availability === "AVAILABLE" && listing.quantityAvailable > 0)
      || (availability === "OUT_OF_STOCK" && listing.quantityAvailable === 0);
    return matchesType && matchesAvailability;
  }), [availability, itemType, listings]);

  function clearFilters() {
    setItemType("ALL");
    setAvailability("ALL");
  }

  const ofSeller = sellerName === null ? "deste vendedor" : `de ${sellerName}`;

  if (listings.length === 0) {
    const copy = COPY.sellerPublic.noListings;
    return (
      <Reveal as="section" className={styles.listings} aria-labelledby="seller-listings-title">
        <header className={styles.sectionHead}>
          <span className={styles.eyebrow}>{copy.kicker}</span>
          <h2 id="seller-listings-title">Anúncios publicados</h2>
        </header>
        <PageState
          kind="empty"
          title={copy.headline}
          description={`${copy.subhead} ${copy.body}`}
          actions={<Link className="button-link" href="/market">{copy.cta}</Link>}
        />
        {footer}
      </Reveal>
    );
  }

  return (
    <Reveal as="section" className={styles.listings} aria-labelledby="seller-listings-title">
      <header className={styles.sectionHead}>
        <span className={styles.eyebrow}>OFERTAS PUBLICADAS</span>
        <h2 id="seller-listings-title">Anúncios publicados</h2>
        <p>Rascunho e anúncio em revisão não aparecem aqui: o perfil público lista apenas o que está no catálogo.</p>
      </header>

      <div className={styles.filters} role="search" aria-label={`Filtrar anúncios ${ofSeller}`}>
        <div className={styles.filterHeading}>
          <SlidersHorizontal aria-hidden="true" size={17} />
          <span>Filtrar as ofertas desta página</span>
        </div>
        <div className={styles.filterGrid}>
          <div className={styles.field}>
            <label htmlFor="seller-item-type">Tipo de item</label>
            <select
              id="seller-item-type"
              value={itemType}
              onChange={(event) => { setItemType(event.target.value); }}
            >
              <option value="ALL">Todos os tipos</option>
              {itemTypes.map((value) => <option value={value} key={value}>{itemTypeLabel(value)}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="seller-availability">Disponibilidade</label>
            <select
              id="seller-availability"
              value={availability}
              onChange={(event) => { setAvailability(event.target.value as AvailabilityFilter); }}
            >
              <option value="ALL">Todas as ofertas</option>
              <option value="AVAILABLE">Em estoque</option>
              <option value="OUT_OF_STOCK">Sem estoque</option>
            </select>
          </div>
        </div>
        <p className={styles.filterStatus} aria-live="polite">
          {filtered.length} de {listings.length} {listings.length === 1 ? "anúncio exibido" : "anúncios exibidos"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <PageState
          kind="empty"
          title="Nenhuma oferta corresponde aos filtros"
          description="Altere o tipo de item ou a disponibilidade para voltar a ver as ofertas publicadas deste vendedor."
          actions={<Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>}
        />
      ) : (
        <ul className={styles.cardGrid}>
          {filtered.map((listing) => (
            <li key={listing.listingId}>
              {/*
                M2 sobre card de oferta: brilho especular que segue o ponteiro,
                sem transform. O card carrega preço, e preço não se move —
                por isso aqui é ShineCard, não Tilt3D. A primitiva desliga
                sozinha em prefers-reduced-motion e em ponteiro grosso.
              */}
              <ShineCard className={styles.cardShine}>
                <ListingCard listing={listing} />
              </ShineCard>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > 0 && filtered.length === listings.length ? (
        <p className={styles.gridEnd}>
          <PackageSearch aria-hidden="true" size={16} /> Fim das ofertas publicadas nesta página.
        </p>
      ) : null}

      {footer}
    </Reveal>
  );
}
