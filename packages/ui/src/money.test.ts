import { describe, expect, it } from "vitest";
import { formatMinorUnits } from "./money";

describe("formatMinorUnits", () => {
  it("mantém centavos e moeda explícitos", () => {
    expect(formatMinorUnits(12345, "BRL")).toMatch(/123,45/);
  });

  it("respeita a unidade menor definida pela moeda", () => {
    expect(formatMinorUnits(1250, "JPY", "ja-JP")).toContain("1,250");
    expect(formatMinorUnits(1250, "BHD", "en-US")).toContain("1.250");
  });

  it("rejeita valores fracionários para evitar dinheiro em ponto flutuante", () => {
    expect(() => formatMinorUnits(12.5, "BRL")).toThrow(TypeError);
  });
});
