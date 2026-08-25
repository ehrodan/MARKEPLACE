import { describe, expect, it } from "vitest";
import {
  createSecretToken,
  hashPassword,
  hashSecretToken,
  verifyPassword,
} from "../src/index.js";

describe("credential primitives", () => {
  it("usa Argon2id e não aceita outra senha", async () => {
    const encoded = await hashPassword("UmaSenhaBemLonga!2026");
    expect(encoded).toContain("argon2id");
    await expect(verifyPassword(encoded, "UmaSenhaBemLonga!2026")).resolves.toBe(true);
    await expect(verifyPassword(encoded, "senha-errada")).resolves.toBe(false);
  });

  it("gera token de alta entropia e persiste somente seu hash", () => {
    const token = createSecretToken();
    const digest = hashSecretToken(token);
    expect(token).not.toContain(digest);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
