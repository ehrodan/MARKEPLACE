import { describe, expect, it } from "vitest";
import {
  MARKETING_MINIMUM_INTERVAL_MS,
  QUIET_HOURS_WINDOW,
  REMINDER_FREQUENCY_LIMITS,
  REMINDER_POLICY_VERSION,
  REMINDER_SUPPRESSION_MESSAGES,
  REMINDER_SUPPRESSION_REASONS,
  evaluateConsentState,
  hourInTimeZone,
  isWithinQuietHours,
  quietHoursApply,
  shouldRemind,
  type ReminderConsentFact,
  type ReminderPolicyInput,
} from "./reminder-policy.js";

const SAO_PAULO = "America/Sao_Paulo";

/** 2026-08-24 14:00 em São Paulo (UTC-3) = 17:00Z. Fora da janela de silêncio. */
const MIDDAY_SAO_PAULO = new Date("2026-08-24T17:00:00.000Z");
/** 2026-08-24 22:00 em São Paulo = 2026-08-25 01:00Z. Dentro da janela de silêncio. */
const NIGHT_SAO_PAULO = new Date("2026-08-25T01:00:00.000Z");
/** 2026-08-24 03:00 em São Paulo = 06:00Z. Madrugada, também dentro da janela. */
const DAWN_SAO_PAULO = new Date("2026-08-24T06:00:00.000Z");

const grantedConsent: ReminderConsentFact = {
  granted: true,
  grantedAt: new Date("2026-08-01T12:00:00.000Z"),
  revokedAt: null,
  policyVersion: "retention-consent@1.0.0",
};

const revokedConsent: ReminderConsentFact = {
  granted: false,
  grantedAt: null,
  revokedAt: new Date("2026-08-10T12:00:00.000Z"),
  policyVersion: "retention-consent@1.0.0",
};

function baseInput(overrides: Partial<ReminderPolicyInput> = {}): ReminderPolicyInput {
  return {
    sendAt: MIDDAY_SAO_PAULO,
    userTimeZone: SAO_PAULO,
    purpose: "CART_RECOVERY",
    channel: "EMAIL",
    dedupeKeyAlreadyUsed: false,
    consent: grantedConsent,
    frequency: {
      cartRemindersForThisCart: 0,
      cartRemindersTotal: 0,
      lastMarketingSentAt: null,
    },
    subject: {
      cartRecovered: false,
      cartItemCount: 2,
      listingPublished: true,
      priceAvailable: true,
    },
    ...overrides,
  };
}

describe("shouldRemind — caminho feliz", () => {
  it("libera lembrete de carrinho com consentimento, dentro do horário e sem histórico", () => {
    const decision = shouldRemind(baseInput());
    expect(decision.allowed).toBe(true);
    expect(decision.policyVersion).toBe(REMINDER_POLICY_VERSION);
  });
});

