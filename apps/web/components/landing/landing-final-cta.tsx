import Link from "next/link";
import { MagneticCta, Reveal } from "@midas/ui";
import { COPY } from "@/lib/copy-deck";

/**
 * Ato 3 — a saída. Painel de ouro com a única ação comercial da página.
 *
 * `MagneticCta` aproxima o botão do ponteiro dentro de um raio, com teto rígido
 * de 6px no próprio componente: o alvo de clique nunca sai da área do elemento
 * e o botão nunca foge do cursor. A leitura do doc 07 §1.4 (`M2`) é estrita —
 * "nunca cria urgência, escassez, preço animado ou CTA móvel" proíbe o CTA que
 * escapa, não o afago de alguns pixels em direção a quem já mirou nele. Em
 * ponteiro grosso e em `prefers-reduced-motion: reduce` o ímã é desligado
 * inteiro pelo componente.
 *
 * `microcopy` do deck permanece visível: com os gates G0–G3 fechados nenhuma
 * cobrança é processada, e a página diz isso embaixo do próprio CTA em vez de
 * prometer checkout.
 */
const copy = COPY.landing.finalCta;

export function LandingFinalCta() {
  return (
    <Reveal as="section" className="landing-cta" aria-labelledby="landing-cta-title">
      <div className="landing-cta__lead">
        <span className="landing-kicker">{copy.kicker}</span>
        <h2 id="landing-cta-title">{copy.headline}</h2>
        <p className="landing-cta__body">{copy.body}</p>
      </div>

      <div className="landing-cta__actions">
        <p>{copy.subhead}</p>
        <MagneticCta className="landing-cta__magnet" radius={110} strength={4}>
          <Link className="landing-button landing-button--ink" href="/market">
            <span>{copy.cta}</span>
            <span className="landing-button__icon" aria-hidden="true">↗</span>
          </Link>
        </MagneticCta>
        <p className="landing-cta__note">{copy.microcopy}</p>
      </div>
    </Reveal>
  );
}
