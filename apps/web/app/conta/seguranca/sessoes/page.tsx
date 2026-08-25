import type { Metadata } from "next";
import { SessionsView } from "@/components/security/sessions-view";

export const metadata: Metadata = { title: "Sessões" };

export default function AccountSessionsPage() {
  return <SessionsView />;
}
