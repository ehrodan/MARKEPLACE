import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { appendAuditEvent } from "@midas/administration-audit";
import type { MidasDatabase } from "@midas/database";
import { withSerializableTransaction } from "@midas/database";
import { appendOutboxEvent } from "@midas/eventing";
import { authorizeSellerAction } from "@midas/iam";
import { users } from "@midas/identity";
import {
  AppProblem,
  createUuidV7,
  toPublicId,
  type ActorContext,
} from "@midas/kernel";
import {
  sellerAccounts,
  sellerMembershipGrants,
  sellerMemberships,
} from "../adapters/postgres/schema.js";

export type CreateSellerAccountInput = {
  displayName: string;
  accountType: "INDIVIDUAL" | "ORGANIZATION";
};

export class SellerService {
  constructor(private readonly db: MidasDatabase) {}

  async createSellerAccount(
    userId: string,
    input: CreateSellerAccountInput,
    actor: ActorContext,
  ) {
    const sellerAccountId = createUuidV7();
    const sellerMembershipId = createUuidV7();
    const now = new Date();
    await withSerializableTransaction(this.db, async (transaction) => {
      await transaction.insert(sellerAccounts).values({
        sellerAccountId,
        displayName: input.displayName.trim(),
        accountType: input.accountType,
        sellerAccountStatus: "ONBOARDING_REQUIRED",
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      await transaction.insert(sellerMemberships).values({
        sellerMembershipId,
        sellerAccountId,
        userId,
        membershipRole: "OWNER",
        membershipStatus: "ACTIVE",
        validFrom: now,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      await transaction.insert(sellerMembershipGrants).values([
        {
          grantId: createUuidV7(),
          sellerAccountId,
          sellerMembershipId,
          permissionCode: "seller.account.read",
          effect: "ALLOW",
          createdAt: now,
        },
        {
          grantId: createUuidV7(),
          sellerAccountId,
          sellerMembershipId,
          permissionCode: "seller.members.read",
          effect: "ALLOW",
          createdAt: now,
        },
      ]);

      await appendOutboxEvent(
        transaction,
        {
          eventType: "seller.account.created.v1",
          aggregateType: "SellerAccount",
          aggregateId: sellerAccountId,
          aggregateVersion: 1,
          ownerModule: "sellers",
          sellerAccountId,
          dataClassification: "INTERNAL",
          payload: {
            sellerAccountId: toPublicId("sellerAccount", sellerAccountId),
            accountType: input.accountType,
            sellerAccountStatus: "ONBOARDING_REQUIRED",
          },
        },
        actor,
      );
      await appendOutboxEvent(
        transaction,
        {
          eventType: "seller.membership.created.v1",
          aggregateType: "SellerMembership",
          aggregateId: sellerMembershipId,
          aggregateVersion: 1,
          ownerModule: "sellers",
          sellerAccountId,
          dataClassification: "INTERNAL",
          payload: {
            sellerMembershipId: toPublicId("sellerMembership", sellerMembershipId),
            sellerAccountId: toPublicId("sellerAccount", sellerAccountId),
            membershipRole: "OWNER",
          },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "seller.account.create",
          resourceType: "SellerAccount",
          resourceId: sellerAccountId,
          sellerAccountId,
          actingRole: "OWNER",
          afterRedacted: {
            accountType: input.accountType,
            sellerAccountStatus: "ONBOARDING_REQUIRED",
          },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );
    });

    return {
      sellerAccountId: toPublicId("sellerAccount", sellerAccountId),
      displayName: input.displayName.trim(),
      accountType: input.accountType,
      sellerAccountStatus: "ONBOARDING_REQUIRED" as const,
      membershipRole: "OWNER" as const,
      version: 1,
    };
  }

  async listCurrentUserSellerAccounts(userId: string) {
    const now = new Date();
    const rows = await this.db
      .select({
        sellerAccountId: sellerAccounts.sellerAccountId,
        displayName: sellerAccounts.displayName,
        accountType: sellerAccounts.accountType,
        sellerAccountStatus: sellerAccounts.sellerAccountStatus,
        membershipRole: sellerMemberships.membershipRole,
        version: sellerAccounts.version,
      })
      .from(sellerMemberships)
      .innerJoin(
        sellerAccounts,
        eq(sellerAccounts.sellerAccountId, sellerMemberships.sellerAccountId),
      )
      .where(
        and(
          eq(sellerMemberships.userId, userId),
          eq(sellerMemberships.membershipStatus, "ACTIVE"),
          lte(sellerMemberships.validFrom, now),
          or(isNull(sellerMemberships.validUntil), gt(sellerMemberships.validUntil, now)),
        ),
      )
      .orderBy(asc(sellerAccounts.createdAt));
    return {
      data: rows.map((row) => ({
        sellerAccountId: toPublicId("sellerAccount", row.sellerAccountId),
        displayName: row.displayName,
        accountType: row.accountType as "INDIVIDUAL" | "ORGANIZATION",
        sellerAccountStatus: row.sellerAccountStatus as
          | "ONBOARDING_REQUIRED"
          | "ACTIVE"
          | "SUSPENDED",
        membershipRole: row.membershipRole as "OWNER" | "MANAGER" | "OPERATOR" | "FINANCE_VIEWER",
        version: row.version,
      })),
      asOf: now,
    };
  }

  async listSellerAccountMembers(userId: string, sellerAccountId: string) {
    const now = new Date();
    const membershipRows = await this.db
      .select({
        membershipStatus: sellerMemberships.membershipStatus,
        validFrom: sellerMemberships.validFrom,
        validUntil: sellerMemberships.validUntil,
        permissionCode: sellerMembershipGrants.permissionCode,
        effect: sellerMembershipGrants.effect,
      })
      .from(sellerMemberships)
      .leftJoin(
        sellerMembershipGrants,
        and(
          eq(sellerMembershipGrants.sellerMembershipId, sellerMemberships.sellerMembershipId),
          eq(sellerMembershipGrants.sellerAccountId, sellerAccountId),
          or(isNull(sellerMembershipGrants.validUntil), gt(sellerMembershipGrants.validUntil, now)),
        ),
      )
      .where(
        and(
          eq(sellerMemberships.sellerAccountId, sellerAccountId),
          eq(sellerMemberships.userId, userId),
        ),
      );
    const first = membershipRows[0];
    const grants = new Set(
      membershipRows
        .flatMap((row) =>
          row.effect === "ALLOW" && row.permissionCode ? [row.permissionCode] : [],
        ),
    );
    const decision = authorizeSellerAction(
      {
        authenticated: true,
        ...(first
          ? {
              membershipStatus: first.membershipStatus as "ACTIVE" | "REVOKED" | "EXPIRED",
              validFrom: first.validFrom,
              validUntil: first.validUntil,
            }
          : {}),
        grants,
        now,
      },
      "seller.members.read",
    );
    if (!decision.allowed) {
      throw new AppProblem({
        status: 404,
        code: "SELLER_ACCOUNT_NOT_FOUND",
        title: "Conta não encontrada",
        detail: "A conta vendedora não existe ou não está disponível para esta sessão.",
      });
    }

    const members = await this.db
      .select({
        sellerMembershipId: sellerMemberships.sellerMembershipId,
        userId: sellerMemberships.userId,
        displayName: users.displayName,
        membershipRole: sellerMemberships.membershipRole,
        membershipStatus: sellerMemberships.membershipStatus,
        validFrom: sellerMemberships.validFrom,
        validUntil: sellerMemberships.validUntil,
        version: sellerMemberships.version,
      })
      .from(sellerMemberships)
      .innerJoin(users, eq(users.userId, sellerMemberships.userId))
      .where(eq(sellerMemberships.sellerAccountId, sellerAccountId))
      .orderBy(asc(sellerMemberships.createdAt));
    return {
      data: members.map((member) => ({
        sellerMembershipId: toPublicId("sellerMembership", member.sellerMembershipId),
        userId: toPublicId("user", member.userId),
        displayName: member.displayName,
        membershipRole: member.membershipRole as "OWNER" | "MANAGER" | "OPERATOR" | "FINANCE_VIEWER",
        membershipStatus: member.membershipStatus as "ACTIVE" | "REVOKED" | "EXPIRED",
        validFrom: member.validFrom,
        validUntil: member.validUntil,
        version: member.version,
      })),
      asOf: new Date(),
    };
  }
}
