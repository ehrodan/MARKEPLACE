import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketView } from "./market-view";
import { MarketplaceShell } from "./marketplace-shell";
import { MarketplaceError } from "./marketplace-states";
import type { PublicListing, PublicListingPage } from "./types";

const ochpochListing: PublicListing = {
  listingId: "01900000-0000-7000-8000-000000000021",
  publicSlug: "ochpoch-market-emblem-founder",
  catalogItemId: "01900000-0000-7000-8000-000000000022",
  sellerAccountId: "sac_ochpoch",
  listingPlanId: "01900000-0000-7000-8000-000000000023",
  listingStatus: "PUBLISHED",
  priceMinor: "17990",
  currency: "BRL",
  quantityAvailable: 25,
  quantitySold: 0,
  version: 2,
  createdAt: "2026-08-24T10:00:00.000Z",
  updatedAt: "2026-08-24T11:00:00.000Z",
  publishedAt: "2026-08-24T11:00:00.000Z",
  catalogItem: {
    catalogItemId: "01900000-0000-7000-8000-000000000022",
    publicSlug: "ochpoch-market-emblem",
    displayName: "OCHPOCH Market Emblem",
    gameOrigin: "OCHPOCH Market",
    itemType: "OTHER",
  },
  seller: { sellerAccountId: "sac_ochpoch", displayName: "OCHPOCH Oficial" },
  listingPlan: {
    listingPlanId: "01900000-0000-7000-8000-000000000023",
    planCode: "BASIC",
    displayName: "Básico",
    exposurePriority: 0,
    benefits: {},
  },
  assets: [{
    catalogAssetId: "01900000-0000-7000-8000-000000000024",
    catalogItemId: "01900000-0000-7000-8000-000000000022",
    assetType: "POSTER_2D",
    storageUri: "/assets/brand/ochpoch-market-front.png",
    storageProvider: "LOCAL",
    fileSizeBytes: "559877",
    mimeType: "image/png",
    isPrimary: true,
  }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("acessibilidade do marketplace", () => {
  it("mantém navegação e região principal com semântica nativa", () => {
    render(<MarketplaceShell><h1>Conteúdo</h1></MarketplaceShell>);

    expect(screen.getByRole("navigation", { name: "Navegação do marketplace" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "conteudo-principal");
    expect(screen.getByRole("link", { name: "Vender" })).not.toHaveAttribute("tabindex", "-1");

    // "Conta" existe DUAS vezes no DOM: na barra de ações do topo e na barra
    // inferior de navegação rápida, que o CSS mostra só no mobile. As duas são
    // navegação real no seu contexto, então nenhuma pode sair do DOM nem virar
    // `aria-hidden`.
    //
    // A busca global por papel encontraria as duas e falharia. O que sustenta a
    // acessibilidade aqui não é haver um link só, é cada um viver dentro de um
    // landmark com nome próprio — é assim que o leitor de tela os separa. Por
    // isso a asserção passou a ser escopada por landmark: ela verifica a
    // estrutura que realmente importa, em vez de contar ocorrências.
    const acoesDaConta = screen.getByRole("navigation", { name: "Ações da conta" });
    expect(within(acoesDaConta).getByRole("link", { name: "Conta" })).not.toHaveAttribute("tabindex", "-1");
  });

  it("oferece nomes acessíveis para busca e filtros e anuncia o total", async () => {
    const response: PublicListingPage = {
      data: [ochpochListing],
      nextCursor: null,
      asOf: "2026-08-24T12:00:00.000Z",
    };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))));

    render(<MarketView />);

    expect(await screen.findByRole("heading", { name: "OCHPOCH Market Emblem" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Filtrar anúncios" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Buscar no catálogo" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tipo de item" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Disponibilidade" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ordenar" })).toBeInTheDocument();
    expect(screen.getByText("1 de 1 exibidos")).toHaveAttribute("aria-live", "polite");
  });

  it("anuncia falhas assíncronas sem depender apenas da mudança visual", () => {
    render(<MarketplaceError error={new Error("offline")} retry={vi.fn()} scope="catalog" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("heading", { name: "Não foi possível carregar os anúncios" })).toBeInTheDocument();
  });
});
