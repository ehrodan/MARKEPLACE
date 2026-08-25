"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";

/**
 * Primitivas de profundidade e scroll 3D do design system Midas Foundry.
 *
 * Dependência ZERO (substitui React Bits, bloqueado em
 * `docs/coordenacao/REACT-BITS-ALLOWLIST.md`): só CSS transform/perspective,
 * IntersectionObserver e pointer events. Sem canvas, sem WebGL, sem lib.
 *
 * Contrato de segurança visual (docs 18 §9 e 10):
 * - **Sem JS o conteúdo aparece inteiro e na ordem do DOM.** O estado inicial
 *   escondido só existe depois que o JS aplica a classe `is-ready`; SSR e
 *   no-JS renderizam `data-reveal-state="shown"`.
 * - `prefers-reduced-motion: reduce` desliga transform/transition/animation.
 * - Ponteiro grosso (touch) não recebe tilt, brilho nem ímã.
 * - Nada intercepta scroll (listeners `passive`), rouba foco ou altera nome
 *   acessível. Nada anima preço, CTA financeiro, escassez ou urgência.
 * - Todo RAF/observer/listener é cancelado no unmount.
 *
 * Reuso: o reveal declarativo por atributo (`[data-reveal]`) de
 * `apps/web/lib/scroll-reveal.ts` continua válido para markup sem React; aqui
 * a mesma ideia vira componente, com atributo próprio (`data-reveal-state`)
 * para não disputar o mesmo seletor.
 */

const READY_CLASS = "is-ready";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const COARSE_POINTER_QUERY = "(pointer: coarse)";

/** Teto rígido do ímã: o alvo de clique nunca sai da área do próprio elemento. */
const MAGNETIC_MAX_PX = 6;
/** Amplitude máxima do parallax em px, compartilhada por CSS e fallback JS. */
const PARALLAX_RANGE_PX = 48;

type CssVars = Record<`--${string}`, string>;
type StyleWithVars = CSSProperties & CssVars;

