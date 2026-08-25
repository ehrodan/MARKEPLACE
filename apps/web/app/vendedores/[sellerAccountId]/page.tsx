import type { Metadata } from "next";
import { MarketplaceShell } from "@/components/marketplace/marketplace-shell";
import { SellerProfileView } from "@/components/seller-public/seller-profile-view";

// SCR-PUB-007 — docs/07-MAPA-DE-TELAS-E-FLUXOS.md.
// Superfície pública: exibe reputação declarada e ofertas publicadas de uma
// conta comercial, sem revelar membros nem PII.
export const metadata: Metadata = {
  title: "Perfil do vendedor",
  description:
    "Ofertas publicadas por uma conta comercial do OCHPOCH MARKET, com a cobertura de cada número declarada. Perfil público não expõe membros nem dado pessoal.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ sellerAccountId: string }>;
}) {
  const { sellerAccountId } = await params;
  return (
    <MarketplaceShell>
      <SellerProfileView sellerAccountId={sellerAccountId} />
    </MarketplaceShell>
  );
}
