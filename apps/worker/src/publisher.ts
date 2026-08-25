import {
  assertOutboxTransportEvent,
  type OutboxTransportEvent,
} from "@midas/contracts";
import type { LeasedOutboxEvent } from "@midas/eventing";
import { toPublicId } from "@midas/kernel";

export function buildOutboxTransportEvent(event: LeasedOutboxEvent): OutboxTransportEvent {
  const candidate: unknown = {
    eventId: toPublicId("event", event.eventId),
    eventType: event.eventType,
    schemaVersion: event.schemaVersion,
    aggregateType: event.aggregateType,
    aggregateId: publicAggregateId(event.aggregateType, event.aggregateId),
    aggregateVersion: event.aggregateVersion,
    occurredAt: event.occurredAt.toISOString(),
    recordedAt: event.recordedAt.toISOString(),
    correlationId: event.correlationId,
    causationId: event.causationId,
    actorUserId: event.actorUserId ? toPublicId("user", event.actorUserId) : null,
    sellerAccountId: event.sellerAccountId
      ? toPublicId("sellerAccount", event.sellerAccountId)
      : null,
    sourceModule: event.ownerModule,
    dataClassification: event.dataClassification,
    payload: event.payload,
  };
  assertOutboxTransportEvent(candidate);
  return candidate;
}

export async function publishOutboxEvent(
  endpoint: string,
  token: string,
  event: LeasedOutboxEvent,
): Promise<void> {
  const body = buildOutboxTransportEvent(event);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Publisher respondeu HTTP ${String(response.status)}`);
}

function publicAggregateId(aggregateType: string, aggregateId: string): string {
  switch (aggregateType) {
    case "User":
      return toPublicId("user", aggregateId);
    case "SellerAccount":
      return toPublicId("sellerAccount", aggregateId);
    case "SellerMembership":
      return toPublicId("sellerMembership", aggregateId);
    default:
      return aggregateId;
  }
}
