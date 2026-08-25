import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, defaultMigrationDirectories, runSqlMigrations } from "@midas/database";
import { IdentityService } from "@midas/identity";
import { createUuidV7, parsePublicId } from "@midas/kernel";
import { SellerService } from "@midas/sellers";
import {
  FinanceService,
  PaymentProviderRegistry,
  PayoutExecutionCapabilityRegistry,
  type PaymentProviderAdapter,
  type PayoutExecutionAdapter,
} from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("postgresql://")) {
  throw new Error("TEST_DATABASE_URL ou DATABASE_URL PostgreSQL é obrigatório.");
}

const database = createDatabase(databaseUrl, { max: 12 });
const identity = new IdentityService(database.db, {
  sessionTtlSeconds: 3_600,
  verificationTtlSeconds: 3_600,
  authRateLimitAttempts: 100,
  authRateLimitWindowSeconds: 60,
});
const sellers = new SellerService(database.db);
const finance = new FinanceService(database.db);
const secret = "integration-provider-secret";

beforeAll(async () => {
  await runSqlMigrations(database.pool, defaultMigrationDirectories());
});

afterAll(async () => {
  await database.close();
});

describe("RF225–229 com PostgreSQL real", () => {
  it("liquida uma vez, respeita 168h, quarentena atraso e fecha admin/payout por capability", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const sellerUser = await provisionUser(`seller-${suffix}@example.test`);
    const seller = await sellers.createSellerAccount(
      sellerUser.userId,
      { displayName: `Seller ${suffix}`, accountType: "INDIVIDUAL" },
      actor(sellerUser.userId, sellerUser.sessionId),
    );
    const sellerAccountId = parsePublicId("sellerAccount", seller.sellerAccountId);
    const admins = [];
    for (const index of [1, 2, 3, 4]) {
      admins.push(await provisionUser(`admin-${String(index)}-${suffix}@example.test`));
    }
    await grantFinancePlatformRole(admins.map((admin) => admin.userId));
    const [adminOne, adminTwo, adminThree, adminFour] = admins;
    if (!adminOne || !adminTwo || !adminThree || !adminFour) {
      throw new Error("Administradores de integração não provisionados.");
    }

    const providerAdapter = new SignedProviderAdapter(secret);
    const providerRegistry = new PaymentProviderRegistry("signed-test", [providerAdapter]);

    const settledOrderId = createUuidV7();
    await finance.registerOrderFinancialState(
      {
        orderId: settledOrderId,
        buyerUserId: sellerUser.userId,
        sellerAccountId,
        fulfillmentStatus: "COMPLETED",
      },
      actor(sellerUser.userId, sellerUser.sessionId),
    );
    const payment = await finance.createPayment(
      {
        orderId: settledOrderId,
        buyerUserId: sellerUser.userId,
        sellerAccountId,
        providerCode: "signed-test",
        providerPaymentReference: `payment-${suffix}`,
        amountMinor: 10_000n,
        currency: "BRL",
      },
      actor(sellerUser.userId, sellerUser.sessionId),
    );
    const settledAt = new Date("2026-08-01T12:00:00.000Z");
    const delivery = signedDelivery({
      externalEventId: `event-${suffix}`,
      providerPaymentReference: `payment-${suffix}`,
      providerState: "SETTLED",
      amountMinor: "10000",
      currency: "BRL",
      providerOccurredAt: settledAt.toISOString(),
    });
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        finance.processProviderWebhook(
          providerRegistry,
          "signed-test",
          delivery,
          actor(sellerUser.userId, sellerUser.sessionId),
        ),
      ),
    );
    expect(results.filter((result) => !result.duplicate)).toHaveLength(1);
    const persistedSettlement = await database.pool.query<{
      journal_count: number;
      entry_sum: string;
      lot_count: number;
      hold_id: string;
      starts_at: Date;
      eligible_at: Date;
    }>(
      `select
         (select count(*)::integer from finance.ledger_journals where journal_type = 'PAYMENT_SETTLEMENT' and reference_id = $1) journal_count,
         (select coalesce(sum(entry.amount_minor), 0)::text from finance.ledger_entries entry join finance.ledger_journals journal using (journal_id) where journal.journal_type = 'PAYMENT_SETTLEMENT' and journal.reference_id = $1) entry_sum,
         (select count(*)::integer from finance.balance_lots where payment_id = $1) lot_count,
         hold.hold_id, hold.starts_at, hold.eligible_at
       from finance.holds hold
       join finance.balance_lots lot using (balance_lot_id)
       where lot.payment_id = $1`,
      [payment.paymentId],
    );
    const settlement = persistedSettlement.rows[0];
    expect(settlement).toMatchObject({ journal_count: 1, entry_sum: "0", lot_count: 1 });
    if (!settlement) throw new Error("Hold não persistido.");
    expect(settlement.eligible_at.getTime() - settlement.starts_at.getTime()).toBe(
      168 * 60 * 60 * 1_000,
    );
    await expect(
      finance.releaseHold(
        settlement.hold_id,
        new Date(settlement.eligible_at.getTime() - 1),
        actor(sellerUser.userId, sellerUser.sessionId),
      ),
    ).resolves.toMatchObject({ released: false, reasonCode: "HOLD_WINDOW_ACTIVE" });
    await expect(
      finance.releaseHold(
        settlement.hold_id,
        settlement.eligible_at,
        actor(sellerUser.userId, sellerUser.sessionId),
      ),
    ).resolves.toMatchObject({ released: true, reasonCode: "ELIGIBLE" });

    const resolutionOrderId = createUuidV7();
    await finance.registerOrderFinancialState(
      {
        orderId: resolutionOrderId,
        buyerUserId: sellerUser.userId,
        sellerAccountId,
        fulfillmentStatus: "COMPLETED",
      },
      actor(sellerUser.userId, sellerUser.sessionId),
    );
    const resolutionPayment = await finance.createPayment(
      {
        orderId: resolutionOrderId,
        buyerUserId: sellerUser.userId,
        sellerAccountId,
        providerCode: "signed-test",
        providerPaymentReference: `resolution-${suffix}`,
        amountMinor: 2_000n,
        currency: "BRL",
      },
      actor(sellerUser.userId, sellerUser.sessionId),
    );
    const resolution = await finance.createResolutionCase(
      adminOne.userId,
      resolutionPayment.paymentId,
      { reasonCode: "BUYER_REPORTS_PAYMENT", evidenceLocator: `vault://${suffix}/receipt` },
      actor(adminOne.userId, adminOne.sessionId),
    );
    providerAdapter.lookupState = "PENDING";
    await expect(
      finance.decideResolutionCase(
        providerRegistry,
        adminTwo.userId,
        resolution.resolutionCaseId,
        { decision: "APPROVE", reviewReason: "Consultar provider" },
        actor(adminTwo.userId, adminTwo.sessionId),
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_SETTLEMENT_NOT_CONFIRMED" });
    const stillOpen = await database.pool.query<{ case_status: string; payment_status: string }>(
      `select resolution.case_status, payment.payment_status
         from finance.payment_resolution_cases resolution
         join finance.payments payment using (payment_id)
        where resolution.resolution_case_id = $1`,
      [resolution.resolutionCaseId],
    );
    expect(stillOpen.rows[0]).toEqual({ case_status: "OPEN", payment_status: "PENDING" });
    providerAdapter.lookupState = "SETTLED";
    await expect(
      finance.decideResolutionCase(
        providerRegistry,
        adminOne.userId,
        resolution.resolutionCaseId,
        { decision: "APPROVE", reviewReason: "Tentativa do maker" },
        actor(adminOne.userId, adminOne.sessionId),
      ),
    ).rejects.toMatchObject({ code: "SEGREGATION_OF_DUTIES_REQUIRED" });
    await expect(
      finance.decideResolutionCase(
        providerRegistry,
        adminTwo.userId,
        resolution.resolutionCaseId,
        { decision: "APPROVE", reviewReason: "Lookup canônico SETTLED" },
        actor(adminTwo.userId, adminTwo.sessionId),
      ),
    ).resolves.toMatchObject({ caseStatus: "APPROVED" });

    const canceledOrderId = createUuidV7();
    await finance.registerOrderFinancialState(
      {
        orderId: canceledOrderId,
        buyerUserId: sellerUser.userId,
        sellerAccountId,
        fulfillmentStatus: "CANCELLED",
      },
      actor(sellerUser.userId, sellerUser.sessionId),
    );
    const latePayment = await finance.createPayment(
      {
        orderId: canceledOrderId,
        buyerUserId: sellerUser.userId,
        sellerAccountId,
        providerCode: "signed-test",
        providerPaymentReference: `late-${suffix}`,
        amountMinor: 1_000n,
        currency: "BRL",
      },
      actor(sellerUser.userId, sellerUser.sessionId),
    );
    const lateDelivery = signedDelivery({
      externalEventId: `late-event-${suffix}`,
      providerPaymentReference: `late-${suffix}`,
      providerState: "SETTLED",
      amountMinor: "1000",
      currency: "BRL",
      providerOccurredAt: new Date("2026-08-02T12:00:00.000Z").toISOString(),
    });
    await expect(
      finance.processProviderWebhook(
        providerRegistry,
        "signed-test",
        lateDelivery,
        actor(sellerUser.userId, sellerUser.sessionId),
      ),
    ).resolves.toMatchObject({ processingResult: "PAYMENT_QUARANTINED" });
    const quarantine = await database.pool.query<{
      payment_status: string;
      quarantine_count: number;
      journal_count: number;
      lot_count: number;
    }>(
      `select payment.payment_status,
              (select count(*)::integer from finance.payment_quarantines where payment_id = payment.payment_id) quarantine_count,
              (select count(*)::integer from finance.ledger_journals where journal_type = 'PAYMENT_SETTLEMENT' and reference_id = payment.payment_id) journal_count,
              (select count(*)::integer from finance.balance_lots where payment_id = payment.payment_id) lot_count
         from finance.payments payment where payment.payment_id = $1`,
      [latePayment.paymentId],
    );
    expect(quarantine.rows[0]).toEqual({
      payment_status: "PAYMENT_QUARANTINED",
      quarantine_count: 1,
      journal_count: 0,
      lot_count: 0,
    });

    const payout = await finance.requestPayout(
      sellerUser.userId,
      sellerAccountId,
      {
        amountMinor: 4_000n,
        currency: "BRL",
        destinationCountry: "BR",
        idempotencyKey: `request-${suffix}-1234567890`,
      },
      actor(sellerUser.userId, sellerUser.sessionId),
    );
    await finance.claimPayout(
      adminOne.userId,
      payout.payoutRequestId,
      actor(adminOne.userId, adminOne.sessionId),
    );
    await finance.approvePayout(
      adminTwo.userId,
      payout.payoutRequestId,
      actor(adminTwo.userId, adminTwo.sessionId),
    );
    const noPayoutCapability = new PayoutExecutionCapabilityRegistry();
    const executionInput = {
      externalReference: `pix-${suffix}`,
      evidenceLocator: `vault://${suffix}/execution`,
      evidenceSha256: "a".repeat(64),
      idempotencyKey: `execute-${suffix}-123456789`,
    };
    await expect(
      finance.registerExternalPayoutExecution(
        noPayoutCapability,
        adminThree.userId,
        payout.payoutRequestId,
        executionInput,
        actor(adminThree.userId, adminThree.sessionId),
      ),
    ).rejects.toMatchObject({ code: "PAYOUT_CONTRACT_NOT_SELECTED" });
    expect(await payoutStatus(payout.payoutRequestId)).toBe("APPROVED");

    const payoutAdapter = new TestPayoutAdapter();
    const payoutRegistry = new PayoutExecutionCapabilityRegistry(true, [payoutAdapter]);
    await finance.registerExternalPayoutExecution(
      payoutRegistry,
      adminThree.userId,
      payout.payoutRequestId,
      executionInput,
      actor(adminThree.userId, adminThree.sessionId),
    );
    expect(await payoutStatus(payout.payoutRequestId)).toBe("CONFIRMATION_PENDING");
    const confirmationInput = {
      confirmationEvidenceLocator: `vault://${suffix}/confirmation`,
      confirmationEvidenceSha256: "b".repeat(64),
      idempotencyKey: `confirm-${suffix}-123456789`,
    };
    await expect(
      finance.confirmExternalPayout(
        noPayoutCapability,
        adminFour.userId,
        payout.payoutRequestId,
        confirmationInput,
        actor(adminFour.userId, adminFour.sessionId),
      ),
    ).rejects.toMatchObject({ code: "PAYOUT_CONTRACT_NOT_SELECTED" });
    expect(await payoutStatus(payout.payoutRequestId)).toBe("CONFIRMATION_PENDING");
    await expect(
      finance.confirmExternalPayout(
        payoutRegistry,
        adminFour.userId,
        payout.payoutRequestId,
        confirmationInput,
        actor(adminFour.userId, adminFour.sessionId),
      ),
    ).resolves.toMatchObject({ payoutStatus: "PAID" });
    const payoutJournal = await database.pool.query<{ journal_count: number; entry_sum: string }>(
      `select count(distinct journal.journal_id)::integer journal_count,
              coalesce(sum(entry.amount_minor), 0)::text entry_sum
         from finance.ledger_journals journal
         join finance.ledger_entries entry using (journal_id)
        where journal.journal_type = 'PAYOUT_COMPLETION' and journal.reference_id = $1`,
      [payout.payoutRequestId],
    );
    expect(payoutJournal.rows[0]).toEqual({ journal_count: 1, entry_sum: "0" });
  }, 30_000);
});

