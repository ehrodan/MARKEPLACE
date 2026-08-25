import { describe, expect, it } from "vitest";
import {
  craftQualityLabel,
  formatMinorCurrency,
  safeAssetUrl,
} from "./formatters";

describe("formatadores do marketplace", () => {
  it("formata unidades mínimas sem perder centavos", () => {
    expect(formatMinorCurrency("123456", "BRL")).toMatch(/R\$\s?1\.234,56/u);
  });

  it("mantém valores acima do inteiro seguro sem converter para Number", () => {
    expect(formatMinorCurrency("900719925474099301", "BRL")).toMatch(/9\.007\.199\.254\.740\.993,01/u);
  });

  it("recusa URI de asset que o navegador não deve abrir", () => {
    expect(safeAssetUrl("s3://private-bucket/item.glb")).toBeNull();
    expect(safeAssetUrl("javascript:alert(1)")).toBeNull();
    expect(safeAssetUrl("https://cdn.example/item.webp")).toBe("https://cdn.example/item.webp");
  });

  it("traduz a qualidade canônica do craft", () => {
    expect(craftQualityLabel("FACTORY_NEW")).toBe("Nova de fábrica");
  });
});
