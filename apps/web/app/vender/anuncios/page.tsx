import type { Metadata } from "next";
import { Suspense } from "react";
import { WizardLauncher } from "@/components/listing-wizard/wizard-shell";
import { SellerListingsView } from "@/components/seller-listings/seller-listings-view";
import {
  SellerWorkspace,
  SellerWorkspaceFallback,
} from "@/components/seller-listings/seller-workspace";

export const metadata: Metadata = {
  title: "Meus anúncios",
  description:
    "Crie um anúncio em cinco passos, acompanhe rascunhos e publique pela loja selecionada.",
};

export default function SellerListingsPage() {
  return (
    <Suspense fallback={<SellerWorkspaceFallback label="Preparando seus anúncios" />}>
      <SellerWorkspace current="list">
        <SellerListingsView />
        <WizardLauncher />
      </SellerWorkspace>
    </Suspense>
  );
}
