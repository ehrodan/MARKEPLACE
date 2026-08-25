import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import type { MidasDatabase } from "@midas/database";
import { AppProblem } from "@midas/kernel";
import { sellerMemberships } from "@midas/sellers";
import {
  INITIAL_ACCOUNT_LEVEL_POLICY,
  assignAccountLevel,
  type AccountLevel,
} from "./level-policy.js";
import {
  replayContributionLedger,
  type LedgerContribution,
  type LedgerSourceKind,
} from "./ledger-replay.js";
import {
  badgeAwards,
  badgeDefinitions,
  progressionContributions,
  rewardAwards,
  rewardDefinitions,
} from "./schema.js";

export type SellerBadgeAwardReadModel = {
  badgeCode: string;
  definitionVersion: string;
  status: "ACTIVE" | "REVOKED";
  awardedAt: Date;
  sourceEventId: string | null;
  revokedReason: string | null;
};

export type SellerRewardAwardReadModel = {
  rewardCode: string;
  definitionVersion: string;
  status: "GRANTED" | "FULFILLED" | "REVOKED";
  awardedAt: Date;
  fulfilledAt: Date | null;
};

export type SellerProgressionReadModel = {
  levelAssignment: {
    policyVersion: string;
    currency: "BRL";
    qualifiedLifetimeGmvMinor: number;
    level: AccountLevel;
    currentLevelMinInclusiveMinor: number;
    nextLevelMinInclusiveMinor: number | null;
    contributionChecksum: string;
  };
  badgeAwards: SellerBadgeAwardReadModel[];
  rewardAwards: SellerRewardAwardReadModel[];
  asOf: Date;
  freshness: "READY";
};

const SELLER_SUBJECT_KIND = "SELLER_ACCOUNT";

/**
 * Leitura canônica de progressão da SellerAccount (docs/13 §19.3, SCR-ACC-016).
 * O nível NUNCA vem de contador persistido: cada leitura replaya o ledger
 * append-only de contribuições e aplica a política `account-level-brl.v1` de
 * `level-policy.ts`. Refund/chargeback entram como compensação e podem reduzir
 * o nível corrente. `freshness` é READY porque o cálculo é feito na hora, sobre
 * o estado atual do ledger — não existe projeção defasada nesta leitura.
 */
export class ProgressionService {
  public constructor(private readonly db: MidasDatabase) {}

