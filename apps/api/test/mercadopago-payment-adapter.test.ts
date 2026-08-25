import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AppProblem } from "@midas/kernel";
import { MercadoPagoPaymentAdapter } from "../src/adapters/mercadopago-payment-adapter.js";

/**
 * O par do teste da Stripe: verificação de assinatura de webhook é código de
 * segurança e estava sem cobertura.
 *
 * O caso mais importante aqui é a **unidade do valor**, que é DIFERENTE da
 * Stripe: o Mercado Pago manda `transaction_amount` em unidade maior
 * (`179.9` = R$ 179,90), enquanto a Stripe manda em unidade menor (`17990`).
 * Uniformizar os dois adapters introduziria um erro de cem vezes em um deles,
 * e este teste existe para que a diferença seja mexida por decisão, não por
 * distração.
 */

const SEGREDO = "mp_secret_0123456789abcdef";

function adapter(): MercadoPagoPaymentAdapter {
  return new MercadoPagoPaymentAdapter("mp_access_token", SEGREDO);
}

async function capturar(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa;
    return null;
  } catch (erro: unknown) {
    return erro;
  }
}

describe("MercadoPagoPaymentAdapter — configuração", () => {
  it("sem token ou sem segredo, não se declara configurado", () => {
    expect(new MercadoPagoPaymentAdapter(undefined, undefined).isConfigured()).toBe(false);
    expect(new MercadoPagoPaymentAdapter("mp_access_token", undefined).isConfigured()).toBe(false);
    expect(new MercadoPagoPaymentAdapter(undefined, SEGREDO).isConfigured()).toBe(false);
    expect(adapter().isConfigured()).toBe(true);
  });
});

const DATA_ID = "1234567890";
const REQUEST_ID = "req-abc";

/**
 * O manifesto do Mercado Pago não é o corpo: é
 * `id:{data.id};request-id:{x-request-id};ts:{ts};`, e o `data.id` vem do
 * **query param** repassado nos headers, não do JSON.
 */
function cabecalhos(ts: number, segredo = SEGREDO): Record<string, string> {
  const manifesto = `id:${DATA_ID};request-id:${REQUEST_ID};ts:${String(ts)};`;
  const assinatura = createHmac("sha256", segredo).update(manifesto).digest("hex");
  return {
    "x-signature": `ts=${String(ts)},v1=${assinatura}`,
    "x-request-id": REQUEST_ID,
    "data.id": DATA_ID,
  };
}

describe("MercadoPagoPaymentAdapter — assinatura do webhook", () => {
  it("recusa cabeçalho ausente com código nomeado", async () => {
    const erro = await capturar(adapter().verifyWebhook({
      rawBody: new TextEncoder().encode("{}"),
      headers: {},
    }));
    expect(erro).toBeInstanceOf(AppProblem);
    expect((erro as AppProblem).status).toBe(401);
  });

  it("recusa webhook sem data.id antes de olhar a assinatura", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const { "data.id": _ignorado, ...semDataId } = cabecalhos(ts);
    const erro = await capturar(adapter().verifyWebhook({
      rawBody: new TextEncoder().encode("{}"),
      headers: semDataId,
    }));
    expect(erro).toBeInstanceOf(AppProblem);
    expect((erro as AppProblem).code).toBe("MERCADOPAGO_DATA_ID_MISSING");
  });

  it("assinatura de tamanho errado vira AppProblem, não RangeError", async () => {
    // `timingSafeEqual` lança `RangeError` com buffers de tamanhos diferentes,
    // e o tamanho é escolhido por quem envia o webhook.
    const ts = Math.floor(Date.now() / 1000);
    for (const curta of ["ab", "00", "abcdef"]) {
      const erro = await capturar(adapter().verifyWebhook({
        rawBody: new TextEncoder().encode("{}"),
        headers: { ...cabecalhos(ts), "x-signature": `ts=${String(ts)},v1=${curta}` },
      }));
      expect(erro, `assinatura curta ${curta} deveria virar AppProblem`).toBeInstanceOf(AppProblem);
      expect((erro as AppProblem).status).toBe(401);
    }
  });

  it("recusa assinatura feita com outro segredo", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const erro = await capturar(adapter().verifyWebhook({
      rawBody: new TextEncoder().encode("{}"),
      headers: cabecalhos(ts, "segredo_de_outra_pessoa"),
    }));
    expect(erro).toBeInstanceOf(AppProblem);
    expect((erro as AppProblem).status).toBe(401);
  });

  it("aceita assinatura correta", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const evento = await adapter().verifyWebhook({
      rawBody: new TextEncoder().encode(JSON.stringify({
        data: { id: DATA_ID, status: "approved", transaction_amount: 179.9, currency_id: "BRL" },
      })),
      headers: cabecalhos(ts),
    });
    expect(evento.providerCode).toBe("mercadopago");
    // A DIFERENÇA que importa: `179.9` em unidade maior vira 17990 centavos.
    // Na Stripe o mesmo valor chegaria como `17990` e NÃO leva ×100.
    expect(evento.amountMinor).toBe(17_990n);
    expect(evento.currency).toBe("BRL");
  });
});
