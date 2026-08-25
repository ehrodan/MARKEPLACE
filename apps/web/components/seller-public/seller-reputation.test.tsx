import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicListing, PublicListingPage } from "@/components/marketplace/types";
import { SellerProfileView } from "./seller-profile-view";
import {
  SELLER_ACCOUNT_ID_PATTERN,
  SellerReputation,
  containsPersonalData,
  derivePublicSummary,
  resolveSellerIdentity,
  sanitizePublicListings,
  toPublicSellerIdentity,
} from "./seller-reputation";

/**
 * SCR-PUB-007 — o que este arquivo protege:
 * 1. nenhuma PII sai desta tela, nem quando a API a entrega;
 * 2. nenhuma reputação é inventada quando não existe fonte canônica;
 * 3. todo número exibido é contagem do payload, com cobertura declarada.
 */

const SELLER_ID = "sac_01900000-0000-7000-8000-000000000001";
const OTHER_SELLER_ID = "sac_01900000-0000-7000-8000-0000000000ff";

function buildListing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    listingId: "01900000-0000-7000-8000-000000000101",
    publicSlug: "emblema-fundador",
    catalogItemId: "01900000-0000-7000-8000-000000000201",
    sellerAccountId: SELLER_ID,
    listingPlanId: "01900000-0000-7000-8000-000000000301",
    listingStatus: "PUBLISHED",
    priceMinor: "17990",
    currency: "BRL",
    quantityAvailable: 4,
    quantitySold: 2,
    version: 1,
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-21T10:00:00.000Z",
    publishedAt: "2026-08-21T10:00:00.000Z",
    catalogItem: {
      catalogItemId: "01900000-0000-7000-8000-000000000201",
      publicSlug: "emblema-fundador",
      displayName: "Emblema do Fundador",
      gameOrigin: "OCHPOCH Market",
      itemType: "OTHER",
    },
    seller: { sellerAccountId: SELLER_ID, displayName: "Forja do Norte" },
    listingPlan: {
      listingPlanId: "01900000-0000-7000-8000-000000000301",
      planCode: "BASIC",
      displayName: "Básico",
      exposurePriority: 0,
      benefits: {},
    },
    assets: [],
    ...overrides,
  };
}

function stubFetchOnce(page: PublicListingPage): void {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify(page), {
    status: 200,
    headers: { "content-type": "application/json" },
  }))));
}

