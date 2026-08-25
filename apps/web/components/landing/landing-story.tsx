"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COPY, type Block } from "@/lib/copy-deck";
import { LandingModel } from "./landing-model";

/**
 * Capítulos do hero. Todo texto vem de `lib/copy-deck.ts` — nenhuma frase é
 * escrita aqui.
 *
 * A home é a LOJA (ver o comentário em `app/page.tsx`). Custódia e confirmação
 * dupla saíram daqui: eram duas telas inteiras de prova antes de qualquer
 * produto aparecer. A prova continua no site, na tira de confiança abaixo da
 * vitrine e na central de confiança — no momento em que a pessoa já tem um
 * item na cabeça e a pergunta vira "posso confiar em pagar por isto?".
 *
 * `chaptersFor` mantém o componente reaproveitável: uma superfície que exista
 * para explicar a proteção pode pedir os três.
 *
 * O tipo é `readonly Block[]` de propósito: os blocos do deck têm campos
 * opcionais diferentes entre si, e a leitura uniforme de `cta`/`microcopy`
 * exige o tipo do contrato, não a união dos literais.
 */
const storeChapters: readonly Block[] = [COPY.landing.hero];

const fullChapters: readonly Block[] = [
  COPY.landing.hero,
  COPY.trust.custody,
  COPY.trust.dualConfirmation,
];

export function LandingStory({ variant = "store" }: { variant?: "store" | "full" } = {}) {
  const chapters = variant === "full" ? fullChapters : storeChapters;
  const [activeStep, setActiveStep] = useState(0);
  const [ready, setReady] = useState(false);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);

  /**
   * `data-ready` só existe depois da montagem no client. A de-ênfase do
   * capítulo inativo depende dele: sem JS nenhum capítulo é atenuado e os três
   * ficam em opacidade cheia, na ordem do DOM.
   */
  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    let animationFrame: number | undefined;
    const updateActiveChapter = () => {
      animationFrame = undefined;
      const viewportCenter = window.innerHeight / 2;
      const closest = chapterRefs.current
        .map((node, index) => ({ node, index, rect: node?.getBoundingClientRect() }))
        .filter((candidate): candidate is { node: HTMLElement; index: number; rect: DOMRect } =>
          Boolean(candidate.node && candidate.rect && candidate.rect.bottom > 0 && candidate.rect.top < window.innerHeight),
        )
        .sort((a, b) =>
          Math.abs((a.rect.top + a.rect.bottom) / 2 - viewportCenter)
          - Math.abs((b.rect.top + b.rect.bottom) / 2 - viewportCenter),
        ).at(0);
      if (closest) setActiveStep(closest.index);
    };
    const scheduleUpdate = () => {
      if (animationFrame !== undefined) return;
      animationFrame = window.requestAnimationFrame(updateActiveChapter);
    };
    const observer = new IntersectionObserver(scheduleUpdate, {
      threshold: [0.25, 0.5, 0.75],
      rootMargin: "-12% 0px -24%",
    });

    for (const node of chapterRefs.current) if (node) observer.observe(node);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <section
      id="experiencia"
      className="landing-story"
      data-ready={ready || undefined}
      aria-labelledby="landing-story-title"
    >
      <div className="landing-story__chapters">
        {chapters.map((chapter, index) => {
          const isHero = index === 0;
          return (
            <article
              key={chapter.kicker}
              ref={(node) => { chapterRefs.current[index] = node; }}
              data-chapter-index={index}
              data-active={activeStep === index || undefined}
              className={`landing-story__chapter ${isHero ? "landing-story__chapter--hero" : ""}`}
            >
              <span className="landing-kicker">{chapter.kicker}</span>
              {isHero ? (
                <h1 id="landing-story-title">{chapter.headline}</h1>
              ) : (
                <h2>{chapter.headline}</h2>
              )}
              <p className="landing-story__lead">{chapter.subhead}</p>
              {isHero ? null : <p className="landing-story__body">{chapter.body}</p>}
              {isHero ? (
                <div className="landing-story__actions">
                  <Link className="landing-button landing-button--ink" href="/market">
                    <span>{chapter.cta ?? COPY.landing.hero.cta}</span>
                    <span className="landing-button__icon" aria-hidden="true">↗</span>
                  </Link>
                  <Link className="landing-inline-link" href="/vender/cadastro">Quero vender <span aria-hidden="true">→</span></Link>
                </div>
              ) : null}
              {chapter.microcopy ? (
                <p className="landing-story__note">{chapter.microcopy}</p>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className="landing-story__stage">
        <LandingModel activeStep={activeStep} />
        {/* O contador so faz sentido quando ha mais de um capitulo. Na home,
            que usa um so, ele aparecia como "01 / 03" apontando para capitulos
            que nao existem mais ali. Numero que nao corresponde ao conteudo e
            pior que numero ausente. */}
        {chapters.length > 1 ? (
          <div className="landing-story__stage-index" aria-hidden="true">
            <span>0{activeStep + 1}</span>
            <i />
            <small>0{chapters.length}</small>
          </div>
        ) : null}
      </div>
    </section>
  );
}
