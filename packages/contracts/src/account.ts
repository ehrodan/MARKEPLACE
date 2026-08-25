import { z } from "zod";

const uuidV7 = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);

export const userIdSchema = z.string().regex(/^usr_[0-9a-f-]{36}$/);
export const sellerAccountIdSchema = z.string().regex(/^sac_[0-9a-f-]{36}$/);
export const sellerMembershipIdSchema = z.string().regex(/^smb_[0-9a-f-]{36}$/);
export const sessionIdSchema = uuidV7;

export const registerUserBodySchema = z.object({
  email: z.email().max(320),
  password: z.string().min(12).max(256),
  displayName: z.string().trim().min(2).max(100),
  acceptedTermsVersion: z.string().trim().min(1).max(64),
}).strict();

export const registerUserResponseSchema = z.object({
  registrationStatus: z.literal("PENDING_VERIFICATION"),
});

export const verifyUserEmailBodySchema = z.object({
  token: z.string().min(32).max(256),
}).strict();

export const loginBodySchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(256),
}).strict();

export const sessionSchema = z.object({
  sessionId: sessionIdSchema,
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  current: z.boolean(),
});

export const sessionListResponseSchema = z.object({
  data: z.array(sessionSchema),
  asOf: z.iso.datetime(),
});

export const createSellerAccountBodySchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  accountType: z.enum(["INDIVIDUAL", "ORGANIZATION"]),
}).strict();

export const sellerAccountSchema = z.object({
  sellerAccountId: sellerAccountIdSchema,
  displayName: z.string(),
  accountType: z.enum(["INDIVIDUAL", "ORGANIZATION"]),
  sellerAccountStatus: z.enum(["ONBOARDING_REQUIRED", "ACTIVE", "SUSPENDED"]),
  membershipRole: z.enum(["OWNER", "MANAGER", "OPERATOR", "FINANCE_VIEWER"]),
  version: z.number().int().positive(),
});

export const sellerAccountListResponseSchema = z.object({
  data: z.array(sellerAccountSchema),
  asOf: z.iso.datetime(),
});

export const sellerMemberSchema = z.object({
  sellerMembershipId: sellerMembershipIdSchema,
  userId: userIdSchema,
  displayName: z.string(),
  membershipRole: z.enum(["OWNER", "MANAGER", "OPERATOR", "FINANCE_VIEWER"]),
  membershipStatus: z.enum(["ACTIVE", "REVOKED", "EXPIRED"]),
  validFrom: z.iso.datetime(),
  validUntil: z.iso.datetime().nullable(),
  version: z.number().int().positive(),
});

export const sellerMemberListResponseSchema = z.object({
  data: z.array(sellerMemberSchema),
  asOf: z.iso.datetime(),
});

export type RegisterUserBody = z.infer<typeof registerUserBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type CreateSellerAccountBody = z.infer<typeof createSellerAccountBodySchema>;
