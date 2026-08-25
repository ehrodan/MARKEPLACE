import { and, asc, desc, eq, lte } from "drizzle-orm";
import { appendAuditEvent } from "@midas/administration-audit";
import type { MidasDatabase } from "@midas/database";
import { withSerializableTransaction } from "@midas/database";
import { appendOutboxEvent } from "@midas/eventing";
import { AppProblem, createUuidV7, type ActorContext } from "@midas/kernel";
import { assertRetentionActor } from "./consent.js";
import { SAVED_CART_TTL_MS } from "./reminder-policy.js";
import { savedCarts, type SavedCartRow } from "./schema.js";

/**
 * Carrinho que SOBREVIVE.
 *
 * Persuasao legitima e esta: a pessoa nunca perde o que escolheu. O snapshot atravessa
 * sessao, dispositivo e login, e a tela de retomada mostra o estado REAL -- itens reais,
 * subtotal real, data real de quando foi salvo. Nenhum numero aqui e ilustrativo.
 *
 * Fronteira: `sourceCartId` e um uuid simples, sem FK para `modules/orders`.
 */

export const SAVED_CART_STATUSES = ["ACTIVE", "RECOVERED", "EXPIRED"] as const;
export type SavedCartStatus = (typeof SAVED_CART_STATUSES)[number];

export type SaveCartSnapshotInput = {
  userId: string;
  sourceCartId: string;
  /** Estado real do carrinho no instante do salvamento. */
  snapshot: Record<string, unknown>;
  itemCount: number;
  subtotalMinor: bigint;
  currency: string;
  /** Sobrescreve o TTL padrão quando o chamador tem motivo explícito. */
  expiresAt?: Date | undefined;
};

export type SavedCartPage = {
  data: SavedCartRow[];
  asOf: Date;
};

export class SavedCartService {
  constructor(private readonly db: MidasDatabase) {}

