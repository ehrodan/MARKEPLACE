import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProviderAdapter, VerifiedProviderEvent, VerifiedProviderLookup } from "@midas/finance";
import { AppProblem } from "@midas/kernel";

type UnknownRecord = Record<string, unknown>;

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : fallback;
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toStringValue(value: unknown, fallback: string): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

export class StripePaymentAdapter implements PaymentProviderAdapter {
  readonly providerCode = "stripe";

  constructor(
    private readonly secretKey: string | undefined,
    private readonly webhookSecret: string | undefined,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.secretKey && this.webhookSecret);
  }

  // A interface do provedor e assíncrona, mas a verificação HMAC é integralmente síncrona.
  // eslint-disable-next-line @typescript-eslint/require-await
  async verifyWebhook(input: {
    rawBody: Uint8Array;
    headers: Readonly<Record<string, string | string[] | undefined>>;
  }): Promise<VerifiedProviderEvent> {
    if (!this.webhookSecret) {
      throw new AppProblem({
        status: 503,
        code: "STRIPE_WEBHOOK_SECRET_MISSING",
        title: "Webhook Stripe não configurado",
        detail: "O segredo do webhook Stripe não está definido.",
      });
    }

    const signatureHeader = this.extractHeader(input.headers, "stripe-signature");
    if (!signatureHeader) {
      throw new AppProblem({
        status: 401,
        code: "STRIPE_SIGNATURE_MISSING",
        title: "Assinatura ausente",
        detail: "O header stripe-signature é obrigatório.",
      });
    }

    const elements = signatureHeader.split(",");
    const timestamp = elements.find((el) => el.startsWith("t="))?.substring(2);
    const signature = elements.find((el) => el.startsWith("v1="))?.substring(3);

    if (!timestamp || !signature) {
      throw new AppProblem({
        status: 401,
        code: "STRIPE_SIGNATURE_MALFORMED",
        title: "Assinatura malformada",
        detail: "O formato da assinatura Stripe é inválido.",
      });
    }

    const signedPayload = `${timestamp}.${Buffer.from(input.rawBody).toString("utf8")}`;
    const expectedSignature = createHmac("sha256", this.webhookSecret)
      .update(signedPayload)
      .digest("hex");

    if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))) {
      throw new AppProblem({
        status: 401,
        code: "STRIPE_SIGNATURE_INVALID",
        title: "Assinatura inválida",
        detail: "A assinatura do webhook não confere.",
      });
    }

    const parsedEvent: unknown = JSON.parse(Buffer.from(input.rawBody).toString("utf8"));
    const event = isUnknownRecord(parsedEvent) ? parsedEvent : undefined;
    if (!event) {
      throw new AppProblem({
        status: 422,
        code: "STRIPE_EVENT_MALFORMED",
        title: "Evento malformado",
        detail: "O payload do evento Stripe deve ser um objeto JSON.",
      });
    }

    const eventType = event.type;
    const eventData = isUnknownRecord(event.data) ? event.data : undefined;
    const data = eventData && isUnknownRecord(eventData.object) ? eventData.object : undefined;

    if (!data || typeof data !== "object") {
      throw new AppProblem({
        status: 422,
        code: "STRIPE_EVENT_MALFORMED",
        title: "Evento malformado",
        detail: "O payload do evento Stripe não possui data.object.",
      });
    }

    let providerState: "PENDING" | "SETTLED" | "FAILED" = "PENDING";
    if (eventType === "payment_intent.succeeded" || eventType === "charge.succeeded") {
      providerState = "SETTLED";
    } else if (eventType === "payment_intent.payment_failed" || eventType === "charge.failed") {
      providerState = "FAILED";
    }

    const paymentId = data.id;
    if (!paymentId || typeof paymentId !== "string") {
      throw new AppProblem({
        status: 422,
        code: "STRIPE_PAYMENT_ID_MISSING",
        title: "ID do pagamento ausente",
        detail: "O evento não contém um identificador de pagamento válido.",
      });
    }

    const externalEventId = event.id;
    if (typeof externalEventId !== "string" || externalEventId.length === 0) {
      throw new AppProblem({
        status: 422,
        code: "STRIPE_EVENT_ID_MISSING",
        title: "ID do evento ausente",
        detail: "O evento Stripe não contém um identificador válido.",
      });
    }

    const amountMinor = BigInt(Math.round(toFiniteNumber(data.amount, 0) * 100));
    const currency = toStringValue(data.currency, "brl").toUpperCase();
    const occurredAt = new Date(
      toFiniteNumber(data.created, Math.floor(Date.now() / 1000)) * 1000,
    );

    return {
      providerCode: this.providerCode,
      providerPaymentReference: paymentId,
      providerState,
      amountMinor,
      currency,
      providerOccurredAt: occurredAt,
      externalEventId,
    };
  }

  async lookupPayment(providerPaymentReference: string): Promise<VerifiedProviderLookup> {
    if (!this.secretKey) {
      throw new AppProblem({
        status: 503,
        code: "STRIPE_SECRET_KEY_MISSING",
        title: "Chave Stripe não configurada",
        detail: "A chave secreta do Stripe não está definida.",
      });
    }

    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${providerPaymentReference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppProblem({
        status: 502,
        code: "STRIPE_LOOKUP_FAILED",
        title: "Falha ao consultar Stripe",
        detail: `Stripe retornou status ${response.status.toString()}: ${errorText}`,
      });
    }

    const responseData: unknown = await response.json();
    if (!isUnknownRecord(responseData)) {
      throw new AppProblem({
        status: 502,
        code: "STRIPE_LOOKUP_MALFORMED",
        title: "Resposta Stripe inválida",
        detail: "A consulta Stripe retornou um payload inesperado.",
      });
    }
    const data = responseData;
    const returnedPaymentReference = data.id;
    if (typeof returnedPaymentReference !== "string" || returnedPaymentReference.length === 0) {
      throw new AppProblem({
        status: 502,
        code: "STRIPE_LOOKUP_MALFORMED",
        title: "Resposta Stripe inválida",
        detail: "A consulta Stripe não retornou um identificador de pagamento válido.",
      });
    }
    let providerState: "PENDING" | "SETTLED" | "FAILED" = "PENDING";
    if (data.status === "succeeded") {
      providerState = "SETTLED";
    } else if (data.status === "canceled" || data.status === "requires_payment_method") {
      providerState = "FAILED";
    }

    return {
      providerCode: this.providerCode,
      providerPaymentReference: returnedPaymentReference,
      providerState,
      amountMinor: BigInt(Math.round(toFiniteNumber(data.amount, 0) * 100)),
      currency: toStringValue(data.currency, "brl").toUpperCase(),
      providerOccurredAt: new Date(
        toFiniteNumber(data.created, Math.floor(Date.now() / 1000)) * 1000,
      ),
      reconciliationReference: returnedPaymentReference,
    };
  }

  private extractHeader(
    headers: Readonly<Record<string, string | string[] | undefined>>,
    name: string,
  ): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) return value[0];
    return value;
  }
}
