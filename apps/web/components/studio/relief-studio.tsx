"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Box,
  Image as ImageIcon,
  LockKeyhole,
  Rotate3d,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { BrandWordmark } from "@/components/brand-wordmark";
import {
  RELIEF_IMAGE_ACCEPT,
  ReliefFileError,
  validateReliefFile,
  type ReliefImageDetails,
} from "./relief-file";
import type { ReliefView, ReliefViewRequest } from "./relief-canvas";
import styles from "./relief-studio.module.css";

const ReliefCanvas = dynamic(() => import("./relief-canvas"), {
  ssr: false,
  loading: () => <div className={styles.canvasLoading} role="status">Preparando o Canvas 2,5D…</div>,
});

type PreviewImage = {
  readonly fileName: string;
  readonly sourceUrl: string;
  readonly details: ReliefImageDetails;
};

type CanvasStatus = "idle" | "loading" | "ready" | "error";

const DEFAULT_DEPTH = 0.09;

function canUseWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${String(bytes)} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1_048_576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function userMessage(error: unknown): string {
  if (error instanceof ReliefFileError) return error.message;
  return "A imagem não pôde ser preparada para o preview local.";
}

export function ReliefStudio() {
  const sourceUrlRef = useRef<string | null>(null);
  const validationSequence = useRef(0);
  const [preview, setPreview] = useState<PreviewImage | null>(null);
  const [validationStatus, setValidationStatus] = useState<"idle" | "validating" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);
  const [webGlAvailable, setWebGlAvailable] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [canvasStatus, setCanvasStatus] = useState<CanvasStatus>("idle");
  const [depth, setDepth] = useState(DEFAULT_DEPTH);
  const [viewRequest, setViewRequest] = useState<ReliefViewRequest>({ view: "front", sequence: 0 });

  const releaseSourceUrl = useCallback(() => {
    if (!sourceUrlRef.current) return;
    URL.revokeObjectURL(sourceUrlRef.current);
    sourceUrlRef.current = null;
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => { setReducedMotion(media.matches); };
    syncMotion();
    media.addEventListener("change", syncMotion);
    setWebGlAvailable(canUseWebGl());
    return () => { media.removeEventListener("change", syncMotion); };
  }, []);

  useEffect(() => {
    return () => {
      validationSequence.current += 1;
      releaseSourceUrl();
    };
  }, [releaseSourceUrl]);

  const chooseView = useCallback((view: ReliefView) => {
    setViewRequest((current) => ({ view, sequence: current.sequence + 1 }));
  }, []);

  const resetPreview = useCallback(() => {
    setDepth(DEFAULT_DEPTH);
    chooseView("front");
  }, [chooseView]);

  const markCanvasReady = useCallback(() => { setCanvasStatus("ready"); }, []);
  const markCanvasError = useCallback(() => { setCanvasStatus("error"); }, []);

  const selectImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const sequence = validationSequence.current + 1;
    validationSequence.current = sequence;
    setValidationStatus("validating");
    setError(null);

    try {
      const details = await validateReliefFile(file);
      if (validationSequence.current !== sequence) return;
      const sourceUrl = URL.createObjectURL(file);
      releaseSourceUrl();
      sourceUrlRef.current = sourceUrl;
      setPreview({ fileName: file.name, sourceUrl, details });
      setDepth(DEFAULT_DEPTH);
      setCanvasStatus("loading");
      chooseView("front");
      setValidationStatus("ready");
    } catch (nextError) {
      if (validationSequence.current !== sequence) return;
      setValidationStatus(preview ? "ready" : "idle");
      setError(userMessage(nextError));
    }
  };

  const showCanvas = Boolean(preview && webGlAvailable && canvasStatus !== "error");
  const reliefPercent = Math.round((depth / 0.18) * 100);

  return (
    <main className={styles.page} id="conteudo-principal">
      <header className={styles.topbar}>
        <BrandWordmark />
        <nav aria-label="Navegação do Studio" className={styles.nav}>
          <Link href="/market">Marketplace</Link>
          <Link href="/vender">Área do vendedor</Link>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="relief-studio-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>STUDIO EXPERIMENTAL · PROCESSAMENTO LOCAL</span>
          <h1 id="relief-studio-title">Da arte plana<br /><em>ao relevo.</em></h1>
          <p>
            Confira volume, brilho e leitura da skin antes de preparar um asset real.
            A imagem nunca sai deste navegador nesta ferramenta.
          </p>
        </div>
        <div className={styles.heroTags} aria-label="Características do preview">
          <span>PNG · JPEG · WEBP</span>
          <span>UM CANVAS</span>
          <span>SEM UPLOAD</span>
        </div>
      </section>

      <aside className={styles.truthNotice} aria-label="Limite técnico do preview">
        <ShieldCheck aria-hidden="true" size={22} />
        <div>
          <strong>Relevo 2,5D local — não é reconstrução 3D.</strong>
          <p>
            A luminosidade da imagem desloca uma única superfície. Profundidade, laterais e faces ocultas
            não são descobertas, inventadas nem publicadas como modelo do item.
          </p>
        </div>
      </aside>

      <section className={styles.workspace} aria-label="Laboratório de relevo 2,5D">
        <div className={styles.inputColumn}>
          <article className={styles.glassPanel}>
            <div className={styles.panelHeading}>
              <span className={styles.step}>01</span>
              <div>
                <h2>Escolha a fonte 2D</h2>
                <p>O arquivo é validado e decodificado apenas no dispositivo.</p>
              </div>
            </div>

            <label className={styles.dropzone}>
              <input
                accept={RELIEF_IMAGE_ACCEPT}
                className={styles.fileInput}
                onChange={(event) => { void selectImage(event); }}
                type="file"
              />
              <Upload aria-hidden="true" size={28} />
              <strong>{validationStatus === "validating" ? "Validando imagem…" : "Selecionar imagem"}</strong>
              <span>PNG, JPEG ou WebP estático · até 8 MB · até 4096 px por lado</span>
            </label>

            <div aria-live="polite" className={styles.feedbackRegion}>
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              {preview && validationStatus === "ready" ? (
                <p className={styles.success} role="status">
                  <ShieldCheck aria-hidden="true" size={16} /> Arquivo válido e mantido localmente.
                </p>
              ) : null}
            </div>

            {preview ? (
              <dl className={styles.fileFacts}>
                <div><dt>Arquivo</dt><dd>{preview.fileName}</dd></div>
                <div><dt>Formato</dt><dd>{preview.details.mimeType.replace("image/", "").toUpperCase()}</dd></div>
                <div><dt>Dimensão</dt><dd>{preview.details.width} × {preview.details.height} px</dd></div>
                <div><dt>Tamanho</dt><dd>{formatBytes(preview.details.bytes)}</dd></div>
              </dl>
            ) : null}
          </article>

          <article className={`${styles.glassPanel} ${styles.controlsPanel}`}>
            <div className={styles.panelHeading}>
              <span className={styles.step}>02</span>
              <div>
                <h2>Ajuste a leitura</h2>
                <p>Os controles mudam apenas esta simulação temporária.</p>
              </div>
            </div>

            <label className={styles.rangeField}>
              <span><strong>Intensidade do relevo</strong><output>{reliefPercent}%</output></span>
              <input
                aria-label="Intensidade do relevo"
                disabled={!preview || !showCanvas}
                max="0.18"
                min="0"
                onChange={(event) => { setDepth(Number(event.target.value)); }}
                step="0.01"
                type="range"
                value={depth}
              />
            </label>

            <div className={styles.viewControls} role="group" aria-label="Vistas do relevo">
              <button disabled={!preview || !showCanvas} onClick={() => { chooseView("front"); }} type="button">Frente</button>
              <button disabled={!preview || !showCanvas} onClick={() => { chooseView("angle"); }} type="button">Ângulo</button>
              <button disabled={!preview || !showCanvas} onClick={resetPreview} type="button">Redefinir</button>
            </div>

            <p className={styles.motionNote}>
              <Rotate3d aria-hidden="true" size={16} />
              {reducedMotion
                ? "Movimento reduzido ativo: sem amortecimento nem animação automática."
                : "Arraste para girar e use a roda ou pinça para aproximar. Sem autorrotação."}
            </p>
          </article>
        </div>

        <article className={`${styles.glassPanel} ${styles.previewPanel}`}>
          <div className={styles.previewHeading}>
            <div>
              <span className={styles.eyebrow}>COMPARAÇÃO LADO A LADO</span>
              <h2>Fonte e relevo 2,5D</h2>
            </div>
            <span className={styles.localBadge}><LockKeyhole aria-hidden="true" size={14} /> LOCAL</span>
          </div>

          {preview ? (
            <div className={styles.compareGrid}>
              <figure className={styles.sourceFrame}>
                <div className={styles.mediaStage}>
                  <img alt={`Fonte 2D local: ${preview.fileName}`} src={preview.sourceUrl} />
                </div>
                <figcaption><ImageIcon aria-hidden="true" size={15} /> Fonte 2D original</figcaption>
              </figure>

              <figure className={styles.reliefFrame}>
                <div className={styles.canvasShell} data-canvas-status={canvasStatus}>
                  {showCanvas ? (
                    <ReliefCanvas
                      depth={depth}
                      imageHeight={preview.details.height}
                      imageWidth={preview.details.width}
                      onError={markCanvasError}
                      onReady={markCanvasReady}
                      reducedMotion={reducedMotion}
                      sourceUrl={preview.sourceUrl}
                      viewRequest={viewRequest}
                    />
                  ) : (
                    <div className={styles.twoDimensionalFallback}>
                      <img alt="Fallback 2D da imagem selecionada" src={preview.sourceUrl} />
                      <span>
                        {webGlAvailable === null
                          ? "Verificando WebGL…"
                          : "WebGL indisponível. Mantendo a fonte em 2D."}
                      </span>
                    </div>
                  )}
                  <span className={styles.canvasStatus} aria-live="polite">
                    {canvasStatus === "ready" && showCanvas ? "2,5D pronto" : showCanvas ? "Preparando relevo" : "Fallback 2D"}
                  </span>
                </div>
                <figcaption><Box aria-hidden="true" size={15} /> Relevo inferido pela luminosidade</figcaption>
              </figure>
            </div>
          ) : (
            <div className={styles.emptyPreview}>
              <Box aria-hidden="true" size={56} strokeWidth={1.2} />
              <strong>Selecione uma imagem para comparar</strong>
              <p>Nenhum asset demonstrativo ou modelo falso ocupa este espaço.</p>
            </div>
          )}

          <footer className={styles.previewFooter}>
            <span><LockKeyhole aria-hidden="true" size={15} /> Não enviado ao backend</span>
            <span><ShieldCheck aria-hidden="true" size={15} /> Não publicado no catálogo</span>
          </footer>
        </article>
      </section>

      <footer className={styles.pageFooter}>
        <p>Para um modelo 3D real, o Studio precisa de múltiplas vistas ou GLB, validação técnica e revisão humana.</p>
        <Link href="/admin/catalogo">Abrir biblioteca do catálogo →</Link>
      </footer>
    </main>
  );
}
