"use client";

import { ListingCard } from "@/components/marketplace/listing-card";
import type { PublicListing } from "@/components/marketplace/types";
import { relatedOffers, type RelatedAnchor } from "./related-offers";
import styles from "./recommendations.module.css";

/**
 * Bloco de ofertas relacionadas, reutilizável por slot.
 *
 * Duas regras estruturais, não estéticas:
 *
 * 1. DENYLIST. Nenhum slot pode aparecer em superfície de decisão financeira
 *    ou de conflito — checkout, entrega, disputa, carteira, saque, reembolso,
 *    telas de staff. Ali a pessoa está decidindo dinheiro ou resolvendo
 *    problema e merece silêncio. A lista está em dado, não em convenção.
 * 2. Sem candidato relacionado, o bloco NÃO RENDERIZA. Nunca se preenche com
 *    item aleatório para "não ficar vazio" — bloco irrelevante ensina a
 *    pessoa a ignorar o bloco.
 */

export const RECOMMENDATION_SLOTS = {
  ANCHOR_ITEM: "Combina com este item",
  POST_PURCHASE: "Continue a coleção",
  SELLER_MORE: "Mais deste vendedor",
} as const;

export type RecommendationSlot = keyof typeof RECOMMENDATION_SLOTS;

/** Superfícies onde recomendação é proibida. */
export const RECOMMENDATION_DENIED_PREFIXES = [
  "/checkout",
  "/pedidos",
  "/conta/carteira",
  "/conta/saques",
  "/conta/reembolsos",
  "/admin",
  "/master",
] as const;

export function isRecommendationAllowed(pathname: string): boolean {
  return !RECOMMENDATION_DENIED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function RecommendationRail({
  slot,
  candidates,
  anchor,
  limit,
}: {
  slot: RecommendationSlot;
  candidates: readonly PublicListing[];
  anchor: RelatedAnchor;
  limit?: number;
}) {
  const offers = relatedOffers(candidates, anchor, limit);
  if (!offers.length) return null;

  const headingId = `recommendation-${slot.toLowerCase()}`;

  return (
    <section className={styles.rail} aria-labelledby={headingId}>
      <header className={styles.header}>
        <div>
          <span className="ed-kicker">SELECIONADO PELO QUE VOCÊ ESTÁ VENDO</span>
          <h2 className="ed-title" id={headingId}>{RECOMMENDATION_SLOTS[slot]}</h2>
        </div>
        <p className={styles.note}>
          Cada item mostra por que apareceu. Nada aqui é patrocinado.
        </p>
      </header>

      <ul className="ed-rail" role="list">
        {offers.map((offer) => (
          <li className={styles.item} key={offer.listing.listingId}>
            {/* O motivo é requisito, não enfeite: sem ele o card não existiria. */}
            <p className={styles.reason}>{offer.reason}</p>
            <ListingCard listing={offer.listing} />
          </li>
        ))}
      </ul>
    </section>
  );
}
