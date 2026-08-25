import type { Metadata } from "next";
import { RefundsView } from "@/components/refunds/refunds-view";

export const metadata: Metadata = { title: "Solicitações de reembolso" };

export default function RefundRequestsPage() {
  return <RefundsView />;
}
