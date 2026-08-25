import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountOverview } from "@/lib/api-types";
import { OverviewView } from "./overview-view";

function overview(overrides: Partial<AccountOverview> = {}): AccountOverview {
  return {
    asOf: "2026-08-10T12:00:00.000Z",
    freshness: "READY",
    displayName: "Caçador",
    ...overrides,
  };
}

function stubOverviewApi(payload: AccountOverview) {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  )));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OverviewView — hierarquia e atalhos", () => {
  it("sauda pelo nick real no título da página", async () => {
    stubOverviewApi(overview());
    render(<OverviewView />);

    expect(await screen.findByRole("heading", { level: 1, name: "Bem-vindo de volta, Caçador" }))
      .toBeInTheDocument();
  });

  it("agrupa atalhos de Compras e Segurança com destino real", async () => {
    stubOverviewApi(overview());
    render(<OverviewView />);

    const compras = await screen.findByRole("region", { name: "Compras" });
    expect(within(compras).getByRole("link", { name: "Minhas compras" }))
      .toHaveAttribute("href", "/conta/compras");
    expect(within(compras).getByRole("link", { name: "Reembolsos" }))
      .toHaveAttribute("href", "/conta/reembolsos");

    const seguranca = screen.getByRole("region", { name: "Segurança" });
    expect(within(seguranca).getByRole("link", { name: "Sessões e segurança" }))
      .toHaveAttribute("href", "/conta/seguranca");
    expect(within(seguranca).getByRole("link", { name: "Privacidade" }))
      .toHaveAttribute("href", "/conta/privacidade");
  });

  it("esconde o grupo Carteira quando o servidor não devolveu saldo de vendas", async () => {
    stubOverviewApi(overview());
    render(<OverviewView />);

    await screen.findByRole("region", { name: "Compras" });
    expect(screen.queryByRole("region", { name: "Carteira" })).toBeNull();
  });

  it("mostra o grupo Carteira quando existe saldo real de vendas", async () => {
    stubOverviewApi(overview({
      balanceBuckets: [
        { code: "AVAILABLE", amountMinor: 129900, currency: "BRL", label: "Disponível" },
      ],
    }));
    render(<OverviewView />);

    const carteira = await screen.findByRole("region", { name: "Carteira" });
    expect(within(carteira).getByRole("link", { name: "Saldo de vendas" }))
      .toHaveAttribute("href", "/conta/carteira");
    expect(within(carteira).getByRole("link", { name: "Saques" }))
      .toHaveAttribute("href", "/conta/saques");
  });
});