afterEach(() => {
  // `globals` está desligado no vitest.config.ts deste pacote, então o
  // auto-cleanup do Testing Library não roda: sem isto o DOM de um teste
  // sobrevive no próximo e as consultas por papel encontram duplicatas.
  cleanup();
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------------ */

describe("filtro anti-PII do perfil público", () => {
  it("reconhece e-mail, telefone, documento e identificador interno como dado pessoal", () => {
    expect(containsPersonalData("contato@vendedor.com.br")).toBe(true);
    expect(containsPersonalData("Loja zap 41 99999-8888")).toBe(true);
    expect(containsPersonalData("CPF 123.456.789-09")).toBe(true);
    expect(containsPersonalData("usr_01900000-0000-7000-8000-000000000009")).toBe(true);
    expect(containsPersonalData("01900000-0000-7000-8000-000000000009")).toBe(true);
  });

  it("aceita nome comercial legítimo, inclusive com número curto", () => {
    expect(containsPersonalData("Forja do Norte")).toBe(false);
    expect(containsPersonalData("Arsenal 300")).toBe(false);
  });

  it("retém o nome quando ele carrega dado pessoal, em vez de publicá-lo", () => {
    const withheld = toPublicSellerIdentity(SELLER_ID, { displayName: "Loja do João — joao@exemplo.com" });
    expect(withheld.displayName).toBeNull();
    expect(withheld.displayNameWithheld).toBe(true);

    const clean = toPublicSellerIdentity(SELLER_ID, { displayName: " Forja do Norte " });
    expect(clean).toEqual({
      sellerAccountId: SELLER_ID,
      displayName: "Forja do Norte",
      displayNameWithheld: false,
    });
  });

  it("projeta por allowlist: campo pessoal que a API acrescentar não sobrevive", () => {
    const identity = toPublicSellerIdentity(SELLER_ID, {
      displayName: "Forja do Norte",
      email: "dono@exemplo.com",
      phone: "+55 41 99999-8888",
      document: "123.456.789-09",
      userId: "usr_01900000-0000-7000-8000-000000000009",
      members: [{ name: "João da Silva", role: "OWNER" }],
    });

    expect(Object.keys(identity).sort()).toEqual(["displayName", "displayNameWithheld", "sellerAccountId"]);
    expect(JSON.stringify(identity)).not.toMatch(/exemplo\.com|99999|123\.456|João|usr_/u);
  });

  it("descarta anúncio de outra conta e limpa o vendedor de cada anúncio", () => {
    const sanitized = sanitizePublicListings(
      [
        buildListing(),
        buildListing({
          listingId: "01900000-0000-7000-8000-000000000102",
          sellerAccountId: OTHER_SELLER_ID,
          seller: { sellerAccountId: OTHER_SELLER_ID, displayName: "Outra Loja" },
        }),
        buildListing({
          listingId: "01900000-0000-7000-8000-000000000103",
          seller: { sellerAccountId: SELLER_ID, displayName: "Zap 41 99999-8888" },
        }),
      ],
      SELLER_ID,
    );

    expect(sanitized).toHaveLength(2);
    expect(sanitized.every((listing) => listing.sellerAccountId === SELLER_ID)).toBe(true);
    expect(sanitized[0]?.seller?.displayName).toBe("Forja do Norte");
    expect(sanitized[1]?.seller).toBeNull();
  });

  it("resolve a identidade a partir de um anúncio da própria conta", () => {
    const identity = resolveSellerIdentity(SELLER_ID, [
      buildListing({
        listingId: "01900000-0000-7000-8000-000000000104",
        sellerAccountId: OTHER_SELLER_ID,
        seller: { sellerAccountId: OTHER_SELLER_ID, displayName: "Outra Loja" },
      }),
      buildListing(),
    ]);

    expect(identity.displayName).toBe("Forja do Norte");
  });

  it("mantém o formato do identificador público alinhado ao contrato", () => {
    expect(SELLER_ACCOUNT_ID_PATTERN.test(SELLER_ID)).toBe(true);
    expect(SELLER_ACCOUNT_ID_PATTERN.test("sac_qualquer-coisa")).toBe(false);
    expect(SELLER_ACCOUNT_ID_PATTERN.test("01900000-0000-7000-8000-000000000001")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe("resumo derivado dos anúncios públicos", () => {
  it("conta apenas o que o payload declara, sem completar lacuna", () => {
    const summary = derivePublicSummary([
      buildListing(),
      buildListing({
        listingId: "01900000-0000-7000-8000-000000000105",
        quantityAvailable: 0,
        quantitySold: 5,
        publishedAt: "2026-08-24T10:00:00.000Z",
        catalogItem: {
          catalogItemId: "01900000-0000-7000-8000-000000000202",
          publicSlug: "chave-rara",
          displayName: "Chave Rara",
          gameOrigin: "Outro Jogo",
          itemType: "KEY",
        },
      }),
    ]);

    expect(summary).toEqual({
      publishedListings: 2,
      listingsInStock: 1,
      unitsAvailable: 4,
      unitsSoldInPublishedListings: 7,
      gameOrigins: ["OCHPOCH Market", "Outro Jogo"],
      itemTypes: ["KEY", "OTHER"],
      firstPublishedAt: "2026-08-21T10:00:00.000Z",
      lastPublishedAt: "2026-08-24T10:00:00.000Z",
    });
  });

  it("não inventa janela de publicação quando a data não vem", () => {
    const summary = derivePublicSummary([buildListing({ publishedAt: null })]);
    expect(summary.firstPublishedAt).toBeNull();
    expect(summary.lastPublishedAt).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe("<SellerReputation />", () => {
  const summary = derivePublicSummary([buildListing()]);

  it("declara que a reputação não está publicada em vez de exibir nota", () => {
    const { container } = render(
      <SellerReputation summary={summary} asOf="2026-08-24T12:00:00.000Z" partialCoverage={false} />,
    );

    expect(screen.getByRole("heading", { name: "Reputação ainda não publicada" })).toBeInTheDocument();
    expect(container.textContent).toContain("SCR-PUB-007");
    // Nenhuma nota, média ou estrela é renderizada.
    expect(container.textContent).not.toMatch(/\d[,.]\d\s*(?:\/|de)\s*5|★/u);
    expect(container.textContent).not.toMatch(/tempo de resposta:/iu);
  });

  it("nomeia a seção e cada número exibido com a sua cobertura", () => {
    render(<SellerReputation summary={summary} partialCoverage={false} />);

    expect(screen.getByRole("region", { name: "Reputação com cobertura declarada." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "O que os anúncios publicados permitem afirmar" })).toBeInTheDocument();
    expect(screen.getByText("Anúncios publicados nesta página")).toBeInTheDocument();
    expect(screen.getByText(/não é histórico de vendas do vendedor/u)).toBeInTheDocument();
    expect(screen.getByText(/Não é a data de abertura da conta comercial/u)).toBeInTheDocument();
  });

  it("avisa quando a contagem cobre só parte do catálogo público", () => {
    render(<SellerReputation summary={summary} partialCoverage />);
    expect(screen.getByRole("note")).toHaveTextContent(/cobre apenas os anúncios já carregados/u);
  });

  it("omite o carimbo de leitura quando a API não devolve asOf", () => {
    const { container } = render(<SellerReputation summary={summary} partialCoverage={false} />);
    expect(container.querySelector(".ui-freshness")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */

describe("<SellerProfileView />", () => {
  it("usa o nome público do vendedor como h1 e lista só as ofertas dele", async () => {
    stubFetchOnce({
      data: [
        buildListing(),
        buildListing({
          listingId: "01900000-0000-7000-8000-000000000106",
          publicSlug: "lamina-de-outra-loja",
          sellerAccountId: OTHER_SELLER_ID,
          seller: { sellerAccountId: OTHER_SELLER_ID, displayName: "Outra Loja" },
          catalogItem: {
            catalogItemId: "01900000-0000-7000-8000-000000000203",
            publicSlug: "lamina-de-outra-loja",
            displayName: "Lâmina de Outra Loja",
            gameOrigin: "OCHPOCH Market",
            itemType: "WEAPON",
          },
        }),
      ],
      nextCursor: null,
      asOf: "2026-08-24T12:00:00.000Z",
    });

    render(<SellerProfileView sellerAccountId={SELLER_ID} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Forja do Norte" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Emblema do Fundador" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Lâmina de Outra Loja" })).not.toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Filtrar anúncios de Forja do Norte" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tipo de item" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Disponibilidade" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Denunciar o perfil do vendedor Forja do Norte" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("não renderiza PII nem identificador interno, mesmo quando a API os entrega", async () => {
    stubFetchOnce({
      data: [buildListing({
        seller: {
          sellerAccountId: SELLER_ID,
          displayName: "Loja do João — joao@exemplo.com",
          // Campos que a projeção pública nunca deveria trazer; a tela os ignora.
          ...({
            email: "joao@exemplo.com",
            phone: "+55 41 99999-8888",
            document: "123.456.789-09",
            userId: "usr_01900000-0000-7000-8000-000000000009",
            members: [{ displayName: "João da Silva", role: "OWNER" }],
          } as Record<string, unknown>),
        },
      })],
      nextCursor: null,
      asOf: "2026-08-24T12:00:00.000Z",
    });

    const { container } = render(<SellerProfileView sellerAccountId={SELLER_ID} />);
    await screen.findByRole("heading", { level: 1 });

    const rendered = container.textContent;
    for (const secret of [
      "joao@exemplo.com",
      "99999-8888",
      "123.456.789-09",
      "usr_01900000-0000-7000-8000-000000000009",
      "João da Silva",
    ]) {
      expect(rendered).not.toContain(secret);
    }

    expect(screen.getByRole("heading", { level: 1, name: "Perfil do vendedor" })).toBeInTheDocument();
    expect(screen.getByText(/foi retido por esta página/u)).toBeInTheDocument();
  });

  it("declara ausência de oferta publicada sem apagar o resto da página", async () => {
    stubFetchOnce({ data: [], nextCursor: null, asOf: "2026-08-24T12:00:00.000Z" });

    render(<SellerProfileView sellerAccountId={SELLER_ID} />);

    expect(
      await screen.findByRole("heading", { name: "Este vendedor não tem anúncio publicado agora." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reputação ainda não publicada" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver marketplace" })).toHaveAttribute("href", "/market");
  });

  it("recusa identificador fora do contrato sem chamar a API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<SellerProfileView sellerAccountId="nao-e-uma-conta" />);

    expect(screen.getByRole("heading", { name: "Vendedor não encontrado" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
