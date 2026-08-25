import { z } from "zod";
import { AppProblem, type ActorContext } from "@midas/kernel";
import type {
  CreateNotificationInput,
  EnqueueReminderInput,
  EnqueueReminderResult,
  ReminderSuppressionReason,
  WatchlistEntryRow,
  WatchlistTriggerHit,
} from "@midas/retention";

/**
 * Motor de triggers da watchlist ("me avise se o preço cair / voltar ao estoque").
 *
 * Consome o evento canônico REAL `catalog.listing.updated` do outbox — publicado por
 * `CatalogService.updateListing` (modules/catalog/src/catalog-service.ts) com o preço e o
 * estoque novos — e liga o circuito que estava aberto:
 *
 *   evento → WatchlistService.evaluatePriceChange / evaluateStockChange
 *          → ReminderService.enqueue        (a política decide: consent, dedupe, frequência,
 *                                            janela de silêncio — recusa vira linha suprimida
 *                                            com motivo nomeado, nunca envio escondido)
 *          → entrega imediata no feed IN_APP (notify + markSent, citando o preço REAL do evento)
 *          → WatchlistService.markTriggered (idempotente: só fecha vigilância ACTIVE)
 *
 * Honestidade (PRD §19): nada aqui inventa dado. O aviso cita o preço que o evento carrega e
 * a referência que a própria pessoa viu ao pedir a vigilância. Quando a política recusa, a
 * recusa fica registrada; quando um fato não pode ser confirmado (anúncio sumiu), os fatos
 * entram fail-closed (`listingPublished: false`) e a política suprime com motivo nomeado.
 *
 * Canal: apenas IN_APP (feed que a própria pessoa consulta — canal PULL). EMAIL/PUSH exigem
 * fuso horário real da pessoa (janela de silêncio) e um entregador de mensagens; nenhum dos
 * dois existe ainda. Enfileirar EMAIL sem quem envie seria prometer mensagem que não sai.
 */

export const LISTING_UPDATED_EVENT_TYPE = "catalog.listing.updated";
export const RETENTION_TRIGGER_CONSUMER_ID = "retention.watchlist-trigger";
export const RETENTION_TRIGGER_BATCH_LIMIT = 50;

/**
 * A política só consulta o fuso em janela de silêncio, que por regra não se aplica ao canal
 * IN_APP (`quietHoursApply` exige canal PUSH/EMAIL). Este valor nunca é lido no fluxo atual;
 * existe porque o contrato de `enqueue` exige o campo. Quando EMAIL/PUSH forem ligados, o
 * fuso REAL da pessoa precisa vir do identity — não deste fallback.
 */
export const IN_APP_TIME_ZONE_PLACEHOLDER = "America/Sao_Paulo";

// ---------------------------------------------------------------------------------------
// Payload do evento canônico
// ---------------------------------------------------------------------------------------

const listingUpdatedPayloadSchema = z.object({
  listingId: z.uuid(),
  /** Dinheiro trafega como string de minor units no outbox; vira BigInt aqui. */
  priceMinor: z.string().regex(/^\d+$/, "priceMinor deve ser inteiro não negativo em string"),
  quantityAvailable: z.number().int().min(0),
});

export type ListingChangeFacts = {
  listingId: string;
  priceMinor: bigint;
  quantityAvailable: number;
};

