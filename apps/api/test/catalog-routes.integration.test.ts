import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, defaultMigrationDirectories, runSqlMigrations } from "@midas/database";
import { IdentityService } from "@midas/identity";
import { createUuidV7, hashSecretToken, parsePublicId } from "@midas/kernel";
import { SellerService } from "@midas/sellers";
import { UnavailableVerificationDelivery } from "../src/adapters/smtp-verification-delivery.js";
import { buildApi } from "../src/app.js";
import { loadApiConfig } from "../src/config.js";
import { createSessionCookie } from "../src/http/cookies.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("postgresql://")) {
  throw new Error("TEST_DATABASE_URL ou DATABASE_URL PostgreSQL é obrigatório.");
}

const database = createDatabase(databaseUrl, { max: 5 });
const identity = new IdentityService(database.db, {
  sessionTtlSeconds: 3_600,
  verificationTtlSeconds: 3_600,
  authRateLimitAttempts: 100,
  authRateLimitWindowSeconds: 60,
});
const sellers = new SellerService(database.db);
const password = "Senha-Midas-Longa!2026";
let api: ReturnType<typeof buildApi>;
const fixtureSuffixes = new Set<string>();

beforeAll(async () => {
  await runSqlMigrations(database.pool, defaultMigrationDirectories());
  api = buildApi({
    config: loadApiConfig({ NODE_ENV: "test", DATABASE_URL: databaseUrl }),
    database,
    verificationDelivery: new UnavailableVerificationDelivery(),
  });
});

afterAll(async () => {
  try {
    await cleanupPendingFixtures();
  } finally {
    await api.close();
    await database.close();
  }
});

afterEach(async () => {
  await cleanupPendingFixtures();
});

