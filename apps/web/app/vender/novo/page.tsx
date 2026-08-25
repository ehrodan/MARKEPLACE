import type { Metadata } from "next";
import { Suspense } from "react";
import { NewListingView } from "@/components/seller-listings/new-listing-view";
import {
  SellerWorkspace,
  SellerWorkspaceFallback,
} from "@/components/seller-listings/seller-workspace";

export const metadata: Metadata = {
  title: "Novo anúncio",
  description: "Crie, revise e publique um anúncio para a loja selecionada.",
};

export default function NewListingPage() {
  return (
    <Suspense fallback={<SellerWorkspaceFallback label="Preparando novo anúncio" />}>
      <SellerWorkspace current="new">
        <NewListingView />
      </SellerWorkspace>
    </Suspense>
  );
}
