import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RARITY_ORDER, rarityPresentation } from "./rarity";

describe("rarityPresentation", () => {
  it("mapeia todos os níveis do domínio, com rótulo e posição", () => {
    for (const [index, value] of RARITY_ORDER.entries()) {
      const presentation = rarityPresentation(value);
      expect(presentation).not.toBeNull();
      expect(presentation?.value).toBe(value);
      expect(presentation?.step).toBe(index + 1);
      expect(presentation?.total).toBe(RARITY_ORDER.length);
      expect(presentation?.label.length).toBeGreaterThan(0);
    }
  });

  it("trata ausência como ausência, nunca como o nível mais baixo", () => {
    // Um item sem raridade declarada exibido como "comum" seria um dado
    // inventado sobre a peça de outra pessoa.
    expect(rarityPresentation(null)).toBeNull();
    expect(rarityPresentation(undefined)).toBeNull();
    expect(rarityPresentation("")).toBeNull();
    expect(rarityPresentation("   ")).toBeNull();
  });

  it("recusa valor desconhecido em vez de adivinhar", () => {
    expect(rarityPresentation("ULTRA")).toBeNull();
    // O rótulo em português NÃO é entrada válida: a função recebe o valor do
    // domínio, e aceitar "comum" abriria a porta para o rótulo virar chave.
    expect(rarityPresentation("comum")).toBeNull();
    // A caixa do valor canônico, essa sim, é normalizada.
    expect(rarityPresentation("rare")?.value).toBe("RARE");
    expect(rarityPresentation(" Common ")?.value).toBe("COMMON");
  });

  it("cobre exatamente os valores aceitos pelo CHECK da migration", () => {
    // Se o banco ganhar um nível novo e este módulo não acompanhar, o item
    // apareceria sem cor e sem rótulo. Este teste quebra antes disso.
    const sql = readFileSync(
      resolve(process.cwd(), "../../modules/catalog/migrations/0007_catalog.sql"),
      "utf8",
    );
    const match = /catalog_items_rarity_check[^(]*\(\s*rarity\s+in\s*\(([^)]+)\)/i.exec(sql)
      ?? /rarity[^,]*check\s*\(\s*rarity\s+in\s*\(([^)]+)\)/i.exec(sql);
    expect(match, "CHECK de rarity não encontrado na migration").not.toBeNull();
    const fromSql = [...(match?.[1] ?? "").matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    expect(fromSql.length).toBeGreaterThan(0);
    expect([...fromSql].sort()).toEqual([...RARITY_ORDER].sort());
  });

  it("cada nível tem um token de cor declarado", () => {
    const css = readFileSync(resolve(process.cwd(), "../../packages/ui/src/tokens.css"), "utf8");
    for (const value of RARITY_ORDER) {
      expect(css).toContain(`--och-rarity-${value.toLowerCase()}:`);
    }
  });
});
