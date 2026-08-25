import { assertIsoInstant, assertMinorBrl, assertNonEmptyVersion, freezeArray } from "./money.js";

export type ListingPlanCode = "BASIC" | "VIP" | "PREMIUM";
export type ExposurePriority = "STANDARD" | "PRIORITY" | "MAXIMUM";
export type QueuePriority = "STANDARD" | "HIGH" | "MAXIMUM";

export interface ListingPlanDefinition {
  readonly code: ListingPlanCode;
  readonly platformFeeRateBps: number;
  readonly exposurePriority: ExposurePriority;
  readonly queuePriority: QueuePriority;
  readonly premiumBonusHalfPointsPerWholeBrl: number;
  readonly premiumBadgeCampaignVersion: string | null;
  readonly premiumBadgeRequiredSales: number | null;
}

export interface ListingPlanPolicyVersion {
  readonly version: string;
  readonly currency: "BRL";
  readonly leaderboardPolicyVersion: string;
  readonly definitions: readonly ListingPlanDefinition[];
}

export interface ListingCommercialSnapshot {
  readonly planPolicyVersion: string;
  readonly leaderboardPolicyVersion: string;
  readonly planCode: ListingPlanCode;
  readonly currency: "BRL";
  readonly platformFeeRateBps: number;
  readonly exposurePriority: ExposurePriority;
  readonly queuePriority: QueuePriority;
  readonly premiumBonusHalfPointsPerWholeBrl: number;
  readonly premiumBadgeCampaignVersion: string | null;
  readonly premiumBadgeRequiredSales: number | null;
  readonly acceptedAt: string;
}

const orderedPlanCodes: readonly ListingPlanCode[] = Object.freeze(["BASIC", "VIP", "PREMIUM"]);
const exposurePriorities: readonly ExposurePriority[] = Object.freeze([
  "STANDARD",
  "PRIORITY",
  "MAXIMUM",
]);
const queuePriorities: readonly QueuePriority[] = Object.freeze(["STANDARD", "HIGH", "MAXIMUM"]);

function assertBasisPoints(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
    throw new RangeError(`${fieldName} deve ser um inteiro entre 0 e 10000 basis points.`);
  }
}

function assertPlanCode(value: ListingPlanCode): void {
  if (!orderedPlanCodes.includes(value)) {
    throw new TypeError(`Plano desconhecido: ${value}.`);
  }
}

function assertExposurePriority(value: ExposurePriority): void {
  if (!exposurePriorities.includes(value)) {
    throw new TypeError(`Classe de exposição desconhecida: ${value}.`);
  }
}

function assertQueuePriority(value: QueuePriority): void {
  if (!queuePriorities.includes(value)) {
    throw new TypeError(`Classe de fila desconhecida: ${value}.`);
  }
}

function freezeDefinition(definition: ListingPlanDefinition): ListingPlanDefinition {
  assertPlanCode(definition.code);
  assertBasisPoints(definition.platformFeeRateBps, `${definition.code}.platformFeeRateBps`);
  assertExposurePriority(definition.exposurePriority);
  assertQueuePriority(definition.queuePriority);

  if (
    !Number.isSafeInteger(definition.premiumBonusHalfPointsPerWholeBrl)
    || definition.premiumBonusHalfPointsPerWholeBrl < 0
  ) {
    throw new RangeError(
      `${definition.code}.premiumBonusHalfPointsPerWholeBrl deve ser um inteiro seguro não negativo.`,
    );
  }

  if (
    definition.premiumBadgeRequiredSales !== null
    && (!Number.isSafeInteger(definition.premiumBadgeRequiredSales)
      || definition.premiumBadgeRequiredSales <= 0)
  ) {
    throw new RangeError(
      `${definition.code}.premiumBadgeRequiredSales deve ser null ou um inteiro seguro positivo.`,
    );
  }

  if (definition.premiumBadgeCampaignVersion !== null) {
    assertNonEmptyVersion(definition.premiumBadgeCampaignVersion);
  }

  if (
    (definition.premiumBadgeCampaignVersion === null)
    !== (definition.premiumBadgeRequiredSales === null)
  ) {
    throw new RangeError(
      `${definition.code} deve configurar campaignVersion e requiredSales em conjunto.`,
    );
  }

  if (
    definition.code !== "PREMIUM"
    && (definition.premiumBonusHalfPointsPerWholeBrl !== 0
      || definition.premiumBadgeCampaignVersion !== null
      || definition.premiumBadgeRequiredSales !== null)
  ) {
    throw new RangeError("Somente o plano PREMIUM pode carregar bônus ou marco Premium.");
  }

  return Object.freeze({ ...definition });
}