function joinClassNames(...values: ReadonlyArray<string | false | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function queryMedia(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  try {
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

function matchesMedia(query: string): boolean {
  const list = queryMedia(query);
  return list !== null && list.matches;
}

function hasIntersectionObserver(): boolean {
  return typeof window !== "undefined" && typeof IntersectionObserver !== "undefined";
}

/**
 * Reavalia uma media query e re-executa os efeitos quando o usuário troca a
 * preferência em runtime. O valor é lido de novo dentro do efeito (evita
 * closure obsoleta e o flash de um primeiro passe com valor errado).
 */
function useMediaFlag(query: string): boolean {
  const [flag, setFlag] = useState(false);

  useEffect(() => {
    const list = queryMedia(query);
    if (!list) return;
    setFlag(list.matches);
    if (typeof list.addEventListener !== "function") return;
    const onChange = (event: MediaQueryListEvent): void => {
      setFlag(event.matches);
    };
    list.addEventListener("change", onChange);
    return () => {
      list.removeEventListener("change", onChange);
    };
  }, [query]);

  return flag;
}

/** Agenda no máximo uma escrita de estilo por frame e cancela no unmount. */
function useFrameScheduler(): { schedule: (task: () => void) => void; cancel: () => void } {
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef(false);
  const taskRef = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    if (frameRef.current !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
    pendingRef.current = false;
    taskRef.current = null;
  }, []);

  const schedule = useCallback((task: () => void) => {
    if (typeof requestAnimationFrame !== "function") {
      task();
      return;
    }
    taskRef.current = task;
    if (pendingRef.current) return;
    pendingRef.current = true;
    frameRef.current = requestAnimationFrame(() => {
      pendingRef.current = false;
      frameRef.current = null;
      const pending = taskRef.current;
      taskRef.current = null;
      if (pending) pending();
    });
  }, []);

  useEffect(() => cancel, [cancel]);

  return { schedule, cancel };
}

/* ------------------------------------------------------------------ */
/* Reveal                                                              */
/* ------------------------------------------------------------------ */

export type RevealElement = "div" | "section" | "article" | "aside" | "li" | "span";

export interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: RevealElement;
  /** Atraso da entrada em ms (0–2000). */
  delay?: number;
  /** Fração visível que dispara a entrada (0–1). */
  threshold?: number;
  children: ReactNode;
}

/**
 * Entrada única por IntersectionObserver: opacity + translateY + leve rotateX.
 * Não repete (`unobserve` no primeiro cruzamento). Sem IO ou com reduced
 * motion, o conteúdo permanece visível desde o primeiro paint.
 */
export function Reveal({
  as: Element = "div",
  delay = 0,
  threshold = 0.16,
  className,
  style,
  children,
  ...rest
}: RevealProps) {
  const nodeRef = useRef<HTMLElement | null>(null);
  const setNode = useCallback((node: HTMLElement | null): void => {
    nodeRef.current = node;
  }, []);
  const reduced = useMediaFlag(REDUCED_MOTION_QUERY);
  const safeThreshold = clamp(threshold, 0, 1);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    // Só escondemos quando existe caminho garantido de volta ao visível.
    if (matchesMedia(REDUCED_MOTION_QUERY) || !hasIntersectionObserver()) {
      node.classList.remove(READY_CLASS);
      node.dataset.revealState = "shown";
      return;
    }

    node.classList.add(READY_CLASS);
    node.dataset.revealState = "hidden";
    // Recálculo forçado: a transição parte do estado escondido.
    void node.offsetWidth;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target;
          if (target instanceof HTMLElement) target.dataset.revealState = "shown";
          observer.unobserve(entry.target);
        }
      },
      { threshold: safeThreshold, rootMargin: "0px 0px -6%" },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [reduced, safeThreshold]);

  const mergedStyle: StyleWithVars = {
    ...style,
    "--och-3d-reveal-delay": `${String(clamp(delay, 0, 2000))}ms`,
  };

  return (
    <Element
      ref={setNode}
      className={joinClassNames("ui-reveal", className)}
      style={mergedStyle}
      data-reveal-state="shown"
      {...rest}
    >
      {children}
    </Element>
  );
}

/* ------------------------------------------------------------------ */
/* Tilt3D                                                              */
/* ------------------------------------------------------------------ */

export interface Tilt3DProps extends HTMLAttributes<HTMLDivElement> {
  /** Inclinação máxima em graus (0–14). */
  max?: number;
  /** Brilho especular decorativo que acompanha o ponteiro. */
  glare?: boolean;
  children: ReactNode;
}

function resetPointerVars(node: HTMLElement): void {
  delete node.dataset.tiltActive;
  node.style.removeProperty("--tilt-x");
  node.style.removeProperty("--tilt-y");
  node.style.removeProperty("--shine-x");
  node.style.removeProperty("--shine-y");
}

/**
 * Tilt 3D por pointermove, escrito em `--tilt-x`/`--tilt-y` dentro de um
 * requestAnimationFrame (uma escrita por frame). Volta à pose neutra em
 * pointerleave/pointercancel. Desligado em ponteiro grosso e reduced motion.
 */
