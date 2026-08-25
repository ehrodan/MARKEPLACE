export type ProviderCapabilityStatus = "AVAILABLE" | "CONTRACT_REQUIRED" | "UNSUPPORTED";

export type ProviderCapability = {
  providerCode: string | null;
  status: ProviderCapabilityStatus;
  reasonCode:
    | "AVAILABLE"
    | "PROVIDER_CONTRACT_NOT_SELECTED"
    | "PROVIDER_CREDENTIALS_REQUIRED"
    | "PROVIDER_ADAPTER_NOT_INSTALLED";
};

export type VerifiedProviderPayment = {
  providerCode: string;
  providerPaymentReference: string;
  providerState: "PENDING" | "SETTLED" | "FAILED";
  amountMinor: bigint;
  currency: string;
  providerOccurredAt: Date;
};

export type VerifiedProviderEvent = VerifiedProviderPayment & {
  externalEventId: string;
};

export type VerifiedProviderLookup = VerifiedProviderPayment & {
  reconciliationReference: string;
};

export interface PaymentProviderAdapter {
  readonly providerCode: string;
  isConfigured(): boolean;
  verifyWebhook(input: {
    rawBody: Uint8Array;
    headers: Readonly<Record<string, string | string[] | undefined>>;
  }): Promise<VerifiedProviderEvent>;
  lookupPayment(providerPaymentReference: string): Promise<VerifiedProviderLookup>;
}

export class PaymentProviderRegistry {
  private readonly adapters = new Map<string, PaymentProviderAdapter>();

  constructor(
    private readonly selectedProviderCode?: string,
    adapters: readonly PaymentProviderAdapter[] = [],
  ) {
    for (const adapter of adapters) this.adapters.set(adapter.providerCode, adapter);
  }

  capability(requestedProviderCode?: string): ProviderCapability {
    const providerCode = requestedProviderCode ?? this.selectedProviderCode;
    if (!providerCode) {
      return {
        providerCode: null,
        status: "CONTRACT_REQUIRED",
        reasonCode: "PROVIDER_CONTRACT_NOT_SELECTED",
      };
    }
    const adapter = this.adapters.get(providerCode);
    if (!adapter) {
      return {
        providerCode,
        status: "UNSUPPORTED",
        reasonCode: "PROVIDER_ADAPTER_NOT_INSTALLED",
      };
    }
    if (!adapter.isConfigured()) {
      return {
        providerCode,
        status: "CONTRACT_REQUIRED",
        reasonCode: "PROVIDER_CREDENTIALS_REQUIRED",
      };
    }
    return { providerCode, status: "AVAILABLE", reasonCode: "AVAILABLE" };
  }

  async verifyWebhook(
    providerCode: string,
    input: Parameters<PaymentProviderAdapter["verifyWebhook"]>[0],
  ): Promise<VerifiedProviderEvent> {
    return this.requireAvailableAdapter(providerCode).verifyWebhook(input);
  }

  async lookupPayment(
    providerCode: string,
    providerPaymentReference: string,
  ): Promise<VerifiedProviderLookup> {
    return this.requireAvailableAdapter(providerCode).lookupPayment(providerPaymentReference);
  }

  private requireAvailableAdapter(providerCode: string): PaymentProviderAdapter {
    const capability = this.capability(providerCode);
    if (capability.status !== "AVAILABLE") {
      throw new ProviderCapabilityError(capability);
    }
    const adapter = this.adapters.get(providerCode);
    if (!adapter) throw new ProviderCapabilityError(capability);
    return adapter;
  }
}

export class ProviderCapabilityError extends Error {
  constructor(readonly capability: ProviderCapability) {
    super(`Provider indisponível: ${capability.reasonCode}`);
    this.name = "ProviderCapabilityError";
  }
}
