import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandWordmark } from "@/components/brand-wordmark";
import { ModelViewer } from "@/components/viewer/model-viewer";
import { BRAND } from "@/lib/brand";
import {
  allowlistedViewerOrigin,
  isSupportedBrandViewerSlug,
} from "@/lib/viewer-routing";

export const metadata: Metadata = {
  title: "Visualização 3D",
  description: "Visualização interativa do símbolo tridimensional OCHPOCH MARKET.",
};

export default async function Item3DPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  if (!isSupportedBrandViewerSlug(slug)) notFound();
  const returnTo = allowlistedViewerOrigin(query.from) ?? "/";

  return (
    <main id="conteudo-principal" className="viewer-page">
      <header className="viewer-page__header">
        <BrandWordmark />
        <Link className="viewer-page__back" href={returnTo}>← Voltar</Link>
      </header>
      <div className="viewer-page__intro">
        <div>
          <span className="landing-kicker">OBJETO DE MARCA · 3D</span>
          <h1>O símbolo,<br />sob todos os ângulos.</h1>
        </div>
        <p>Modelo GLB fornecido ao projeto. Use o mouse, o toque ou as vistas predefinidas para inspecionar a forma.</p>
      </div>
      <ModelViewer />
      <footer className="viewer-page__footer">
        <span>{BRAND.name}</span>
        <small>Representação visual do asset original</small>
      </footer>
    </main>
  );
}