describe("shouldRemind — consentimento", () => {
  it("bloqueia quando não há consentimento registrado", () => {
    const decision = shouldRemind(baseInput({ consent: null }));
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("CONSENT_MISSING");
    expect(decision.message).toBe(REMINDER_SUPPRESSION_MESSAGES.CONSENT_MISSING);
  });

  it("bloqueia quando o consentimento foi revogado", () => {
    const decision = shouldRemind(baseInput({ consent: revokedConsent }));
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("CONSENT_REVOKED");
  });

  it("revogação bloqueia até no feed in-app, que normalmente dispensa consentimento", () => {
    const decision = shouldRemind(
      baseInput({ channel: "IN_APP", consent: revokedConsent }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("CONSENT_REVOKED");
  });

  it("feed in-app sem consentimento registrado passa: é canal consultado pela pessoa", () => {
    const decision = shouldRemind(baseInput({ channel: "IN_APP", consent: null }));
    expect(decision.allowed).toBe(true);
  });

  it("ORDER_UPDATE é transacional e passa sem consentimento de marketing", () => {
    const decision = shouldRemind(
      baseInput({ purpose: "ORDER_UPDATE", channel: "EMAIL", consent: null }),
    );
    expect(decision.allowed).toBe(true);
  });

  it("ORDER_UPDATE passa mesmo dentro da janela de silêncio", () => {
    const decision = shouldRemind(
      baseInput({ purpose: "ORDER_UPDATE", channel: "EMAIL", consent: null, sendAt: NIGHT_SAO_PAULO }),
    );
    expect(decision.allowed).toBe(true);
  });

  it("ORDER_UPDATE ainda respeita revogação explícita", () => {
    const decision = shouldRemind(
      baseInput({ purpose: "ORDER_UPDATE", consent: revokedConsent }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("CONSENT_REVOKED");
  });
});

describe("shouldRemind — janela de silêncio", () => {
  it("bloqueia e-mail de marketing às 22h no fuso da pessoa", () => {
    const decision = shouldRemind(baseInput({ sendAt: NIGHT_SAO_PAULO }));
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("QUIET_HOURS");
  });

  it("bloqueia push de marketing às 3h da manhã", () => {
    const decision = shouldRemind(baseInput({ channel: "PUSH", sendAt: DAWN_SAO_PAULO }));
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("QUIET_HOURS");
  });

  it("não silencia o feed in-app: ele só aparece quando a pessoa abre", () => {
    const decision = shouldRemind(baseInput({ channel: "IN_APP", sendAt: NIGHT_SAO_PAULO }));
    expect(decision.allowed).toBe(true);
  });

  it("o mesmo instante pode ser silêncio num fuso e horário livre em outro", () => {
    const noiteEmSaoPaulo = shouldRemind(baseInput({ sendAt: NIGHT_SAO_PAULO }));
    const tardeEmTokyo = shouldRemind(
      baseInput({ sendAt: NIGHT_SAO_PAULO, userTimeZone: "Asia/Tokyo" }),
    );
    expect(noiteEmSaoPaulo.allowed).toBe(false);
    expect(tardeEmTokyo.allowed).toBe(true);
  });

  it("fuso desconhecido não envia no escuro: suprime com motivo próprio", () => {
    const decision = shouldRemind(baseInput({ userTimeZone: "Marte/Olympus_Mons" }));
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("USER_TIME_ZONE_UNKNOWN");
  });
});

describe("shouldRemind — frequência", () => {
  it("bloqueia o segundo lembrete do MESMO carrinho", () => {
    const decision = shouldRemind(
      baseInput({
        frequency: {
          cartRemindersForThisCart: REMINDER_FREQUENCY_LIMITS.cartRecoveryPerCart,
          cartRemindersTotal: 1,
          lastMarketingSentAt: null,
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("CART_REMINDER_LIMIT_REACHED");
  });

  it("bloqueia quando a pessoa já atingiu o teto total de lembretes de carrinho", () => {
    const decision = shouldRemind(
      baseInput({
        frequency: {
          cartRemindersForThisCart: 0,
          cartRemindersTotal: REMINDER_FREQUENCY_LIMITS.cartRecoveryPerUserTotal,
          lastMarketingSentAt: null,
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("CART_REMINDER_TOTAL_LIMIT_REACHED");
  });

  it("bloqueia marketing dentro do intervalo mínimo de 72h somando purposes", () => {
    const decision = shouldRemind(
      baseInput({
        purpose: "PRICE_WATCH",
        frequency: {
          cartRemindersForThisCart: 0,
          cartRemindersTotal: 0,
          lastMarketingSentAt: new Date(
            MIDDAY_SAO_PAULO.getTime() - MARKETING_MINIMUM_INTERVAL_MS + 1,
          ),
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("MARKETING_INTERVAL_NOT_ELAPSED");
  });

  it("libera exatamente no limite de 72h", () => {
    const decision = shouldRemind(
      baseInput({
        purpose: "PRICE_WATCH",
        frequency: {
          cartRemindersForThisCart: 0,
          cartRemindersTotal: 0,
          lastMarketingSentAt: new Date(
            MIDDAY_SAO_PAULO.getTime() - MARKETING_MINIMUM_INTERVAL_MS,
          ),
        },
      }),
    );
    expect(decision.allowed).toBe(true);
  });

  it("o intervalo de marketing não trava aviso transacional de pedido", () => {
    const decision = shouldRemind(
      baseInput({
        purpose: "ORDER_UPDATE",
        consent: null,
        frequency: {
          cartRemindersForThisCart: 0,
          cartRemindersTotal: 0,
          lastMarketingSentAt: MIDDAY_SAO_PAULO,
        },
      }),
    );
    expect(decision.allowed).toBe(true);
  });
});

describe("shouldRemind — dedupe e estado do assunto", () => {
  it("bloqueia quando a mesma chave de dedupe já disparou", () => {
    const decision = shouldRemind(baseInput({ dedupeKeyAlreadyUsed: true }));
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("DEDUPE_KEY_ALREADY_USED");
  });

  it("bloqueia quando o carrinho já foi retomado", () => {
    const decision = shouldRemind(
      baseInput({
        subject: {
          cartRecovered: true,
          cartItemCount: 2,
          listingPublished: true,
          priceAvailable: true,
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("CART_ALREADY_RECOVERED");
  });

  it("bloqueia quando o item foi removido e o carrinho ficou vazio", () => {
    const decision = shouldRemind(
      baseInput({
        subject: {
          cartRecovered: false,
          cartItemCount: 0,
          listingPublished: true,
          priceAvailable: true,
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("CART_EMPTY");
  });

  it("bloqueia aviso de preço quando o anúncio foi despublicado", () => {
    const decision = shouldRemind(
      baseInput({
        purpose: "PRICE_WATCH",
        subject: {
          cartRecovered: false,
          cartItemCount: 0,
          listingPublished: false,
          priceAvailable: true,
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("LISTING_UNPUBLISHED");
  });

  it("bloqueia aviso de preço quando o preço não está disponível para ser citado", () => {
    const decision = shouldRemind(
      baseInput({
        purpose: "PRICE_WATCH",
        subject: {
          cartRecovered: false,
          cartItemCount: 0,
          listingPublished: true,
          priceAvailable: false,
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("PRICE_UNAVAILABLE");
  });

  it("bloqueia volta-ao-estoque quando o anúncio saiu do ar", () => {
    const decision = shouldRemind(
      baseInput({
        purpose: "STOCK_WATCH",
        subject: {
          cartRecovered: false,
          cartItemCount: 0,
          listingPublished: false,
          priceAvailable: false,
        },
      }),
    );
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(decision.reason).toBe("LISTING_UNPUBLISHED");
  });
});

describe("garantias estruturais da política", () => {
  it("toda supressão devolve motivo nomeado do enum, nunca booleano mudo", () => {
    const decision = shouldRemind(baseInput({ consent: null }));
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("esperava supressão");
    expect(REMINDER_SUPPRESSION_REASONS).toContain(decision.reason);
  });

  it("todo motivo do enum tem mensagem pt-BR", () => {
    for (const reason of REMINDER_SUPPRESSION_REASONS) {
      expect(REMINDER_SUPPRESSION_MESSAGES[reason].length).toBeGreaterThan(0);
    }
  });

  it("as regras de frequência são dado exportado, não condicional escondida", () => {
    expect(REMINDER_FREQUENCY_LIMITS.cartRecoveryPerCart).toBe(1);
    expect(REMINDER_FREQUENCY_LIMITS.cartRecoveryPerUserTotal).toBe(2);
    expect(REMINDER_FREQUENCY_LIMITS.marketingMinimumIntervalHours).toBe(72);
    expect(MARKETING_MINIMUM_INTERVAL_MS).toBe(72 * 60 * 60 * 1_000);
    expect(QUIET_HOURS_WINDOW).toEqual({ startHour: 21, endHour: 9 });
  });
});

describe("auxiliares puros", () => {
  it("hourInTimeZone respeita o fuso", () => {
    expect(hourInTimeZone(NIGHT_SAO_PAULO, SAO_PAULO)).toBe(22);
    expect(hourInTimeZone(NIGHT_SAO_PAULO, "UTC")).toBe(1);
  });

  it("hourInTimeZone lança em fuso inválido", () => {
    expect(() => hourInTimeZone(NIGHT_SAO_PAULO, "Marte/Olympus_Mons")).toThrow();
  });

  it("isWithinQuietHours cobre a virada da meia-noite", () => {
    expect(isWithinQuietHours(20)).toBe(false);
    expect(isWithinQuietHours(21)).toBe(true);
    expect(isWithinQuietHours(23)).toBe(true);
    expect(isWithinQuietHours(0)).toBe(true);
    expect(isWithinQuietHours(8)).toBe(true);
    expect(isWithinQuietHours(9)).toBe(false);
  });

  it("quietHoursApply só vale para marketing em canal que sai do produto", () => {
    expect(quietHoursApply("CART_RECOVERY", "EMAIL")).toBe(true);
    expect(quietHoursApply("PRICE_WATCH", "PUSH")).toBe(true);
    expect(quietHoursApply("CART_RECOVERY", "IN_APP")).toBe(false);
    expect(quietHoursApply("ORDER_UPDATE", "EMAIL")).toBe(false);
  });

  it("evaluateConsentState distingue ausente, revogado e concedido", () => {
    expect(evaluateConsentState(null)).toBe("MISSING");
    expect(evaluateConsentState(grantedConsent)).toBe("GRANTED");
    expect(evaluateConsentState(revokedConsent)).toBe("REVOKED");
    expect(
      evaluateConsentState({
        granted: true,
        grantedAt: new Date("2026-08-01T00:00:00.000Z"),
        revokedAt: new Date("2026-08-05T00:00:00.000Z"),
        policyVersion: "x",
      }),
    ).toBe("REVOKED");
  });
});
