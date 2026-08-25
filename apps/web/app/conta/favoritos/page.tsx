import type { Metadata } from "next";
import { FavoritesView } from "@/components/favorites/favorites-view";

// SCR-ACC-009 — docs/07-MAPA-DE-TELAS-E-FLUXOS.md.
// "Reunir itens e ofertas salvos, distinguindo removido/indisponível."
export const metadata: Metadata = { title: "Favoritos e avisos" };

export default function FavoritesPage() {
  return <FavoritesView />;
}
