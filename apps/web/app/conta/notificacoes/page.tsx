// SCR-ACC-014 · docs/07-MAPA-DE-TELAS-E-FLUXOS.md
import type { Metadata } from "next";
import { NotificationsView } from "@/components/notifications/notifications-view";

export const metadata: Metadata = { title: "Notificações" };

export default function AccountNotificationsPage() {
  return <NotificationsView />;
}
