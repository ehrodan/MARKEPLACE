import { describe, expect, it } from "vitest";
import {
  assignReplayAccountLevel,
  calculateReplayLeaderboardScore,
  ContributionInvariantError,
  createCompensatingContribution,
  createEligibleSaleContribution,
  createLeaderboardPolicyVersion,
  createListingCommercialSnapshot,
  createListingPlanPolicyVersion,
  decidePremium10BadgeAward,
  IdempotencyConflictError,
  PREMIUM_10_BADGE_CODE,
  projectReplayAccountLevel,
  replaySellerContributions,
  INITIAL_LISTING_PLAN_POLICY,
  type CompensationReason,
  type ListingPlanCode,
  type ProgressionContribution,
} from "../src/index.js";

const SELLER_ACCOUNT_ID = "seller-account-01";
const ACCEPTED_AT = "2026-08-01T00:00:00.000Z";
const OCCURRED_AT = "2026-08-23T12:00:00.000Z";

function sale(
  orderId: string,
  amountMinor: number,
  planCode: ListingPlanCode = "BASIC",
  eventId = `sale:${orderId}`,
): ProgressionContribution {
  return createEligibleSaleContribution({
    eventId,
    sellerAccountId: SELLER_ACCOUNT_ID,
    orderId,
    eligibleGmvDeltaMinor: amountMinor,
    occurredAt: OCCURRED_AT,
    planSnapshot: createListingCommercialSnapshot({ planCode, acceptedAt: ACCEPTED_AT }),
  });
}

function compensation(
  orderId: string,
  amountMinor: number,
  reason: CompensationReason = "REFUND",
  eventId = `${reason.toLowerCase()}:${orderId}:${String(amountMinor)}`,
): ProgressionContribution {
  return createCompensatingContribution({
    eventId,
    sellerAccountId: SELLER_ACCOUNT_ID,
    orderId,
    eligibleGmvDeltaMinor: -amountMinor,
    reason,
    occurredAt: "2026-08-25T12:00:00.000Z",
  });
}

