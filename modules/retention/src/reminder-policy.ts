/**
 * Politica de lembretes -- o coracao etico do modulo de retencao.
 *
 * Este arquivo e PURO: zero imports, zero I/O, zero banco, zero relogio proprio.
 * Recebe fatos, devolve decisao. Toda supressao devolve um MOTIVO NOMEADO; nunca um
 * booleano mudo -- porque a recusa precisa ser auditavel e explicavel para a pessoa.
 *
 * Base normativa e de marca:
 *  - docs/03-DIRECAO-DE-ARTE.md secao 10 (antimanipulacao): escassez fabricada, contagem
 *    regressiva inventada, prova social falsa e confirmshaming sao proibidos.
 *  - Consentimento nunca marcado por padrao; revogacao imediata e registrada.
 *  - Persuasao permitida e a que aguenta auditoria: o carrinho sobrevive, o aviso de preco
 *    foi PEDIDO pela pessoa, e todo envio carrega descadastro de um clique.
 *
 * As regras de frequencia estao escritas como DADO (constantes nomeadas e exportadas),
 * nao espalhadas em `if`. Mudar a politica e mudar uma constante, nao cacar condicional.
 */

export const REMINDER_POLICY_VERSION = "retention-reminder-policy@1.0.0";

// ---------------------------------------------------------------------------------------
// Vocabulario
// ---------------------------------------------------------------------------------------

export const REMINDER_PURPOSES = [
  "CART_RECOVERY",
  "PRICE_WATCH",
  "STOCK_WATCH",
  "ORDER_UPDATE",
] as const;
export type ReminderPurpose = (typeof REMINDER_PURPOSES)[number];

