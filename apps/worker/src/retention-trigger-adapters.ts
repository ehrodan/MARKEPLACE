import { and, asc, eq, notExists } from "drizzle-orm";
import { listings } from "@midas/catalog";
import { withSerializableTransaction, type DatabaseHandle } from "@midas/database";
import { inboxReceipts, outboxEvents, recordInboxOnce } from "@midas/eventing";
import { toPublicId } from "@midas/kernel";
import { ReminderService, WatchlistService } from "@midas/retention";
import {
  LISTING_UPDATED_EVENT_TYPE,
  RETENTION_TRIGGER_CONSUMER_ID,
  type RetentionTriggerDependencies,
} from "./retention-trigger.js";

/**
 * Liga as portas do motor de triggers aos serviços e tabelas reais.
 *
 * O consumo é independente do publicador externo: lê `eventing.outbox_events` diretamente e
 * marca progresso em `eventing.inbox_receipts` (par consumidor+evento, idempotente via
 * `recordInboxOnce`), sem tocar em `publication_status`/lease — que pertencem ao fluxo de
 * publicação HTTP. O estado do anúncio é lido no módulo dono (catalog) na hora do
 * processamento, como exige docs/coordenacao/WIRING-retention-domain.md §6.
 */
export function createRetentionTriggerDependencies(
  handle: DatabaseHandle,
): RetentionTriggerDependencies {
  const watchlist = new WatchlistService(handle.db);
  const reminders = new ReminderService(handle.db);

  return {
    watchlist,
    reminders,

    async fetchUnprocessed(limit) {
      return handle.db
        .select({
          eventId: outboxEvents.eventId,
          correlationId: outboxEvents.correlationId,
          occurredAt: outboxEvents.occurredAt,
          payload: outboxEvents.payload,
        })
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.eventType, LISTING_UPDATED_EVENT_TYPE),
            notExists(
              handle.db
                .select({ eventId: inboxReceipts.eventId })
                .from(inboxReceipts)
                .where(
                  and(
                    eq(inboxReceipts.consumerId, RETENTION_TRIGGER_CONSUMER_ID),
                    eq(inboxReceipts.eventId, outboxEvents.eventId),
                  ),
                ),
            ),
          ),
        )
        .orderBy(asc(outboxEvents.recordedAt), asc(outboxEvents.eventId))
        .limit(limit);
    },

    async ack(eventId) {
      await withSerializableTransaction(handle.db, async (transaction) => {
        await recordInboxOnce(
          transaction,
          RETENTION_TRIGGER_CONSUMER_ID,
          toPublicId("event", eventId),
        );
      });
    },

    async listingFacts(listingId) {
      const [row] = await handle.db
        .select({
          listingStatus: listings.listingStatus,
          tombstonedAt: listings.tombstonedAt,
        })
        .from(listings)
        .where(eq(listings.listingId, listingId))
        .limit(1);
      if (!row) return null;
      return {
        listingPublished: row.listingStatus === "PUBLISHED" && row.tombstonedAt === null,
      };
    },
  };
}
