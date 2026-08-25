export type ProviderCapability = {
  providerCode: string | null;
  status: "AVAILABLE" | "CONTRACT_REQUIRED" | "UNSUPPORTED";
  reasonCode:
    | "AVAILABLE"
    | "PROVIDER_CONTRACT_NOT_SELECTED"
    | "PROVIDER_CREDENTIALS_REQUIRED"
    | "PROVIDER_ADAPTER_NOT_INSTALLED";
};

export type PayoutCapability = {
  countryCode: string;
  currency: string;
  mode: "EXTERNAL_MANUAL";
  status: "AVAILABLE" | "CONTRACT_REQUIRED" | "UNSUPPORTED";
  reasonCode:
    | "AVAILABLE"
    | "PAYOUT_CONTRACT_NOT_SELECTED"
    | "PAYOUT_CREDENTIALS_REQUIRED"
    | "PAYOUT_MODE_UNSUPPORTED";
};

export type SellerBalance = {
  sellerAccountId: string;
  currency: string;
  heldAmountMinor: string;
  availableAmountMinor: string;
  reservedAmountMinor: string;
  asOf: string;
};

export type PayoutRequest = {
  payoutRequestId: string;
  sellerAccountId: string;
  requestedByUserId: string;
  amountMinor: string;
  currency: string;
  destinationCountry: string;
  payoutStatus:
    | "REQUESTED"
    | "UNDER_REVIEW"
    | "INFORMATION_REQUIRED"
    | "APPROVED"
    | "REJECTED"
    | "EXECUTING"
    | "CONFIRMATION_PENDING"
    | "PAID"
    | "FAILED"
    | "RETURNED"
    | "CANCELED";
  claimedByUserId: string | null;
  approvedByUserId: string | null;
  completedByUserId: string | null;
  claimedAt: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  version: number;
};

export type PayoutRequestList = {
  data: PayoutRequest[];
  asOf: string;
};

export type PaymentResolutionCase = {
  resolutionCaseId: string;
  paymentId: string;
  caseStatus: "OPEN" | "APPROVED" | "REJECTED";
  reasonCode: string;
  evidenceLocator: string;
  createdByUserId: string;
  reviewedByUserId: string | null;
  reviewReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  version: number;
};

export type PaymentResolutionCaseList = {
  data: PaymentResolutionCase[];
  asOf: string;
};
