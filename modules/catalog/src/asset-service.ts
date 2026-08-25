import { and, eq, isNull } from "drizzle-orm";
import { appendAuditEvent } from "@midas/administration-audit";
import type { MidasDatabase } from "@midas/database";
import { withSerializableTransaction } from "@midas/database";
import { appendOutboxEvent } from "@midas/eventing";
import { AppProblem, createUuidV7, type ActorContext } from "@midas/kernel";
import { assertPlatformPermission } from "./authorization.js";
import { isSafeCatalogAssetUri } from "./asset-policy.js";
import { catalogAssets, catalogItems } from "./schema.js";

type AssetRow = typeof catalogAssets.$inferSelect;
const requestedPrimaryMetadataKey = "_midasRequestedPrimary";

export type CreateAssetInput = {
  catalogItemId: string;
  assetType: "POSTER_2D" | "MODEL_3D_GLB" | "MULTI_VIEW" | "SINGLE_VIEW";
  storageUri: string;
  storageProvider: "MINIO" | "S3" | "LOCAL";
  fileSizeBytes: bigint;
  mimeType: string;
  widthPixels?: number | undefined;
  heightPixels?: number | undefined;
  isPrimary?: boolean | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type ApproveAssetInput = {
  catalogAssetId: string;
  decision: "APPROVE" | "REJECT";
  rejectionReason?: string | undefined;
};

export class AssetService {
  constructor(private readonly db: MidasDatabase) {}

  async createAsset(
    input: CreateAssetInput,
    actor: ActorContext,
  ): Promise<AssetRow> {
    if (!isSafeCatalogAssetUri(input.storageUri)) {
      throw new AppProblem({
        status: 422,
        code: "CATALOG_ASSET_URI_INVALID",
        title: "URI de asset inválida",
        detail: "Use uma origem HTTP, HTTPS, S3 ou um caminho local relativo à aplicação.",
      });
    }
    const catalogAssetId = createUuidV7();
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      await assertPlatformPermission(transaction, actor, "catalog.assets.manage");

      const [item] = await transaction
        .select()
        .from(catalogItems)
        .where(eq(catalogItems.catalogItemId, input.catalogItemId))
        .for("update");

      if (!item || item.tombstonedAt) {
        throw conflict("CATALOG_ITEM_NOT_AVAILABLE", "O item do catálogo não está disponível.");
      }

      await transaction.insert(catalogAssets).values({
        catalogAssetId,
        catalogItemId: input.catalogItemId,
        assetType: input.assetType,
        storageUri: input.storageUri,
        storageProvider: input.storageProvider,
        fileSizeBytes: input.fileSizeBytes,
        mimeType: input.mimeType,
        widthPixels: input.widthPixels ?? null,
        heightPixels: input.heightPixels ?? null,
        isPrimary: false,
        approvalStatus: "PENDING",
        approvedByUserId: null,
        approvedAt: null,
        rejectionReason: null,
        metadata: {
          ...(input.metadata ?? {}),
          [requestedPrimaryMetadataKey]: input.isPrimary ?? false,
        },
        createdAt: now,
      });

      await appendOutboxEvent(
        transaction,
        {
          eventType: "catalog.asset.created",
          schemaVersion: 1,
          aggregateType: "CatalogAsset",
          aggregateId: catalogAssetId,
          aggregateVersion: 1,
          occurredAt: now,
          ...(actor.sellerAccountId ? { sellerAccountId: actor.sellerAccountId } : {}),
          ownerModule: "catalog",
          dataClassification: "INTERNAL",
          payload: {
            catalogAssetId,
            catalogItemId: input.catalogItemId,
            assetType: input.assetType,
            storageProvider: input.storageProvider,
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "catalog.asset.create",
          resourceType: "CatalogAsset",
          resourceId: catalogAssetId,
          ...(actor.sellerAccountId ? { sellerAccountId: actor.sellerAccountId } : {}),
          afterRedacted: {
            catalogItemId: input.catalogItemId,
            assetType: input.assetType,
            storageProvider: input.storageProvider,
          },
          dataClassification: "INTERNAL",
        },
        actor,
      );
    });

    const [created] = await this.db
      .select()
      .from(catalogAssets)
      .where(eq(catalogAssets.catalogAssetId, catalogAssetId));

    if (!created) throw notFound("ASSET_NOT_FOUND", "Asset criado mas não encontrado.");
    return created;
  }

  async approveAsset(
    input: ApproveAssetInput,
    actor: ActorContext,
  ): Promise<AssetRow> {
    const rejectionReason = input.rejectionReason?.trim();
    if (input.decision === "REJECT" && !rejectionReason) {
      throw new AppProblem({
        status: 422,
        code: "ASSET_REJECTION_REASON_REQUIRED",
        title: "Motivo obrigatório",
        detail: "Informe um motivo objetivo para rejeitar o asset.",
      });
    }
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      await assertPlatformPermission(transaction, actor, "catalog.assets.review");

      const [asset] = await transaction
        .select()
        .from(catalogAssets)
        .where(eq(catalogAssets.catalogAssetId, input.catalogAssetId))
        .for("update");

      if (!asset) {
        throw conflict("ASSET_NOT_FOUND", "Asset não encontrado.");
      }

      if (asset.approvalStatus !== "PENDING") {
        throw conflict("ASSET_NOT_PENDING", "Apenas assets pendentes podem ser aprovados ou rejeitados.");
      }

      if (input.decision === "APPROVE" && !isSafeCatalogAssetUri(asset.storageUri)) {
        throw conflict(
          "ASSET_URI_NOT_PUBLISHABLE",
          "O asset não pode ser aprovado porque sua URI de armazenamento não é segura.",
        );
      }

      const newStatus = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const makePrimary = input.decision === "APPROVE"
        && (asset.isPrimary || requestedPrimary(asset.metadata));

      if (makePrimary) {
        await transaction
          .update(catalogAssets)
          .set({ isPrimary: false })
          .where(
            and(
              eq(catalogAssets.catalogItemId, asset.catalogItemId),
              eq(catalogAssets.isPrimary, true),
            ),
          );
      }

      await transaction
        .update(catalogAssets)
        .set({
          approvalStatus: newStatus,
          approvedByUserId: actor.actorUserId ?? null,
          approvedAt: now,
          rejectionReason: input.decision === "REJECT" ? rejectionReason : null,
          isPrimary: makePrimary,
          metadata: withoutRequestedPrimary(asset.metadata),
        })
        .where(eq(catalogAssets.catalogAssetId, input.catalogAssetId));

      await appendOutboxEvent(
        transaction,
        {
          eventType: "catalog.asset.decided",
          schemaVersion: 1,
          aggregateType: "CatalogAsset",
          aggregateId: input.catalogAssetId,
          aggregateVersion: 2,
          occurredAt: now,
          ownerModule: "catalog",
          dataClassification: "INTERNAL",
          payload: {
            catalogAssetId: input.catalogAssetId,
            decision: input.decision,
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "catalog.asset.decide",
          resourceType: "CatalogAsset",
          resourceId: input.catalogAssetId,
          afterRedacted: {
            approvalStatus: newStatus,
            decision: input.decision,
          },
          dataClassification: "INTERNAL",
        },
        actor,
      );
    });

    const [updated] = await this.db
      .select()
      .from(catalogAssets)
      .where(eq(catalogAssets.catalogAssetId, input.catalogAssetId));

    if (!updated) throw notFound("ASSET_NOT_FOUND", "Asset atualizado mas não encontrado.");
    return updated;
  }

  async listApprovedAssetsByItem(
    catalogItemId: string,
    options: { limit?: number | undefined } = {},
  ): Promise<AssetRow[]> {
    const [item] = await this.db
      .select({ catalogItemId: catalogItems.catalogItemId })
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.catalogItemId, catalogItemId),
          isNull(catalogItems.tombstonedAt),
        ),
      )
      .limit(1);
    if (!item) return [];

    const rows = await this.db
      .select()
      .from(catalogAssets)
      .where(
        and(
          eq(catalogAssets.catalogItemId, catalogItemId),
          eq(catalogAssets.approvalStatus, "APPROVED"),
        ),
      )
      .limit(options.limit ?? 100);
    return rows.filter((asset) => isSafeCatalogAssetUri(asset.storageUri));
  }

  async listAssetsByItemForAdministration(
    catalogItemId: string,
    actor: ActorContext,
    options: {
      approvalStatus?: "PENDING" | "APPROVED" | "REJECTED" | "QUARANTINED" | undefined;
      limit?: number | undefined;
    } = {},
  ): Promise<AssetRow[]> {
    await assertPlatformPermission(this.db, actor, "catalog.assets.review");
    const conditions = [eq(catalogAssets.catalogItemId, catalogItemId)];

    if (options.approvalStatus) {
      conditions.push(eq(catalogAssets.approvalStatus, options.approvalStatus));
    }

    const rows = await this.db
      .select()
      .from(catalogAssets)
      .where(and(...conditions))
      .limit(options.limit ?? 100);

    return rows;
  }

  async getAssetByIdForAdministration(
    catalogAssetId: string,
    actor: ActorContext,
  ): Promise<AssetRow | null> {
    await assertPlatformPermission(this.db, actor, "catalog.assets.review");
    const [row] = await this.db
      .select()
      .from(catalogAssets)
      .where(eq(catalogAssets.catalogAssetId, catalogAssetId))
      .limit(1);

    return row ?? null;
  }

  async setPrimaryAsset(
    catalogAssetId: string,
    actor: ActorContext,
  ): Promise<AssetRow> {
    const now = new Date();

    await withSerializableTransaction(this.db, async (transaction) => {
      await assertPlatformPermission(transaction, actor, "catalog.assets.manage");

      const [asset] = await transaction
        .select()
        .from(catalogAssets)
        .where(eq(catalogAssets.catalogAssetId, catalogAssetId))
        .for("update");

      if (!asset) {
        throw conflict("ASSET_NOT_FOUND", "Asset não encontrado.");
      }

      if (asset.approvalStatus !== "APPROVED") {
        throw conflict("ASSET_NOT_APPROVED", "Apenas assets aprovados podem ser marcados como primários.");
      }

      await transaction
        .update(catalogAssets)
        .set({ isPrimary: false })
        .where(
          and(
            eq(catalogAssets.catalogItemId, asset.catalogItemId),
            eq(catalogAssets.isPrimary, true),
          ),
        );

      await transaction
        .update(catalogAssets)
        .set({ isPrimary: true })
        .where(eq(catalogAssets.catalogAssetId, catalogAssetId));

      await appendOutboxEvent(
        transaction,
        {
          eventType: "catalog.asset.primary_set",
          schemaVersion: 1,
          aggregateType: "CatalogAsset",
          aggregateId: catalogAssetId,
          aggregateVersion: 3,
          occurredAt: now,
          ownerModule: "catalog",
          dataClassification: "INTERNAL",
          payload: {
            catalogAssetId,
            catalogItemId: asset.catalogItemId,
          },
        },
        actor,
      );

      await appendAuditEvent(
        transaction,
        {
          action: "catalog.asset.set_primary",
          resourceType: "CatalogAsset",
          resourceId: catalogAssetId,
          afterRedacted: {
            isPrimary: true,
          },
          dataClassification: "INTERNAL",
        },
        actor,
      );
    });

    const [updated] = await this.db
      .select()
      .from(catalogAssets)
      .where(eq(catalogAssets.catalogAssetId, catalogAssetId));

    if (!updated) throw notFound("ASSET_NOT_FOUND", "Asset atualizado mas não encontrado.");
    return updated;
  }
}

function requestedPrimary(metadata: unknown): boolean {
  return isMetadataRecord(metadata) && metadata[requestedPrimaryMetadataKey] === true;
}

function withoutRequestedPrimary(metadata: unknown): Record<string, unknown> {
  if (!isMetadataRecord(metadata)) return {};
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => key !== requestedPrimaryMetadataKey),
  );
}

function isMetadataRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