export const REMINDER_CHANNELS = ["EMAIL", "PUSH", "IN_APP"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

/** Transacional: a pessoa precisa desta mensagem para concluir o que ja comprou. */
export const TRANSACTIONAL_PURPOSES = [
  "ORDER_UPDATE",
] as const satisfies readonly ReminderPurpose[];

/** Marketing: exige consentimento explicito e entra no teto de frequencia. */
export const MARKETING_PURPOSES = [
  "CART_RECOVERY",
  "PRICE_WATCH",
  "STOCK_WATCH",
] as const satisfies readonly ReminderPurpose[];

/**
 * Canais PULL: a propria pessoa abre e consulta (feed in-app). Nao empurram nada para
 * fora do produto, entao nao exigem consentimento de marketing -- mas uma revogacao
 * explicita registrada continua bloqueando.
 */
export const PULL_CHANNELS = ["IN_APP"] as const satisfies readonly ReminderChannel[];

/** Canais PUSH: saem do produto e por isso respeitam a janela de silencio. */
export const QUIET_HOURS_CHANNELS = [
  "EMAIL",
  "PUSH",
] as const satisfies readonly ReminderChannel[];

// ---------------------------------------------------------------------------------------
// Regras de frequencia como DADO
// ---------------------------------------------------------------------------------------

export const REMINDER_FREQUENCY_LIMITS = {
  /** No maximo 1 lembrete de recuperacao por carrinho salvo. */
  cartRecoveryPerCart: 1,
  /** Teto absoluto por pessoa, somando todos os carrinhos. */
  cartRecoveryPerUserTotal: 2,
  /** Nunca mais de 1 mensagem de marketing por pessoa nesta janela, somando purposes. */
  marketingMinimumIntervalHours: 72,
} as const;

export const MARKETING_MINIMUM_INTERVAL_MS =
  REMINDER_FREQUENCY_LIMITS.marketingMinimumIntervalHours * 60 * 60 * 1_000;

/**
 * Janela de silencio no fuso da pessoa. Fechada de 21h (inclusive) as 09h (exclusive).
 * Vale para canais PUSH em mensagens de marketing. Aviso transacional de pedido nao e
 * silenciado: segurar a noticia de um pagamento recusado prejudica a propria pessoa.
 */
export const QUIET_HOURS_WINDOW = {
  startHour: 21,
  endHour: 9,
} as const;

/** TTL padrao do snapshot de carrinho salvo. */
export const SAVED_CART_TTL_DAYS = 30;
export const SAVED_CART_TTL_MS = SAVED_CART_TTL_DAYS * 24 * 60 * 60 * 1_000;

// ---------------------------------------------------------------------------------------
// Motivos de supressao (enum fechado)
// ---------------------------------------------------------------------------------------

export const REMINDER_SUPPRESSION_REASONS = [
  "DEDUPE_KEY_ALREADY_USED",
  "CART_ALREADY_RECOVERED",
  "CART_EMPTY",
  "LISTING_UNPUBLISHED",
  "PRICE_UNAVAILABLE",
  "CONSENT_MISSING",
  "CONSENT_REVOKED",
  "CART_REMINDER_LIMIT_REACHED",
  "CART_REMINDER_TOTAL_LIMIT_REACHED",
  "MARKETING_INTERVAL_NOT_ELAPSED",
  "QUIET_HOURS",
  "USER_TIME_ZONE_UNKNOWN",
] as const;
export type ReminderSuppressionReason = (typeof REMINDER_SUPPRESSION_REASONS)[number];

/** Texto pt-BR de cada motivo, para painel administrativo e para explicar a decisao. */
export const REMINDER_SUPPRESSION_MESSAGES: Record<ReminderSuppressionReason, string> = {
  DEDUPE_KEY_ALREADY_USED: "Este mesmo motivo de lembrete já foi disparado antes.",
  CART_ALREADY_RECOVERED: "O carrinho já foi retomado; não há o que lembrar.",
  CART_EMPTY: "O carrinho salvo não tem mais itens.",
  LISTING_UNPUBLISHED: "O anúncio não está publicado.",
  PRICE_UNAVAILABLE: "O preço do anúncio não está disponível para ser citado.",
  CONSENT_MISSING: "Não há consentimento registrado para este canal e finalidade.",
  CONSENT_REVOKED: "O consentimento foi revogado por esta pessoa.",
  CART_REMINDER_LIMIT_REACHED: "Este carrinho já recebeu o lembrete a que tinha direito.",
  CART_REMINDER_TOTAL_LIMIT_REACHED:
    "Esta pessoa já atingiu o teto de lembretes de carrinho.",
  MARKETING_INTERVAL_NOT_ELAPSED:
    "Ainda não passou o intervalo mínimo desde a última mensagem de marketing.",
  QUIET_HOURS: "O horário está dentro da janela de silêncio do fuso desta pessoa.",
  USER_TIME_ZONE_UNKNOWN:
    "O fuso horário desta pessoa não pôde ser resolvido; nada é enviado no escuro.",
};

// ---------------------------------------------------------------------------------------
// Fatos de entrada
// ---------------------------------------------------------------------------------------

/** Estado corrente de consentimento para um par (canal, finalidade). */
export type ReminderConsentFact = {
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
  policyVersion: string;
};

export type ConsentState = "GRANTED" | "MISSING" | "REVOKED";

export type ReminderFrequencyFact = {
  /** Lembretes de recuperacao ja contabilizados para ESTE carrinho. */
  cartRemindersForThisCart: number;
  /** Lembretes de recuperacao ja contabilizados para a pessoa, somando todos os carrinhos. */
  cartRemindersTotal: number;
  /**
   * Ultimo envio de marketing da pessoa (qualquer purpose de marketing), ou `null`.
   * Envio agendado e ainda nao entregue tambem conta -- senao a fila fura o intervalo.
   */
  lastMarketingSentAt: Date | null;
};

/**
 * Estado do assunto do lembrete. O modulo de retencao nao le `modules/orders` nem
 * `catalog`; quem chama declara os fatos, e a politica os aplica.
 */
export type ReminderSubjectFact = {
  cartRecovered: boolean;
  cartItemCount: number;
  listingPublished: boolean;
  priceAvailable: boolean;
};

export type ReminderPolicyInput = {
  /** Instante em que a mensagem SAIRIA. A janela de silencio e avaliada nele. */
  sendAt: Date;
  /** Fuso IANA da pessoa, ex.: "America/Sao_Paulo". */
  userTimeZone: string;
  purpose: ReminderPurpose;
  channel: ReminderChannel;
  /** Ja existe disparo nao suprimido com esta mesma chave de dedupe? */
  dedupeKeyAlreadyUsed: boolean;
  consent: ReminderConsentFact | null;
  frequency: ReminderFrequencyFact;
  subject: ReminderSubjectFact;
};

export type ReminderDecision =
  | { allowed: true; policyVersion: string }
  | {
      allowed: false;
      reason: ReminderSuppressionReason;
      message: string;
      policyVersion: string;
    };

// ---------------------------------------------------------------------------------------
// Predicados puros
// ---------------------------------------------------------------------------------------

export function isTransactionalPurpose(purpose: ReminderPurpose): boolean {
  return (TRANSACTIONAL_PURPOSES as readonly ReminderPurpose[]).includes(purpose);
}

export function isMarketingPurpose(purpose: ReminderPurpose): boolean {
  return (MARKETING_PURPOSES as readonly ReminderPurpose[]).includes(purpose);
}

export function isPullChannel(channel: ReminderChannel): boolean {
  return (PULL_CHANNELS as readonly ReminderChannel[]).includes(channel);
}

/**
 * Consentimento explicito e exigido quando a mensagem e de marketing E sai do produto.
 * ORDER_UPDATE (transacional) e o feed in-app (pull) nao exigem -- mas revogacao explicita
 * bloqueia qualquer um dos dois, ver `shouldRemind`.
 */
export function requiresExplicitConsent(
  purpose: ReminderPurpose,
  channel: ReminderChannel,
): boolean {
  if (isTransactionalPurpose(purpose)) return false;
  if (isPullChannel(channel)) return false;
  return true;
}

export function evaluateConsentState(consent: ReminderConsentFact | null): ConsentState {
  if (consent === null) return "MISSING";
  if (consent.revokedAt !== null) return "REVOKED";
  if (!consent.granted) return "REVOKED";
  if (consent.grantedAt === null) return "MISSING";
  return "GRANTED";
}

/** Hora (0-23) do instante no fuso informado. Lanca `RangeError` se o fuso for invalido. */
export function hourInTimeZone(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  });
  const hourPart = formatter.formatToParts(instant).find((part) => part.type === "hour");
  if (hourPart === undefined) {
    throw new RangeError(`Fuso horário sem componente de hora: ${timeZone}`);
  }
  const hour = Number.parseInt(hourPart.value, 10);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`Hora inválida para o fuso ${timeZone}`);
  }
  return hour;
}

