"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { AnimatedHeading, ShimmerCta } from "./animated-heading";
import { phase, trackProgress } from "./scroll-progress";
import styles from "./store-overture.module.css";

const OvertureCanvas = dynamic(() => import("./overture-canvas"), { ssr: false });

/**
 * Abertura da loja — SCR-PUB-001, perfil de motion M2 (`docs/07 §1.4`).
 *
 * A peça da marca gira, flutua e recua enquanto a pessoa rola; a vitrine entra
 * por baixo dela. É uma dobra só: passada a abertura, o que resta na tela é
 * produto com preço.
 *
 * Por que existe, em vez de ir direto ao grid: quem chega neste marketplace
 * está avaliando se pode confiar dinheiro a um desconhecido. A abertura usa os
 * três segundos em que a decisão de ficar é tomada para mostrar o material da
 * marca e as duas garantias que sustentam a compra — e sai do caminho.
 *
 * O que ela deliberadamente NÃO faz:
 * - não sequestra nem desacelera o scroll (`docs/03 §9`); o trilho é altura
 *   normal de documento e a peça responde ao scroll nativo;
 * - não cria urgência — sem contador, sem "restam N", sem preço riscado que
 *   nunca foi praticado (`docs/03 §10`);
 * - não esconde o catálogo atrás de si: o grid está no DOM logo abaixo, e sem
 *   JS a abertura vira um bloco estático legível com o mesmo link.
 */

/** A peça sai de cena na primeira metade; a vitrine entra na segunda. */
const PIECE_EXIT_END = 0.55;

export function StoreOverture({ children }: { children?: ReactNode }) {
  const trackRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [webGl, setWebGl] = useState(false);
  const [visible, setVisible] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);
  const markReady = useCallback(() => { setCanvasReady(true); }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setReducedMotion(media.matches); };
    sync();
    media.addEventListener("change", sync);
    try {
      const probe = document.createElement("canvas");
      setWebGl(Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl")));
    } catch {
      setWebGl(false);
    }
    return () => { media.removeEventListener("change", sync); };
  }, []);

  useEffect(() => {
    const node = trackRef.current;
    if (!node || reducedMotion) return;

    const read = () => {
      frameRef.current = null;
      const rect = node.getBoundingClientRect();
      setProgress(trackProgress(rect.top, rect.height, window.innerHeight));
    };
    const onScroll = () => {
      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(read);
    };

    const observer = new IntersectionObserver(
      (entries) => { for (const entry of entries) setVisible(entry.isIntersecting); },
      { rootMargin: "10% 0px" },
    );
    observer.observe(node);
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [reducedMotion]);

  const pieceOut = phase(progress, 0, PIECE_EXIT_END);
  const wordsOut = phase(progress, 0.12, 0.5);
  const showCanvas = webGl && !reducedMotion;

  return (
    <section
      ref={trackRef}
      className={styles.track}
      data-motion={reducedMotion ? "reduced" : "full"}
      aria-labelledby="store-overture-title"
      style={{
        // Uma variável por papel; o CSS decide o que cada uma move.
        ["--piece-out" as string]: pieceOut.toFixed(3),
        ["--words-out" as string]: wordsOut.toFixed(3),
      }}
    >
      <div className={styles.stage}>
        <div className={styles.piece} aria-hidden="true" data-ready={canvasReady ? "true" : "false"}>
          {showCanvas ? (
            <OvertureCanvas
              active={visible}
              animated={visible}
              onReady={markReady}
              recede={pieceOut}
              spin={progress}
            />
          ) : (
            <Image
              className={styles.poster}
              src={BRAND.assets.posterAngle}
              alt=""
              fill
              sizes="(max-width: 48rem) 80vw, 40vw"
              priority
            />
          )}
        </div>

        <div className={styles.words}>
          <AnimatedHeading
            highlight="antes"
            id="store-overture-title"
            text="Você confere o item antes de o dinheiro sair."
          />
          <p className={styles.lede}>
            Cada anúncio traz o vendedor, o estado da peça e o preço final. O valor fica
            retido até você e o vendedor confirmarem a entrega.
          </p>
          <div className={styles.actions}>
            <ShimmerCta href="#vitrine">Ver o que está à venda</ShimmerCta>
            <ShimmerCta href="/vender/novo" tone="ghost">
              Quero vender
            </ShimmerCta>
          </div>

          {/* As portas de entrada vivem DENTRO da primeira dobra, abaixo da
              proposta. Fora dela, empurravam o primeiro produto para 2,7 telas
              de scroll — numa loja, isso é o erro. Aqui a pessoa vê a marca, a
              garantia e por onde entrar sem rolar nada. */}
          {children ? <div className={styles.slot}>{children}</div> : null}
        </div>

        <p className={styles.cue} aria-hidden="true">
          role
        </p>
      </div>
    </section>
  );
}
