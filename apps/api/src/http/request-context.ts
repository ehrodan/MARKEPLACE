import type { FastifyRequest } from "fastify";
import { parsePublicId, redactUserAgent, type ActorContext } from "@midas/kernel";
import type { AuthenticatedSession } from "@midas/identity";

export function minimizeIp(address: string): string {
  if (address.includes(".")) {
    const parts = address.split(".");
    return parts.length === 4 ? `${parts.slice(0, 3).join(".")}.0/24` : "invalid";
  }
  const parts = address.split(":").filter(Boolean);
  return `${parts.slice(0, 4).join(":")}::/64`;
}

export function actorContext(
  request: FastifyRequest,
  session?: AuthenticatedSession,
): ActorContext {
  const userAgentFamily = redactUserAgent(request.headers["user-agent"]);
  return {
    correlationId: request.id,
    ipPrefix: minimizeIp(request.ip),
    ...(userAgentFamily ? { userAgentFamily } : {}),
    ...(session
      ? {
          actorUserId: parsePublicId("user", session.userId),
          sessionId: session.sessionId,
        }
      : {}),
  };
}
