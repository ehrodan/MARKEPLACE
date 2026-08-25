import type { Metadata } from "next";
import { PurchasesView } from "@/components/account/purchases-view";

export const metadata: Metadata = { title: "Compras" };
export default function PurchasesPage() { return <PurchasesView />; }
