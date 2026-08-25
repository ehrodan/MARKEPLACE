import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDatabase,
  defaultMigrationDirectories,
  runSqlMigrations,
  withSerializableTransaction,
} from "@midas/database";
import { IdentityService } from "@midas/identity";
import { SellerService } from "@midas/sellers";
import { createPublicId, parsePublicId } from "@midas/kernel";
import { appendOutboxEvent, recordInboxOnce } from "@midas/eventing";
import { buildApi } from "../src/app.js";
import { loadApiConfig } from "../src/config.js";
import { UnavailableVerificationDelivery } from "../src/adapters/smtp-verification-delivery.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!testDatabaseUrl?.startsWith("postgresql://")) {
  throw new Error("TEST_DATABASE_URL ou DATABASE_URL PostgreSQL é obrigatório.");
}

function requireVerificationToken(result: { verificationToken?: string }): string {
  if (!result.verificationToken) throw new Error("Cadastro não retornou token de verificação.");
  return result.verificationToken;
}

const database = createDatabase(testDatabaseUrl, { max: 5 });
const identity = new IdentityService(database.db, {
  sessionTtlSeconds: 3_600,
  verificationTtlSeconds: 3_600,
  authRateLimitAttempts: 50,
  authRateLimitWindowSeconds: 60,
});
const sellers = new SellerService(database.db);
const actor = { correlationId: randomUUID(), ipPrefix: "127.0.0.0/24" };

beforeAll(async () => {
  await runSqlMigrations(database.pool, defaultMigrationDirectories());
});

afterAll(async () => {
  await database.close();
});