export function parseListingUpdatedPayload(
  payload: Record<string, unknown>,
): { ok: true; change: ListingChangeFacts } | { ok: false; issues: string[] } {
  const parsed = listingUpdatedPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.map(String).join(".")}: ${issue.message}`,
      ),
    };
  }
  return {
    ok: true,
    change: {
      listingId: parsed.data.listingId,
      priceMinor: BigInt(parsed.data.priceMinor),
      quantityAvailable: parsed.data.quantityAvailable,
    },
  };
}

// ---------------------------------------------------------------------------------------
// Portas (implementadas pelos serviços reais em retention-trigger-adapters.ts;
// nos testes, por fakes — mesmo padrão dos testes existentes do worker)
// ---------------------------------------------------------------------------------------

export type WatchlistPort = {
  evaluatePriceChange(listingId: string, newPriceMinor: bigint): Promise<WatchlistTriggerHit[]>;
  evaluateStockChange(listingId: string, quantityAvailable: number): Promise<WatchlistEntryRow[]>;
  markTriggered(
    watchlistEntryIds: string[],
    notifiedAt: Date,
    actor: ActorContext,
  ): Promise<number>;
};

export type ReminderPort = {
  enqueue(input: EnqueueReminderInput, actor: ActorContext): Promise<EnqueueReminderResult>;
  notify(input: CreateNotificationInput, actor: ActorContext): Promise<unknown>;
  markSent(reminderDispatchId: string, sentAt: Date, actor: ActorContext): Promise<unknown>;
  suppress(
    reminderDispatchId: string,
    reason: ReminderSuppressionReason,
    actor: ActorContext,
  ): Promise<unknown>;
};

/** Fato lido no módulo dono (catalog) na hora do processamento. `null` = anúncio não existe. */
export type ListingFactsPort = (
  listingId: string,
) => Promise<{ listingPublished: boolean } | null>;

// ---------------------------------------------------------------------------------------
// Dinheiro e conteúdo do aviso (puros)
// ---------------------------------------------------------------------------------------

/**
 * Formata minor units (2 casas) com exatidão BigInt — nunca passa por Number, então
 * R$ 90.071.992.547.409,93 sai com todos os dígitos certos.
 */
export function formatMinorAmount(currency: string, amountMinor: bigint): string {
  const negative = amountMinor < 0n;
  const absolute = negative ? -amountMinor : amountMinor;
  const integerPart = new Intl.NumberFormat("pt-BR").format(absolute / 100n);
  const cents = (absolute % 100n).toString().padStart(2, "0");
  const prefix = currency === "BRL" ? "R$" : currency;
  return `${negative ? "-" : ""}${prefix} ${integerPart},${cents}`;
}

export type NotificationContent = { title: string; body: string };

/** Texto factual: cita o preço real do evento e a referência/alvo reais da vigilância. */
export function buildPriceNotification(hit: WatchlistTriggerHit): NotificationContent {
  const currency = hit.entry.currency;
  const newPrice = formatMinorAmount(currency, hit.newPriceMinor);
  if (hit.reason === "TARGET_PRICE_REACHED" && hit.entry.targetPriceMinor !== null) {
    return {
      title: "Preço chegou ao alvo que você definiu",
      body: `O anúncio que você acompanha está por ${newPrice}. Seu alvo: ${formatMinorAmount(currency, hit.entry.targetPriceMinor)}.`,
    };
  }
  return {
    title: "O preço caiu",
    body: `O preço passou de ${formatMinorAmount(currency, hit.previousPriceMinor)} para ${newPrice} no anúncio que você acompanha.`,
  };
}

export function buildStockNotification(quantityAvailable: number): NotificationContent {
  const unidades =
    quantityAvailable === 1 ? "1 unidade disponível" : `${String(quantityAvailable)} unidades disponíveis`;
  return {
    title: "Disponível novamente",
    body: `O anúncio que você acompanha tem ${unidades}.`,
  };
}

/**
 * Um motivo por geração armada da vigilância: `version` só muda quando a pessoa rearma
 * (watch de novo) ou quando a vigilância fecha — então retry do mesmo evento reaproveita a
 * chave e a política responde DEDUPE_KEY_ALREADY_USED em vez de duplicar aviso.
 */
export function watchlistDedupeKey(
  entry: Pick<WatchlistEntryRow, "watchlistEntryId" | "version">,
): string {
  return `retention.watchlist.${entry.watchlistEntryId}.v${String(entry.version)}`;
}

// ---------------------------------------------------------------------------------------
// Processamento de um evento
// ---------------------------------------------------------------------------------------

export type ListingChangeEvent = {
  /** uuid do evento no outbox. */
  eventId: string;
  /** Correlação original do evento — encadeia auditoria do trigger à mudança que o causou. */
  correlationId: string;
  occurredAt: Date;
  change: ListingChangeFacts;
};

export type WatchTriggerResult =
  | "DELIVERED"
  | "ALREADY_TRIGGERED"
  | "SUPPRESSED"
  | "REVOKED_AT_DELIVERY";

export type WatchTriggerOutcome = {
  watchlistEntryId: string;
  userId: string;
  purpose: "PRICE_WATCH" | "STOCK_WATCH";
  result: WatchTriggerResult;
  suppressedReason: ReminderSuppressionReason | null;
};

export type ListingChangeSummary = {
  eventId: string;
  listingId: string;
  priceHits: number;
  stockHits: number;
  outcomes: WatchTriggerOutcome[];
  closedWatches: number;
};

export type ListingChangePorts = {
  watchlist: WatchlistPort;
  reminders: ReminderPort;
  listingFacts: ListingFactsPort;
};

export async function processListingChange(
  event: ListingChangeEvent,
  ports: ListingChangePorts,
  now: Date,
): Promise<ListingChangeSummary> {
  /** Rotina de sistema: sem actorUserId; a correlação preserva a cadeia causal do evento. */
  const actor: ActorContext = { correlationId: event.correlationId };
  const { listingId, priceMinor, quantityAvailable } = event.change;

  const listing = await ports.listingFacts(listingId);
  const subject = {
    // Campos de carrinho não se aplicam a PRICE_WATCH/STOCK_WATCH; a política os ignora.
    cartRecovered: false,
    cartItemCount: 0,
    // Fail-closed: anúncio que sumiu não sustenta aviso; a política suprime com motivo nomeado.
    listingPublished: listing?.listingPublished ?? false,
    priceAvailable: listing !== null,
  };

  const priceHits = await ports.watchlist.evaluatePriceChange(listingId, priceMinor);
  const stockRows = await ports.watchlist.evaluateStockChange(listingId, quantityAvailable);

  // Vigilância armada DEPOIS do evento não é notícia para ela: a referência que a pessoa viu
  // já reflete estado mais novo. Evita citar preço velho em replay de histórico.
  const timelyPriceHits = priceHits.filter((hit) => hit.entry.createdAt <= event.occurredAt);
  const timelyStockRows = stockRows.filter((row) => row.createdAt <= event.occurredAt);

  // ANY_OFFER pode aparecer nos dois avaliadores no mesmo evento; um aviso basta,
  // e o de preço é o mais informativo.
  const priceHitIds = new Set(timelyPriceHits.map((hit) => hit.entry.watchlistEntryId));
  const stockOnlyRows = timelyStockRows.filter(
    (row) => !priceHitIds.has(row.watchlistEntryId),
  );

  const outcomes: WatchTriggerOutcome[] = [];
  const entryIdsToClose: string[] = [];

  for (const hit of timelyPriceHits) {
    const outcome = await triggerWatch({
      entry: hit.entry,
      purpose: "PRICE_WATCH",
      notificationKind: "PRICE_DROP",
      content: buildPriceNotification(hit),
      subject,
      ports,
      actor,
      now,
    });
    outcomes.push(outcome.outcome);
    if (outcome.closeWatch) entryIdsToClose.push(hit.entry.watchlistEntryId);
  }

  for (const row of stockOnlyRows) {
    const outcome = await triggerWatch({
      entry: row,
      purpose: "STOCK_WATCH",
      notificationKind: "BACK_IN_STOCK",
      content: buildStockNotification(quantityAvailable),
      subject,
      ports,
      actor,
      now,
    });
    outcomes.push(outcome.outcome);
    if (outcome.closeWatch) entryIdsToClose.push(row.watchlistEntryId);
  }

  const closedWatches =
    entryIdsToClose.length > 0
      ? await ports.watchlist.markTriggered(entryIdsToClose, now, actor)
      : 0;

  return {
    eventId: event.eventId,
    listingId,
    priceHits: timelyPriceHits.length,
    stockHits: stockOnlyRows.length,
    outcomes,
    closedWatches,
  };
}

type TriggerWatchArgs = {
  entry: WatchlistEntryRow;
  purpose: "PRICE_WATCH" | "STOCK_WATCH";
  notificationKind: "PRICE_DROP" | "BACK_IN_STOCK";
  content: NotificationContent;
  subject: EnqueueReminderInput["subject"];
  ports: ListingChangePorts;
  actor: ActorContext;
  now: Date;
};

async function triggerWatch(
  args: TriggerWatchArgs,
): Promise<{ outcome: WatchTriggerOutcome; closeWatch: boolean }> {
  const { entry, purpose, ports, actor, now } = args;
  const base = { watchlistEntryId: entry.watchlistEntryId, userId: entry.userId, purpose };

  const enqueueResult = await ports.reminders.enqueue(
    {
      userId: entry.userId,
      purpose,
      channel: "IN_APP",
      dedupeKey: watchlistDedupeKey(entry),
      scheduledFor: now,
      userTimeZone: IN_APP_TIME_ZONE_PLACEHOLDER,
      subjectRef: entry.listingId,
      subject: args.subject,
    },
    actor,
  );

  if (!enqueueResult.accepted) {
    if (enqueueResult.reason === "DEDUPE_KEY_ALREADY_USED") {
      // Já disparou nesta geração armada (retry após falha parcial): fecha idempotente.
      return {
        outcome: { ...base, result: "ALREADY_TRIGGERED", suppressedReason: enqueueResult.reason },
        closeWatch: true,
      };
    }
    // Recusa da política (consent, frequência, anúncio fora do ar…) fica registrada e a
    // vigilância continua armada para o próximo evento real.
    return {
      outcome: { ...base, result: "SUPPRESSED", suppressedReason: enqueueResult.reason },
      closeWatch: false,
    };
  }

  const dispatchId = enqueueResult.dispatch.reminderDispatchId;
  try {
    await ports.reminders.notify(
      {
        userId: entry.userId,
        kind: args.notificationKind,
        title: args.content.title,
        body: args.content.body,
        deepLink: `/anuncios/${entry.listingId}`,
        relatedRef: entry.listingId,
      },
      actor,
    );
  } catch (error) {
    // Defesa em profundidade do feed: revogação entre o enqueue e a entrega bloqueia.
    if (error instanceof AppProblem && error.code === "RETENTION_CONSENT_REVOKED") {
      await ports.reminders.suppress(dispatchId, "CONSENT_REVOKED", actor);
      return {
        outcome: { ...base, result: "REVOKED_AT_DELIVERY", suppressedReason: "CONSENT_REVOKED" },
        closeWatch: false,
      };
    }
    throw error;
  }

  await ports.reminders.markSent(dispatchId, now, actor);
  return {
    outcome: { ...base, result: "DELIVERED", suppressedReason: null },
    closeWatch: true,
  };
}

// ---------------------------------------------------------------------------------------
// Ciclo: lê o outbox uma vez por evento (inbox receipt) e processa em ordem
// ---------------------------------------------------------------------------------------

export type RawOutboxEvent = {
  eventId: string;
  correlationId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
};

export type RetentionTriggerDependencies = ListingChangePorts & {
  /** Eventos `catalog.listing.updated` ainda sem receipt deste consumidor, mais antigos primeiro. */
  fetchUnprocessed(limit: number): Promise<RawOutboxEvent[]>;
  /** Grava o inbox receipt (idempotente). Só é chamado após processar — falha reprocessa. */
  ack(eventId: string): Promise<void>;
  now?: () => Date;
};

export type RetentionTriggerCycleSummary = {
  fetched: number;
  processed: number;
  delivered: number;
  suppressed: number;
  closedWatches: number;
  /** Payload fora do contrato canônico: bug do produtor, nomeado aqui e não trava a fila. */
  invalid: { eventId: string; issues: string[] }[];
  /** Falha transiente: evento fica SEM receipt e volta no próximo ciclo. */
  failed: { eventId: string; message: string }[];
};

export async function runRetentionTriggerCycle(
  deps: RetentionTriggerDependencies,
): Promise<RetentionTriggerCycleSummary> {
  const events = await deps.fetchUnprocessed(RETENTION_TRIGGER_BATCH_LIMIT);
  const summary: RetentionTriggerCycleSummary = {
    fetched: events.length,
    processed: 0,
    delivered: 0,
    suppressed: 0,
    closedWatches: 0,
    invalid: [],
    failed: [],
  };

  for (const raw of events) {
    const parsed = parseListingUpdatedPayload(raw.payload);
    if (!parsed.ok) {
      summary.invalid.push({ eventId: raw.eventId, issues: parsed.issues });
      await deps.ack(raw.eventId);
      continue;
    }

    try {
      const result = await processListingChange(
        {
          eventId: raw.eventId,
          correlationId: raw.correlationId,
          occurredAt: raw.occurredAt,
          change: parsed.change,
        },
        deps,
        deps.now?.() ?? new Date(),
      );
      summary.processed += 1;
      summary.closedWatches += result.closedWatches;
      for (const outcome of result.outcomes) {
        if (outcome.result === "DELIVERED") summary.delivered += 1;
        else if (outcome.result !== "ALREADY_TRIGGERED") summary.suppressed += 1;
      }
      await deps.ack(raw.eventId);
    } catch (error) {
      summary.failed.push({
        eventId: raw.eventId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}
