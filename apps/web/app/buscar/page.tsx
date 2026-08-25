import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchView } from "@/components/search/search-view";

export const metadata: Metadata = {
  title: "Buscar",
  description: "Resolva uma consulta no catálogo publicado com filtros, ordenação e recuperação.",
};

export default function Page() {
  // Suspense porque a view lê o estado da busca de searchParams — sem o
  // boundary, a rota inteira sai do pré-render estático.
  return (
    <Suspense fallback={null}>
      <SearchView />
    </Suspense>
  );
}
