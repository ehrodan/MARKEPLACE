import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DepthStack,
  MagneticCta,
  ParallaxLayer,
  Reveal,
  ScrollProgress,
  ShineCard,
  Tilt3D,
} from "./scroll-3d";

/**
 * Contrato coberto: children sempre renderizados, reduced motion e ponteiro
 * grosso desligam o efeito, ausência de IntersectionObserver não quebra nada
 * (conteúdo continua visível) e todo observer/listener some no unmount.
 */

/**
 * jsdom não implementa `window.matchMedia`; cada teste define o seu e o
 * afterEach remove a propriedade própria, devolvendo o ambiente ao original.
 */
interface MediaPreferences {
  reduce?: boolean;
  coarse?: boolean;
}

function setMediaPreferences({ reduce = false, coarse = false }: MediaPreferences = {}): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches:
        (reduce && query.includes("prefers-reduced-motion")) ||
        (coarse && query.includes("pointer: coarse")),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function fakeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    width,
    height,
    top,
    left,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}

class FakeIntersectionObserver implements IntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  readonly root: Element | null = null;
  readonly rootMargin: string;
  readonly scrollMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  readonly observed: Element[] = [];

  disconnected = false;

  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.rootMargin = options?.rootMargin ?? "";
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(target: Element): void {
    const index = this.observed.indexOf(target);
    if (index >= 0) this.observed.splice(index, 1);
  }

  disconnect(): void {
    this.disconnected = true;
    this.observed.splice(0, this.observed.length);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger(target: Element, isIntersecting: boolean): void {
    const rect = target.getBoundingClientRect();
    this.callback(
      [
        {
          target,
          isIntersecting,
          boundingClientRect: rect,
          intersectionRect: rect,
          intersectionRatio: isIntersecting ? 1 : 0,
          rootBounds: null,
          time: 0,
        },
      ],
      this,
    );
  }
}

function lastObserver(): FakeIntersectionObserver {
  const instance = FakeIntersectionObserver.instances.at(-1);
  if (!instance) throw new Error("nenhum IntersectionObserver criado");
  return instance;
}

function useFakeIntersectionObserver(): void {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
}

/** rAF síncrono: torna a escrita agendada observável dentro do próprio act. */
function useSyncAnimationFrame(): void {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  setMediaPreferences();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("Reveal", () => {
  it("mantém o conteúdo visível quando não existe IntersectionObserver", () => {
    const { container } = render(<Reveal>Conteúdo sem observer</Reveal>);
    const node = container.querySelector(".ui-reveal");

    expect(screen.getByText("Conteúdo sem observer")).toBeInTheDocument();
    expect(node?.classList.contains("is-ready")).toBe(false);
    expect(node?.getAttribute("data-reveal-state")).toBe("shown");
  });

  it("esconde, revela uma única vez e não volta a observar", () => {
    useFakeIntersectionObserver();
    const { container } = render(<Reveal delay={120}>Entrada</Reveal>);
    const node = container.querySelector(".ui-reveal");
    const observer = lastObserver();

    expect(node?.classList.contains("is-ready")).toBe(true);
    expect(node?.getAttribute("data-reveal-state")).toBe("hidden");
    expect(observer.observed).toHaveLength(1);

    act(() => {
      if (node) observer.trigger(node, true);
    });

    expect(node?.getAttribute("data-reveal-state")).toBe("shown");
    expect(observer.observed).toHaveLength(0);
  });

  it("respeita prefers-reduced-motion e nunca esconde o conteúdo", () => {
    setMediaPreferences({ reduce: true });
    useFakeIntersectionObserver();
    const { container } = render(<Reveal as="section">Sem motion</Reveal>);
    const node = container.querySelector(".ui-reveal");

    expect(node?.tagName).toBe("SECTION");
    expect(node?.classList.contains("is-ready")).toBe(false);
    expect(node?.getAttribute("data-reveal-state")).toBe("shown");
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
  });

  it("desconecta o observer no unmount", () => {
    useFakeIntersectionObserver();
    const { unmount } = render(<Reveal>Ciclo de vida</Reveal>);
    const observer = lastObserver();

    unmount();

    expect(observer.disconnected).toBe(true);
  });
});

describe("Tilt3D", () => {
  it("renderiza children e ativa o tilt no pointermove", () => {
    useSyncAnimationFrame();
    const { container } = render(
      <Tilt3D max={8} glare>
        Card inclinável
      </Tilt3D>,
    );
    const node = container.querySelector(".ui-tilt3d");

    expect(screen.getByText("Card inclinável")).toBeInTheDocument();
    expect(node?.classList.contains("is-ready")).toBe(true);
    expect(container.querySelector(".ui-tilt3d__glare")).toHaveAttribute("aria-hidden", "true");

    if (node instanceof HTMLElement) {
      node.getBoundingClientRect = () => fakeRect(0, 0, 200, 100);
      fireEvent.pointerMove(node, { clientX: 150, clientY: 25 });
      expect(node.getAttribute("data-tilt-active")).toBe("true");

      fireEvent.pointerLeave(node);
      expect(node.hasAttribute("data-tilt-active")).toBe(false);
    }
  });

  it("fica inerte em ponteiro grosso", () => {
    setMediaPreferences({ coarse: true });
    const { container } = render(<Tilt3D>Touch</Tilt3D>);
    const node = container.querySelector(".ui-tilt3d");

    expect(screen.getByText("Touch")).toBeInTheDocument();
    expect(node?.classList.contains("is-ready")).toBe(false);
  });

  it("fica inerte com movimento reduzido", () => {
    setMediaPreferences({ reduce: true });
    const { container } = render(<Tilt3D>Sem motion</Tilt3D>);

    expect(container.querySelector(".ui-tilt3d")?.classList.contains("is-ready")).toBe(false);
  });
});

describe("ParallaxLayer", () => {
  it("renderiza children sem IntersectionObserver e não registra scroll", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const { container } = render(<ParallaxLayer speed={0.4}>Camada</ParallaxLayer>);
    const layer = container.querySelector<HTMLElement>(".ui-parallax");

    expect(screen.getByText("Camada")).toBeInTheDocument();
    expect(layer?.classList.contains("is-ready")).toBe(true);
    expect(addSpy.mock.calls.some(([type]) => type === "scroll")).toBe(false);
  });

  it("observa e limpa o scroll quando há IntersectionObserver", () => {
    useFakeIntersectionObserver();
    useSyncAnimationFrame();
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { container, unmount } = render(<ParallaxLayer speed={0.25}>Camada</ParallaxLayer>);
    const layer = container.querySelector<HTMLElement>(".ui-parallax");
    const observer = lastObserver();
    expect(layer).not.toBeNull();
    if (!layer) throw new Error("camada de parallax ausente");
    vi.spyOn(layer, "getBoundingClientRect").mockReturnValue(fakeRect(0, 600, 400, 200));

    expect(observer.observed).toHaveLength(1);
    expect(addSpy.mock.calls.some(([type]) => type === "scroll")).toBe(true);
    act(() => { observer.trigger(layer, true); });
    expect(layer.style.getPropertyValue("--parallax-offset")).toBe("7.20px");

    unmount();

    expect(observer.disconnected).toBe(true);
    expect(removeSpy.mock.calls.some(([type]) => type === "scroll")).toBe(true);
  });

  it("não aplica deslocamento com movimento reduzido", () => {
    setMediaPreferences({ reduce: true });
    const { container } = render(<ParallaxLayer>Camada</ParallaxLayer>);

    expect(container.querySelector(".ui-parallax")?.classList.contains("is-ready")).toBe(false);
  });
});

