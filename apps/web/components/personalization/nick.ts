/**
 * Saudação pelo nick público do usuário.
 *
 * Parece trivial e não é: nick é conteúdo controlado pelo usuário e vai para
 * o topo de toda página autenticada. Os casos que quebram na prática:
 *
 * - vazio, só espaço, ou só caracteres invisíveis  -> saudação neutra
 * - `undefined` / `null` do payload                -> saudação neutra, nunca
 *   "Bem-vindo de volta, undefined"
 * - muito longo                                    -> truncado com reticências
 * - override de direção de texto (RTL/LTR marks)   -> removido, senão um nick
 *   consegue inverter visualmente o resto da linha
 *
 * O escape de HTML é do JSX; aqui se resolve a NORMALIZAÇÃO. Nada é
 * renderizado com dangerouslySetInnerHTML.
 */

export const NICK_MAX_LENGTH = 24;

/** Marcas de controle bidirecional e caracteres de largura zero. */
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;

export function normalizeNick(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;

  const cleaned = raw.replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  if (cleaned.length <= NICK_MAX_LENGTH) return cleaned;
  return `${cleaned.slice(0, NICK_MAX_LENGTH - 1).trimEnd()}…`;
}

export interface Greeting {
  readonly headline: string;
  /** true quando a saudação usa o nick; false quando caiu no neutro. */
  readonly personalized: boolean;
}

/**
 * Nunca devolve frase quebrada nem espaço sobrando no meio do texto — é o
 * defeito mais comum de personalização e o mais visível.
 */
export function greetingFor(nick: string | null | undefined): Greeting {
  const normalized = normalizeNick(nick);
  if (!normalized) return { headline: "Bem-vindo de volta", personalized: false };
  return { headline: `Bem-vindo de volta, ${normalized}`, personalized: true };
}
