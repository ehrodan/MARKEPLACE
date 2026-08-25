import { DepthStack, ParallaxLayer } from "@midas/ui";
import type { ReactNode } from "react";

/**
 * Ato 1 da landing (livro "O Design como Storytelling", Ellen Lupton): o gancho.
 *
 * A profundidade vem de um plano DECORATIVO atrás do conteúdo — três camadas em
 * `translateZ` distintos (`DepthStack`) que se deslocam em velocidades
 * diferentes conforme o scroll (`ParallaxLayer`). O plano é `aria-hidden`,
 * `pointer-events: none` e fica fora do fluxo.
 *
 * Por que o palco 3D NÃO entra no `DepthStack`: `.landing-story__stage` é
 * `position: sticky` e o canvas R3F usa OrbitControls. Um ancestral com
 * `transform-style: preserve-3d` compromete o sticky em parte dos motores, e um
 * tilt por ponteiro disputaria o arrasto do próprio modelo. A profundidade
 * portanto é construída atrás do palco, não em cima dele.
 *
 * Sem JS: nada some (o `DepthStack` é CSS estático, o `ParallaxLayer` só
 * transforma sob `.is-ready`). Com `prefers-reduced-motion: reduce`: sem
 * movimento, com o mesmo conteúdo e a mesma ordem de leitura.
 */
// `children` e opcional: a home passou a levar o catalogo logo abaixo do
// hero, entao o hero pode existir sozinho.
export function LandingHero({ children }: { children?: ReactNode }) {
  return (
    <section className="landing-hero">
      <DepthStack className="landing-hero__depth" perspective={1400} aria-hidden="true">
        <div className="landing-hero__plane landing-hero__plane--far" data-depth="-1">
          <ParallaxLayer className="landing-hero__wash" speed={-0.42}>
            <span />
          </ParallaxLayer>
        </div>
        <div className="landing-hero__plane landing-hero__plane--mid" data-depth="0">
          <ParallaxLayer className="landing-hero__ring" speed={-0.16}>
            <span />
          </ParallaxLayer>
        </div>
        <div className="landing-hero__plane landing-hero__plane--near" data-depth="1">
          <ParallaxLayer className="landing-hero__ember" speed={0.3}>
            <span />
          </ParallaxLayer>
        </div>
      </DepthStack>

      <div className="landing-hero__content">{children}</div>
    </section>
  );
}
