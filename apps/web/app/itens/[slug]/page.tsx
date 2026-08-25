import type { Metadata } from "next";
import { ItemView } from "@/components/item/item-view";
import { MarketplaceShell } from "@/components/marketplace/marketplace-shell";

export const metadata: Metadata = {
  title: "Item",
  description: "Item do catálogo OCHPOCH MARKET com as ofertas publicadas de cada vendedor.",
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MarketplaceShell><ItemView slug={slug} /></MarketplaceShell>;
}
