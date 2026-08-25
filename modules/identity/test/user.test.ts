import { describe, expect, it } from "vitest";
import { normalizeEmail, nextVerifiedUserStatus } from "../src/index.js";

describe("User", () => {
  it("normaliza e-mail antes da unicidade", () => {
    expect(normalizeEmail("  Pessoa@EXAMPLE.COM ")).toBe("pessoa@example.com");
  });

  it("verifica usuário pendente sem criar outra identidade", () => {
    expect(nextVerifiedUserStatus("PENDING_VERIFICATION")).toBe("ACTIVE");
  });

  it("não reativa suspensão por verificação", () => {
    expect(() => nextVerifiedUserStatus("SUSPENDED")).toThrow();
  });
});
