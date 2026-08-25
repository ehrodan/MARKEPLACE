import { describe, expect, it } from "vitest";
import { computeBundlePricing, hasRealSavings, type BundleLine } from "./bundle-pricing.js";
import { NEAR_LIMIT_PERCENT, evaluateSpend } from "./spend-awareness.js";

function line(overrides: Partial<BundleLine> & { listingId: string }): BundleLine {
  return { quantity: 1, unitPriceMinor: "10000", currency: "BRL", ...overrides };
}

describe("computeBundlePricing", () => {
  it("soma os preços vigentes e calcula a economia", () => {
    const result = computeBundlePricing(
      [line({ listingId: "a", unitPriceMinor: "150000" }), line({ listingId: "b", unitPriceMinor: "90000" })],
      "216000",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pricing.subtotalMinor).toBe("240000");
    expect(result.pricing.savingsMinor).toBe("24000");
    expect(result.pricing.savingsPercent).toBe(10);
  });

  it("multiplica pela quantidade", () => {
    const result = computeBundlePricing([line({ listingId: "a", quantity: 3 })], "30000");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pricing.subtotalMinor).toBe("30000");
    expect(result.pricing.itemCount).toBe(3);
  });

  it("SEMPRE nomeia a base da economia", () => {
    const result = computeBundlePricing([line({ listingId: "a" })], "9000");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pricing.basis).toContain("preços vigentes");
    expect(result.pricing.basis).toContain("BRL");
  });

  it("recusa combo mais caro que a soma das partes em vez de devolver negativo", () => {
    const result = computeBundlePricing([line({ listingId: "a", unitPriceMinor: "10000" })], "10001");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("TOTAL_ABOVE_SUM");
  });

  it("recusa moedas misturadas", () => {
    const result = computeBundlePricing(
      [line({ listingId: "a" }), line({ listingId: "b", currency: "USD" })],
      "15000",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("CURRENCY_MISMATCH");
  });

  it("recusa combo vazio", () => {
    const result = computeBundlePricing([], "0");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("EMPTY_BUNDLE");
  });

  it("recusa valor e quantidade malformados", () => {
    for (const bad of ["10,00", "10.00", "", "-100", "abc", "1e5"]) {
      const result = computeBundlePricing([line({ listingId: "a", unitPriceMinor: bad })], "1000");
      expect(result.ok, bad).toBe(false);
    }
    for (const quantity of [0, -1, 2.5, 1000, Number.NaN]) {
      const result = computeBundlePricing([line({ listingId: "a", quantity })], "1000");
      expect(result.ok, String(quantity)).toBe(false);
    }
  });

  it("trunca o percentual para baixo — nunca superdeclara desconto", () => {
    // 4190 de 10000 = 41,9% → tem que sair 41.
    const result = computeBundlePricing([line({ listingId: "a", unitPriceMinor: "10000" })], "5810");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pricing.savingsPercent).toBe(41);
  });

  it("mantém precisão acima do inteiro seguro de Number", () => {
    const result = computeBundlePricing(
      [line({ listingId: "a", unitPriceMinor: "9007199254740993" })],
      "9007199254740991",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Number perderia esses 2 centavos. BigInt não.
    expect(result.pricing.savingsMinor).toBe("2");
  });

  it("economia zero não é economia", () => {
    const result = computeBundlePricing([line({ listingId: "a" })], "10000");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pricing.savingsMinor).toBe("0");
    expect(hasRealSavings(result.pricing)).toBe(false);
  });
});

describe("evaluateSpend", () => {
  it("sem teto definido não vira teto zero e não suprime nada", () => {
    const result = evaluateSpend({ spentMinor: "500000", limitMinor: null, currency: "BRL" });
    expect(result.state).toBe("NO_LIMIT");
    expect(result.limitMinor).toBeNull();
    expect(result.remainingMinor).toBeNull();
    expect(result.usedPercent).toBeNull();
    expect(result.suppressUpsell).toBe(false);
  });

  it("abaixo do teto informa o restante", () => {
    const result = evaluateSpend({ spentMinor: "20000", limitMinor: "100000", currency: "BRL" });
    expect(result.state).toBe("UNDER");
    expect(result.remainingMinor).toBe("80000");
    expect(result.usedPercent).toBe(20);
    expect(result.suppressUpsell).toBe(false);
  });

  it("perto do teto avisa mas NÃO censura", () => {
    const result = evaluateSpend({ spentMinor: "80000", limitMinor: "100000", currency: "BRL" });
    expect(result.state).toBe("NEAR");
    expect(result.usedPercent).toBe(NEAR_LIMIT_PERCENT);
    // Avisar antes é útil; parar de sugerir antes seria paternalismo.
    expect(result.suppressUpsell).toBe(false);
  });

  it("no teto suprime upsell e zera o restante", () => {
    const result = evaluateSpend({ spentMinor: "100000", limitMinor: "100000", currency: "BRL" });
    expect(result.state).toBe("REACHED");
    expect(result.remainingMinor).toBe("0");
    expect(result.suppressUpsell).toBe(true);
  });

  it("acima do teto continua REACHED, sem restante negativo", () => {
    const result = evaluateSpend({ spentMinor: "250000", limitMinor: "100000", currency: "BRL" });
    expect(result.state).toBe("REACHED");
    expect(result.remainingMinor).toBe("0");
    expect(result.usedPercent).toBe(250);
    expect(result.suppressUpsell).toBe(true);
  });

  it("teto zero é tratado como ausência de teto, não como bloqueio total", () => {
    const result = evaluateSpend({ spentMinor: "0", limitMinor: "0", currency: "BRL" });
    expect(result.state).toBe("NO_LIMIT");
    expect(result.suppressUpsell).toBe(false);
  });

  it("gasto malformado não quebra e não inventa valor", () => {
    const result = evaluateSpend({ spentMinor: "R$ 500", limitMinor: "100000", currency: "BRL" });
    expect(result.spentMinor).toBe("0");
    expect(result.state).toBe("UNDER");
  });
});
