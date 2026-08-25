import type { MidasTransaction } from "@midas/database";
import {
  createPublicId,
  hashSecretToken,
  parsePublicId,
  type ActorContext,
  type PublicId,
} from "@midas/kernel";
import { auditEvents } from "./schema.js";

export type AuditEventInput = {
  action: string;
  resourceType: string;
  resourceId?: string;
  sellerAccountId?: string;
  actingRole?: string;
  authorizationDecisionId?: string;
  policyVersion?: string;
  beforeRedacted?: Record<string, unknown> | null;
  afterRedacted?: Record<string, unknown> | null;
  reasonCode?: string;
  dataClassification: "INTERNAL" | "CONFIDENTIAL" | "FINANCIAL";
};

export async function appendAuditEvent(
  transaction: MidasTransaction,
  input: AuditEventInput,
  actor: ActorContext,
): Promise<PublicId<"audit">> {
  const auditEventId = createPublicId("audit");
  await transaction.insert(auditEvents).values({
    auditEventId: parsePublicId("audit", auditEventId),
    occurredAt: new Date(),
    actorUserId: actor.actorUserId,
    actingRole: input.actingRole,
    sessionIdHash: actor.sessionId ? hashSecretToken(actor.sessionId) : undefined,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    authorizationDecisionId: input.authorizationDecisionId,
    policyVersion: input.policyVersion,
    beforeRedacted: input.beforeRedacted,
    afterRedacted: input.afterRedacted,
    reasonCode: input.reasonCode,
    correlationId: actor.correlationId,
    ipPrefix: actor.ipPrefix,
    userAgentFamily: actor.userAgentFamily,
    sellerAccountId: input.sellerAccountId,
    dataClassification: input.dataClassification,
  });
  return auditEventId;
}
