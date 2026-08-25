import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProblem } from "@midas/kernel";
import { StripePaymentAdapter } from "../src/adapters/stripe-payment-adapter.js";

/**
 * Verificação de assinatura de webhook é código de segurança, e estava sem
 * nenhum teste. Se ela erra, a plataforma aceita um webhook forjado e credita
 * um pagamento que nunca aconteceu.
 *
 * O que estes casos travam:
 *
 * 1. o caminho feliz — assinatura correta é aceita e os campos saem certos;
 * 2. toda recusa é `AppProblem` com código nomeado, nunca um erro cru que
 *    vira 500 e esconde o motivo;
 * 3. assinatura de TAMANHO diferente do esperado. `timingSafeEqual` lança
 *    `RangeError` quando os buffers têm tamanhos diferentes, e um atacante
 *    controla esse tamanho — mandar `v1=ab` derrubava a rota com erro não
 *    tratado em vez de recusar com 401;
 * 4. tolerância de timestamp. A assinatura HMAC não expira sozinha: sem
 *    janela, um webhook capturado continua válido para sempre.
 */

const SEGREDO = "whsec_teste_0123456789abcdef";

function assinar(corpo: string, timestampSegundos: number, segredo = SEGREDO): string {
  const assinatura = createHmac("sha256", segredo)
    .update(`${String(timestampSegundos)}.${corpo}`)
    .digest("hex");
  return `t=${String(timestampSegundos)},v1=${assinatura}`;
}

function eventoDePagamento(id = "evt_1", intentId = "pi_1"): string {
  return JSON.stringify({
    id,
    type: "payment_intent.succeeded",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: intentId,
        amount_received: 17_990,
        currency: "brl",
        status: "succeeded",
      },
    },
  });
}

function adapter(): StripePaymentAdapter {
  return new StripePaymentAdapter("sk_teste", SEGREDO);
}

async function capturar(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa;
    return null;
  } catch (erro: unknown) {
    return erro;
  }
}

describe("StripePaymentAdapter — configuração", () => {
  it("sem chave ou sem segredo, não se declara configurado", () => {
    // `isConfigured() === false` é o que mantém o provedor em
    // CONTRACT_REQUIRED, e é o que impede a plataforma de fingir que aceita
    // pagamento antes de haver contrato.
    expect(new StripePaymentAdapter(undefined, undefined).isConfigured()).toBe(false);
    expect(new StripePaymentAdapter("sk_teste", undefined).isConfigured()).toBe(false);
    expect(new StripePaymentAdapter(undefined, SEGREDO).isConfigured()).toBe(false);
    expect(adapter().isConfigured()).toBe(true);
  });

  it("sem segredo, recusa o webhook com 503 em vez de aceitar", async () => {
    const semSegredo = new StripePaymentAdapter("sk_teste", undefined);
    const erro = await capturar(semSegredo.verifyWebhook({
      rawBody: new TextEncoder().encode(eventoDePagamento()),
      headers: { "stripe-signature": assinar(eventoDePagamento(), Math.floor(Date.now() / 1000)) },
    }));
    expect(erro).toBeInstanceOf(AppProblem);
    expect((erro as AppProblem).code).toBe("STRIPE_WEBHOOK_SECRET_MISSING");
  });
});

