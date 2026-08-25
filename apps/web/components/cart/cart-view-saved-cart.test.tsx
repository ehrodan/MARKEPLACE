import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_STORAGE_KEY, type StoredCartLine } from "./cart-storage";
import { CART_SOURCE_ID_KEY } from "./saved-cart-sync";
import { CartView } from "./cart-view";

const SOURCE_ID = "0198f4a2-1111-7abc-8def-0123456789ab";
const LISTING_A = "0198f4a2-aaaa-7abc-8def-0123456789ab";
const LISTING_B = "0198f4a2-bbbb-7abc-8def-0123456789ab";
const LISTING_C = "0198f4a2-cccc-7abc-8def-0123456789ab";

function storedLine(overrides: Partial<StoredCartLine> = {}): StoredCartLine {
  return {
    listingId: LISTING_A,
    publicSlug: "linha-a",
    title: "Item A",
    sellerAccountId: "seller-1",
    sellerDisplayName: "Loja Aurora",
    unitPriceMinor: "129900",
    currency: "BRL",
    quantity: 2,
    addedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function listingBody(slug: string, listingId: string, priceMinor: string) {
  return {
    listingId,
    publicSlug: slug,
    catalogItemId: `catalog-${slug}`,
    sellerAccountId: "seller-1",
    listingPlanId: "plan-1",
    listingStatus: "PUBLISHED",
    priceMinor,
    currency: "BRL",
    quantityAvailable: 5,
    quantitySold: 0,
    version: 1,
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
  };
}

function savedCartRecord(items: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    savedCartId: "0198f4a2-9999-7abc-8def-0123456789ab",
    cartId: SOURCE_ID,
    snapshot: { currency: "BRL", subtotalMinor: "129900", items },
    itemCount: items.length,
    subtotalMinor: "129900",
    currency: "BRL",
    status: "ACTIVE",
    savedAt: "2026-08-20T12:00:00.000Z",
    expiresAt: "2026-09-19T12:00:00.000Z",
    recoveredAt: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function problemResponse(status: number, code: string, title: string): Response {
  return new Response(JSON.stringify({ title, status, code }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

interface ApiStub {
  /** GET /v1/me/saved-cart */
  savedCartGet: () => Response;
  /** POST /v1/me/saved-cart */
  savedCartPost?: () => Response;
  /** POST /v1/me/saved-cart/recover */
  savedCartRecover?: () => Response;
  /** GET /v1/me/cart */
  cartGet?: () => Response;
}

type RecordedCall = { url: string; method: string; body: string | null };

function stubApi(stub: ApiStub): { calls: () => RecordedCall[] } {
  const recorded: RecordedCall[] = [];
  vi.stubGlobal("fetch", vi.fn((input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    recorded.push({ url, method, body: typeof init?.body === "string" ? init.body : null });

    if (url.endsWith("/v1/me/saved-cart/recover") && method === "POST") {
      return Promise.resolve(
        (stub.savedCartRecover ?? (() => problemResponse(404, "SAVED_CART_NOT_FOUND", "Nada a retomar")))(),
      );
    }
    if (url.endsWith("/v1/me/saved-cart")) {
      if (method === "POST") {
        return Promise.resolve(
          (stub.savedCartPost ?? (() => problemResponse(500, "UNEXPECTED", "POST inesperado")))(),
        );
      }
      return Promise.resolve(stub.savedCartGet());
    }
    if (url.endsWith("/v1/me/cart")) {
      return Promise.resolve(
        (stub.cartGet ?? (() => problemResponse(404, "CAPABILITY_NOT_IMPLEMENTED", "Não implementado")))(),
      );
    }

    const match = /\/v1\/listings\/([^?]+)$/u.exec(url);
    const slug = match?.[1] ? decodeURIComponent(match[1]) : null;
    if (slug === "linha-a") return Promise.resolve(jsonResponse(listingBody(slug, LISTING_A, "129900")));
    if (slug === "linha-b") return Promise.resolve(jsonResponse(listingBody(slug, LISTING_B, "50000")));
    return Promise.resolve(problemResponse(404, "LISTING_NOT_FOUND", "Anúncio não encontrado"));
  }));
  return { calls: () => recorded };
}

function seedCart(lines: StoredCartLine[]): void {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("CartView × carrinho salvo da conta", () => {
  it("restaura a marca do snapshot por listingId, sem duplicar linha, e diz o que não pôde exibir", async () => {
    seedCart([
      storedLine(),
      storedLine({ listingId: LISTING_B, publicSlug: "linha-b", title: "Item B", unitPriceMinor: "50000", quantity: 1 }),
    ]);
    stubApi({
      savedCartGet: () => jsonResponse({
        savedCart: savedCartRecord([
          { listingId: LISTING_A, quantity: 2, unitPriceMinor: "129900", currency: "BRL" },
          { listingId: LISTING_C, quantity: 1, unitPriceMinor: "1000", currency: "BRL" },
        ]),
        asOf: "2026-08-24T00:00:00.000Z",
      }),
    });

    render(<CartView />);

    // A restauração religou a marca: o item A (que estava ativo) entrou na
    // seção de guardados. O anúncio de aria-live é transitório (a revalidação
    // de preço publica o dela em seguida), então o que se afere é o DOM estável.
    const savedHeading = await screen.findByRole("heading", { name: "Guardados para depois" });
    const savedSection = savedHeading.closest("section");
    expect(savedSection).not.toBeNull();
    await within(savedSection as HTMLElement).findByText("Item A");

    // Nunca duplicado: o item A existe uma única vez na tela inteira.
    expect(screen.getAllByText("Item A")).toHaveLength(1);

    // Estado real da conta, com validade e com o que não pôde ser exibido.
    expect(screen.getByText("Salvo na sua conta")).toBeInTheDocument();
    expect(screen.getByText(/1 item do carrinho salvo da conta não pôde ser exibido/u)).toBeInTheDocument();
  });

  it("envia o corpo exato do contrato ao guardar e marca como retomado ao esvaziar", async () => {
    seedCart([storedLine()]);
    window.localStorage.setItem(CART_SOURCE_ID_KEY, SOURCE_ID);
    const api = stubApi({
      savedCartGet: () => jsonResponse({ savedCart: null, asOf: "2026-08-24T00:00:00.000Z" }),
      savedCartPost: () => jsonResponse(savedCartRecord([
        { listingId: LISTING_A, quantity: 2, unitPriceMinor: "129900", currency: "BRL" },
      ])),
      savedCartRecover: () => jsonResponse(savedCartRecord([
        { listingId: LISTING_A, quantity: 2, unitPriceMinor: "129900", currency: "BRL" },
      ], { status: "RECOVERED", recoveredAt: "2026-08-25T00:00:00.000Z" })),
    });

    render(<CartView />);
    fireEvent.click(await screen.findByRole("button", { name: /Guardar para depois/u }));

    // Shape da chamada: é o corpo que retention-routes.ts valida com zod.
    await waitFor(() => {
      const posts = api.calls().filter((call) => call.method === "POST" && call.url.endsWith("/v1/me/saved-cart"));
      expect(posts).toHaveLength(1);
    });
    const post = api.calls().find((call) => call.method === "POST" && call.url.endsWith("/v1/me/saved-cart"));
    expect(post?.url).toBe("/api/backend/v1/me/saved-cart");
    expect(JSON.parse(post?.body ?? "null")).toEqual({
      cartId: SOURCE_ID,
      snapshot: {
        currency: "BRL",
        subtotalMinor: "259800",
        items: [{ listingId: LISTING_A, quantity: 2, unitPriceMinor: "129900", currency: "BRL" }],
      },
    });

    await screen.findByText("Salvo na sua conta");

    // Esvaziar a lista de guardados marca o snapshot da conta como retomado.
    fireEvent.click(screen.getByRole("button", { name: /Voltar ao pedido/u }));
    await waitFor(() => {
      const recovers = api.calls().filter((call) => call.method === "POST" && call.url.endsWith("/v1/me/saved-cart/recover"));
      expect(recovers).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Guardados para depois" })).not.toBeInTheDocument();
    });
  });

  it("sem sessão, nada é enviado e a tela diz que a lista vale só neste dispositivo", async () => {
    seedCart([storedLine()]);
    const api = stubApi({
      savedCartGet: () => problemResponse(401, "UNAUTHENTICATED", "Sessão ausente"),
      cartGet: () => problemResponse(401, "UNAUTHENTICATED", "Sessão ausente"),
    });

    render(<CartView />);
    fireEvent.click(await screen.findByRole("button", { name: /Guardar para depois/u }));

    await screen.findByText("Somente neste dispositivo");
    expect(screen.getByText(/Os itens guardados valem neste navegador e nada foi enviado/u)).toBeInTheDocument();
    expect(
      api.calls().filter((call) => call.method === "POST" && call.url.includes("/v1/me/saved-cart")),
    ).toHaveLength(0);
  });
});
