import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMinorCurrency } from "@/components/marketplace/formatters";
import type { PublicListing, PublicListingPage } from "@/components/marketplace/types";

const { resourceMock } = vi.hoisted(() => ({ resourceMock: vi.fn() }));

vi.mock("@/hooks/use-api-resource", () => ({
  useApiResource: resourceMock,
}));

import {
  ITEM_OFFERS_PATH,
  ItemOffersAnchor,
  summarizeItemOffers,
} from "./item-offers-anchor";

const ITEM_ID = "01900000-0000-7000-8000-000000000031";

function offer(patch: Partial<PublicListing>): PublicListing {
  return {
    listingId: "01900000-0000-7000-8000-000000000032",
    publicSlug: "oferta",
    catalogItemId: ITEM_ID,
    sellerAccountId: "sac_vendedor",
    listingPlanId: "01900000-0000-7000-8000-000000000033",
    listingStatus: "PUBLISHED",
    priceMinor: "129900",
    currency: "BRL",
    quantityAvailable: 1,
    quantitySold: 0,
    version: 1,
    createdAt: "2026-08-24T10:00:00.000Z",
    updatedAt: "2026-08-24T11:00:00.000Z",
    ...patch,
  };
}

function ready(data: PublicListing[]) {
  const page: PublicListingPage = { data, nextCursor: null };
  return { status: "ready" as const, data: page, retry: vi.fn() };
}

beforeEach(() => { resourceMock.mockReset(); });
afterEach(() => { cleanup(); });

describe("summarizeItemOffers", () => {
  it("conta só as ofertas do item e acha o menor preço em BigInt", () => {
    const summary = summarizeItemOffers(
      [
        offer({ listingId: "a", priceMinor: "200000" }),
        offer({ listingId: "b", priceMinor: "129900" }),
        offer({ listingId: "c", catalogItemId: "outro-item", priceMinor: "1" }),
      ],
      ITEM_ID,
      "BRL",
    );
    expect(summary).toEqual({ count: 2, minPriceMinor: "129900" });
  });

  it("compara acima de Number.MAX_SAFE_INTEGER sem perder exatidão", () => {
    const summary = summarizeItemOffers(
      [
        offer({ listingId: "a", priceMinor: "9007199254740993" }),
        offer({ listingId: "b", priceMinor: "9007199254740992" }),
      ],
      ITEM_ID,
      "BRL",
    );
    expect(summary.minPriceMinor).toBe("9007199254740992");
  });

  it("ignora preço fora do formato e moeda diferente no 'a partir de'", () => {
    const summary = summarizeItemOffers(
      [
        offer({ listingId: "a", priceMinor: "R$ 12,00" }),
        offer({ listingId: "b", priceMinor: "500", currency: "USD" }),
      ],
      ITEM_ID,
      "BRL",
    );
    // As duas contam como ofertas do item, mas nenhuma sustenta um mínimo em BRL.
    expect(summary).toEqual({ count: 2, minPriceMinor: null });
  });
});

describe("ItemOffersAnchor", () => {
  it("usa o mesmo endpoint que o item-base (SCR-PUB-005)", () => {
    resourceMock.mockReturnValue(ready([]));
    render(<ItemOffersAnchor catalogItemId={ITEM_ID} currency="BRL" />);
    expect(resourceMock).toHaveBeenCalledWith(ITEM_OFFERS_PATH);
    expect(ITEM_OFFERS_PATH).toBe("/v1/listings?limit=200");
  });

  it("mostra contagem e menor preço reais da resposta", () => {
    resourceMock.mockReturnValue(ready([
      offer({ listingId: "a", priceMinor: "200000" }),
      offer({ listingId: "b", priceMinor: "129900" }),
    ]));
    render(<ItemOffersAnchor catalogItemId={ITEM_ID} currency="BRL" />);

    expect(screen.getByText("2 ofertas publicadas deste item")).toBeInTheDocument();
    // O normalizador da Testing Library troca o NBSP do Intl por espaço comum.
    const expectedMin = `a partir de ${formatMinorCurrency("129900", "BRL")}`.replace(/ /gu, " ");
    expect(screen.getByText(expectedMin)).toBeInTheDocument();
  });

  it("usa o singular para uma única oferta", () => {
    resourceMock.mockReturnValue(ready([offer({})]));
    render(<ItemOffersAnchor catalogItemId={ITEM_ID} currency="BRL" />);
    expect(screen.getByText("1 oferta publicada deste item")).toBeInTheDocument();
  });

  it("omite o 'a partir de' quando nenhum preço parseia, sem inventar valor", () => {
    resourceMock.mockReturnValue(ready([offer({ priceMinor: "indisponível" })]));
    render(<ItemOffersAnchor catalogItemId={ITEM_ID} currency="BRL" />);
    expect(screen.getByText("1 oferta publicada deste item")).toBeInTheDocument();
    expect(screen.queryByText(/a partir de/u)).not.toBeInTheDocument();
  });

  it("fica em silêncio durante o carregamento", () => {
    resourceMock.mockReturnValue({ status: "loading" as const, retry: vi.fn() });
    const { container } = render(<ItemOffersAnchor catalogItemId={ITEM_ID} currency="BRL" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("falha em silêncio: erro de leitura nunca vira número na tela", () => {
    resourceMock.mockReturnValue({
      status: "error" as const,
      error: new Error("offline"),
      retry: vi.fn(),
    });
    const { container } = render(<ItemOffersAnchor catalogItemId={ITEM_ID} currency="BRL" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("não afirma '0 ofertas' quando a resposta não traz o item", () => {
    resourceMock.mockReturnValue(ready([offer({ catalogItemId: "outro-item" })]));
    const { container } = render(<ItemOffersAnchor catalogItemId={ITEM_ID} currency="BRL" />);
    expect(container).toBeEmptyDOMElement();
  });
});
