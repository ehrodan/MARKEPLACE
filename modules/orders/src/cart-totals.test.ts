import { describe, expect, it } from "vitest";
import { AppProblem } from "@midas/kernel";
import {
  assertPositiveQuantity,
  calculateFeeMinor,
  calculateLineTotalMinor,
  groupCheckoutTotals,
  sumSubtotalMinor,
  type CheckoutLineInput,
} from "./cart-service.js";
import { buildOrderPublicCode, normalizeIdempotencyKey } from "./order-service.js";

const sellerA = "0195c3a0-0000-7000-8000-00000000000a";
const sellerB = "0195c3a0-0000-7000-8000-00000000000b";

function line(
  sellerAccountId: string,
  unitPriceMinor: bigint,
  quantity: number,
  currency = "BRL",
): CheckoutLineInput {
  return { sellerAccountId, currency, unitPriceMinor, quantity };
}

describe("total de linha", () => {
  it("multiplica em BigInt sem perder precisão em valores altos", () => {
    expect(calculateLineTotalMinor(1999n, 3)).toBe(5997n);
    expect(calculateLineTotalMinor(0n, 7)).toBe(0n);
    expect(calculateLineTotalMinor(9_007_199_254_740_993n, 3)).toBe(27_021_597_764_222_979n);
  });

  it("recusa quantidade não inteira, zero ou negativa", () => {
    for (const invalid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => calculateLineTotalMinor(100n, invalid)).toThrow(AppProblem);
    }
  });

  it("recusa preço negativo", () => {
    expect(() => calculateLineTotalMinor(-1n, 1)).toThrow(AppProblem);
  });

  it("assertPositiveQuantity devolve a própria quantidade quando válida", () => {
    expect(assertPositiveQuantity(4)).toBe(4);
  });
});