describe("StripePaymentAdapter — assinatura do webhook", () => {
  it("aceita assinatura correta e extrai os campos do evento", async () => {
    const corpo = eventoDePagamento("evt_ok", "pi_ok");
    const agora = Math.floor(Date.now() / 1000);
    const evento = await adapter().verifyWebhook({
      rawBody: new TextEncoder().encode(corpo),
      headers: { "stripe-signature": assinar(corpo, agora) },
    });

    expect(evento.providerCode).toBe("stripe");
    expect(evento.externalEventId).toBe("evt_ok");
    expect(evento.providerPaymentReference).toBe("pi_ok");
    expect(evento.providerState).toBe("SETTLED");
    // Dinheiro em unidade menor e BigInt: `17990` centavos, nunca 179.9.
    expect(evento.amountMinor).toBe(17_990n);
    expect(evento.currency).toBe("BRL");
  });

  it("recusa corpo adulterado, mesmo com assinatura bem formada", async () => {
    const corpo = eventoDePagamento();
    const agora = Math.floor(Date.now() / 1000);
    const cabecalho = assinar(corpo, agora);
    const adulterado = corpo.replace("17990", "9999900");

    const erro = await capturar(adapter().verifyWebhook({
      rawBody: new TextEncoder().encode(adulterado),
      headers: { "stripe-signature": cabecalho },
    }));
    expect(erro).toBeInstanceOf(AppProblem);
    expect((erro as AppProblem).code).toBe("STRIPE_SIGNATURE_INVALID");
  });

  it("recusa assinatura feita com outro segredo", async () => {
    const corpo = eventoDePagamento();
    const agora = Math.floor(Date.now() / 1000);
    const erro = await capturar(adapter().verifyWebhook({
      rawBody: new TextEncoder().encode(corpo),
      headers: { "stripe-signature": assinar(corpo, agora, "whsec_de_outra_pessoa") },
    }));
    expect(erro).toBeInstanceOf(AppProblem);
    expect((erro as AppProblem).code).toBe("STRIPE_SIGNATURE_INVALID");
  });

  it("recusa cabeçalho ausente e malformado com códigos distintos", async () => {
    const corpo = eventoDePagamento();
    const rawBody = new TextEncoder().encode(corpo);

    const ausente = await capturar(adapter().verifyWebhook({ rawBody, headers: {} }));
    expect((ausente as AppProblem).code).toBe("STRIPE_SIGNATURE_MISSING");

    for (const cabecalho of ["", "lixo", "t=123", "v1=abc", "t=,v1="]) {
      const erro = await capturar(adapter().verifyWebhook({
        rawBody,
        headers: { "stripe-signature": cabecalho },
      }));
      expect(erro, `cabeçalho ${JSON.stringify(cabecalho)} deveria virar AppProblem`).toBeInstanceOf(AppProblem);
    }
  });

  it("assinatura de tamanho errado vira 401, não erro cru", async () => {
    // `timingSafeEqual` lança `RangeError` com buffers de tamanhos diferentes,
    // e o tamanho é escolhido por quem envia. Sem tratar, `v1=ab` derruba a
    // rota com 500 em vez de recusar — e um 500 numa rota de pagamento é
    // ruído que esconde ataque.
    const corpo = eventoDePagamento();
    const agora = Math.floor(Date.now() / 1000);

    for (const curta of ["ab", "00", "abcdef", "f".repeat(10)]) {
      const erro = await capturar(adapter().verifyWebhook({
        rawBody: new TextEncoder().encode(corpo),
        headers: { "stripe-signature": `t=${String(agora)},v1=${curta}` },
      }));
      expect(erro, `assinatura curta ${curta} deveria virar AppProblem`).toBeInstanceOf(AppProblem);
      expect((erro as AppProblem).status).toBe(401);
    }
  });

  it("recusa assinatura que não é hexadecimal", async () => {
    const corpo = eventoDePagamento();
    const agora = Math.floor(Date.now() / 1000);
    const erro = await capturar(adapter().verifyWebhook({
      rawBody: new TextEncoder().encode(corpo),
      headers: { "stripe-signature": `t=${String(agora)},v1=${"z".repeat(64)}` },
    }));
    expect(erro).toBeInstanceOf(AppProblem);
    expect((erro as AppProblem).status).toBe(401);
  });
});

describe("StripePaymentAdapter — janela de tempo", () => {
  it("recusa evento antigo demais", async () => {
    // A assinatura HMAC não expira sozinha. Sem janela, um webhook capturado
    // hoje continua válido daqui a um ano. O inbox de eventos já rejeita o
    // MESMO `externalEventId` duas vezes, mas isso é a segunda linha de
    // defesa — esta é a primeira, e é a que o próprio Stripe documenta.
    const corpo = eventoDePagamento();
    const antigo = Math.floor(Date.now() / 1000) - 60 * 60; // uma hora atrás

    const erro = await capturar(adapter().verifyWebhook({
      rawBody: new TextEncoder().encode(corpo),
      headers: { "stripe-signature": assinar(corpo, antigo) },
    }));
    expect(erro).toBeInstanceOf(AppProblem);
    expect((erro as AppProblem).code).toBe("STRIPE_SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE");
  });

  it("aceita relógio adiantado dentro da tolerância", async () => {
    // Relógio do servidor levemente atrás do da Stripe é normal; recusar por
    // alguns segundos de diferença derrubaria pagamento legítimo.
    const corpo = eventoDePagamento("evt_futuro", "pi_futuro");
    const poucoAdiante = Math.floor(Date.now() / 1000) + 60;
    const evento = await adapter().verifyWebhook({
      rawBody: new TextEncoder().encode(corpo),
      headers: { "stripe-signature": assinar(corpo, poucoAdiante) },
    });
    expect(evento.externalEventId).toBe("evt_futuro");
  });
});

