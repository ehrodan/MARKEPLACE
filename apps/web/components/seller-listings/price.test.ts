import { describe, expect, it } from "vitest";
import { formatMinorString, parseBrlMinor } from "./price";

describe("parseBrlMinor", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["R$ 79,90", 7990],
    ["79.90", 7990],
    ["79", 7900],
  ])("converte %s em centavos", (input, expected) => {
    expect(parseBrlMinor(input)).toBe(expected);
  });

  it.each(["", "0", "-1", "12,999", "produto"])('rejeita "%s"', (input) => {
    expect(parseBrlMinor(input)).toBeNull();
  });
});

describe("formatMinorString", () => {
  it("formata resposta da API sem tratar centavos como reais", () => {
    expect(formatMinorString("123456", "BRL")).toContain("1.234,56");
  });
});
