import { DepthStack, ParallaxLayer, Reveal } from "@midas/ui";
import { COPY } from "@/lib/copy-deck";

/**
 * Corte de profundidade — a virada entre o ato 1 (gancho) e o ato 2 (prova).
 *
 * Uma faixa escura corta a página clara e abre a regra dos três: as camadas
 * ficam em `translateZ` diferentes (`DepthStack`) e se separam conforme o
 * scroll avança, cada uma em uma velocidade (`ParallaxLayer`). A camada de
 * fundo recebe ainda uma animação scroll-driven puramente CSS
 * (`animation-timeline: view()`, só transform + opacity) definida em
 * `app/globals.css`.
 *
 * As três marcas são os kickers exatos dos blocos que aparecem logo abaixo:
 * o corte anuncia a estrutura, os cards a respondem. Nenhum texto novo.
 *
 * É um `<div>`, não uma `<section>`: o corte é o cabeçalho do ato 2 e divide
 * com os cards o mesmo landmark e o mesmo `<h2>`.
 */
const marks = [
  COPY.landing.proof.origin.kicker,
  COPY.landing.proof.state.kicker,
  COPY.landing.proof.nextStep.kicker,
] as const;

const copy = COPY.landing.proof.intro;

export function LandingDepthCut() {
  return (
    <div className="landing-cut">
      <DepthStack className="landing-cut__stack" perspective={1600}>
        <div className="landing-cut__plane landing-cut__plane--back" data-depth="-1" aria-hidden="true">
          <ParallaxLayer className="landing-cut__wash" speed={-0.4}>
            <span />
          </ParallaxLayer>
        </div>

        <div className="landing-cut__plane landing-cut__plane--lead" data-depth="0">
          <ParallaxLayer speed={0.12}>
            <Reveal className="landing-cut__lead">
              <span className="landing-kicker landing-kicker--invert">{copy.kicker}</span>
              <h2 id="landing-cut-title">{copy.headline}</h2>
              <p className="landing-cut__subhead">{copy.subhead}</p>
              <p className="landing-cut__body">{copy.body}</p>
            </Reveal>
          </ParallaxLayer>
        </div>

        <div className="landing-cut__plane landing-cut__plane--marks" data-depth="1">
          <ParallaxLayer speed={-0.26}>
            <ol className="landing-cut__marks">
              {marks.map((mark, index) => (
                <Reveal as="li" className="landing-cut__mark" delay={index * 110} key={mark}>
                  {mark}
                </Reveal>
              ))}
            </ol>
          </ParallaxLayer>
        </div>
      </DepthStack>

      <p className="landing-cut__note">{copy.microcopy}</p>
    </div>
  );
}
