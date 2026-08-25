import type { Metadata } from "next";
import { MarketView } from "@/components/marketplace/market-view";
import { MarketplaceShell } from "@/components/marketplace/marketplace-shell";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Explore ofertas publicadas no OCHPOCH MARKET com preço e disponibilidade atualizados.",
};

export default function Page() {
  return <MarketplaceShell><MarketView /></MarketplaceShell>;
}
