export type ProviderCapabilityStatus = "AVAILABLE" | "CONTRACT_REQUIRED" | "UNSUPPORTED";

export type ProviderCapability = {
  providerCode: string | null;
  status: ProviderCapabilityStatus;
  reasonCode:
    | "AVAILABLE"
    | "PROVIDER_CONTRACT_NOT_SELECTED"
    | "PROVIDER_CREDENTIALS_REQUIRED"
    | "PROVIDER_ADAPTER_NOT_INSTALLED"
    // O adapter existe e esta configurado, mas so sabe conciliar: nao inicia
    // cobranca. E um estado real e diferente de "nao instalado".
    | "PROVIDER_CREATE_NOT_SUPPORTED";
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

/**
 * Pedido de cobrança enviado ao provedor.
 *
 * `amountMinor` é `bigint` porque dinheiro nunca passa por `number` nesta base:
 * acima de 9 quatrilhões de centavos um `number` perde precisão em silêncio, e
 * um erro de arredondamento aqui é dinheiro real de outra pessoa.
 */
export type CreateProviderPaymentInput = {
  /** Pedido que está sendo cobrado. Vira referência no provedor. */
  orderId: string;
  amountMinor: bigint;
  /** ISO-4217, maiúsculo. */
  currency: string;
  /** Idempotência de ponta a ponta: reenviar não cria segunda cobrança. */
  idempotencyKey: string;
  /** Descrição curta que a pessoa vê na fatura. */
  description?: string;
};

export type CreatedProviderPayment = {
  providerCode: string;
  providerPaymentReference: string;
  providerState: "PENDING" | "SETTLED" | "FAILED";
  amountMinor: bigint;
  currency: string;
  /**
   * O que o cliente precisa para concluir o pagamento — `client_secret` no
   * Stripe, `init_point` no Mercado Pago. Quem entrega isso ao navegador é a
   * rota; o adapter só devolve.
   */
  clientAuthorization: string | null;
};

export interface PaymentProviderAdapter {
  readonly providerCode: string;
  isConfigured(): boolean;
  verifyWebhook(input: {
    rawBody: Uint8Array;
    headers: Readonly<Record<string, string | string[] | undefined>>;
  }): Promise<VerifiedProviderEvent>;
  lookupPayment(providerPaymentReference: string): Promise<VerifiedProviderLookup>;
  /**
   * Cria a cobrança no provedor.
   *
   * **Opcional de propósito.** Sem ele, a plataforma verifica webhook e
   * reconcilia, mas não tem como INICIAR uma cobrança — que era exatamente o
   * buraco: o pedido chegava a `PENDING_PAYMENT` e parava ali, porque ninguém
   * criava a intenção de pagamento no provedor.
   *
   * Continua opcional porque um provedor pode entrar só para reconciliação, e
   * `capability()` distingue os dois casos por `supportsCreate`.
   */
  createPayment?(input: CreateProviderPaymentInput): Promise<CreatedProviderPayment>;
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

  /**
   * O provedor sabe INICIAR uma cobrança, ou só reconciliar?
   *
   * Separado de `capability()` porque as duas coisas são independentes: um
   * adapter pode estar configurado e disponível para webhook e lookup sem
   * saber criar cobrança. Chamar `createPayment` nesse caso deve recusar com
   * motivo, não estourar `undefined is not a function`.
   */
  supportsCreate(requestedProviderCode?: string): boolean {
    const providerCode = requestedProviderCode ?? this.selectedProviderCode;
    if (!providerCode) return false;
    const adapter = this.adapters.get(providerCode);
    // `typeof`, e nao a referencia direta: apontar para o metodo sem chama-lo
    // e o padrao que o lint marca como `unbound-method`, porque perde o `this`.
    return Boolean(adapter?.isConfigured()) && typeof adapter?.createPayment === "function";
  }

  async createPayment(
    providerCode: string,
    input: CreateProviderPaymentInput,
  ): Promise<CreatedProviderPayment> {
    const adapter = this.requireAvailableAdapter(providerCode);
    if (typeof adapter.createPayment !== "function") {
      // O mesmo tipo de erro que o resto do registry usa, para quem chama não
      // precisar distinguir duas famílias de falha do mesmo assunto.
      throw new ProviderCapabilityError({
        providerCode,
        status: "UNSUPPORTED",
        reasonCode: "PROVIDER_CREATE_NOT_SUPPORTED",
      });
    }
    return adapter.createPayment(input);
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
