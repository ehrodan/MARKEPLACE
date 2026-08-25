import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O hook faz rede de verdade; aqui ele é substituído por um dublê controlado
// por teste. O caminho pedido (ou `null`) é a própria asserção de segurança.
vi.mock("@/hooks/use-api-resource", () => ({ useApiResource: vi.fn() }));

import type { PublicListing } from "@/components/marketplace/types";
import { useApiResource } from "@/hooks/use-api-resource";
import {
  projectPurchasedItems,
  type CheckoutStageCode,
  type OrderDetailEnvelope,
} from "./checkout-state";
import {
  PostPurchaseRail,
  postPurchaseAnchor,
  postPurchaseCandidates,
} from "./post-purchase-rail";

const useApiResourceMock = vi.mocked(useApiResource);

afterEach(cleanup);
beforeEach(() => {
  useApiResourceMock.mockReset();
});

function makeListing(overrides: Partial<PublicListing> & { listingId: string }): PublicListing {
  const catalogItemId = overrides.catalogItemId ?? "cat-neighbor";
  return {
    publicSlug: `slug-${overrides.listingId}`,
    catalogItemId,
    sellerAccountId: "seller-2",
    listingPlanId: "plan-1",
    listingStatus: "PUBLISHED",
    priceMinor: "5000",
    currency: "BRL",
    quantityAvailable: 3,
    quantitySold: 0,
    version: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    catalogItem: {
      catalogItemId,
      publicSlug: `item-${overrides.listingId}`,
      displayName: `Item ${overrides.listingId}`,
      gameOrigin: "CS2",
      itemType: "SKIN_RIFLE",
    },
    ...overrides,
  };
}

/** Envelope no formato de serializeOrderDetail (apps/api/src/order-routes.ts). */
const settledEnvelope: OrderDetailEnvelope = {
  data: {
    order: { orderId: "ord-1" },
    items: [
      {
        orderItemId: "oi-1",
        listingId: "lst-bought",
        catalogItemId: "cat-bought",
        quantity: 1,
        unitPriceMinor: "4000",
        totalMinor: "4000",
        currency: "BRL",
        listingSnapshot: {
          listingId: "lst-bought",
          sellerAccountId: "seller-1",
          priceMinor: "4000",
          currency: "BRL",
          catalogItem: {
            catalogItemId: "cat-bought",
            gameOrigin: "CS2",
            itemType: "SKIN_RIFLE",
          },
        },
      },
    ],
  },
  asOf: "2026-08-25T12:00:00.000Z",
};

function readyPage(candidates: PublicListing[]) {
  return {
    status: "ready" as const,
    data: { data: candidates, nextCursor: null },
    retry: vi.fn(),
  };
}

const RAIL_HEADING = "Continue a coleção";

