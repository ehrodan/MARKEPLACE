import type { Metadata } from "next";
import { DisputeView } from "@/components/disputes/dispute-view";

// SCR-BUY-007 — docs/07-MAPA-DE-TELAS-E-FLUXOS.md.
// Acesso restrito às partes do pedido, com evidência bilateral escopada.
export const metadata: Metadata = {
  title: "Disputa do pedido",
  description:
    "Acompanhamento de disputa: fase, prazos, evidências escopadas, decisão publicada, efeito financeiro e recurso.",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string; disputeId: string }>;
}) {
  const { orderId, disputeId } = await params;
  return <DisputeView orderId={orderId} disputeId={disputeId} />;
}
