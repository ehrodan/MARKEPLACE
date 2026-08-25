import type { PublicListing } from "@/components/marketplace/types";

/**
 * Recomendação derivada de FATO PUBLICADO, sem endpoint novo e sem modelo.
 *
 * Regras que definem a qualidade — e que existem para o bloco não virar
 * "parede do mesmo" nem empurrão para cima:
 *
 * 1. Todo item recomendado carrega um MOTIVO. Sem motivo não entra: um bloco
 *    que a pessoa não entende por que existe é ruído que ela aprende a ignorar.
 * 2. A âncora nunca se recomenda.
 * 3. Oferta sem estoque ou não publicada nunca entra.
 * 4. Diversidade: teto por vendedor, senão um vendedor com 40 anúncios ocupa
 *    o bloco inteiro.
 * 5. Faixa de preço: nada acima do dobro da âncora. Empurrar item muito mais
 *    caro do que a pessoa está olhando é upsell agressivo, não relevância.
 *
 * Nenhuma regra aqui cria urgência, escassez ou prova social. Ordenar por
 * afinidade é merchandising; inventar pressão é outra coisa.
 */

export const MAX_PER_SELLER = 2;
export const MAX_RESULTS = 8;
/** Teto de preço relativo à âncora, em centésimos: 200 = 2x. */
export const PRICE_CEILING_RATIO = 200n;

export type RelationKind =
  | "SAME_COLLECTION"
  | "SAME_CATEGORY"
  | "SAME_SELLER"
  | "PRICE_NEIGHBOR";

export interface RelatedOffer {
  readonly listing: PublicListing;
  readonly kind: RelationKind;
  /** Texto exibido ao usuário. A interface é obrigada a mostrar. */
  readonly reason: string;
}

export interface RelatedAnchor {
  readonly catalogItemId?: string | null;
  readonly gameOrigin?: string | null;
  readonly itemType?: string | null;
  readonly sellerAccountId?: string | null;
  readonly priceMinor?: string | null;
}

const REASON: Record<RelationKind, string> = {
  SAME_COLLECTION: "Mesma coleção",
  SAME_CATEGORY: "Mesmo tipo de item",
  SAME_SELLER: "Do mesmo vendedor",
  PRICE_NEIGHBOR: "Faixa de preço parecida",
};

/** Prioridade: relação mais específica ganha. */
const RANK: Record<RelationKind, number> = {
  SAME_COLLECTION: 0,
  SAME_CATEGORY: 1,
  SAME_SELLER: 2,
  PRICE_NEIGHBOR: 3,
};

function toMinor(value: string | null | undefined): bigint | null {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  try {
    return BigInt(value.trim());
  } catch {
    return null;
  }
}

function isPurchasable(listing: PublicListing): boolean {
  return listing.listingStatus === "PUBLISHED" && listing.quantityAvailable > 0;
}

function classify(
  listing: PublicListing,
  anchor: RelatedAnchor,
  anchorPrice: bigint | null,
): RelationKind | null {
  const origin = listing.catalogItem?.gameOrigin;
  const type = listing.catalogItem?.itemType;

  if (anchor.gameOrigin && origin && origin === anchor.gameOrigin) return "SAME_COLLECTION";
  if (anchor.itemType && type && type === anchor.itemType) return "SAME_CATEGORY";
  if (anchor.sellerAccountId && listing.sellerAccountId === anchor.sellerAccountId) {
    return "SAME_SELLER";
  }

  if (anchorPrice !== null && anchorPrice > 0n) {
    const price = toMinor(listing.priceMinor);
    // Vizinhança: metade a uma vez e meia da âncora.
    if (price !== null && price * 2n >= anchorPrice && price * 2n <= anchorPrice * 3n) {
      return "PRICE_NEIGHBOR";
    }
  }

  return null;
}

export function relatedOffers(
  candidates: readonly PublicListing[],
  anchor: RelatedAnchor,
  limit = MAX_RESULTS,
): RelatedOffer[] {
  const anchorPrice = toMinor(anchor.priceMinor);
  const ceiling =
    anchorPrice !== null && anchorPrice > 0n
      ? (anchorPrice * PRICE_CEILING_RATIO) / 100n
      : null;

  const scored: RelatedOffer[] = [];

  for (const listing of candidates) {
    if (anchor.catalogItemId && listing.catalogItemId === anchor.catalogItemId) continue;
    if (!isPurchasable(listing)) continue;

    if (ceiling !== null) {
      const price = toMinor(listing.priceMinor);
      if (price !== null && price > ceiling) continue;
    }

    const kind = classify(listing, anchor, anchorPrice);
    if (!kind) continue;

    scored.push({ listing, kind, reason: REASON[kind] });
  }

  scored.sort((first, second) => {
    const byKind = RANK[first.kind] - RANK[second.kind];
    if (byKind !== 0) return byKind;
    const firstPrice = toMinor(first.listing.priceMinor) ?? 0n;
    const secondPrice = toMinor(second.listing.priceMinor) ?? 0n;
    if (firstPrice === secondPrice) return 0;
    return firstPrice < secondPrice ? -1 : 1;
  });

  const perSeller = new Map<string, number>();
  const result: RelatedOffer[] = [];

  for (const offer of scored) {
    const used = perSeller.get(offer.listing.sellerAccountId) ?? 0;
    if (used >= MAX_PER_SELLER) continue;
    perSeller.set(offer.listing.sellerAccountId, used + 1);
    result.push(offer);
    if (result.length >= limit) break;
  }

  return result;
}