class SignedProviderAdapter implements PaymentProviderAdapter {
  readonly providerCode = "signed-test";
  lookupState: "PENDING" | "SETTLED" | "FAILED" = "SETTLED";

  constructor(private readonly secretValue: string) {}

  isConfigured(): boolean {
    return this.secretValue.length > 0;
  }

  verifyWebhook(input: {
    rawBody: Uint8Array;
    headers: Readonly<Record<string, string | string[] | undefined>>;
  }) {
    const received = input.headers["x-test-signature"];
    const expected = createHmac("sha256", this.secretValue).update(input.rawBody).digest("hex");
    if (typeof received !== "string" || !safeEqual(received, expected)) throw new Error("signature invalid");
    const payload = JSON.parse(new TextDecoder().decode(input.rawBody)) as Record<string, string>;
    return Promise.resolve({
      providerCode: this.providerCode,
      externalEventId: required(payload.externalEventId),
      providerPaymentReference: required(payload.providerPaymentReference),
      providerState: required(payload.providerState) as "PENDING" | "SETTLED" | "FAILED",
      amountMinor: BigInt(required(payload.amountMinor)),
      currency: required(payload.currency),
      providerOccurredAt: new Date(required(payload.providerOccurredAt)),
    });
  }

  lookupPayment(providerPaymentReference: string) {
    return Promise.resolve({
      providerCode: this.providerCode,
      providerPaymentReference,
      providerState: this.lookupState,
      amountMinor: 2_000n,
      currency: "BRL",
      providerOccurredAt: new Date("2026-08-03T12:00:00.000Z"),
      reconciliationReference: `lookup-${providerPaymentReference}-${this.lookupState}`,
    });
  }
}

