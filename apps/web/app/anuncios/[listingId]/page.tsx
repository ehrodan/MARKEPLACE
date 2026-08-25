import type { Metadata } from "next";
import { ListingPageView } from "@/components/listing-detail/listing-page-view";
import { MarketplaceShell } from "@/components/marketplace/marketplace-shell";

export const metadata: Metadata = {
  title: "Anúncio",
  description:
    "Oferta publicada no OCHPOCH MARKET: mídia aprovada, preço, composição de taxa, disponibilidade e vendedor lidos do catálogo canônico.",
};

export default async function Page({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  return (
    <MarketplaceShell>
      <ListingPageView listingRef={listingId} />
    </MarketplaceShell>
  );
}
