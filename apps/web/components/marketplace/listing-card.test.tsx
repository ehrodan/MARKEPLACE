import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ListingCard } from "./listing-card";
import type { PublicListing } from "./types";

// Sem `globals: true` no vitest, o auto-cleanup da testing-library não roda —
// cada render acumularia no mesmo document e os cards de um teste vazariam
// para as consultas do seguinte.
afterEach(cleanup);

const listing: PublicListing = {
  listingId: "01900000-0000-7000-8000-000000000001",
  publicSlug: "ochpoch-market-emblem-founder",
  catalogItemId: "01900000-0000-7000-8000-000000000002",
  sellerAccountId: "sac_public_seller",
  listingPlanId: "01900000-0000-7000-8000-000000000003",
  listingStatus: "PUBLISHED",
  priceMinor: "17990",
  currency: "BRL",
  quantityAvailable: 25,
  quantitySold: 0,
  version: 1,
  createdAt: "2026-08-24T10:00:00.000Z",
  updatedAt: "2026-08-24T10:00:00.000Z",
  publishedAt: "2026-08-24T10:00:00.000Z",
  catalogItem: {
    catalogItemId: "01900000-0000-7000-8000-000000000002",
    publicSlug: "ochpoch-market-emblem",
    displayName: "OCHPOCH Market Emblem",
    gameOrigin: "OCHPOCH Market",
    itemType: "OTHER",
  },
  seller: { sellerAccountId: "sac_public_seller", displayName: "OCHPOCH Oficial" },
  listingPlan: {
    listingPlanId: "01900000-0000-7000-8000-000000000003",
    planCode: "BASIC",
    displayName: "Básico",
    exposurePriority: 0,
    benefits: {},
  },
  assets: [{
    catalogAssetId: "01900000-0000-7000-8000-000000000004",
    catalogItemId: "01900000-0000-7000-8000-000000000002",
    assetType: "POSTER_2D",
    storageUri: "/assets/brand/ochpoch-market-front.png",
    storageProvider: "LOCAL",
    fileSizeBytes: "4096",
    mimeType: "image/png",
    isPrimary: true,
    approvalStatus: "APPROVED",
  }],
};

describe("ListingCard", () => {
  it("expõe oferta real com link canônico pelo slug", () => {
    const { container } = render(<ListingCard listing={listing} />);

    expect(screen.getByRole("heading", { name: "OCHPOCH Market Emblem" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OCHPOCH Market Emblem" })).toHaveAttribute("href", "/anuncios/ochpoch-market-emblem-founder");
    // O card agora tem dois links — título e CTA "Comprar" — porque um card
    // inteiramente clicável não diz o que acontece ao clicar. O que este teste
    // trava não é a CONTAGEM, é a garantia que importa: todo link do card leva
    // ao MESMO destino, e apenas um deles entra na ordem de tabulação, para a
    // grade não triplicar o número de paradas do teclado.
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/anuncios/ochpoch-market-emblem-founder");
    }
    expect(links.filter((link) => link.getAttribute("tabindex") !== "-1")).toHaveLength(1);
    expect(screen.getByText("OCHPOCH Oficial")).toBeInTheDocument();
    expect(screen.getByText(/179,90/u)).toBeInTheDocument();
    expect(container.querySelector("img[alt='OCHPOCH Market Emblem']")).toHaveAttribute("src", "/assets/brand/ochpoch-market-front.png");
  });

  it("não apresenta estoque quando a API retorna zero", () => {
    render(<ListingCard listing={{ ...listing, quantityAvailable: 0 }} />);
    expect(screen.getByText("Sem estoque")).toBeInTheDocument();
  });

  // Escassez HONESTA (RF-279): o aviso "Só N" só existe quando N é o número
  // real do banco e está em 1..5. De 6 em diante a contagem é neutra — o
  // limiar nunca fabrica urgência.
  it("avisa com o número real quando restam poucas unidades", () => {
    render(<ListingCard listing={{ ...listing, quantityAvailable: 2 }} />);
    expect(screen.getByText("Só 2 em estoque")).toBeInTheDocument();
  });

  it("mantém contagem neutra a partir de 6 unidades", () => {
    render(<ListingCard listing={{ ...listing, quantityAvailable: 6 }} />);
    expect(screen.getByText("6 em estoque")).toBeInTheDocument();
    expect(screen.queryByText(/^Só /u)).not.toBeInTheDocument();
  });

  // O favorito é botão (não link): não entra na regra "todo link do card leva
  // ao mesmo destino" nem soma parada de tabulação rumo ao anúncio.
  it("oferece favoritar direto no card", () => {
    render(<ListingCard listing={listing} />);
    expect(screen.getByRole("button", { name: "Favoritar" })).toHaveAttribute("aria-pressed", "false");
  });
});
