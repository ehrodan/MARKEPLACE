import { and, eq, gt, isNull, lte, ne, or } from "drizzle-orm";
import type { MidasDatabase } from "@midas/database";
import { rolePermissions, roles, userRoleAssignments } from "@midas/iam";
import { AppProblem, type ActorContext } from "@midas/kernel";
import { sellerAccounts, sellerMemberships } from "@midas/sellers";

type CatalogQueryExecutor = Pick<MidasDatabase, "select">;

export async function assertActiveSellerMembership(
  database: CatalogQueryExecutor,
  actor: ActorContext,
  sellerAccountId: string,
): Promise<void> {
  const actorUserId = requireActorUserId(actor);
  const now = new Date();
  const [membership] = await database
    .select({ sellerMembershipId: sellerMemberships.sellerMembershipId })
    .from(sellerMemberships)
    .innerJoin(
      sellerAccounts,
      eq(sellerAccounts.sellerAccountId, sellerMemberships.sellerAccountId),
    )
    .where(
      and(
        eq(sellerMemberships.userId, actorUserId),
        eq(sellerMemberships.sellerAccountId, sellerAccountId),
        eq(sellerMemberships.membershipStatus, "ACTIVE"),
        ne(sellerAccounts.sellerAccountStatus, "SUSPENDED"),
        lte(sellerMemberships.validFrom, now),
        or(isNull(sellerMemberships.validUntil), gt(sellerMemberships.validUntil, now)),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new AppProblem({
      status: 404,
      code: "SELLER_ACCOUNT_NOT_FOUND",
      title: "Conta vendedora não encontrada",
      detail: "A conta vendedora não existe ou não está disponível para esta sessão.",
    });
  }
}

export async function assertPlatformPermission(
  database: CatalogQueryExecutor,
  actor: ActorContext,
  permissionCode: string,
): Promise<void> {
  const actorUserId = requireActorUserId(actor);
  const now = new Date();
  const [grant] = await database
    .select({ permissionCode: rolePermissions.permissionCode })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(roles.roleId, userRoleAssignments.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.roleId))
    .where(
      and(
        eq(userRoleAssignments.userId, actorUserId),
        eq(userRoleAssignments.assignmentStatus, "ACTIVE"),
        lte(userRoleAssignments.validFrom, now),
        or(isNull(userRoleAssignments.validUntil), gt(userRoleAssignments.validUntil, now)),
        eq(roles.roleScope, "PLATFORM"),
        eq(rolePermissions.permissionCode, permissionCode),
      ),
    )
    .limit(1);

  if (!grant) {
    throw new AppProblem({
      status: 403,
      code: "PLATFORM_PERMISSION_MISSING",
      title: "Permissão insuficiente",
      detail: "A operação exige uma permissão administrativa explícita.",
    });
  }
}

function requireActorUserId(actor: ActorContext): string {
  if (actor.actorUserId) return actor.actorUserId;
  throw new AppProblem({
    status: 401,
    code: "AUTHENTICATION_REQUIRED",
    title: "Entre para continuar",
    detail: "Uma sessão válida é necessária para acessar este recurso.",
  });
}
