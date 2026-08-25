import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, defaultMigrationDirectories, runSqlMigrations } from "@midas/database";
import { buildApi } from "../src/app.js";
import { loadApiConfig } from "../src/config.js";
import { UnavailableVerificationDelivery } from "../src/adapters/smtp-verification-delivery.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("postgresql://")) {
  throw new Error("TEST_DATABASE_URL ou DATABASE_URL PostgreSQL é obrigatório.");
}

const database = createDatabase(databaseUrl, { max: 3 });

beforeAll(async () => {
  await runSqlMigrations(database.pool, defaultMigrationDirectories());
});

afterAll(async () => {
  await database.close();
});

describe("rotas financeiras fail-closed", () => {
  it("expõe capabilities e preserva bytes do webhook sem inventar adapter", async () => {
    const api = buildApi({
      config: loadApiConfig({ NODE_ENV: "test", DATABASE_URL: databaseUrl }),
      database,
      verificationDelivery: new UnavailableVerificationDelivery(),
    });
    const paymentCapability = await api.inject({
      method: "GET",
      url: "/v1/finance/provider-capability",
    });
    expect(paymentCapability.statusCode).toBe(200);
    expect(paymentCapability.json()).toMatchObject({
      status: "CONTRACT_REQUIRED",
      reasonCode: "PROVIDER_CONTRACT_NOT_SELECTED",
    });

    const payoutCapability = await api.inject({
      method: "GET",
      url: "/v1/finance/payout-capability?countryCode=BR&currency=BRL&mode=EXTERNAL_MANUAL",
    });
    expect(payoutCapability.statusCode).toBe(200);
    expect(payoutCapability.json()).toMatchObject({
      status: "CONTRACT_REQUIRED",
      reasonCode: "PAYOUT_CONTRACT_NOT_SELECTED",
    });

    const webhook = await api.inject({
      method: "POST",
      url: "/v1/provider-webhooks/unconfigured-psp",
      headers: { "content-type": "application/json", "x-provider-signature": "invalid" },
      payload: { eventId: "provider-event-1", state: "SETTLED" },
    });
    expect(webhook.statusCode).toBe(503);
    expect(webhook.json()).toMatchObject({
      code: "PROVIDER_ADAPTER_NOT_INSTALLED",
    });
    await api.close();
  });
});