describe("replay idempotente de contribuições", () => {
  it("ignora retry idêntico sem duplicar dinheiro nem mudar o checksum canônico", () => {
    const event = sale("order-01", 10_000, "PREMIUM");
    const once = replaySellerContributions(SELLER_ACCOUNT_ID, [event]);
    const retried = replaySellerContributions(SELLER_ACCOUNT_ID, [event, event]);

    expect(retried).toMatchObject({
      eligibleGmvMinor: 10_000,
      eligiblePremiumGmvMinor: 10_000,
      appliedEventCount: 1,
      ignoredDuplicateEventCount: 1,
    });
    expect(retried.checksum).toBe(once.checksum);
  });

  it("rejeita o mesmo eventId com conteúdo divergente", () => {
    expect(() => replaySellerContributions(SELLER_ACCOUNT_ID, [
      sale("order-01", 1_000, "BASIC", "same-event"),
      sale("order-02", 1_000, "BASIC", "same-event"),
    ])).toThrow(IdempotencyConflictError);
  });

  it("produz o mesmo resultado e checksum independentemente da ordem de chegada", () => {
    const events = [
      compensation("order-b", 250),
      sale("order-a", 500, "BASIC"),
      sale("order-b", 750, "PREMIUM"),
    ];
    const forward = replaySellerContributions(SELLER_ACCOUNT_ID, events);
    const reversed = replaySellerContributions(SELLER_ACCOUNT_ID, [...events].reverse());

    expect(reversed).toEqual(forward);
    expect(reversed.checksum).toBe(forward.checksum);
  });

  it("aplica refund compensatório sem apagar a venda original", () => {
    const replay = replaySellerContributions(SELLER_ACCOUNT_ID, [
      sale("order-01", 10_001, "PREMIUM"),
      compensation("order-01", 1),
    ]);

    expect(replay).toMatchObject({
      eligibleGmvMinor: 10_000,
      eligiblePremiumGmvMinor: 10_000,
      compensatedGmvMinor: 1,
      appliedEventCount: 2,
      qualifyingPremiumSales: 0,
    });
    expect(replay.orderBalances[0]).toMatchObject({
      originalEligibleGmvMinor: 10_001,
      compensatedGmvMinor: 1,
      eligibleGmvMinor: 10_000,
      sourceEventIds: ["refund:order-01:1", "sale:order-01"],
    });
    expect(assignReplayAccountLevel(replay).level).toBe("L1");
    expect(projectReplayAccountLevel({ replay, asOf: "2026-08-31T23:59:59.999Z" })).toMatchObject({
      sellerAccountId: SELLER_ACCOUNT_ID,
      level: "L1",
      asOf: "2026-08-31T23:59:59.999Z",
      contributionChecksum: replay.checksum,
    });
  });

  it("agrega GMV antes do floor do ranking", () => {
    const basicReplay = replaySellerContributions(SELLER_ACCOUNT_ID, [
      sale("order-01", 500),
      sale("order-02", 500),
    ]);
    const premiumReplay = replaySellerContributions(SELLER_ACCOUNT_ID, [
      sale("order-03", 50, "PREMIUM"),
      sale("order-04", 50, "PREMIUM"),
    ]);

    expect(calculateReplayLeaderboardScore(basicReplay)).toMatchObject({
      baseHalfPoints: 2,
      premiumBonusHalfPoints: 0,
      totalHalfPoints: 2,
    });
    expect(calculateReplayLeaderboardScore(premiumReplay)).toMatchObject({
      baseHalfPoints: 0,
      premiumBonusHalfPoints: 1,
      totalHalfPoints: 1,
    });
  });

  it.each([
    ["BASIC", 20],
    ["VIP", 20],
    ["PREMIUM", 120],
  ] as const)("reproduz R$100 no plano %s em half-points", (planCode, totalHalfPoints) => {
    const replay = replaySellerContributions(SELLER_ACCOUNT_ID, [
      sale(`order-${planCode}`, 10_000, planCode),
    ]);
    expect(calculateReplayLeaderboardScore(replay).totalHalfPoints).toBe(totalHalfPoints);
  });

  it("falha fechado ao tentar reprecificar snapshot com fórmula de outra versão", () => {
    const replay = replaySellerContributions(SELLER_ACCOUNT_ID, [
      sale("order-01", 10_000, "PREMIUM"),
    ]);
    const incompatiblePolicy = createLeaderboardPolicyVersion({
      version: "leaderboard-brl.v2",
      baseMinorPerPoint: 1_000,
      premiumBonusHalfPointsPerWholeBrl: 2,
    });

    expect(() => calculateReplayLeaderboardScore(replay, incompatiblePolicy)).toThrow(
      ContributionInvariantError,
    );
  });

  it("aceita nova versão explícita do multiplicador sem hardcode retroativo", () => {
    const leaderboardV2 = createLeaderboardPolicyVersion({
      version: "leaderboard-brl.v2",
      baseMinorPerPoint: 1_000,
      premiumBonusHalfPointsPerWholeBrl: 2,
    });
    const listingV2 = createListingPlanPolicyVersion({
      version: "listing-plan-brl.v2",
      leaderboardPolicyVersion: leaderboardV2.version,
      definitions: INITIAL_LISTING_PLAN_POLICY.definitions.map((definition) => (
        definition.code === "PREMIUM"
          ? { ...definition, premiumBonusHalfPointsPerWholeBrl: 2 }
          : { ...definition }
      )),
    });
    const contribution = createEligibleSaleContribution({
      eventId: "premium-v2-sale",
      sellerAccountId: SELLER_ACCOUNT_ID,
      orderId: "premium-v2-order",
      eligibleGmvDeltaMinor: 10_000,
      occurredAt: OCCURRED_AT,
      planSnapshot: createListingCommercialSnapshot({
        policy: listingV2,
        planCode: "PREMIUM",
        acceptedAt: ACCEPTED_AT,
      }),
    });
    const replay = replaySellerContributions(SELLER_ACCOUNT_ID, [contribution]);

    expect(calculateReplayLeaderboardScore(replay, leaderboardV2)).toMatchObject({
      baseHalfPoints: 20,
      premiumBonusHalfPoints: 200,
      totalHalfPoints: 220,
    });
  });

  it("rejeita compensação órfã, venda duplicada por pedido e sobrecompensação", () => {
    expect(() => replaySellerContributions(SELLER_ACCOUNT_ID, [
      compensation("orphan", 100),
    ])).toThrow(/exatamente uma contribuição/i);

    expect(() => replaySellerContributions(SELLER_ACCOUNT_ID, [
      sale("duplicate", 100, "BASIC", "sale-1"),
      sale("duplicate", 100, "BASIC", "sale-2"),
    ])).toThrow(/exatamente uma contribuição/i);

    expect(() => replaySellerContributions(SELLER_ACCOUNT_ID, [
      sale("over", 100),
      compensation("over", 101),
    ])).toThrow(/excedem a venda elegível original/i);
  });

  it("rejeita contribuição de outro SellerAccount", () => {
    const foreign = createEligibleSaleContribution({
      eventId: "foreign-event",
      sellerAccountId: "seller-account-02",
      orderId: "foreign-order",
      eligibleGmvDeltaMinor: 100,
      occurredAt: OCCURRED_AT,
      planSnapshot: createListingCommercialSnapshot({
        planCode: "BASIC",
        acceptedAt: ACCEPTED_AT,
      }),
    });
    expect(() => replaySellerContributions(SELLER_ACCOUNT_ID, [foreign])).toThrow(/outro SellerAccount/i);
  });

  it("aceita CANCELLATION como contribuição compensatória explícita", () => {
    const replay = replaySellerContributions(SELLER_ACCOUNT_ID, [
      sale("cancelled-order", 1_000),
      compensation("cancelled-order", 1_000, "CANCELLATION"),
    ]);
    expect(replay).toMatchObject({
      eligibleGmvMinor: 0,
      compensatedGmvMinor: 1_000,
    });
  });
});

