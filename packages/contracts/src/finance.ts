import { z } from "zod";
import { sellerAccountIdSchema, userIdSchema } from "./account.js";

export const financeUuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
);
export const amountMinorSchema = z.string().regex(/^[1-9][0-9]*$/);
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);

export const providerCapabilitySchema = z.object({
  providerCode: z.string().min(1).max(120).nullable(),
  status: z.enum(["AVAILABLE", "CONTRACT_REQUIRED", "UNSUPPORTED"]),
  reasonCode: z.enum([
    "AVAILABLE",
    "PROVIDER_CONTRACT_NOT_SELECTED",
    "PROVIDER_CREDENTIALS_REQUIRED",
    "PROVIDER_ADAPTER_NOT_INSTALLED",
  ]),
});

export const providerCapabilityQuerySchema = z.object({
  providerCode: z.string().min(1).max(120).optional(),
});

export const providerWebhookAckSchema = z.object({
  duplicate: z.boolean(),
  processingResult: z.enum([
    "SETTLED",
    "PAYMENT_QUARANTINED",
    "IGNORED_PENDING",
    "IGNORED_FAILED",
    "PAYMENT_NOT_FOUND",
  ]),
  paymentId: financeUuidSchema.nullable(),
});

export const financePaymentSchema = z.object({
  paymentId: financeUuidSchema,
  orderId: financeUuidSchema,
  buyerUserId: userIdSchema,
  sellerAccountId: sellerAccountIdSchema,
  providerCode: z.string().nullable(),
  amountMinor: amountMinorSchema,
  currency: currencySchema,
  paymentStatus: z.enum(["PENDING", "SETTLED", "FAILED", "CANCELLED", "PAYMENT_QUARANTINED"]),
  reconciliationStatus: z.enum(["PENDING", "RECONCILED_PROVIDER", "RECONCILED_MANUAL"]),
  settledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const financePaymentListSchema = z.object({
  data: z.array(financePaymentSchema),
  asOf: z.iso.datetime(),
});

export const sellerBalanceSchema = z.object({
  sellerAccountId: sellerAccountIdSchema,
  currency: currencySchema,
  heldAmountMinor: z.string().regex(/^[0-9]+$/),
  availableAmountMinor: z.string().regex(/^[0-9]+$/),
  reservedAmountMinor: z.string().regex(/^[0-9]+$/),
  asOf: z.iso.datetime(),
});

export const sellerBalanceQuerySchema = z.object({
  currency: currencySchema.optional(),
});

export const payoutRequestSchema = z.object({
  payoutRequestId: financeUuidSchema,
  sellerAccountId: sellerAccountIdSchema,
  requestedByUserId: userIdSchema,
  amountMinor: amountMinorSchema,
  currency: currencySchema,
  destinationCountry: z.string().regex(/^[A-Z]{2}$/),
  payoutStatus: z.enum([
    "REQUESTED", "UNDER_REVIEW", "INFORMATION_REQUIRED", "APPROVED", "REJECTED",
    "EXECUTING", "CONFIRMATION_PENDING", "PAID", "FAILED", "RETURNED", "CANCELED",
  ]),
  claimedByUserId: userIdSchema.nullable(),
  approvedByUserId: userIdSchema.nullable(),
  completedByUserId: userIdSchema.nullable(),
  claimedAt: z.iso.datetime().nullable(),
  approvedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  version: z.number().int().positive(),
});

export const payoutRequestListSchema = z.object({
  data: z.array(payoutRequestSchema),
  asOf: z.iso.datetime(),
});

export const createPayoutRequestBodySchema = z.object({
  amountMinor: amountMinorSchema,
  currency: currencySchema,
  destinationCountry: z.string().regex(/^[A-Z]{2}$/),
}).strict();

export const completePayoutBodySchema = z.object({
  externalReference: z.string().trim().min(1).max(300),
  evidenceLocator: z.string().trim().min(1).max(1_000),
  evidenceSha256: z.string().regex(/^[0-9a-fA-F]{64}$/),
}).strict();

export const confirmPayoutBodySchema = z.object({
  confirmationEvidenceLocator: z.string().trim().min(1).max(1_000),
  confirmationEvidenceSha256: z.string().regex(/^[0-9a-fA-F]{64}$/),
}).strict();

export const payoutCapabilityQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  currency: currencySchema,
  mode: z.literal("EXTERNAL_MANUAL").default("EXTERNAL_MANUAL"),
});

export const payoutCapabilitySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  currency: currencySchema,
  mode: z.literal("EXTERNAL_MANUAL"),
  status: z.enum(["AVAILABLE", "CONTRACT_REQUIRED", "UNSUPPORTED"]),
  reasonCode: z.enum([
    "AVAILABLE",
    "PAYOUT_CONTRACT_NOT_SELECTED",
    "PAYOUT_CREDENTIALS_REQUIRED",
    "PAYOUT_MODE_UNSUPPORTED",
  ]),
});

export const paymentResolutionCaseSchema = z.object({
  resolutionCaseId: financeUuidSchema,
  paymentId: financeUuidSchema,
  caseStatus: z.enum(["OPEN", "APPROVED", "REJECTED"]),
  reasonCode: z.string(),
  evidenceLocator: z.string(),
  createdByUserId: userIdSchema,
  reviewedByUserId: userIdSchema.nullable(),
  reviewReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime().nullable(),
  version: z.number().int().positive(),
});

export const paymentResolutionCaseListSchema = z.object({
  data: z.array(paymentResolutionCaseSchema),
  asOf: z.iso.datetime(),
});

export const createPaymentResolutionBodySchema = z.object({
  reasonCode: z.string().trim().min(1).max(120),
  evidenceLocator: z.string().trim().min(1).max(1_000),
}).strict();

export const decidePaymentResolutionBodySchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reviewReason: z.string().trim().min(1).max(500),
}).strict();

export const financeStatusQuerySchema = z.object({
  status: z.string().min(1).max(40).optional(),
});
