import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import {
  sellerAccounts,
  sellerMembershipGrants,
  sellerMemberships,
} from "../src/index.js";

describe("seller ownership schema", () => {
  it("preserva os nomes canônicos sem entidade Tenant paralela", () => {
    expect(getTableName(sellerAccounts)).toBe("seller_accounts");
    expect(getTableName(sellerMemberships)).toBe("seller_memberships");
    expect(getTableName(sellerMembershipGrants)).toBe("seller_membership_grants");
  });
});
