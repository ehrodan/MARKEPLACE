import { describe, expect, it } from "vitest";
import { phase, trackProgress } from "./scroll-progress";

describe("trackProgress", () => {
  it("é 0 enquanto o trilho não encostou no topo", () => {
    expect(trackProgress(400, 1800, 900)).toBe(0);
    expect(trackProgress(0, 1800, 900)).toBe(0);
  });

  it("chega a 1 exatamente no fim do curso, e não passa disso", () => {
    // curso = 1800 - 900 = 900
    expect(trackProgress(-900, 1800, 900)).toBe(1);
    expect(trackProgress(-5000, 1800, 900)).toBe(1);
  });

  it("interpola linearmente no meio do curso", () => {
    expect(trackProgress(-450, 1800, 900)).toBeCloseTo(0.5, 5);
    expect(trackProgress(-225, 1800, 900)).toBeCloseTo(0.25, 5);
  });

  it("devolve 0 quando não há curso, em vez de dividir por zero", () => {
    // Um trilho que cabe na viewport não tem o que animar. Sem esta guarda o
    // resultado seria Infinity ou NaN, e a peça sumiria de imediato.
    expect(trackProgress(-10, 900, 900)).toBe(0);
    expect(trackProgress(-10, 600, 900)).toBe(0);
  });

  it("nunca devolve NaN, para nenhuma entrada degenerada", () => {
    for (const args of [[0, 0, 0], [-1, 0, 900], [0, 900, 0], [-100, 100, 100]] as const) {
      const value = trackProgress(args[0], args[1], args[2]);
      expect(Number.isNaN(value)).toBe(false);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe("phase", () => {
  it("corta fora da janela", () => {
    expect(phase(0.1, 0.3, 0.7)).toBe(0);
    expect(phase(0.9, 0.3, 0.7)).toBe(1);
  });

  it("interpola dentro da janela", () => {
    expect(phase(0.5, 0.3, 0.7)).toBeCloseTo(0.5, 5);
    expect(phase(0.4, 0.3, 0.7)).toBeCloseTo(0.25, 5);
  });

  it("trata janela degenerada sem dividir por zero", () => {
    expect(phase(0.5, 0.5, 0.5)).toBe(1);
    expect(phase(0.4, 0.5, 0.5)).toBe(0);
    expect(phase(0.5, 0.8, 0.2)).toBe(1);
  });

  it("janelas encadeadas cobrem o trilho sem buraco nem sobreposição", () => {
    // A abertura depende disto: a peça sai em [0, 0.55] e a loja entra em
    // [0.55, 1]. Se as janelas não se tocarem, existe um instante com a peça
    // já invisível e a loja ainda não visível — tela vazia no meio do scroll.
    const corte = 0.55;
    for (const p of [0, 0.2, 0.54, 0.55, 0.56, 0.9, 1]) {
      const saida = phase(p, 0, corte);
      const entrada = phase(p, corte, 1);
      expect(saida === 1 || entrada === 0).toBe(true);
    }
  });
});
