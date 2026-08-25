export type ListingStatus =
  | "DRAFT"
  | "REVIEW"
  | "PUBLISHED"
  | "PAUSED"
  | "SOLD"
  | "TOMBSTONE";

export interface CatalogItem {
  catalogItemId: string;
  publicSlug: string;
  displayName: string;
  description: string | null;
  gameOrigin: string;
  itemType: string;
  rarity: string | null;
  craftQuality: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ListingPlan {
  listingPlanId: string;
  planCode: "BASIC" | "VIP" | "PREMIUM";
  displayName: string;
  platformFeeRate: string;
  pspFeeRate: string;
  exposurePriority: number;
  queuePriority: number;
  benefits: Record<string, unknown>;
  isActive: true;
  validFrom: string;
  validUntil: string | null;
}

export interface CatalogAsset {
  catalogAssetId: string;
  assetType: string;
  storageUri: string;
  mimeType: string;
  isPrimary: boolean;
  approvalStatus: "APPROVED";
}

export interface SellerListing {
  listingId: string;
  publicSlug: string;
  catalogItemId: string;
  sellerAccountId: string;
  listingPlanId: string;
  listingStatus: ListingStatus;
  priceMinor: string;
  currency: string;
  quantityAvailable: number;
  quantitySold: number;
  conditionNotes: string | null;
  metadata: Record<string, unknown>;
  publishedAt: string | null;
  pausedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  catalogItem?: CatalogItem;
  assets?: CatalogAsset[];
}

export interface CatalogItemsResponse {
  data: CatalogItem[];
  nextCursor: string | null;
  asOf: string;
}

export interface ListingPlansResponse {
  data: ListingPlan[];
  asOf: string;
}

export interface SellerListingsResponse {
  data: SellerListing[];
  nextCursor: string | null;
  asOf: string;
}