describe("DepthStack", () => {
  it("estabelece a perspectiva e mantém a ordem do DOM", () => {
    const { container } = render(
      <DepthStack as="section" perspective={1200}>
        <div data-depth="1">Frente</div>
        <div data-depth="-1">Fundo</div>
      </DepthStack>,
    );
    const node = container.querySelector(".ui-depth-stack");

    expect(node?.tagName).toBe("SECTION");
    expect(screen.getByText("Frente")).toBeInTheDocument();
    expect(screen.getByText("Fundo")).toBeInTheDocument();
    expect(node?.children[0]?.textContent).toBe("Frente");
  });
});

describe("ShineCard", () => {
  it("mantém o brilho decorativo fora da árvore de acessibilidade", () => {
    useSyncAnimationFrame();
    const { container } = render(<ShineCard>Conteúdo do card</ShineCard>);
    const node = container.querySelector(".ui-shine-card");

    expect(screen.getByText("Conteúdo do card")).toBeInTheDocument();
    expect(container.querySelector(".ui-shine-card__shine")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    if (node instanceof HTMLElement) {
      node.getBoundingClientRect = () => fakeRect(0, 0, 200, 100);
      fireEvent.pointerMove(node, { clientX: 20, clientY: 20 });
      expect(node.getAttribute("data-shine-active")).toBe("true");

      fireEvent.pointerLeave(node);
      expect(node.hasAttribute("data-shine-active")).toBe(false);
    }
  });

  it("fica inerte com movimento reduzido", () => {
    setMediaPreferences({ reduce: true });
    const { container } = render(<ShineCard>Card</ShineCard>);

    expect(container.querySelector(".ui-shine-card")?.classList.contains("is-ready")).toBe(false);
  });
});

describe("MagneticCta", () => {
  it("só escuta o ponteiro enquanto está visível e solta tudo no unmount", () => {
    useFakeIntersectionObserver();
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { container, unmount } = render(
      <MagneticCta radius={100}>
        <button type="button">Ver detalhes</button>
      </MagneticCta>,
    );
    const node = container.querySelector(".ui-magnetic");
    const observer = lastObserver();

    expect(screen.getByRole("button", { name: "Ver detalhes" })).toBeInTheDocument();
    expect(addSpy.mock.calls.some(([type]) => type === "pointermove")).toBe(false);

    act(() => {
      if (node) observer.trigger(node, true);
    });

    expect(addSpy.mock.calls.some(([type]) => type === "pointermove")).toBe(true);

    unmount();

    expect(observer.disconnected).toBe(true);
    expect(removeSpy.mock.calls.some(([type]) => type === "pointermove")).toBe(true);
  });

  it("fica inerte com movimento reduzido e preserva o CTA", () => {
    setMediaPreferences({ reduce: true });
    const { container } = render(
      <MagneticCta>
        <button type="button">Continuar</button>
      </MagneticCta>,
    );

    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
    expect(container.querySelector(".ui-magnetic")?.classList.contains("is-ready")).toBe(false);
  });
});

describe("ScrollProgress", () => {
  it("expõe progressbar com valor real e acompanha o scroll", () => {
    useSyncAnimationFrame();
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 0 });

    render(<ScrollProgress />);
    const bar = screen.getByRole("progressbar", { name: "Progresso de leitura da página" });

    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");

    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 500 });
    fireEvent.scroll(window);

    expect(bar).toHaveAttribute("aria-valuenow", "50");
  });

  it("remove os listeners no unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ScrollProgress />);

    unmount();

    expect(removeSpy.mock.calls.some(([type]) => type === "scroll")).toBe(true);
  });
});
