export type SellerAuthorizationFacts = {
  authenticated: boolean;
  membershipStatus?: "ACTIVE" | "REVOKED" | "EXPIRED";
  validFrom?: Date;
  validUntil?: Date | null;
  grants: ReadonlySet<string>;
  now: Date;
};

export type AuthorizationDecision = {
  allowed: boolean;
  reasonCode: string;
  policyVersion: "seller-membership-v1";
};

export function authorizeSellerAction(
  facts: SellerAuthorizationFacts,
  requiredPermission: string,
): AuthorizationDecision {
  if (!facts.authenticated) {
    return { allowed: false, reasonCode: "AUTHENTICATION_REQUIRED", policyVersion: "seller-membership-v1" };
  }
  if (
    facts.membershipStatus !== "ACTIVE" ||
    !facts.validFrom ||
    facts.validFrom > facts.now ||
    (facts.validUntil !== null && facts.validUntil !== undefined && facts.validUntil <= facts.now)
  ) {
    return { allowed: false, reasonCode: "MEMBERSHIP_INACTIVE", policyVersion: "seller-membership-v1" };
  }
  if (!facts.grants.has(requiredPermission)) {
    return { allowed: false, reasonCode: "PERMISSION_MISSING", policyVersion: "seller-membership-v1" };
  }
  return { allowed: true, reasonCode: "ALLOW", policyVersion: "seller-membership-v1" };
}
