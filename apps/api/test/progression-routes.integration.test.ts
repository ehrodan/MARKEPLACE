import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, defaultMigrationDirectories, runSqlMigrations } from "@midas/database";
import { IdentityService } from "@midas/identity";
import { createUuidV7, parsePublicId } from "@midas/kernel";
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

type ProgressionResponse = {
  levelAssignment: {
    policyVersion: string;
    currency: string;
    qualifiedLifetimeGmvMinor: string;
    level: string;
    currentLevelMinInclusiveMinor: string;
    nextLevelMinInclusiveMinor: string | null;
    contributionChecksum: string;
  };
  badgeAwards: Array<{
    badgeCode: string;
    definitionVersion: string;
    status: string;
    awardedAt: string;
    sourceEventId: string | null;
    revokedReason: string | null;
  }>;
  rewardAwards: Array<{
    rewardCode: string;
    definitionVersion: string;
    status: string;
    awardedAt: string;
    fulfilledAt: string | null;
  }>;
  asOf: string;
  freshness: string;
};

beforeAll(async () => {
  await runSqlMigrations(database.pool, defaultMigrationDirectories());
  api = buildApi({
    config: loadApiConfig({ NODE_ENV: "test", DATABASE_URL: databaseUrl }),
    database,
    verificationDelivery: new UnavailableVerificationDelivery(),
  });
});

afterAll(async () => {
  await api.close();
  await database.close();
});

