import type { Metadata } from "next";
import { SecurityView } from "@/components/security/security-view";

export const metadata: Metadata = { title: "Segurança da conta" };

export default function AccountSecurityPage() {
  return <SecurityView />;
}