class TestPayoutAdapter implements PayoutExecutionAdapter {
  readonly mode = "EXTERNAL_MANUAL" as const;
  supports(input: { countryCode: string; currency: string }): boolean {
    return input.countryCode === "BR" && input.currency === "BRL";
  }
  isConfigured(): boolean {
    return true;
  }
  validateExecution(input: { externalReference: string; evidenceSha256: string }) {
    return Promise.resolve({
      valid: /^[0-9a-f]{64}$/.test(input.evidenceSha256),
      providerExecutionReference: `validated-${input.externalReference}`,
    });
  }
  lookupConfirmation(input: { providerExecutionReference: string }) {
    return Promise.resolve({
      state: "PAID" as const,
      confirmationReference: `confirmed-${input.providerExecutionReference}`,
      providerOccurredAt: new Date("2026-08-31T12:00:00.000Z"),
    });
  }
}

function signedDelivery(payload: Record<string, string>) {
  const rawBody = new TextEncoder().encode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
  return { rawBody, headers: { "x-test-signature": signature } };
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function required(value: string | undefined): string {
  if (!value) throw new Error("payload incompleto");
  return value;
}

function actor(userId: string, sessionId: string) {
  return { correlationId: randomUUID(), actorUserId: userId, sessionId, ipPrefix: "127.0.0.0/24" };
}

async function provisionUser(email: string) {
  const registration = await identity.register(
    {
      email,
      password: "Senha-Midas-Longa!2026",
      displayName: email.split("@")[0] ?? email,
      acceptedTermsVersion: "terms-2026-08",
    },
    { correlationId: randomUUID() },
  );
  if (!registration.verificationToken) throw new Error("token ausente");
  await identity.verifyEmail(registration.verificationToken, { correlationId: randomUUID() });
  const session = await identity.login(email, "Senha-Midas-Longa!2026", { correlationId: randomUUID() });
  return { userId: parsePublicId("user", session.userId), sessionId: session.sessionId };
}

async function grantFinancePlatformRole(userIds: string[]): Promise<void> {
  const roleId = createUuidV7();
  await database.pool.query(
    `insert into iam.roles (role_id, role_code, role_scope, version) values ($1, $2, 'PLATFORM', 'integration-v1')`,
    [roleId, `finance-integration-${roleId}`],
  );
  const permissions = [
    "finance.payments.resolve",
    "finance.payments.review",
    "finance.payouts.read",
    "finance.payouts.claim",
    "finance.payouts.approve",
    "finance.payouts.execute",
    "finance.payouts.confirm",
  ];
  for (const permission of permissions) {
    await database.pool.query(
      `insert into iam.role_permissions (role_id, permission_code) values ($1, $2)`,
      [roleId, permission],
    );
  }
  for (const userId of userIds) {
    await database.pool.query(
      `insert into iam.user_role_assignments
         (assignment_id, user_id, role_id, assignment_status, valid_from)
       values ($1, $2, $3, 'ACTIVE', clock_timestamp() - interval '1 second')`,
      [createUuidV7(), userId, roleId],
    );
  }
}

async function payoutStatus(payoutRequestId: string): Promise<string> {
  const result = await database.pool.query<{ payout_status: string }>(
    "select payout_status from finance.payout_requests where payout_request_id = $1",
    [payoutRequestId],
  );
  const status = result.rows[0]?.payout_status;
  if (!status) throw new Error("payout ausente");
  return status;
}
