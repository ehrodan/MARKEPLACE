import { describe, expect, it } from "vitest";
import {
  MINIMUM_HIGHLIGHTED_PERCENT,
  RULE_OF_100_THRESHOLD_MINOR,
  frameBundleSavings,
  frameDiscount,
} from "./price-framing";

const BRL = "BRL";

describe("frameDiscount — Regra do 100", () => {
  it("usa porcentagem quando a âncora fica abaixo de 100 unidades da moeda", () => {
    // Âncora R$ 80,00 (8000 centavos) → abaixo do limiar.
    const frame = frameDiscount({
      currentPriceMinor: "4000",
      anchorPriceMinor: "8000",
      currency: BRL,
    });

    expect(frame.kind).toBe("percent");
    expect(frame.savingsMinor).toBe("4000");
    expect(frame.savingsPercent).toBe(50);
    expect(frame.basis).not.toBeNull();
  });

  it("usa valor absoluto quando a âncora fica acima de 100 unidades da moeda", () => {
    // Âncora R$ 2.000,00 → acima do limiar.
    const frame = frameDiscount({
      currentPriceMinor: "150000",
      anchorPriceMinor: "200000",
      currency: BRL,
    });

    expect(frame.kind).toBe("absolute");
    expect(frame.savingsMinor).toBe("50000");
    expect(frame.savingsPercent).toBe(25);
  });

  it("trata o limiar exato como valor absoluto", () => {
    const frame = frameDiscount({
      currentPriceMinor: "5000",
      anchorPriceMinor: RULE_OF_100_THRESHOLD_MINOR.toString(),
      currency: BRL,
    });

    expect(frame.kind).toBe("absolute");
  });
});

describe("frameDiscount — limites honestos", () => {
  it("não enquadra nada sem âncora real", () => {
    const semAncora = frameDiscount({ currentPriceMinor: "9900", currency: BRL });
    expect(semAncora.kind).toBe("none");
    expect(semAncora.reason).toBe("ANCHOR_MISSING");
    expect(semAncora.basis).toBeNull();
    expect(semAncora.savingsMinor).toBe("0");

    const ancoraNula = frameDiscount({
      currentPriceMinor: "9900",
      anchorPriceMinor: null,
      currency: BRL,
    });
    expect(ancoraNula.reason).toBe("ANCHOR_MISSING");
  });

  it("recusa âncora que não é maior que o preço atual", () => {
    const igual = frameDiscount({
      currentPriceMinor: "9900",
      anchorPriceMinor: "9900",
      currency: BRL,
    });
    expect(igual.reason).toBe("ANCHOR_NOT_HIGHER");

    const menor = frameDiscount({
      currentPriceMinor: "9900",
      anchorPriceMinor: "5000",
      currency: BRL,
    });
    expect(menor.reason).toBe("ANCHOR_NOT_HIGHER");
  });

  it("trunca a porcentagem para baixo — nunca superdeclara desconto", () => {
    // 4190 / 10000 = 41,9% → tem que sair 41, não 42.
    const frame = frameDiscount({
      currentPriceMinor: "5810",
      anchorPriceMinor: "10000",
      currency: BRL,
    });

    expect(frame.savingsPercent).toBe(41);
  });

  it("não destaca desconto irrelevante", () => {
    // 2% de desconto.
    const frame = frameDiscount({
      currentPriceMinor: "9800",
      anchorPriceMinor: "10000",
      currency: BRL,
    });

    expect(frame.kind).toBe("none");
    expect(frame.reason).toBe("BELOW_MINIMUM");
  });

  it("aceita exatamente o piso mínimo de destaque", () => {
    const frame = frameDiscount({
      currentPriceMinor: "9500",
      anchorPriceMinor: "10000",
      currency: BRL,
    });

    expect(frame.savingsPercent).toBe(MINIMUM_HIGHLIGHTED_PERCENT);
    expect(frame.kind).not.toBe("none");
  });

  it("recusa moeda divergente entre preço e âncora", () => {
    const frame = frameDiscount({
      currentPriceMinor: "5000",
      anchorPriceMinor: "10000",
      currency: BRL,
      anchorCurrency: "USD",
    });

    expect(frame.reason).toBe("CURRENCY_MISMATCH");
  });

  it("recusa valor não inteiro, decimal, negativo ou vazio", () => {
    for (const invalido of ["", " ", "99,90", "99.90", "abc", "1e5", "-100"]) {
      const frame = frameDiscount({
        currentPriceMinor: invalido,
        anchorPriceMinor: "20000",
        currency: BRL,
      });
      expect(frame.kind, `atual inválido: ${JSON.stringify(invalido)}`).toBe("none");
    }

    for (const invalido of ["0", "-1", "1,5", "x"]) {
      const frame = frameDiscount({
        currentPriceMinor: "5000",
        anchorPriceMinor: invalido,
        currency: BRL,
      });
      expect(frame.kind, `âncora inválida: ${JSON.stringify(invalido)}`).toBe("none");
    }
  });

  it("mantém precisão em valores muito acima do inteiro seguro de Number", () => {
    // 92.233.720.368.547.758,10 — estoura Number.MAX_SAFE_INTEGER em centavos.
    const frame = frameDiscount({
      currentPriceMinor: "9223372036854775800",
      anchorPriceMinor: "9223372036854775810",
      currency: BRL,
    });

    // Diferença de 10 centavos em base gigante: percentual real é ~0%,
    // então não destaca. O que importa é não ter havido perda de precisão.
    expect(frame.kind).toBe("none");
    expect(frame.reason).toBe("BELOW_MINIMUM");

    const grande = frameDiscount({
      currentPriceMinor: "4000000000000000000",
      anchorPriceMinor: "8000000000000000000",
      currency: BRL,
    });
    expect(grande.savingsMinor).toBe("4000000000000000000");
    expect(grande.savingsPercent).toBe(50);
  });
});

describe("frameBundleSavings", () => {
  it("calcula a economia contra a soma dos preços vigentes e nomeia a base", () => {
    const frame = frameBundleSavings({
      itemPricesMinor: ["150000", "90000", "60000"],
      bundleTotalMinor: "270000",
      currency: BRL,
    });

    expect(frame.kind).toBe("absolute");
    expect(frame.savingsMinor).toBe("30000");
    expect(frame.savingsPercent).toBe(10);
    expect(frame.basis).toContain("3 itens");
  });

  it("devolve none quando o conjunto não tem desconto real", () => {
    const frame = frameBundleSavings({
      itemPricesMinor: ["150000", "90000"],
      bundleTotalMinor: "240000",
      currency: BRL,
    });

    expect(frame.kind).toBe("none");
    expect(frame.reason).toBe("ANCHOR_NOT_HIGHER");
    expect(frame.savingsMinor).toBe("0");
    expect(frame.basis).toBeNull();
  });

  it("devolve none para conjunto vazio", () => {
    const frame = frameBundleSavings({
      itemPricesMinor: [],
      bundleTotalMinor: "1000",
      currency: BRL,
    });

    expect(frame.reason).toBe("ANCHOR_MISSING");
  });

  it("recusa item com valor inválido em vez de ignorar em silêncio", () => {
    const frame = frameBundleSavings({
      itemPricesMinor: ["150000", "90,00"],
      bundleTotalMinor: "200000",
      currency: BRL,
    });

    expect(frame.reason).toBe("INVALID_AMOUNT");
  });
});