/** Janela que cruza a meia-noite: 21h..23h e 00h..08h. */
export function isWithinQuietHours(hour: number): boolean {
  return hour >= QUIET_HOURS_WINDOW.startHour || hour < QUIET_HOURS_WINDOW.endHour;
}

/**
 * Janela de silencio vale para canal PUSH em mensagem de marketing. Transacional passa,
 * e feed in-app passa porque so aparece quando a pessoa abre.
 */
export function quietHoursApply(purpose: ReminderPurpose, channel: ReminderChannel): boolean {
  if (!isMarketingPurpose(purpose)) return false;
  return (QUIET_HOURS_CHANNELS as readonly ReminderChannel[]).includes(channel);
}

// ---------------------------------------------------------------------------------------
// Decisao
// ---------------------------------------------------------------------------------------

function allow(): ReminderDecision {
  return { allowed: true, policyVersion: REMINDER_POLICY_VERSION };
}

function suppress(reason: ReminderSuppressionReason): ReminderDecision {
  return {
    allowed: false,
    reason,
    message: REMINDER_SUPPRESSION_MESSAGES[reason],
    policyVersion: REMINDER_POLICY_VERSION,
  };
}

/**
 * Ordem de avaliacao, do mais barato e mais objetivo para o mais contextual:
 *  1. dedupe          -- o mesmo motivo nunca dispara duas vezes
 *  2. estado do assunto -- carrinho retomado, item removido, anuncio fora do ar, preco sumido
 *  3. consentimento   -- ausente ou revogado bloqueia
 *  4. frequencia      -- teto por carrinho, teto por pessoa, intervalo minimo de marketing
 *  5. janela de silencio -- 21h..09h no fuso da pessoa
 */
export function shouldRemind(input: ReminderPolicyInput): ReminderDecision {
  const { purpose, channel, subject, frequency } = input;

  // 1. Dedupe
  if (input.dedupeKeyAlreadyUsed) return suppress("DEDUPE_KEY_ALREADY_USED");

  // 2. Estado do assunto
  if (purpose === "CART_RECOVERY") {
    if (subject.cartRecovered) return suppress("CART_ALREADY_RECOVERED");
    if (subject.cartItemCount <= 0) return suppress("CART_EMPTY");
  }
  if (purpose === "PRICE_WATCH" || purpose === "STOCK_WATCH") {
    if (!subject.listingPublished) return suppress("LISTING_UNPUBLISHED");
  }
  if (purpose === "PRICE_WATCH" && !subject.priceAvailable) {
    return suppress("PRICE_UNAVAILABLE");
  }

  // 3. Consentimento. Revogacao vale para TODOS os canais e finalidades.
  const consentState = evaluateConsentState(input.consent);
  if (consentState === "REVOKED") return suppress("CONSENT_REVOKED");
  if (requiresExplicitConsent(purpose, channel) && consentState !== "GRANTED") {
    return suppress("CONSENT_MISSING");
  }

  // 4. Frequencia
  if (isMarketingPurpose(purpose)) {
    if (purpose === "CART_RECOVERY") {
      if (frequency.cartRemindersForThisCart >= REMINDER_FREQUENCY_LIMITS.cartRecoveryPerCart) {
        return suppress("CART_REMINDER_LIMIT_REACHED");
      }
      if (frequency.cartRemindersTotal >= REMINDER_FREQUENCY_LIMITS.cartRecoveryPerUserTotal) {
        return suppress("CART_REMINDER_TOTAL_LIMIT_REACHED");
      }
    }
    if (frequency.lastMarketingSentAt !== null) {
      const elapsed = input.sendAt.getTime() - frequency.lastMarketingSentAt.getTime();
      if (elapsed < MARKETING_MINIMUM_INTERVAL_MS) {
        return suppress("MARKETING_INTERVAL_NOT_ELAPSED");
      }
    }
  }

  // 5. Janela de silencio
  if (quietHoursApply(purpose, channel)) {
    let localHour: number;
    try {
      localHour = hourInTimeZone(input.sendAt, input.userTimeZone);
    } catch {
      return suppress("USER_TIME_ZONE_UNKNOWN");
    }
    if (isWithinQuietHours(localHour)) return suppress("QUIET_HOURS");
  }

  return allow();
}
