import type { Metadata } from "next";
import { PayoutsView } from "@/components/account/payouts-view";

export const metadata: Metadata = { title: "Saques" };
export default function PayoutsPage() { return <PayoutsView />; }
