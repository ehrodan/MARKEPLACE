import { describe, expect, it } from "vitest";
import { createPublicId, parsePublicId } from "@midas/kernel";

describe("event identity", () => {
  it("usa o prefixo reservado sem persistir o prefixo na coluna UUID", () => {
    const eventId = createPublicId("event");
    expect(eventId.startsWith("evt_")).toBe(true);
    expect(parsePublicId("event", eventId)).toHaveLength(36);
  });
});
