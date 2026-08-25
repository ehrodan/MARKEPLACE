export interface PublicCatalogItem {
  catalogItemId: string;
  publicSlug: string;
  displayName: string;
  description?: string | null;
  gameOrigin: string;
  itemType: string;
  rarity?: string | null;
  craftQuality?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicCatalogAsset {
  catalogAssetId: string;
  catalogItemId: string;
  assetType: string;
  storageUri: string;
  storageProvider: string;
  fileSizeBytes: string;
  mimeType: string;
  widthPixels?: number | null;
  heightPixels?: number | null;
  isPrimary: boolean;
  approvalStatus?: string;
  approvedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface PublicListingPlan {
  listingPlanId: string;
  planCode: string;
  displayName: string;
  exposurePriority: number;
  benefits: Record<string, unknown>;
}

export interface PublicSellerSummary {
  sellerAccountId: string;
  displayName: string;
}

export interface PublicListing {
  listingId: string;
  publicSlug: string;
  catalogItemId: string;
  sellerAccountId: string;
  listingPlanId: string;
  listingStatus: string;
  priceMinor: string;
  currency: string;
  quantityAvailable: number;
  quantitySold: number;
  conditionNotes?: string | null;
  metadata?: Record<string, unknown>;
  publishedAt?: string | null;
  pausedAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  catalogItem?: PublicCatalogItem | null;
  assets?: PublicCatalogAsset[];
  listingPlan?: PublicListingPlan | null;
  seller?: PublicSellerSummary | null;
}

export interface PublicListingPage {
  data: PublicListing[];
  nextCursor: string | null;
  asOf?: string;
}

export interface PublicCatalogItemPage {
  data: PublicCatalogItem[];
  nextCursor: string | null;
}
