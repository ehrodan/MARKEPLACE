import type { Metadata } from "next";
import { SalesDashboard } from "@/components/sales/sales-dashboard";

export const metadata: Metadata = { title: "Painel de vendas" };

export default function SalesDashboardPage() {
  return <SalesDashboard />;
}
