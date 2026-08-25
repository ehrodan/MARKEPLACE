import { describe, expect, it } from "vitest";
import type { ActorContext } from "@midas/kernel";
import {
  CONSENT_POLICY_VERSION,
  assertRetentionActor,
  buildConsentEvidence,
  evaluateConsentState,
  requiresExplicitConsent,
  toConsentFact,
} from "./consent.js";
import type { ReminderConsentRow } from "./schema.js";

const NOW = new Date("2026-08-24T17:00:00.000Z");

function actor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    correlationId: "01923f4c-0000-7000-8000-000000000001",
    actorUserId: "01923f4c-0000-7000-8000-00000000aaaa",
    ...overrides,
  };
}

function consentRow(overrides: Partial<ReminderConsentRow> = {}): ReminderConsentRow {
  return {
    reminderConsentId: "01923f4c-0000-7000-8000-00000000cccc",
    userId: "01923f4c-0000-7000-8000-00000000aaaa",
    channel: "EMAIL",
    purpose: "CART_RECOVERY",
    granted: true,
    grantedAt: NOW,
    revokedAt: null,
    policyVersion: CONSENT_POLICY_VERSION,
    evidence: {},
    recordedAt: NOW,
    ...overrides,
  };
}

describe("requiresExplicitConsent", () => {
  it("exige consentimento para marketing em canal que sai do produto", () => {
    expect(requiresExplicitConsent("CART_RECOVERY", "EMAIL")).toBe(true);
    expect(requiresExplicitConsent("CART_RECOVERY", "PUSH")).toBe(true);
    expect(requiresExplicitConsent("PRICE_WATCH", "EMAIL")).toBe(true);
    expect(requiresExplicitConsent("STOCK_WATCH", "PUSH")).toBe(true);
  });

  it("não exige consentimento de marketing para aviso transacional de pedido", () => {
    expect(requiresExplicitConsent("ORDER_UPDATE", "EMAIL")).toBe(false);
    expect(requiresExplicitConsent("ORDER_UPDATE", "PUSH")).toBe(false);
    expect(requiresExplicitConsent("ORDER_UPDATE", "IN_APP")).toBe(false);
  });

  it("não exige consentimento de marketing no feed in-app, que a pessoa consulta", () => {
    expect(requiresExplicitConsent("CART_RECOVERY", "IN_APP")).toBe(false);
    expect(requiresExplicitConsent("PRICE_WATCH", "IN_APP")).toBe(false);
  });
});

describe("evaluateConsentState — ausência é NÃO", () => {
  it("sem linha registrada o estado é MISSING; nada é presumido concedido", () => {
    expect(evaluateConsentState(null)).toBe("MISSING");
    expect(evaluateConsentState(toConsentFact(undefined))).toBe("MISSING");
  });

  it("linha de concessão viva é GRANTED", () => {
    expect(evaluateConsentState(toConsentFact(consentRow()))).toBe("GRANTED");
  });

  it("linha de revogação é REVOKED", () => {
    const revoked = consentRow({ granted: false, grantedAt: null, revokedAt: NOW });
    expect(evaluateConsentState(toConsentFact(revoked))).toBe("REVOKED");
  });

  it("granted=true com revokedAt preenchido continua REVOKED — revogação vence", () => {
    const inconsistent = consentRow({ revokedAt: NOW });
    expect(evaluateConsentState(toConsentFact(inconsistent))).toBe("REVOKED");
  });

  it("granted=false sem data de revogação também não libera envio", () => {
    const halfBaked = consentRow({ granted: false, grantedAt: null, revokedAt: null });
    expect(evaluateConsentState(toConsentFact(halfBaked))).toBe("REVOKED");
  });

  it("linha sem grantedAt não vale como consentimento", () => {
    const noTimestamp = consentRow({ grantedAt: null });
    expect(evaluateConsentState(toConsentFact(noTimestamp))).toBe("MISSING");
  });
});

describe("buildConsentEvidence", () => {
  it("registra origem, correlação e instante do consentimento", () => {
    const evidence = buildConsentEvidence({
      actor: actor(),
      source: "web:/conta/notificacoes",
      recordedAt: NOW,
    });
    expect(evidence.source).toBe("web:/conta/notificacoes");
    expect(evidence.correlationId).toBe("01923f4c-0000-7000-8000-000000000001");
    expect(evidence.recordedAt).toBe(NOW.toISOString());
  });

  it("inclui pistas de origem só quando existirem, sem inventar campo", () => {
    const semPistas = buildConsentEvidence({
      actor: actor(),
      source: "web:/conta/notificacoes",
      recordedAt: NOW,
    });
    expect("ipPrefix" in semPistas).toBe(false);
    expect("userAgentFamily" in semPistas).toBe(false);

    const comPistas = buildConsentEvidence({
      actor: actor({ ipPrefix: "203.0.113.0/24", userAgentFamily: "Firefox" }),
      source: "web:/conta/notificacoes",
      recordedAt: NOW,
    });
    expect(comPistas.ipPrefix).toBe("203.0.113.0/24");
    expect(comPistas.userAgentFamily).toBe("Firefox");
  });

  it("aceita evidência adicional do chamador, como o texto aceito", () => {
    const evidence = buildConsentEvidence({
      actor: actor(),
      source: "email:unsubscribe-link",
      recordedAt: NOW,
      extra: { checkboxLabel: "Quero ser avisado quando o preço cair" },
    });
    expect(evidence.checkboxLabel).toBe("Quero ser avisado quando o preço cair");
  });
});

describe("assertRetentionActor — dado pessoal é da própria pessoa", () => {
  it("exige sessão", () => {
    expect(() =>
      assertRetentionActor(
        { correlationId: "01923f4c-0000-7000-8000-000000000001" },
        "01923f4c-0000-7000-8000-00000000aaaa",
      ),
    ).toThrow(/sessão/i);
  });

  it("recusa agir sobre consentimento de outra pessoa", () => {
    expect(() =>
      assertRetentionActor(actor(), "01923f4c-0000-7000-8000-00000000bbbb"),
    ).toThrow(/própria pessoa/i);
  });

  it("devolve o id quando é a própria pessoa", () => {
    expect(assertRetentionActor(actor(), "01923f4c-0000-7000-8000-00000000aaaa")).toBe(
      "01923f4c-0000-7000-8000-00000000aaaa",
    );
  });
});

describe("versão de política", () => {
  it("toda decisão de consentimento carrega versão explícita", () => {
    expect(CONSENT_POLICY_VERSION).toMatch(/^retention-consent@\d+\.\d+\.\d+$/);
  });
});
