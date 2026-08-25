import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda-corpo da separação figura-fundo.
 *
 * O bug que este teste impede de voltar: a cor de AÇÃO e o véu de AMBIENTE
 * estavam a dois graus de matiz um do outro (gold 80 vs antique-gold 78), com
 * croma alto no ambiente. O fundo lavava a tela inteira na mesma família do
 * CTA, então o botão não tinha para onde saltar.
 *
 * Gestalt §8 (semelhança): uma única cor exclusiva de ação por superfície.
 * Gestalt §3 (figura-fundo): o fundo é cenário e não disputa a figura.
 *
 * Estas duas invariantes são o que separa as duas famílias. Se alguém subir o
 * croma do ambiente ou aproximar a matiz "para ficar mais dourado", este teste
 * falha antes de chegar em produção.
 */

const AMBIENT_CHROMA_CEILING = 0.06;
const MIN_HUE_DISTANCE_DEGREES = 12;

// `import.meta.url` não é file URL sob o environment jsdom deste pacote, então
// o caminho é resolvido da cwd. Aceita as duas cwds possíveis: raiz do
// monorepo e raiz do pacote.
const CANDIDATES = ["packages/ui/src/tokens.css", "src/tokens.css"];
const tokensPath = CANDIDATES.map((candidate) => resolve(process.cwd(), candidate)).find(existsSync);
if (!tokensPath) throw new Error("tokens.css não encontrado a partir de " + process.cwd());
const tokens = readFileSync(tokensPath, "utf8");

interface Oklch {
  readonly lightness: number;
  readonly chroma: number;
  readonly hue: number;
}

function readOklch(variable: string): Oklch {
  const pattern = new RegExp(
    `--${variable}:\\s*oklch\\(\\s*([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\s*\\)`,
  );
  const match = pattern.exec(tokens);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(`token --${variable} não encontrado ou fora do formato oklch()`);
  }
  return {
    lightness: Number(match[1]),
    chroma: Number(match[2]),
    hue: Number(match[3]),
  };
}

/** Distância angular no círculo de matiz: 350 e 10 estão a 20 graus, não 340. */
function hueDistance(first: number, second: number): number {
  const raw = Math.abs(first - second) % 360;
  return raw > 180 ? 360 - raw : raw;
}

describe("tokens de cor — separação ação × ambiente", () => {
  it("o véu de ambiente fica abaixo do teto de croma", () => {
    const ambient = readOklch("och-color-antique-gold");
    expect(ambient.chroma).toBeLessThanOrEqual(AMBIENT_CHROMA_CEILING);
  });

  it("a matiz do ambiente fica longe o suficiente da matiz de ação", () => {
    const action = readOklch("och-color-gold");
    const ambient = readOklch("och-color-antique-gold");
    expect(hueDistance(action.hue, ambient.hue)).toBeGreaterThanOrEqual(
      MIN_HUE_DISTANCE_DEGREES,
    );
  });

  it("a cor de ação mantém croma bem acima do ambiente", () => {
    const action = readOklch("och-color-gold");
    const ambient = readOklch("och-color-antique-gold");
    // Fator 2x: se o ambiente chegar perto, a figura para de se destacar.
    expect(action.chroma).toBeGreaterThan(ambient.chroma * 2);
  });
});

describe("tokens de cor — escada de estado da ação", () => {
  it("hover, active e focus existem e derivam da mesma matiz da ação", () => {
    const action = readOklch("och-color-gold");
    for (const state of ["och-color-gold-hover", "och-color-gold-active", "och-color-gold-focus"]) {
      const value = readOklch(state);
      // Mesma matiz: mudar a matiz no hover troca o significado da cor,
      // não o estado do elemento.
      expect(hueDistance(action.hue, value.hue), state).toBeLessThanOrEqual(4);
    }
  });

  it("hover é mais claro e active é mais escuro que o repouso", () => {
    const action = readOklch("och-color-gold");
    expect(readOklch("och-color-gold-hover").lightness).toBeGreaterThan(action.lightness);
    expect(readOklch("och-color-gold-active").lightness).toBeLessThan(action.lightness);
  });

  it("a ação silenciosa tem croma menor que a ação primária", () => {
    // Se secundário usar o croma cheio, a hierarquia entre primário e
    // secundário desaparece e o usuário não sabe qual é a ação principal.
    expect(readOklch("och-color-gold-quiet").chroma).toBeLessThan(
      readOklch("och-color-gold").chroma,
    );
  });
});

