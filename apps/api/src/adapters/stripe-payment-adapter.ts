import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreatedProviderPayment,
  PaymentProviderAdapter,
  VerifiedProviderEvent,
  VerifiedProviderLookup,
} from "@midas/finance";
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

/**
 * Tolerância entre o relógio da Stripe e o nosso, em segundos.
 *
 * A assinatura HMAC não expira sozinha: sem janela, um webhook capturado hoje
 * continua válido para sempre. O inbox de eventos já recusa o mesmo
 * `externalEventId` duas vezes, mas isso é a segunda linha de defesa — esta é a
 * primeira, e é a que a própria Stripe documenta.
 *
 * Cinco minutos é o valor de referência da Stripe. Menos que isso derruba
 * pagamento legítimo quando o relógio do servidor anda alguns segundos atrás.
 */
const TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Valor do pagamento, em unidade menor.
 *
 * **A Stripe já envia em unidade menor.** `amount: 17990` é R$ 179,90, não
 * R$ 17.990,00. O código anterior multiplicava por 100 e creditaria **cem vezes
 * o valor pago**.
 *
 * Prefere `amount_received`, que é o que de fato entrou, e só cai para `amount`
 * (o que foi pedido) quando o primeiro não veio. Num pagamento parcial os dois
 * diferem, e é o recebido que vale.
 */
function stripeAmountMinor(data: UnknownRecord): bigint {
  const recebido = data.amount_received;
  const pedido = data.amount;
  const bruto = recebido === undefined || recebido === null ? pedido : recebido;
  const numero = toFiniteNumber(bruto, 0);
  // Centavo fracionado não existe: a Stripe manda inteiro, e arredondar aqui
  // evita que um float estranho vire `BigInt` com erro de conversão.
  return BigInt(Math.round(numero));
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

    // Janela de tempo ANTES da comparação: um evento fora da tolerância é
    // recusado mesmo que a assinatura confira, porque a assinatura sozinha não
    // diz *quando* o evento foi emitido.
    const emitidoEm = Number.parseInt(timestamp, 10);
    if (!Number.isFinite(emitidoEm)) {
      throw new AppProblem({
        status: 401,
        code: "STRIPE_SIGNATURE_MALFORMED",
        title: "Assinatura malformada",
        detail: "O carimbo de tempo da assinatura não é um número.",
      });
    }
    const distanciaSegundos = Math.abs(Math.floor(Date.now() / 1000) - emitidoEm);
    if (distanciaSegundos > TIMESTAMP_TOLERANCE_SECONDS) {
      throw new AppProblem({
        status: 401,
        code: "STRIPE_SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE",
        title: "Evento fora da janela",
        detail: "O carimbo de tempo do webhook está fora da tolerância aceita.",
      });
    }

    const signedPayload = `${timestamp}.${Buffer.from(input.rawBody).toString("utf8")}`;
    const expectedSignature = createHmac("sha256", this.webhookSecret)
      .update(signedPayload)
      .digest("hex");

    // `timingSafeEqual` LANÇA `RangeError` quando os buffers têm tamanhos
    // diferentes — e o tamanho é escolhido por quem envia o webhook. Um
    // `v1=ab` derrubava a rota com 500 em vez de recusar com 401. Comparar o
    // comprimento antes mantém a recusa nomeada, e não vaza nada: o tamanho
    // esperado de um HMAC-SHA256 é público.
    const recebida = Buffer.from(signature, "hex");
    const esperada = Buffer.from(expectedSignature, "hex");
    if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) {
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

    const amountMinor = stripeAmountMinor(data);
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

  /**
   * Cria o PaymentIntent — o passo que faltava para alguém conseguir pagar.
   *
   * Três decisões que importam:
   *
   * 1. **`amount` vai em unidade menor, sem conversão.** É a mesma regra da
   *    leitura: a Stripe fala em centavos. Multiplicar aqui cobraria cem vezes.
   * 2. **`Idempotency-Key` no cabeçalho**, com a chave do pedido. É o que faz
   *    o clique repetido reusar a cobrança em vez de criar a segunda — e a
   *    Stripe garante isso por 24h.
   * 3. **`automatic_payment_methods`**, para o método aceito ser decidido pela
   *    configuração da conta Stripe, não fixado em código que envelhece.
   *
   * Sem `secretKey`, recusa com 503 em vez de tentar: fail-closed é o que
   * mantém a plataforma honesta enquanto o G2 não fecha.
   */
  async createPayment(input: {
    orderId: string;
    amountMinor: bigint;
    currency: string;
    idempotencyKey: string;
    description?: string;
  }): Promise<CreatedProviderPayment> {
    if (!this.secretKey) {
      throw new AppProblem({
        status: 503,
        code: "STRIPE_SECRET_KEY_MISSING",
        title: "Chave Stripe não configurada",
        detail: "A chave secreta do Stripe não está definida.",
      });
    }
    if (input.amountMinor <= 0n) {
      throw new AppProblem({
        status: 422,
        code: "STRIPE_AMOUNT_INVALID",
        title: "Valor inválido",
        detail: "A cobrança precisa de um valor positivo em unidade menor.",
      });
    }

    const form = new URLSearchParams({
      amount: input.amountMinor.toString(),
      currency: input.currency.toLowerCase(),
      "automatic_payment_methods[enabled]": "true",
      "metadata[order_id]": input.orderId,
    });
    if (input.description !== undefined) form.set("description", input.description);

    const response = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppProblem({
        status: 502,
        code: "STRIPE_CREATE_FAILED",
        title: "Falha ao criar cobrança",
        detail: `Stripe retornou status ${response.status.toString()}: ${errorText}`,
      });
    }

    const payload: unknown = await response.json();
    if (!isUnknownRecord(payload)) {
      throw new AppProblem({
        status: 502,
        code: "STRIPE_CREATE_MALFORMED",
        title: "Resposta Stripe inválida",
        detail: "A criação de cobrança retornou um payload inesperado.",
      });
    }

    const reference = payload.id;
    if (typeof reference !== "string" || reference.length === 0) {
      throw new AppProblem({
        status: 502,
        code: "STRIPE_CREATE_MALFORMED",
        title: "Resposta Stripe inválida",
        detail: "A cobrança criada não trouxe identificador.",
      });
    }

    // O valor que volta é o que a Stripe REGISTROU. Se divergir do pedido,
    // recusar é mais seguro que seguir com uma cobrança de outro valor.
    const registrado = stripeAmountMinor(payload);
    if (registrado !== input.amountMinor) {
      throw new AppProblem({
        status: 502,
        code: "STRIPE_CREATE_AMOUNT_MISMATCH",
        title: "Valor divergente",
        detail: `A cobrança foi criada com ${registrado.toString()} em vez de ${input.amountMinor.toString()}.`,
      });
    }

    const status = toStringValue(payload.status, "requires_payment_method");
    const clientSecret = payload.client_secret;

    return {
      providerCode: this.providerCode,
      providerPaymentReference: reference,
      providerState: status === "succeeded" ? "SETTLED" : status === "canceled" ? "FAILED" : "PENDING",
      amountMinor: registrado,
      currency: toStringValue(payload.currency, input.currency).toUpperCase(),
      clientAuthorization: typeof clientSecret === "string" ? clientSecret : null,
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
      // Mesma regra do webhook: a Stripe já manda em unidade menor.
      amountMinor: stripeAmountMinor(data),
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
