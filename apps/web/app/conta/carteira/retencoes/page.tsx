import type { Metadata } from "next";
import { HoldsView } from "@/components/wallet/holds-view";

export const metadata: Metadata = { title: "Retenções" };

export default function SalesHoldsPage() {
  return <HoldsView />;
}