/**
 * `docs/18` §"Governança de tokens", item 4: cada token tem nome, intenção,
 * tema, valor, depreciação e **teste visual**. Os tokens de raridade e de sinal
 * nasceram nesta sessão e entram aqui para não serem exceção à regra.
 */
const RARITY_LEVELS = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
  "contraband",
] as const;

/** Teto de croma da escada de raridade: acima disso ela disputa com o CTA. */
const RARITY_CHROMA_CEILING = 0.15;

describe("tokens de cor — escada de raridade", () => {
  it("todos os sete níveis existem", () => {
    for (const level of RARITY_LEVELS) {
      expect(() => readOklch(`och-rarity-${level}`)).not.toThrow();
    }
  });

  it("nenhuma raridade passa do teto de croma", () => {
    for (const level of RARITY_LEVELS) {
      expect(readOklch(`och-rarity-${level}`).chroma).toBeLessThanOrEqual(RARITY_CHROMA_CEILING);
    }
  });

  it("nenhuma raridade colide com a matiz de ação de NENHUM tema", () => {
    // Testar só contra o ouro global era insuficiente e deixou passar um bug
    // real: o tema comercial público (`.public-commerce-theme`) usa ciano como
    // cor de ação, e `uncommon` estava a 5° dele — a etiqueta de raridade ficava
    // praticamente da cor do botão de comprar.
    //
    // As matizes de ação são lidas do CSS, não escritas à mão aqui: se um tema
    // novo trocar a cor de ação, este teste passa a cobrir esse tema sozinho.
    const actionHues = [...tokens.matchAll(/--color-action:\s*(?:var\(--och-color-gold\)|oklch\([^)]*\))/g)]
      .map((match) => match[0])
      .map((declaration) => {
        if (declaration.includes("--och-color-gold")) return readOklch("och-color-gold").hue;
        const hue = /oklch\(\s*[\d.]+%?\s+[\d.]+\s+([\d.]+)/.exec(declaration);
        return hue?.[1] === undefined ? null : Number.parseFloat(hue[1]);
      })
      .filter((hue): hue is number => hue !== null);

    expect(actionHues.length, "nenhuma cor de ação encontrada no CSS").toBeGreaterThan(0);

    for (const level of RARITY_LEVELS) {
      const rarity = readOklch(`och-rarity-${level}`);
      for (const actionHue of actionHues) {
        expect(
          hueDistance(rarity.hue, actionHue),
          `a raridade ${level} está perto demais da ação em matiz ${String(actionHue)}`,
        ).toBeGreaterThanOrEqual(MIN_HUE_DISTANCE_DEGREES);
      }
    }
  });

  it("os sete níveis são distinguíveis entre si", () => {
    // Dois níveis com a mesma matiz e croma seriam a mesma cor com dois nomes,
    // e a escada deixaria de informar.
    const seen = RARITY_LEVELS.map((level) => ({
      level,
      color: readOklch(`och-rarity-${level}`),
    }));
    for (const [index, first] of seen.entries()) {
      for (const second of seen.slice(index + 1)) {
        const sameHue = hueDistance(first.color.hue, second.color.hue) < 10;
        const sameChroma = Math.abs(first.color.chroma - second.color.chroma) < 0.02;
        expect(
          sameHue && sameChroma,
          `${first.level} e ${second.level} são indistinguíveis`,
        ).toBe(false);
      }
    }
  });
});

describe("tokens de cor — sinal", () => {
  it("o sinal é frio e fica longe da matiz da ação", () => {
    // O par obsidiana + ouro + turquesa vem da referência de marca. O sinal só
    // cumpre o papel se NÃO puder ser confundido com o CTA.
    const signal = readOklch("och-color-signal");
    const action = readOklch("och-color-gold");
    expect(hueDistance(signal.hue, action.hue)).toBeGreaterThanOrEqual(90);
  });

  it("o sinal tem croma menor que a ação", () => {
    // Ele chama atenção pela temperatura, não pela saturação: se gritasse mais
    // que o ouro, viraria o elemento mais forte da tela sem ser clicável.
    expect(readOklch("och-color-signal").chroma).toBeLessThan(readOklch("och-color-gold").chroma);
  });

  it("a variante discreta do sinal é mais fraca que a plena", () => {
    const signal = readOklch("och-color-signal");
    const quiet = readOklch("och-color-signal-quiet");
    expect(quiet.chroma).toBeLessThan(signal.chroma);
    expect(quiet.lightness).toBeLessThan(signal.lightness);
  });
});
