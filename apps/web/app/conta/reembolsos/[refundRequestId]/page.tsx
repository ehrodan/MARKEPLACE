import type { Metadata } from "next";
import { RefundDetailView } from "@/components/refunds/refund-detail-view";

export const metadata: Metadata = { title: "Solicitação de reembolso" };

export default async function RefundRequestDetailPage({
  params,
}: {
  params: Promise<{ refundRequestId: string }>;
}) {
  const { refundRequestId } = await params;
  return <RefundDetailView refundRequestId={refundRequestId} />;
}