describe("StripePaymentAdapter — criar cobrança", () => {
  /** Simula a API do Stripe, guardando o que foi enviado. */
  function stubStripe(resposta: unknown, ok = true): { enviado: () => { url: string; headers: Record<string, string>; body: string } | null } {
    let capturado: { url: string; headers: Record<string, string>; body: string } | null = null;
    vi.stubGlobal("fetch", vi.fn((url: unknown, init?: RequestInit) => {
      capturado = {
        url: String(url),
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: typeof init?.body === "string" ? init.body : "",
      };
      return Promise.resolve(new Response(JSON.stringify(resposta), {
        status: ok ? 200 : 402,
        headers: { "content-type": "application/json" },
      }));
    }));
    return { enviado: () => capturado };
  }

  const respostaOk = {
    id: "pi_criado",
    amount: 17_990,
    currency: "brl",
    status: "requires_payment_method",
    client_secret: "pi_criado_secret_abc",
  };

  it("manda o valor em unidade menor, sem multiplicar", async () => {
    // O bug que existia na LEITURA (×100) não pode reaparecer na ESCRITA:
    // cobrar 1.799.000 em vez de 17.990 seria cem vezes o preço.
    const stripe = stubStripe(respostaOk);
    await adapter().createPayment({
      orderId: "ord-1",
      amountMinor: 17_990n,
      currency: "BRL",
      idempotencyKey: "dev-chave-12345678",
    });

    const corpo = new URLSearchParams(stripe.enviado()?.body ?? "");
    expect(corpo.get("amount")).toBe("17990");
    expect(corpo.get("currency")).toBe("brl");
    expect(corpo.get("metadata[order_id]")).toBe("ord-1");
  });

  it("manda a chave de idempotência no cabeçalho", async () => {
    // É o que faz o clique repetido reusar a cobrança em vez de criar a segunda.
    const stripe = stubStripe(respostaOk);
    await adapter().createPayment({
      orderId: "ord-1",
      amountMinor: 17_990n,
      currency: "BRL",
      idempotencyKey: "dev-chave-12345678",
    });
    expect(stripe.enviado()?.headers["Idempotency-Key"]).toBe("dev-chave-12345678");
    expect(stripe.enviado()?.url).toBe("https://api.stripe.com/v1/payment_intents");
  });

  it("devolve a autorização do cliente e a referência do provedor", async () => {
    stubStripe(respostaOk);
    const criado = await adapter().createPayment({
      orderId: "ord-1",
      amountMinor: 17_990n,
      currency: "BRL",
      idempotencyKey: "dev-chave-12345678",
    });
    expect(criado.providerPaymentReference).toBe("pi_criado");
    expect(criado.clientAuthorization).toBe("pi_criado_secret_abc");
    expect(criado.providerState).toBe("PENDING");
    expect(criado.amountMinor).toBe(17_990n);
  });

  it("recusa quando o Stripe registra valor diferente do pedido", async () => {
    // Seguir com uma cobrança de outro valor é pior que falhar: o comprador
    // pagaria um número que ninguém combinou.
    stubStripe({ ...respostaOk, amount: 999 });
    const erro = await capturar(adapter().createPayment({
      orderId: "ord-1",
      amountMinor: 17_990n,
      currency: "BRL",
      idempotencyKey: "dev-chave-12345678",
    }));
    expect(erro).toBeInstanceOf(AppProblem);
    expect((erro as AppProblem).code).toBe("STRIPE_CREATE_AMOUNT_MISMATCH");
  });

  it("recusa valor zero ou negativo antes de chamar o Stripe", async () => {
    const stripe = stubStripe(respostaOk);
    for (const invalido of [0n, -1n, -17_990n]) {
      const erro = await capturar(adapter().createPayment({
        orderId: "ord-1",
        amountMinor: invalido,
        currency: "BRL",
        idempotencyKey: "dev-chave-12345678",
      }));
      expect(erro, `valor ${invalido.toString()} deveria ser recusado`).toBeInstanceOf(AppProblem);
    }
    expect(stripe.enviado(), "nada deveria ter sido enviado ao Stripe").toBeNull();
  });

  it("sem chave secreta, recusa com 503 em vez de tentar", async () => {
    const semChave = new StripePaymentAdapter(undefined, SEGREDO);
    const erro = await capturar(semChave.createPayment({
      orderId: "ord-1",
      amountMinor: 17_990n,
      currency: "BRL",
      idempotencyKey: "dev-chave-12345678",
    }));
    expect((erro as AppProblem).code).toBe("STRIPE_SECRET_KEY_MISSING");
    expect((erro as AppProblem).status).toBe(503);
  });

  it("traduz recusa do Stripe em 502 com o motivo original", async () => {
    stubStripe({ error: { message: "Your card was declined." } }, false);
    const erro = await capturar(adapter().createPayment({
      orderId: "ord-1",
      amountMinor: 17_990n,
      currency: "BRL",
      idempotencyKey: "dev-chave-12345678",
    }));
    expect((erro as AppProblem).code).toBe("STRIPE_CREATE_FAILED");
    // `AppProblem` nao expoe `detail` como propriedade — o motivo do provedor
    // viaja na mensagem do erro, e e la que ele precisa aparecer para o
    // operador entender a recusa sem abrir o painel do Stripe.
    expect(String(erro)).toContain("declined");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
