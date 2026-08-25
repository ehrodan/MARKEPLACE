import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { appendAuditEvent } from "@midas/administration-audit";
import type { MidasDatabase } from "@midas/database";
import { withSerializableTransaction } from "@midas/database";
import { appendOutboxEvent } from "@midas/eventing";
import { AppProblem, createUuidV7, type ActorContext } from "@midas/kernel";
import { assertRetentionActor } from "./consent.js";
import { watchlistEntries, type WatchlistEntryRow } from "./schema.js";

/**
 * Vigilancia PEDIDA pela pessoa.
 *
 * Nada aqui e escassez fabricada. A pessoa pede para ser avisada se o preco cair ou se o
 * item voltar ao estoque, e o aviso cita o preco REAL e a data REAL. `referencePriceMinor`
 * guarda o preco efetivamente praticado no momento do pedido justamente para que nunca
 * exista "preco riscado" que nunca foi praticado.
 *
 * Toda comparacao de dinheiro e em BigInt sobre minor units. Number nao entra aqui:
 * um preco de R$ 92.233.720.368.547,76 ainda compara certo em BigInt e erra em Number.
 */

export const WATCHLIST_KINDS = ["PRICE_DROP", "BACK_IN_STOCK", "ANY_OFFER"] as const;
export type WatchlistKind = (typeof WATCHLIST_KINDS)[number];

export const WATCHLIST_STATUSES = ["ACTIVE", "TRIGGERED", "CANCELLED"] as const;
export type WatchlistStatus = (typeof WATCHLIST_STATUSES)[number];

// ---------------------------------------------------------------------------------------
// Nucleo puro de decisao (sem I/O, testavel isoladamente)
// ---------------------------------------------------------------------------------------

export type WatchlistPriceFacts = {
  kind: WatchlistKind;
  /** Preco real observado quando a pessoa pediu para vigiar. */
  referencePriceMinor: bigint;
  /** Alvo opcional definido pela pessoa: "me avise se chegar a X". */
  targetPriceMinor: bigint | null;
  /** Novo preco real do anuncio. */
  newPriceMinor: bigint;
};

export const WATCHLIST_TRIGGER_REASONS = [
  "TARGET_PRICE_REACHED",
  "PRICE_DROPPED",
  "TARGET_PRICE_NOT_REACHED",
  "PRICE_NOT_LOWER",
  "KIND_NOT_PRICE_SENSITIVE",
  "KIND_NOT_STOCK_SENSITIVE",
  "STOCK_RESTOCKED",
  "STOCK_STILL_EMPTY",
] as const;
export type WatchlistTriggerReason = (typeof WATCHLIST_TRIGGER_REASONS)[number];

export type WatchlistTriggerDecision = {
  triggered: boolean;
  reason: WatchlistTriggerReason;
};

/**
 * Queda de preço dispara; alta nunca dispara. Com alvo definido pela pessoa, o alvo manda:
 * só dispara quando o preço novo chega ao alvo ou fica abaixo dele.
 * `ANY_OFFER` acompanha preço com a mesma regra de `PRICE_DROP` — avisar alguém de que o
 * preço subiu não é serviço, é spam.
 */
export function evaluateWatchlistPriceChange(
  facts: WatchlistPriceFacts,
): WatchlistTriggerDecision {
  if (facts.kind === "BACK_IN_STOCK") {
    return { triggered: false, reason: "KIND_NOT_PRICE_SENSITIVE" };
  }

  if (facts.targetPriceMinor !== null) {
    return facts.newPriceMinor <= facts.targetPriceMinor
      ? { triggered: true, reason: "TARGET_PRICE_REACHED" }
      : { triggered: false, reason: "TARGET_PRICE_NOT_REACHED" };
  }

  return facts.newPriceMinor < facts.referencePriceMinor
    ? { triggered: true, reason: "PRICE_DROPPED" }
    : { triggered: false, reason: "PRICE_NOT_LOWER" };
}

export type WatchlistStockFacts = {
  kind: WatchlistKind;
  quantityAvailable: number;
};

/** Volta ao estoque: só dispara para quem pediu esse tipo de aviso e só com estoque real. */
export function evaluateWatchlistStockChange(
  facts: WatchlistStockFacts,
): WatchlistTriggerDecision {
  if (facts.kind === "PRICE_DROP") {
    return { triggered: false, reason: "KIND_NOT_STOCK_SENSITIVE" };
  }
  return facts.quantityAvailable > 0
    ? { triggered: true, reason: "STOCK_RESTOCKED" }
    : { triggered: false, reason: "STOCK_STILL_EMPTY" };
}

// ---------------------------------------------------------------------------------------
// Servico
// ---------------------------------------------------------------------------------------

export type WatchInput = {
  userId: string;
  listingId: string;
  catalogItemId: string;
  kind: WatchlistKind;
  currency: string;
  /** Preco real do anuncio no instante do pedido. */
  referencePriceMinor: bigint;
  targetPriceMinor?: bigint | undefined;
};

