export type OutboxPublisherConfiguration = {
  endpoint?: string;
  token?: string;
  nodeEnv: "development" | "test" | "production";
};

export function outboxPublisherCapability(
  configuration: OutboxPublisherConfiguration,
): "AVAILABLE" | "UNAVAILABLE" {
  if (!configuration.endpoint || !configuration.token) return "UNAVAILABLE";
  try {
    const endpoint = new URL(configuration.endpoint);
    if (configuration.nodeEnv === "production" && endpoint.protocol !== "https:") {
      return "UNAVAILABLE";
    }
    return endpoint.protocol === "http:" || endpoint.protocol === "https:"
      ? "AVAILABLE"
      : "UNAVAILABLE";
  } catch {
    return "UNAVAILABLE";
  }
}
