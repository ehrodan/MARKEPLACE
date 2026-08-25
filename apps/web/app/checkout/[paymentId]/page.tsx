import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/checkout-view";

/**
 * SCR-BUY-003 — /checkout/:paymentId.
 *
 * O retorno do PSP volta para esta rota com `?retorno=provedor`. O parâmetro é lido no
 * servidor e repassado como sinal INFORMATIVO: ele leva a tela para "confirmando com o
 * provedor" e nunca para "pago". Somente o webhook autenticado confirma a liquidação
 * (docs/07 §FL-05.5).
 */

const PROVIDER_RETURN_VALUE = "provedor";

export const metadata: Metadata = {
  title: "Checkout protegido",
  description: "Revise o pedido, registre o aceite da política e conclua o pagamento no ambiente do provedor.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { paymentId } = await params;
  const query = await searchParams;
  const retorno = query["retorno"];
  const returnedFromProvider = Array.isArray(retorno)
    ? retorno.includes(PROVIDER_RETURN_VALUE)
    : retorno === PROVIDER_RETURN_VALUE;

  return <CheckoutView paymentId={paymentId} returnedFromProvider={returnedFromProvider} />;
}
