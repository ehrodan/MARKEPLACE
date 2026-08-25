import { z } from "zod";

/**
 * Leitura canônica GET /v1/seller-accounts/{sellerAccountId}/progression
 * (docs/13 §19.3, SCR-ACC-016). O formato espelha o contrato que
 * `apps/web/components/progression/achievements-view.tsx` já consome:
 * AccountLevelAssignment + BadgeAward + RewardAward + asOf/freshness.
 * Minor units viajam como string decimal, como nas demais leituras.
 */

const minorAmountStringSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);

export const accountLevelSchema = z.enum([
  "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10",
]);

export const progressionLevelAssignmentSchema = z.object({
  policyVersion: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  qualifiedLifetimeGmvMinor: minorAmountStringSchema,
  level: accountLevelSchema,
  currentLevelMinInclusiveMinor: minorAmountStringSchema,
  nextLevelMinInclusiveMinor: minorAmountStringSchema.nullable(),
  contributionChecksum: z.string().min(1),
});

export const progressionBadgeAwardSchema = z.object({
  badgeCode: z.string().min(1),
  definitionVersion: z.string().min(1),
  status: z.enum(["ACTIVE", "REVOKED"]),
  awardedAt: z.iso.datetime(),
  sourceEventId: z.string().min(1).nullable(),
  revokedReason: z.string().min(1).nullable(),
});

export const progressionRewardAwardSchema = z.object({
  rewardCode: z.string().min(1),
  definitionVersion: z.string().min(1),
  status: z.enum(["GRANTED", "FULFILLED", "REVOKED"]),
  awardedAt: z.iso.datetime(),
  fulfilledAt: z.iso.datetime().nullable(),
});

export const accountProgressionSchema = z.object({
  levelAssignment: progressionLevelAssignmentSchema,
  badgeAwards: z.array(progressionBadgeAwardSchema),
  rewardAwards: z.array(progressionRewardAwardSchema),
  asOf: z.iso.datetime(),
  freshness: z.enum(["READY", "STALE"]),
});

export type AccountProgression = z.infer<typeof accountProgressionSchema>;
