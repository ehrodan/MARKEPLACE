// SCR-ACC-010 · docs/07-MAPA-DE-TELAS-E-FLUXOS.md
import type { Metadata } from "next";
import { PreferencesView } from "@/components/notifications/consent-matrix";

export const metadata: Metadata = { title: "Preferências de comunicação" };

export default function AccountPreferencesPage() {
  return <PreferencesView />;
}
