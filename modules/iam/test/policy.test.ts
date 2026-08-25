import { describe, expect, it } from "vitest";
import { authorizeSellerAction } from "../src/index.js";

const now = new Date("2026-08-23T12:00:00.000Z");

describe("SellerMembership PDP", () => {
  it("nega por padrão quando o grant não existe", () => {
    const decision = authorizeSellerAction(
      {
        authenticated: true,
        membershipStatus: "ACTIVE",
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: null,
        grants: new Set(),
        now,
      },
      "seller.members.read",
    );
    expect(decision).toMatchObject({ allowed: false, reasonCode: "PERMISSION_MISSING" });
  });

  it("nega membership revogada mesmo com grant", () => {
    const decision = authorizeSellerAction(
      {
        authenticated: true,
        membershipStatus: "REVOKED",
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: null,
        grants: new Set(["seller.members.read"]),
        now,
      },
      "seller.members.read",
    );
    expect(decision.allowed).toBe(false);
  });
});
