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

function toDateInput(value: unknown, fallback: number): string | number {
  return typeof value === "string" || typeof value === "number" ? value : fallback;
}

function toStringValue(value: unknown, fallback: string): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function toPaymentReference(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value.toString();
  return undefined;
}

export class MercadoPagoPaymentAdapter implements PaymentProviderAdapter {
  readonly providerCode = "mercadopago";

  constructor(
    private readonly accessToken: string | undefined,
    private readonly webhookSecret: string | undefined,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.accessToken && this.webhookSecret);
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
        code: "MERCADOPAGO_WEBHOOK_SECRET_MISSING",
        title: "Webhook Mercado Pago não configurado",
        detail: "O segredo do webhook Mercado Pago não está definido.",
      });
    }

    const signatureHeader = this.extractHeader(input.headers, "x-signature");
    const requestIdHeader = this.extractHeader(input.headers, "x-request-id");

    if (!signatureHeader) {
      throw new AppProblem({
        status: 401,
        code: "MERCADOPAGO_SIGNATURE_MISSING",
        title: "Assinatura ausente",
        detail: "O header x-signature é obrigatório.",
      });
    }

    const elements = signatureHeader.split(",");
    const timestamp = elements.find((el) => el.startsWith("ts="))?.substring(3);
    const signature = elements.find((el) => el.startsWith("v1="))?.substring(3);

    if (!timestamp || !signature) {
      throw new AppProblem({
        status: 401,
        code: "MERCADOPAGO_SIGNATURE_MALFORMED",
        title: "Assinatura malformada",
        detail: "O formato da assinatura Mercado Pago é inválido.",
      });
    }

    const dataId = this.extractQueryParam(input.headers, "data.id");
    if (!dataId) {
      throw new AppProblem({
        status: 422,
        code: "MERCADOPAGO_DATA_ID_MISSING",
        title: "ID do evento ausente",
        detail: "O webhook não contém data.id.",
      });
    }

    const manifest = `id:${dataId};request-id:${requestIdHeader ?? ""};ts:${timestamp};`;
    const expectedSignature = createHmac("sha256", this.webhookSecret)
      .update(manifest)
      .digest("hex");

    if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"))) {
      throw new AppProblem({
        status: 401,
        code: "MERCADOPAGO_SIGNATURE_INVALID",
        title: "Assinatura inválida",
        detail: "A assinatura do webhook não confere.",
      });
    }

    const parsedEvent: unknown = JSON.parse(Buffer.from(input.rawBody).toString("utf8"));
    const event = isUnknownRecord(parsedEvent) ? parsedEvent : undefined;
    if (!event) {
      throw new AppProblem({
        status: 422,
        code: "MERCADOPAGO_EVENT_MALFORMED",
        title: "Evento malformado",
        detail: "O payload do evento Mercado Pago deve ser um objeto JSON.",
      });
    }

    const eventType = event.type;
    const data = isUnknownRecord(event.data) ? event.data : undefined;

    if (!data || typeof data !== "object") {
      throw new AppProblem({
        status: 422,
        code: "MERCADOPAGO_EVENT_MALFORMED",
        title: "Evento malformado",
        detail: "O payload do evento Mercado Pago não possui data.",
      });
    }

    let providerState: "PENDING" | "SETTLED" | "FAILED" = "PENDING";
    if (eventType === "payment" && data.status === "approved") {
      providerState = "SETTLED";
    } else if (eventType === "payment" && (data.status === "rejected" || data.status === "cancelled")) {
      providerState = "FAILED";
    }

    const paymentId = toPaymentReference(data.id);
    if (paymentId === undefined) {
      throw new AppProblem({
        status: 422,
        code: "MERCADOPAGO_PAYMENT_ID_MISSING",
        title: "ID do pagamento ausente",
        detail: "O evento não contém um identificador de pagamento válido.",
      });
    }

    const amountMinor = BigInt(
      Math.round(toFiniteNumber(data.transaction_amount, 0) * 100),
    );
    const currency = toStringValue(data.currency_id, "BRL").toUpperCase();
    const occurredAt = new Date(
      toDateInput(data.date_approved ?? data.date_created, Date.now()),
    );

    return {
      providerCode: this.providerCode,
      providerPaymentReference: paymentId,
      providerState,
      amountMinor,
      currency,
      providerOccurredAt: occurredAt,
      externalEventId: toPaymentReference(event.id) ?? paymentId,
    };
  }

  async lookupPayment(providerPaymentReference: string): Promise<VerifiedProviderLookup> {
    if (!this.accessToken) {
      throw new AppProblem({
        status: 503,
        code: "MERCADOPAGO_ACCESS_TOKEN_MISSING",
        title: "Token Mercado Pago não configurado",
        detail: "O access token do Mercado Pago não está definido.",
      });
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${providerPaymentReference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppProblem({
        status: 502,
        code: "MERCADOPAGO_LOOKUP_FAILED",
        title: "Falha ao consultar Mercado Pago",
        detail: `Mercado Pago retornou status ${response.status.toString()}: ${errorText}`,
      });
    }

    const responseData: unknown = await response.json();
    if (!isUnknownRecord(responseData)) {
      throw new AppProblem({
        status: 502,
        code: "MERCADOPAGO_LOOKUP_MALFORMED",
        title: "Resposta Mercado Pago inválida",
        detail: "A consulta Mercado Pago retornou um payload inesperado.",
      });
    }
    const data = responseData;
    const returnedPaymentReference = toPaymentReference(data.id);
    if (!returnedPaymentReference) {
      throw new AppProblem({
        status: 502,
        code: "MERCADOPAGO_LOOKUP_MALFORMED",
        title: "Resposta Mercado Pago inválida",
        detail: "A consulta Mercado Pago não retornou um identificador de pagamento válido.",
      });
    }
    let providerState: "PENDING" | "SETTLED" | "FAILED" = "PENDING";
    if (data.status === "approved") {
      providerState = "SETTLED";
    } else if (data.status === "rejected" || data.status === "cancelled" || data.status === "refunded") {
      providerState = "FAILED";
    }

    return {
      providerCode: this.providerCode,
      providerPaymentReference: returnedPaymentReference,
      providerState,
      amountMinor: BigInt(
        Math.round(toFiniteNumber(data.transaction_amount, 0) * 100),
      ),
      currency: toStringValue(data.currency_id, "BRL").toUpperCase(),
      providerOccurredAt: new Date(
        toDateInput(data.date_approved ?? data.date_created, Date.now()),
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

  private extractQueryParam(
    headers: Readonly<Record<string, string | string[] | undefined>>,
    name: string,
  ): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) return value[0];
    return value;
  }
}
