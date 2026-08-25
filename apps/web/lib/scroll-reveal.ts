import { useEffect, type RefObject } from "react";

/**
 * Motion com propósito (doc 18 §9 + gate do doc 10):
 * - reveal finito, `once`, sem repetir em loop;
 * - `prefers-reduced-motion` = conteúdo imediato;
 * - GSAP dinâmico só no client, com cleanup (`kill`);
 * - fluxo crítico funciona sem JS e sem motion.
 */

export const REVEAL_SELECTOR = "[data-reveal]";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Liga o reveal de `[data-reveal]` via IntersectionObserver.
 * Sem IO ou com reduced motion: tudo visível na hora.
 * Retorna a função de cleanup (disconnect).
 */
export function initScrollReveal(root: ParentNode = document): () => void {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
  if (nodes.length === 0) return () => {};

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    for (const node of nodes) node.dataset.visible = "true";
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.visible = "true";
        observer.unobserve(entry.target); // once: true
      }
    },
    { threshold: 0.16, rootMargin: "0px 0px -8%" },
  );

  for (const node of nodes) observer.observe(node);
  return () => {
    observer.disconnect();
  };
}

export function useScrollReveal(): void {
  useEffect(() => {
    return initScrollReveal();
  }, []);
}

/**
 * Entrada da hero com GSAP ScrollTrigger (única timeline GSAP da landing).
 * Elementos marcados com `[data-hero-intro]` entram em stagger, 650ms,
 * ease-out; o gatilho dispara uma única vez. Sem disputa com o canvas 3D:
 * o palco usa `data-reveal` comum, não este timeline.
 */
export function useHeroIntro(scope: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = scope.current;
    if (!el) return;

    const targets = Array.from(el.querySelectorAll<HTMLElement>("[data-hero-intro]"));
    if (targets.length === 0 || prefersReducedMotion()) return;

    // CSS gate síncrono: esconde antes do import resolver (sem flash duplo).
    el.dataset.heroMotion = "pending";

    let cancelled = false;
    let kill: (() => void) | undefined;

    const revealNow = () => {
      delete el.dataset.heroMotion;
      for (const target of targets) {
        target.style.opacity = "";
        target.style.visibility = "";
        target.style.transform = "";
      }
    };

    void import("gsap")
      .then(async ({ gsap }) => {
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        gsap.registerPlugin(ScrollTrigger);
        if (cancelled) return;

        gsap.set(targets, { autoAlpha: 0, y: 28 });
        el.dataset.heroMotion = "ready";

        const tween = gsap.to(targets, {
          autoAlpha: 1,
          y: 0,
          duration: 0.65,
          ease: "power3.out",
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        });

        kill = () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      })
      .catch(() => {
        if (!cancelled) revealNow();
      });

    return () => {
      cancelled = true;
      kill?.();
      revealNow();
    };
  }, [scope]);
}
