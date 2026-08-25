import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyRate,
  buildFeeBreakdown,
  parseRate,
  PurchasePanel,
  resolvePurchaseState,
  type DetailListing,
  type PurchaseCapability,
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
afterEach(() => { cleanup(); });

function withListing(patch: Partial<DetailListing>): DetailListing {
  return { ...listing, ...patch };
}

function renderPanel(overrides: Partial<DetailListing> = {}, capability?: PurchaseCapability) {
  const value = withListing(overrides);
  return render(
    <PurchasePanel
      listing={value}
      {...(capability ? { capability } : {})}
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
  const open: PurchaseCapability = {
    status: "OPEN",
    contract: "POST /v1/orders (SCR-BUY-003)",
    checkoutHref: "/checkout?anuncio=oferta-publicada",
  };
  const closed: PurchaseCapability = { status: "CLOSED", contract: "POST /v1/orders (SCR-BUY-003)" };

  it("abre quando a oferta está publicada, com estoque e capability aberta", () => {
    expect(resolvePurchaseState(listing, open)).toEqual({
      kind: "open",
      checkoutHref: "/checkout?anuncio=oferta-publicada",
    });
  });

  it("bloqueia por capability fechada citando o contrato ausente", () => {
    const state = resolvePurchaseState(listing, closed);
    expect(state.kind).toBe("blocked");
    expect(state.kind === "blocked" && state.reason).toContain("POST /v1/orders");
  });

  it("bloqueia por estoque real antes de falar de capability", () => {
    const state = resolvePurchaseState(withListing({ quantityAvailable: 0 }), open);
    expect(state.kind === "blocked" && state.reason).toContain("Não há unidade disponível");
  });

  it("bloqueia oferta pausada pelo vendedor", () => {
    const state = resolvePurchaseState(
      withListing({ pausedAt: "2026-08-24T12:00:00.000Z" }),
      open,
    );
    expect(state.kind === "blocked" && state.reason).toContain("pausada");
  });
});

describe("PurchasePanel", () => {
  it("mantém a ordem de leitura preço → taxa → disponibilidade → vendedor → proteção → ação", () => {
    renderPanel();
    const headings = screen.getAllByRole("heading").map((node) => node.textContent.trim());
    expect(headings).toEqual([
      "Preço desta oferta",
      "Composição da taxa",
      "Disponibilidade",
      "Quem vende",
      "Proteção e prazos",
      "O que você pode fazer agora",
    ]);
  });

  it("mostra a composição de taxa enviada pelo servidor sem somá-la ao comprador", () => {
    renderPanel();
    expect(screen.getByText(/Taxa da venda \(plano do anúncio\)/u)).toBeInTheDocument();
    expect(screen.getByText("7,5%")).toBeInTheDocument();
    expect(screen.getByText("1,99%")).toBeInTheDocument();
    expect(
      screen.getByText(/deduzidas do repasse do vendedor e não são somadas ao seu pagamento/u),
    ).toBeInTheDocument();
  });

  it("declara ausência de taxa em vez de estimar quando a API não envia", () => {
    renderPanel({ listingPlan: null });
    expect(screen.getByText(/Nenhum percentual foi estimado pela interface/u)).toBeInTheDocument();
  });

  it("mantém o botão de compra visível e explica o motivo do bloqueio", () => {
    renderPanel();
    const button = screen.getByRole("button", { name: /Comprar agora/u });
    expect(button).toHaveAttribute("aria-disabled", "true");
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const reason = describedBy ? document.getElementById(describedBy) : null;
    expect(reason?.textContent).toContain("POST /v1/orders");
    expect(reason?.textContent).toContain("não simula pedido");
  });

  it("entrega a ação primária como link quando a capability está aberta", () => {
    renderPanel({}, {
      status: "OPEN",
      contract: "POST /v1/orders (SCR-BUY-003)",
      checkoutHref: "/checkout?anuncio=oferta-publicada",
    });
    const action = screen.getByRole("link", { name: "Comprar agora" });
    expect(action).toHaveAttribute("href", "/checkout?anuncio=oferta-publicada");
    expect(screen.queryByRole("button", { name: /Comprar agora/u })).not.toBeInTheDocument();
  });

  it("mostra disponibilidade real e não inventa reputação do vendedor", () => {
    renderPanel();
    expect(screen.getByText("2 unidades disponíveis")).toBeInTheDocument();
    expect(screen.getByText(/1 unidade vendida neste anúncio/u)).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma reputação pública foi publicada para este contexto comercial/u),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver perfil público do vendedor/u })).toHaveAttribute(
      "href",
      "/vendedores/sac_vendedor_publico",
    );
  });

  it("agrupa as ações relacionais com um motivo único e verificável", () => {
    renderPanel();
    const group = screen.getByRole("group", { name: "Ações relacionais com o vendedor" });
    for (const label of ["Enviar proposta", "Conversar", "Favoritar"]) {
      expect(within(group).getByRole("button", { name: label })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
    const describedBy = group.getAttribute("aria-describedby");
    const note = describedBy ? document.getElementById(describedBy) : null;
    expect(note?.textContent).toContain("ainda não publicadas pela API");
  });
});
