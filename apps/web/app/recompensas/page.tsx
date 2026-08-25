// SCR-PUB-015 — superfície real, não mais o stub de contrato.
// Fonte canônica da rota: docs/07-MAPA-DE-TELAS-E-FLUXOS.md linha 112.
// Fonte canônica dos valores: modules/progression/src/level-policy.ts e
// modules/progression/src/listing-plan-policy.ts.
import type { Metadata } from "next";
import { MarketplaceShell } from "@/components/marketplace/marketplace-shell";
import { RewardsView } from "@/components/progression/rewards-view";

export const metadata: Metadata = {
  title: "Recompensas e níveis",
  description:
    "Níveis 1 a 10 da conta de vendedor com o critério de cada faixa, a insígnia definida e o que ainda não foi publicado.",
};

export default function Page() {
  return <MarketplaceShell><RewardsView /></MarketplaceShell>;
}