export type WatchlistTriggerHit = {
  entry: WatchlistEntryRow;
  reason: WatchlistTriggerReason;
  previousPriceMinor: bigint;
  newPriceMinor: bigint;
};

export class WatchlistService {
  constructor(private readonly db: MidasDatabase) {}

  /**
   * Cria ou reativa a vigilância. A chave é (pessoa, anúncio, tipo): pedir de novo atualiza
   * o preço de referência em vez de duplicar entrada.
   */
  async watch(input: WatchInput, actor: ActorContext): Promise<WatchlistEntryRow> {
    assertRetentionActor(actor, input.userId);
    if (input.referencePriceMinor < 0n) {
      throw invalid("O preço de referência não pode ser negativo.");
    }
    if (input.targetPriceMinor !== undefined && input.targetPriceMinor < 0n) {
      throw invalid("O preço alvo não pode ser negativo.");
    }

    const now = new Date();
    const watchlistEntryId = await withSerializableTransaction(this.db, async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(watchlistEntries)
        .where(
          and(
            eq(watchlistEntries.userId, input.userId),
            eq(watchlistEntries.listingId, input.listingId),
            eq(watchlistEntries.kind, input.kind),
          ),
        )
        .for("update");

      const targetId = existing ? existing.watchlistEntryId : createUuidV7();
      const nextVersion = existing ? existing.version + 1 : 1;

      if (existing) {
        await transaction
          .update(watchlistEntries)
          .set({
            catalogItemId: input.catalogItemId,
            currency: input.currency,
            referencePriceMinor: input.referencePriceMinor,
            targetPriceMinor: input.targetPriceMinor ?? null,
            status: "ACTIVE",
            lastNotifiedAt: null,
            version: nextVersion,
          })
          .where(eq(watchlistEntries.watchlistEntryId, targetId));
      } else {
        await transaction.insert(watchlistEntries).values({
          watchlistEntryId: targetId,
          userId: input.userId,
          listingId: input.listingId,
          catalogItemId: input.catalogItemId,
          kind: input.kind,
          targetPriceMinor: input.targetPriceMinor ?? null,
          currency: input.currency,
          referencePriceMinor: input.referencePriceMinor,
          createdAt: now,
          lastNotifiedAt: null,
          status: "ACTIVE",
          version: 1,
        });
      }

      await appendOutboxEvent(
        transaction,
        {
          eventType: "retention.watchlist.watched",
          schemaVersion: 1,
          aggregateType: "WatchlistEntry",
          aggregateId: targetId,
          aggregateVersion: nextVersion,
          occurredAt: now,
          ownerModule: "retention",
          dataClassification: "CONFIDENTIAL",
          payload: {
            watchlistEntryId: targetId,
            userId: input.userId,
            listingId: input.listingId,
            catalogItemId: input.catalogItemId,
            kind: input.kind,
            currency: input.currency,
            referencePriceMinor: input.referencePriceMinor.toString(),
            targetPriceMinor: input.targetPriceMinor?.toString() ?? null,
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "retention.watchlist.watch",
          resourceType: "WatchlistEntry",
          resourceId: targetId,
          afterRedacted: {
            listingId: input.listingId,
            kind: input.kind,
            referencePriceMinor: input.referencePriceMinor.toString(),
            targetPriceMinor: input.targetPriceMinor?.toString() ?? null,
          },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );

      return targetId;
    });

    return this.requireById(watchlistEntryId);
  }

  /** Cancelar é imediato e de um clique — nunca escondido atrás de confirmação penosa. */
  async unwatch(watchlistEntryId: string, actor: ActorContext): Promise<WatchlistEntryRow> {
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      const [row] = await transaction
        .select()
        .from(watchlistEntries)
        .where(eq(watchlistEntries.watchlistEntryId, watchlistEntryId))
        .for("update");

      if (!row) throw notFound("Vigilância não encontrada.");
      assertRetentionActor(actor, row.userId);
      if (row.status === "CANCELLED") return;

      const nextVersion = row.version + 1;
      await transaction
        .update(watchlistEntries)
        .set({ status: "CANCELLED", version: nextVersion })
        .where(eq(watchlistEntries.watchlistEntryId, watchlistEntryId));

      await appendOutboxEvent(
        transaction,
        {
          eventType: "retention.watchlist.cancelled",
          schemaVersion: 1,
          aggregateType: "WatchlistEntry",
          aggregateId: watchlistEntryId,
          aggregateVersion: nextVersion,
          occurredAt: now,
          ownerModule: "retention",
          dataClassification: "CONFIDENTIAL",
          payload: { watchlistEntryId, userId: row.userId, listingId: row.listingId },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "retention.watchlist.unwatch",
          resourceType: "WatchlistEntry",
          resourceId: watchlistEntryId,
          afterRedacted: { status: "CANCELLED" },
          dataClassification: "CONFIDENTIAL",
        },
        actor,
      );
    });

