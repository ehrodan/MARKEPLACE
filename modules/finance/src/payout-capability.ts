export type PayoutExecutionMode = "EXTERNAL_MANUAL";
export type PayoutExecutionCapabilityStatus = "AVAILABLE" | "CONTRACT_REQUIRED" | "UNSUPPORTED";

export type PayoutExecutionContext = {
  countryCode: string;
  currency: string;
  mode: PayoutExecutionMode;
};

export type PayoutExecutionCapability = PayoutExecutionContext & {
  status: PayoutExecutionCapabilityStatus;
  reasonCode:
    | "AVAILABLE"
    | "PAYOUT_CONTRACT_NOT_SELECTED"
    | "PAYOUT_CREDENTIALS_REQUIRED"
    | "PAYOUT_MODE_UNSUPPORTED";
};

export interface PayoutExecutionAdapter {
  readonly mode: PayoutExecutionMode;
  supports(context: PayoutExecutionContext): boolean;
  isConfigured(): boolean;
  validateExecution(input: PayoutExecutionContext & {
    payoutRequestId: string;
    amountMinor: bigint;
    externalReference: string;
    evidenceSha256: string;
  }): Promise<{ valid: boolean; providerExecutionReference: string }>;
  lookupConfirmation(input: PayoutExecutionContext & {
    providerExecutionReference: string;
    confirmationEvidenceSha256: string;
  }): Promise<{
    state: "PENDING" | "PAID" | "FAILED";
    confirmationReference: string;
    providerOccurredAt: Date;
  }>;
}

export class PayoutExecutionCapabilityRegistry {
  constructor(
    private readonly contractSelected = false,
    private readonly adapters: readonly PayoutExecutionAdapter[] = [],
  ) {}

  capability(context: PayoutExecutionContext): PayoutExecutionCapability {
    if (!this.contractSelected) {
      return { ...context, status: "CONTRACT_REQUIRED", reasonCode: "PAYOUT_CONTRACT_NOT_SELECTED" };
    }
    const adapter = this.adapters.find((candidate) => candidate.supports(context));
    if (!adapter) {
      return { ...context, status: "UNSUPPORTED", reasonCode: "PAYOUT_MODE_UNSUPPORTED" };
    }
    if (!adapter.isConfigured()) {
      return { ...context, status: "CONTRACT_REQUIRED", reasonCode: "PAYOUT_CREDENTIALS_REQUIRED" };
    }
    return { ...context, status: "AVAILABLE", reasonCode: "AVAILABLE" };
  }

  async validateExecution(
    input: Parameters<PayoutExecutionAdapter["validateExecution"]>[0],
  ): Promise<{ valid: boolean; providerExecutionReference: string }> {
    return this.requireAdapter(input).validateExecution(input);
  }

  async lookupConfirmation(
    input: Parameters<PayoutExecutionAdapter["lookupConfirmation"]>[0],
  ): Promise<Awaited<ReturnType<PayoutExecutionAdapter["lookupConfirmation"]>>> {
    return this.requireAdapter(input).lookupConfirmation(input);
  }

  private requireAdapter(context: PayoutExecutionContext): PayoutExecutionAdapter {
    const capability = this.capability(context);
    if (capability.status !== "AVAILABLE") throw new PayoutCapabilityError(capability);
    const adapter = this.adapters.find((candidate) => candidate.supports(context));
    if (!adapter) throw new PayoutCapabilityError(capability);
    return adapter;
  }
}

export class PayoutCapabilityError extends Error {
  constructor(readonly capability: PayoutExecutionCapability) {
    super(`Execução de saque indisponível: ${capability.reasonCode}`);
    this.name = "PayoutCapabilityError";
  }
}