describe("account tenant bootstrap com PostgreSQL real", () => {
  it("responde rota ausente como Problem 404, sem mascarar como erro interno", async () => {
    const api = buildApi({
      config: loadApiConfig({
        NODE_ENV: "test",
        DATABASE_URL: testDatabaseUrl,
      }),
      database,
      verificationDelivery: new UnavailableVerificationDelivery(),
    });
    const response = await api.inject({ method: "GET", url: "/v1/route-that-does-not-exist" });
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json()).toMatchObject({ status: 404, code: "ROUTE_NOT_FOUND" });
    await api.close();
  });

  it("registra, verifica, autentica e cria SellerAccount com OWNER atômico", async () => {
    const suffix = createPublicId("event").slice(4, 16);
    const registration = await identity.register(
      {
        email: `owner-${suffix}@example.test`,
        password: "Senha-Midas-Longa!2026",
        displayName: "Owner Integration",
        acceptedTermsVersion: "terms-2026-08",
      },
      actor,
    );
    expect(registration.verificationToken).toBeTruthy();
    await identity.verifyEmail(requireVerificationToken(registration), actor);
    const session = await identity.login(
      `owner-${suffix}@example.test`,
      "Senha-Midas-Longa!2026",
      actor,
    );
    const userId = parsePublicId("user", session.userId);
    const created = await sellers.createSellerAccount(
      userId,
      { displayName: "Loja Integration", accountType: "INDIVIDUAL" },
      { ...actor, actorUserId: userId, sessionId: session.sessionId },
    );
    const accounts = await sellers.listCurrentUserSellerAccounts(userId);
    expect(accounts.data).toContainEqual(created);
    const members = await sellers.listSellerAccountMembers(
      userId,
      parsePublicId("sellerAccount", created.sellerAccountId),
    );
    expect(members.data).toHaveLength(1);
    expect(members.data[0]).toMatchObject({ membershipRole: "OWNER", userId: session.userId });

    const persisted = await database.pool.query<{ outbox_count: number; audit_count: number }>(
      `select
         (select count(*)::integer from eventing.outbox_events where correlation_id = $1) as outbox_count,
         (select count(*)::integer from audit.audit_events where correlation_id = $1) as audit_count`,
      [actor.correlationId],
    );
    const persistedCounts = persisted.rows[0];
    expect(persistedCounts).toBeDefined();
    expect(persistedCounts?.outbox_count).toBeGreaterThanOrEqual(5);
    expect(persistedCounts?.audit_count).toBeGreaterThanOrEqual(4);
  });

  it("nega enumeração cross-tenant", async () => {
    const suffix = createPublicId("event").slice(4, 16);
    const first = await provisionVerifiedUser(`a-${suffix}@example.test`);
    const second = await provisionVerifiedUser(`b-${suffix}@example.test`);
    const secondAccount = await sellers.createSellerAccount(
      second.userId,
      { displayName: "Tenant B", accountType: "ORGANIZATION" },
      { ...actor, actorUserId: second.userId, sessionId: second.sessionId },
    );
    await expect(
      sellers.listSellerAccountMembers(
        first.userId,
        parsePublicId("sellerAccount", secondAccount.sellerAccountId),
      ),
    ).rejects.toMatchObject({ status: 404, code: "SELLER_ACCOUNT_NOT_FOUND" });
  });

  it("não expõe SellerAccount quando a membership já expirou", async () => {
    const suffix = createPublicId("event").slice(4, 16);
    const owner = await provisionVerifiedUser(`expired-${suffix}@example.test`);
    const account = await sellers.createSellerAccount(
      owner.userId,
      { displayName: "Tenant expirado", accountType: "INDIVIDUAL" },
      { ...actor, actorUserId: owner.userId, sessionId: owner.sessionId },
    );
    await database.pool.query(
      `update sellers.seller_memberships
          set valid_from = clock_timestamp() - interval '2 seconds',
              valid_until = clock_timestamp() - interval '1 second'
        where seller_account_id = $1 and user_id = $2`,
      [parsePublicId("sellerAccount", account.sellerAccountId), owner.userId],
    );
    const accounts = await sellers.listCurrentUserSellerAccounts(owner.userId);
    expect(accounts.data).not.toContainEqual(account);
  });

  it("re-registro pendente invalida token e senha anteriores atomicamente", async () => {
    const suffix = createPublicId("event").slice(4, 16);
    const email = `reregister-${suffix}@example.test`;
    const first = await identity.register(
      {
        email,
        password: "Senha-Antiga-Longa!2026",
        displayName: "Cadastro anterior",
        acceptedTermsVersion: "terms-2026-07",
      },
      { ...actor, correlationId: randomUUID() },
    );
    const second = await identity.register(
      {
        email,
        password: "Senha-Nova-Segura!2026",
        displayName: "Cadastro legítimo",
        acceptedTermsVersion: "terms-2026-08",
      },
      { ...actor, correlationId: randomUUID() },
    );

    await expect(identity.verifyEmail(requireVerificationToken(first), actor)).rejects.toMatchObject({
      code: "EMAIL_VERIFICATION_INVALID",
    });
    await identity.verifyEmail(requireVerificationToken(second), actor);
    await expect(identity.login(email, "Senha-Antiga-Longa!2026", actor)).rejects.toMatchObject({
      code: "AUTHENTICATION_FAILED",
    });
    const session = await identity.login(email, "Senha-Nova-Segura!2026", actor);
    expect(session.displayName).toBe("Cadastro legítimo");
  });

  it("rollback não deixa outbox e inbox deduplica cem entregas", async () => {
    const eventId = createPublicId("event");
    const aggregateId = parsePublicId("event", createPublicId("event"));
    await expect(
      withSerializableTransaction(database.db, async (transaction) => {
        await appendOutboxEvent(
          transaction,
          {
            eventType: "test.rollback.v1",
            aggregateType: "Test",
            aggregateId,
            aggregateVersion: 1,
            ownerModule: "test",
            dataClassification: "INTERNAL",
            payload: {},
          },
          actor,
        );
        throw new Error("fault injection");
      }),
    ).rejects.toThrow("fault injection");
    const missing = await database.pool.query(
      "select 1 from eventing.outbox_events where aggregate_id = $1",
      [aggregateId],
    );
    expect(missing.rowCount).toBe(0);

    let effects = 0;
    for (let index = 0; index < 100; index += 1) {
      await withSerializableTransaction(database.db, async (transaction) => {
        if (await recordInboxOnce(transaction, "integration-consumer", eventId)) effects += 1;
      });
    }
    expect(effects).toBe(1);
  });

  async function provisionVerifiedUser(email: string) {
    const registration = await identity.register(
      {
        email,
        password: "Senha-Midas-Longa!2026",
        displayName: email.split("@")[0] ?? email,
        acceptedTermsVersion: "terms-2026-08",
      },
      { ...actor, correlationId: randomUUID() },
    );
    await identity.verifyEmail(requireVerificationToken(registration), actor);
    const session = await identity.login(email, "Senha-Midas-Longa!2026", actor);
    return { userId: parsePublicId("user", session.userId), sessionId: session.sessionId };
  }
});
