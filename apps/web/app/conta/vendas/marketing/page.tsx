import type { Metadata } from "next";
import { SalesMarketingView } from "@/components/sales/sales-dashboard";

export const metadata: Metadata = { title: "Marketing" };

export default function SalesMarketingPage() {
  return <SalesMarketingView />;
}
