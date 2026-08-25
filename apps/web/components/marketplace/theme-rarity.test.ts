import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RARITY_ORDER as RARITY_LEVELS } from "./rarity";

/**
 * A escada de raridade contra a cor de ação de CADA tema do app.
 *
 * `packages/ui/src/tokens.test.ts` já garante a separação contra a ação padrão,
 * mas ele lê só `tokens.css` — e não pode ler `apps/web`, porque a fronteira
 * arquitetural proíbe o design system depender do app. Os temas locais, como
 * `.public-commerce-theme`, vivem em `globals.css` e ficavam sem cobertura.
 *
 * Foi assim que um bug real passou: o tema comercial trocou a ação de ouro
 * (matiz 80) para ciano (matiz 195), e `--och-rarity-uncommon` estava em 200 —
 * cinco graus de distância. A etiqueta "incomum" ficava praticamente da cor do
 * botão de comprar, num tema onde a regra escrita é que **raridade nunca
 * preenche elemento clicável**.
 *
 * Este teste existe para que trocar a cor de ação de qualquer tema volte a
 * quebrar o build em vez de virar um card enganoso.
 */

/** Abaixo disso, duas matizes leem como a mesma cor num rótulo pequeno. */
const MIN_HUE_DISTANCE_DEGREES = 12;

const globals = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
const tokens = readFileSync(resolve(process.cwd(), "../../packages/ui/src/tokens.css"), "utf8");

function hueOf(css: string, variable: string): number | null {
  const pattern = new RegExp(`--${variable}:\\s*oklch\\(\\s*[\\d.]+%?\\s+[\\d.]+\\s+([\\d.]+)`, "u");
  const match = pattern.exec(css);
  return match?.[1] === undefined ? null : Number.parseFloat(match[1]);
}

function hueDistance(first: number, second: number): number {
  const raw = Math.abs(first - second) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/** Cada bloco de tema do `globals.css` que declara a própria cor de ação. */
function themeActionHues(): { theme: string; hue: number }[] {
  const found: { theme: string; hue: number }[] = [];
  const blocks = globals.matchAll(/\.([a-z-]*theme[a-z-]*)\s*\{([^}]*)\}/gu);
  for (const block of blocks) {
    // Os dois grupos são obrigatórios no padrão, então `matchAll` sempre os
    // entrega; a desestruturação evita a checagem que o lint marca como morta.
    const [, name = "", body = ""] = block;
    const hue = hueOf(body, "color-action");
    if (hue !== null) found.push({ theme: name, hue });
  }
  return found;
}

describe("raridade × cor de ação de cada tema", () => {
  it("encontra ao menos um tema com cor de ação própria", () => {
    // Se nenhum tema for encontrado, o teste estaria passando por vazio — e o
    // bug que ele existe para pegar voltaria a passar despercebido.
    expect(themeActionHues().length).toBeGreaterThan(0);
  });

  it("nenhuma raridade colide com a ação de nenhum tema", () => {
    for (const { theme, hue } of themeActionHues()) {
      for (const level of RARITY_LEVELS) {
        const rarityHue = hueOf(tokens, `och-rarity-${level.toLowerCase()}`);
        expect(rarityHue, `token de raridade ${level} ausente`).not.toBeNull();
        expect(
          hueDistance(rarityHue ?? 0, hue),
          `raridade ${level} está a menos de ${String(MIN_HUE_DISTANCE_DEGREES)}° da ação do tema .${theme}`,
        ).toBeGreaterThanOrEqual(MIN_HUE_DISTANCE_DEGREES);
      }
    }
  });
});
