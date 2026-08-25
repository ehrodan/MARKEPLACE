import type { Metadata } from "next";
import { OverviewView } from "@/components/account/overview-view";

export const metadata: Metadata = { title: "Minha conta" };
export default function AccountOverviewPage() { return <OverviewView />; }
