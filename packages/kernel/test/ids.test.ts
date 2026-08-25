import { describe, expect, it } from "vitest";
import {
  createPublicId,
  createUuidV7,
  parsePublicId,
  toPublicId,
} from "../src/index.js";

describe("typed UUIDv7", () => {
  it("gera UUIDv7 e preserva o prefixo canônico", () => {
    const id = createPublicId("sellerAccount");
    expect(id).toMatch(/^sac_[0-9a-f-]+$/);
    expect(parsePublicId("sellerAccount", id)).toMatch(/-7[0-9a-f]{3}-/);
  });

  it("recusa prefixo de outro agregado", () => {
    const userId = createPublicId("user");
    expect(() => parsePublicId("sellerAccount", userId)).toThrow();
  });

  it("mantém ordenação temporal pela parte de timestamp", () => {
    const first = createUuidV7(1_700_000_000_000);
    const second = createUuidV7(1_700_000_000_001);
    expect(first.localeCompare(second)).toBeLessThan(0);
    expect(toPublicId("user", first)).toBe(`usr_${first}`);
  });
});
