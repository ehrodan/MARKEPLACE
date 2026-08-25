"use client";

import { useMemo } from "react";
import { formatMinorCurrency, formatQuantity } from "@/components/marketplace/formatters";
import type { PublicListing, PublicListingPage } from "@/components/marketplace/types";
import { useApiResource } from "@/hooks/use-api-resource";
import styles from "./listing-detail.module.css";

/**
 * Âncora de comparação de SCR-PUB-006 para SCR-PUB-005.
 *
 * Usa EXATAMENTE a mesma leitura que o item-base (components/item/item-view.tsx)
 * usa para montar a lista de ofertas: `GET /v1/listings?limit=200` filtrado por
 * `catalogItemId` no cliente. O número mostrado aqui é o mesmo que a pessoa
 * encontra ao clicar em "Voltar ao item-base e comparar ofertas".
 *
 * Honestidade fail-closed (PRD §19): enquanto carrega, ou se a leitura falhar,
 * a âncora simplesmente não aparece — o link de voltar segue funcionando e
 * nenhum número é inventado para preencher o espaço.
 */

/** Mesmo caminho consumido por SCR-PUB-005; mudar lá exige mudar aqui. */
export const ITEM_OFFERS_PATH = "/v1/listings?limit=200";

export interface ItemOffersSummary {
  /** Ofertas da página pública que pertencem ao item, em qualquer moeda. */
  readonly count: number;
  /** Menor preço entre as ofertas NA MESMA MOEDA da oferta aberta; null quando nenhum parseia. */
  readonly minPriceMinor: string | null;
}

export function summarizeItemOffers(
  listings: readonly PublicListing[],
  catalogItemId: string,
  currency: string,
): ItemOffersSummary {
  const own = listings.filter((listing) => listing.catalogItemId === catalogItemId);
  let min: { value: bigint; raw: string } | null = null;
  for (const offer of own) {
    // Comparar preço entre moedas diferentes seria número sem sentido; o
    // "a partir de" só afirma o mínimo na moeda que a página já exibe.
    if (offer.currency !== currency) continue;
    if (!/^\d+$/u.test(offer.priceMinor)) continue;
    const value = BigInt(offer.priceMinor);
    if (!min || value < min.value) min = { value, raw: offer.priceMinor };
  }
  return { count: own.length, minPriceMinor: min?.raw ?? null };
}

export interface ItemOffersAnchorProps {
  catalogItemId: string;
  /** Moeda da oferta aberta; delimita o "a partir de". */
  currency: string;
}

export function ItemOffersAnchor({ catalogItemId, currency }: ItemOffersAnchorProps) {
  const offers = useApiResource<PublicListingPage>(ITEM_OFFERS_PATH);
  const summary = useMemo(
    () => (offers.status === "ready"
      ? summarizeItemOffers(offers.data.data, catalogItemId, currency)
      : null),
    [offers, catalogItemId, currency],
  );

  // Loading e erro são silenciosos por contrato: âncora ausente, nunca errada.
  if (!summary || summary.count === 0) return null;

  return (
    <p className={styles.offerAnchor}>
      <span>
        {summary.count === 1
          ? "1 oferta publicada deste item"
          : `${formatQuantity(summary.count)} ofertas publicadas deste item`}
      </span>
      {summary.minPriceMinor ? (
        <>
          <span aria-hidden="true">·</span>
          <span>a partir de {formatMinorCurrency(summary.minPriceMinor, currency)}</span>
        </>
      ) : null}
    </p>
  );
}
