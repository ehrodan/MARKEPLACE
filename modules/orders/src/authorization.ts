import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import type { MidasDatabase } from "@midas/database";
import { AppProblem, type ActorContext } from "@midas/kernel";
import { sellerMemberships } from "@midas/sellers";
import type { DeliveryRole } from "./order-state.js";

type OrdersQueryExecutor = Pick<MidasDatabase, "select">;

export type OrderParticipant = "BUYER" | "SELLER";

export function requireActorUserId(actor: ActorContext): string {
  if (actor.actorUserId) return actor.actorUserId;
  throw new AppProblem({
    status: 401,
    code: "AUTHENTICATION_REQUIRED",
    title: "Entre para continuar",
    detail: "Uma sessão válida é necessária para acessar este recurso.",
  });
}

export async function hasActiveSellerMembership(
  database: OrdersQueryExecutor,
  actor: ActorContext,
  sellerAccountId: string,
): Promise<boolean> {
  if (!actor.actorUserId) return false;
  const now = new Date();
  const [membership] = await database
    .select({ sellerMembershipId: sellerMemberships.sellerMembershipId })
    .from(sellerMemberships)
    .where(
      and(
        eq(sellerMemberships.userId, actor.actorUserId),
        eq(sellerMemberships.sellerAccountId, sellerAccountId),
        eq(sellerMemberships.membershipStatus, "ACTIVE"),
        lte(sellerMemberships.validFrom, now),
        or(isNull(sellerMemberships.validUntil), gt(sellerMemberships.validUntil, now)),
      ),
    )
    .limit(1);

  return Boolean(membership);
}

export async function assertActiveSellerMembership(
  database: OrdersQueryExecutor,
  actor: ActorContext,
  sellerAccountId: string,
): Promise<void> {
  requireActorUserId(actor);
  if (await hasActiveSellerMembership(database, actor, sellerAccountId)) return;
  throw new AppProblem({
    status: 404,
    code: "SELLER_ACCOUNT_NOT_FOUND",
    title: "Conta vendedora não encontrada",
    detail: "A conta vendedora não existe ou não está disponível para esta sessão.",
  });
}

export function assertOrderBuyer(
  actor: ActorContext,
  order: { buyerUserId: string },
): string {
  const actorUserId = requireActorUserId(actor);
  if (order.buyerUserId === actorUserId) return actorUserId;
  throw orderNotFound();
}

/** Resolve o papel do ator no pedido; 404 quando o ator não participa dele. */
export async function assertOrderParticipant(
  database: OrdersQueryExecutor,
  actor: ActorContext,
  order: { buyerUserId: string; sellerAccountId: string },
): Promise<OrderParticipant> {
  const actorUserId = requireActorUserId(actor);
  if (order.buyerUserId === actorUserId) return "BUYER";
  if (await hasActiveSellerMembership(database, actor, order.sellerAccountId)) return "SELLER";
  throw orderNotFound();
}

/** Garante que o ator pode confirmar a entrega no papel informado. */
export async function assertDeliveryRole(
  database: OrdersQueryExecutor,
  actor: ActorContext,
  order: { buyerUserId: string; sellerAccountId: string },
  role: DeliveryRole,
): Promise<void> {
  const participant = await assertOrderParticipant(database, actor, order);
  if (participant === role) return;
  throw new AppProblem({
    status: 403,
    code: "DELIVERY_ROLE_NOT_ALLOWED",
    title: "Confirmação não permitida",
    detail: "A confirmação precisa ser feita pelo próprio papel do participante no pedido.",
  });
}

export function orderNotFound(): AppProblem {
  return new AppProblem({
    status: 404,
    code: "ORDER_NOT_FOUND",
    title: "Pedido não encontrado",
    detail: "O pedido não existe ou não está disponível para esta sessão.",
  });
}
