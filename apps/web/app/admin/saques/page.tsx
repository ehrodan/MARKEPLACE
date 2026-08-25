import type { Metadata } from "next";
import { AdminPayoutsView } from "@/components/operations/admin-payouts-view";

export const metadata: Metadata = { title: "Administração de saques" };

export default function AdminPayoutsPage() {
  return <AdminPayoutsView />;
}
