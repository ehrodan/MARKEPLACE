import { describe, expect, it } from "vitest";
import { AppProblem, type ActorContext } from "@midas/kernel";
import type {
  CreateNotificationInput,
  EnqueueReminderInput,
  EnqueueReminderResult,
  ReminderDispatchRow,
  ReminderSuppressionReason,
  WatchlistEntryRow,
  WatchlistTriggerHit,
} from "@midas/retention";
import {
  buildPriceNotification,
  buildStockNotification,
  formatMinorAmount,
  parseListingUpdatedPayload,
  processListingChange,
  runRetentionTriggerCycle,
  watchlistDedupeKey,
  type ListingChangeEvent,
  type ListingChangePorts,
  type RawOutboxEvent,
  type ReminderPort,
  type WatchlistPort,
} from "../src/retention-trigger.js";

const LISTING_ID = "0198f5f8-8f04-7a4d-8af4-3be2437f8aaa";
const ENTRY_ID = "0198f5f8-8f04-7a4d-8af4-3be2437f8bbb";
const USER_ID = "0198f5f8-8f04-7a4d-8af4-3be2437f8ccc";
const EVENT_ID = "0198f5f8-8f04-7a4d-8af4-3be2437f8ddd";

const ARMED_AT = new Date("2026-08-01T12:00:00.000Z");
const OCCURRED_AT = new Date("2026-08-20T15:00:00.000Z");
const NOW = new Date("2026-08-20T15:00:01.000Z");

function watchRow(overrides: Partial<WatchlistEntryRow> = {}): WatchlistEntryRow {
  return {
    watchlistEntryId: ENTRY_ID,
    userId: USER_ID,
    listingId: LISTING_ID,
    catalogItemId: "0198f5f8-8f04-7a4d-8af4-3be2437f8eee",
    kind: "PRICE_DROP",
    targetPriceMinor: null,
    currency: "BRL",
    referencePriceMinor: 120_000n,
    createdAt: ARMED_AT,
    lastNotifiedAt: null,
    status: "ACTIVE",
    version: 1,
    ...overrides,
  };
}

function priceHit(
  entry: WatchlistEntryRow,
  newPriceMinor: bigint,
  reason: WatchlistTriggerHit["reason"] = "PRICE_DROPPED",
): WatchlistTriggerHit {
  return { entry, reason, previousPriceMinor: entry.referencePriceMinor, newPriceMinor };
}

function dispatchRow(overrides: Partial<ReminderDispatchRow> = {}): ReminderDispatchRow {
  return {
    reminderDispatchId: "0198f5f8-8f04-7a4d-8af4-3be2437f8fff",
    userId: USER_ID,
    purpose: "PRICE_WATCH",
    channel: "IN_APP",
    subjectRef: LISTING_ID,
    scheduledFor: NOW,
    sentAt: null,
    suppressedReason: null,
    dedupeKey: `retention.watchlist.${ENTRY_ID}.v1`,
    createdAt: NOW,
    ...overrides,
  };
}

function accepted(dispatch = dispatchRow()): EnqueueReminderResult {
  return { accepted: true, dispatch, policyVersion: "retention-reminder-policy@1.0.0" };
}

function suppressed(reason: ReminderSuppressionReason): EnqueueReminderResult {
  return {
    accepted: false,
    reason,
    message: "recusado",
    dispatch: dispatchRow({ suppressedReason: reason }),
    policyVersion: "retention-reminder-policy@1.0.0",
  };
}

class FakeReminders implements ReminderPort {
  enqueueCalls: EnqueueReminderInput[] = [];
  notifyCalls: CreateNotificationInput[] = [];
  markSentCalls: { reminderDispatchId: string; sentAt: Date }[] = [];
  suppressCalls: { reminderDispatchId: string; reason: ReminderSuppressionReason }[] = [];
  /** Resultados devolvidos na ordem das chamadas; sem item = aceito. */
  enqueueResults: EnqueueReminderResult[] = [];
  notifyError: Error | null = null;

