"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewerView } from "./model-viewer-canvas";
import { BRAND } from "@/lib/brand";

const ModelViewerCanvas = dynamic(() => import("./model-viewer-canvas"), {
  ssr: false,
  loading: () => <div className="viewer-loading" role="status">Preparando o objeto 3D.</div>,
});

type ModelStatus = "loading" | "ready" | "error";

function canUseWebGl() {
  return typeof WebGL2RenderingContext !== "undefined"
    || typeof WebGLRenderingContext !== "undefined";
}

export function ModelViewer() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ModelStatus>("loading");
  const [webGlAvailable, setWebGlAvailable] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [introInterrupted, setIntroInterrupted] = useState(false);
  const [viewRequest, setViewRequest] = useState<{ key: ViewerView; sequence: number }>({ key: "front", sequence: 0 });
  const [resetSequence, setResetSequence] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => { setReducedMotion(media.matches); };
    syncMotion();
    media.addEventListener("change", syncMotion);
    const available = canUseWebGl();
    setWebGlAvailable(available);
    if (!available) setStatus("error");
    return () => { media.removeEventListener("change", syncMotion); };
  }, []);

  useEffect(() => {
    const syncFullscreen = () => { setFullscreen(document.fullscreenElement === stageRef.current); };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => { document.removeEventListener("fullscreenchange", syncFullscreen); };
  }, []);

  const interruptIntro = useCallback(() => { setIntroInterrupted(true); }, []);
  const chooseView = (key: ViewerView) => {
    interruptIntro();
    setViewRequest((request) => ({ key, sequence: request.sequence + 1 }));
  };
  const resetView = () => {
    interruptIntro();
    setResetSequence((sequence) => sequence + 1);
  };
  const toggleFullscreen = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement === stage) await document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch {
      // O navegador pode negar tela cheia; os demais controles continuam disponíveis.
    }
  };

  const showFallback = webGlAvailable === false || status === "error";

  return (
    <section className="viewer-experience" aria-label="Visualizador 3D OCHPOCH MARKET">
      <div className="viewer-toolbar" aria-label="Controles de visualização">
        <div className="viewer-view-buttons" role="group" aria-label="Vistas predefinidas">
          <button aria-pressed={viewRequest.key === "front"} type="button" onClick={() => { chooseView("front"); }}>Frente</button>
          <button aria-pressed={viewRequest.key === "angle"} type="button" onClick={() => { chooseView("angle"); }}>Ângulo</button>
          <button aria-pressed={viewRequest.key === "side"} type="button" onClick={() => { chooseView("side"); }}>Lateral</button>
        </div>
        <div className="viewer-action-buttons">
          <button type="button" onClick={resetView}>Redefinir</button>
          <button aria-pressed={fullscreen} type="button" onClick={() => void toggleFullscreen()}>{fullscreen ? "Sair da tela cheia" : "Tela cheia"}</button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="viewer-stage"
        data-model-status={showFallback ? "error" : status}
        onPointerDownCapture={interruptIntro}
        onWheelCapture={interruptIntro}
        onTouchStartCapture={interruptIntro}
        onKeyDownCapture={interruptIntro}
        tabIndex={0}
      >
        {webGlAvailable ? (
          <ModelViewerCanvas
            introEnabled={!reducedMotion}
            introInterrupted={introInterrupted}
            viewRequest={viewRequest}
            resetSequence={resetSequence}
            onReady={() => { setStatus("ready"); }}
            onError={() => { setStatus("error"); }}
          />
        ) : null}

        {showFallback ? (
          <div className="viewer-fallback">
            <Image
              src={BRAND.assets.posterFront}
              alt="Vista frontal do símbolo OCHPOCH MARKET"
              fill
              sizes="100vw"
              priority
            />
            <div className="viewer-fallback__message">
              <strong>Visualização 2D disponível</strong>
              <span>O navegador não conseguiu abrir o modelo 3D.</span>
              <Link href={BRAND.assets.posterFront} target="_blank">Abrir imagem original ↗</Link>
            </div>
          </div>
        ) : null}

        <div className="viewer-stage__status" role="status" aria-live="polite">
          <span>{showFallback ? "2D" : status === "ready" ? "3D pronto" : "Carregando 3D"}</span>
          <small>{reducedMotion ? "Introdução sem movimento" : "Arraste para girar / role para aproximar"}</small>
        </div>
      </div>
    </section>
  );
}