describe("GET /v1/seller-accounts/:sellerAccountId/progression", () => {
  it("exige sessão e nega enumeração cross-tenant como 404", async () => {
    const suffix = randomUUID().slice(0, 8);
    const owner = await provisionUser(`progression-owner-${suffix}@example.test`);
    const stranger = await provisionUser(`progression-stranger-${suffix}@example.test`);
    const account = await sellers.createSellerAccount(
      owner.userId,
      { displayName: `Progressao ${suffix}`, accountType: "INDIVIDUAL" },
      { correlationId: randomUUID(), actorUserId: owner.userId, sessionId: owner.sessionId, ipPrefix: "127.0.0.0/24" },
    );

    const anonymous = await api.inject({
      method: "GET",
      url: `/v1/seller-accounts/${account.sellerAccountId}/progression`,
    });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.json()).toMatchObject({ code: "AUTHENTICATION_REQUIRED" });

    const crossTenant = await api.inject({
      method: "GET",
      url: `/v1/seller-accounts/${account.sellerAccountId}/progression`,
      headers: { cookie: stranger.cookie },
    });
    expect(crossTenant.statusCode).toBe(404);
    expect(crossTenant.json()).toMatchObject({ code: "SELLER_ACCOUNT_NOT_FOUND" });
  });

  it("ledger vazio responde L1 com zero qualificado e slots vazios, sem inventar award", async () => {
    const suffix = randomUUID().slice(0, 8);
    const owner = await provisionUser(`progression-empty-${suffix}@example.test`);
    const account = await sellers.createSellerAccount(
      owner.userId,
      { displayName: `Progressao vazia ${suffix}`, accountType: "INDIVIDUAL" },
      { correlationId: randomUUID(), actorUserId: owner.userId, sessionId: owner.sessionId, ipPrefix: "127.0.0.0/24" },
    );

    const response = await api.inject({
      method: "GET",
      url: `/v1/seller-accounts/${account.sellerAccountId}/progression`,
      headers: { cookie: owner.cookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<ProgressionResponse>();
    expect(body.levelAssignment).toMatchObject({
      policyVersion: "account-level-brl.v1",
      currency: "BRL",
      qualifiedLifetimeGmvMinor: "0",
      level: "L1",
      currentLevelMinInclusiveMinor: "0",
      nextLevelMinInclusiveMinor: "10001",
    });
    expect(body.levelAssignment.contributionChecksum).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(body.badgeAwards).toEqual([]);
    expect(body.rewardAwards).toEqual([]);
    expect(body.asOf).toMatch(/Z$/);
    expect(body.freshness).toBe("READY");
  });

  it("replaya contribuições com compensação e serve badge/reward awards com definição versionada", async () => {
    const suffix = randomUUID().slice(0, 8);
    const owner = await provisionUser(`progression-full-${suffix}@example.test`);
    const account = await sellers.createSellerAccount(
      owner.userId,
      { displayName: `Progressao cheia ${suffix}`, accountType: "INDIVIDUAL" },
      { correlationId: randomUUID(), actorUserId: owner.userId, sessionId: owner.sessionId, ipPrefix: "127.0.0.0/24" },
    );
    const rawAccountId = parsePublicId("sellerAccount", account.sellerAccountId);

    // Venda elegível de R$ 600,00 + refund de R$ 100,00 => qualificado 50000
    // centavos, exatamente o teto de L2 (10001..50000) em account-level-brl.v1.
    const saleId = createUuidV7();
    await database.pool.query(
      `insert into progression.progression_contributions
         (contribution_id, subject_kind, subject_ref, source_kind, source_ref,
          amount_minor, currency, occurred_at)
       values ($1, 'SELLER_ACCOUNT', $2, 'ORDER', $3, 60000, 'BRL', '2026-08-01T12:00:00Z')`,
      [saleId, rawAccountId, `order-${suffix}`],
    );
    await database.pool.query(
      `insert into progression.progression_contributions
         (contribution_id, subject_kind, subject_ref, source_kind, source_ref,
          amount_minor, currency, compensates_contribution_id, occurred_at)
       values ($1, 'SELLER_ACCOUNT', $2, 'REFUND', $3, -10000, 'BRL', $4, '2026-08-02T12:00:00Z')`,
      [createUuidV7(), rawAccountId, `refund-${suffix}`, saleId],
    );

    const badgeCode = `PREMIUM_10_COMPLETED_SALES_${suffix}`;
    await database.pool.query(
      `insert into progression.badge_definitions
         (badge_code, display_name, description, policy_version, status)
       values ($1, 'Premium 10', 'Dez vendas premium concluídas', 'premium-badge.v1', 'PUBLISHED')`,
      [badgeCode],
    );
    await database.pool.query(
      `insert into progression.badge_awards
         (badge_award_id, badge_code, subject_kind, subject_ref, awarded_at, evidence)
       values ($1, $2, 'SELLER_ACCOUNT', $3, '2026-08-03T09:00:00Z', $4::jsonb)`,
      [createUuidV7(), badgeCode, rawAccountId, JSON.stringify({ sourceEventId: `evt-${suffix}` })],
    );

    const revokedBadgeCode = `REVOKED_BADGE_${suffix}`;
    await database.pool.query(
      `insert into progression.badge_definitions
         (badge_code, display_name, description, policy_version, status)
       values ($1, 'Insígnia revogada', 'Concedida e revogada com motivo', 'premium-badge.v1', 'PUBLISHED')`,
      [revokedBadgeCode],
    );
    await database.pool.query(
      `insert into progression.badge_awards
         (badge_award_id, badge_code, subject_kind, subject_ref, awarded_at, revoked_at, revoke_reason)
       values ($1, $2, 'SELLER_ACCOUNT', $3, '2026-08-04T09:00:00Z', '2026-08-05T09:00:00Z', 'Fraude confirmada')`,
      [createUuidV7(), revokedBadgeCode, rawAccountId],
    );

    const rewardCode = `FEE_DISCOUNT_${suffix}`;
    await database.pool.query(
      `insert into progression.reward_definitions
         (reward_code, display_name, description, reward_kind, policy_version, status)
       values ($1, 'Desconto de taxa', 'Desconto por marco de nível', 'FEE_DISCOUNT', 'reward.v1', 'PUBLISHED')`,
      [rewardCode],
    );
    await database.pool.query(
      `insert into progression.reward_awards
         (reward_award_id, reward_code, subject_kind, subject_ref, awarded_at, fulfillment_status, fulfilled_at)
       values ($1, $2, 'SELLER_ACCOUNT', $3, '2026-08-06T09:00:00Z', 'FULFILLED', '2026-08-07T09:00:00Z')`,
      [createUuidV7(), rewardCode, rawAccountId],
    );
    await database.pool.query(
      `insert into progression.reward_awards
         (reward_award_id, reward_code, subject_kind, subject_ref, awarded_at, fulfillment_status)
       values ($1, $2, 'SELLER_ACCOUNT', $3, '2026-08-08T09:00:00Z', 'PENDING')`,
      [createUuidV7(), rewardCode, rawAccountId],
    );

    const response = await api.inject({
      method: "GET",
      url: `/v1/seller-accounts/${account.sellerAccountId}/progression`,
      headers: { cookie: owner.cookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<ProgressionResponse>();

    expect(body.levelAssignment).toMatchObject({
      policyVersion: "account-level-brl.v1",
      currency: "BRL",
      qualifiedLifetimeGmvMinor: "50000",
      level: "L2",
      currentLevelMinInclusiveMinor: "10001",
      nextLevelMinInclusiveMinor: "50001",
    });

    expect(body.badgeAwards).toHaveLength(2);
    expect(body.badgeAwards).toContainEqual({
      badgeCode,
      definitionVersion: "premium-badge.v1",
      status: "ACTIVE",
      awardedAt: "2026-08-03T09:00:00.000Z",
      sourceEventId: `evt-${suffix}`,
      revokedReason: null,
    });
    expect(body.badgeAwards).toContainEqual({
      badgeCode: revokedBadgeCode,
      definitionVersion: "premium-badge.v1",
      status: "REVOKED",
      awardedAt: "2026-08-04T09:00:00.000Z",
      sourceEventId: null,
      revokedReason: "Fraude confirmada",
    });

    expect(body.rewardAwards).toHaveLength(2);
    expect(body.rewardAwards).toContainEqual({
      rewardCode,
      definitionVersion: "reward.v1",
      status: "FULFILLED",
      awardedAt: "2026-08-06T09:00:00.000Z",
      fulfilledAt: "2026-08-07T09:00:00.000Z",
    });
    expect(body.rewardAwards).toContainEqual({
      rewardCode,
      definitionVersion: "reward.v1",
      status: "GRANTED",
      awardedAt: "2026-08-08T09:00:00.000Z",
      fulfilledAt: null,
    });
  });

  it("rejeita sellerAccountId fora do formato público como problema de validação", async () => {
    const suffix = randomUUID().slice(0, 8);
    const owner = await provisionUser(`progression-invalid-${suffix}@example.test`);
    const response = await api.inject({
      method: "GET",
      url: "/v1/seller-accounts/not-a-public-id/progression",
      headers: { cookie: owner.cookie },
    });
    expect(response.statusCode).toBe(422);
  });
});

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
