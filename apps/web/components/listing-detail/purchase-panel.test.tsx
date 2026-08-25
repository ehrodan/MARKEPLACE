import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_STORAGE_KEY, MAX_CART_LINES, readCart } from "@/components/cart/cart-storage";
import { isFavoriteOnDevice } from "@/components/favorites/favorites-storage";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import {
  applyRate,
  buildFeeBreakdown,
  parseRate,
  persistListingInCart,
  PurchasePanel,
  resolvePurchaseState,
  showsRestockWatchHint,
  type DetailListing,
} from "./purchase-panel";
import { SellerSummary } from "./seller-summary";

const listing: DetailListing = {
  listingId: "01900000-0000-7000-8000-000000000011",
  publicSlug: "oferta-publicada",
  catalogItemId: "01900000-0000-7000-8000-000000000012",
  sellerAccountId: "sac_vendedor_publico",
  listingPlanId: "01900000-0000-7000-8000-000000000013",
  listingStatus: "PUBLISHED",
  priceMinor: "1234567",
  currency: "BRL",
  quantityAvailable: 2,
  quantitySold: 1,
  conditionNotes: null,
  publishedAt: "2026-08-24T11:00:00.000Z",
  pausedAt: null,
  version: 3,
  createdAt: "2026-08-24T10:00:00.000Z",
  updatedAt: "2026-08-24T11:00:00.000Z",
  seller: { sellerAccountId: "sac_vendedor_publico", displayName: "Contexto comercial verificado" },
  listingPlan: {
    listingPlanId: "01900000-0000-7000-8000-000000000013",
    planCode: "BASIC",
    displayName: "Básico",
    exposurePriority: 0,
    benefits: {},
    platformFeeRate: "0.0750",
    pspFeeRate: "0.0199",
  },
  assets: [],
};

