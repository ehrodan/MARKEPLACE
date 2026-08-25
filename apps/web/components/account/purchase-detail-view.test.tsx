import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderDetailResponse } from "@/lib/api-types";
import { PurchaseDetailView } from "./purchase-detail-view";

function orderItem(
  orderItemId: string,
  listingSnapshot: Record<string, unknown>,
): OrderDetailResponse["items"][number] {
  return {
    orderItemId,
    listingId: `listing-${orderItemId}`,
    catalogItemId: `catalog-${orderItemId}`,
    quantity: 1,
    unitPriceMinor: "129900",
    totalMinor: "129900",
    currency: "BRL",
    listingSnapshot,
  };
}

function orderDetail(items: OrderDetailResponse["items"]): OrderDetailResponse {
  return {
    order: {
      orderId: "order-1",
      publicCode: "OCH-0001",
      sellerAccountId: "seller-1",
      status: "COMPLETED",
      subtotalMinor: "129900",
      feeMinor: "12990",
      totalMinor: "142890",
      currency: "BRL",
      reservedUntil: null,
      placedAt: "2026-08-01T12:00:00.000Z",
      paidAt: "2026-08-01T12:05:00.000Z",
      completedAt: "2026-08-02T12:00:00.000Z",
      cancelledAt: null,
      cancelReason: null,
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-02T12:00:00.000Z",
    },
    items,
    timeline: [],
    delivery: null,
    asOf: "2026-08-10T12:00:00.000Z",
  };
}

function stubOrderApi(detail: OrderDetailResponse) {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(
    new Response(JSON.stringify(detail), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  )));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PurchaseDetailView — recompra honesta (RF-262/263)", () => {
  it("com referência pública no snapshot oferece 'Ver oferta atual' para /anuncios/{slug}", async () => {
    stubOrderApi(orderDetail([
      orderItem("a", {
        publicSlug: "ak-47-redline",
        catalogItem: { displayName: "AK-47 Redline" },
      }),
    ]));

    render(<PurchaseDetailView orderId="order-1" />);

    const row = (await screen.findByText("AK-47 Redline")).closest("tr");
    expect(row).not.toBeNull();
    const link = within(row as HTMLElement).getByRole("link", { name: "Ver oferta atual" });
    expect(link).toHaveAttribute("href", "/anuncios/ak-47-redline");
  });

  it("sem referência pública, mas com título real, vira busca por item semelhante", async () => {
    stubOrderApi(orderDetail([
      orderItem("a", { catalogItem: { displayName: "Faca Karambit" } }),
    ]));

    render(<PurchaseDetailView orderId="order-1" />);

    const row = (await screen.findByText("Faca Karambit")).closest("tr");
    expect(row).not.toBeNull();
    const link = within(row as HTMLElement).getByRole("link", { name: "Procurar item semelhante" });
    expect(link).toHaveAttribute("href", `/buscar?q=${encodeURIComponent("Faca Karambit")}`);
  });

  it("snapshot sem slug e sem título não ganha ação inventada", async () => {
    stubOrderApi(orderDetail([orderItem("a", {})]));

    render(<PurchaseDetailView orderId="order-1" />);

    const row = (await screen.findByText("Título não registrado no snapshot")).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Sem referência para recompra")).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByRole("link")).toBeNull();
  });

  it("mostra o displayName congelado como título, não o slug do anúncio", async () => {
    stubOrderApi(orderDetail([
      orderItem("a", {
        publicSlug: "slug-do-anuncio",
        catalogItem: { displayName: "Nome exibível do item" },
      }),
    ]));

    render(<PurchaseDetailView orderId="order-1" />);

    expect(await screen.findByText("Nome exibível do item")).toBeInTheDocument();
    expect(screen.queryByText("slug-do-anuncio")).toBeNull();
  });
});
