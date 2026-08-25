import { describe, expect, it } from "vitest";
import { formatMinorAmount } from "./minor-money";

describe("formatMinorAmount", () => {
  it("preserva precisão de valores recebidos como string", () => {
    expect(formatMinorAmount("123456789012345678", "BRL")).toContain("1.234.567.890.123.456,78");
  });

  it("não converte entrada inválida em valor financeiro aparente", () => {
    expect(formatMinorAmount("indisponível", "BRL")).toBe("indisponível BRL");
  });
});
