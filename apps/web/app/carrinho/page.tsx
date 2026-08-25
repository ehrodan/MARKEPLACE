import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { MarketplaceShell } from "@/components/marketplace/marketplace-shell";

// SCR-BUY-012 — docs/07-MAPA-DE-TELAS-E-FLUXOS.md.
// "Revisar itens multivendedor, validade, relações opcionais e separação dos
// pedidos antes de pagar."
//
// O conteúdo desta rota é o carrinho de UMA pessoa (dispositivo ou conta), então
// não há o que indexar: `index: false`. `follow: true` mantém os links para
// /market e para os anúncios rastreáveis a partir daqui.
export const metadata: Metadata = {
  title: "Carrinho",
  description:
    "Revisão do carrinho antes do pagamento: itens agrupados por vendedor, preço e disponibilidade reconferidos no catálogo, um pedido por vendedor.",
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <MarketplaceShell>
      <CartView />
    </MarketplaceShell>
  );
}