  public async getSellerProgression(
    userId: string,
    sellerAccountId: string,
  ): Promise<SellerProgressionReadModel> {
    await this.assertSellerMembership(userId, sellerAccountId);
    const asOf = new Date();

    const contributionRows = await this.db
      .select({
        contributionId: progressionContributions.contributionId,
        sourceKind: progressionContributions.sourceKind,
        sourceRef: progressionContributions.sourceRef,
        amountMinor: progressionContributions.amountMinor,
        compensatesContributionId: progressionContributions.compensatesContributionId,
        occurredAt: progressionContributions.occurredAt,
      })
      .from(progressionContributions)
      .where(
        and(
          eq(progressionContributions.subjectKind, SELLER_SUBJECT_KIND),
          eq(progressionContributions.subjectRef, sellerAccountId),
          eq(progressionContributions.currency, INITIAL_ACCOUNT_LEVEL_POLICY.currency),
        ),
      )
      .orderBy(asc(progressionContributions.recordedAt), asc(progressionContributions.contributionId));

    const ledger: LedgerContribution[] = contributionRows.map((row) => ({
      contributionId: row.contributionId,
      sourceKind: row.sourceKind as LedgerSourceKind,
      sourceRef: row.sourceRef,
      amountMinor: row.amountMinor,
      compensatesContributionId: row.compensatesContributionId,
      occurredAt: row.occurredAt.toISOString(),
    }));
    const replay = replayContributionLedger(ledger);
    const assignment = assignAccountLevel(
      replay.qualifiedLifetimeGmvMinor,
      INITIAL_ACCOUNT_LEVEL_POLICY,
    );

    const badgeRows = await this.db
      .select({
        badgeCode: badgeAwards.badgeCode,
        definitionVersion: badgeDefinitions.policyVersion,
        awardedAt: badgeAwards.awardedAt,
        revokedAt: badgeAwards.revokedAt,
        revokeReason: badgeAwards.revokeReason,
        evidence: badgeAwards.evidence,
      })
      .from(badgeAwards)
      .innerJoin(badgeDefinitions, eq(badgeDefinitions.badgeCode, badgeAwards.badgeCode))
      .where(
        and(
          eq(badgeAwards.subjectKind, SELLER_SUBJECT_KIND),
          eq(badgeAwards.subjectRef, sellerAccountId),
        ),
      )
      .orderBy(asc(badgeAwards.awardedAt), asc(badgeAwards.badgeCode));

    const rewardRows = await this.db
      .select({
        rewardCode: rewardAwards.rewardCode,
        definitionVersion: rewardDefinitions.policyVersion,
        awardedAt: rewardAwards.awardedAt,
        fulfillmentStatus: rewardAwards.fulfillmentStatus,
        fulfilledAt: rewardAwards.fulfilledAt,
      })
      .from(rewardAwards)
      .innerJoin(rewardDefinitions, eq(rewardDefinitions.rewardCode, rewardAwards.rewardCode))
      .where(
        and(
          eq(rewardAwards.subjectKind, SELLER_SUBJECT_KIND),
          eq(rewardAwards.subjectRef, sellerAccountId),
        ),
      )
      .orderBy(asc(rewardAwards.awardedAt), asc(rewardAwards.rewardCode));

    return {
      levelAssignment: {
        policyVersion: assignment.policyVersion,
        currency: assignment.currency,
        qualifiedLifetimeGmvMinor: assignment.qualifiedLifetimeGmvMinor,
        level: assignment.level,
        currentLevelMinInclusiveMinor: assignment.currentLevelMinInclusiveMinor,
        nextLevelMinInclusiveMinor: assignment.nextLevelMinInclusiveMinor,
        contributionChecksum: replay.checksum,
      },
      badgeAwards: badgeRows.map((row) => ({
        badgeCode: row.badgeCode,
        definitionVersion: row.definitionVersion,
        status: row.revokedAt === null ? ("ACTIVE" as const) : ("REVOKED" as const),
        awardedAt: row.awardedAt,
        sourceEventId: readSourceEventId(row.evidence),
        revokedReason: row.revokeReason,
      })),
      rewardAwards: rewardRows.map((row) => ({
        rewardCode: row.rewardCode,
        definitionVersion: row.definitionVersion,
        status: mapRewardStatus(row.fulfillmentStatus),
        awardedAt: row.awardedAt,
        fulfilledAt: row.fulfilledAt,
      })),
      asOf,
      freshness: "READY",
    };
  }

  private async assertSellerMembership(userId: string, sellerAccountId: string): Promise<void> {
    const now = new Date();
    const [membership] = await this.db
      .select({ membershipRole: sellerMemberships.membershipRole })
      .from(sellerMemberships)
      .where(
        and(
          eq(sellerMemberships.userId, userId),
          eq(sellerMemberships.sellerAccountId, sellerAccountId),
          eq(sellerMemberships.membershipStatus, "ACTIVE"),
          lte(sellerMemberships.validFrom, now),
          or(isNull(sellerMemberships.validUntil), gt(sellerMemberships.validUntil, now)),
        ),
      );
    if (!membership) {
      throw new AppProblem({
        status: 404,
        code: "SELLER_ACCOUNT_NOT_FOUND",
        title: "Conta não encontrada",
        detail: "A conta vendedora não existe ou não está disponível para esta sessão.",
      });
    }
  }
}

/**
 * Conceder não é entregar (comentário da migration): PENDING e FAILED continuam
 * "GRANTED" na leitura — a concessão existe, a entrega ainda não. Somente
 * CANCELLED vira REVOKED. Status desconhecido derruba a leitura em vez de
 * inventar um estado bonito.
 */
function mapRewardStatus(fulfillmentStatus: string): "GRANTED" | "FULFILLED" | "REVOKED" {
  if (fulfillmentStatus === "FULFILLED") return "FULFILLED";
  if (fulfillmentStatus === "CANCELLED") return "REVOKED";
  if (fulfillmentStatus === "PENDING" || fulfillmentStatus === "FAILED") return "GRANTED";
  throw new AppProblem({
    status: 500,
    code: "REWARD_STATUS_UNKNOWN",
    title: "Estado de premiação desconhecido",
    detail: `O fulfillment_status ${fulfillmentStatus} não é reconhecido pela leitura.`,
  });
}

function readSourceEventId(evidence: Record<string, unknown>): string | null {
  const value = evidence["sourceEventId"];
  return typeof value === "string" && value.length > 0 ? value : null;
}
