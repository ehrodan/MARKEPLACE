import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { apiProblemSchema, sellerAccountIdSchema } from "@midas/contracts";
import type {
  AssetService,
  CatalogAssetRow,
  CatalogItemRow,
  CatalogService,
  ListingPlanRow,
  ListingView,
} from "@midas/catalog";
import { isSafeCatalogAssetUri } from "@midas/catalog";
import type { AuthenticatedSession } from "@midas/identity";
import { AppProblem, parsePublicId, toPublicId } from "@midas/kernel";
import { actorContext } from "./http/request-context.js";

export type RegisterCatalogRoutesOptions = {
  catalog: CatalogService;
  assets: AssetService;
  requireSession(request: FastifyRequest): Promise<AuthenticatedSession>;
  requireCsrf(request: FastifyRequest): void;
};

const createCatalogItemBodySchema = z.object({
  publicSlug: z.string().min(1).max(200),
  displayName: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  gameOrigin: z.string().min(1).max(200),
  itemType: z.enum(["WEAPON", "SKIN", "STICKER", "KEY", "CASE", "OTHER"]),
  rarity: z.enum(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC", "CONTRABAND"]).optional(),
  craftQuality: z.enum(["FACTORY_NEW", "MINIMAL_WEAR", "FIELD_TESTED", "WELL_WORN", "BATTLE_SCARRED"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const createListingBodySchema = z.object({
  publicSlug: z.string().min(1).max(200),
  catalogItemId: z.uuid(),
  sellerAccountId: sellerAccountIdSchema,
  listingPlanId: z.uuid(),
  priceMinor: z.string().regex(/^\d+$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  quantityAvailable: z.number().int().min(0).optional(),
  conditionNotes: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateListingBodySchema = z.object({
  priceMinor: z.string().regex(/^\d+$/).optional(),
  quantityAvailable: z.number().int().min(0).optional(),
  conditionNotes: z.string().max(5000).optional(),
  changeReason: z.string().max(1000).optional(),
});

const createAssetBodySchema = z.object({
  catalogItemId: z.uuid(),
  assetType: z.enum(["POSTER_2D", "MODEL_3D_GLB", "MULTI_VIEW", "SINGLE_VIEW"]),
  storageUri: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .refine(isSafeCatalogAssetUri, "URI de armazenamento não permitida"),
  storageProvider: z.enum(["MINIO", "S3", "LOCAL"]),
  fileSizeBytes: z.string().regex(/^\d+$/),
  mimeType: z.string().min(1).max(200),
  widthPixels: z.number().int().positive().optional(),
  heightPixels: z.number().int().positive().optional(),
  isPrimary: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const approveAssetBodySchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  rejectionReason: z.string().trim().min(1).max(2000).optional(),
}).superRefine((input, context) => {
  if (input.decision === "REJECT" && !input.rejectionReason) {
    context.addIssue({
      code: "custom",
      path: ["rejectionReason"],
      message: "Informe o motivo da rejeição",
    });
  }
});

function serializeCatalogItem(item: CatalogItemRow) {
  return {
    catalogItemId: item.catalogItemId,
    publicSlug: item.publicSlug,
    displayName: item.displayName,
    description: item.description,
    gameOrigin: item.gameOrigin,
    itemType: item.itemType,
    rarity: item.rarity,
    craftQuality: item.craftQuality,
    metadata: item.metadata,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function serializeListingPlan(plan: ListingPlanRow) {
  return {
    listingPlanId: plan.listingPlanId,
    planCode: plan.planCode,
    displayName: plan.displayName,
    platformFeeRate: plan.platformFeeRate,
    pspFeeRate: plan.pspFeeRate,
    exposurePriority: plan.exposurePriority,
    queuePriority: plan.queuePriority,
    benefits: plan.benefits,
    isActive: plan.isActive,
    validFrom: plan.validFrom.toISOString(),
    validUntil: plan.validUntil?.toISOString() ?? null,
  };
}

function serializeListing(listing: ListingView) {
  return {
    listingId: listing.listingId,
    publicSlug: listing.publicSlug,
    catalogItemId: listing.catalogItemId,
    sellerAccountId: toPublicId("sellerAccount", listing.sellerAccountId),
    listingPlanId: listing.listingPlanId,
    listingStatus: listing.listingStatus,
    priceMinor: listing.priceMinor.toString(),
    currency: listing.currency,
    quantityAvailable: listing.quantityAvailable,
    quantitySold: listing.quantitySold,
    conditionNotes: listing.conditionNotes,
    metadata: listing.metadata,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    pausedAt: listing.pausedAt?.toISOString() ?? null,
    version: listing.version,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    catalogItem: serializeCatalogItem(listing.catalogItem),
    assets: listing.assets.map(serializePublicAsset),
    listingPlan: serializeListingPlan(listing.listingPlan),
    seller: {
      sellerAccountId: toPublicId("sellerAccount", listing.seller.sellerAccountId),
      displayName: listing.seller.displayName,
    },
  };
}

function serializePublicAsset(asset: CatalogAssetRow) {
  return {
    catalogAssetId: asset.catalogAssetId,
    catalogItemId: asset.catalogItemId,
    assetType: asset.assetType,
    storageUri: asset.storageUri,
    storageProvider: asset.storageProvider,
    fileSizeBytes: asset.fileSizeBytes.toString(),
    mimeType: asset.mimeType,
    widthPixels: asset.widthPixels,
    heightPixels: asset.heightPixels,
    isPrimary: asset.isPrimary,
    metadata: asset.metadata,
    createdAt: asset.createdAt.toISOString(),
  };
}

function serializeAsset(asset: CatalogAssetRow) {
  return {
    catalogAssetId: asset.catalogAssetId,
    catalogItemId: asset.catalogItemId,
    assetType: asset.assetType,
    storageUri: asset.storageUri,
    storageProvider: asset.storageProvider,
    fileSizeBytes: asset.fileSizeBytes.toString(),
    mimeType: asset.mimeType,
    widthPixels: asset.widthPixels,
    heightPixels: asset.heightPixels,
    isPrimary: asset.isPrimary,
    approvalStatus: asset.approvalStatus,
    approvedByUserId: asset.approvedByUserId
      ? toPublicId("user", asset.approvedByUserId)
      : null,
    approvedAt: asset.approvedAt?.toISOString() ?? null,
    rejectionReason: asset.rejectionReason,
    metadata: asset.metadata,
    createdAt: asset.createdAt.toISOString(),
  };
}

export function registerCatalogRoutes(
  app: FastifyInstance,
  options: RegisterCatalogRoutesOptions,
): void {
  // ===== CATÁLOGO PÚBLICO (sem autenticação) =====

  app.get(
    "/v1/catalog/items",
    {
      schema: {
        operationId: "listCatalogItems",
        querystring: z.object({
          gameOrigin: z.string().optional(),
          itemType: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          cursor: z.uuid().optional(),
        }),
        response: {
          200: z.object({
            data: z.array(z.any()),
            nextCursor: z.string().nullable(),
            asOf: z.iso.datetime(),
          }),
        },
      },
    },
    async (request) => {
      const query = request.query as {
        gameOrigin?: string | undefined;
        itemType?: string | undefined;
        limit: number;
        cursor?: string | undefined;
      };
      const result = await options.catalog.listCatalogItems({
        gameOrigin: query.gameOrigin,
        itemType: query.itemType,
        limit: query.limit,
        cursor: query.cursor,
      });
      return {
        data: result.data.map(serializeCatalogItem),
        nextCursor: result.nextCursor,
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.get(
    "/v1/catalog/listing-plans",
    {
      schema: {
        operationId: "listActiveListingPlans",
        response: {
          200: z.object({
            data: z.array(z.any()),
            asOf: z.iso.datetime(),
          }),
        },
      },
    },
    async () => {
      const result = await options.catalog.listActiveListingPlans();
      return {
        data: result.data.map(serializeListingPlan),
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.get(
    "/v1/catalog/items/:slug",
    {
      schema: {
        operationId: "getCatalogItemBySlug",
        params: z.object({ slug: z.string().min(1) }),
        response: { 200: z.any(), 404: apiProblemSchema },
      },
    },
    async (request) => {
      const params = request.params as { slug: string };
      const item = await options.catalog.getCatalogItemBySlug(params.slug);
      if (!item) {
        throw new AppProblem({
          status: 404,
          code: "CATALOG_ITEM_NOT_FOUND",
          title: "Item não encontrado",
          detail: "Nenhum item do catálogo com este slug.",
        });
      }
      return serializeCatalogItem(item);
    },
  );

  app.get(
    "/v1/listings",
    {
      schema: {
        operationId: "listListings",
        querystring: z.object({
          sellerAccountId: sellerAccountIdSchema.optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          cursor: z.uuid().optional(),
        }),
        response: {
          200: z.object({
            data: z.array(z.any()),
            nextCursor: z.string().nullable(),
            asOf: z.iso.datetime(),
          }),
        },
      },
    },
    async (request) => {
      const query = request.query as {
        sellerAccountId?: string | undefined;
        limit: number;
        cursor?: string | undefined;
      };
      const result = await options.catalog.listPublishedListings({
        sellerAccountId: query.sellerAccountId
          ? parsePublicId("sellerAccount", query.sellerAccountId)
          : undefined,
        limit: query.limit,
        cursor: query.cursor,
      });
      return {
        data: result.data.map(serializeListing),
        nextCursor: result.nextCursor,
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.get(
    "/v1/listings/:listingRef",
    {
      schema: {
        operationId: "getPublishedListing",
        params: z.object({ listingRef: z.string().min(1).max(200) }),
        response: { 200: z.any(), 404: apiProblemSchema },
      },
    },
    async (request) => {
      const params = request.params as { listingRef: string };
      const listing = await options.catalog.getPublishedListingByReference(params.listingRef);
      if (!listing) {
        throw new AppProblem({
          status: 404,
          code: "LISTING_NOT_FOUND",
          title: "Anúncio não encontrado",
          detail: "Nenhum anúncio com este slug.",
        });
      }
      return serializeListing(listing);
    },
  );

  // ===== CATÁLOGO ADMIN (requer sessão + grants) =====

  app.post(
    "/v1/admin/catalog/items",
    {
      schema: {
        operationId: "createCatalogItem",
        body: createCatalogItemBodySchema,
        response: { 201: z.any(), 401: apiProblemSchema, 403: apiProblemSchema, 409: apiProblemSchema },
      },
    },
    async (request, reply) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const body = createCatalogItemBodySchema.parse(request.body);
      const result = await options.catalog.createCatalogItem(
        {
          publicSlug: body.publicSlug,
          displayName: body.displayName,
          description: body.description,
          gameOrigin: body.gameOrigin,
          itemType: body.itemType,
          rarity: body.rarity,
          craftQuality: body.craftQuality,
          metadata: body.metadata,
        },
        actorContext(request, session),
      );
      return reply.status(201).send(serializeCatalogItem(result));
    },
  );

  // ===== LISTINGS DO SELLER (requer sessão) =====

  app.get(
    "/v1/seller-accounts/:sellerAccountId/listings",
    {
      schema: {
        operationId: "listSellerListings",
        params: z.object({ sellerAccountId: sellerAccountIdSchema }),
        querystring: z.object({
          listingStatus: z
            .enum(["DRAFT", "REVIEW", "PUBLISHED", "PAUSED", "SOLD", "TOMBSTONE"])
            .optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          cursor: z.uuid().optional(),
        }),
        response: {
          200: z.object({
            data: z.array(z.any()),
            nextCursor: z.string().nullable(),
            asOf: z.iso.datetime(),
          }),
          401: apiProblemSchema,
          404: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const params = request.params as { sellerAccountId: string };
      const query = request.query as {
        listingStatus?: "DRAFT" | "REVIEW" | "PUBLISHED" | "PAUSED" | "SOLD" | "TOMBSTONE";
        limit: number;
        cursor?: string;
      };
      const result = await options.catalog.listSellerListings(
        parsePublicId("sellerAccount", params.sellerAccountId),
        actorContext(request, session),
        {
          listingStatus: query.listingStatus,
          limit: query.limit,
          cursor: query.cursor,
        },
      );
      return {
        data: result.data.map(serializeListing),
        nextCursor: result.nextCursor,
        asOf: result.asOf.toISOString(),
      };
    },
  );

  app.post(
    "/v1/listings",
    {
      schema: {
        operationId: "createListing",
        body: createListingBodySchema,
        response: { 201: z.any(), 401: apiProblemSchema, 403: apiProblemSchema, 409: apiProblemSchema },
      },
    },
    async (request, reply) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const body = createListingBodySchema.parse(request.body);
      const result = await options.catalog.createListing(
        {
          publicSlug: body.publicSlug,
          catalogItemId: body.catalogItemId,
          sellerAccountId: parsePublicId("sellerAccount", body.sellerAccountId),
          listingPlanId: body.listingPlanId,
          priceMinor: BigInt(body.priceMinor),
          currency: body.currency,
          quantityAvailable: body.quantityAvailable,
          conditionNotes: body.conditionNotes,
          metadata: body.metadata,
        },
        actorContext(request, session),
      );
      return reply.status(201).send(serializeListing(result));
    },
  );

  app.post(
    "/v1/listings/:listingId/publish",
    {
      schema: {
        operationId: "publishListing",
        params: z.object({ listingId: z.uuid() }),
        response: { 200: z.any(), 401: apiProblemSchema, 403: apiProblemSchema, 404: apiProblemSchema, 409: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = request.params as { listingId: string };
      const result = await options.catalog.publishListing(
        params.listingId,
        actorContext(request, session),
      );
      return serializeListing(result);
    },
  );

  app.patch(
    "/v1/listings/:listingId",
    {
      schema: {
        operationId: "updateListing",
        params: z.object({ listingId: z.uuid() }),
        body: updateListingBodySchema,
        response: { 200: z.any(), 401: apiProblemSchema, 403: apiProblemSchema, 404: apiProblemSchema, 409: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = request.params as { listingId: string };
      const body = updateListingBodySchema.parse(request.body);
      const result = await options.catalog.updateListing(
        {
          listingId: params.listingId,
          priceMinor: body.priceMinor ? BigInt(body.priceMinor) : undefined,
          quantityAvailable: body.quantityAvailable,
          conditionNotes: body.conditionNotes,
          changeReason: body.changeReason,
        },
        actorContext(request, session),
      );
      return serializeListing(result);
    },
  );

  // ===== ASSETS (requer sessão) =====

  app.post(
    "/v1/catalog/assets",
    {
      schema: {
        operationId: "createAsset",
        body: createAssetBodySchema,
        response: { 201: z.any(), 401: apiProblemSchema, 403: apiProblemSchema, 409: apiProblemSchema },
      },
    },
    async (request, reply) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const body = createAssetBodySchema.parse(request.body);
      const result = await options.assets.createAsset(
        {
          catalogItemId: body.catalogItemId,
          assetType: body.assetType,
          storageUri: body.storageUri,
          storageProvider: body.storageProvider,
          fileSizeBytes: BigInt(body.fileSizeBytes),
          mimeType: body.mimeType,
          widthPixels: body.widthPixels,
          heightPixels: body.heightPixels,
          isPrimary: body.isPrimary,
          metadata: body.metadata,
        },
        actorContext(request, session),
      );
      return reply.status(201).send(serializeAsset(result));
    },
  );

  app.post(
    "/v1/admin/catalog/assets/:catalogAssetId/decide",
    {
      schema: {
        operationId: "approveAsset",
        params: z.object({ catalogAssetId: z.uuid() }),
        body: approveAssetBodySchema,
        response: { 200: z.any(), 401: apiProblemSchema, 403: apiProblemSchema, 404: apiProblemSchema, 409: apiProblemSchema },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      options.requireCsrf(request);
      const params = request.params as { catalogAssetId: string };
      const body = approveAssetBodySchema.parse(request.body);
      const result = await options.assets.approveAsset(
        {
          catalogAssetId: params.catalogAssetId,
          decision: body.decision,
          rejectionReason: body.rejectionReason,
        },
        actorContext(request, session),
      );
      return serializeAsset(result);
    },
  );

  app.get(
    "/v1/catalog/items/:catalogItemId/assets",
    {
      schema: {
        operationId: "listAssetsByItem",
        params: z.object({ catalogItemId: z.uuid() }),
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(200).default(100),
        }),
        response: { 200: z.array(z.any()) },
      },
    },
    async (request) => {
      const params = request.params as { catalogItemId: string };
      const query = request.query as { limit: number };
      const result = await options.assets.listApprovedAssetsByItem(
        params.catalogItemId,
        {
        limit: query.limit,
        },
      );
      return result.map(serializePublicAsset);
    },
  );

  app.get(
    "/v1/admin/catalog/items/:catalogItemId/assets",
    {
      schema: {
        operationId: "listCatalogAssetsForAdministration",
        params: z.object({ catalogItemId: z.uuid() }),
        querystring: z.object({
          approvalStatus: z
            .enum(["PENDING", "APPROVED", "REJECTED", "QUARANTINED"])
            .optional(),
          limit: z.coerce.number().int().min(1).max(200).default(100),
        }),
        response: {
          200: z.array(z.any()),
          401: apiProblemSchema,
          403: apiProblemSchema,
        },
      },
    },
    async (request) => {
      const session = await options.requireSession(request);
      const params = request.params as { catalogItemId: string };
      const query = request.query as {
        approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | "QUARANTINED";
        limit: number;
      };
      const result = await options.assets.listAssetsByItemForAdministration(
        params.catalogItemId,
        actorContext(request, session),
        { approvalStatus: query.approvalStatus, limit: query.limit },
      );
      return result.map(serializeAsset);
    },
  );
}
