import { describe, expect, it } from "vitest";
import {
  evaluateWatchlistPriceChange,
  evaluateWatchlistStockChange,
  type WatchlistPriceFacts,
} from "./watchlist-service.js";

/** R$ 1.200,00 em minor units. */
const REFERENCE = 120_000n;

function priceFacts(overrides: Partial<WatchlistPriceFacts> = {}): WatchlistPriceFacts {
  return {
    kind: "PRICE_DROP",
    referencePriceMinor: REFERENCE,
    targetPriceMinor: null,
    newPriceMinor: REFERENCE,
    ...overrides,
  };
}

describe("evaluateWatchlistPriceChange — queda dispara, alta não", () => {
  it("dispara quando o preço cai abaixo da referência real", () => {
    const decision = evaluateWatchlistPriceChange(
      priceFacts({ newPriceMinor: 119_999n }),
    );
    expect(decision).toEqual({ triggered: true, reason: "PRICE_DROPPED" });
  });

  it("não dispara quando o preço sobe", () => {
    const decision = evaluateWatchlistPriceChange(
      priceFacts({ newPriceMinor: 120_001n }),
    );
    expect(decision).toEqual({ triggered: false, reason: "PRICE_NOT_LOWER" });
  });

  it("não dispara quando o preço fica igual", () => {
    const decision = evaluateWatchlistPriceChange(priceFacts());
    expect(decision).toEqual({ triggered: false, reason: "PRICE_NOT_LOWER" });
  });

  it("ANY_OFFER segue a mesma regra: avisar que subiu seria spam", () => {
    expect(
      evaluateWatchlistPriceChange(
        priceFacts({ kind: "ANY_OFFER", newPriceMinor: 100_000n }),
      ),
    ).toEqual({ triggered: true, reason: "PRICE_DROPPED" });
    expect(
      evaluateWatchlistPriceChange(
        priceFacts({ kind: "ANY_OFFER", newPriceMinor: 130_000n }),
      ),
    ).toEqual({ triggered: false, reason: "PRICE_NOT_LOWER" });
  });

  it("BACK_IN_STOCK não reage a preço", () => {
    const decision = evaluateWatchlistPriceChange(
      priceFacts({ kind: "BACK_IN_STOCK", newPriceMinor: 1n }),
    );
    expect(decision).toEqual({ triggered: false, reason: "KIND_NOT_PRICE_SENSITIVE" });
  });
});

describe("evaluateWatchlistPriceChange — alvo pedido pela pessoa manda", () => {
  it("dispara ao atingir exatamente o alvo", () => {
    const decision = evaluateWatchlistPriceChange(
      priceFacts({ targetPriceMinor: 100_000n, newPriceMinor: 100_000n }),
    );
    expect(decision).toEqual({ triggered: true, reason: "TARGET_PRICE_REACHED" });
  });

  it("dispara abaixo do alvo", () => {
    const decision = evaluateWatchlistPriceChange(
      priceFacts({ targetPriceMinor: 100_000n, newPriceMinor: 99_999n }),
    );
    expect(decision).toEqual({ triggered: true, reason: "TARGET_PRICE_REACHED" });
  });

  it("não dispara em queda que ainda não chegou no alvo", () => {
    const decision = evaluateWatchlistPriceChange(
      priceFacts({ targetPriceMinor: 100_000n, newPriceMinor: 110_000n }),
    );
    expect(decision).toEqual({ triggered: false, reason: "TARGET_PRICE_NOT_REACHED" });
  });

  it("alvo zero é respeitado como alvo, não confundido com ausência de alvo", () => {
    expect(
      evaluateWatchlistPriceChange(
        priceFacts({ targetPriceMinor: 0n, newPriceMinor: 1n }),
      ),
    ).toEqual({ triggered: false, reason: "TARGET_PRICE_NOT_REACHED" });
    expect(
      evaluateWatchlistPriceChange(
        priceFacts({ targetPriceMinor: 0n, newPriceMinor: 0n }),
      ),
    ).toEqual({ triggered: true, reason: "TARGET_PRICE_REACHED" });
  });
});

describe("comparação em BigInt com valores grandes", () => {
  /**
   * Acima de Number.MAX_SAFE_INTEGER (9.007.199.254.740.991) o `number` do JavaScript
   * perde precisão e passa a considerar iguais valores diferentes. BigInt não.
   */
  const HUGE: bigint = 9_007_199_254_740_993n;
  const HUGE_MINUS_ONE: bigint = 9_007_199_254_740_992n;

  it("number confundiria estes dois valores; a política não pode confundir", () => {
    expect(Number(HUGE)).toBe(Number(HUGE_MINUS_ONE));
    expect(HUGE === HUGE_MINUS_ONE).toBe(false);
    expect(HUGE > HUGE_MINUS_ONE).toBe(true);
  });

  it("queda de uma unidade acima do limite seguro do number ainda dispara", () => {
    const decision = evaluateWatchlistPriceChange({
      kind: "PRICE_DROP",
      referencePriceMinor: HUGE,
      targetPriceMinor: null,
      newPriceMinor: HUGE_MINUS_ONE,
    });
    expect(decision).toEqual({ triggered: true, reason: "PRICE_DROPPED" });
  });

  it("alta de uma unidade acima do limite seguro do number não dispara", () => {
    const decision = evaluateWatchlistPriceChange({
      kind: "PRICE_DROP",
      referencePriceMinor: HUGE_MINUS_ONE,
      targetPriceMinor: null,
      newPriceMinor: HUGE,
    });
    expect(decision).toEqual({ triggered: false, reason: "PRICE_NOT_LOWER" });
  });

  it("alvo gigante compara certo", () => {
    expect(
      evaluateWatchlistPriceChange({
        kind: "PRICE_DROP",
        referencePriceMinor: HUGE + 10n,
        targetPriceMinor: HUGE,
        newPriceMinor: HUGE_MINUS_ONE,
      }),
    ).toEqual({ triggered: true, reason: "TARGET_PRICE_REACHED" });

    expect(
      evaluateWatchlistPriceChange({
        kind: "PRICE_DROP",
        referencePriceMinor: HUGE + 10n,
        targetPriceMinor: HUGE_MINUS_ONE,
        newPriceMinor: HUGE,
      }),
    ).toEqual({ triggered: false, reason: "TARGET_PRICE_NOT_REACHED" });
  });
});

describe("evaluateWatchlistStockChange", () => {
  it("dispara só com estoque real maior que zero", () => {
    expect(
      evaluateWatchlistStockChange({ kind: "BACK_IN_STOCK", quantityAvailable: 1 }),
    ).toEqual({ triggered: true, reason: "STOCK_RESTOCKED" });
    expect(
      evaluateWatchlistStockChange({ kind: "BACK_IN_STOCK", quantityAvailable: 0 }),
    ).toEqual({ triggered: false, reason: "STOCK_STILL_EMPTY" });
  });

  it("ANY_OFFER também acompanha reabastecimento", () => {
    expect(
      evaluateWatchlistStockChange({ kind: "ANY_OFFER", quantityAvailable: 3 }),
    ).toEqual({ triggered: true, reason: "STOCK_RESTOCKED" });
  });

  it("PRICE_DROP não reage a estoque", () => {
    expect(
      evaluateWatchlistStockChange({ kind: "PRICE_DROP", quantityAvailable: 10 }),
    ).toEqual({ triggered: false, reason: "KIND_NOT_STOCK_SENSITIVE" });
  });
});
