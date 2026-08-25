/**
 * Detector anti-PII do chat pré-compra.
 *
 * Fonte canônica: `RF-066` a `RF-071` do PRD e `docs/04 §11`.
 * `PRE_PURCHASE` bloqueia telefone, e-mail, URL, Pix, WhatsApp, Instagram,
 * nick e **codificação** — a última palavra é a que importa: quem quer levar
 * a conversa para fora não escreve "meu email é x@y.com", escreve "x arroba
 * y ponto com".
 *
 * `RF-067`: o detector combina normalização, padrões e ofuscação.
 *
 * Falso positivo aqui é PIOR que falso negativo. Bloquear "meu float é 0.0721"
 * ou "pago 1.500 reais" mata a negociação legítima e o vendedor vai embora do
 * site. Por isso todo padrão numérico exige forma de contato, não só dígitos.
 *
 * Este módulo é a primeira barreira, no cliente, para dar feedback imediato.
 * NÃO é a autorização: `RF-068` exige que o servidor recuse a mensagem.
 * Um detector client-side sozinho é contornável com um fetch.
 */

export type PiiKind =
  | "EMAIL"
  | "PHONE_BR"
  | "CPF"
  | "PIX_KEY"
  | "SOCIAL_HANDLE"
  | "EXTERNAL_URL"
  | "EVASIVE_CONTACT";

export interface PiiFinding {
  readonly kind: PiiKind;
  /** Trecho detectado, para a interface mostrar o que precisa mudar. */
  readonly excerpt: string;
}

export interface PiiVerdict {
  readonly blocked: boolean;
  readonly findings: readonly PiiFinding[];
  /** Frase em pt-BR explicando o bloqueio. Vazia quando não há bloqueio. */
  readonly message: string;
}

/**
 * Normalização: desfaz as ofuscações mais comuns antes de casar padrão.
 * Sem isto, "x arroba y ponto com" passa e o detector vira teatro.
 */
function normalize(input: string): string {
  return input
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(at\)|\[at\]|\s+at\s+|\barroba\b/g, "@")
    .replace(/\(dot\)|\[dot\]|\bponto\b/g, ".")
    .replace(/[_\-*·]/g, "");
}

/** Dígitos por extenso, usados para escrever telefone sem usar número. */
const SPELLED_DIGITS: Record<string, string> = {
  zero: "0", um: "1", uma: "1", dois: "2", duas: "2", tres: "3", quatro: "4",
  cinco: "5", seis: "6", meia: "6", sete: "7", oito: "8", nove: "9",
};

function collapseSpelledDigits(input: string): string {
  const words = input.split(/\s+/);
  let out = "";
  let run = "";
  for (const word of words) {
    const digit = SPELLED_DIGITS[word];
    if (digit) {
      run += digit;
      continue;
    }
    if (run.length >= 8) out += ` ${run} `;
    run = "";
    out += ` ${word} `;
  }
  if (run.length >= 8) out += ` ${run} `;
  return out;
}

const EMAIL = /[a-z0-9][a-z0-9.]*@[a-z0-9][a-z0-9.]*\.[a-z]{2,}/;

/**
 * Telefone BR: 10 ou 11 dígitos, opcionalmente com DDI. Só considera
 * sequência longa o bastante para ser telefone — preço e float não entram.
 */
const PHONE_DIGITS = /(?:\+?55)?\s*\(?\d{2}\)?\s*9?\d{4}\s*\d{4}/;

const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;

/** Handle social precisa de @ seguido de nome — não casa e-mail. */
const SOCIAL_HANDLE = /(?:^|\s)@[a-z][a-z0-9.]{2,}(?!\.[a-z]{2,})/;

const EXTERNAL_URL =
  /(?:https?:\/\/|www\.)[a-z0-9.-]+\.[a-z]{2,}|(?:t\.me|wa\.me|bit\.ly|discord\.gg)\/[a-z0-9]/;

/** Menção explícita de canal externo, mesmo sem número junto. */
const EVASIVE_CHANNEL =
  /\b(?:whats?app|whatzap|whatsap|zap|zapzap|wpp|telegram|insta|instagram|discord|steam|facebook|messenger)\b/;

/** Pedido explícito de contato fora da plataforma. */
const EVASIVE_INTENT =
  /\b(?:me\s*chama|chama\s*(?:no|la)|fora\s*(?:daqui|do\s*site|da\s*plataforma)|meu\s*(?:numero|contato|zap|email|e-?mail)|passa\s*(?:teu|seu)\s*(?:numero|contato|zap))\b/;

