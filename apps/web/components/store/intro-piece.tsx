"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { trackProgress } from "./scroll-progress";
import styles from "./intro-piece.module.css";

const OvertureCanvas = dynamic(() => import("./overture-canvas"), { ssr: false });

/**
 * A peça da marca dentro da faixa de abertura da loja.
 *
 * Substitui a imagem estática que ocupava este lugar, mantendo exatamente o
 * mesmo espaço e o mesmo enquadramento — o layout da faixa não muda.
 *
 * A peça **gira conforme o scroll**, não sozinha. `docs/07 §1.4` proíbe que ela
 * "vire auto-rotação", e girar por relógio era exatamente isso. Aqui quem gira
 * é a mão de quem rola: parado o scroll, parada a peça, na pose neutra. É
 * manipulação direta, o mesmo princípio que o doc autoriza no viewer.
 *
 * Degrada em três níveis, e nenhum deles perde conteúdo — a peça é decorativa
 * (`aria-hidden` na faixa que a contém):
 *   1. com WebGL e movimento normal  → canvas que gira com o scroll;
 *   2. sem WebGL                     → o mesmo PNG de antes;
 *   3. `prefers-reduced-motion`      → o mesmo PNG, imóvel.
 */
export function IntroPiece() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [webGl, setWebGl] = useState(false);
  const [visible, setVisible] = useState(true);
  const markReady = useCallback(() => undefined, []);

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
    const node = hostRef.current;
    if (!node || reducedMotion) return;

    const read = () => {
      frameRef.current = null;
      // O curso é a própria faixa mais uma tela: a peça completa o giro
      // enquanto a vitrine sobe, e não depois que ela já passou.
      const rect = node.getBoundingClientRect();
      setProgress(trackProgress(rect.top, rect.height + window.innerHeight, window.innerHeight));
    };
    const onScroll = () => {
      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(read);
    };

    const observer = new IntersectionObserver(
      (entries) => { for (const entry of entries) setVisible(entry.isIntersecting); },
      { rootMargin: "15% 0px" },
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

  return (
    <div className={styles.host} ref={hostRef}>
      {webGl && !reducedMotion ? (
        <OvertureCanvas
          active={visible}
          animated={visible}
          onReady={markReady}
          // A peça não recua nesta faixa: ela não sai de cena, fica ao lado do
          // texto. O recuo pertence à abertura de tela cheia, que não é esta.
          recede={0}
          spin={progress}
        />
      ) : (
        <Image
          alt=""
          className={styles.poster}
          fill
          priority
          sizes="(max-width: 768px) 55vw, 32rem"
          src={BRAND.assets.posterAngle}
        />
      )}
    </div>
  );
}
