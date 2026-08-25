import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PublicCatalogAsset, PublicListing } from "@/components/marketplace/types";
import { ListingGallery } from "./listing-gallery";

const listing: PublicListing = {
  listingId: "01900000-0000-7000-8000-000000000021",
  publicSlug: "oferta-publicada",
  catalogItemId: "01900000-0000-7000-8000-000000000022",
  sellerAccountId: "sac_vendedor_publico",
  listingPlanId: "01900000-0000-7000-8000-000000000023",
  listingStatus: "PUBLISHED",
  priceMinor: "129900",
  currency: "BRL",
  quantityAvailable: 1,
  quantitySold: 0,
  version: 1,
  createdAt: "2026-08-24T10:00:00.000Z",
  updatedAt: "2026-08-24T11:00:00.000Z",
};

const model: PublicCatalogAsset = {
  catalogAssetId: "01900000-0000-7000-8000-000000000024",
  catalogItemId: listing.catalogItemId,
  assetType: "MODEL_3D_GLB",
  storageUri: "https://cdn.example.test/item.glb",
  storageProvider: "PUBLIC_CDN",
  fileSizeBytes: "2048",
  mimeType: "model/gltf-binary",
  isPrimary: false,
  approvalStatus: "APPROVED",
};

afterEach(() => { cleanup(); });

describe("ListingGallery", () => {
  it("oferece o viewer apenas para item com rota 3D suportada", () => {
    render(<ListingGallery assets={[model]} itemSlug="ochpoch-market" listing={listing} />);

    expect(screen.getByRole("link", { name: /Inspecionar em 3D/u })).toHaveAttribute(
      "href",
      "/itens/ochpoch-market/3d?from=%2Fanuncios%2Foferta-publicada",
    );
  });

  it("não anuncia 3D para slug que cairia em uma rota sem viewer", () => {
    render(<ListingGallery assets={[model]} itemSlug="item-sem-viewer" listing={listing} />);

    expect(screen.queryByRole("link", { name: /Inspecionar em 3D/u })).not.toBeInTheDocument();
  });
});