export function createListingPlanPolicyVersion(input: {
  readonly version: string;
  readonly leaderboardPolicyVersion: string;
  readonly definitions: readonly ListingPlanDefinition[];
}): ListingPlanPolicyVersion {
  assertNonEmptyVersion(input.version);
  assertNonEmptyVersion(input.leaderboardPolicyVersion);
  if (input.definitions.length !== orderedPlanCodes.length) {
    throw new RangeError("A política comercial deve definir exatamente BASIC, VIP e PREMIUM.");
  }

  const definitions = input.definitions.map((definition, index) => {
    const expectedCode = orderedPlanCodes[index];
    if (!expectedCode) {
      throw new RangeError("A política recebeu uma definição de plano excedente.");
    }
    if (definition.code !== expectedCode) {
      throw new TypeError(`A definição ${String(index + 1)} deve ser ${expectedCode}.`);
    }
    return freezeDefinition(definition);
  });

  return Object.freeze({
    version: input.version,
    currency: "BRL" as const,
    leaderboardPolicyVersion: input.leaderboardPolicyVersion,
    definitions: freezeArray(definitions),
  });
}

export const INITIAL_LISTING_PLAN_POLICY = createListingPlanPolicyVersion({
  version: "listing-plan-brl.v1",
  leaderboardPolicyVersion: "leaderboard-brl.v1",
  definitions: [
    {
      code: "BASIC",
      platformFeeRateBps: 750,
      exposurePriority: "STANDARD",
      queuePriority: "STANDARD",
      premiumBonusHalfPointsPerWholeBrl: 0,
      premiumBadgeCampaignVersion: null,
      premiumBadgeRequiredSales: null,
    },
    {
      code: "VIP",
      platformFeeRateBps: 1_000,
      exposurePriority: "PRIORITY",
      queuePriority: "HIGH",
      premiumBonusHalfPointsPerWholeBrl: 0,
      premiumBadgeCampaignVersion: null,
      premiumBadgeRequiredSales: null,
    },
    {
      code: "PREMIUM",
      platformFeeRateBps: 1_200,
      exposurePriority: "MAXIMUM",
      queuePriority: "MAXIMUM",
      premiumBonusHalfPointsPerWholeBrl: 1,
      premiumBadgeCampaignVersion: "premium-10-completed-sales.v1",
      premiumBadgeRequiredSales: 10,
    },
  ],
});

export function assertListingCommercialSnapshot(snapshot: ListingCommercialSnapshot): void {
  assertNonEmptyVersion(snapshot.planPolicyVersion);
  assertNonEmptyVersion(snapshot.leaderboardPolicyVersion);
  assertPlanCode(snapshot.planCode);
  assertBasisPoints(snapshot.platformFeeRateBps, "snapshot.platformFeeRateBps");
  assertExposurePriority(snapshot.exposurePriority);
  assertQueuePriority(snapshot.queuePriority);
  assertIsoInstant(snapshot.acceptedAt, "snapshot.acceptedAt");

  freezeDefinition({
    code: snapshot.planCode,
    platformFeeRateBps: snapshot.platformFeeRateBps,
    exposurePriority: snapshot.exposurePriority,
    queuePriority: snapshot.queuePriority,
    premiumBonusHalfPointsPerWholeBrl: snapshot.premiumBonusHalfPointsPerWholeBrl,
    premiumBadgeCampaignVersion: snapshot.premiumBadgeCampaignVersion,
    premiumBadgeRequiredSales: snapshot.premiumBadgeRequiredSales,
  });
}

export function copyListingCommercialSnapshot(
  snapshot: ListingCommercialSnapshot,
): ListingCommercialSnapshot {
  assertListingCommercialSnapshot(snapshot);
  return Object.freeze({ ...snapshot });
}

export function createListingCommercialSnapshot(input: {
  readonly policy?: ListingPlanPolicyVersion;
  readonly planCode: ListingPlanCode;
  readonly acceptedAt: string;
}): ListingCommercialSnapshot {
  const policy = input.policy ?? INITIAL_LISTING_PLAN_POLICY;
  assertIsoInstant(input.acceptedAt, "acceptedAt");
  const definition = policy.definitions.find(({ code }) => code === input.planCode);
  if (!definition) {
    throw new RangeError(`O plano ${input.planCode} não existe na policy ${policy.version}.`);
  }

  return Object.freeze({
    planPolicyVersion: policy.version,
    leaderboardPolicyVersion: policy.leaderboardPolicyVersion,
    planCode: definition.code,
    currency: policy.currency,
    platformFeeRateBps: definition.platformFeeRateBps,
    exposurePriority: definition.exposurePriority,
    queuePriority: definition.queuePriority,
    premiumBonusHalfPointsPerWholeBrl: definition.premiumBonusHalfPointsPerWholeBrl,
    premiumBadgeCampaignVersion: definition.premiumBadgeCampaignVersion,
    premiumBadgeRequiredSales: definition.premiumBadgeRequiredSales,
    acceptedAt: input.acceptedAt,
  });
}

export function calculatePlatformFeeMinor(
  grossMerchandiseMinor: number,
  snapshot: ListingCommercialSnapshot,
): number {
  assertMinorBrl(grossMerchandiseMinor, "grossMerchandiseMinor");
  assertListingCommercialSnapshot(snapshot);

  const numerator = BigInt(grossMerchandiseMinor) * BigInt(snapshot.platformFeeRateBps);
  const feeMinor = (numerator + 5_000n) / 10_000n;
  const result = Number(feeMinor);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("A taxa calculada excede o intervalo seguro de centavos de BRL.");
  }
  return result;
}
