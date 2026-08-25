import { assertMinorBrl, assertNonEmptyVersion } from "./money.js";

export interface LeaderboardPolicyVersion {
  readonly version: string;
  readonly currency: "BRL";
  readonly baseMinorPerPoint: number;
  readonly premiumBonusHalfPointsPerWholeBrl: number;
}

export interface LeaderboardScore {
  readonly policyVersion: string;
  readonly eligibleGmvMinor: number;
  readonly eligiblePremiumGmvMinor: number;
  readonly baseHalfPoints: number;
  readonly premiumBonusHalfPoints: number;
  readonly totalHalfPoints: number;
}

export function createLeaderboardPolicyVersion(input: {
  readonly version: string;
  readonly baseMinorPerPoint: number;
  readonly premiumBonusHalfPointsPerWholeBrl: number;
}): LeaderboardPolicyVersion {
  assertNonEmptyVersion(input.version);
  if (!Number.isSafeInteger(input.baseMinorPerPoint) || input.baseMinorPerPoint <= 0) {
    throw new RangeError("baseMinorPerPoint deve ser um inteiro seguro positivo.");
  }
  if (
    !Number.isSafeInteger(input.premiumBonusHalfPointsPerWholeBrl)
    || input.premiumBonusHalfPointsPerWholeBrl < 0
  ) {
    throw new RangeError(
      "premiumBonusHalfPointsPerWholeBrl deve ser um inteiro seguro não negativo.",
    );
  }
  return Object.freeze({
    version: input.version,
    currency: "BRL" as const,
    baseMinorPerPoint: input.baseMinorPerPoint,
    premiumBonusHalfPointsPerWholeBrl: input.premiumBonusHalfPointsPerWholeBrl,
  });
}

export const INITIAL_LEADERBOARD_POLICY = createLeaderboardPolicyVersion({
  version: "leaderboard-brl.v1",
  baseMinorPerPoint: 1_000,
  premiumBonusHalfPointsPerWholeBrl: 1,
});

export function calculateLeaderboardScore(input: {
  readonly eligibleGmvMinor: number;
  readonly eligiblePremiumGmvMinor: number;
  readonly policy?: LeaderboardPolicyVersion;
}): LeaderboardScore {
  const policy = input.policy ?? INITIAL_LEADERBOARD_POLICY;
  assertMinorBrl(input.eligibleGmvMinor, "eligibleGmvMinor");
  assertMinorBrl(input.eligiblePremiumGmvMinor, "eligiblePremiumGmvMinor");
  if (input.eligiblePremiumGmvMinor > input.eligibleGmvMinor) {
    throw new RangeError("O GMV Premium elegível não pode exceder o GMV total elegível.");
  }

  const basePoints = Math.floor(input.eligibleGmvMinor / policy.baseMinorPerPoint);
  const baseHalfPoints = basePoints * 2;
  const premiumBonusHalfPoints = Math.floor(input.eligiblePremiumGmvMinor / 100)
    * policy.premiumBonusHalfPointsPerWholeBrl;
  const totalHalfPoints = baseHalfPoints + premiumBonusHalfPoints;
  if (![baseHalfPoints, premiumBonusHalfPoints, totalHalfPoints].every(Number.isSafeInteger)) {
    throw new RangeError("A pontuação excede o intervalo inteiro seguro.");
  }

  return Object.freeze({
    policyVersion: policy.version,
    eligibleGmvMinor: input.eligibleGmvMinor,
    eligiblePremiumGmvMinor: input.eligiblePremiumGmvMinor,
    baseHalfPoints,
    premiumBonusHalfPoints,
    totalHalfPoints,
  });
}

export function formatHalfPoints(halfPoints: number): string {
  if (!Number.isSafeInteger(halfPoints) || halfPoints < 0) {
    throw new RangeError("halfPoints deve ser um inteiro seguro não negativo.");
  }
  const whole = Math.floor(halfPoints / 2);
  return halfPoints % 2 === 0 ? String(whole) : `${String(whole)},5`;
}