describe("PostPurchaseRail — gate de estado", () => {
  const nonSettledStages: CheckoutStageCode[] = [
    "AWAITING_PAYMENT_SESSION",
    "PAYMENT_SESSION_OPEN",
    "CONFIRMING_WITH_PROVIDER",
    "RESERVATION_EXPIRED",
    "RECOVERABLE_FAILURE",
    "CANCELLED",
    "QUARANTINED",
  ];

  it.each(nonSettledStages)(
    "não renderiza nem consulta candidatos no estágio %s",
    (stage) => {
      useApiResourceMock.mockReturnValue(readyPage([makeListing({ listingId: "lst-a" })]));
      render(<PostPurchaseRail stage={stage} orderEnvelope={settledEnvelope} />);
      expect(screen.queryByRole("heading", { name: RAIL_HEADING })).toBeNull();
      // Antes da conclusão o hook recebe `null`: nenhuma leitura é disparada
      // em tela de pagamento ativo.
      expect(useApiResourceMock).toHaveBeenCalledWith(null);
    },
  );

  it("renderiza no estágio SETTLED_BY_WEBHOOK com candidatos reais", () => {
    useApiResourceMock.mockReturnValue(
      readyPage([
        makeListing({ listingId: "lst-a", catalogItemId: "cat-a" }),
        makeListing({
          listingId: "lst-b",
          catalogItemId: "cat-b",
          catalogItem: {
            catalogItemId: "cat-b",
            publicSlug: "item-b",
            displayName: "Item lst-b",
            gameOrigin: "DOTA2",
            itemType: "SKIN_RIFLE",
          },
        }),
      ]),
    );
    render(<PostPurchaseRail stage="SETTLED_BY_WEBHOOK" orderEnvelope={settledEnvelope} />);
    expect(screen.getByRole("heading", { name: RAIL_HEADING })).toBeVisible();
    expect(useApiResourceMock).toHaveBeenCalledWith("/v1/listings?limit=200");
    // Cada candidato carrega o MOTIVO visível — requisito do slot.
    expect(screen.getByText("Mesma coleção")).toBeVisible();
    expect(screen.getByText("Mesmo tipo de item")).toBeVisible();
  });

  it("não renderiza sem candidato relacionado", () => {
    useApiResourceMock.mockReturnValue(readyPage([]));
    render(<PostPurchaseRail stage="SETTLED_BY_WEBHOOK" orderEnvelope={settledEnvelope} />);
    expect(screen.queryByRole("heading", { name: RAIL_HEADING })).toBeNull();
  });

  it("nunca recomenda outra oferta do item recém-comprado", () => {
    useApiResourceMock.mockReturnValue(
      readyPage([
        makeListing({
          listingId: "lst-rebuy",
          catalogItemId: "cat-bought",
          catalogItem: {
            catalogItemId: "cat-bought",
            publicSlug: "item-rebuy",
            displayName: "Recompra do mesmo item",
            gameOrigin: "CS2",
            itemType: "SKIN_RIFLE",
          },
        }),
        makeListing({ listingId: "lst-a", catalogItemId: "cat-a" }),
      ]),
    );
    render(<PostPurchaseRail stage="SETTLED_BY_WEBHOOK" orderEnvelope={settledEnvelope} />);
    expect(screen.getByRole("heading", { name: RAIL_HEADING })).toBeVisible();
    expect(screen.queryByText("Recompra do mesmo item")).toBeNull();
  });

  it.each(["loading", "error"] as const)(
    "leitura de anúncios em %s = silêncio, sem alerta",
    (status) => {
      useApiResourceMock.mockReturnValue(
        status === "error"
          ? { status: "error", error: new Error("falhou"), retry: vi.fn() }
          : { status: "loading", retry: vi.fn() },
      );
      const { container } = render(
        <PostPurchaseRail stage="SETTLED_BY_WEBHOOK" orderEnvelope={settledEnvelope} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("envelope ilegível = silêncio e nenhuma consulta", () => {
    useApiResourceMock.mockReturnValue(readyPage([makeListing({ listingId: "lst-a" })]));
    render(<PostPurchaseRail stage="SETTLED_BY_WEBHOOK" orderEnvelope={null} />);
    expect(screen.queryByRole("heading", { name: RAIL_HEADING })).toBeNull();
    expect(useApiResourceMock).toHaveBeenCalledWith(null);
  });
});

describe("projectPurchasedItems", () => {
  it("projeta os fatos do snapshot gravado na compra", () => {
    expect(projectPurchasedItems(settledEnvelope)).toEqual([
      {
        catalogItemId: "cat-bought",
        listingId: "lst-bought",
        unitPriceMinor: "4000",
        currency: "BRL",
        sellerAccountId: "seller-1",
        gameOrigin: "CS2",
        itemType: "SKIN_RIFLE",
      },
    ]);
  });

  it("descarta item sem catalogItemId em vez de inventar", () => {
    const envelope: OrderDetailEnvelope = {
      data: { items: [{ orderItemId: "oi-x", unitPriceMinor: "100" }] },
    };
    expect(projectPurchasedItems(envelope)).toEqual([]);
  });

  it("envelope sem items legíveis vira lista vazia", () => {
    expect(projectPurchasedItems(null)).toEqual([]);
    expect(projectPurchasedItems({ data: { items: "não é lista" } })).toEqual([]);
    expect(projectPurchasedItems({ data: null })).toEqual([]);
  });
});

describe("postPurchaseAnchor e postPurchaseCandidates", () => {
  const purchased = projectPurchasedItems(settledEnvelope);

  it("âncora vem do primeiro item comprado", () => {
    expect(postPurchaseAnchor(purchased)).toEqual({
      catalogItemId: "cat-bought",
      gameOrigin: "CS2",
      itemType: "SKIN_RIFLE",
      sellerAccountId: "seller-1",
      priceMinor: "4000",
    });
    expect(postPurchaseAnchor([])).toBeNull();
  });

  it("sem moeda conhecida o preço não entra na âncora", () => {
    const anchor = postPurchaseAnchor([{ ...purchased[0], currency: null }]);
    expect(anchor?.priceMinor).toBeNull();
  });

  it("filtra recompra e moeda divergente dos candidatos", () => {
    const kept = makeListing({ listingId: "lst-a", catalogItemId: "cat-a" });
    const rebuy = makeListing({ listingId: "lst-rebuy", catalogItemId: "cat-bought" });
    const foreign = makeListing({ listingId: "lst-usd", catalogItemId: "cat-usd", currency: "USD" });
    expect(postPurchaseCandidates([kept, rebuy, foreign], purchased)).toEqual([kept]);
  });
});
