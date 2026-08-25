import { describe, expect, it } from "vitest";
import { outboxPublisherCapability } from "../src/capability.js";

describe("worker capability", () => {
  it("não anuncia publisher sem credencial completa", () => {
    expect(
      outboxPublisherCapability({
        endpoint: "https://events.example.test",
        nodeEnv: "production",
      }),
    ).toBe("UNAVAILABLE");
  });

  it("não anuncia HTTP em produção", () => {
    expect(
      outboxPublisherCapability({
        endpoint: "http://events.example.test",
        token: "token-seguro-com-trinta-e-dois-bytes",
        nodeEnv: "production",
      }),
    ).toBe("UNAVAILABLE");
  });

  it("anuncia somente HTTPS autenticado em produção", () => {
    expect(
      outboxPublisherCapability({
        endpoint: "https://events.example.test",
        token: "token-seguro-com-trinta-e-dois-bytes",
        nodeEnv: "production",
      }),
    ).toBe("AVAILABLE");
  });
});