describe("agrupamento de checkout por vendedor", () => {
  it("cria um grupo por conta vendedora somando subtotal e itens", () => {
    const groups = groupCheckoutTotals([
      line(sellerA, 1000n, 2),
      line(sellerB, 2500n, 1),
      line(sellerA, 300n, 3),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({
      sellerAccountId: sellerA,
      currency: "BRL",
      lineCount: 2,
      itemCount: 5,
      subtotalMinor: 2900n,
    });
    expect(groups[1]).toEqual({
      sellerAccountId: sellerB,
      currency: "BRL",
      lineCount: 1,
      itemCount: 1,
      subtotalMinor: 2500n,
    });
  });

  it("preserva a ordem de aparição dos vendedores", () => {
    const groups = groupCheckoutTotals([line(sellerB, 100n, 1), line(sellerA, 100n, 1)]);
    expect(groups.map((group) => group.sellerAccountId)).toEqual([sellerB, sellerA]);
  });

  it("devolve lista vazia para carrinho vazio e soma zero", () => {
    const groups = groupCheckoutTotals([]);
    expect(groups).toEqual([]);
    expect(sumSubtotalMinor(groups)).toBe(0n);
  });

  it("soma o subtotal geral a partir dos grupos", () => {
    const groups = groupCheckoutTotals([
      line(sellerA, 1000n, 2),
      line(sellerB, 2500n, 1),
      line(sellerA, 300n, 3),
    ]);
    expect(sumSubtotalMinor(groups)).toBe(5400n);
  });

  it("recusa moedas divergentes dentro do mesmo vendedor", () => {
    let captured: unknown;
    try {
      groupCheckoutTotals([line(sellerA, 1000n, 1, "BRL"), line(sellerA, 1000n, 1, "USD")]);
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(AppProblem);
    expect((captured as AppProblem).code).toBe("CART_CURRENCY_MISMATCH");
  });
});

describe("comissão da plataforma", () => {
  it("aplica a taxa decimal exata do plano em aritmética inteira", () => {
    expect(calculateFeeMinor(10_000n, "0.0750")).toBe(750n);
    expect(calculateFeeMinor(10_000n, "0.1000")).toBe(1000n);
    expect(calculateFeeMinor(10_000n, "0.1200")).toBe(1200n);
  });

  it("arredonda meio para cima sem ponto flutuante", () => {
    expect(calculateFeeMinor(1n, "0.5000")).toBe(1n);
    expect(calculateFeeMinor(3n, "0.5000")).toBe(2n);
    expect(calculateFeeMinor(101n, "0.0750")).toBe(8n);
  });

  it("trata os extremos 0% e 100%", () => {
    expect(calculateFeeMinor(12_345n, "0")).toBe(0n);
    expect(calculateFeeMinor(12_345n, "0.0000")).toBe(0n);
    expect(calculateFeeMinor(12_345n, "1.0000")).toBe(12_345n);
  });

  it("mantém exatidão acima do limite seguro de Number", () => {
    expect(calculateFeeMinor(90_071_992_547_409_930n, "0.1000")).toBe(9_007_199_254_740_993n);
  });

  it("recusa taxa malformada ou acima de 100%", () => {
    for (const invalid of ["abc", "", "-0.10", "1.0001", "10"]) {
      expect(() => calculateFeeMinor(1000n, invalid)).toThrow(AppProblem);
    }
  });
});

describe("identificadores do pedido", () => {
  it("deriva o código público do próprio id do pedido", () => {
    expect(buildOrderPublicCode("0195c3a0-1111-7abc-8def-0123456789ab")).toBe(
      "MID-8DEF0123-456789AB",
    );
  });

  it("normaliza a chave de idempotência e recusa vazia ou longa demais", () => {
    expect(normalizeIdempotencyKey("  chave-1  ")).toBe("chave-1");
    expect(() => normalizeIdempotencyKey("   ")).toThrow(AppProblem);
    expect(() => normalizeIdempotencyKey("x".repeat(201))).toThrow(AppProblem);
    expect(normalizeIdempotencyKey("x".repeat(200))).toHaveLength(200);
  });
});

/**
 * O checkout por grupo cobra a comissão UMA vez, sobre o subtotal do pedido —
 * nunca por linha. A diferença é dinheiro real do vendedor, e o erro é fácil de
 * cometer somando taxas linha a linha.
 */
describe("comissão de um pedido com várias linhas", () => {
  it("cobra sobre o subtotal, não sobre cada linha", () => {
    // Três linhas de 101 centavos, plano BASIC (7,5%).
    const linhas = [101n, 101n, 101n];
    const subtotal = linhas.reduce((total, valor) => total + valor, 0n);

    const umaVezSobreOSubtotal = calculateFeeMinor(subtotal, "0.0750");
    const somaPorLinha = linhas.reduce(
      (total, valor) => total + calculateFeeMinor(valor, "0.0750"),
      0n,
    );

    expect(subtotal).toBe(303n);
    expect(umaVezSobreOSubtotal).toBe(23n);
    // Por linha daria 8+8+8 = 24: um centavo cobrado a mais do vendedor,
    // por arredondar três vezes em vez de uma.
    expect(somaPorLinha).toBe(24n);
    expect(umaVezSobreOSubtotal).toBeLessThan(somaPorLinha);
  });

  it("o subtotal de várias linhas é a soma dos totais de linha", () => {
    const a = calculateLineTotalMinor(17_990n, 2);
    const b = calculateLineTotalMinor(74_500n, 1);
    expect(a + b).toBe(110_480n);
    expect(calculateFeeMinor(a + b, "0.0750")).toBe(8286n);
  });

  it("mantém exatidão com muitas linhas caras", () => {
    // Vinte linhas de R$ 45.900,00: um Number perderia precisão nesta faixa.
    const linhas = Array.from({ length: 20 }, () => calculateLineTotalMinor(4_590_000n, 1));
    const subtotal = linhas.reduce((total, valor) => total + valor, 0n);
    expect(subtotal).toBe(91_800_000n);
    expect(calculateFeeMinor(subtotal, "0.0750")).toBe(6_885_000n);
  });
});
