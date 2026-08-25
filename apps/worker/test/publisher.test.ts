import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { EventContractError } from "@midas/contracts";
import type { LeasedOutboxEvent } from "@midas/eventing";
import { buildOutboxTransportEvent, publishOutboxEvent } from "../src/publisher.js";

const eventUuid = "0198f5f8-8f04-7a4d-8af4-3be2437f8123";
const userUuid = "0198f5f8-8f05-7a4d-8af4-3be2437f8123";

const registeredEvent: LeasedOutboxEvent = {
  eventId: eventUuid,
  eventType: "identity.user.registered.v1",
  schemaVersion: 1,
  aggregateType: "User",
  aggregateId: userUuid,
  aggregateVersion: 1,
  occurredAt: new Date("2026-08-23T12:00:00.000Z"),
  recordedAt: new Date("2026-08-23T12:00:00.100Z"),
  correlationId: eventUuid,
  causationId: null,
  actorUserId: null,
  sellerAccountId: null,
  ownerModule: "identity",
  dataClassification: "INTERNAL",
  payload: { userId: `usr_${userUuid}`, userStatus: "PENDING_VERIFICATION" },
};

describe("outbox publisher", () => {
  it("valida o contrato e publica com autenticação em um receptor HTTP real", async () => {
    const receiver = Fastify();
    let receivedBody: unknown;
    let receivedAuthorization: string | undefined;
    receiver.post("/events", (request, reply) => {
      receivedBody = request.body;
      receivedAuthorization = request.headers.authorization;
      return reply.status(204).send();
    });
    const address = await receiver.listen({ host: "127.0.0.1", port: 0 });
    try {
      await publishOutboxEvent(
        `${address}/events`,
        "token-seguro-com-trinta-e-dois-bytes",
        registeredEvent,
      );
      expect(receivedAuthorization).toBe("Bearer token-seguro-com-trinta-e-dois-bytes");
      expect(receivedBody).toMatchObject({
        eventId: `evt_${eventUuid}`,
        eventType: "identity.user.registered.v1",
        aggregateId: `usr_${userUuid}`,
        sourceModule: "identity",
      });
    } finally {
      await receiver.close();
    }
  });

  it("recusa evento sem schema antes do envio", () => {
    expect(() =>
      buildOutboxTransportEvent({ ...registeredEvent, eventType: "unknown.event.v1" }),
    ).toThrow(EventContractError);
  });
});