export function Tilt3D({ max = 8, glare = false, className, children, ...rest }: Tilt3DProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduced = useMediaFlag(REDUCED_MOTION_QUERY);
  const coarse = useMediaFlag(COARSE_POINTER_QUERY);
  const { schedule, cancel } = useFrameScheduler();
  const maxDeg = clamp(max, 0, 14);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    if (matchesMedia(REDUCED_MOTION_QUERY) || matchesMedia(COARSE_POINTER_QUERY)) {
      node.classList.remove(READY_CLASS);
      resetPointerVars(node);
      return;
    }

    node.classList.add(READY_CLASS);

    const handleMove = (event: PointerEvent): void => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const ratioX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const ratioY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      schedule(() => {
        node.dataset.tiltActive = "true";
        node.style.setProperty("--tilt-x", `${((0.5 - ratioY) * 2 * maxDeg).toFixed(2)}deg`);
        node.style.setProperty("--tilt-y", `${((ratioX - 0.5) * 2 * maxDeg).toFixed(2)}deg`);
        node.style.setProperty("--shine-x", `${(ratioX * 100).toFixed(2)}%`);
        node.style.setProperty("--shine-y", `${(ratioY * 100).toFixed(2)}%`);
      });
    };

    const handleRest = (): void => {
      cancel();
      resetPointerVars(node);
    };

    node.addEventListener("pointermove", handleMove, { passive: true });
    node.addEventListener("pointerleave", handleRest);
    node.addEventListener("pointercancel", handleRest);

    return () => {
      node.removeEventListener("pointermove", handleMove);
      node.removeEventListener("pointerleave", handleRest);
      node.removeEventListener("pointercancel", handleRest);
      cancel();
      node.classList.remove(READY_CLASS);
      resetPointerVars(node);
    };
  }, [reduced, coarse, maxDeg, schedule, cancel]);

  return (
    <div ref={rootRef} className={joinClassNames("ui-tilt3d", className)} {...rest}>
      <div className="ui-tilt3d__inner">
        {children}
        {glare ? <span className="ui-tilt3d__glare" aria-hidden="true" /> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ParallaxLayer                                                       */
/* ------------------------------------------------------------------ */

export interface ParallaxLayerProps extends HTMLAttributes<HTMLDivElement> {
  /** Velocidade relativa ao scroll (-1 a 1). */
  speed?: number;
  children: ReactNode;
}

/**
 * Deslocamento vertical proporcional ao scroll via IntersectionObserver + rAF
 * com listener `passive`. O observer limita o trabalho ao tempo em que a
 * camada está perto da viewport; reduced motion remove toda transformação.
 */
export function ParallaxLayer({
  speed = 0.2,
  className,
  style,
  children,
  ...rest
}: ParallaxLayerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduced = useMediaFlag(REDUCED_MOTION_QUERY);
  const { schedule, cancel } = useFrameScheduler();
  const safeSpeed = clamp(speed, -1, 1);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    if (matchesMedia(REDUCED_MOTION_QUERY)) {
      node.classList.remove(READY_CLASS);
      node.style.removeProperty("--parallax-offset");
      return;
    }

    node.classList.add(READY_CLASS);

    if (!hasIntersectionObserver()) {
      return () => {
        node.classList.remove(READY_CLASS);
      };
    }

    let visible = false;

    const update = (): void => {
      const viewport = window.innerHeight;
      if (!viewport) return;
      const rect = node.getBoundingClientRect();
      // -0.5 (abaixo da dobra) .. 0.5 (acima da dobra)
      const progress = clamp((viewport - rect.top) / (viewport + rect.height) - 0.5, -0.5, 0.5);
      const offset = -progress * 2 * safeSpeed * PARALLAX_RANGE_PX;
      node.style.setProperty("--parallax-offset", `${offset.toFixed(2)}px`);
    };

    const onScroll = (): void => {
      if (visible) schedule(update);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible = entry.isIntersecting;
        if (visible) schedule(update);
      },
      { rootMargin: "20% 0px" },
    );

    observer.observe(node);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancel();
      node.classList.remove(READY_CLASS);
      node.style.removeProperty("--parallax-offset");
    };
  }, [reduced, safeSpeed, schedule, cancel]);

  const mergedStyle: StyleWithVars = {
    ...style,
  };

  return (
    <div
      ref={rootRef}
      className={joinClassNames("ui-parallax", className)}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DepthStack                                                          */
/* ------------------------------------------------------------------ */

export type DepthStackElement = "div" | "section" | "article" | "aside";

export interface DepthStackProps extends HTMLAttributes<HTMLElement> {
  as?: DepthStackElement;
  /** Distância da câmera em px (400–2400). */
  perspective?: number;
  children: ReactNode;
}

/**
 * Container que estabelece `perspective` + `transform-style: preserve-3d`.
 * Filhos empilham em Z por `data-depth="-1|0|1|2|3"` — estático, sem JS.
 */
export function DepthStack({
  as: Element = "div",
  perspective = 900,
  className,
  style,
  children,
  ...rest
}: DepthStackProps) {
  const mergedStyle: StyleWithVars = {
    ...style,
    "--och-3d-perspective": `${String(clamp(perspective, 400, 2400))}px`,
  };

  return (
    <Element
      className={joinClassNames("ui-depth-stack", className)}
      style={mergedStyle}
      {...rest}
    >
      {children}
    </Element>
  );
}

/* ------------------------------------------------------------------ */
/* ShineCard                                                           */
/* ------------------------------------------------------------------ */

export interface ShineCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * Brilho especular que segue o ponteiro via `--shine-x`/`--shine-y`.
 * O elemento de brilho é puramente decorativo: `aria-hidden` e sem eventos.
 */
export function ShineCard({ className, children, ...rest }: ShineCardProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduced = useMediaFlag(REDUCED_MOTION_QUERY);
  const coarse = useMediaFlag(COARSE_POINTER_QUERY);
  const { schedule, cancel } = useFrameScheduler();

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    if (matchesMedia(REDUCED_MOTION_QUERY) || matchesMedia(COARSE_POINTER_QUERY)) {
      node.classList.remove(READY_CLASS);
      resetPointerVars(node);
      return;
    }

    node.classList.add(READY_CLASS);

    const handleMove = (event: PointerEvent): void => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const ratioX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const ratioY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      schedule(() => {
        node.dataset.shineActive = "true";
        node.style.setProperty("--shine-x", `${(ratioX * 100).toFixed(2)}%`);
        node.style.setProperty("--shine-y", `${(ratioY * 100).toFixed(2)}%`);
      });
    };

    const handleRest = (): void => {
      cancel();
      delete node.dataset.shineActive;
      node.style.removeProperty("--shine-x");
      node.style.removeProperty("--shine-y");
    };

    node.addEventListener("pointermove", handleMove, { passive: true });
    node.addEventListener("pointerleave", handleRest);
    node.addEventListener("pointercancel", handleRest);

    return () => {
      node.removeEventListener("pointermove", handleMove);
      node.removeEventListener("pointerleave", handleRest);
      node.removeEventListener("pointercancel", handleRest);
      cancel();
      node.classList.remove(READY_CLASS);
      resetPointerVars(node);
    };
  }, [reduced, coarse, schedule, cancel]);

  return (
    <div ref={rootRef} className={joinClassNames("ui-shine-card", className)} {...rest}>
      {children}
      <span className="ui-shine-card__shine" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MagneticCta                                                         */
/* ------------------------------------------------------------------ */

export interface MagneticCtaProps extends HTMLAttributes<HTMLDivElement> {
  /** Raio de atração em px (24–240). */
  radius?: number;
  /** Deslocamento máximo em px; teto rígido de 6px. */
  strength?: number;
  children: ReactNode;
}

/**
 * Atrai levemente o filho em direção ao ponteiro dentro de um raio.
 * O deslocamento é limitado a 6px, então o alvo de clique nunca sai da área
 * do próprio elemento. Desligado em reduced motion e ponteiro grosso.
 */
export function MagneticCta({
  radius = 80,
  strength = MAGNETIC_MAX_PX,
  className,
  children,
  ...rest
}: MagneticCtaProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduced = useMediaFlag(REDUCED_MOTION_QUERY);
  const coarse = useMediaFlag(COARSE_POINTER_QUERY);
  const { schedule, cancel } = useFrameScheduler();
  const radiusPx = clamp(radius, 24, 240);
  const strengthPx = clamp(strength, 0, MAGNETIC_MAX_PX);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    if (matchesMedia(REDUCED_MOTION_QUERY) || matchesMedia(COARSE_POINTER_QUERY)) {
      node.classList.remove(READY_CLASS);
      node.style.removeProperty("--magnet-x");
      node.style.removeProperty("--magnet-y");
      return;
    }

    node.classList.add(READY_CLASS);

    const reset = (): void => {
      node.style.setProperty("--magnet-x", "0px");
      node.style.setProperty("--magnet-y", "0px");
    };

    const handleMove = (event: PointerEvent): void => {
      const rect = node.getBoundingClientRect();
      const deltaX = event.clientX - (rect.left + rect.width / 2);
      const deltaY = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(deltaX, deltaY);
      schedule(() => {
        if (distance === 0 || distance > radiusPx) {
          reset();
          return;
        }
        const pull = (1 - distance / radiusPx) * strengthPx;
        node.style.setProperty("--magnet-x", `${((deltaX / distance) * pull).toFixed(2)}px`);
        node.style.setProperty("--magnet-y", `${((deltaY / distance) * pull).toFixed(2)}px`);
      });
    };

    let attached = false;
    const attach = (): void => {
      if (attached) return;
      window.addEventListener("pointermove", handleMove, { passive: true });
      attached = true;
    };
    const detach = (): void => {
      if (!attached) return;
      window.removeEventListener("pointermove", handleMove);
      attached = false;
      cancel();
      reset();
    };

    let observer: IntersectionObserver | null = null;
    if (hasIntersectionObserver()) {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) attach();
          else detach();
        }
      });
      observer.observe(node);
    } else {
      attach();
    }

    return () => {
      observer?.disconnect();
      detach();
      cancel();
      node.classList.remove(READY_CLASS);
      node.style.removeProperty("--magnet-x");
      node.style.removeProperty("--magnet-y");
    };
  }, [reduced, coarse, radiusPx, strengthPx, schedule, cancel]);

  return (
    <div ref={rootRef} className={joinClassNames("ui-magnetic", className)} {...rest}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ScrollProgress                                                      */
/* ------------------------------------------------------------------ */

export interface ScrollProgressProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "role"> {
  /** Nome acessível da barra. */
  label?: string;
}

/**
 * Barra fina de progresso de leitura da página.
 * Sem JS não existe progresso real, então nada é renderizado (nenhum número
 * inventado). Não intercepta scroll (`pointer-events: none`, listener
 * `passive`) e não usa `aria-live` — leitor de tela consulta o valor sob
 * demanda em vez de receber anúncio a cada pixel rolado.
 */
export function ScrollProgress({
  label = "Progresso de leitura da página",
  className,
  style,
  ...rest
}: ScrollProgressProps) {
  const [ready, setReady] = useState(false);
  const [percent, setPercent] = useState(0);
  const { schedule, cancel } = useFrameScheduler();

  useEffect(() => {
    setReady(true);

    const read = (): void => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const next = scrollable > 0 ? clamp((window.scrollY / scrollable) * 100, 0, 100) : 0;
      setPercent((current) => (Math.round(current) === Math.round(next) ? current : next));
    };

    const onScroll = (): void => {
      schedule(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancel();
    };
  }, [schedule, cancel]);

  if (!ready) return null;

  const value = Math.round(percent);
  const mergedStyle: StyleWithVars = {
    ...style,
    "--scroll-progress": `${String(value)}%`,
  };

  return (
    <div
      {...rest}
      className={joinClassNames("ui-scroll-progress", className)}
      style={mergedStyle}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={`${String(value)}%`}
    >
      <span className="ui-scroll-progress__fill" aria-hidden="true" />
    </div>
  );
}
