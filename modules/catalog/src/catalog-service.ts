import { and, asc, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { appendAuditEvent } from "@midas/administration-audit";
import type { MidasDatabase } from "@midas/database";
import { withSerializableTransaction } from "@midas/database";
import { appendOutboxEvent } from "@midas/eventing";
import {
  AppProblem,
  createUuidV7,
  uuidV7Schema,
  type ActorContext,
} from "@midas/kernel";
import { sellerAccounts } from "@midas/sellers";
import { assertActiveSellerMembership, assertPlatformPermission } from "./authorization.js";
import { isSafeCatalogAssetUri } from "./asset-policy.js";
import {
  catalogAssets,
  catalogItems,
  listings,
  listingPlans,
  listingRevisions,
  listingCommercialSnapshots,
} from "./schema.js";

export type CatalogItemRow = typeof catalogItems.$inferSelect;
export type CatalogAssetRow = typeof catalogAssets.$inferSelect;
export type ListingPlanRow = typeof listingPlans.$inferSelect;
export type ListingRow = typeof listings.$inferSelect;

export type ListingStatus =
  | "DRAFT"
  | "REVIEW"
  | "PUBLISHED"
  | "PAUSED"
  | "SOLD"
  | "TOMBSTONE";

export type ListingView = ListingRow & {
  catalogItem: CatalogItemRow;
  assets: CatalogAssetRow[];
  listingPlan: ListingPlanRow;
  seller: {
    sellerAccountId: string;
    displayName: string;
  };
};

export type CatalogPage<T> = {
  data: T[];
  nextCursor: string | null;
  asOf: Date;
};

export type CreateCatalogItemInput = {
  publicSlug: string;
  displayName: string;
  description?: string | undefined;
  gameOrigin: string;
  itemType: "WEAPON" | "SKIN" | "STICKER" | "KEY" | "CASE" | "OTHER";
  rarity?: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC" | "CONTRABAND" | undefined;
  craftQuality?: "FACTORY_NEW" | "MINIMAL_WEAR" | "FIELD_TESTED" | "WELL_WORN" | "BATTLE_SCARRED" | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type CreateListingInput = {
  publicSlug: string;
  catalogItemId: string;
  sellerAccountId: string;
  listingPlanId: string;
  priceMinor: bigint;
  currency: string;
  quantityAvailable?: number | undefined;
  conditionNotes?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type UpdateListingInput = {
  listingId: string;
  priceMinor?: bigint | undefined;
  quantityAvailable?: number | undefined;
  conditionNotes?: string | undefined;
  changeReason?: string | undefined;
};

export class CatalogService {
  constructor(private readonly db: MidasDatabase) {}

  async createCatalogItem(
    input: CreateCatalogItemInput,
    actor: ActorContext,
  ): Promise<CatalogItemRow> {
    const catalogItemId = createUuidV7();
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      await assertPlatformPermission(transaction, actor, "catalog.items.manage");

      const [existing] = await transaction
        .select({ catalogItemId: catalogItems.catalogItemId })
        .from(catalogItems)
        .where(eq(catalogItems.publicSlug, input.publicSlug))
        .limit(1);

      if (existing) {
        throw conflict("CATALOG_ITEM_SLUG_ALREADY_EXISTS", "Já existe um item com este slug.");
      }

      await transaction.insert(catalogItems).values({
        catalogItemId,
        publicSlug: input.publicSlug,
        displayName: input.displayName,
        description: input.description ?? null,
        gameOrigin: input.gameOrigin,
        itemType: input.itemType,
        rarity: input.rarity ?? null,
        craftQuality: input.craftQuality ?? null,
        metadata: input.metadata ?? {},
        tombstonedAt: null,
        tombstoneReason: null,
        createdAt: now,
        updatedAt: now,
      });

      await appendOutboxEvent(
        transaction,
        {
          eventType: "catalog.item.created",
          schemaVersion: 1,
          aggregateType: "CatalogItem",
          aggregateId: catalogItemId,
          aggregateVersion: 1,
          occurredAt: now,
          ownerModule: "catalog",
          dataClassification: "PUBLIC",
          payload: {
            catalogItemId,
            publicSlug: input.publicSlug,
            displayName: input.displayName,
            gameOrigin: input.gameOrigin,
            itemType: input.itemType,
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "catalog.item.create",
          resourceType: "CatalogItem",
          resourceId: catalogItemId,
          afterRedacted: {
            publicSlug: input.publicSlug,
            displayName: input.displayName,
            gameOrigin: input.gameOrigin,
            itemType: input.itemType,
          },
          dataClassification: "INTERNAL",
        },
        actor,
      );
    });

    const [created] = await this.db
      .select()
      .from(catalogItems)
      .where(eq(catalogItems.catalogItemId, catalogItemId));

    if (!created) throw notFound("CATALOG_ITEM_NOT_FOUND", "Item criado mas não encontrado.");
    return created;
  }

  async listCatalogItems(
    options: {
      gameOrigin?: string | undefined;
      itemType?: string | undefined;
      limit?: number | undefined;
      cursor?: string | undefined;
    } = {},
  ): Promise<CatalogPage<CatalogItemRow>> {
    const asOf = new Date();
    const limit = options.limit ?? 50;
    const conditions = [isNull(catalogItems.tombstonedAt)];

    if (options.gameOrigin) {
      conditions.push(eq(catalogItems.gameOrigin, options.gameOrigin));
    }

    if (options.itemType) {
      conditions.push(eq(catalogItems.itemType, options.itemType));
    }

    if (options.cursor) {
      conditions.push(gt(catalogItems.catalogItemId, options.cursor));
    }

    const rows = await this.db
      .select()
      .from(catalogItems)
      .where(and(...conditions))
      .orderBy(asc(catalogItems.catalogItemId))
      .limit(limit + 1);

    const hasNext = rows.length > limit;
    const data = hasNext ? rows.slice(0, limit) : rows;
    const lastItem = data.at(-1);
    const nextCursor = hasNext && lastItem ? lastItem.catalogItemId : null;

    return { data, nextCursor, asOf };
  }

  async getCatalogItemBySlug(slug: string): Promise<CatalogItemRow | null> {
    const [row] = await this.db
      .select()
      .from(catalogItems)
      .where(and(eq(catalogItems.publicSlug, slug), isNull(catalogItems.tombstonedAt)));

    return row ?? null;
  }

  async listActiveListingPlans(): Promise<{ data: ListingPlanRow[]; asOf: Date }> {
    const asOf = new Date();
    const data = await this.db
      .select()
      .from(listingPlans)
      .where(
        and(
          eq(listingPlans.isActive, true),
          lte(listingPlans.validFrom, asOf),
          or(isNull(listingPlans.validUntil), gt(listingPlans.validUntil, asOf)),
        ),
      )
      .orderBy(asc(listingPlans.exposurePriority), asc(listingPlans.planCode));
    return { data, asOf };
  }

  async createListing(
    input: CreateListingInput,
    actor: ActorContext,
  ): Promise<ListingView> {
    const listingId = createUuidV7();
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      await assertActiveSellerMembership(transaction, actor, input.sellerAccountId);

      const [item] = await transaction
        .select()
        .from(catalogItems)
        .where(eq(catalogItems.catalogItemId, input.catalogItemId))
        .for("update");

      if (!item || item.tombstonedAt) {
        throw conflict("CATALOG_ITEM_NOT_AVAILABLE", "O item do catálogo não está disponível.");
      }

      const [plan] = await transaction
        .select()
        .from(listingPlans)
        .where(
          and(
            eq(listingPlans.listingPlanId, input.listingPlanId),
            eq(listingPlans.isActive, true),
            lte(listingPlans.validFrom, now),
            or(isNull(listingPlans.validUntil), gt(listingPlans.validUntil, now)),
          ),
        )
        .for("update");

      if (!plan) {
        throw conflict("LISTING_PLAN_NOT_AVAILABLE", "O plano de anúncio não está disponível.");
      }

      const [existing] = await transaction
        .select()
        .from(listings)
        .where(eq(listings.publicSlug, input.publicSlug));

      if (existing) {
        throw conflict("LISTING_SLUG_ALREADY_EXISTS", "Já existe um anúncio com este slug.");
      }

      await transaction.insert(listings).values({
        listingId,
        publicSlug: input.publicSlug,
        catalogItemId: input.catalogItemId,
        sellerAccountId: input.sellerAccountId,
        listingPlanId: input.listingPlanId,
        listingStatus: "DRAFT",
        priceMinor: input.priceMinor,
        currency: input.currency,
        quantityAvailable: input.quantityAvailable ?? 1,
        quantitySold: 0,
        conditionNotes: input.conditionNotes ?? null,
        metadata: input.metadata ?? {},
        publishedAt: null,
        pausedAt: null,
        tombstonedAt: null,
        tombstoneReason: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });

      await transaction.insert(listingCommercialSnapshots).values({
        snapshotId: createUuidV7(),
        listingId,
        listingPlanId: plan.listingPlanId,
        planCode: plan.planCode,
        platformFeeRate: plan.platformFeeRate,
        pspFeeRate: plan.pspFeeRate,
        exposurePriority: plan.exposurePriority,
        priceMinor: input.priceMinor,
        currency: input.currency,
        quantityAvailable: input.quantityAvailable ?? 1,
        benefits: plan.benefits,
        snapshotAt: now,
      });

      await appendOutboxEvent(
        transaction,
        {
          eventType: "catalog.listing.created",
          schemaVersion: 1,
          aggregateType: "Listing",
          aggregateId: listingId,
          aggregateVersion: 1,
          occurredAt: now,
          sellerAccountId: input.sellerAccountId,
          ownerModule: "catalog",
          dataClassification: "PUBLIC",
          payload: {
            listingId,
            catalogItemId: input.catalogItemId,
            sellerAccountId: input.sellerAccountId,
            listingPlanId: input.listingPlanId,
            priceMinor: input.priceMinor.toString(),
            currency: input.currency,
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "catalog.listing.create",
          resourceType: "Listing",
          resourceId: listingId,
          sellerAccountId: input.sellerAccountId,
          afterRedacted: {
            publicSlug: input.publicSlug,
            listingPlanId: input.listingPlanId,
            priceMinor: input.priceMinor.toString(),
            currency: input.currency,
          },
          dataClassification: "INTERNAL",
        },
        actor,
      );
    });

    return this.requireListingViewById(listingId);
  }

  async publishListing(
    listingId: string,
    actor: ActorContext,
  ): Promise<ListingView> {
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      const [listing] = await transaction
        .select()
        .from(listings)
        .where(eq(listings.listingId, listingId))
        .for("update");

      if (!listing) throw notFound("LISTING_NOT_FOUND", "Anúncio não encontrado.");
      await assertActiveSellerMembership(transaction, actor, listing.sellerAccountId);

      if (listing.listingStatus !== "DRAFT" && listing.listingStatus !== "REVIEW") {
        throw conflict("LISTING_NOT_PUBLISHABLE", "Apenas anúncios em rascunho ou revisão podem ser publicados.");
      }

      const [availableItem] = await transaction
        .select({ catalogItemId: catalogItems.catalogItemId })
        .from(catalogItems)
        .where(
          and(
            eq(catalogItems.catalogItemId, listing.catalogItemId),
            isNull(catalogItems.tombstonedAt),
          ),
        )
        .for("update");
      if (!availableItem) {
        throw conflict(
          "CATALOG_ITEM_NOT_AVAILABLE",
          "O item do catálogo não está disponível para publicação.",
        );
      }

      const [activePlan] = await transaction
        .select({ listingPlanId: listingPlans.listingPlanId })
        .from(listingPlans)
        .where(
          and(
            eq(listingPlans.listingPlanId, listing.listingPlanId),
            eq(listingPlans.isActive, true),
            lte(listingPlans.validFrom, now),
            or(isNull(listingPlans.validUntil), gt(listingPlans.validUntil, now)),
          ),
        )
        .for("update");
      if (!activePlan) {
        throw conflict(
          "LISTING_PLAN_NOT_AVAILABLE",
          "O plano do anúncio não está disponível para publicação.",
        );
      }

      await transaction
        .update(listings)
        .set({
          listingStatus: "PUBLISHED",
          publishedAt: now,
          version: listing.version + 1,
          updatedAt: now,
        })
        .where(eq(listings.listingId, listingId));

      await appendOutboxEvent(
        transaction,
        {
          eventType: "catalog.listing.published",
          schemaVersion: 1,
          aggregateType: "Listing",
          aggregateId: listingId,
          aggregateVersion: listing.version + 1,
          occurredAt: now,
          sellerAccountId: listing.sellerAccountId,
          ownerModule: "catalog",
          dataClassification: "PUBLIC",
          payload: {
            listingId,
            publishedAt: now.toISOString(),
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "catalog.listing.publish",
          resourceType: "Listing",
          resourceId: listingId,
          sellerAccountId: listing.sellerAccountId,
          afterRedacted: {
            listingStatus: "PUBLISHED",
            publishedAt: now.toISOString(),
          },
          dataClassification: "INTERNAL",
        },
        actor,
      );
    });

    return this.requireListingViewById(listingId);
  }

  async updateListing(
    input: UpdateListingInput,
    actor: ActorContext,
  ): Promise<ListingView> {
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      const [listing] = await transaction
        .select()
        .from(listings)
        .where(eq(listings.listingId, input.listingId))
        .for("update");

      if (!listing) throw notFound("LISTING_NOT_FOUND", "Anúncio não encontrado.");
      await assertActiveSellerMembership(transaction, actor, listing.sellerAccountId);

      const newPriceMinor = input.priceMinor ?? listing.priceMinor;
      const newQuantityAvailable = input.quantityAvailable ?? listing.quantityAvailable;
      const newConditionNotes = input.conditionNotes ?? listing.conditionNotes;
      const changedByUserId = actor.actorUserId;
      if (!changedByUserId) {
        throw new AppProblem({
          status: 401,
          code: "AUTHENTICATION_REQUIRED",
          title: "Entre para continuar",
          detail: "Uma sessão válida é necessária para editar o anúncio.",
        });
      }

      const [lastRevision] = await transaction
        .select({ revisionNumber: listingRevisions.revisionNumber })
        .from(listingRevisions)
        .where(eq(listingRevisions.listingId, input.listingId))
        .orderBy(desc(listingRevisions.revisionNumber))
        .limit(1);

      const nextRevisionNumber = (lastRevision?.revisionNumber ?? 0) + 1;

      await transaction.insert(listingRevisions).values({
        listingRevisionId: createUuidV7(),
        listingId: input.listingId,
        revisionNumber: nextRevisionNumber,
        priceMinor: newPriceMinor,
        currency: listing.currency,
        quantityAvailable: newQuantityAvailable,
        conditionNotes: newConditionNotes,
        metadata: listing.metadata,
        changedByUserId,
        changeReason: input.changeReason ?? null,
        createdAt: now,
      });

      await transaction
        .update(listings)
        .set({
          priceMinor: newPriceMinor,
          quantityAvailable: newQuantityAvailable,
          conditionNotes: newConditionNotes,
          version: listing.version + 1,
          updatedAt: now,
        })
        .where(eq(listings.listingId, input.listingId));

      await transaction
        .update(listingCommercialSnapshots)
        .set({
          priceMinor: newPriceMinor,
          quantityAvailable: newQuantityAvailable,
          snapshotAt: now,
        })
        .where(eq(listingCommercialSnapshots.listingId, input.listingId));

      await appendOutboxEvent(
        transaction,
        {
          eventType: "catalog.listing.updated",
          schemaVersion: 1,
          aggregateType: "Listing",
          aggregateId: input.listingId,
          aggregateVersion: listing.version + 1,
          occurredAt: now,
          sellerAccountId: listing.sellerAccountId,
          ownerModule: "catalog",
          dataClassification: "PUBLIC",
          payload: {
            listingId: input.listingId,
            priceMinor: newPriceMinor.toString(),
            quantityAvailable: newQuantityAvailable,
            revisionNumber: nextRevisionNumber,
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "catalog.listing.update",
          resourceType: "Listing",
          resourceId: input.listingId,
          sellerAccountId: listing.sellerAccountId,
          afterRedacted: {
            priceMinor: newPriceMinor.toString(),
            quantityAvailable: newQuantityAvailable,
            revisionNumber: nextRevisionNumber,
          },
          dataClassification: "INTERNAL",
        },
        actor,
      );
    });

    return this.requireListingViewById(input.listingId);
  }

  async listPublishedListings(
    options: {
      sellerAccountId?: string | undefined;
      limit?: number | undefined;
      cursor?: string | undefined;
    } = {},
  ): Promise<CatalogPage<ListingView>> {
    const asOf = new Date();
    const limit = options.limit ?? 50;
    const conditions = [
      eq(listings.listingStatus, "PUBLISHED"),
      isNull(listings.tombstonedAt),
    ];

    if (options.sellerAccountId) {
      conditions.push(eq(listings.sellerAccountId, options.sellerAccountId));
    }
    if (options.cursor) conditions.push(gt(listings.listingId, options.cursor));

    const rows = await this.db
      .select()
      .from(listings)
      .where(and(...conditions))
      .orderBy(asc(listings.listingId))
      .limit(limit + 1);

    const hasNext = rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;
    const lastListing = pageRows.at(-1);
    return {
      data: await this.hydrateListings(pageRows, true),
      nextCursor: hasNext && lastListing ? lastListing.listingId : null,
      asOf,
    };
  }

  async getPublishedListingByReference(reference: string): Promise<ListingView | null> {
    const id = uuidV7Schema.safeParse(reference);
    const referenceCondition = id.success
      ? eq(listings.listingId, id.data)
      : eq(listings.publicSlug, reference);
    const [row] = await this.db
      .select()
      .from(listings)
      .where(
        and(
          referenceCondition,
          eq(listings.listingStatus, "PUBLISHED"),
          isNull(listings.tombstonedAt),
        ),
      )
      .limit(1);
    if (!row) return null;
    const hydrated = await this.hydrateListings([row], true);
    return hydrated[0] ?? null;
  }

  async listSellerListings(
    sellerAccountId: string,
    actor: ActorContext,
    options: {
      listingStatus?: ListingStatus | undefined;
      limit?: number | undefined;
      cursor?: string | undefined;
    } = {},
  ): Promise<CatalogPage<ListingView>> {
    await assertActiveSellerMembership(this.db, actor, sellerAccountId);
    const asOf = new Date();
    const limit = options.limit ?? 50;
    const conditions = [eq(listings.sellerAccountId, sellerAccountId)];
    if (options.listingStatus) {
      conditions.push(eq(listings.listingStatus, options.listingStatus));
    }
    if (options.cursor) conditions.push(gt(listings.listingId, options.cursor));

    const rows = await this.db
      .select()
      .from(listings)
      .where(and(...conditions))
      .orderBy(asc(listings.listingId))
      .limit(limit + 1);
    const hasNext = rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;
    const lastListing = pageRows.at(-1);
    return {
      data: await this.hydrateListings(pageRows, false),
      nextCursor: hasNext && lastListing ? lastListing.listingId : null,
      asOf,
    };
  }

  async getSellerListingById(
    listingId: string,
    actor: ActorContext,
  ): Promise<ListingView | null> {
    const [row] = await this.db
      .select()
      .from(listings)
      .where(eq(listings.listingId, listingId))
      .limit(1);
    if (!row) return null;
    await assertActiveSellerMembership(this.db, actor, row.sellerAccountId);
    const hydrated = await this.hydrateListings([row], false);
    return hydrated[0] ?? null;
  }

  private async requireListingViewById(listingId: string): Promise<ListingView> {
    const [listing] = await this.db
      .select()
      .from(listings)
      .where(eq(listings.listingId, listingId))
      .limit(1);
    if (!listing) throw notFound("LISTING_NOT_FOUND", "Anúncio não encontrado.");
    const hydrated = await this.hydrateListings([listing], false);
    const view = hydrated[0];
    if (!view) throw notFound("LISTING_NOT_FOUND", "Anúncio não encontrado.");
    return view;
  }

  private async hydrateListings(rows: ListingRow[], publicOnly: boolean): Promise<ListingView[]> {
    if (rows.length === 0) return [];
    const itemIds = [...new Set(rows.map((row) => row.catalogItemId))];
    const planIds = [...new Set(rows.map((row) => row.listingPlanId))];
    const sellerAccountIds = [...new Set(rows.map((row) => row.sellerAccountId))];

    const [items, assets, plans, sellers] = await Promise.all([
      this.db.select().from(catalogItems).where(inArray(catalogItems.catalogItemId, itemIds)),
      this.db
        .select()
        .from(catalogAssets)
        .where(
          and(
            inArray(catalogAssets.catalogItemId, itemIds),
            eq(catalogAssets.approvalStatus, "APPROVED"),
          ),
        )
        .orderBy(desc(catalogAssets.isPrimary), asc(catalogAssets.createdAt)),
      this.db.select().from(listingPlans).where(inArray(listingPlans.listingPlanId, planIds)),
      this.db
        .select({
          sellerAccountId: sellerAccounts.sellerAccountId,
          displayName: sellerAccounts.displayName,
          sellerAccountStatus: sellerAccounts.sellerAccountStatus,
        })
        .from(sellerAccounts)
        .where(inArray(sellerAccounts.sellerAccountId, sellerAccountIds)),
    ]);

    const itemById = new Map(items.map((item) => [item.catalogItemId, item]));
    const planById = new Map(plans.map((plan) => [plan.listingPlanId, plan]));
    const sellerById = new Map(sellers.map((seller) => [seller.sellerAccountId, seller]));
    const assetsByItemId = new Map<string, CatalogAssetRow[]>();
    for (const asset of assets) {
      if (!isSafeCatalogAssetUri(asset.storageUri)) continue;
      const itemAssets = assetsByItemId.get(asset.catalogItemId) ?? [];
      itemAssets.push(asset);
      assetsByItemId.set(asset.catalogItemId, itemAssets);
    }

    const views: ListingView[] = [];
    for (const listing of rows) {
      const catalogItem = itemById.get(listing.catalogItemId);
      const listingPlan = planById.get(listing.listingPlanId);
      const seller = sellerById.get(listing.sellerAccountId);
      if (publicOnly && (!catalogItem || catalogItem.tombstonedAt)) continue;
      if (publicOnly && seller?.sellerAccountStatus === "SUSPENDED") continue;
      if (!catalogItem || !listingPlan || !seller) {
        throw new AppProblem({
          status: 500,
          code: "CATALOG_RELATION_INCONSISTENT",
          title: "Catálogo inconsistente",
          detail: "O anúncio possui uma relação obrigatória indisponível.",
        });
      }
      views.push({
        ...listing,
        catalogItem,
        assets: assetsByItemId.get(listing.catalogItemId) ?? [],
        listingPlan,
        seller: {
          sellerAccountId: seller.sellerAccountId,
          displayName: seller.displayName,
        },
      });
    }
    return views;
  }
}

function conflict(code: string, detail: string): AppProblem {
  return new AppProblem({
    status: 409,
    code,
    title: "Conflito de negócio",
    detail,
  });
}

function notFound(code: string, detail: string): AppProblem {
  return new AppProblem({
    status: 404,
    code,
    title: "Não encontrado",
    detail,
  });
}
