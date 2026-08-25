import type { Metadata } from "next";
import { Suspense } from "react";
import {
  SellerDashboard,
  SellerDashboardFallback,
} from "@/components/seller-dashboard/seller-dashboard";

export const metadata: Metadata = {
  title: "Central do vendedor",
  description:
    "Anúncios, pedidos e saldo reais da conta de venda selecionada, sem métricas demonstrativas.",
};

export default function Page() {
  return (
    <Suspense fallback={<SellerDashboardFallback />}>
      <SellerDashboard />
    </Suspense>
  );
}