// `vitest.config.ts` não usa `globals`, então o cleanup automático da Testing
// Library não é registrado: sem isto, cada render vazaria para o teste seguinte.
beforeEach(() => {
  pushMock.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function withListing(patch: Partial<DetailListing>): DetailListing {
  return { ...listing, ...patch };
}

function renderPanel(overrides: Partial<DetailListing> = {}) {
  const value = withListing(overrides);
  return render(
    <PurchasePanel
      listing={value}
      sellerSlot={<SellerSummary listing={value} />}
    />,
  );
}

describe("aritmética de taxa", () => {
  it("aplica a taxa em BigInt com arredondamento half-up", () => {
    const rate = parseRate("0.0750");
    expect(rate).not.toBeNull();
    if (!rate) return;
    // 1234567 * 0,075 = 92592,525 -> 92593
    expect(applyRate(1234567n, rate).toString()).toBe("92593");
  });

  it("mantém exatidão acima de Number.MAX_SAFE_INTEGER", () => {
    const rate = parseRate("0.1");
    expect(rate).not.toBeNull();
    if (!rate) return;
    expect(applyRate(9007199254740993n, rate).toString()).toBe("900719925474099");
  });

  it("recusa taxa que não seja decimal simples", () => {
    expect(parseRate("abc")).toBeNull();
    expect(parseRate(null)).toBeNull();
    expect(parseRate(undefined)).toBeNull();
  });

  it("só compõe taxa quando o servidor envia as alíquotas", () => {
    expect(buildFeeBreakdown(listing)?.lines).toHaveLength(2);
    expect(
      buildFeeBreakdown(
        withListing({
          listingPlan: {
            listingPlanId: listing.listingPlanId,
            planCode: "BASIC",
            displayName: "Básico",
            exposurePriority: 0,
            benefits: {},
          },
        }),
      ),
    ).toBeNull();
    expect(buildFeeBreakdown(withListing({ listingPlan: null }))).toBeNull();
  });

  it("não soma taxa ao total do comprador", () => {
    const fees = buildFeeBreakdown(listing);
    expect(fees?.buyerTotalMinor).toBe(listing.priceMinor);
  });
});

describe("estado de compra", () => {
  it("abre quando a oferta está publicada e tem estoque", () => {
    expect(resolvePurchaseState(listing)).toEqual({ kind: "open" });
  });

  it("bloqueia por estoque real", () => {
    const state = resolvePurchaseState(withListing({ quantityAvailable: 0 }));
    expect(state.kind === "blocked" && state.reason).toContain("Não há unidade disponível");
  });

  it("bloqueia oferta pausada pelo vendedor", () => {
    const state = resolvePurchaseState(withListing({ pausedAt: "2026-08-24T12:00:00.000Z" }));
    expect(state.kind === "blocked" && state.reason).toContain("pausada");
  });
});

describe("PurchasePanel", () => {
  it("mantém a ordem produto, preço, estoque, CTA, taxas, vendedor e proteção", () => {
    const { container } = renderPanel();
    const headings = [...container.querySelectorAll("h2, h3")].map((node) => node.textContent.trim());
    expect(headings).toEqual([
      "Preço desta oferta",
      "Disponibilidade",
      "Continuar compra",
      "Composição da taxa",
      "Quem vende",
      "Proteção e prazos",
    ]);
  });

  it("mostra a composição de taxa enviada pelo servidor sem somá-la ao comprador", () => {
    renderPanel();
    expect(screen.getByText(/Taxa da venda \(plano do anúncio\)/u)).toBeInTheDocument();
    expect(screen.getByText("7,5%")).toBeInTheDocument();
    expect(screen.getByText("1,99%")).toBeInTheDocument();
    expect(
      screen.getByText(/deduzidas do repasse do vendedor, nunca somadas ao seu pagamento/u),
    ).toBeInTheDocument();
  });

  it("declara ausência de taxa em vez de estimar quando a API não envia", () => {
    renderPanel({ listingPlan: null });
    expect(
      screen.getByText(/nada foi estimado: você paga exatamente o preço publicado/u),
    ).toBeInTheDocument();
  });

  it("mantém o CTA visível, desabilitado e explicado quando não há estoque", () => {
    renderPanel({ quantityAvailable: 0 });
    const button = screen.getByRole("button", { name: /Adicionar ao carrinho/u });
    expect(button).toBeDisabled();
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const reason = describedBy ? document.getElementById(describedBy) : null;
    expect(reason?.textContent).toContain("Não há unidade disponível");
  });

  it("persiste a fotografia da oferta e abre o carrinho real", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));

    expect(pushMock).toHaveBeenCalledOnce();
    expect(pushMock).toHaveBeenCalledWith("/carrinho");
    const stored = readCart(window.localStorage);
    expect(stored.issue).toBeNull();
    expect(stored.lines).toEqual([
      expect.objectContaining({
        listingId: listing.listingId,
        publicSlug: listing.publicSlug,
        sellerAccountId: listing.sellerAccountId,
        sellerDisplayName: listing.seller?.displayName,
        unitPriceMinor: listing.priceMinor,
        currency: listing.currency,
        quantity: 1,
      }),
    ]);
  });

  it("não navega quando o armazenamento local está indisponível", () => {
    expect(
      persistListingInCart(listing, null, "2026-08-25T12:00:00.000Z"),
    ).toEqual(expect.objectContaining({ kind: "blocked" }));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("preserva o carrinho existente quando a nova linha ultrapassa o limite", () => {
    const existing = Array.from({ length: MAX_CART_LINES }, (_, index) => ({
      listingId: `listing-${String(index).padStart(3, "0")}`,
      publicSlug: `item-${String(index).padStart(3, "0")}`,
      title: `Item ${String(index + 1)}`,
      sellerAccountId: "seller-1",
      unitPriceMinor: "1000",
      currency: "BRL",
      quantity: 1,
      addedAt: "2026-08-01T12:00:00.000Z",
    }));
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(existing));

    const result = persistListingInCart(listing, window.localStorage, "2026-08-25T12:00:00.000Z");

    expect(result).toEqual(expect.objectContaining({ kind: "blocked" }));
    const restored = readCart(window.localStorage);
    expect(restored.lines).toHaveLength(MAX_CART_LINES);
    expect(restored.lines.some((line) => line.listingId === listing.listingId)).toBe(false);
  });

  it("mantém taxas recolhidas por padrão e sem urgência inventada", () => {
    renderPanel();
    const summary = screen.getByText("Taxas e total").closest("summary");
    const details = summary?.closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(screen.queryByText(/últimas unidades|oferta por tempo|desconto/u)).not.toBeInTheDocument();
  });

  it("mostra disponibilidade real e não inventa reputação do vendedor", () => {
    renderPanel();
    expect(screen.getByText("Só 2 unidades disponíveis")).toBeInTheDocument();
    expect(screen.getByText(/1 unidade vendida neste anúncio/u)).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma reputação pública foi publicada/u),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver perfil e outros anúncios/u })).toHaveAttribute(
      "href",
      "/vendedores/sac_vendedor_publico",
    );
  });

  it("não usa capability falsa para esconder o contrato real de pedidos", () => {
    renderPanel();
    expect(screen.queryByText(/POST \/v1\/orders.*não está publicado/u)).not.toBeInTheDocument();
    expect(screen.getByText(/revalida preço, estoque e total antes do pedido/u)).toBeInTheDocument();
  });

  it("avisa escassez só com o número real e volta ao tom neutro acima do teto", () => {
    renderPanel({ quantityAvailable: 1 });
    expect(screen.getByText("Só 1 unidade disponível")).toBeInTheDocument();
    cleanup();

    renderPanel({ quantityAvailable: 12 });
    expect(screen.getByText("12 unidades disponíveis")).toBeInTheDocument();
    expect(screen.queryByText(/^Só /u)).not.toBeInTheDocument();
  });

  it("omite a prova de vendas quando nenhuma venda real aconteceu", () => {
    renderPanel({ quantitySold: 0 });
    expect(screen.queryByText(/vendida/u)).not.toBeInTheDocument();
  });

  it("favoritar grava a fotografia pública no dispositivo e alterna o estado", () => {
    renderPanel();
    const button = screen.getByRole("button", { name: "Favoritar" });
    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(isFavoriteOnDevice(window.localStorage, listing.listingId)).toBe(true);
  });

  it("mantém o Favoritar disponível mesmo com a compra bloqueada", () => {
    renderPanel({ quantityAvailable: 0 });
    const button = screen.getByRole("button", { name: "Favoritar" });
    expect(button).toBeEnabled();
  });
});

