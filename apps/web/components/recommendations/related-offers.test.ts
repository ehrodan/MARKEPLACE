import { describe, expect, it } from "vitest";
import type { PublicListing } from "@/components/marketplace/types";
import { MAX_PER_SELLER, relatedOffers } from "./related-offers";

function listing(overrides: Partial<PublicListing> & { listingId: string }): PublicListing {
  return {
    publicSlug: overrides.listingId,
    catalogItemId: "item-generico",
    sellerAccountId: "seller-1",
    listingPlanId: "plan-1",
    listingStatus: "PUBLISHED",
    priceMinor: "10000",
    currency: "BRL",
    quantityAvailable: 1,
    quantitySold: 0,
    version: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const ANCHOR = {
  catalogItemId: "item-ancora",
  gameOrigin: "CS2",
  itemType: "SKIN",
  sellerAccountId: "seller-1",
  priceMinor: "10000",
};

describe("relatedOffers", () => {
  it("nunca recomenda a própria âncora", () => {
    const result = relatedOffers(
      [listing({ listingId: "a", catalogItemId: "item-ancora", catalogItem: { gameOrigin: "CS2" } as never })],
      ANCHOR,
    );
    expect(result).toHaveLength(0);
  });

  it("todo resultado carrega motivo não vazio", () => {
    const result = relatedOffers(
      [
        listing({ listingId: "a", catalogItemId: "x", catalogItem: { gameOrigin: "CS2" } as never }),
        listing({ listingId: "b", catalogItemId: "y", sellerAccountId: "seller-2", catalogItem: { itemType: "SKIN" } as never }),
      ],
      ANCHOR,
    );
    expect(result.length).toBeGreaterThan(0);
    for (const offer of result) {
      expect(offer.reason.trim().length, offer.listing.listingId).toBeGreaterThan(0);
    }
  });

  it("descarta oferta sem estoque ou não publicada", () => {
    const result = relatedOffers(
      [
        listing({ listingId: "sem-estoque", catalogItemId: "x", quantityAvailable: 0, catalogItem: { gameOrigin: "CS2" } as never }),
        listing({ listingId: "pausada", catalogItemId: "y", listingStatus: "PAUSED", catalogItem: { gameOrigin: "CS2" } as never }),
      ],
      ANCHOR,
    );
    expect(result).toHaveLength(0);
  });

  it("aplica teto de 2x o preço da âncora", () => {
    const result = relatedOffers(
      [
        listing({ listingId: "caro", catalogItemId: "x", priceMinor: "20001", catalogItem: { gameOrigin: "CS2" } as never }),
        listing({ listingId: "no-teto", catalogItemId: "y", priceMinor: "20000", sellerAccountId: "seller-2", catalogItem: { gameOrigin: "CS2" } as never }),
      ],
      ANCHOR,
    );
    expect(result.map((offer) => offer.listing.listingId)).toEqual(["no-teto"]);
  });

  it("respeita o teto por vendedor para não virar parede do mesmo", () => {
    const many = Array.from({ length: 6 }, (_unused, index) =>
      listing({
        listingId: `s1-${String(index)}`,
        catalogItemId: `item-${String(index)}`,
        sellerAccountId: "seller-9",
        catalogItem: { gameOrigin: "CS2" } as never,
      }),
    );
    const result = relatedOffers(many, { ...ANCHOR, sellerAccountId: null });
    expect(result).toHaveLength(MAX_PER_SELLER);
  });

  it("prioriza mesma coleção sobre vizinhança de preço", () => {
    const result = relatedOffers(
      [
        listing({ listingId: "vizinho", catalogItemId: "x", sellerAccountId: "seller-5", priceMinor: "9000", catalogItem: { gameOrigin: "OUTRO", itemType: "OUTRO" } as never }),
        listing({ listingId: "colecao", catalogItemId: "y", sellerAccountId: "seller-6", priceMinor: "9500", catalogItem: { gameOrigin: "CS2" } as never }),
      ],
      { ...ANCHOR, sellerAccountId: null },
    );
    expect(result[0]?.listing.listingId).toBe("colecao");
  });

  it("devolve vazio quando nada se relaciona, em vez de preencher com aleatório", () => {
    const result = relatedOffers(
      [listing({ listingId: "nada", catalogItemId: "z", sellerAccountId: "seller-7", priceMinor: "1", catalogItem: { gameOrigin: "OUTRO", itemType: "OUTRO" } as never })],
      { ...ANCHOR, sellerAccountId: null },
    );
    expect(result).toHaveLength(0);
  });

  it("funciona sem âncora de preço", () => {
    const result = relatedOffers(
      [listing({ listingId: "a", catalogItemId: "x", catalogItem: { gameOrigin: "CS2" } as never })],
      { gameOrigin: "CS2", priceMinor: null },
    );
    expect(result).toHaveLength(1);
  });

  it("ignora preço malformado sem quebrar", () => {
    const result = relatedOffers(
      [listing({ listingId: "a", catalogItemId: "x", priceMinor: "10,00", catalogItem: { gameOrigin: "CS2" } as never })],
      ANCHOR,
    );
    expect(result).toHaveLength(1);
  });
});
