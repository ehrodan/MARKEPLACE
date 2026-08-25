import type { Metadata } from "next";
import { CatalogAdminView } from "@/components/admin-catalog/catalog-admin-view";

export const metadata: Metadata = { title: "Detalhe do catálogo" };

export default async function CatalogResourcePage({
  params,
}: {
  params: Promise<{ resourceType: string; resourceId: string }>;
}) {
  const { resourceId } = await params;
  return <CatalogAdminView initialItemId={resourceId} />;
}