describe("aviso de reposição (WIRING-favoritos §3)", () => {
  it("decide o hint só por esgotado ou pausado", () => {
    expect(showsRestockWatchHint(listing)).toBe(false);
    expect(showsRestockWatchHint(withListing({ quantityAvailable: 0 }))).toBe(true);
    expect(showsRestockWatchHint(withListing({ pausedAt: "2026-08-24T12:00:00.000Z" }))).toBe(true);
  });

  it("aponta o caminho real do opt-in quando o estoque zera, sem ligar aviso aqui", () => {
    renderPanel({ quantityAvailable: 0 });
    expect(screen.getByText(/ative o aviso de reposição em/u)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Favoritos" })).toHaveAttribute(
      "href",
      "/conta/favoritos",
    );
    // Nenhum toggle de aviso nasce nesta página: o consentimento mora em /conta/favoritos.
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("mostra o mesmo caminho quando a oferta está pausada", () => {
    renderPanel({ pausedAt: "2026-08-24T12:00:00.000Z" });
    expect(screen.getByRole("link", { name: "Favoritos" })).toHaveAttribute(
      "href",
      "/conta/favoritos",
    );
  });

  it("não oferece o hint enquanto a oferta está publicada e com estoque", () => {
    renderPanel();
    expect(screen.queryByText(/aviso de reposição/u)).not.toBeInTheDocument();
  });
});
