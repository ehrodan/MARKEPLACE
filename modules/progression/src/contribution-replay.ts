import {
  assignAccountLevel,
  INITIAL_ACCOUNT_LEVEL_POLICY,
  type AccountLevelAssignment,
  type AccountLevelPolicyVersion,
} from "./level-policy.js";
import {
  calculateLeaderboardScore,
  INITIAL_LEADERBOARD_POLICY,
  type LeaderboardPolicyVersion,
  type LeaderboardScore,
} from "./leaderboard-policy.js";
import {
  assertListingCommercialSnapshot,
  copyListingCommercialSnapshot,
  type ListingCommercialSnapshot,
} from "./listing-plan-policy.js";
import { addMinorBrl, assertIsoInstant, assertMinorBrl, assertNonEmptyVersion } from "./money.js";

export type CompensationReason = "CANCELLATION" | "REFUND" | "CHARGEBACK" | "FRAUD_REVERSAL";

export interface EligibleSaleContribution {
  readonly kind: "ELIGIBLE_SALE";
  readonly eventId: string;
  readonly sellerAccountId: string;
  readonly orderId: string;
  readonly eligibleGmvDeltaMinor: number;
  readonly occurredAt: string;
  readonly planSnapshot: ListingCommercialSnapshot;
}

export interface CompensatingContribution {
  readonly kind: "COMPENSATION";
  readonly eventId: string;
  readonly sellerAccountId: string;
  readonly orderId: string;
  readonly eligibleGmvDeltaMinor: number;
  readonly reason: CompensationReason;
  readonly occurredAt: string;
}

export type ProgressionContribution = EligibleSaleContribution | CompensatingContribution;

export interface ReplayedOrderBalance {
  readonly orderId: string;
  readonly originalEligibleGmvMinor: number;
  readonly compensatedGmvMinor: number;
  readonly eligibleGmvMinor: number;
  readonly planSnapshot: ListingCommercialSnapshot;
  readonly sourceEventIds: readonly string[];
}

export interface SellerProgressionReplay {
  readonly sellerAccountId: string;
  readonly eligibleGmvMinor: number;
  readonly eligiblePremiumGmvMinor: number;
  readonly compensatedGmvMinor: number;
  readonly qualifyingPremiumSales: number;
  readonly qualifyingPremiumOrderIds: readonly string[];
  readonly orderBalances: readonly ReplayedOrderBalance[];
  readonly appliedEventCount: number;
  readonly ignoredDuplicateEventCount: number;
  readonly checksum: string;
}

export interface PremiumBadgeAwardCandidate {
  readonly awardKey: string;
  readonly badgeCode: typeof PREMIUM_10_BADGE_CODE;
  readonly campaignVersion: string;
  readonly badgeDefinitionVersion: string;
  readonly sellerAccountId: string;
  readonly sourceOrderIds: readonly string[];
}

export interface SellerAccountLevelProjection extends AccountLevelAssignment {
  readonly sellerAccountId: string;
  readonly asOf: string;
  readonly contributionChecksum: string;
}

export class IdempotencyConflictError extends Error {
  public constructor(eventId: string) {
    super(`O eventId ${eventId} foi reutilizado com conteúdo diferente.`);
    this.name = "IdempotencyConflictError";
  }
}

export class ContributionInvariantError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ContributionInvariantError";
  }
}

export const PREMIUM_10_BADGE_CODE = "PREMIUM_10_COMPLETED_SALES" as const;

const compensationReasons: readonly CompensationReason[] = Object.freeze([
  "CANCELLATION",
  "REFUND",
  "CHARGEBACK",
  "FRAUD_REVERSAL",
]);

function assertIdentifier(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new TypeError(`${fieldName} não pode ser vazio.`);
  }
}

function assertNegativeMinor(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value) || value >= 0) {
    throw new RangeError(`${fieldName} deve ser um inteiro seguro negativo em centavos de BRL.`);
  }
}

function assertCompensationReason(value: CompensationReason): void {
  if (!compensationReasons.includes(value)) {
    throw new TypeError(`Motivo de compensação desconhecido: ${value}.`);
  }
}

