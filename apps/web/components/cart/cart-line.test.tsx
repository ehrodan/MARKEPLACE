import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatMinorCurrency } from "@/components/marketplace/formatters";
import type { PublicListing } from "@/components/marketplace/types";
import { CartLine, describeCartLine, priceDropMinor, type CartLineStatus } from "./cart-line";
import type { StoredCartLine } from "./cart-storage";

function line(overrides: Partial<StoredCartLine> = {}): StoredCartLine {
  return {
    listingId: "listing-a",
    publicSlug: "ak-47-redline",
    title: "AK-47 Redline",
    sellerAccountId: "seller-1",
    unitPriceMinor: "129900",
    currency: "BRL",
    quantity: 1,
    addedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function listing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    listingId: "listing-a",
    publicSlug: "ak-47-redline",
    catalogItemId: "catalog-a",
    sellerAccountId: "seller-1",
    listingPlanId: "plan-1",
    listingStatus: "PUBLISHED",
    priceMinor: "129900",
    currency: "BRL",
    quantityAvailable: 5,
    quantitySold: 0,
    version: 1,
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function statusFor(current: Partial<PublicListing>, stored = line()): CartLineStatus {
  return describeCartLine(stored, { status: "FOUND", listing: listing(current) });
}

function renderLine(stored: StoredCartLine, status: CartLineStatus) {
  return render(
    <ul>
      <CartLine
        line={stored}
        status={status}
        busy={false}
        onQuantityChange={vi.fn()}
        onAcceptPrice={vi.fn()}
        onSaveForLater={vi.fn()}
        onRemove={vi.fn()}
        onRecheck={vi.fn()}
      />
    </ul>,
  );
}

afterEach(() => {
  cleanup();
});

describe("priceDropMinor", () => {
  it("devolve a diferença exata, em unidades mínimas, só quando o preço caiu", () => {
    expect(priceDropMinor(line(), statusFor({ priceMinor: "99900" }))).toBe("30000");
    expect(priceDropMinor(line(), statusFor({ priceMinor: "129900" }))).toBeNull(); // igual
    expect(priceDropMinor(line(), statusFor({ priceMinor: "139900" }))).toBeNull(); // subiu
  });

  it("calcula em BigInt acima do limite seguro de Number", () => {
    const stored = line({ unitPriceMinor: "9007199254740993" });
    expect(priceDropMinor(stored, statusFor({ priceMinor: "9007199254740992" }, stored))).toBe("1");
  });

  it("moeda trocada nunca vira diferença: comparar moedas seria mentira", () => {
    expect(priceDropMinor(line(), statusFor({ priceMinor: "99900", currency: "USD" }))).toBeNull();
  });

  it("sem preço vigente confirmado, não há queda a declarar", () => {
    expect(priceDropMinor(line(), describeCartLine(line(), { status: "CHECKING" }))).toBeNull();
    expect(priceDropMinor(line(), describeCartLine(line(), { status: "GONE" }))).toBeNull();
    expect(priceDropMinor(line(), describeCartLine(line(), undefined))).toBeNull();
  });

  it("sem estoque a queda continua sendo dita: é informação real, não oferta", () => {
    expect(priceDropMinor(line(), statusFor({ priceMinor: "99900", quantityAvailable: 0 }))).toBe("30000");
  });
});

describe("badge de queda de preço na linha", () => {
  it("mostra a diferença exata com tom de sucesso quando o preço caiu", () => {
    renderLine(line(), statusFor({ priceMinor: "99900" }));

    // Comparação por textContent bruto: o Intl separa "R$" do valor com espaço
    // inflexível (U+00A0), que o normalizador padrão do testing-library
    // achataria só de um dos lados.
    const expected = `Preço caiu ${formatMinorCurrency("30000", "BRL")} desde que você adicionou`;
    const badge = screen.getByText(
      (_, element) => element?.classList.contains("ui-status") === true
        && element.textContent === expected,
    );
    expect(badge).toHaveClass("ui-status--success");
    // O estado "Preço mudou" continua visível: a queda não esconde o bloqueio.
    expect(screen.getByText("Preço mudou")).toBeInTheDocument();
    expect(screen.getByRole("button", {
      name: `Aceitar ${formatMinorCurrency("99900", "BRL")} por unidade`,
    })).toBeInTheDocument();
  });

  it("não mostra badge de queda quando o preço subiu ou não mudou", () => {
    renderLine(line(), statusFor({ priceMinor: "139900" }));
    expect(screen.queryByText(/Preço caiu/u)).not.toBeInTheDocument();
    cleanup();

    renderLine(line(), statusFor({ priceMinor: "129900" }));
    expect(screen.queryByText(/Preço caiu/u)).not.toBeInTheDocument();
  });
});