describe("marco de dez vendas Premium únicas", () => {
  const tenPremiumSales = Array.from({ length: 10 }, (_, index) => (
    sale(`premium-${String(index + 1).padStart(2, "0")}`, 100, "PREMIUM")
  ));

  it("concede uma candidata idempotente somente na décima venda distinta", () => {
    const nine = replaySellerContributions(SELLER_ACCOUNT_ID, tenPremiumSales.slice(0, 9));
    expect(decidePremium10BadgeAward({
      replay: nine,
      campaignVersion: "premium-10-completed-sales.v1",
      badgeDefinitionVersion: "premium-badge-art.v1",
    })).toBeNull();

    const ten = replaySellerContributions(SELLER_ACCOUNT_ID, tenPremiumSales);
    const candidate = decidePremium10BadgeAward({
      replay: ten,
      campaignVersion: "premium-10-completed-sales.v1",
      badgeDefinitionVersion: "premium-badge-art.v1",
    });
    expect(candidate).toMatchObject({
      badgeCode: PREMIUM_10_BADGE_CODE,
      campaignVersion: "premium-10-completed-sales.v1",
      badgeDefinitionVersion: "premium-badge-art.v1",
      sellerAccountId: SELLER_ACCOUNT_ID,
    });
    expect(candidate?.sourceOrderIds).toHaveLength(10);
    expect(Object.isFrozen(candidate)).toBe(true);
    expect(Object.isFrozen(candidate?.sourceOrderIds)).toBe(true);

    const existingAwardKeys = new Set(candidate ? [candidate.awardKey] : []);
    expect(decidePremium10BadgeAward({
      replay: ten,
      campaignVersion: "premium-10-completed-sales.v1",
      badgeDefinitionVersion: "premium-badge-art.v1",
      existingAwardKeys,
    })).toBeNull();
  });

  it("refund anterior ao grant reduz a contagem sem apagar os fatos", () => {
    const replay = replaySellerContributions(SELLER_ACCOUNT_ID, [
      ...tenPremiumSales,
      compensation("premium-10", 1),
    ]);
    expect(replay.qualifyingPremiumSales).toBe(9);
    expect(replay.appliedEventCount).toBe(11);
    expect(decidePremium10BadgeAward({
      replay,
      campaignVersion: "premium-10-completed-sales.v1",
      badgeDefinitionVersion: "premium-badge-art.v1",
    })).toBeNull();
  });

  it("isola a contagem por versão de campanha sem conflitar snapshots coexistentes", () => {
    const campaignV2 = "premium-10-completed-sales.v2";
    const listingV2 = createListingPlanPolicyVersion({
      version: "listing-plan-badge.v2",
      leaderboardPolicyVersion: "leaderboard-brl.v1",
      definitions: INITIAL_LISTING_PLAN_POLICY.definitions.map((definition) => (
        definition.code === "PREMIUM"
          ? { ...definition, premiumBadgeCampaignVersion: campaignV2 }
          : { ...definition }
      )),
    });
    const nineV2 = Array.from({ length: 9 }, (_, index) => createEligibleSaleContribution({
      eventId: `campaign-v2-sale-${String(index + 1)}`,
      sellerAccountId: SELLER_ACCOUNT_ID,
      orderId: `campaign-v2-order-${String(index + 1)}`,
      eligibleGmvDeltaMinor: 100,
      occurredAt: OCCURRED_AT,
      planSnapshot: createListingCommercialSnapshot({
        policy: listingV2,
        planCode: "PREMIUM",
        acceptedAt: ACCEPTED_AT,
      }),
    }));
    const replay = replaySellerContributions(SELLER_ACCOUNT_ID, [...tenPremiumSales, ...nineV2]);

    expect(decidePremium10BadgeAward({
      replay,
      campaignVersion: "premium-10-completed-sales.v1",
      badgeDefinitionVersion: "premium-badge-art.v1",
    })?.sourceOrderIds).toHaveLength(10);
    expect(decidePremium10BadgeAward({
      replay,
      campaignVersion: campaignV2,
      badgeDefinitionVersion: "premium-badge-art.v2",
    })).toBeNull();
  });
});