  enqueue(input: EnqueueReminderInput): Promise<EnqueueReminderResult> {
    this.enqueueCalls.push(input);
    return Promise.resolve(this.enqueueResults.shift() ?? accepted());
  }

  notify(input: CreateNotificationInput): Promise<unknown> {
    if (this.notifyError !== null) return Promise.reject(this.notifyError);
    this.notifyCalls.push(input);
    return Promise.resolve({ notificationId: "n1" });
  }

  markSent(reminderDispatchId: string, sentAt: Date): Promise<unknown> {
    this.markSentCalls.push({ reminderDispatchId, sentAt });
    return Promise.resolve(dispatchRow({ reminderDispatchId, sentAt }));
  }

  suppress(reminderDispatchId: string, reason: ReminderSuppressionReason): Promise<unknown> {
    this.suppressCalls.push({ reminderDispatchId, reason });
    return Promise.resolve(dispatchRow({ reminderDispatchId, suppressedReason: reason }));
  }
}

class FakeWatchlist implements WatchlistPort {
  markTriggeredCalls: { watchlistEntryIds: string[]; notifiedAt: Date }[] = [];

  constructor(
    private readonly hits: WatchlistTriggerHit[] = [],
    private readonly stockRows: WatchlistEntryRow[] = [],
  ) {}

  evaluatePriceChange(): Promise<WatchlistTriggerHit[]> {
    return Promise.resolve(this.hits);
  }

  evaluateStockChange(): Promise<WatchlistEntryRow[]> {
    return Promise.resolve(this.stockRows);
  }

  markTriggered(
    watchlistEntryIds: string[],
    notifiedAt: Date,
    _actor: ActorContext,
  ): Promise<number> {
    this.markTriggeredCalls.push({ watchlistEntryIds, notifiedAt });
    return Promise.resolve(watchlistEntryIds.length);
  }
}

function ports(
  watchlist: FakeWatchlist,
  reminders: FakeReminders,
  listingPublished: boolean | null = true,
): ListingChangePorts {
  return {
    watchlist,
    reminders,
    listingFacts: () =>
      Promise.resolve(listingPublished === null ? null : { listingPublished }),
  };
}

function listingEvent(
  priceMinor: bigint,
  quantityAvailable: number,
): ListingChangeEvent {
  return {
    eventId: EVENT_ID,
    correlationId: "corr-1",
    occurredAt: OCCURRED_AT,
    change: { listingId: LISTING_ID, priceMinor, quantityAvailable },
  };
}

describe("formatMinorAmount — exatidão BigInt, sem passar por Number", () => {
  it("formata BRL com agrupamento pt-BR", () => {
    expect(formatMinorAmount("BRL", 119_999n)).toBe("R$ 1.199,99");
    expect(formatMinorAmount("BRL", 0n)).toBe("R$ 0,00");
    expect(formatMinorAmount("BRL", 5n)).toBe("R$ 0,05");
  });

  it("mantém todos os dígitos acima do limite seguro do number", () => {
    expect(formatMinorAmount("BRL", 9_007_199_254_740_993n)).toBe(
      "R$ 90.071.992.547.409,93",
    );
  });

  it("moeda que não é BRL sai com o código, nunca com símbolo inventado", () => {
    expect(formatMinorAmount("USD", 100n)).toBe("USD 1,00");
  });
});