export function createEligibleSaleContribution(input: {
  readonly eventId: string;
  readonly sellerAccountId: string;
  readonly orderId: string;
  readonly eligibleGmvDeltaMinor: number;
  readonly occurredAt: string;
  readonly planSnapshot: ListingCommercialSnapshot;
}): EligibleSaleContribution {
  assertIdentifier(input.eventId, "eventId");
  assertIdentifier(input.sellerAccountId, "sellerAccountId");
  assertIdentifier(input.orderId, "orderId");
  assertMinorBrl(input.eligibleGmvDeltaMinor, "eligibleGmvDeltaMinor");
  if (input.eligibleGmvDeltaMinor === 0) {
    throw new RangeError("Uma venda elegível deve contribuir valor positivo.");
  }
  assertIsoInstant(input.occurredAt, "occurredAt");

  return Object.freeze({
    kind: "ELIGIBLE_SALE" as const,
    eventId: input.eventId,
    sellerAccountId: input.sellerAccountId,
    orderId: input.orderId,
    eligibleGmvDeltaMinor: input.eligibleGmvDeltaMinor,
    occurredAt: input.occurredAt,
    planSnapshot: copyListingCommercialSnapshot(input.planSnapshot),
  });
}

export function createCompensatingContribution(input: {
  readonly eventId: string;
  readonly sellerAccountId: string;
  readonly orderId: string;
  readonly eligibleGmvDeltaMinor: number;
  readonly reason: CompensationReason;
  readonly occurredAt: string;
}): CompensatingContribution {
  assertIdentifier(input.eventId, "eventId");
  assertIdentifier(input.sellerAccountId, "sellerAccountId");
  assertIdentifier(input.orderId, "orderId");
  assertNegativeMinor(input.eligibleGmvDeltaMinor, "eligibleGmvDeltaMinor");
  assertCompensationReason(input.reason);
  assertIsoInstant(input.occurredAt, "occurredAt");

  return Object.freeze({
    kind: "COMPENSATION" as const,
    eventId: input.eventId,
    sellerAccountId: input.sellerAccountId,
    orderId: input.orderId,
    eligibleGmvDeltaMinor: input.eligibleGmvDeltaMinor,
    reason: input.reason,
    occurredAt: input.occurredAt,
  });
}

function assertContribution(contribution: ProgressionContribution): void {
  assertIdentifier(contribution.eventId, "eventId");
  assertIdentifier(contribution.sellerAccountId, "sellerAccountId");
  assertIdentifier(contribution.orderId, "orderId");
  assertIsoInstant(contribution.occurredAt, "occurredAt");

  if (contribution.kind === "ELIGIBLE_SALE") {
    assertMinorBrl(contribution.eligibleGmvDeltaMinor, "eligibleGmvDeltaMinor");
    if (contribution.eligibleGmvDeltaMinor === 0) {
      throw new RangeError("Uma venda elegível deve contribuir valor positivo.");
    }
    assertListingCommercialSnapshot(contribution.planSnapshot);
    return;
  }

  assertNegativeMinor(contribution.eligibleGmvDeltaMinor, "eligibleGmvDeltaMinor");
  assertCompensationReason(contribution.reason);
}

function contributionFingerprint(contribution: ProgressionContribution): string {
  if (contribution.kind === "ELIGIBLE_SALE") {
    const snapshot = contribution.planSnapshot;
    return JSON.stringify([
      contribution.kind,
      contribution.eventId,
      contribution.sellerAccountId,
      contribution.orderId,
      contribution.eligibleGmvDeltaMinor,
      contribution.occurredAt,
      snapshot.planPolicyVersion,
      snapshot.leaderboardPolicyVersion,
      snapshot.planCode,
      snapshot.currency,
      snapshot.platformFeeRateBps,
      snapshot.exposurePriority,
      snapshot.queuePriority,
      snapshot.premiumBonusHalfPointsPerWholeBrl,
      snapshot.premiumBadgeCampaignVersion,
      snapshot.premiumBadgeRequiredSales,
      snapshot.acceptedAt,
    ]);
  }

  return JSON.stringify([
    contribution.kind,
    contribution.eventId,
    contribution.sellerAccountId,
    contribution.orderId,
    contribution.eligibleGmvDeltaMinor,
    contribution.reason,
    contribution.occurredAt,
  ]);
}

