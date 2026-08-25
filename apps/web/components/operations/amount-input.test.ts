import { describe, expect, it } from "vitest";
import { parseTwoDecimalAmount } from "./amount-input";

describe("parseTwoDecimalAmount", () => {
  it("normaliza valor brasileiro sem usar ponto flutuante", () => {
    expect(parseTwoDecimalAmount("10,05")).toBe("1005");
    expect(parseTwoDecimalAmount("9999999999999999,99")).toBe("999999999999999999");
  });

  it("recusa zero, expoente, sinal e precisão acima de centavos", () => {
    expect(parseTwoDecimalAmount("0")).toBeNull();
    expect(parseTwoDecimalAmount("1e3")).toBeNull();
    expect(parseTwoDecimalAmount("-1")).toBeNull();
    expect(parseTwoDecimalAmount("1,001")).toBeNull();
  });
});
