import { Reveal, ShineCard } from "@midas/ui";
import { COPY, type Block } from "@/lib/copy-deck";

/**
 * Ato 2 — a prova em três (regra dos três). Entrada escalonada com `Reveal`
 * (uma vez, sem repetir) e brilho especular no ponteiro com `ShineCard`.
 * Ponteiro grosso e `prefers-reduced-motion` não recebem entrada nem brilho:
 * os três cards nascem visíveis e legíveis.
 *
 * O `<h2>` do ato mora no corte de profundidade (`landing-depth-cut.tsx`);
 * aqui só existem os `<h3>` das três respostas.
 */
const principles: readonly Block[] = [
  COPY.landing.proof.origin,
  COPY.landing.proof.state,
  COPY.landing.proof.nextStep,
];

/** "01 · ORIGEM" -> numeral e rótulo, sem reescrever o texto do deck. */
function splitKicker(kicker: string): { readonly numeral: string; readonly label: string } {
  const [numeral = kicker, ...rest] = kicker.split(" · ");
  return { numeral, label: rest.join(" · ") };
}

export function LandingPrinciples() {
  return (
    <div className="landing-principles">
      <div className="landing-principles__grid">
        {principles.map((principle, index) => {
          const { numeral, label } = splitKicker(principle.kicker);
          return (
            <Reveal className="landing-principles__cell" delay={index * 110} key={principle.kicker}>
              <ShineCard className="landing-card-shell">
                <article className="landing-principle-card">
                  <div className="landing-principle-card__top">
                    <span>{numeral}</span>
                    {label ? <small>{label}</small> : null}
                  </div>
                  <div>
                    <h3>{principle.headline}</h3>
                    <p>{principle.subhead}</p>
                    <p className="landing-principle-card__body">{principle.body}</p>
                  </div>
                </article>
              </ShineCard>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
