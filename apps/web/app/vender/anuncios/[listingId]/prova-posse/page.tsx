import type { Metadata } from "next";
import { Suspense } from "react";
import { WizardShell } from "@/components/listing-wizard/wizard-shell";
import {
  SellerWorkspace,
  SellerWorkspaceFallback,
} from "@/components/seller-listings/seller-workspace";

export const metadata: Metadata = {
  title: "Prova de posse do anúncio",
  description:
    "Entenda o que é aceito como prova de posse, por que ela é exigida e em que estado está a verificação deste anúncio.",
};

export default async function ListingOwnershipProofPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;

  return (
    <Suspense fallback={<SellerWorkspaceFallback label="Carregando a prova de posse" />}>
      <SellerWorkspace current="list">
        <WizardShell
          listingId={listingId}
          initialStepId="proof"
          stepBasePath={`/vender/anuncios/${encodeURIComponent(listingId)}`}
        />
      </SellerWorkspace>
    </Suspense>
  );
}
