import { describe, expect, it } from "vitest";
import {
  assertOutboxTransportEvent,
  EventContractError,
  registeredOutboxEventTypes,
} from "../src/events.js";

const uuid = "0198f5f8-8f04-7a4d-8af4-3be2437f8123";

describe("contratos de evento do corte 01", () => {
  it("aceita o envelope plano que o dispatcher publica", () => {
    const event = {
      eventId: `evt_${uuid}`,
      eventType: "identity.user.registered.v1",
      schemaVersion: 1,
      aggregateType: "User",
      aggregateId: `usr_${uuid}`,
      aggregateVersion: 1,
      occurredAt: "2026-08-23T12:00:00.000Z",
      recordedAt: "2026-08-23T12:00:00.100Z",
      correlationId: uuid,
      causationId: null,
      actorUserId: null,
      sellerAccountId: null,
      sourceModule: "identity",
      dataClassification: "INTERNAL",
      payload: { userId: `usr_${uuid}`, userStatus: "PENDING_VERIFICATION" },
    };
    expect(() => {
      assertOutboxTransportEvent(event);
    }).not.toThrow();
  });

  it("recusa tipo sem schema em vez de publicar contrato desconhecido", () => {
    expect(() => {
      assertOutboxTransportEvent({ eventType: "unknown.event.v1" });
    }).toThrow(EventContractError);
    expect(registeredOutboxEventTypes()).toHaveLength(18);
  });

  it("valida contrato financeiro sem aceitar valor em ponto flutuante", () => {
    const paymentId = uuid;
    const event = {
      eventId: `evt_${uuid}`,
      eventType: "finance.payment.settled.v1",
      schemaVersion: 1,
      aggregateType: "Payment",
      aggregateId: paymentId,
      aggregateVersion: 2,
      occurredAt: "2026-08-23T12:00:00.000Z",
      recordedAt: "2026-08-23T12:00:00.100Z",
      correlationId: uuid,
      causationId: null,
      actorUserId: null,
      sellerAccountId: `sac_${uuid}`,
      sourceModule: "finance",
      dataClassification: "FINANCIAL",
      payload: {
        paymentId,
        orderId: uuid,
        sellerAccountId: uuid,
        amountMinor: "10000",
        currency: "BRL",
        reconciliationStatus: "RECONCILED_PROVIDER",
        settledAt: "2026-08-23T12:00:00.000Z",
        balanceLotId: uuid,
        holdId: uuid,
        eligibleAt: "2026-08-30T12:00:00.000Z"
      }
    };
    expect(() => {
      assertOutboxTransportEvent(event);
    }).not.toThrow();
    expect(() => {
      assertOutboxTransportEvent({
        ...event,
        payload: { ...event.payload, amountMinor: "100.00" },
      });
    }).toThrow(EventContractError);
  });
});
