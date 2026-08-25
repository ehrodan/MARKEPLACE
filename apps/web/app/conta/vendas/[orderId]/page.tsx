import type { Metadata } from "next";
import { SaleDetailView } from "@/components/sales/sale-detail-view";

export const metadata: Metadata = { title: "Detalhe da venda" };

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <SaleDetailView orderId={orderId} />;
}
