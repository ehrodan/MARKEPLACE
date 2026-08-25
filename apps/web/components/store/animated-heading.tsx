import type { ReactNode } from "react";
import styles from "./animated-heading.module.css";

/**
 * Título com entrada palavra a palavra, em CSS puro.
 *
 * Por que não React Bits: `docs/coordenacao/REACT-BITS-ALLOWLIST.md` classifica
 * a biblioteca como `BLOCKED_LEGAL_TECHNICAL` e proíbe `gsap`, `motion`, `ogl`
 * e `framer-motion` (MIT + Commons Clause, e o gsap com licença própria). O
 * efeito é o mesmo; a dependência é que não entra.
 *
 * Acessibilidade, e o motivo de cada escolha:
 * - o texto completo vai em `aria-label`, e os pedaços são `aria-hidden`, para
 *   o leitor de tela ouvir uma frase e não uma palavra por vez;
 * - a animação usa `animation`, não `transition` disparada por classe. Uma
 *   transição por classe não dispara em aba oculta nem em renderizador sem
 *   layout, e o título seria enviado em branco. Aqui o estado final é o padrão
 *   e a animação apenas atrasa a chegada;
 * - `prefers-reduced-motion` cancela a animação e o título já nasce no lugar.
 *
 * `highlight` marca a palavra que carrega a promessa. Uma só: se tudo é
 * destaque, nada é (Gestalt, segregação).
 */

/** Atraso entre palavras. Acima disso a frase demora mais que a leitura. */
const STEP_MS = 55;
/** Teto de atraso: frases longas não podem deixar a última palavra esperando. */
const MAX_STEPS = 12;

export function AnimatedHeading({
  text,
  highlight,
  id,
  className,
}: {
  text: string;
  highlight?: string;
  id?: string;
  className?: string;
}) {
  const words = text.split(" ").filter(Boolean);
  const marked = highlight?.trim().toLowerCase();

  return (
    <h1
      aria-label={text}
      className={[styles.heading, className].filter(Boolean).join(" ")}
      id={id}
    >
      {words.map((word, index) => {
        const bare = word.replace(/[.,;:!?]/g, "").toLowerCase();
        return (
          <span
            aria-hidden="true"
            className={styles.word}
            data-highlight={marked && bare === marked ? "true" : undefined}
            key={`${word}-${String(index)}`}
            style={{ ["--step" as string]: `${String(Math.min(index, MAX_STEPS) * STEP_MS)}ms` }}
          >
            {word}
          </span>
        );
      })}
    </h1>
  );
}

/**
 * CTA com brilho que varre e seta que avança.
 *
 * O brilho corre uma vez na entrada e volta a correr no hover — chama o olho
 * sem piscar em laço, que seria decoração pura e cansa. A seta é o sinal de
 * direção: a pessoa vai para a vitrine, e o botão diz para onde.
 */
export function ShimmerCta({
  children,
  href,
  tone = "primary",
}: {
  children: ReactNode;
  href: string;
  tone?: "primary" | "ghost";
}) {
  return (
    <a className={styles.cta} data-tone={tone} href={href}>
      <span className={styles.ctaLabel}>{children}</span>
      <span aria-hidden="true" className={styles.ctaArrow}>
        →
      </span>
      <span aria-hidden="true" className={styles.ctaShimmer} />
    </a>
  );
}