    return this.requireById(watchlistEntryId);
  }

  async listForUser(
    userId: string,
    actor: ActorContext,
    options: { status?: WatchlistStatus | undefined } = {},
  ): Promise<{ data: WatchlistEntryRow[]; asOf: Date }> {
    assertRetentionActor(actor, userId);
    const asOf = new Date();
    const conditions = [eq(watchlistEntries.userId, userId)];
    if (options.status) conditions.push(eq(watchlistEntries.status, options.status));

    const data = await this.db
      .select()
      .from(watchlistEntries)
      .where(and(...conditions))
      .orderBy(desc(watchlistEntries.createdAt), asc(watchlistEntries.watchlistEntryId));

    return { data, asOf };
  }

  /**
   * Avalia uma mudança real de preço de um anúncio e devolve quais vigilâncias ativas
   * disparam. Não envia nada: quem envia é o ReminderService, e ele ainda aplica consent,
   * frequência, dedupe e janela de silêncio antes de qualquer mensagem sair.
   *
   * Rotina de sistema: sem guarda de ator, protegida na camada de API.
   */
  async evaluatePriceChange(
    listingId: string,
    newPriceMinor: bigint,
  ): Promise<WatchlistTriggerHit[]> {
    const entries = await this.db
      .select()
      .from(watchlistEntries)
      .where(
        and(
          eq(watchlistEntries.listingId, listingId),
          eq(watchlistEntries.status, "ACTIVE"),
        ),
      )
      .orderBy(asc(watchlistEntries.watchlistEntryId));

    const hits: WatchlistTriggerHit[] = [];
    for (const entry of entries) {
      const decision = evaluateWatchlistPriceChange({
        kind: entry.kind as WatchlistKind,
        referencePriceMinor: entry.referencePriceMinor,
        targetPriceMinor: entry.targetPriceMinor,
        newPriceMinor,
      });
      if (!decision.triggered) continue;
      hits.push({
        entry,
        reason: decision.reason,
        previousPriceMinor: entry.referencePriceMinor,
        newPriceMinor,
      });
    }
    return hits;
  }

  /** Mesma ideia para reabastecimento real de estoque. */
  async evaluateStockChange(
    listingId: string,
    quantityAvailable: number,
  ): Promise<WatchlistEntryRow[]> {
    const entries = await this.db
      .select()
      .from(watchlistEntries)
      .where(
        and(
          eq(watchlistEntries.listingId, listingId),
          eq(watchlistEntries.status, "ACTIVE"),
        ),
      )
      .orderBy(asc(watchlistEntries.watchlistEntryId));

    return entries.filter(
      (entry) =>
        evaluateWatchlistStockChange({
          kind: entry.kind as WatchlistKind,
          quantityAvailable,
        }).triggered,
    );
  }

  /**
   * Fecha as vigilâncias que já geraram aviso, registrando a data real da notificação.
   * Rotina de sistema, chamada depois que o lembrete foi efetivamente aceito.
   */
  async markTriggered(
    watchlistEntryIds: string[],
    notifiedAt: Date,
    actor: ActorContext,
  ): Promise<number> {
    if (watchlistEntryIds.length === 0) return 0;

    return withSerializableTransaction(this.db, async (transaction) => {
      const rows = await transaction
        .select()
        .from(watchlistEntries)
        .where(
          and(
            inArray(watchlistEntries.watchlistEntryId, watchlistEntryIds),
            eq(watchlistEntries.status, "ACTIVE"),
          ),
        )
        .for("update");

      for (const row of rows) {
        const nextVersion = row.version + 1;
        await transaction
          .update(watchlistEntries)
          .set({ status: "TRIGGERED", lastNotifiedAt: notifiedAt, version: nextVersion })
          .where(eq(watchlistEntries.watchlistEntryId, row.watchlistEntryId));

        await appendOutboxEvent(
          transaction,
          {
            eventType: "retention.watchlist.triggered",
            schemaVersion: 1,
            aggregateType: "WatchlistEntry",
            aggregateId: row.watchlistEntryId,
            aggregateVersion: nextVersion,
            occurredAt: notifiedAt,
            ownerModule: "retention",
            dataClassification: "CONFIDENTIAL",
            payload: {
              watchlistEntryId: row.watchlistEntryId,
              userId: row.userId,
              listingId: row.listingId,
              kind: row.kind,
              notifiedAt: notifiedAt.toISOString(),
            },
          },
          actor,
        );
      }

      return rows.length;
    });
  }

  async findById(watchlistEntryId: string): Promise<WatchlistEntryRow | null> {
    const [row] = await this.db
      .select()
      .from(watchlistEntries)
      .where(eq(watchlistEntries.watchlistEntryId, watchlistEntryId))
      .limit(1);
    return row ?? null;
  }

  private async requireById(watchlistEntryId: string): Promise<WatchlistEntryRow> {
    const row = await this.findById(watchlistEntryId);
    if (!row) throw notFound("Vigilância não encontrada.");
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

function notFound(detail: string): AppProblem {
  return new AppProblem({
    status: 404,
    code: "WATCHLIST_ENTRY_NOT_FOUND",
    title: "Não encontrado",
    detail,
  });
}