function fnv1a64(value: string): string {
  let hash = 14_695_981_039_346_656_037n;
  const prime = 1_099_511_628_211n;
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

export function replaySellerContributions(
  sellerAccountId: string,
  contributions: readonly ProgressionContribution[],
): SellerProgressionReplay {
  assertIdentifier(sellerAccountId, "sellerAccountId");

  const fingerprintsByEventId = new Map<string, string>();
  const uniqueContributions: ProgressionContribution[] = [];
  let ignoredDuplicateEventCount = 0;

  for (const contribution of contributions) {
    assertContribution(contribution);
    if (contribution.sellerAccountId !== sellerAccountId) {
      throw new ContributionInvariantError(
        `A contribuição ${contribution.eventId} pertence a outro SellerAccount.`,
      );
    }

    const fingerprint = contributionFingerprint(contribution);
    const previousFingerprint = fingerprintsByEventId.get(contribution.eventId);
    if (previousFingerprint !== undefined) {
      if (previousFingerprint !== fingerprint) {
        throw new IdempotencyConflictError(contribution.eventId);
      }
      ignoredDuplicateEventCount += 1;
      continue;
    }

    fingerprintsByEventId.set(contribution.eventId, fingerprint);
    uniqueContributions.push(contribution);
  }

  const contributionsByOrder = new Map<string, ProgressionContribution[]>();
  for (const contribution of uniqueContributions) {
    const orderContributions = contributionsByOrder.get(contribution.orderId) ?? [];
    orderContributions.push(contribution);
    contributionsByOrder.set(contribution.orderId, orderContributions);
  }

  const orderBalances: ReplayedOrderBalance[] = [];
  let eligibleGmvMinor = 0;
  let eligiblePremiumGmvMinor = 0;
  let compensatedGmvMinor = 0;
  const qualifyingPremiumOrderIds: string[] = [];

  for (const orderId of [...contributionsByOrder.keys()].sort()) {
    const orderContributions = contributionsByOrder.get(orderId);
    if (!orderContributions) {
      throw new ContributionInvariantError(`Não foi possível reconstruir o pedido ${orderId}.`);
    }
    const sales = orderContributions.filter(
      (contribution): contribution is EligibleSaleContribution => contribution.kind === "ELIGIBLE_SALE",
    );
    if (sales.length !== 1) {
      throw new ContributionInvariantError(
        `O pedido ${orderId} deve possuir exatamente uma contribuição ELIGIBLE_SALE.`,
      );
    }
    const sale = sales[0];
    if (!sale) {
      throw new ContributionInvariantError(`O pedido ${orderId} não possui venda elegível.`);
    }

    let orderCompensatedMinor = 0;
    for (const contribution of orderContributions) {
      if (contribution.kind === "COMPENSATION") {
        orderCompensatedMinor = addMinorBrl(
          orderCompensatedMinor,
          -contribution.eligibleGmvDeltaMinor,
          `compensatedGmvMinor(${orderId})`,
        );
      }
    }
    if (orderCompensatedMinor > sale.eligibleGmvDeltaMinor) {
      throw new ContributionInvariantError(
        `As compensações do pedido ${orderId} excedem a venda elegível original.`,
      );
    }

    const orderEligibleGmvMinor = sale.eligibleGmvDeltaMinor - orderCompensatedMinor;
    eligibleGmvMinor = addMinorBrl(eligibleGmvMinor, orderEligibleGmvMinor, "eligibleGmvMinor");
    compensatedGmvMinor = addMinorBrl(
      compensatedGmvMinor,
      orderCompensatedMinor,
      "compensatedGmvMinor",
    );
    if (sale.planSnapshot.planCode === "PREMIUM") {
      eligiblePremiumGmvMinor = addMinorBrl(
        eligiblePremiumGmvMinor,
        orderEligibleGmvMinor,
        "eligiblePremiumGmvMinor",
      );
      if (orderEligibleGmvMinor > 0 && orderCompensatedMinor === 0) {
        qualifyingPremiumOrderIds.push(orderId);
      }
    }

    orderBalances.push(Object.freeze({
      orderId,
      originalEligibleGmvMinor: sale.eligibleGmvDeltaMinor,
      compensatedGmvMinor: orderCompensatedMinor,
      eligibleGmvMinor: orderEligibleGmvMinor,
      planSnapshot: copyListingCommercialSnapshot(sale.planSnapshot),
      sourceEventIds: Object.freeze(orderContributions.map(({ eventId }) => eventId).sort()),
    }));
  }

  const canonicalFingerprints = [...fingerprintsByEventId.values()].sort();
  return Object.freeze({
    sellerAccountId,
    eligibleGmvMinor,
    eligiblePremiumGmvMinor,
    compensatedGmvMinor,
    qualifyingPremiumSales: qualifyingPremiumOrderIds.length,
    qualifyingPremiumOrderIds: Object.freeze([...qualifyingPremiumOrderIds]),
    orderBalances: Object.freeze([...orderBalances]),
    appliedEventCount: uniqueContributions.length,
    ignoredDuplicateEventCount,
    checksum: fnv1a64(JSON.stringify([sellerAccountId, canonicalFingerprints])),
  });
}

export function assignReplayAccountLevel(
  replay: SellerProgressionReplay,
  policy: AccountLevelPolicyVersion = INITIAL_ACCOUNT_LEVEL_POLICY,
): AccountLevelAssignment {
  return assignAccountLevel(replay.eligibleGmvMinor, policy);
}

export function projectReplayAccountLevel(input: {
  readonly replay: SellerProgressionReplay;
  readonly asOf: string;
  readonly policy?: AccountLevelPolicyVersion;
}): SellerAccountLevelProjection {
  assertIsoInstant(input.asOf, "asOf");
  const assignment = assignReplayAccountLevel(
    input.replay,
    input.policy ?? INITIAL_ACCOUNT_LEVEL_POLICY,
  );
  return Object.freeze({
    ...assignment,
    sellerAccountId: input.replay.sellerAccountId,
    asOf: input.asOf,
    contributionChecksum: input.replay.checksum,
  });
}

export function calculateReplayLeaderboardScore(
  replay: SellerProgressionReplay,
  policy: LeaderboardPolicyVersion = INITIAL_LEADERBOARD_POLICY,
): LeaderboardScore {
  for (const order of replay.orderBalances) {
    if (order.planSnapshot.leaderboardPolicyVersion !== policy.version) {
      throw new ContributionInvariantError(
        `O snapshot do pedido ${order.orderId} usa ${order.planSnapshot.leaderboardPolicyVersion}, não ${policy.version}.`,
      );
    }
    const expectedPremiumBonus = order.planSnapshot.planCode === "PREMIUM"
      ? policy.premiumBonusHalfPointsPerWholeBrl
      : 0;
    if (order.planSnapshot.premiumBonusHalfPointsPerWholeBrl !== expectedPremiumBonus) {
      throw new ContributionInvariantError(
        `O snapshot do pedido ${order.orderId} não é compatível com a fórmula ${policy.version}.`,
      );
    }
  }

  return calculateLeaderboardScore({
    eligibleGmvMinor: replay.eligibleGmvMinor,
    eligiblePremiumGmvMinor: replay.eligiblePremiumGmvMinor,
    policy,
  });
}

export function decidePremium10BadgeAward(input: {
  readonly replay: SellerProgressionReplay;
  readonly campaignVersion: string;
  readonly badgeDefinitionVersion: string;
  readonly existingAwardKeys?: ReadonlySet<string>;
}): PremiumBadgeAwardCandidate | null {
  assertNonEmptyVersion(input.campaignVersion);
  assertNonEmptyVersion(input.badgeDefinitionVersion);
  const awardKey = JSON.stringify([
    PREMIUM_10_BADGE_CODE,
    input.campaignVersion,
    input.replay.sellerAccountId,
  ]);
  if (input.existingAwardKeys?.has(awardKey) === true) {
    return null;
  }

  const campaignOrders = input.replay.orderBalances.filter((order) => (
    order.planSnapshot.planCode === "PREMIUM"
    && order.planSnapshot.premiumBadgeCampaignVersion === input.campaignVersion
  ));
  const requiredSalesValues = new Set(
    campaignOrders.flatMap((order) => (
      order.planSnapshot.premiumBadgeRequiredSales === null
        ? []
        : [order.planSnapshot.premiumBadgeRequiredSales]
    )),
  );
  if (requiredSalesValues.size > 1) {
    throw new ContributionInvariantError(
      "Uma mesma campanha Premium não pode possuir marcos divergentes.",
    );
  }
  const [requiredSales] = requiredSalesValues;
  const qualifyingCampaignOrderIds = campaignOrders
    .filter((order) => order.eligibleGmvMinor > 0 && order.compensatedGmvMinor === 0)
    .map(({ orderId }) => orderId);

  if (requiredSales === undefined || qualifyingCampaignOrderIds.length < requiredSales) {
    return null;
  }

  return Object.freeze({
    awardKey,
    badgeCode: PREMIUM_10_BADGE_CODE,
    campaignVersion: input.campaignVersion,
    badgeDefinitionVersion: input.badgeDefinitionVersion,
    sellerAccountId: input.replay.sellerAccountId,
    sourceOrderIds: Object.freeze(qualifyingCampaignOrderIds.slice(0, requiredSales)),
  });
}
