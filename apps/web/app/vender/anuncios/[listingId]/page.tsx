import type { Metadata } from "next";
import { Suspense } from "react";
import { WizardShell } from "@/components/listing-wizard/wizard-shell";
import {
  SellerWorkspace,
  SellerWorkspaceFallback,
} from "@/components/seller-listings/seller-workspace";

export const metadata: Metadata = {
  title: "Editar anúncio",
  description:
    "Revise um anúncio existente, corrija o que o contrato permite alterar e decida a publicação separadamente.",
};

export default async function SellerListingEditPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;

  return (
    <Suspense fallback={<SellerWorkspaceFallback label="Carregando o anúncio" />}>
      <SellerWorkspace current="list">
        <WizardShell listingId={listingId} />
      </SellerWorkspace>
    </Suspense>
  );
}
