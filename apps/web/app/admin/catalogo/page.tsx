import type { Metadata } from "next";
import { CatalogAdminView } from "@/components/admin-catalog/catalog-admin-view";

export const metadata: Metadata = { title: "Biblioteca do catálogo" };

export default function CatalogAdminPage() { return <CatalogAdminView />; }
