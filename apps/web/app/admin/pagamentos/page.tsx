import type { Metadata } from "next";
import { AdminPaymentsView } from "@/components/operations/admin-payments-view";

export const metadata: Metadata = { title: "Administração de pagamentos" };

export default function AdminPaymentsPage() {
  return <AdminPaymentsView />;
}
