import { describe, expect, it } from "vitest";
import { repurchaseActionFor, snapshotTitle } from "./repurchase";

/** Espelho do snapshot real gravado por modules/orders/src/order-service.ts. */
function realSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    listingId: "listing-1",
    publicSlug: "ak-47-redline",
    listingStatus: "PUBLISHED",
    sellerAccountId: "seller-1",
    priceMinor: "129900",
    currency: "BRL",
    planCode: "STANDARD",
    platformFeeRate: "0.1",
    commercialTermsSource: "PLAN",
    catalogItem: {
      catalogItemId: "catalog-1",
      publicSlug: "ak-47-redline-catalogo",
      displayName: "AK-47 Redline",
      gameOrigin: "CS2",
      itemType: "SKIN",
      rarity: "RARE",
      craftQuality: "FIELD_TESTED",
    },
    capturedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("snapshotTitle", () => {
  it("prefere o displayName congelado em catalogItem, não o slug do anúncio", () => {
    expect(snapshotTitle(realSnapshot())).toBe("AK-47 Redline");
  });

  it("cai para chaves de título no topo quando catalogItem não existe", () => {
    expect(snapshotTitle({ title: "Título antigo" })).toBe("Título antigo");
    expect(snapshotTitle({ itemTitle: "  Com espaço  " })).toBe("Com espaço");
  });

  it("usa o publicSlug como último recurso e devolve null para snapshot vazio", () => {
    expect(snapshotTitle({ publicSlug: "so-o-slug" })).toBe("so-o-slug");
    expect(snapshotTitle({})).toBeNull();
    expect(snapshotTitle({ displayName: "   " })).toBeNull();
  });
});

describe("repurchaseActionFor", () => {
  it("com referência pública real devolve 'Ver oferta atual' para /anuncios/{slug}", () => {
    const action = repurchaseActionFor(realSnapshot());
    expect(action).toEqual({
      kind: "OFFER",
      href: "/anuncios/ak-47-redline",
      label: "Ver oferta atual",
    });
  });

  it("codifica o slug na URL", () => {
    const action = repurchaseActionFor(realSnapshot({ publicSlug: "faca/rara ç" }));
    expect(action?.href).toBe(`/anuncios/${encodeURIComponent("faca/rara ç")}`);
  });

  it("sem slug mas com título real devolve 'Procurar item semelhante' em /buscar?q=", () => {
    const snapshot = realSnapshot({ publicSlug: undefined });
    const action = repurchaseActionFor(snapshot);
    expect(action).toEqual({
      kind: "SEARCH",
      href: `/buscar?q=${encodeURIComponent("AK-47 Redline")}`,
      label: "Procurar item semelhante",
    });
  });

  it("slug só de espaço conta como ausente", () => {
    const action = repurchaseActionFor(realSnapshot({ publicSlug: "   " }));
    expect(action?.kind).toBe("SEARCH");
  });

  it("sem slug e sem título não inventa ação nenhuma (RF-262/263)", () => {
    expect(repurchaseActionFor({})).toBeNull();
    expect(repurchaseActionFor({ priceMinor: "100", currency: "BRL" })).toBeNull();
  });
});
