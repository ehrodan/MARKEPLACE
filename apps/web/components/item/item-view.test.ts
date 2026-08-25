import { describe, expect, it } from "vitest";
import type { PublicCatalogAsset } from "@/components/marketplace/types";
import { approvedCatalogAssets } from "./item-view";

function asset(
  approvalStatus: PublicCatalogAsset["approvalStatus"],
  id: string,
): PublicCatalogAsset {
  return {
    catalogAssetId: id,
    catalogItemId: "item-1",
    assetType: "POSTER_2D",
    storageUri: `/assets/${id}.png`,
    storageProvider: "LOCAL",
    fileSizeBytes: "1024",
    mimeType: "image/png",
    isPrimary: id === "approved",
    approvalStatus,
  };
}

describe("approvedCatalogAssets", () => {
  it("consome o array retornado pela rota e mantém apenas assets publicáveis", () => {
    const result = approvedCatalogAssets([
      asset("APPROVED", "approved"),
      asset("PENDING_REVIEW", "pending"),
      asset("REJECTED", "rejected"),
      asset(undefined, "legacy-approved"),
    ]);

    expect(result.map((entry) => entry.catalogAssetId)).toEqual([
      "approved",
      "legacy-approved",
    ]);
  });
});
