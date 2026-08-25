import type { Metadata } from "next";
import { SalesCustomersView } from "@/components/sales/sales-dashboard";

export const metadata: Metadata = { title: "Clientes" };

export default function SalesCustomersPage() {
  return <SalesCustomersView />;
}
