export type ActorContext = {
  correlationId: string;
  actorUserId?: string;
  sessionId?: string;
  sellerAccountId?: string;
  ipPrefix?: string;
  userAgentFamily?: string;
};

export function redactUserAgent(userAgent: string | undefined): string | undefined {
  if (!userAgent) return undefined;
  return userAgent.slice(0, 80).replace(/[^\x20-\x7E]/g, "");
}
