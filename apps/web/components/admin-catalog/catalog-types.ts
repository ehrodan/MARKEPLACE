export type CatalogItemType = "WEAPON" | "SKIN" | "STICKER" | "KEY" | "CASE" | "OTHER";
export type CatalogRarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC" | "CONTRABAND";
export type CatalogAssetType = "POSTER_2D" | "MODEL_3D_GLB" | "MULTI_VIEW" | "SINGLE_VIEW";
export type AssetApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "QUARANTINED";

export interface CatalogItem {
  catalogItemId: string;
  publicSlug: string;
  displayName: string;
  description: string | null;
  gameOrigin: string;
  itemType: CatalogItemType;
  rarity: CatalogRarity | null;
  craftQuality: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogItemPage {
  data: CatalogItem[];
  nextCursor: string | null;
}

export interface CatalogAsset {
  catalogAssetId: string;
  catalogItemId: string;
  assetType: CatalogAssetType;
  storageUri: string;
  storageProvider: "MINIO" | "S3" | "LOCAL";
  fileSizeBytes: string;
  mimeType: string;
  widthPixels: number | null;
  heightPixels: number | null;
  isPrimary: boolean;
  approvalStatus: AssetApprovalStatus;
  rejectionReason: string | null;
  createdAt: string;
}
