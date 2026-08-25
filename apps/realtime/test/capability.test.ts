import { describe, expect, it } from "vitest";
import { realtimeCapability } from "../src/capability.js";

describe("realtime capability", () => {
  it("permanece fail-closed antes do slice Conversation", () => {
    expect(realtimeCapability).toBe("DISABLED_UNTIL_CONVERSATION_SLICE");
  });
});
