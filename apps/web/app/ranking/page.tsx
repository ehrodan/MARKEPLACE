// SCR-PUB-014 — superfície real, não mais o stub de contrato.
// Fonte canônica da rota: docs/07-MAPA-DE-TELAS-E-FLUXOS.md linha 111.
// Fonte canônica da fórmula: modules/progression/src/leaderboard-policy.ts.
import type { Metadata } from "next";
import { MarketplaceShell } from "@/components/marketplace/marketplace-shell";
import { LeaderboardView } from "@/components/progression/leaderboard-view";

export const metadata: Metadata = {
  title: "Ranking de vendedores",
  description:
    "Fórmula, moeda, janela e ordem de desempate da temporada do ranking, com identidade mascarada e classificação apenas quando a projeção estiver publicada.",
};

export default function Page() {
  return <MarketplaceShell><LeaderboardView /></MarketplaceShell>;
}
