import type { Metadata } from "next";
import { StatementView } from "@/components/wallet/statement-view";

export const metadata: Metadata = { title: "Extrato de vendas" };

export default function SalesStatementPage() {
  return <StatementView />;
}
