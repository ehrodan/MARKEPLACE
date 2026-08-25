import type { Metadata } from "next";
import { DeliveryView } from "@/components/delivery/delivery-view";
import { MarketplaceShell } from "@/components/marketplace/marketplace-shell";

// SCR-BUY-006 — docs/07-MAPA-DE-TELAS-E-FLUXOS.md.
// Tela privada: só o comprador e o vendedor daquele pedido enxergam o conteúdo,
// e quem não é parte recebe o mesmo "não encontrado" de um pedido inexistente.
export const metadata: Metadata = {
  title: "Entrega segura do pedido",
  description:
    "Custódia do pacote e confirmações independentes do comprador e do vendedor (SCR-BUY-006).",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return (
    <MarketplaceShell>
      <DeliveryView orderId={orderId} />
    </MarketplaceShell>
  );
}
