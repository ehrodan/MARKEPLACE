import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_STORAGE_KEY, type StoredCartLine } from "@/components/cart/cart-storage";
import { PublicNav } from "./public-nav";

function cartLine(overrides: Partial<StoredCartLine> = {}): StoredCartLine {
  return {
    listingId: "listing-1",
    publicSlug: "espada-real",
    title: "Espada real",
    sellerAccountId: "seller-1",
    unitPriceMinor: "129900",
    currency: "BRL",
    quantity: 2,
    addedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function seedCart(lines: StoredCartLine[]): void {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
}

// A nav consulta as notificações da conta; visitante sem sessão recebe 401 e
// o sino fica como link simples. O stub reproduz esse cenário padrão.
beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(
    new Response(JSON.stringify({ title: "Sessão ausente", status: 401, code: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "content-type": "application/problem+json" },
    }),
  )));
});

// Sem `globals: true` no vitest, o auto-cleanup do Testing Library não roda:
// limpamos na mão para um render não vazar no teste seguinte.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Renderiza a nav e espera a consulta de notificações assentar dentro de act. */
async function renderNav(): Promise<void> {
  render(<PublicNav />);
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
}

describe("PublicNav — contagem do carrinho", () => {
  it("sem carrinho gravado não mostra bolinha nem inventa número", async () => {
    await renderNav();
    expect(screen.queryByTestId("cart-count")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir carrinho" })).toHaveAttribute("href", "/carrinho");
  });

  it("soma só as linhas ativas e expõe o total no aria-label", async () => {
    // 2 unidades ativas + 3 guardadas para depois: guardado não vai ao
    // checkout, então não entra na contagem.
    seedCart([
      cartLine({ listingId: "a", quantity: 2 }),
      cartLine({ listingId: "b", quantity: 3, savedForLater: true }),
    ]);
    await renderNav();
    expect(screen.getByTestId("cart-count")).toHaveTextContent("2");
    expect(screen.getByRole("link", { name: "Carrinho, 2 itens" })).toHaveAttribute("href", "/carrinho");
  });

  it("usa singular quando há exatamente 1 item", async () => {
    seedCart([cartLine({ quantity: 1 })]);
    await renderNav();
    expect(screen.getByRole("link", { name: "Carrinho, 1 item" })).toBeInTheDocument();
  });

  it("atualiza quando outra aba grava o carrinho (evento storage)", async () => {
    await renderNav();
    expect(screen.queryByTestId("cart-count")).not.toBeInTheDocument();

    act(() => {
      seedCart([cartLine({ quantity: 4 })]);
      window.dispatchEvent(new Event("storage"));
    });

    expect(screen.getByTestId("cart-count")).toHaveTextContent("4");
    expect(screen.getByRole("link", { name: "Carrinho, 4 itens" })).toBeInTheDocument();
  });

  it("carrinho corrompido conta zero em vez de chutar", async () => {
    window.localStorage.setItem(CART_STORAGE_KEY, "{nada-de-json");
    await renderNav();
    expect(screen.queryByTestId("cart-count")).not.toBeInTheDocument();
  });
});

describe("PublicNav — ações e navegação", () => {
  it("tem link de Favoritos apontando para /conta/favoritos", async () => {
    await renderNav();
    expect(screen.getByRole("link", { name: "Favoritos" })).toHaveAttribute("href", "/conta/favoritos");
  });

  it("mantém o link Vender para /vender/novo na navegação principal", async () => {
    await renderNav();
    expect(screen.getByRole("link", { name: "Vender" })).toHaveAttribute("href", "/vender/novo");
  });

  it("visitante sem sessão vê o sino como link simples, sem contagem", async () => {
    await renderNav();
    expect(screen.getByRole("link", { name: "Notificações" }))
      .toHaveAttribute("href", "/conta/notificacoes");
    expect(screen.queryByTestId("notifications-count")).not.toBeInTheDocument();
  });

  it("autenticado, o sino mostra o total REAL de não lidas da API", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(
      new Response(JSON.stringify({
        data: [],
        unreadCount: 5,
        nextCursor: null,
        asOf: "2026-08-25T12:00:00.000Z",
      }), { status: 200, headers: { "content-type": "application/json" } }),
    )));
    await renderNav();
    expect(screen.getByRole("link", { name: "Notificações, 5 não lidas" }))
      .toHaveAttribute("href", "/conta/notificacoes");
    expect(screen.getByTestId("notifications-count")).toHaveTextContent("5");
  });
});
