import type { Metadata } from "next";
import { PurchaseDetailView } from "@/components/account/purchase-detail-view";

export const metadata: Metadata = { title: "Detalhe do pedido" };

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <PurchaseDetailView orderId={orderId} />;
}