describe("parseListingUpdatedPayload — contrato canônico do catálogo", () => {
  it("aceita o payload real de catalog.listing.updated e converte preço para BigInt", () => {
    const result = parseListingUpdatedPayload({
      listingId: LISTING_ID,
      priceMinor: "119900",
      quantityAvailable: 3,
      revisionNumber: 2,
    });
    expect(result).toEqual({
      ok: true,
      change: { listingId: LISTING_ID, priceMinor: 119_900n, quantityAvailable: 3 },
    });
  });

  it("recusa preço que não é inteiro não negativo em string", () => {
    const result = parseListingUpdatedPayload({
      listingId: LISTING_ID,
      priceMinor: "-5",
      quantityAvailable: 3,
    });
    expect(result.ok).toBe(false);
  });

  it("recusa payload sem os campos canônicos", () => {
    const result = parseListingUpdatedPayload({ listingId: LISTING_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
  });

  it("recusa quantidade negativa ou fracionária", () => {
    expect(
      parseListingUpdatedPayload({
        listingId: LISTING_ID,
        priceMinor: "100",
        quantityAvailable: -1,
      }).ok,
    ).toBe(false);
    expect(
      parseListingUpdatedPayload({
        listingId: LISTING_ID,
        priceMinor: "100",
        quantityAvailable: 1.5,
      }).ok,
    ).toBe(false);
  });
});

describe("conteúdo do aviso — cita só número real", () => {
  it("queda de preço cita o antes e o depois reais", () => {
    const content = buildPriceNotification(priceHit(watchRow(), 99_900n));
    expect(content.body).toContain("R$ 1.200,00");
    expect(content.body).toContain("R$ 999,00");
  });

  it("alvo atingido cita o preço novo e o alvo definido pela pessoa", () => {
    const content = buildPriceNotification(
      priceHit(watchRow({ targetPriceMinor: 100_000n }), 99_900n, "TARGET_PRICE_REACHED"),
    );
    expect(content.title).toBe("Preço chegou ao alvo que você definiu");
    expect(content.body).toContain("R$ 999,00");
    expect(content.body).toContain("R$ 1.000,00");
  });

  it("volta ao estoque cita a quantidade real, singular e plural", () => {
    expect(buildStockNotification(1).body).toContain("1 unidade disponível");
    expect(buildStockNotification(3).body).toContain("3 unidades disponíveis");
  });
});

describe("processListingChange — queda de preço de ponta a ponta", () => {
  it("enfileira pela política, entrega no feed e fecha a vigilância", async () => {
    const entry = watchRow();
    const watchlist = new FakeWatchlist([priceHit(entry, 99_900n)]);
    const reminders = new FakeReminders();

    const summary = await processListingChange(
      listingEvent(99_900n, 5),
      ports(watchlist, reminders),
      NOW,
    );

    expect(reminders.enqueueCalls).toHaveLength(1);
    const enqueue = reminders.enqueueCalls[0];
    expect(enqueue).toMatchObject({
      userId: USER_ID,
      purpose: "PRICE_WATCH",
      channel: "IN_APP",
      dedupeKey: `retention.watchlist.${ENTRY_ID}.v1`,
      subjectRef: LISTING_ID,
      subject: {
        listingPublished: true,
        priceAvailable: true,
        cartRecovered: false,
        cartItemCount: 0,
      },
    });

    expect(reminders.notifyCalls).toHaveLength(1);
    expect(reminders.notifyCalls[0]).toMatchObject({
      userId: USER_ID,
      kind: "PRICE_DROP",
      deepLink: `/anuncios/${LISTING_ID}`,
      relatedRef: LISTING_ID,
    });
    expect(reminders.notifyCalls[0]?.body).toContain("R$ 999,00");

    expect(reminders.markSentCalls).toHaveLength(1);
    expect(watchlist.markTriggeredCalls).toEqual([
      { watchlistEntryIds: [ENTRY_ID], notifiedAt: NOW },
    ]);
    expect(summary).toMatchObject({
      priceHits: 1,
      stockHits: 0,
      closedWatches: 1,
    });
    expect(summary.outcomes[0]?.result).toBe("DELIVERED");
  });

  it("rearmar muda a versão e, com ela, a chave de dedupe", () => {
    expect(watchlistDedupeKey(watchRow({ version: 3 }))).toBe(
      `retention.watchlist.${ENTRY_ID}.v3`,
    );
  });
});

describe("processListingChange — estoque e ANY_OFFER", () => {
  it("volta ao estoque enfileira STOCK_WATCH com o aviso do feed", async () => {
    const entry = watchRow({ kind: "BACK_IN_STOCK" });
    const watchlist = new FakeWatchlist([], [entry]);
    const reminders = new FakeReminders();

    await processListingChange(listingEvent(120_000n, 2), ports(watchlist, reminders), NOW);

    expect(reminders.enqueueCalls).toHaveLength(1);
    expect(reminders.enqueueCalls[0]?.purpose).toBe("STOCK_WATCH");
    expect(reminders.notifyCalls[0]?.kind).toBe("BACK_IN_STOCK");
    expect(reminders.notifyCalls[0]?.body).toContain("2 unidades disponíveis");
    expect(watchlist.markTriggeredCalls[0]?.watchlistEntryIds).toEqual([ENTRY_ID]);
  });

  it("ANY_OFFER atingido por preço E estoque no mesmo evento gera UM aviso (o de preço)", async () => {
    const anyOffer = watchRow({ kind: "ANY_OFFER" });
    const stockWatcher = watchRow({
      watchlistEntryId: "0198f5f8-8f04-7a4d-8af4-3be2437f8b02",
      userId: "0198f5f8-8f04-7a4d-8af4-3be2437f8c02",
      kind: "BACK_IN_STOCK",
    });
    const watchlist = new FakeWatchlist(
      [priceHit(anyOffer, 99_900n)],
      [anyOffer, stockWatcher],
    );
    const reminders = new FakeReminders();

    const summary = await processListingChange(
      listingEvent(99_900n, 2),
      ports(watchlist, reminders),
      NOW,
    );

    expect(reminders.enqueueCalls).toHaveLength(2);
    expect(reminders.enqueueCalls.map((call) => call.purpose)).toEqual([
      "PRICE_WATCH",
      "STOCK_WATCH",
    ]);
    expect(summary.priceHits).toBe(1);
    expect(summary.stockHits).toBe(1);
  });
});

describe("processListingChange — recusas da política", () => {
  it("recusa comum (consent ausente) não entrega e mantém a vigilância armada", async () => {
    const watchlist = new FakeWatchlist([priceHit(watchRow(), 99_900n)]);
    const reminders = new FakeReminders();
    reminders.enqueueResults = [suppressed("CONSENT_MISSING")];

    const summary = await processListingChange(
      listingEvent(99_900n, 5),
      ports(watchlist, reminders),
      NOW,
    );

    expect(reminders.notifyCalls).toHaveLength(0);
    expect(reminders.markSentCalls).toHaveLength(0);
    expect(watchlist.markTriggeredCalls).toHaveLength(0);
    expect(summary.closedWatches).toBe(0);
    expect(summary.outcomes[0]).toMatchObject({
      result: "SUPPRESSED",
      suppressedReason: "CONSENT_MISSING",
    });
  });

  it("dedupe já usado fecha a vigilância sem duplicar aviso (retry idempotente)", async () => {
    const watchlist = new FakeWatchlist([priceHit(watchRow(), 99_900n)]);
    const reminders = new FakeReminders();
    reminders.enqueueResults = [suppressed("DEDUPE_KEY_ALREADY_USED")];

    const summary = await processListingChange(
      listingEvent(99_900n, 5),
      ports(watchlist, reminders),
      NOW,
    );

    expect(reminders.notifyCalls).toHaveLength(0);
    expect(watchlist.markTriggeredCalls[0]?.watchlistEntryIds).toEqual([ENTRY_ID]);
    expect(summary.outcomes[0]?.result).toBe("ALREADY_TRIGGERED");
  });

  it("revogação entre o enqueue e a entrega suprime o disparo e não fecha a vigilância", async () => {
    const watchlist = new FakeWatchlist([priceHit(watchRow(), 99_900n)]);
    const reminders = new FakeReminders();
    reminders.notifyError = new AppProblem({
      status: 409,
      code: "RETENTION_CONSENT_REVOKED",
      title: "Conflito de negócio",
      detail: "O consentimento foi revogado por esta pessoa.",
    });

    const summary = await processListingChange(
      listingEvent(99_900n, 5),
      ports(watchlist, reminders),
      NOW,
    );

    expect(reminders.markSentCalls).toHaveLength(0);
    expect(reminders.suppressCalls).toEqual([
      {
        reminderDispatchId: dispatchRow().reminderDispatchId,
        reason: "CONSENT_REVOKED",
      },
    ]);
    expect(watchlist.markTriggeredCalls).toHaveLength(0);
    expect(summary.outcomes[0]?.result).toBe("REVOKED_AT_DELIVERY");
  });

  it("anúncio que sumiu vira fatos fail-closed, nunca fato otimista", async () => {
    const watchlist = new FakeWatchlist([priceHit(watchRow(), 99_900n)]);
    const reminders = new FakeReminders();

    await processListingChange(
      listingEvent(99_900n, 5),
      ports(watchlist, reminders, null),
      NOW,
    );

    expect(reminders.enqueueCalls[0]?.subject).toMatchObject({
      listingPublished: false,
      priceAvailable: false,
    });
  });

  it("vigilância armada depois do evento não dispara (evento não é notícia para ela)", async () => {
    const lateEntry = watchRow({ createdAt: new Date("2026-08-21T00:00:00.000Z") });
    const watchlist = new FakeWatchlist([priceHit(lateEntry, 99_900n)], [
      watchRow({ kind: "BACK_IN_STOCK", createdAt: new Date("2026-08-21T00:00:00.000Z") }),
    ]);
    const reminders = new FakeReminders();

    const summary = await processListingChange(
      listingEvent(99_900n, 5),
      ports(watchlist, reminders),
      NOW,
    );

    expect(reminders.enqueueCalls).toHaveLength(0);
    expect(summary.priceHits).toBe(0);
    expect(summary.stockHits).toBe(0);
  });
});

describe("runRetentionTriggerCycle — consumo do outbox", () => {
  function rawEvent(overrides: Partial<RawOutboxEvent> = {}): RawOutboxEvent {
    return {
      eventId: EVENT_ID,
      correlationId: "corr-1",
      occurredAt: OCCURRED_AT,
      payload: { listingId: LISTING_ID, priceMinor: "99900", quantityAvailable: 5 },
      ...overrides,
    };
  }

  it("processa em ordem, dá ack por evento e nomeia payload fora do contrato", async () => {
    const watchlist = new FakeWatchlist([priceHit(watchRow(), 99_900n)]);
    const reminders = new FakeReminders();
    const acked: string[] = [];
    const malformedId = "0198f5f8-8f04-7a4d-8af4-3be2437f8d02";

    const summary = await runRetentionTriggerCycle({
      watchlist,
      reminders,
      listingFacts: () => Promise.resolve({ listingPublished: true }),
      fetchUnprocessed: () =>
        Promise.resolve([
          rawEvent({ eventId: malformedId, payload: { listingId: LISTING_ID } }),
          rawEvent(),
        ]),
      ack: (eventId) => {
        acked.push(eventId);
        return Promise.resolve();
      },
      now: () => NOW,
    });

    expect(summary.fetched).toBe(2);
    expect(summary.processed).toBe(1);
    expect(summary.delivered).toBe(1);
    expect(summary.closedWatches).toBe(1);
    expect(summary.invalid).toHaveLength(1);
    expect(summary.invalid[0]?.eventId).toBe(malformedId);
    expect(acked).toEqual([malformedId, EVENT_ID]);
  });

  it("falha transiente não dá ack: o evento volta no próximo ciclo", async () => {
    const reminders = new FakeReminders();
    const acked: string[] = [];
    const failingWatchlist: WatchlistPort = {
      evaluatePriceChange: () => Promise.reject(new Error("banco indisponível")),
      evaluateStockChange: () => Promise.resolve([]),
      markTriggered: () => Promise.resolve(0),
    };

    const summary = await runRetentionTriggerCycle({
      watchlist: failingWatchlist,
      reminders,
      listingFacts: () => Promise.resolve({ listingPublished: true }),
      fetchUnprocessed: () => Promise.resolve([rawEvent()]),
      ack: (eventId) => {
        acked.push(eventId);
        return Promise.resolve();
      },
      now: () => NOW,
    });

    expect(summary.failed).toEqual([
      { eventId: EVENT_ID, message: "banco indisponível" },
    ]);
    expect(acked).toEqual([]);
  });
});
