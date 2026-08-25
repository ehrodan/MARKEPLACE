import {
  Ajv2020,
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import envelopeSchema from "../events/outbox-event-envelope.v1.schema.json" with { type: "json" };
import identityUserRegisteredSchema from "../events/identity.user.registered.v1.schema.json" with { type: "json" };
import identityUserVerificationRequestedSchema from "../events/identity.user.verification_requested.v1.schema.json" with { type: "json" };
import identityUserEmailVerifiedSchema from "../events/identity.user.email_verified.v1.schema.json" with { type: "json" };
import identitySessionStartedSchema from "../events/identity.session.started.v1.schema.json" with { type: "json" };
import identitySessionRevokedSchema from "../events/identity.session.revoked.v1.schema.json" with { type: "json" };
import sellerAccountCreatedSchema from "../events/seller.account.created.v1.schema.json" with { type: "json" };
import sellerMembershipCreatedSchema from "../events/seller.membership.created.v1.schema.json" with { type: "json" };
import financePaymentSettledSchema from "../events/finance.payment.settled.v1.schema.json" with { type: "json" };
import financeHoldReleasedSchema from "../events/finance.hold.released.v1.schema.json" with { type: "json" };
import financePaymentResolutionOpenedSchema from "../events/finance.payment_resolution.opened.v1.schema.json" with { type: "json" };
import financePaymentResolutionApprovedSchema from "../events/finance.payment_resolution.approved.v1.schema.json" with { type: "json" };
import financePaymentResolutionRejectedSchema from "../events/finance.payment_resolution.rejected.v1.schema.json" with { type: "json" };
import financePayoutRequestedSchema from "../events/finance.payout.requested.v1.schema.json" with { type: "json" };
import financePayoutClaimedSchema from "../events/finance.payout.claimed.v1.schema.json" with { type: "json" };
import financePayoutCompletedSchema from "../events/finance.payout.completed.v1.schema.json" with { type: "json" };
import financePayoutApprovedSchema from "../events/finance.payout.approved.v1.schema.json" with { type: "json" };
import financePayoutExecutionRegisteredSchema from "../events/finance.payout.execution_registered.v1.schema.json" with { type: "json" };
import financePaymentQuarantinedSchema from "../events/finance.payment.quarantined.v1.schema.json" with { type: "json" };

export type OutboxTransportEvent = {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  occurredAt: string;
  recordedAt: string;
  correlationId: string;
  causationId: string | null;
  actorUserId: string | null;
  sellerAccountId: string | null;
  sourceModule: string;
  dataClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "FINANCIAL";
  payload: Record<string, unknown>;
};

const eventSchemas: Record<string, AnySchema> = {
  "identity.user.registered.v1": identityUserRegisteredSchema,
  "identity.user.verification_requested.v1": identityUserVerificationRequestedSchema,
  "identity.user.email_verified.v1": identityUserEmailVerifiedSchema,
  "identity.session.started.v1": identitySessionStartedSchema,
  "identity.session.revoked.v1": identitySessionRevokedSchema,
  "seller.account.created.v1": sellerAccountCreatedSchema,
  "seller.membership.created.v1": sellerMembershipCreatedSchema,
  "finance.payment.settled.v1": financePaymentSettledSchema,
  "finance.hold.released.v1": financeHoldReleasedSchema,
  "finance.payment_resolution.opened.v1": financePaymentResolutionOpenedSchema,
  "finance.payment_resolution.approved.v1": financePaymentResolutionApprovedSchema,
  "finance.payment_resolution.rejected.v1": financePaymentResolutionRejectedSchema,
  "finance.payout.requested.v1": financePayoutRequestedSchema,
  "finance.payout.claimed.v1": financePayoutClaimedSchema,
  "finance.payout.completed.v1": financePayoutCompletedSchema,
  "finance.payout.approved.v1": financePayoutApprovedSchema,
  "finance.payout.execution_registered.v1": financePayoutExecutionRegisteredSchema,
  "finance.payment.quarantined.v1": financePaymentQuarantinedSchema,
};

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormatsModule.default(ajv);
ajv.addSchema(envelopeSchema);
const validators = new Map<string, ValidateFunction>(
  Object.entries(eventSchemas).map(([eventType, schema]) => [eventType, ajv.compile(schema)]),
);

export class EventContractError extends Error {
  readonly code = "EVENT_CONTRACT_INVALID";

  constructor(readonly issues: string[]) {
    super("Evento recusado pelo contrato publicado.");
    this.name = "EventContractError";
  }
}

export function assertOutboxTransportEvent(
  candidate: unknown,
): asserts candidate is OutboxTransportEvent {
  const eventType = readEventType(candidate);
  const validator = eventType ? validators.get(eventType) : undefined;
  if (!validator) {
    throw new EventContractError([`eventType não registrado: ${eventType ?? "ausente"}`]);
  }
  if (!validator(candidate)) {
    throw new EventContractError(formatValidationErrors(validator.errors));
  }
}

export function registeredOutboxEventTypes(): string[] {
  return [...validators.keys()].sort();
}

function readEventType(candidate: unknown): string | undefined {
  if (typeof candidate !== "object" || candidate === null || !("eventType" in candidate)) {
    return undefined;
  }
  const { eventType } = candidate;
  return typeof eventType === "string" ? eventType : undefined;
}

function formatValidationErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map(
    (error) => `${error.instancePath || "/"} ${error.message ?? "inválido"}`,
  );
}