describe("catálogo e listings com PostgreSQL real", () => {
  it("fecha admin por grant, isola tenants e só publica PUBLISHED com assets APPROVED", async () => {
    const suffix = randomUUID().slice(0, 8);
    fixtureSuffixes.add(suffix);
    const admin = await provisionUser(`catalog-admin-${suffix}@example.test`);
    const ownerA = await provisionUser(`catalog-a-${suffix}@example.test`);
    const ownerB = await provisionUser(`catalog-b-${suffix}@example.test`);
    await grantCatalogPlatformRole(admin.userId, suffix);

    const accountA = await sellers.createSellerAccount(
      ownerA.userId,
      { displayName: `Loja A ${suffix}`, accountType: "INDIVIDUAL" },
      actor(ownerA.userId, ownerA.sessionId),
    );
    const accountB = await sellers.createSellerAccount(
      ownerB.userId,
      { displayName: `Loja B ${suffix}`, accountType: "ORGANIZATION" },
      actor(ownerB.userId, ownerB.sessionId),
    );
    const rawAccountAId = parsePublicId("sellerAccount", accountA.sellerAccountId);
    const rawAccountBId = parsePublicId("sellerAccount", accountB.sellerAccountId);

    const deniedCatalogItem = await api.inject({
      method: "POST",
      url: "/v1/admin/catalog/items",
      headers: mutationHeaders(ownerA.cookie),
      payload: catalogItemPayload(`denied-${suffix}`),
    });
    expect(deniedCatalogItem.statusCode).toBe(403);
    expect(deniedCatalogItem.json()).toMatchObject({ code: "PLATFORM_PERMISSION_MISSING" });

    const catalogItemResponse = await api.inject({
      method: "POST",
      url: "/v1/admin/catalog/items",
      headers: mutationHeaders(admin.cookie),
      payload: catalogItemPayload(`ak-47-${suffix}`),
    });
    expect(catalogItemResponse.statusCode).toBe(201);
    const catalogItem = catalogItemResponse.json<{ catalogItemId: string; publicSlug: string }>();
    expect(catalogItem.catalogItemId).toMatch(/^[0-9a-f-]{36}$/);

    const plansResponse = await api.inject({
      method: "GET",
      url: "/v1/catalog/listing-plans",
    });
    expect(plansResponse.statusCode).toBe(200);
    const plans = plansResponse.json<{
      data: Array<{ listingPlanId: string; planCode: string; isActive: boolean }>;
      asOf: string;
    }>();
    expect(plans.data.map((plan) => plan.planCode)).toEqual(["BASIC", "VIP", "PREMIUM"]);
    expect(plans.data.every((plan) => plan.isActive)).toBe(true);
    expect(plans.asOf).toMatch(/Z$/);
    const basicPlan = plans.data.find((plan) => plan.planCode === "BASIC");
    if (!basicPlan) throw new Error("Plano BASIC não foi seedado.");

    const createPayload = {
      publicSlug: `listing-${suffix}`,
      catalogItemId: catalogItem.catalogItemId,
      sellerAccountId: accountA.sellerAccountId,
      listingPlanId: basicPlan.listingPlanId,
      priceMinor: "12500",
      currency: "BRL",
      quantityAvailable: 2,
      conditionNotes: "Factory New",
    };

    const crossTenantCreate = await api.inject({
      method: "POST",
      url: "/v1/listings",
      headers: mutationHeaders(ownerB.cookie),
      payload: { ...createPayload, publicSlug: `cross-${suffix}` },
    });
    expect(crossTenantCreate.statusCode).toBe(404);
    expect(crossTenantCreate.json()).toMatchObject({ code: "SELLER_ACCOUNT_NOT_FOUND" });

    const createdResponse = await api.inject({
      method: "POST",
      url: "/v1/listings",
      headers: mutationHeaders(ownerA.cookie),
      payload: createPayload,
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json<{
      listingId: string;
      publicSlug: string;
      listingStatus: string;
      sellerAccountId: string;
      catalogItem: { catalogItemId: string };
      assets: unknown[];
    }>();
    expect(created).toMatchObject({
      listingStatus: "DRAFT",
      sellerAccountId: accountA.sellerAccountId,
      catalogItem: { catalogItemId: catalogItem.catalogItemId },
      assets: [],
    });

    const draftById = await api.inject({ method: "GET", url: `/v1/listings/${created.listingId}` });
    const draftBySlug = await api.inject({ method: "GET", url: `/v1/listings/${created.publicSlug}` });
    expect(draftById.statusCode).toBe(404);
    expect(draftBySlug.statusCode).toBe(404);

    const publicDraftList = await api.inject({
      method: "GET",
      url: `/v1/listings?sellerAccountId=${encodeURIComponent(accountA.sellerAccountId)}`,
    });
    expect(publicDraftList.statusCode).toBe(200);
    expect(publicDraftList.json()).toMatchObject({ data: [], nextCursor: null });

    const forcedPublicDraftList = await api.inject({
      method: "GET",
      url: `/v1/listings?sellerAccountId=${encodeURIComponent(accountA.sellerAccountId)}&listingStatus=DRAFT`,
    });
    expect(forcedPublicDraftList.statusCode).toBe(200);
    expect(forcedPublicDraftList.json()).toMatchObject({ data: [], nextCursor: null });

    const sellerDraftList = await api.inject({
      method: "GET",
      url: `/v1/seller-accounts/${accountA.sellerAccountId}/listings?listingStatus=DRAFT`,
      headers: { cookie: ownerA.cookie },
    });
    expect(sellerDraftList.statusCode).toBe(200);
    expect(sellerDraftList.json()).toMatchObject({
      data: [{ listingId: created.listingId, listingStatus: "DRAFT" }],
    });

    const crossTenantList = await api.inject({
      method: "GET",
      url: `/v1/seller-accounts/${accountA.sellerAccountId}/listings`,
      headers: { cookie: ownerB.cookie },
    });
    expect(crossTenantList.statusCode).toBe(404);

    const crossTenantUpdate = await api.inject({
      method: "PATCH",
      url: `/v1/listings/${created.listingId}`,
      headers: mutationHeaders(ownerB.cookie),
      payload: { priceMinor: "13000" },
    });
    expect(crossTenantUpdate.statusCode).toBe(404);

    const crossTenantPublish = await api.inject({
      method: "POST",
      url: `/v1/listings/${created.listingId}/publish`,
      headers: mutationHeaders(ownerB.cookie),
    });
    expect(crossTenantPublish.statusCode).toBe(404);

    await database.pool.query(
      `update sellers.seller_memberships
          set membership_status = 'REVOKED', updated_at = clock_timestamp()
        where seller_account_id = $1 and user_id = $2`,
      [rawAccountAId, ownerA.userId],
    );
    try {
      const revokedList = await api.inject({
        method: "GET",
        url: `/v1/seller-accounts/${accountA.sellerAccountId}/listings`,
        headers: { cookie: ownerA.cookie },
      });
      expect(revokedList.statusCode).toBe(404);
      expect(revokedList.json()).toMatchObject({ code: "SELLER_ACCOUNT_NOT_FOUND" });

      const revokedUpdate = await api.inject({
        method: "PATCH",
        url: `/v1/listings/${created.listingId}`,
        headers: mutationHeaders(ownerA.cookie),
        payload: { priceMinor: "13000" },
      });
      expect(revokedUpdate.statusCode).toBe(404);
      expect(revokedUpdate.json()).toMatchObject({ code: "SELLER_ACCOUNT_NOT_FOUND" });

      const revokedPublish = await api.inject({
        method: "POST",
        url: `/v1/listings/${created.listingId}/publish`,
        headers: mutationHeaders(ownerA.cookie),
      });
      expect(revokedPublish.statusCode).toBe(404);
      expect(revokedPublish.json()).toMatchObject({ code: "SELLER_ACCOUNT_NOT_FOUND" });
    } finally {
      await database.pool.query(
        `update sellers.seller_memberships
            set membership_status = 'ACTIVE', updated_at = clock_timestamp()
          where seller_account_id = $1 and user_id = $2`,
        [rawAccountAId, ownerA.userId],
      );
    }

    await database.pool.query(
      `update sellers.seller_accounts
          set seller_account_status = 'SUSPENDED', updated_at = clock_timestamp()
        where seller_account_id = $1`,
      [rawAccountBId],
    );
    try {
      const suspendedCreate = await api.inject({
        method: "POST",
        url: "/v1/listings",
        headers: mutationHeaders(ownerB.cookie),
        payload: {
          ...createPayload,
          publicSlug: `suspended-${suffix}`,
          sellerAccountId: accountB.sellerAccountId,
        },
      });
      expect(suspendedCreate.statusCode).toBe(404);
      expect(suspendedCreate.json()).toMatchObject({ code: "SELLER_ACCOUNT_NOT_FOUND" });
    } finally {
      await database.pool.query(
        `update sellers.seller_accounts
            set seller_account_status = 'ONBOARDING_REQUIRED', updated_at = clock_timestamp()
          where seller_account_id = $1`,
        [rawAccountBId],
      );
    }

    const deniedAsset = await api.inject({
      method: "POST",
      url: "/v1/catalog/assets",
      headers: mutationHeaders(ownerA.cookie),
      payload: assetPayload(catalogItem.catalogItemId),
    });
    expect(deniedAsset.statusCode).toBe(403);

    const unsafeAsset = await api.inject({
      method: "POST",
      url: "/v1/catalog/assets",
      headers: mutationHeaders(admin.cookie),
      payload: {
        ...assetPayload(catalogItem.catalogItemId),
        storageUri: "javascript:alert(1)",
      },
    });
    expect(unsafeAsset.statusCode).toBe(422);

    const assetResponse = await api.inject({
      method: "POST",
      url: "/v1/catalog/assets",
      headers: mutationHeaders(admin.cookie),
      payload: assetPayload(catalogItem.catalogItemId),
    });
    expect(assetResponse.statusCode).toBe(201);
    const asset = assetResponse.json<{
      catalogAssetId: string;
      approvalStatus: string;
      isPrimary: boolean;
    }>();
    expect(asset.approvalStatus).toBe("PENDING");
    expect(asset.isPrimary).toBe(false);

    const deniedDecision = await api.inject({
      method: "POST",
      url: `/v1/admin/catalog/assets/${asset.catalogAssetId}/decide`,
      headers: mutationHeaders(ownerA.cookie),
      payload: { decision: "APPROVE" },
    });
    expect(deniedDecision.statusCode).toBe(403);

    const decisionResponse = await api.inject({
      method: "POST",
      url: `/v1/admin/catalog/assets/${asset.catalogAssetId}/decide`,
      headers: mutationHeaders(admin.cookie),
      payload: { decision: "APPROVE" },
    });
    expect(decisionResponse.statusCode).toBe(200);
    expect(decisionResponse.json()).toMatchObject({
      approvalStatus: "APPROVED",
      isPrimary: true,
    });

    const legacyUnsafeAssetId = createUuidV7();
    await database.pool.query(
      `insert into catalog.catalog_assets
         (catalog_asset_id, catalog_item_id, asset_type, storage_uri, storage_provider,
          file_size_bytes, mime_type, is_primary, approval_status, metadata)
       values ($1, $2, 'POSTER_2D', 'javascript:alert(1)', 'LOCAL', 128,
               'image/webp', false, 'PENDING', '{}'::jsonb)`,
      [legacyUnsafeAssetId, catalogItem.catalogItemId],
    );
    const unsafeDecision = await api.inject({
      method: "POST",
      url: `/v1/admin/catalog/assets/${legacyUnsafeAssetId}/decide`,
      headers: mutationHeaders(admin.cookie),
      payload: { decision: "APPROVE" },
    });
    expect(unsafeDecision.statusCode).toBe(409);
    expect(unsafeDecision.json()).toMatchObject({ code: "ASSET_URI_NOT_PUBLISHABLE" });

    await database.pool.query(
      `update catalog.catalog_assets set approval_status = 'APPROVED' where catalog_asset_id = $1`,
      [legacyUnsafeAssetId],
    );
    const publicAssets = await api.inject({
      method: "GET",
      url: `/v1/catalog/items/${catalogItem.catalogItemId}/assets`,
    });
    expect(publicAssets.statusCode).toBe(200);
    expect(publicAssets.json()).toMatchObject([{ catalogAssetId: asset.catalogAssetId }]);
    expect(publicAssets.json()).toHaveLength(1);

    await database.pool.query(
      `update catalog.catalog_items
          set tombstoned_at = clock_timestamp(), tombstone_reason = 'adversarial-test'
        where catalog_item_id = $1`,
      [catalogItem.catalogItemId],
    );
    try {
      const tombstonedAssets = await api.inject({
        method: "GET",
        url: `/v1/catalog/items/${catalogItem.catalogItemId}/assets`,
      });
      expect(tombstonedAssets.statusCode).toBe(200);
      expect(tombstonedAssets.json()).toEqual([]);

      const tombstonedPublish = await api.inject({
        method: "POST",
        url: `/v1/listings/${created.listingId}/publish`,
        headers: mutationHeaders(ownerA.cookie),
      });
      expect(tombstonedPublish.statusCode).toBe(409);
      expect(tombstonedPublish.json()).toMatchObject({ code: "CATALOG_ITEM_NOT_AVAILABLE" });
    } finally {
      await database.pool.query(
        `update catalog.catalog_items
            set tombstoned_at = null, tombstone_reason = null
          where catalog_item_id = $1`,
        [catalogItem.catalogItemId],
      );
    }

    const publishResponse = await api.inject({
      method: "POST",
      url: `/v1/listings/${created.listingId}/publish`,
      headers: mutationHeaders(ownerA.cookie),
    });
    expect(publishResponse.statusCode).toBe(200);
    expect(publishResponse.json()).toMatchObject({
      listingStatus: "PUBLISHED",
      version: 2,
      assets: [{ catalogAssetId: asset.catalogAssetId }],
    });

    await database.pool.query(
      `update sellers.seller_accounts
          set seller_account_status = 'SUSPENDED', updated_at = clock_timestamp()
        where seller_account_id = $1`,
      [rawAccountAId],
    );
    try {
      const suspendedDetail = await api.inject({
        method: "GET",
        url: `/v1/listings/${created.listingId}`,
      });
      expect(suspendedDetail.statusCode).toBe(404);

      const suspendedPublicList = await api.inject({
        method: "GET",
        url: `/v1/listings?sellerAccountId=${encodeURIComponent(accountA.sellerAccountId)}`,
      });
      expect(suspendedPublicList.statusCode).toBe(200);
      expect(suspendedPublicList.json()).toMatchObject({ data: [] });

      const suspendedSellerList = await api.inject({
        method: "GET",
        url: `/v1/seller-accounts/${accountA.sellerAccountId}/listings`,
        headers: { cookie: ownerA.cookie },
      });
      expect(suspendedSellerList.statusCode).toBe(404);
      expect(suspendedSellerList.json()).toMatchObject({ code: "SELLER_ACCOUNT_NOT_FOUND" });
    } finally {
      await database.pool.query(
        `update sellers.seller_accounts
            set seller_account_status = 'ONBOARDING_REQUIRED', updated_at = clock_timestamp()
          where seller_account_id = $1`,
        [rawAccountAId],
      );
    }

    const publicDetail = await api.inject({
      method: "GET",
      url: `/v1/listings/${created.listingId}`,
    });
    expect(publicDetail.statusCode).toBe(200);
    const publicDetailBody = publicDetail.json<{
      assets: Array<{ catalogAssetId: string; approvalStatus?: string }>;
      [key: string]: unknown;
    }>();
    expect(publicDetailBody).toMatchObject({
      listingId: created.listingId,
      listingStatus: "PUBLISHED",
      sellerAccountId: accountA.sellerAccountId,
      seller: { sellerAccountId: accountA.sellerAccountId, displayName: `Loja A ${suffix}` },
      listingPlan: { planCode: "BASIC" },
      assets: [{ catalogAssetId: asset.catalogAssetId }],
    });
    expect(publicDetailBody.assets[0]).not.toHaveProperty("approvalStatus");

    const publicList = await api.inject({
      method: "GET",
      url: `/v1/listings?sellerAccountId=${encodeURIComponent(accountA.sellerAccountId)}`,
    });
    expect(publicList.statusCode).toBe(200);
    expect(publicList.json()).toMatchObject({
      data: [{ listingId: created.listingId, listingStatus: "PUBLISHED" }],
      nextCursor: null,
    });

    expect(accountB.sellerAccountId).toMatch(/^sac_/);
    const persisted = await database.pool.query<{ outbox_count: number; audit_count: number }>(
      `select
         (select count(*)::integer from eventing.outbox_events where aggregate_id in ($1, $2)) as outbox_count,
         (select count(*)::integer from audit.audit_events where resource_id in ($1, $2)) as audit_count`,
      [created.listingId, asset.catalogAssetId],
    );
    expect(persisted.rows[0]).toMatchObject({ outbox_count: 4, audit_count: 4 });
  });
});

function mutationHeaders(cookie: string) {
  return { cookie, "x-midas-csrf": "1" };
}

function catalogItemPayload(publicSlug: string) {
  return {
    publicSlug,
    displayName: `AK-47 ${publicSlug}`,
    description: "Item de integração",
    gameOrigin: "CS2",
    itemType: "WEAPON",
    rarity: "RARE",
  };
}

function assetPayload(catalogItemId: string) {
  return {
    catalogItemId,
    assetType: "POSTER_2D",
    storageUri: `s3://catalog-test/${catalogItemId}.webp`,
    storageProvider: "S3",
    fileSizeBytes: "1024",
    mimeType: "image/webp",
    widthPixels: 800,
    heightPixels: 600,
    isPrimary: true,
  };
}

async function provisionUser(email: string) {
  const registration = await identity.register(
    {
      email,
      password,
      displayName: email.split("@")[0] ?? email,
      acceptedTermsVersion: "terms-2026-08",
    },
    { correlationId: randomUUID(), ipPrefix: "127.0.0.0/24" },
  );
  if (!registration.verificationToken) throw new Error("Token de verificação ausente.");
  await identity.verifyEmail(registration.verificationToken, {
    correlationId: randomUUID(),
    ipPrefix: "127.0.0.0/24",
  });
  const session = await identity.login(email, password, {
    correlationId: randomUUID(),
    ipPrefix: "127.0.0.0/24",
  });
  const [cookie] = createSessionCookie(session.sessionToken, 3_600, false).split(";", 1);
  if (!cookie) throw new Error("Cookie de sessão ausente.");
  return {
    userId: parsePublicId("user", session.userId),
    sessionId: session.sessionId,
    cookie,
  };
}

async function grantCatalogPlatformRole(userId: string, suffix: string): Promise<void> {
  const roleId = createUuidV7();
  await database.pool.query(
    `insert into iam.roles (role_id, role_code, role_scope, version)
     values ($1, $2, 'PLATFORM', 'v1')`,
    [roleId, `CATALOG_ADMIN_${suffix}`],
  );
  for (const permissionCode of [
    "catalog.items.manage",
    "catalog.assets.manage",
    "catalog.assets.review",
  ]) {
    await database.pool.query(
      `insert into iam.role_permissions (role_id, permission_code) values ($1, $2)`,
      [roleId, permissionCode],
    );
  }
  await database.pool.query(
    `insert into iam.user_role_assignments
       (assignment_id, user_id, role_id, assignment_status, valid_from)
     values ($1, $2, $3, 'ACTIVE', clock_timestamp() - interval '1 second')`,
    [createUuidV7(), userId, roleId],
  );
}

async function cleanupCatalogFixture(suffix: string): Promise<void> {
  const client = await database.pool.connect();
  const emailPattern = `^catalog-(admin|a|b)-${suffix}@example[.]test$`;
  try {
    await client.query("begin");
    const users = await client.query<{ user_id: string; email_normalized: string }>(
      `select user_id, email_normalized from identity.users where email_normalized ~ $1`,
      [emailPattern],
    );
    const userIds = users.rows.map((row) => row.user_id);
    const sellers = await client.query<{
      seller_account_id: string;
      seller_membership_id: string;
    }>(
      `select sm.seller_account_id, sm.seller_membership_id
         from sellers.seller_memberships sm
        where sm.user_id = any($1::uuid[])`,
      [userIds],
    );
    const sellerAccountIds = sellers.rows.map((row) => row.seller_account_id);
    const sellerMembershipIds = sellers.rows.map((row) => row.seller_membership_id);
    const items = await client.query<{ catalog_item_id: string }>(
      `select catalog_item_id from catalog.catalog_items where public_slug = $1`,
      [`ak-47-${suffix}`],
    );
    const itemIds = items.rows.map((row) => row.catalog_item_id);
    const listingRows = await client.query<{ listing_id: string }>(
      `select listing_id from catalog.listings where public_slug in ($1, $2, $3)`,
      [`listing-${suffix}`, `cross-${suffix}`, `suspended-${suffix}`],
    );
    const listingIds = listingRows.rows.map((row) => row.listing_id);
    const assets = await client.query<{ catalog_asset_id: string }>(
      `select catalog_asset_id
         from catalog.catalog_assets
        where catalog_item_id = any($1::uuid[])`,
      [itemIds],
    );
    const assetIds = assets.rows.map((row) => row.catalog_asset_id);
    const sessions = await client.query<{ session_id: string }>(
      `select session_id from identity.sessions where user_id = any($1::uuid[])`,
      [userIds],
    );
    const challenges = await client.query<{ challenge_id: string }>(
      `select challenge_id
         from identity.email_verification_challenges
        where user_id = any($1::uuid[])`,
      [userIds],
    );
    const aggregateIds = [
      ...userIds,
      ...sellerAccountIds,
      ...sellerMembershipIds,
      ...itemIds,
      ...listingIds,
      ...assetIds,
      ...sessions.rows.map((row) => row.session_id),
      ...challenges.rows.map((row) => row.challenge_id),
    ];
    const outbox = await client.query<{ event_id: string }>(
      `select event_id
         from eventing.outbox_events
        where actor_user_id = any($1::uuid[])
           or seller_account_id = any($2::uuid[])
           or aggregate_id = any($3::uuid[])`,
      [userIds, sellerAccountIds, aggregateIds],
    );
    const eventIds = outbox.rows.map((row) => row.event_id);

    await client.query(
      `delete from eventing.inbox_receipts where event_id = any($1::uuid[])`,
      [eventIds],
    );
    await client.query(
      `delete from eventing.outbox_events where event_id = any($1::uuid[])`,
      [eventIds],
    );
    await client.query(
      `delete from catalog.listing_commercial_snapshots where listing_id = any($1::uuid[])`,
      [listingIds],
    );
    await client.query(
      `delete from catalog.listing_revisions where listing_id = any($1::uuid[])`,
      [listingIds],
    );
    await client.query(`delete from catalog.listings where listing_id = any($1::uuid[])`, [listingIds]);
    await client.query(
      `delete from catalog.catalog_assets where catalog_asset_id = any($1::uuid[])`,
      [assetIds],
    );
    await client.query(
      `delete from catalog.catalog_items where catalog_item_id = any($1::uuid[])`,
      [itemIds],
    );
    await client.query(
      `delete from sellers.seller_membership_grants
        where seller_membership_id = any($1::uuid[])`,
      [sellerMembershipIds],
    );
    await client.query(
      `delete from sellers.seller_memberships
        where seller_membership_id = any($1::uuid[])`,
      [sellerMembershipIds],
    );
    await client.query(
      `delete from sellers.seller_accounts where seller_account_id = any($1::uuid[])`,
      [sellerAccountIds],
    );
    const roles = await client.query<{ role_id: string }>(
      `select role_id from iam.roles where role_code = $1`,
      [`CATALOG_ADMIN_${suffix}`],
    );
    const roleIds = roles.rows.map((row) => row.role_id);
    await client.query(
      `delete from iam.user_role_assignments
        where user_id = any($1::uuid[]) or role_id = any($2::uuid[])`,
      [userIds, roleIds],
    );
    await client.query(`delete from iam.role_permissions where role_id = any($1::uuid[])`, [roleIds]);
    await client.query(`delete from iam.roles where role_id = any($1::uuid[])`, [roleIds]);
    await client.query(`delete from identity.sessions where user_id = any($1::uuid[])`, [userIds]);
    await client.query(
      `delete from identity.email_verification_challenges where user_id = any($1::uuid[])`,
      [userIds],
    );
    await client.query(`delete from identity.credentials where user_id = any($1::uuid[])`, [userIds]);
    const rateLimitHashes = users.rows.flatMap((row) => [
      hashSecretToken(`register:127.0.0.0/24:${row.email_normalized}`),
      hashSecretToken(`login:127.0.0.0/24:${row.email_normalized}`),
    ]);
    await client.query(
      `delete from identity.auth_rate_limits where rate_limit_key_hash = any($1::text[])`,
      [rateLimitHashes],
    );
    await client.query(`delete from identity.users where user_id = any($1::uuid[])`, [userIds]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function cleanupPendingFixtures(): Promise<void> {
  for (const suffix of fixtureSuffixes) {
    await cleanupCatalogFixture(suffix);
    fixtureSuffixes.delete(suffix);
  }
}

function actor(userId: string, sessionId: string) {
  return {
    correlationId: randomUUID(),
    actorUserId: userId,
    sessionId,
    ipPrefix: "127.0.0.0/24",
  };
}
