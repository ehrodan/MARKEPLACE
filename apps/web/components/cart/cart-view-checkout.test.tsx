import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CART_STORAGE_KEY, type StoredCartLine } from "./cart-storage";
import { CartView } from "./cart-view";

/**
 * O caminho mais crítico do carrinho — virar pedido — estava sem teste.
 *
 * O que estes casos travam:
 *
 * 1. com o carrinho DA CONTA, dois itens do mesmo vendedor viram **um** pedido,
 *    numa chamada só. Antes a tela fazia um `POST /v1/orders` por linha, e isso
 *    tinha três defeitos reais: falha parcial (metade da compra feita), taxa
 *    arredondada por linha (centavo a mais cobrado do vendedor toda vez) e N
 *    pedidos do mesmo vendedor;
 * 2. quando a chamada falha, **nada** sai do carrinho — a transação do servidor
 *    é tudo-ou-nada, e a tela não pode dizer "parcial" onde não há parcial;
 * 3. sem conta, o carrinho é do dispositivo e não existe no servidor, então o
 *    caminho por item continua sendo o único possível.
 */

const LISTING_A = "0198f4a2-aaaa-7abc-8def-0123456789ab";
const LISTING_B = "0198f4a2-bbbb-7abc-8def-0123456789ab";
const CART_LINE_A = "0198f4a2-1a1a-7abc-8def-0123456789ab";
const CART_LINE_B = "0198f4a2-1b1b-7abc-8def-0123456789ab";
const SELLER = "0198f4a2-5e11-7abc-8def-0123456789ab";

