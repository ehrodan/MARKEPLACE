import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingStory } from "./landing-story";

vi.mock("./landing-model", () => ({
  LandingModel: () => <div data-testid="landing-model" />,
}));

class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly scrollMargin = "0px";
  readonly thresholds = [];
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();
  constructor(callback: IntersectionObserverCallback) { void callback; }
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LandingStory", () => {
  it("na home usa um único capítulo, e um único stage", () => {
    // A home virou loja: o produto sobe e a narrativa longa sai. O padrão do
    // componente é a variante de loja, com o capítulo de abertura só.
    const { container } = render(<LandingStory />);
    expect(screen.getByTestId("landing-model")).toBeInTheDocument();
    expect(container.querySelectorAll(".landing-story__stage")).toHaveLength(1);
    expect(container.querySelectorAll(".landing-story__chapter")).toHaveLength(1);
  });

  it("a variante completa mantém os três capítulos de prova", () => {
    // Custódia e confirmação dupla não foram apagadas: continuam disponíveis
    // para uma superfície que exista para explicar a proteção.
    const { container } = render(<LandingStory variant="full" />);
    expect(container.querySelectorAll(".landing-story__stage")).toHaveLength(1);
    expect(container.querySelectorAll(".landing-story__chapter")).toHaveLength(3);
  });

  it("o contador de capítulo some quando há apenas um", () => {
    // Contador apontando para capítulos inexistentes é pior que contador
    // ausente.
    const loja = render(<LandingStory />);
    expect(loja.container.querySelectorAll(".landing-story__stage-index")).toHaveLength(0);
    loja.unmount();

    const completa = render(<LandingStory variant="full" />);
    expect(completa.container.querySelectorAll(".landing-story__stage-index")).toHaveLength(1);
  });

  it("possui o contrato CSS correspondente ao DOM", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toContain(".landing-story__stage");
    expect(css).toContain(".landing-story__chapters");
    expect(css).toContain(".landing-story__chapter[data-active=\"true\"]");
  });
});
