import { describe, expect, it } from "vitest";
import {
  calculateLeaderboardScore,
  calculatePlatformFeeMinor,
  createListingCommercialSnapshot,
  createListingPlanPolicyVersion,
  formatHalfPoints,
  INITIAL_LISTING_PLAN_POLICY,
  type ListingPlanCode,
} from "../src/index.js";

const ACCEPTED_AT = "2026-08-23T12:00:00.000Z";

function snapshot(planCode: ListingPlanCode) {
  return createListingCommercialSnapshot({ planCode, acceptedAt: ACCEPTED_AT });
}

describe("ranking em half-points inteiros", () => {
  it.each(["BASIC", "VIP"] as const)("calcula R$100 no plano %s como 10 pontos", (_planCode) => {
    const score = calculateLeaderboardScore({
      eligibleGmvMinor: 10_000,
      eligiblePremiumGmvMinor: 0,
    });
    expect(score).toMatchObject({
      baseHalfPoints: 20,
      premiumBonusHalfPoints: 0,
      totalHalfPoints: 20,
    });
    expect(formatHalfPoints(score.totalHalfPoints)).toBe("10");
  });

  it("calcula R$100 Premium como 10 base + 50 bônus = 60 pontos", () => {
    const score = calculateLeaderboardScore({
      eligibleGmvMinor: 10_000,
      eligiblePremiumGmvMinor: 10_000,
    });
    expect(score).toMatchObject({
      baseHalfPoints: 20,
      premiumBonusHalfPoints: 100,
      totalHalfPoints: 120,
    });
    expect(formatHalfPoints(score.totalHalfPoints)).toBe("60");
  });

  it("mantém meio ponto sem usar ponto flutuante", () => {
    const score = calculateLeaderboardScore({
      eligibleGmvMinor: 100,
      eligiblePremiumGmvMinor: 100,
    });
    expect(score.totalHalfPoints).toBe(1);
    expect(formatHalfPoints(score.totalHalfPoints)).toBe("0,5");
  });

  it("falha se o GMV Premium exceder o total", () => {
    expect(() => calculateLeaderboardScore({
      eligibleGmvMinor: 999,
      eligiblePremiumGmvMinor: 1_000,
    })).toThrow(/não pode exceder/i);
  });
});

describe("política e snapshot dos planos", () => {
  it("publica exatamente 750, 1000 e 1200 bps", () => {
    const rates = Object.fromEntries(
      INITIAL_LISTING_PLAN_POLICY.definitions.map(({ code, platformFeeRateBps }) => [
        code,
        platformFeeRateBps,
      ]),
    );
    expect(rates).toEqual({ BASIC: 750, VIP: 1_000, PREMIUM: 1_200 });
  });

  it.each([
    ["BASIC", 10_000, 750],
    ["VIP", 10_000, 1_000],
    ["PREMIUM", 10_000, 1_200],
  ] as const)("calcula a taxa %s em centavos", (planCode, grossMinor, expectedFeeMinor) => {
    expect(calculatePlatformFeeMinor(grossMinor, snapshot(planCode))).toBe(expectedFeeMinor);
  });

  it.each([
    ["BASIC", 6, 0],
    ["BASIC", 7, 1],
    ["VIP", 4, 0],
    ["VIP", 5, 1],
    ["PREMIUM", 4, 0],
    ["PREMIUM", 5, 1],
  ] as const)(
    "aplica round-half-up no limite de %s para %i centavos",
    (planCode, grossMinor, expectedFeeMinor) => {
      expect(calculatePlatformFeeMinor(grossMinor, snapshot(planCode))).toBe(expectedFeeMinor);
    },
  );

  it("congela o snapshot e não o reprecifica ao publicar V2", () => {
    const historical = snapshot("PREMIUM");
    const versionTwo = createListingPlanPolicyVersion({
      version: "listing-plan-brl.v2",
      leaderboardPolicyVersion: "leaderboard-brl.v1",
      definitions: INITIAL_LISTING_PLAN_POLICY.definitions.map((definition) => (
        definition.code === "PREMIUM"
          ? { ...definition, platformFeeRateBps: 1_300 }
          : { ...definition }
      )),
    });
    const current = createListingCommercialSnapshot({
      policy: versionTwo,
      planCode: "PREMIUM",
      acceptedAt: "2026-09-01T00:00:00.000Z",
    });

    expect(Object.isFrozen(historical)).toBe(true);
    expect(Reflect.set(historical, "platformFeeRateBps", 9_999)).toBe(false);
    expect(historical).toMatchObject({
      planPolicyVersion: "listing-plan-brl.v1",
      platformFeeRateBps: 1_200,
      premiumBonusHalfPointsPerWholeBrl: 1,
      premiumBadgeCampaignVersion: "premium-10-completed-sales.v1",
      premiumBadgeRequiredSales: 10,
    });
    expect(current).toMatchObject({
      planPolicyVersion: "listing-plan-brl.v2",
      platformFeeRateBps: 1_300,
    });
  });

  it("congela também as definições da policy", () => {
    expect(Object.isFrozen(INITIAL_LISTING_PLAN_POLICY)).toBe(true);
    expect(Object.isFrozen(INITIAL_LISTING_PLAN_POLICY.definitions)).toBe(true);
    expect(INITIAL_LISTING_PLAN_POLICY.definitions.every(Object.isFrozen)).toBe(true);
  });
});