function line(overrides: Partial<StoredCartLine> = {}): StoredCartLine {
  return {
    listingId: LISTING_A,
    publicSlug: "linha-a",
    title: "Item A",
    sellerAccountId: SELLER,
    sellerDisplayName: "Loja Aurora",
    unitPriceMinor: "10100",
    currency: "BRL",
    quantity: 1,
    addedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function listingBody(slug: string, listingId: string, priceMinor: string) {
  return {
    listingId,
    publicSlug: slug,
    catalogItemId: `catalog-${slug}`,
    sellerAccountId: SELLER,
    listingPlanId: "plan-1",
    listingStatus: "PUBLISHED",
    priceMinor,
    currency: "BRL",
    quantityAvailable: 9,
    quantitySold: 0,
    version: 1,
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    seller: { sellerAccountId: SELLER, displayName: "Loja Aurora" },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function problem(status: number, code: string, title: string): Response {
  return new Response(JSON.stringify({ title, status, code }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

/**
 * Carrinho da CONTA.
 *
 * `parseServerCart` lê `lines` PLANO — não `groups`. O agrupamento por vendedor
 * é feito na própria tela; a projeção do servidor entrega a lista corrida, e
 * cada linha traz `cartLineId`, que é o que marca "esta linha existe no
 * servidor" e habilita o fechamento por grupo.
 */
function serverCart() {
  return {
    lines: [
      {
        cartLineId: CART_LINE_A,
        listingId: LISTING_A,
        sellerAccountId: SELLER,
        sellerDisplayName: "Loja Aurora",
        quantity: 1,
        unitPriceMinor: "10100",
        currency: "BRL",
        addedAt: "2026-08-01T12:00:00.000Z",
        listing: { publicSlug: "linha-a" },
        catalogItem: { displayName: "Item A" },
      },
      {
        cartLineId: CART_LINE_B,
        listingId: LISTING_B,
        sellerAccountId: SELLER,
        sellerDisplayName: "Loja Aurora",
        quantity: 2,
        unitPriceMinor: "10100",
        currency: "BRL",
        addedAt: "2026-08-01T12:05:00.000Z",
        listing: { publicSlug: "linha-b" },
        catalogItem: { displayName: "Item B" },
      },
    ],
  };
}

interface Stub {
  /** Resposta do fechamento por grupo. */
  groupOrder?: () => Response;
  /** Se `false`, a conta não adota o carrinho e ele fica no dispositivo. */
  withAccount?: boolean;
}

type Call = { url: string; method: string; body: string | null };

function stubApi(stub: Stub): { calls: () => Call[] } {
  const recorded: Call[] = [];
  vi.stubGlobal("fetch", vi.fn((input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    recorded.push({ url, method, body: typeof init?.body === "string" ? init.body : null });

    if (/\/v1\/me\/cart\/checkout-groups\/[^/]+\/orders$/u.test(url) && method === "POST") {
      return Promise.resolve((stub.groupOrder ?? (() => json({ data: { orderId: "ord-1", publicCode: "OCH-001" } }, 201)))());
    }
    if (url.endsWith("/v1/orders") && method === "POST") {
      return Promise.resolve(json({ data: { orderId: "ord-item", publicCode: "OCH-ITEM" } }, 201));
    }
    if (url.endsWith("/v1/me/cart/merge") && method === "POST") {
      return Promise.resolve(stub.withAccount === false ? problem(401, "UNAUTHENTICATED", "Sem sessão") : json(serverCart()));
    }
    if (url.endsWith("/v1/me/cart")) {
      return Promise.resolve(stub.withAccount === false ? problem(401, "UNAUTHENTICATED", "Sem sessão") : json(serverCart()));
    }
    if (url.endsWith("/v1/me/saved-cart") || url.endsWith("/v1/me/saved-cart/recover")) {
      return Promise.resolve(problem(404, "SAVED_CART_NOT_FOUND", "Nada salvo"));
    }

    const match = /\/v1\/listings\/([^?]+)$/u.exec(url);
    const slug = match?.[1] === undefined ? null : decodeURIComponent(match[1]);
    if (slug === "linha-a") return Promise.resolve(json(listingBody(slug, LISTING_A, "10100")));
    if (slug === "linha-b") return Promise.resolve(json(listingBody(slug, LISTING_B, "10100")));
    return Promise.resolve(problem(404, "LISTING_NOT_FOUND", "Anúncio não encontrado"));
  }));
  return { calls: () => recorded };
}

function seed(lines: StoredCartLine[]): void {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
}

const doisDoMesmoVendedor = [
  line({ cartLineId: CART_LINE_A }),
  line({ listingId: LISTING_B, publicSlug: "linha-b", title: "Item B", quantity: 2, cartLineId: CART_LINE_B }),
];

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

/**
 * O merge dispositivo → conta é assíncrono, e só depois dele a tela sabe que as
 * linhas vivem no servidor. Clicar antes disso testaria o caminho errado — foi
 * o que aconteceu na primeira versão destes casos.
 */
async function esperarCarrinhoDaConta(): Promise<void> {
  await screen.findByText("Carrinho da conta");
}

async function clicarFechar(): Promise<void> {
  const botao = await screen.findByRole("button", { name: /Loja Aurora/u });
  fireEvent.click(botao);
}

describe("carrinho da conta — fechar o grupo como pedido", () => {
  it("fecha os dois itens do mesmo vendedor numa chamada só", async () => {
    seed(doisDoMesmoVendedor);
    const api = stubApi({});
    render(<CartView />);

    await esperarCarrinhoDaConta();
    await clicarFechar();
    await waitFor(() => { expect(screen.getByText(/Pedido criado/u)).toBeInTheDocument(); });

    const porGrupo = api.calls().filter((c) => c.method === "POST" && /checkout-groups\/.+\/orders$/u.test(c.url));
    const porItem = api.calls().filter((c) => c.method === "POST" && c.url.endsWith("/v1/orders"));

    // UMA chamada para o grupo inteiro, nenhuma por item.
    const trilha = api.calls().map((c) => `${c.method} ${c.url.slice(c.url.indexOf("/v1"))}`);
    expect(porGrupo, `trilha: ${trilha.join(" | ")}`).toHaveLength(1);
    expect(porItem).toHaveLength(0);
  });

  it("manda o vendedor e uma chave de idempotência no corpo", async () => {
    seed(doisDoMesmoVendedor);
    const api = stubApi({});
    render(<CartView />);
    await esperarCarrinhoDaConta();
    await clicarFechar();
    await waitFor(() => { expect(screen.getByText(/Pedido criado/u)).toBeInTheDocument(); });

    const chamada = api.calls().find((c) => /checkout-groups\/.+\/orders$/u.test(c.url));
    const corpo = JSON.parse(chamada?.body ?? "{}") as { sellerAccountId?: string; idempotencyKey?: string };
    expect(corpo.sellerAccountId).toBe(SELLER);
    // Sem chave, um clique repetido criaria dois pedidos do mesmo carrinho.
    expect(typeof corpo.idempotencyKey).toBe("string");
    expect((corpo.idempotencyKey ?? "").length).toBeGreaterThanOrEqual(8);
  });

  it("quando a API recusa, NADA sai do carrinho e a tela não fala em parcial", async () => {
    seed(doisDoMesmoVendedor);
    stubApi({ groupOrder: () => problem(409, "LISTING_INSUFFICIENT_QUANTITY", "Estoque insuficiente") });
    render(<CartView />);

    await esperarCarrinhoDaConta();
    await clicarFechar();
    const alerta = await screen.findByRole("alert");

    expect(alerta).toHaveTextContent(/Nenhum pedido foi criado e nada saiu do carrinho/u);
    // "2 de 2 pedidos foram criados" seria mentira: a transação é tudo-ou-nada.
    expect(alerta).not.toHaveTextContent(/de 2 pedidos/u);
    // Os dois itens continuam na tela.
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText("Item B")).toBeInTheDocument();
  });

  it("diz o contrato exato quando a capability não existe na API", async () => {
    seed(doisDoMesmoVendedor);
    stubApi({ groupOrder: () => problem(404, "CAPABILITY_NOT_IMPLEMENTED", "Não publicado") });
    render(<CartView />);

    await esperarCarrinhoDaConta();
    await clicarFechar();
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/ainda não publicado/u);
  });
});

describe("carrinho do dispositivo — sem conta", () => {
  it("cai no caminho por item, porque não há linha no servidor para fechar", async () => {
    seed([line({ cartLineId: undefined })]);
    const api = stubApi({ withAccount: false });
    render(<CartView />);

    // Sem esperar pela conta, de propósito: aqui ela nunca adota o carrinho.
    await clicarFechar();
    await waitFor(() => { expect(screen.getByText(/Pedido criado/u)).toBeInTheDocument(); });

    const porGrupo = api.calls().filter((c) => c.method === "POST" && /checkout-groups\/.+\/orders$/u.test(c.url));
    const porItem = api.calls().filter((c) => c.method === "POST" && c.url.endsWith("/v1/orders"));

    expect(porGrupo).toHaveLength(0);
    expect(porItem).toHaveLength(1);
  });
});
