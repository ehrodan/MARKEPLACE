import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAVORITES_STORAGE_KEY, type StoredFavorite } from "./favorites-storage";
import { FavoritesView } from "./favorites-view";

interface ListingFixture {
  priceMinor: string;
  quantityAvailable: number;
}

function favorite(overrides: Partial<StoredFavorite> = {}): StoredFavorite {
  return {
    listingId: "listing-disponivel",
    publicSlug: "ak-47-redline",
    title: "AK-47 Redline",
    savedPriceMinor: "129900",
    currency: "BRL",
    savedAt: "2026-08-01T12:00:00.000Z",
    watch: [],
    ...overrides,
  };
}

function listingBody(slug: string, fixture: ListingFixture) {
  return {
    listingId: `id-${slug}`,
    publicSlug: slug,
    catalogItemId: `catalog-${slug}`,
    sellerAccountId: "seller-1",
    listingPlanId: "plan-1",
    listingStatus: "PUBLISHED",
    priceMinor: fixture.priceMinor,
    currency: "BRL",
    quantityAvailable: fixture.quantityAvailable,
    quantitySold: 0,
    version: 1,
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
  };
}

function problem(status: number, code: string, title: string) {
  return new Response(JSON.stringify({ title, status, code }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

/** A watchlist da conta ainda não foi publicada: a tela opera em modo local. */
function stubApi(listings: Record<string, ListingFixture | "GONE">) {
  vi.stubGlobal("fetch", vi.fn((input: unknown) => {
    const url = typeof input === "string" ? input : String(input);

    if (url.includes("/v1/me/watchlist")) {
      return Promise.resolve(problem(404, "CAPABILITY_NOT_IMPLEMENTED", "Não implementado"));
    }

    const match = /\/v1\/listings\/([^?]+)$/u.exec(url);
    const slug = match?.[1] ? decodeURIComponent(match[1]) : null;
    const fixture = slug === null ? undefined : listings[slug];

    if (fixture === undefined || fixture === "GONE") {
      return Promise.resolve(problem(404, "LISTING_NOT_FOUND", "Anúncio não encontrado"));
    }

    return Promise.resolve(new Response(JSON.stringify(listingBody(slug ?? "", fixture)), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  }));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("FavoritesView", () => {
  it("agrupa os itens salvos por estado real, com rótulo e explicação em texto", async () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([
      favorite({ listingId: "a", publicSlug: "disponivel", title: "Item disponível", savedAt: "2026-08-04T12:00:00.000Z" }),
      favorite({ listingId: "b", publicSlug: "barateou", title: "Item que barateou", savedAt: "2026-08-03T12:00:00.000Z" }),
      favorite({ listingId: "c", publicSlug: "esgotado", title: "Item esgotado", savedAt: "2026-08-02T12:00:00.000Z" }),
      favorite({ listingId: "d", publicSlug: "sumiu", title: "Item que sumiu", savedAt: "2026-08-01T12:00:00.000Z" }),
    ]));

    stubApi({
      disponivel: { priceMinor: "129900", quantityAvailable: 3 },
      barateou: { priceMinor: "99900", quantityAvailable: 2 },
      esgotado: { priceMinor: "129900", quantityAvailable: 0 },
      sumiu: "GONE",
    });

    render(<FavoritesView />);

    expect(await screen.findByRole("heading", { name: "Disponível · 1 item" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Preço mudou · 1 item" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Sem estoque · 1 item" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Fora do catálogo público · 1 item" })).toBeInTheDocument();

    // Cada estado carrega explicação em texto — status nunca só por cor.
    expect(screen.getAllByText(/Publicado, com estoque e pelo mesmo preço que você salvou/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/zero unidade disponível agora/u).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/não consegue distinguir pausa de remoção/u).length).toBeGreaterThan(0);

    // O item que saiu do catálogo continua na lista, com explicação e próxima ação.
    const desaparecido = await screen.findByRole("heading", { name: "Item que sumiu" });
    const card = desaparecido.closest("article");
    expect(card).not.toBeNull();
    const scope = within(card as HTMLElement);
    expect(scope.getByRole("link", { name: /Procurar no catálogo público/u })).toHaveAttribute("href", "/market");
    expect(scope.getByRole("button", { name: "Remover Item que sumiu dos favoritos" })).toBeInTheDocument();

    // Preço salvo e preço de hoje aparecem juntos, sem adjetivo de oferta.
    expect(screen.getByText(/menor que o preço salvo/u)).toBeInTheDocument();
    expect(screen.getAllByText("Preço quando você salvou")).toHaveLength(4);
  });

  it("dá a cada estado uma próxima ação própria, nunca o mesmo rótulo genérico", async () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([
      favorite({ listingId: "a", publicSlug: "disponivel", title: "Item disponível" }),
      favorite({ listingId: "b", publicSlug: "barateou", title: "Item que barateou" }),
      favorite({ listingId: "c", publicSlug: "esgotado", title: "Item esgotado" }),
      favorite({ listingId: "d", publicSlug: "sumiu", title: "Item que sumiu" }),
    ]));

    stubApi({
      disponivel: { priceMinor: "129900", quantityAvailable: 3 },
      barateou: { priceMinor: "99900", quantityAvailable: 2 },
      esgotado: { priceMinor: "129900", quantityAvailable: 0 },
      sumiu: "GONE",
    });

    render(<FavoritesView />);
    await screen.findByRole("heading", { name: "Fora do catálogo público · 1 item" });

    const actions = [
      ["Item disponível", "Abrir anúncio", "/anuncios/disponivel"],
      ["Item que barateou", "Conferir o preço atual", "/anuncios/barateou"],
      ["Item esgotado", "Abrir anúncio esgotado", "/anuncios/esgotado"],
      ["Item que sumiu", "Procurar no catálogo público", "/market"],
    ] as const;

    for (const [title, action, href] of actions) {
      const card = screen.getByRole("heading", { name: title }).closest("article");
      expect(card).not.toBeNull();
      expect(within(card as HTMLElement).getByRole("link", { name: new RegExp(action, "u") }))
        .toHaveAttribute("href", href);
    }

    // Rótulos distintos: nenhum estado herda a ação de outro.
    expect(new Set(actions.map(([, action]) => action)).size).toBe(actions.length);
  });

  it("usa lista semântica dentro de cada grupo de estado", async () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([
      favorite({ listingId: "a", publicSlug: "disponivel", title: "Item disponível" }),
    ]));
    stubApi({ disponivel: { priceMinor: "129900", quantityAvailable: 3 } });

    render(<FavoritesView />);
    const group = await screen.findByRole("region", { name: "Disponível · 1 item" });
    expect(within(group).getAllByRole("listitem")).toHaveLength(1);
  });

  it("informa com honestidade que a sincronização com a conta está pendente", async () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([favorite({ publicSlug: "disponivel" })]));
    stubApi({ disponivel: { priceMinor: "129900", quantityAvailable: 1 } });

    render(<FavoritesView />);

    expect(await screen.findByText("Sincronização com a conta pendente")).toBeInTheDocument();
    expect(screen.getByText("GET /v1/me/watchlist")).toBeInTheDocument();
  });

  it("oferece saída para o catálogo quando nada foi salvo, em vez de beco sem saída", async () => {
    stubApi({});
    render(<FavoritesView />);

    expect(await screen.findByRole("heading", { name: "Você ainda não salvou nenhum item" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar ofertas publicadas" })).toHaveAttribute("href", "/market");
  });

  it("mantém o item salvo e explica quando o armazenamento local está corrompido", async () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, "{ isto nao e json ]");
    stubApi({});
    render(<FavoritesView />);

    expect(await screen.findByText(/estava ilegível e foi descartado/u)).toBeInTheDocument();
  });

  it("nenhum aviso vem marcado e o nome acessível do controle inclui o item", async () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([
      favorite({ listingId: "c", publicSlug: "esgotado", title: "Item esgotado" }),
    ]));
    stubApi({ esgotado: { priceMinor: "129900", quantityAvailable: 0 } });

    render(<FavoritesView />);

    const backInStock = await screen.findByRole("button", { name: "Avisar quando voltar ao estoque — Item esgotado" });
    const priceDrop = await screen.findByRole("button", { name: "Avisar se o preço cair — Item esgotado" });

    expect(backInStock).toHaveAttribute("aria-pressed", "false");
    expect(priceDrop).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByText("Desligado")).toHaveLength(2);

    // O texto diz o que acontece ANTES de a pessoa ligar.
    expect(screen.getByText(/uma única mensagem quando o vendedor repuser a quantidade disponível/u)).toBeInTheDocument();
    expect(screen.getAllByText(/nenhuma mensagem é enviada/u).length).toBeGreaterThan(0);
  });

  it("liga o aviso só depois do clique, registra carimbo e desliga em um clique", async () => {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([
      favorite({ listingId: "c", publicSlug: "esgotado", title: "Item esgotado" }),
    ]));
    stubApi({ esgotado: { priceMinor: "129900", quantityAvailable: 0 } });

    render(<FavoritesView />);
    fireEvent.click(await screen.findByRole("button", { name: "Avisar quando voltar ao estoque — Item esgotado" }));

    const pressed = await screen.findByRole("button", { name: "Aviso de reposição ligado — Item esgotado" });
    expect(pressed).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Você ligou este aviso em/u)).toBeInTheDocument();
    expect(screen.getByText(/Aviso de volta ao estoque ligado para Item esgotado/u)).toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]") as StoredFavorite[];
    expect(stored[0]?.watch).toHaveLength(1);
    expect(stored[0]?.watch[0]?.channel).toBe("BACK_IN_STOCK");
    expect(stored[0]?.watch[0]?.policyVersion).toBeTruthy();
    expect(stored[0]?.watch[0]?.optedInAt).toBeTruthy();

    fireEvent.click(pressed);
    const back = await screen.findByRole("button", { name: "Avisar quando voltar ao estoque — Item esgotado" });
    expect(back).toHaveAttribute("aria-pressed", "false");
    const afterDisable = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]") as StoredFavorite[];
    expect(afterDisable[0]?.watch).toHaveLength(0);
  });
});