/** Chave Pix declarada. Número solto não basta — precisa da palavra. */
const PIX_KEY = /\bpix\b[^\n]{0,24}?(?:\d{6,}|@|[a-z0-9.]+@[a-z0-9.]+)/;

const MESSAGES: Record<PiiKind, string> = {
  EMAIL: "endereço de e-mail",
  PHONE_BR: "número de telefone",
  CPF: "CPF",
  PIX_KEY: "chave Pix",
  SOCIAL_HANDLE: "perfil de rede social",
  EXTERNAL_URL: "link externo",
  EVASIVE_CONTACT: "tentativa de levar a conversa para fora da plataforma",
};

function excerptFor(pattern: RegExp, haystack: string, fallback: string): string {
  const match = pattern.exec(haystack);
  return match ? match[0].trim().slice(0, 40) : fallback;
}

export function detectPii(raw: string): PiiVerdict {
  if (typeof raw !== "string" || !raw.trim()) {
    return { blocked: false, findings: [], message: "" };
  }

  const normalized = normalize(raw);
  const collapsed = collapseSpelledDigits(normalized);
  const digitsOnly = normalized.replace(/\D/g, "");
  const findings: PiiFinding[] = [];

  if (EMAIL.test(normalized)) {
    findings.push({ kind: "EMAIL", excerpt: excerptFor(EMAIL, normalized, "e-mail") });
  }
  if (CPF.test(normalized) && digitsOnly.length >= 11) {
    findings.push({ kind: "CPF", excerpt: excerptFor(CPF, normalized, "CPF") });
  }
  if (PHONE_DIGITS.test(normalized) || PHONE_DIGITS.test(collapsed)) {
    findings.push({
      kind: "PHONE_BR",
      excerpt: excerptFor(PHONE_DIGITS, `${normalized} ${collapsed}`, "telefone"),
    });
  }
  if (PIX_KEY.test(normalized)) {
    findings.push({ kind: "PIX_KEY", excerpt: excerptFor(PIX_KEY, normalized, "Pix") });
  }
  if (EXTERNAL_URL.test(normalized)) {
    findings.push({ kind: "EXTERNAL_URL", excerpt: excerptFor(EXTERNAL_URL, normalized, "link") });
  }
  if (SOCIAL_HANDLE.test(normalized) && !EMAIL.test(normalized)) {
    findings.push({
      kind: "SOCIAL_HANDLE",
      excerpt: excerptFor(SOCIAL_HANDLE, normalized, "@perfil"),
    });
  }
  if (EVASIVE_CHANNEL.test(normalized) || EVASIVE_INTENT.test(normalized)) {
    findings.push({
      kind: "EVASIVE_CONTACT",
      excerpt: excerptFor(
        EVASIVE_CHANNEL.test(normalized) ? EVASIVE_CHANNEL : EVASIVE_INTENT,
        normalized,
        "contato externo",
      ),
    });
  }

  if (!findings.length) return { blocked: false, findings: [], message: "" };

  const kinds = [...new Set(findings.map((finding) => MESSAGES[finding.kind]))];
  return {
    blocked: true,
    findings,
    // Explica o motivo E o porquê. Erro mudo faz a pessoa tentar de novo
    // em vez de entender a proteção.
    message:
      `Esta mensagem não foi enviada porque contém ${kinds.join(", ")}. ` +
      "Negociar aqui mantém a proteção da compra: sem histórico na plataforma, " +
      "não há evidência para disputa nem reembolso.",
  };
}

/** `RF-069` a `RF-071`: primeira avisa, segunda alerta, terceira restringe. */
export type StrikeOutcome = "WARNED" | "FINAL_WARNING" | "RESTRICTED_PENDING_REVIEW";

export function strikeOutcome(previousStrikes: number): StrikeOutcome {
  if (previousStrikes <= 0) return "WARNED";
  if (previousStrikes === 1) return "FINAL_WARNING";
  return "RESTRICTED_PENDING_REVIEW";
}

export const STRIKE_MESSAGES: Record<StrikeOutcome, string> = {
  WARNED:
    "Esta mensagem não foi enviada porque contém informação de contato. Negocie aqui para manter a proteção da compra. Esta é sua primeira ocorrência.",
  FINAL_WARNING:
    "Esta mensagem não foi enviada. Uma nova tentativa de compartilhar contato restringirá sua conta e abrirá revisão da staff.",
  RESTRICTED_PENDING_REVIEW:
    "Sua conta foi restringida para revisão. Você ainda pode acessar esta tela e enviar um recurso à staff.",
};