  /**
   * Grava (ou atualiza) o snapshot ativo do carrinho de origem. Um `sourceCartId` tem no
   * máximo um snapshot ACTIVE; salvar de novo atualiza o mesmo registro e incrementa a
   * versão, preservando o histórico já encerrado como RECOVERED ou EXPIRED.
   */
  async saveSnapshot(
    input: SaveCartSnapshotInput,
    actor: ActorContext,
  ): Promise<SavedCartRow> {
    assertRetentionActor(actor, input.userId);
    if (input.itemCount < 0) throw invalid("O carrinho não pode ter contagem negativa.");
    if (input.subtotalMinor < 0n) throw invalid("O subtotal não pode ser negativo.");

    const now = new Date();
    const expiresAt = input.expiresAt ?? new Date(now.getTime() + SAVED_CART_TTL_MS);
    if (expiresAt.getTime() <= now.getTime()) {
      throw invalid("A validade do carrinho salvo precisa ser futura.");
    }

    const savedCartId = await withSerializableTransaction(this.db, async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(savedCarts)
        .where(
          and(
            eq(savedCarts.sourceCartId, input.sourceCartId),
            eq(savedCarts.status, "ACTIVE"),
          ),
        )
        .for("update");

      if (existing && existing.userId !== input.userId) {
        throw new AppProblem({
          status: 403,
          code: "RETENTION_ACTOR_MISMATCH",
          title: "Acesso negado",
          detail: "Este carrinho pertence a outra pessoa.",
        });
      }

      const targetId = existing ? existing.savedCartId : createUuidV7();
      const nextVersion = existing ? existing.version + 1 : 1;

      if (existing) {
        await transaction
          .update(savedCarts)
          .set({
            snapshot: input.snapshot,
            itemCount: input.itemCount,
            subtotalMinor: input.subtotalMinor,
            currency: input.currency,
            savedAt: now,
            expiresAt,
            version: nextVersion,
          })
          .where(eq(savedCarts.savedCartId, targetId));
      } else {
        await transaction.insert(savedCarts).values({
          savedCartId: targetId,
          userId: input.userId,
          sourceCartId: input.sourceCartId,
          snapshot: input.snapshot,
          itemCount: input.itemCount,
          subtotalMinor: input.subtotalMinor,
          currency: input.currency,
          savedAt: now,
          expiresAt,
          recoveredAt: null,
          status: "ACTIVE",
          version: 1,
        });
      }

      await appendOutboxEvent(
        transaction,
        {
          eventType: "retention.saved_cart.saved",
          schemaVersion: 1,
          aggregateType: "SavedCart",
          aggregateId: targetId,
          aggregateVersion: nextVersion,
          occurredAt: now,
          ownerModule: "retention",
          dataClassification: "CONFIDENTIAL",
          payload: {
            savedCartId: targetId,
            userId: input.userId,
            sourceCartId: input.sourceCartId,
            itemCount: input.itemCount,
            subtotalMinor: input.subtotalMinor.toString(),
            currency: input.currency,
            expiresAt: expiresAt.toISOString(),
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "retention.saved_cart.save",
          resourceType: "SavedCart",
          resourceId: targetId,
          afterRedacted: {
            sourceCartId: input.sourceCartId,
            itemCount: input.itemCount,
            subtotalMinor: input.subtotalMinor.toString(),
            currency: input.currency,
            expiresAt: expiresAt.toISOString(),
          },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );

      return targetId;
    });

    return this.requireById(savedCartId);
  }

  /** Snapshots ativos e ainda válidos da pessoa, do mais recente para o mais antigo. */
  async getActiveForUser(userId: string, actor: ActorContext): Promise<SavedCartPage> {
    assertRetentionActor(actor, userId);
    const asOf = new Date();
    const data = await this.db
      .select()
      .from(savedCarts)
      .where(and(eq(savedCarts.userId, userId), eq(savedCarts.status, "ACTIVE")))
      .orderBy(desc(savedCarts.savedAt), asc(savedCarts.savedCartId));

    return { data: data.filter((row) => row.expiresAt.getTime() > asOf.getTime()), asOf };
  }

  /** A pessoa voltou e retomou o carrinho: encerra o snapshot e desliga qualquer lembrete. */
  async markRecovered(savedCartId: string, actor: ActorContext): Promise<SavedCartRow> {
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      const [row] = await transaction
        .select()
        .from(savedCarts)
        .where(eq(savedCarts.savedCartId, savedCartId))
        .for("update");

      if (!row) throw notFound("Carrinho salvo não encontrado.");
      assertRetentionActor(actor, row.userId);

      if (row.status === "RECOVERED") return;
      if (row.status !== "ACTIVE") {
        throw conflict(
          "SAVED_CART_NOT_ACTIVE",
          "Apenas um carrinho salvo ativo pode ser marcado como retomado.",
        );
      }

      const nextVersion = row.version + 1;
      await transaction
        .update(savedCarts)
        .set({ status: "RECOVERED", recoveredAt: now, version: nextVersion })
        .where(eq(savedCarts.savedCartId, savedCartId));

      await appendOutboxEvent(
        transaction,
        {
          eventType: "retention.saved_cart.recovered",
          schemaVersion: 1,
          aggregateType: "SavedCart",
          aggregateId: savedCartId,
          aggregateVersion: nextVersion,
          occurredAt: now,
          ownerModule: "retention",
          dataClassification: "CONFIDENTIAL",
          payload: {
            savedCartId,
            userId: row.userId,
            sourceCartId: row.sourceCartId,
            recoveredAt: now.toISOString(),
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "retention.saved_cart.recover",
          resourceType: "SavedCart",
          resourceId: savedCartId,
          afterRedacted: { status: "RECOVERED", recoveredAt: now.toISOString() },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );
    });

    return this.requireById(savedCartId);
  }

  /**
   * Rotina de sistema: expira snapshots vencidos. Não recebe guarda de ator — quem expõe
   * isso na API precisa exigir permissão de plataforma.
   */
  async expireStale(
    now: Date,
    actor: ActorContext,
    limit = 200,
  ): Promise<{ expired: number; savedCartIds: string[] }> {
    const stale = await this.db
      .select({ savedCartId: savedCarts.savedCartId })
      .from(savedCarts)
      .where(and(eq(savedCarts.status, "ACTIVE"), lte(savedCarts.expiresAt, now)))
      .orderBy(asc(savedCarts.expiresAt))
      .limit(limit);

    const savedCartIds: string[] = [];
    for (const candidate of stale) {
      const expired = await this.expireOne(candidate.savedCartId, now, actor);
      if (expired) savedCartIds.push(candidate.savedCartId);
    }

    return { expired: savedCartIds.length, savedCartIds };
  }

  private async expireOne(
    savedCartId: string,
    now: Date,
    actor: ActorContext,
  ): Promise<boolean> {
    return withSerializableTransaction(this.db, async (transaction) => {
      const [row] = await transaction
        .select()
        .from(savedCarts)
        .where(eq(savedCarts.savedCartId, savedCartId))
        .for("update");

      if (!row || row.status !== "ACTIVE" || row.expiresAt.getTime() > now.getTime()) {
        return false;
      }

      const nextVersion = row.version + 1;
      await transaction
        .update(savedCarts)
        .set({ status: "EXPIRED", version: nextVersion })
        .where(eq(savedCarts.savedCartId, savedCartId));

      await appendOutboxEvent(
        transaction,
        {
          eventType: "retention.saved_cart.expired",
          schemaVersion: 1,
          aggregateType: "SavedCart",
          aggregateId: savedCartId,
          aggregateVersion: nextVersion,
          occurredAt: now,
          ownerModule: "retention",
          dataClassification: "CONFIDENTIAL",
          payload: {
            savedCartId,
            userId: row.userId,
            sourceCartId: row.sourceCartId,
            expiredAt: now.toISOString(),
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "retention.saved_cart.expire",
          resourceType: "SavedCart",
          resourceId: savedCartId,
          reasonCode: "TTL_ELAPSED",
          afterRedacted: { status: "EXPIRED", expiresAt: row.expiresAt.toISOString() },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );

      return true;
    });
  }

  /** Leitura sem guarda de ator, para uso interno do módulo (política de lembrete). */
  async findById(savedCartId: string): Promise<SavedCartRow | null> {
    const [row] = await this.db
      .select()
      .from(savedCarts)
      .where(eq(savedCarts.savedCartId, savedCartId))
      .limit(1);
    return row ?? null;
  }

  private async requireById(savedCartId: string): Promise<SavedCartRow> {
    const row = await this.findById(savedCartId);
    if (!row) throw notFound("Carrinho salvo não encontrado.");
    return row;
  }
}

function invalid(detail: string): AppProblem {
  return new AppProblem({
    status: 422,
    code: "VALIDATION_ERROR",
    title: "Dados inválidos",
    detail,
  });
}

function conflict(code: string, detail: string): AppProblem {
  return new AppProblem({ status: 409, code, title: "Conflito de negócio", detail });
}

function notFound(detail: string): AppProblem {
  return new AppProblem({
    status: 404,
    code: "SAVED_CART_NOT_FOUND",
    title: "Não encontrado",
    detail,
  });
}
