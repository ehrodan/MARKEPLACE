"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { BRAND } from "@/lib/brand";

const HeroModelCanvas = dynamic(() => import("./hero-model-canvas"), {
  ssr: false,
  loading: () => <ModelPoster label="Preparando representação 3D" />,
});

function ModelPoster({ label = "Representação 2D do símbolo OCHPOCH" }: { label?: string }) {
  return (
    <div className="landing-model__poster" role="img" aria-label={label}>
      <Image src={BRAND.assets.posterAngle} alt="" fill sizes="(max-width: 768px) 100vw, 52vw" priority />
    </div>
  );
}

class ModelErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError();
  }
  render() {
    return this.state.failed ? <ModelPoster label="Representação 2D usada porque o modelo 3D não pôde ser carregado" /> : this.props.children;
  }
}

function canUseWebGl() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function LandingModel({ activeStep }: { activeStep: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [webGlAvailable, setWebGlAvailable] = useState(false);
  const [modelStatus, setModelStatus] = useState<"loading" | "ready" | "error">("loading");
  const markModelReady = useCallback(() => { setModelStatus("ready"); }, []);
  const markModelError = useCallback(() => { setModelStatus("error"); }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReducedMotion(media.matches); };
    update();
    media.addEventListener("change", update);
    setWebGlAvailable(canUseWebGl());
    return () => { media.removeEventListener("change", update); };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setNearViewport(true);
    }, { rootMargin: "240px 0px" });
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, []);

  const showCanvas = nearViewport && webGlAvailable && !reducedMotion;
  const renderedModelStatus = showCanvas ? modelStatus : "fallback";
  const caption = !showCanvas || modelStatus === "error"
    ? "Fallback 2D"
    : modelStatus === "ready"
      ? "Modelo 3D fornecido"
      : "Carregando modelo 3D";

  return (
    <div
      ref={containerRef}
      className="landing-model"
      data-active-step={activeStep}
      data-model-status={renderedModelStatus}
    >
      <ModelErrorBoundary onError={markModelError}>
        {showCanvas ? (
          <HeroModelCanvas
            activeStep={activeStep}
            active={visible}
            reducedMotion={reducedMotion}
            onModelReady={markModelReady}
          />
        ) : <ModelPoster />}
      </ModelErrorBoundary>
      <div className="landing-model__caption">
        <span>{caption}</span>
        <small>{reducedMotion ? "Movimento reduzido respeitado" : "Arraste para girar · role para acompanhar"}</small>
      </div>
    </div>
  );
}
