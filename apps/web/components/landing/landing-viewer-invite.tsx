import Image from "next/image";
import Link from "next/link";
import { Reveal, Tilt3D } from "@midas/ui";
import { BRAND } from "@/lib/brand";
import { COPY } from "@/lib/copy-deck";

/**
 * Convite à inspeção 3D — a prova tátil entre o ato 2 e o ato 3.
 *
 * O pôster da marca recebe `Tilt3D` (inclinação suave por ponteiro, teto de 6°,
 * com brilho especular). É aqui que o tilt entra, e não no palco do ato 1: o
 * palco é `position: sticky` e hospeda o canvas R3F com `OrbitControls`; um
 * ancestral em `transform-style: preserve-3d` compromete o sticky em parte dos
 * motores e o tilt por ponteiro disputaria o arrasto do próprio modelo. Aqui a
 * peça é uma imagem estática, sem controle concorrente.
 *
 * O rótulo da mídia diz "IMAGEM 2D" porque é isso que o arquivo é (um PNG do
 * pôster). Chamar de GLB seria rotular imagem como modelo — o deck é explícito:
 * "Onde existe apenas imagem, a tela chama de imagem."
 *
 * Sem JS, sem WebGL ou com `prefers-reduced-motion: reduce`: imagem, texto e
 * link permanecem completos, na ordem do DOM, sem inclinação nem brilho.
 */
const copy = COPY.landing.viewerInvite;

export function LandingViewerInvite() {
  return (
    <section className="landing-viewer-invite" aria-labelledby="landing-viewer-invite-title">
      <Reveal className="landing-viewer-invite__visual">
        <Tilt3D className="landing-card-shell landing-viewer-invite__frame" max={6} glare>
          <div className="landing-viewer-invite__image">
            <Image
              src={BRAND.assets.posterFront}
              alt="Vista frontal do símbolo triangular OCHPOCH MARKET"
              fill
              sizes="(max-width: 768px) 100vw, 48vw"
            />
            <span>IMAGEM 2D</span>
          </div>
        </Tilt3D>
      </Reveal>

      <Reveal className="landing-viewer-invite__copy" delay={90}>
        <span className="landing-kicker">{copy.kicker}</span>
        <h2 id="landing-viewer-invite-title">{copy.headline}</h2>
        <p>{copy.subhead}</p>
        <p>{copy.body}</p>
        <Link className="landing-button landing-button--ink" href="/itens/ochpoch-market/3d">
          <span>{copy.cta}</span>
          <span className="landing-button__icon" aria-hidden="true">↗</span>
        </Link>
        <p className="landing-viewer-invite__note">{copy.microcopy}</p>
      </Reveal>
    </section>
  );
}
