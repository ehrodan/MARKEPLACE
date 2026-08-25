import { createHash } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { appendAuditEvent } from "@midas/administration-audit";
import type { MidasDatabase, MidasTransaction } from "@midas/database";
import { withSerializableTransaction } from "@midas/database";
import { appendOutboxEvent } from "@midas/eventing";
import { rolePermissions, roles, userRoleAssignments } from "@midas/iam";
import { AppProblem, createUuidV7, type ActorContext } from "@midas/kernel";
import { sellerMemberships } from "@midas/sellers";
import { calculateHoldEligibleAt, evaluateHoldRelease } from "./hold-policy.js";
import {
  PayoutCapabilityError,
  type PayoutExecutionCapabilityRegistry,
} from "./payout-capability.js";
import {
  type PaymentProviderRegistry,
  ProviderCapabilityError,
  type VerifiedProviderEvent,
  type VerifiedProviderLookup,
} from "./provider-capability.js";
import {
  balanceLots,
  holdStateTransitions,
  holds,
  ledgerAccounts,
  ledgerEntries,
  ledgerJournals,
  orderFinancialStates,
  paymentResolutionCaseHistory,
  paymentResolutionCases,
  paymentQuarantines,
  payments,
  paymentStateTransitions,
  payoutAttempts,
  payoutConfirmations,
  payoutEvidence,
  payoutRequestLots,
  payoutRequests,
  payoutStateTransitions,
  providerEventInbox,
  providerReconciliations,
} from "./schema.js";

type Currency = string;
type PaymentRow = typeof payments.$inferSelect;
type PayoutRow = typeof payoutRequests.$inferSelect;

export type RegisterOrderFinancialStateInput = {
  orderId: string;
  buyerUserId: string;
  sellerAccountId: string;
  fulfillmentStatus: "CREATED" | "PROCESSING" | "COMPLETED" | "CANCELLED";
  disputeOpen?: boolean;
  chargebackOpen?: boolean;
  accountFrozen?: boolean;
};

export type CreatePaymentInput = {
  orderId: string;
  buyerUserId: string;
  sellerAccountId: string;
  providerCode?: string;
  providerPaymentReference?: string;
  amountMinor: bigint;
  currency: string;
};

export type ResolutionDecisionInput = {
  decision: "APPROVE" | "REJECT";
  reviewReason: string;
};

export class FinanceService {
  constructor(private readonly db: MidasDatabase) {}

  async registerOrderFinancialState(
    input: RegisterOrderFinancialStateInput,
    actor: ActorContext,
  ): Promise<void> {
    await withSerializableTransaction(this.db, async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(orderFinancialStates)
        .where(eq(orderFinancialStates.orderId, input.orderId))
        .for("update");
      const now = new Date();
      if (!existing) {
        await transaction.insert(orderFinancialStates).values({
          orderId: input.orderId,
          buyerUserId: input.buyerUserId,
          sellerAccountId: input.sellerAccountId,
          fulfillmentStatus: input.fulfillmentStatus,
          disputeOpen: input.disputeOpen ?? false,
          chargebackOpen: input.chargebackOpen ?? false,
          accountFrozen: input.accountFrozen ?? false,
          version: 1,
          updatedAt: now,
        });
      } else {
        if (
          existing.buyerUserId !== input.buyerUserId ||
          existing.sellerAccountId !== input.sellerAccountId
        ) {
          throw conflict(
            "ORDER_FINANCIAL_OWNER_IMMUTABLE",
            "Os participantes financeiros do pedido não podem ser trocados.",
          );
        }
        await transaction
          .update(orderFinancialStates)
          .set({
            fulfillmentStatus: input.fulfillmentStatus,
            disputeOpen: input.disputeOpen ?? existing.disputeOpen,
            chargebackOpen: input.chargebackOpen ?? existing.chargebackOpen,
            accountFrozen: input.accountFrozen ?? existing.accountFrozen,
            version: existing.version + 1,
            updatedAt: now,
          })
          .where(eq(orderFinancialStates.orderId, input.orderId));
      }
      await appendAuditEvent(
        transaction,
        {
          action: "finance.order_state.project",
          resourceType: "Order",
          resourceId: input.orderId,
          sellerAccountId: input.sellerAccountId,
          afterRedacted: {
            fulfillmentStatus: input.fulfillmentStatus,
            disputeOpen: input.disputeOpen ?? existing?.disputeOpen ?? false,
            chargebackOpen: input.chargebackOpen ?? existing?.chargebackOpen ?? false,
            accountFrozen: input.accountFrozen ?? existing?.accountFrozen ?? false,
          },
          dataClassification: "FINANCIAL",
        },
        actor,
      );
    });
  }

  async createPayment(input: CreatePaymentInput, actor: ActorContext) {
    assertPositiveAmount(input.amountMinor);
    const currency = normalizeCurrency(input.currency);
    const providerCode = normalizeOptionalIdentifier(input.providerCode);
    const providerReference = normalizeOptionalIdentifier(input.providerPaymentReference);
    if ((providerCode === undefined) !== (providerReference === undefined)) {
      throw validation("PROVIDER_REFERENCE_INCOMPLETE", "Provider e referência devem ser informados juntos.");
    }
    const paymentId = createUuidV7();
    const now = new Date();
    return withSerializableTransaction(this.db, async (transaction) => {
      const [order] = await transaction
        .select()
        .from(orderFinancialStates)
        .where(eq(orderFinancialStates.orderId, input.orderId))
        .for("update");
      if (!order) throw notFound("ORDER_FINANCIAL_STATE_NOT_FOUND", "Pedido financeiro não encontrado.");
      if (order.buyerUserId !== input.buyerUserId || order.sellerAccountId !== input.sellerAccountId) {
        throw conflict("ORDER_PAYMENT_PARTICIPANT_MISMATCH", "O pagamento não pertence aos participantes do pedido.");
      }
      await transaction.insert(payments).values({
        paymentId,
        orderId: input.orderId,
        buyerUserId: input.buyerUserId,
        sellerAccountId: input.sellerAccountId,
        ...(providerCode ? { providerCode } : {}),
        ...(providerReference ? { providerPaymentReference: providerReference } : {}),
        amountMinor: input.amountMinor,
        currency,
        paymentStatus: "PENDING",
        reconciliationStatus: "PENDING",
        version: 1,
        ...(actor.actorUserId ? { createdByUserId: actor.actorUserId } : {}),
        createdAt: now,
        updatedAt: now,
      });
      await transaction.insert(paymentStateTransitions).values({
        transitionId: createUuidV7(),
        paymentId,
        toStatus: "PENDING",
        transitionSource: "ORDER_COMMAND",
        sourceReference: input.orderId,
        ...(actor.actorUserId ? { actorUserId: actor.actorUserId } : {}),
        occurredAt: now,
      });
      await appendAuditEvent(
        transaction,
        {
          action: "finance.payment.create",
          resourceType: "Payment",
          resourceId: paymentId,
          sellerAccountId: input.sellerAccountId,
          afterRedacted: { paymentStatus: "PENDING", amountMinor: input.amountMinor.toString(), currency },
          dataClassification: "FINANCIAL",
        },
        actor,
      );
      return paymentView({
        paymentId,
        orderId: input.orderId,
        buyerUserId: input.buyerUserId,
        sellerAccountId: input.sellerAccountId,
        providerCode: providerCode ?? null,
        providerPaymentReference: providerReference ?? null,
        amountMinor: input.amountMinor,
        currency,
        paymentStatus: "PENDING",
        reconciliationStatus: "PENDING",
        settledAt: null,
        reconciledAt: null,
        version: 1,
        createdByUserId: actor.actorUserId ?? null,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  async processProviderWebhook(
    registry: PaymentProviderRegistry,
    providerCode: string,
    input: {
      rawBody: Uint8Array;
      headers: Readonly<Record<string, string | string[] | undefined>>;
    },
    actor: ActorContext,
  ) {
    let verified: VerifiedProviderEvent;
    try {
      verified = await registry.verifyWebhook(providerCode, input);
    } catch (error) {
      if (error instanceof ProviderCapabilityError) throw capabilityProblem(error);
      throw error;
    }
    if (verified.providerCode !== providerCode) {
      throw validation("PROVIDER_CODE_MISMATCH", "O adapter retornou um provider diferente da rota.");
    }
    return this.recordVerifiedProviderEvent(
      verified,
      createHash("sha256").update(input.rawBody).digest("hex"),
      actor,
    );
  }

  async reconcilePayment(
    registry: PaymentProviderRegistry,
    paymentId: string,
    actor: ActorContext,
  ) {
    const [payment] = await this.db.select().from(payments).where(eq(payments.paymentId, paymentId));
    if (!payment) throw notFound("PAYMENT_NOT_FOUND", "Pagamento não encontrado.");
    if (!payment.providerCode || !payment.providerPaymentReference) {
      throw conflict("PAYMENT_PROVIDER_REFERENCE_MISSING", "O pagamento não possui referência consultável no provider.");
    }
    let lookup: VerifiedProviderLookup;
    try {
      lookup = await registry.lookupPayment(payment.providerCode, payment.providerPaymentReference);
    } catch (error) {
      if (error instanceof ProviderCapabilityError) throw capabilityProblem(error);
      throw error;
    }
    return this.recordVerifiedProviderLookup(paymentId, lookup, actor);
  }

  async listBuyerPayments(userId: string) {
    const rows = await this.db
      .select()
      .from(payments)
      .where(eq(payments.buyerUserId, userId))
      .orderBy(desc(payments.createdAt));
    return { data: rows.map(paymentView), asOf: new Date() };
  }

  async getSellerBalance(userId: string, sellerAccountId: string, currencyInput = "BRL") {
    await this.assertSellerMembership(userId, sellerAccountId, false);
    const currency = normalizeCurrency(currencyInput);
    const rows = await this.db
      .select()
      .from(balanceLots)
      .where(and(eq(balanceLots.sellerAccountId, sellerAccountId), eq(balanceLots.currency, currency)));
    let held = 0n;
    let available = 0n;
    let reserved = 0n;
    for (const lot of rows) {
      if (lot.lotStatus === "HELD" || lot.lotStatus === "FROZEN") held += lot.remainingAmountMinor;
      if (lot.lotStatus === "AVAILABLE") {
        available += lot.remainingAmountMinor - lot.reservedAmountMinor;
        reserved += lot.reservedAmountMinor;
      }
    }
    return {
      sellerAccountId,
      currency,
      heldAmountMinor: held.toString(),
      availableAmountMinor: available.toString(),
      reservedAmountMinor: reserved.toString(),
      asOf: new Date(),
    };
  }

  async releaseHold(holdId: string, now: Date, actor: ActorContext) {
    return withSerializableTransaction(this.db, async (transaction) => {
      const [hold] = await transaction.select().from(holds).where(eq(holds.holdId, holdId)).for("update");
      if (!hold) throw notFound("HOLD_NOT_FOUND", "Hold não encontrado.");
      if (hold.holdStatus === "RELEASED") {
        return { released: true as const, reasonCode: "ALREADY_RELEASED" as const, releasedAt: hold.releasedAt };
      }
      const [lot] = await transaction
        .select()
        .from(balanceLots)
        .where(eq(balanceLots.balanceLotId, hold.balanceLotId))
        .for("update");
      if (!lot) throw notFound("BALANCE_LOT_NOT_FOUND", "Lote financeiro não encontrado.");
      const [payment] = await transaction.select().from(payments).where(eq(payments.paymentId, lot.paymentId));
      if (!payment) throw notFound("PAYMENT_NOT_FOUND", "Pagamento não encontrado.");
      const [order] = await transaction
        .select()
        .from(orderFinancialStates)
        .where(eq(orderFinancialStates.orderId, payment.orderId));
      if (!order) throw notFound("ORDER_FINANCIAL_STATE_NOT_FOUND", "Pedido financeiro não encontrado.");
      const decision = evaluateHoldRelease({
        now,
        eligibleAt: hold.eligibleAt,
        orderCompleted: order.fulfillmentStatus === "COMPLETED",
        paymentReconciled: payment.reconciliationStatus !== "PENDING",
        disputeOpen: order.disputeOpen,
        chargebackOpen: order.chargebackOpen,
        accountFrozen: order.accountFrozen,
      });
      if (!decision.releasable) return { released: false as const, reasonCode: decision.reasonCode };

      const journalId = createUuidV7();
      const heldAccountId = await this.ensureLedgerAccount(
        transaction,
        `seller:${lot.sellerAccountId}:held:${lot.currency}`,
        lot.sellerAccountId,
        "SELLER_PAYABLE_HELD",
        lot.currency,
      );
      const availableAccountId = await this.ensureLedgerAccount(
        transaction,
        `seller:${lot.sellerAccountId}:available:${lot.currency}`,
        lot.sellerAccountId,
        "SELLER_PAYABLE_AVAILABLE",
        lot.currency,
      );
      await this.insertBalancedJournal(transaction, {
        journalId,
        journalType: "HOLD_RELEASE",
        referenceId: holdId,
        sellerAccountId: lot.sellerAccountId,
        currency: lot.currency,
        occurredAt: now,
        actor,
        entries: [
          { ledgerAccountId: heldAccountId, amountMinor: lot.remainingAmountMinor },
          { ledgerAccountId: availableAccountId, amountMinor: -lot.remainingAmountMinor },
        ],
      });
      await transaction
        .update(holds)
        .set({
          holdStatus: "RELEASED",
          releasedAt: now,
          releaseJournalId: journalId,
          version: hold.version + 1,
          updatedAt: now,
        })
        .where(eq(holds.holdId, holdId));
      await transaction
        .update(balanceLots)
        .set({ lotStatus: "AVAILABLE", updatedAt: now })
        .where(eq(balanceLots.balanceLotId, lot.balanceLotId));
      await transaction.insert(holdStateTransitions).values({
        transitionId: createUuidV7(),
        holdId,
        fromStatus: hold.holdStatus,
        toStatus: "RELEASED",
        reasonCode: "ELIGIBLE",
        ...(actor.actorUserId ? { actorUserId: actor.actorUserId } : {}),
        occurredAt: now,
      });
      await appendOutboxEvent(
        transaction,
        {
          eventType: "finance.hold.released.v1",
          aggregateType: "Hold",
          aggregateId: holdId,
          aggregateVersion: hold.version + 1,
          ownerModule: "finance",
          sellerAccountId: lot.sellerAccountId,
          dataClassification: "FINANCIAL",
          payload: {
            holdId,
            balanceLotId: lot.balanceLotId,
            sellerAccountId: lot.sellerAccountId,
            amountMinor: lot.remainingAmountMinor.toString(),
            currency: lot.currency,
            releasedAt: now.toISOString(),
          },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "finance.hold.release",
          resourceType: "Hold",
          resourceId: holdId,
          sellerAccountId: lot.sellerAccountId,
          beforeRedacted: { holdStatus: hold.holdStatus },
          afterRedacted: { holdStatus: "RELEASED", journalId },
          dataClassification: "FINANCIAL",
        },
        actor,
      );
      return { released: true as const, reasonCode: "ELIGIBLE" as const, releasedAt: now };
    });
  }

  async createResolutionCase(
    actorUserId: string,
    paymentId: string,
    input: { reasonCode: string; evidenceLocator: string },
    actor: ActorContext,
  ) {
    await this.assertPlatformPermission(actorUserId, "finance.payments.resolve");
    const reasonCode = requireText(input.reasonCode, "reasonCode", 120);
    const evidenceLocator = requireText(input.evidenceLocator, "evidenceLocator", 1_000);
    const caseId = createUuidV7();
    const now = new Date();
    return withSerializableTransaction(this.db, async (transaction) => {
      const [payment] = await transaction.select().from(payments).where(eq(payments.paymentId, paymentId)).for("update");
      if (!payment) throw notFound("PAYMENT_NOT_FOUND", "Pagamento não encontrado.");
      if (payment.paymentStatus !== "PENDING") {
        throw conflict("PAYMENT_NOT_PENDING", "Apenas pagamento pendente pode abrir resolução humana.");
      }
      const [openCase] = await transaction
        .select()
        .from(paymentResolutionCases)
        .where(and(eq(paymentResolutionCases.paymentId, paymentId), eq(paymentResolutionCases.caseStatus, "OPEN")));
      if (openCase) throw conflict("PAYMENT_RESOLUTION_ALREADY_OPEN", "Já existe resolução aberta para o pagamento.");
      await transaction.insert(paymentResolutionCases).values({
        resolutionCaseId: caseId,
        paymentId,
        caseStatus: "OPEN",
        reasonCode,
        evidenceLocator,
        createdByUserId: actorUserId,
        version: 1,
        createdAt: now,
      });
      await transaction.insert(paymentResolutionCaseHistory).values({
        historyId: createUuidV7(),
        resolutionCaseId: caseId,
        caseStatus: "OPEN",
        actorUserId,
        reason: reasonCode,
        occurredAt: now,
      });
      await appendOutboxEvent(
        transaction,
        {
          eventType: "finance.payment_resolution.opened.v1",
          aggregateType: "PaymentResolutionCase",
          aggregateId: caseId,
          aggregateVersion: 1,
          ownerModule: "finance",
          sellerAccountId: payment.sellerAccountId,
          dataClassification: "FINANCIAL",
          payload: { resolutionCaseId: caseId, paymentId, caseStatus: "OPEN", reasonCode },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "finance.payment_resolution.open",
          resourceType: "PaymentResolutionCase",
          resourceId: caseId,
          sellerAccountId: payment.sellerAccountId,
          actingRole: "PLATFORM",
          afterRedacted: { paymentId, caseStatus: "OPEN", reasonCode, evidenceLocator },
          dataClassification: "FINANCIAL",
        },
        actor,
      );
      return resolutionView({
        resolutionCaseId: caseId,
        paymentId,
        caseStatus: "OPEN",
        reasonCode,
        evidenceLocator,
        createdByUserId: actorUserId,
        reviewedByUserId: null,
        reviewReason: null,
        createdAt: now,
        reviewedAt: null,
        version: 1,
      });
    });
  }

  async decideResolutionCase(
    registry: PaymentProviderRegistry,
    actorUserId: string,
    resolutionCaseId: string,
    input: ResolutionDecisionInput,
    actor: ActorContext,
  ) {
    await this.assertPlatformPermission(actorUserId, "finance.payments.review");
    const reviewReason = requireText(input.reviewReason, "reviewReason", 500);
    let verifiedLookup: VerifiedProviderLookup | undefined;
    if (input.decision === "APPROVE") {
      const [caseSnapshot] = await this.db
        .select({
          caseStatus: paymentResolutionCases.caseStatus,
          paymentId: paymentResolutionCases.paymentId,
          providerCode: payments.providerCode,
          providerPaymentReference: payments.providerPaymentReference,
        })
        .from(paymentResolutionCases)
        .innerJoin(payments, eq(payments.paymentId, paymentResolutionCases.paymentId))
        .where(eq(paymentResolutionCases.resolutionCaseId, resolutionCaseId));
      if (!caseSnapshot) throw notFound("PAYMENT_RESOLUTION_NOT_FOUND", "Caso de resolução não encontrado.");
      if (caseSnapshot.caseStatus !== "OPEN") {
        const [terminal] = await this.db
          .select()
          .from(paymentResolutionCases)
          .where(eq(paymentResolutionCases.resolutionCaseId, resolutionCaseId));
        if (!terminal) throw notFound("PAYMENT_RESOLUTION_NOT_FOUND", "Caso de resolução não encontrado.");
        return resolutionView(terminal);
      }
      if (!caseSnapshot.providerCode || !caseSnapshot.providerPaymentReference) {
        throw validation(
          "PAYMENT_PROVIDER_REFERENCE_MISSING",
          "A aprovação exige referência canônica consultável no provider.",
        );
      }
      try {
        verifiedLookup = await registry.lookupPayment(
          caseSnapshot.providerCode,
          caseSnapshot.providerPaymentReference,
        );
      } catch (error) {
        if (error instanceof ProviderCapabilityError) throw capabilityProblem(error);
        throw error;
      }
      validateVerifiedProviderPayment(verifiedLookup);
      if (verifiedLookup.providerState !== "SETTLED") {
        throw validation(
          "PROVIDER_SETTLEMENT_NOT_CONFIRMED",
          "O provider ainda não confirmou a liquidação; o caso permanece aberto.",
        );
      }
    }
    const now = new Date();
    return withSerializableTransaction(this.db, async (transaction) => {
      const [resolutionCase] = await transaction
        .select()
        .from(paymentResolutionCases)
        .where(eq(paymentResolutionCases.resolutionCaseId, resolutionCaseId))
        .for("update");
      if (!resolutionCase) throw notFound("PAYMENT_RESOLUTION_NOT_FOUND", "Caso de resolução não encontrado.");
      if (resolutionCase.caseStatus !== "OPEN") return resolutionView(resolutionCase);
      if (resolutionCase.createdByUserId === actorUserId) {
        throw forbidden("SEGREGATION_OF_DUTIES_REQUIRED", "Quem abriu o caso não pode julgá-lo.");
      }
      const [payment] = await transaction
        .select()
        .from(payments)
        .where(eq(payments.paymentId, resolutionCase.paymentId))
        .for("update");
      if (!payment) throw notFound("PAYMENT_NOT_FOUND", "Pagamento não encontrado.");
      if (payment.paymentStatus !== "PENDING") {
        throw conflict("PAYMENT_NOT_PENDING", "O pagamento saiu do estado pendente antes da decisão.");
      }
      if (verifiedLookup) assertProviderMatchesPayment(payment, verifiedLookup);
      const caseStatus = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
      await transaction
        .update(paymentResolutionCases)
        .set({
          caseStatus,
          reviewedByUserId: actorUserId,
          reviewReason,
          reviewedAt: now,
          version: resolutionCase.version + 1,
        })
        .where(eq(paymentResolutionCases.resolutionCaseId, resolutionCaseId));
      await transaction.insert(paymentResolutionCaseHistory).values({
        historyId: createUuidV7(),
        resolutionCaseId,
        caseStatus,
        actorUserId,
        reason: reviewReason,
        occurredAt: now,
      });
      if (input.decision === "APPROVE") {
        if (!verifiedLookup) {
          throw validation(
            "PROVIDER_SETTLEMENT_NOT_CONFIRMED",
            "A liquidação exige consulta canônica confirmada pelo provider.",
          );
        }
        const [existingReconciliation] = await transaction
          .select()
          .from(providerReconciliations)
          .where(
            and(
              eq(providerReconciliations.providerCode, verifiedLookup.providerCode),
              eq(
                providerReconciliations.providerReconciliationReference,
                verifiedLookup.reconciliationReference,
              ),
            ),
          );
        if (existingReconciliation && existingReconciliation.paymentId !== payment.paymentId) {
          throw conflict(
            "PROVIDER_RECONCILIATION_REUSED",
            "A confirmação do provider já pertence a outro pagamento.",
          );
        }
        if (!existingReconciliation) {
          await transaction.insert(providerReconciliations).values({
            reconciliationId: createUuidV7(),
            paymentId: payment.paymentId,
            providerCode: verifiedLookup.providerCode,
            providerReconciliationReference: verifiedLookup.reconciliationReference,
            providerState: verifiedLookup.providerState,
            providerOccurredAt: verifiedLookup.providerOccurredAt,
          });
        }
        await this.settlePayment(transaction, payment, {
          settledAt: verifiedLookup.providerOccurredAt,
          reconciliationStatus: "RECONCILED_PROVIDER",
          transitionSource: "PROVIDER_LOOKUP",
          sourceReference: verifiedLookup.reconciliationReference,
          actor,
        });
      }
      await appendOutboxEvent(
        transaction,
        {
          eventType:
            input.decision === "APPROVE"
              ? "finance.payment_resolution.approved.v1"
              : "finance.payment_resolution.rejected.v1",
          aggregateType: "PaymentResolutionCase",
          aggregateId: resolutionCaseId,
          aggregateVersion: resolutionCase.version + 1,
          ownerModule: "finance",
          sellerAccountId: payment.sellerAccountId,
          dataClassification: "FINANCIAL",
          payload: {
            resolutionCaseId,
            paymentId: payment.paymentId,
            caseStatus,
            reviewedByUserId: actorUserId,
            reviewedAt: now.toISOString(),
          },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: `finance.payment_resolution.${input.decision === "APPROVE" ? "approve" : "reject"}`,
          resourceType: "PaymentResolutionCase",
          resourceId: resolutionCaseId,
          sellerAccountId: payment.sellerAccountId,
          actingRole: "PLATFORM",
          beforeRedacted: { caseStatus: "OPEN" },
          afterRedacted: { caseStatus, reviewReason },
          dataClassification: "FINANCIAL",
        },
        actor,
      );
      return resolutionView({
        ...resolutionCase,
        caseStatus,
        reviewedByUserId: actorUserId,
        reviewReason,
        reviewedAt: now,
        version: resolutionCase.version + 1,
      });
    });
  }

  async listResolutionCases(actorUserId: string, status?: string) {
    await this.assertPlatformPermission(actorUserId, "finance.payments.review");
    const rows = status
      ? await this.db
          .select()
          .from(paymentResolutionCases)
          .where(eq(paymentResolutionCases.caseStatus, status))
          .orderBy(asc(paymentResolutionCases.createdAt))
      : await this.db.select().from(paymentResolutionCases).orderBy(asc(paymentResolutionCases.createdAt));
    return { data: rows.map(resolutionView), asOf: new Date() };
  }

  async requestPayout(
    userId: string,
    sellerAccountId: string,
    input: { amountMinor: bigint; currency: string; destinationCountry: string; idempotencyKey: string },
    actor: ActorContext,
  ) {
    await this.assertSellerMembership(userId, sellerAccountId, true);
    assertPositiveAmount(input.amountMinor);
    const currency = normalizeCurrency(input.currency);
    const destinationCountry = normalizeCountryCode(input.destinationCountry);
    const idempotencyKeyHash = hashIdempotencyKey(input.idempotencyKey);
    return withSerializableTransaction(this.db, async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(payoutRequests)
        .where(
          and(
            eq(payoutRequests.sellerAccountId, sellerAccountId),
            eq(payoutRequests.idempotencyKeyHash, idempotencyKeyHash),
          ),
        );
      if (existing) {
        if (
          existing.amountMinor !== input.amountMinor ||
          existing.currency !== currency ||
          existing.destinationCountry !== destinationCountry
        ) {
          throw conflict("IDEMPOTENCY_KEY_REUSED", "A chave de idempotência já foi usada com outro conteúdo.");
        }
        return payoutView(existing);
      }
      const lots = await transaction
        .select()
        .from(balanceLots)
        .where(
          and(
            eq(balanceLots.sellerAccountId, sellerAccountId),
            eq(balanceLots.currency, currency),
            eq(balanceLots.lotStatus, "AVAILABLE"),
          ),
        )
        .orderBy(asc(balanceLots.createdAt))
        .for("update");
      let amountRemaining = input.amountMinor;
      const allocations: Array<{ balanceLotId: string; allocatedAmountMinor: bigint }> = [];
      for (const lot of lots) {
        const lotAvailable = lot.remainingAmountMinor - lot.reservedAmountMinor;
        if (lotAvailable <= 0n) continue;
        const allocated = lotAvailable < amountRemaining ? lotAvailable : amountRemaining;
        allocations.push({ balanceLotId: lot.balanceLotId, allocatedAmountMinor: allocated });
        amountRemaining -= allocated;
        if (amountRemaining === 0n) break;
      }
      if (amountRemaining !== 0n) {
        throw conflict("PAYOUT_BALANCE_INSUFFICIENT", "O saldo disponível não cobre a solicitação.");
      }
      const payoutRequestId = createUuidV7();
      const now = new Date();
      await transaction.insert(payoutRequests).values({
        payoutRequestId,
        sellerAccountId,
        requestedByUserId: userId,
        amountMinor: input.amountMinor,
        currency,
        destinationCountry,
        idempotencyKeyHash,
        payoutStatus: "REQUESTED",
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      await transaction.insert(payoutRequestLots).values(
        allocations.map((allocation) => ({ payoutRequestId, ...allocation })),
      );
      for (const allocation of allocations) {
        await transaction
          .update(balanceLots)
          .set({
            reservedAmountMinor: sql`${balanceLots.reservedAmountMinor} + ${allocation.allocatedAmountMinor}`,
            updatedAt: now,
          })
          .where(eq(balanceLots.balanceLotId, allocation.balanceLotId));
      }
      await transaction.insert(payoutStateTransitions).values({
        transitionId: createUuidV7(),
        payoutRequestId,
        toStatus: "REQUESTED",
        reasonCode: "SELLER_REQUEST",
        actorUserId: userId,
        occurredAt: now,
      });
      await appendOutboxEvent(
        transaction,
        {
          eventType: "finance.payout.requested.v1",
          aggregateType: "PayoutRequest",
          aggregateId: payoutRequestId,
          aggregateVersion: 1,
          ownerModule: "finance",
          sellerAccountId,
          dataClassification: "FINANCIAL",
          payload: {
            payoutRequestId,
            sellerAccountId,
            amountMinor: input.amountMinor.toString(),
            currency,
            payoutStatus: "REQUESTED",
          },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "finance.payout.request",
          resourceType: "PayoutRequest",
          resourceId: payoutRequestId,
          sellerAccountId,
          afterRedacted: { amountMinor: input.amountMinor.toString(), currency, payoutStatus: "REQUESTED" },
          dataClassification: "FINANCIAL",
        },
        actor,
      );
      return payoutView({
        payoutRequestId,
        sellerAccountId,
        requestedByUserId: userId,
        amountMinor: input.amountMinor,
        currency,
        destinationCountry,
        idempotencyKeyHash,
        payoutStatus: "REQUESTED",
        claimedByUserId: null,
        approvedByUserId: null,
        completedByUserId: null,
        claimedAt: null,
        approvedAt: null,
        completedAt: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  async listSellerPayouts(userId: string, sellerAccountId: string) {
    await this.assertSellerMembership(userId, sellerAccountId, false);
    const rows = await this.db
      .select()
      .from(payoutRequests)
      .where(eq(payoutRequests.sellerAccountId, sellerAccountId))
      .orderBy(desc(payoutRequests.createdAt));
    return { data: rows.map(payoutView), asOf: new Date() };
  }

  async listAdminPayouts(actorUserId: string, status?: string) {
    await this.assertPlatformPermission(actorUserId, "finance.payouts.read");
    const rows = status
      ? await this.db
          .select()
          .from(payoutRequests)
          .where(eq(payoutRequests.payoutStatus, status))
          .orderBy(asc(payoutRequests.createdAt))
      : await this.db.select().from(payoutRequests).orderBy(asc(payoutRequests.createdAt));
    return { data: rows.map(payoutView), asOf: new Date() };
  }

  async claimPayout(actorUserId: string, payoutRequestId: string, actor: ActorContext) {
    await this.assertPlatformPermission(actorUserId, "finance.payouts.claim");
    return withSerializableTransaction(this.db, async (transaction) => {
      const [request] = await transaction
        .select()
        .from(payoutRequests)
        .where(eq(payoutRequests.payoutRequestId, payoutRequestId))
        .for("update");
      if (!request) throw notFound("PAYOUT_REQUEST_NOT_FOUND", "Solicitação de saque não encontrada.");
      if (request.payoutStatus === "UNDER_REVIEW" && request.claimedByUserId === actorUserId) {
        return payoutView(request);
      }
      if (request.payoutStatus !== "REQUESTED") {
        throw conflict("PAYOUT_NOT_CLAIMABLE", "A solicitação não está disponível para claim.");
      }
      const now = new Date();
      await transaction
        .update(payoutRequests)
        .set({
          payoutStatus: "UNDER_REVIEW",
          claimedByUserId: actorUserId,
          claimedAt: now,
          version: request.version + 1,
          updatedAt: now,
        })
        .where(eq(payoutRequests.payoutRequestId, payoutRequestId));
      await transaction.insert(payoutStateTransitions).values({
        transitionId: createUuidV7(),
        payoutRequestId,
        fromStatus: "REQUESTED",
        toStatus: "UNDER_REVIEW",
        reasonCode: "ADMIN_CLAIM",
        actorUserId,
        occurredAt: now,
      });
      await appendOutboxEvent(
        transaction,
        {
          eventType: "finance.payout.claimed.v1",
          aggregateType: "PayoutRequest",
          aggregateId: payoutRequestId,
          aggregateVersion: request.version + 1,
          ownerModule: "finance",
          sellerAccountId: request.sellerAccountId,
          dataClassification: "FINANCIAL",
          payload: { payoutRequestId, payoutStatus: "UNDER_REVIEW", claimedByUserId: actorUserId },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "finance.payout.claim",
          resourceType: "PayoutRequest",
          resourceId: payoutRequestId,
          sellerAccountId: request.sellerAccountId,
          actingRole: "PLATFORM",
          beforeRedacted: { payoutStatus: "REQUESTED" },
          afterRedacted: { payoutStatus: "UNDER_REVIEW", claimedByUserId: actorUserId },
          dataClassification: "FINANCIAL",
        },
        actor,
      );
      return payoutView({
        ...request,
        payoutStatus: "UNDER_REVIEW",
        claimedByUserId: actorUserId,
        claimedAt: now,
        version: request.version + 1,
        updatedAt: now,
      });
    });
  }

  async approvePayout(actorUserId: string, payoutRequestId: string, actor: ActorContext) {
    await this.assertPlatformPermission(actorUserId, "finance.payouts.approve");
    return withSerializableTransaction(this.db, async (transaction) => {
      const [request] = await transaction
        .select()
        .from(payoutRequests)
        .where(eq(payoutRequests.payoutRequestId, payoutRequestId))
        .for("update");
      if (!request) throw notFound("PAYOUT_REQUEST_NOT_FOUND", "Solicitação de saque não encontrada.");
      if (request.payoutStatus === "APPROVED") return payoutView(request);
      if (request.payoutStatus !== "UNDER_REVIEW" || !request.claimedByUserId) {
        throw conflict("PAYOUT_NOT_APPROVABLE", "O saque precisa estar sob revisão antes da aprovação.");
      }
      if (request.requestedByUserId === actorUserId) {
        throw forbidden("SEGREGATION_OF_DUTIES_REQUIRED", "O solicitante não pode aprovar o próprio saque.");
      }
      const now = new Date();
      await transaction
        .update(payoutRequests)
        .set({
          payoutStatus: "APPROVED",
          approvedByUserId: actorUserId,
          approvedAt: now,
          version: request.version + 1,
          updatedAt: now,
        })
        .where(eq(payoutRequests.payoutRequestId, payoutRequestId));
      await transaction.insert(payoutStateTransitions).values({
        transitionId: createUuidV7(),
        payoutRequestId,
        fromStatus: "UNDER_REVIEW",
        toStatus: "APPROVED",
        reasonCode: "ADMIN_APPROVAL",
        actorUserId,
        occurredAt: now,
      });
      await appendOutboxEvent(
        transaction,
        {
          eventType: "finance.payout.approved.v1",
          aggregateType: "PayoutRequest",
          aggregateId: payoutRequestId,
          aggregateVersion: request.version + 1,
          ownerModule: "finance",
          sellerAccountId: request.sellerAccountId,
          dataClassification: "FINANCIAL",
          payload: { payoutRequestId, payoutStatus: "APPROVED", approvedByUserId: actorUserId },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "finance.payout.approve",
          resourceType: "PayoutRequest",
          resourceId: payoutRequestId,
          sellerAccountId: request.sellerAccountId,
          actingRole: "PLATFORM",
          beforeRedacted: { payoutStatus: "UNDER_REVIEW" },
          afterRedacted: { payoutStatus: "APPROVED", approvedByUserId: actorUserId },
          dataClassification: "FINANCIAL",
        },
        actor,
      );
      return payoutView({
        ...request,
        payoutStatus: "APPROVED",
        approvedByUserId: actorUserId,
        approvedAt: now,
        version: request.version + 1,
        updatedAt: now,
      });
    });
  }

  async registerExternalPayoutExecution(
    registry: PayoutExecutionCapabilityRegistry,
    actorUserId: string,
    payoutRequestId: string,
    input: {
      externalReference: string;
      evidenceLocator: string;
      evidenceSha256: string;
      idempotencyKey: string;
    },
    actor: ActorContext,
  ) {
    await this.assertPlatformPermission(actorUserId, "finance.payouts.execute");
    const externalReference = requireText(input.externalReference, "externalReference", 300);
    const evidenceLocator = requireText(input.evidenceLocator, "evidenceLocator", 1_000);
    const evidenceSha256 = requireSha256(input.evidenceSha256);
    const idempotencyKeyHash = hashIdempotencyKey(input.idempotencyKey);
    const [snapshot] = await this.db
      .select()
      .from(payoutRequests)
      .where(eq(payoutRequests.payoutRequestId, payoutRequestId));
    if (!snapshot) throw notFound("PAYOUT_REQUEST_NOT_FOUND", "Solicitação de saque não encontrada.");
    let validatedExecution: { valid: boolean; providerExecutionReference: string };
    try {
      validatedExecution = await registry.validateExecution({
        countryCode: snapshot.destinationCountry,
        currency: snapshot.currency,
        mode: "EXTERNAL_MANUAL",
        payoutRequestId,
        amountMinor: snapshot.amountMinor,
        externalReference,
        evidenceSha256,
      });
    } catch (error) {
      if (error instanceof PayoutCapabilityError) throw payoutCapabilityProblem(error);
      throw error;
    }
    if (!validatedExecution.valid) {
      throw validation(
        "PAYOUT_EXECUTION_EVIDENCE_INVALID",
        "O modo homologado não validou referência e prova da execução.",
      );
    }
    const providerExecutionReference = requireText(
      validatedExecution.providerExecutionReference,
      "providerExecutionReference",
      300,
    );
    return withSerializableTransaction(this.db, async (transaction) => {
      const [request] = await transaction
        .select()
        .from(payoutRequests)
        .where(eq(payoutRequests.payoutRequestId, payoutRequestId))
        .for("update");
      if (!request) throw notFound("PAYOUT_REQUEST_NOT_FOUND", "Solicitação de saque não encontrada.");
      const [existingAttempt] = await transaction
        .select()
        .from(payoutAttempts)
        .where(
          and(
            eq(payoutAttempts.payoutRequestId, payoutRequestId),
            eq(payoutAttempts.idempotencyKeyHash, idempotencyKeyHash),
          ),
        );
      if (existingAttempt) {
        if (existingAttempt.externalReference !== providerExecutionReference) {
          throw conflict("IDEMPOTENCY_KEY_REUSED", "A chave de idempotência já foi usada com outro conteúdo.");
        }
        return payoutView(request);
      }
      if (
        request.payoutStatus !== "APPROVED" ||
        !request.claimedByUserId ||
        !request.approvedByUserId
      ) {
        throw conflict("PAYOUT_NOT_READY", "O saque precisa estar aprovado antes da execução.");
      }
      if (
        request.requestedByUserId === actorUserId ||
        request.claimedByUserId === actorUserId ||
        request.approvedByUserId === actorUserId
      ) {
        throw forbidden(
          "SEGREGATION_OF_DUTIES_REQUIRED",
          "Solicitante, revisor e aprovador não podem executar o pagamento externo.",
        );
      }
      const now = new Date();
      const [attemptCount] = await transaction
        .select({ count: sql<number>`count(*)::integer` })
        .from(payoutAttempts)
        .where(eq(payoutAttempts.payoutRequestId, payoutRequestId));
      const payoutAttemptId = createUuidV7();
      await transaction.insert(payoutAttempts).values({
        payoutAttemptId,
        payoutRequestId,
        attemptNumber: (attemptCount?.count ?? 0) + 1,
        executionMode: "EXTERNAL_MANUAL",
        attemptStatus: "CONFIRMATION_PENDING",
        externalReference: providerExecutionReference,
        idempotencyKeyHash,
        executedByUserId: actorUserId,
        executedAt: now,
      });
      await transaction.insert(payoutEvidence).values({
        payoutEvidenceId: createUuidV7(),
        payoutAttemptId,
        evidenceLocator,
        evidenceSha256,
        recordedByUserId: actorUserId,
      });
      await transaction
        .update(payoutRequests)
        .set({
          payoutStatus: "CONFIRMATION_PENDING",
          version: request.version + 2,
          updatedAt: now,
        })
        .where(eq(payoutRequests.payoutRequestId, payoutRequestId));
      await transaction.insert(payoutStateTransitions).values([
        {
          transitionId: createUuidV7(),
          payoutRequestId,
          fromStatus: "APPROVED",
          toStatus: "EXECUTING",
          reasonCode: "HOMOLOGATED_EXECUTION_STARTED",
          actorUserId,
          occurredAt: now,
        },
        {
          transitionId: createUuidV7(),
          payoutRequestId,
          fromStatus: "EXECUTING",
          toStatus: "CONFIRMATION_PENDING",
          reasonCode: "EXTERNAL_REFERENCE_EVIDENCED",
          actorUserId,
          occurredAt: now,
        },
      ]);
      await appendOutboxEvent(
        transaction,
        {
          eventType: "finance.payout.execution_registered.v1",
          aggregateType: "PayoutRequest",
          aggregateId: payoutRequestId,
          aggregateVersion: request.version + 2,
          ownerModule: "finance",
          sellerAccountId: request.sellerAccountId,
          dataClassification: "FINANCIAL",
          payload: {
            payoutRequestId,
            payoutAttemptId,
            payoutStatus: "CONFIRMATION_PENDING",
            amountMinor: request.amountMinor.toString(),
            currency: request.currency,
            executedAt: now.toISOString(),
          },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "finance.payout.register_external_execution",
          resourceType: "PayoutRequest",
          resourceId: payoutRequestId,
          sellerAccountId: request.sellerAccountId,
          actingRole: "PLATFORM",
          beforeRedacted: { payoutStatus: "APPROVED" },
          afterRedacted: {
            payoutStatus: "CONFIRMATION_PENDING",
            payoutAttemptId,
            providerExecutionReference,
            evidenceLocator,
          },
          dataClassification: "FINANCIAL",
        },
        actor,
      );
      return payoutView({
        ...request,
        payoutStatus: "CONFIRMATION_PENDING",
        version: request.version + 2,
        updatedAt: now,
      });
    });
  }

  async confirmExternalPayout(
    registry: PayoutExecutionCapabilityRegistry,
    actorUserId: string,
    payoutRequestId: string,
    input: {
      confirmationEvidenceLocator: string;
      confirmationEvidenceSha256: string;
      idempotencyKey: string;
    },
    actor: ActorContext,
  ) {
    await this.assertPlatformPermission(actorUserId, "finance.payouts.confirm");
    const evidenceLocator = requireText(
      input.confirmationEvidenceLocator,
      "confirmationEvidenceLocator",
      1_000,
    );
    const evidenceSha256 = requireSha256(input.confirmationEvidenceSha256);
    const idempotencyKeyHash = hashIdempotencyKey(input.idempotencyKey);
    const [snapshot] = await this.db
      .select()
      .from(payoutRequests)
      .where(eq(payoutRequests.payoutRequestId, payoutRequestId));
    if (!snapshot) throw notFound("PAYOUT_REQUEST_NOT_FOUND", "Solicitação de saque não encontrada.");
    const [attemptSnapshot] = await this.db
      .select()
      .from(payoutAttempts)
      .where(eq(payoutAttempts.payoutRequestId, payoutRequestId))
      .orderBy(desc(payoutAttempts.attemptNumber));
    if (!attemptSnapshot) throw conflict("PAYOUT_ATTEMPT_NOT_FOUND", "Nenhuma execução aguarda confirmação.");
    let confirmation: {
      state: "PENDING" | "PAID" | "FAILED";
      confirmationReference: string;
      providerOccurredAt: Date;
    };
    try {
      confirmation = await registry.lookupConfirmation({
        countryCode: snapshot.destinationCountry,
        currency: snapshot.currency,
        mode: "EXTERNAL_MANUAL",
        providerExecutionReference: attemptSnapshot.externalReference,
        confirmationEvidenceSha256: evidenceSha256,
      });
    } catch (error) {
      if (error instanceof PayoutCapabilityError) throw payoutCapabilityProblem(error);
      throw error;
    }
    if (confirmation.state !== "PAID" || !Number.isFinite(confirmation.providerOccurredAt.getTime())) {
      throw validation(
        "PAYOUT_NOT_CONFIRMED",
        "A fonte homologada não confirmou o pagamento; a solicitação permanece pendente.",
      );
    }
    const confirmationReference = requireText(
      confirmation.confirmationReference,
      "confirmationReference",
      300,
    );
    return withSerializableTransaction(this.db, async (transaction) => {
      const [request] = await transaction
        .select()
        .from(payoutRequests)
        .where(eq(payoutRequests.payoutRequestId, payoutRequestId))
        .for("update");
      if (!request) throw notFound("PAYOUT_REQUEST_NOT_FOUND", "Solicitação de saque não encontrada.");
      if (request.payoutStatus === "PAID") return payoutView(request);
      if (request.payoutStatus !== "CONFIRMATION_PENDING") {
        throw conflict("PAYOUT_NOT_CONFIRMABLE", "O saque não está aguardando confirmação.");
      }
      const [attempt] = await transaction
        .select()
        .from(payoutAttempts)
        .where(eq(payoutAttempts.payoutRequestId, payoutRequestId))
        .orderBy(desc(payoutAttempts.attemptNumber))
        .for("update");
      if (!attempt) throw conflict("PAYOUT_ATTEMPT_NOT_FOUND", "Nenhuma execução aguarda confirmação.");
      if (
        actorUserId === request.requestedByUserId ||
        actorUserId === request.claimedByUserId ||
        actorUserId === request.approvedByUserId ||
        actorUserId === attempt.executedByUserId
      ) {
        throw forbidden(
          "SEGREGATION_OF_DUTIES_REQUIRED",
          "Solicitante, revisor, aprovador e executor não podem confirmar a própria etapa.",
        );
      }
      const [existingConfirmation] = await transaction
        .select()
        .from(payoutConfirmations)
        .where(eq(payoutConfirmations.payoutAttemptId, attempt.payoutAttemptId));
      if (existingConfirmation) {
        if (existingConfirmation.idempotencyKeyHash !== idempotencyKeyHash) {
          throw conflict("PAYOUT_ALREADY_CONFIRMED", "A tentativa já possui confirmação reconciliada.");
        }
        return payoutView(request);
      }
      const allocations = await transaction
        .select()
        .from(payoutRequestLots)
        .where(eq(payoutRequestLots.payoutRequestId, payoutRequestId));
      const lotIds = allocations.map((allocation) => allocation.balanceLotId);
      const lots = lotIds.length
        ? await transaction
            .select()
            .from(balanceLots)
            .where(inArray(balanceLots.balanceLotId, lotIds))
            .for("update")
        : [];
      const byId = new Map(lots.map((lot) => [lot.balanceLotId, lot]));
      for (const allocation of allocations) {
        const lot = byId.get(allocation.balanceLotId);
        if (!lot || lot.reservedAmountMinor < allocation.allocatedAmountMinor) {
          throw conflict("PAYOUT_RESERVATION_BROKEN", "A reserva financeira do saque está inconsistente.");
        }
      }
      const journalId = createUuidV7();
      const availableAccountId = await this.ensureLedgerAccount(
        transaction,
        `seller:${request.sellerAccountId}:available:${request.currency}`,
        request.sellerAccountId,
        "SELLER_PAYABLE_AVAILABLE",
        request.currency,
      );
      const payoutAccountId = await this.ensureLedgerAccount(
        transaction,
        `platform:payout-clearing:${request.currency}`,
        null,
        "PAYOUT_CLEARING",
        request.currency,
      );
      await this.insertBalancedJournal(transaction, {
        journalId,
        journalType: "PAYOUT_COMPLETION",
        referenceId: payoutRequestId,
        sellerAccountId: request.sellerAccountId,
        currency: request.currency,
        occurredAt: confirmation.providerOccurredAt,
        actor,
        entries: [
          { ledgerAccountId: availableAccountId, amountMinor: request.amountMinor },
          { ledgerAccountId: payoutAccountId, amountMinor: -request.amountMinor },
        ],
      });
      for (const allocation of allocations) {
        const lot = byId.get(allocation.balanceLotId);
        if (!lot) continue;
        const nextRemaining = lot.remainingAmountMinor - allocation.allocatedAmountMinor;
        const nextReserved = lot.reservedAmountMinor - allocation.allocatedAmountMinor;
        await transaction
          .update(balanceLots)
          .set({
            remainingAmountMinor: nextRemaining,
            reservedAmountMinor: nextReserved,
            lotStatus: nextRemaining === 0n ? "CONSUMED" : "AVAILABLE",
            updatedAt: confirmation.providerOccurredAt,
          })
          .where(eq(balanceLots.balanceLotId, lot.balanceLotId));
      }
      await transaction.insert(payoutConfirmations).values({
        payoutConfirmationId: createUuidV7(),
        payoutAttemptId: attempt.payoutAttemptId,
        confirmationReference,
        evidenceLocator,
        evidenceSha256,
        idempotencyKeyHash,
        confirmedByUserId: actorUserId,
        providerConfirmedAt: confirmation.providerOccurredAt,
      });
      await transaction
        .update(payoutRequests)
        .set({
          payoutStatus: "PAID",
          completedByUserId: actorUserId,
          completedAt: confirmation.providerOccurredAt,
          version: request.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(payoutRequests.payoutRequestId, payoutRequestId));
      await transaction.insert(payoutStateTransitions).values({
        transitionId: createUuidV7(),
        payoutRequestId,
        fromStatus: "CONFIRMATION_PENDING",
        toStatus: "PAID",
        reasonCode: "HOMOLOGATED_CONFIRMATION_MATCHED",
        actorUserId,
        occurredAt: confirmation.providerOccurredAt,
      });
      await appendOutboxEvent(
        transaction,
        {
          eventType: "finance.payout.completed.v1",
          aggregateType: "PayoutRequest",
          aggregateId: payoutRequestId,
          aggregateVersion: request.version + 1,
          ownerModule: "finance",
          sellerAccountId: request.sellerAccountId,
          dataClassification: "FINANCIAL",
          payload: {
            payoutRequestId,
            payoutAttemptId: attempt.payoutAttemptId,
            payoutStatus: "PAID",
            amountMinor: request.amountMinor.toString(),
            currency: request.currency,
            completedAt: confirmation.providerOccurredAt.toISOString(),
          },
        },
        actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "finance.payout.confirm_paid",
          resourceType: "PayoutRequest",
          resourceId: payoutRequestId,
          sellerAccountId: request.sellerAccountId,
          actingRole: "PLATFORM",
          beforeRedacted: { payoutStatus: "CONFIRMATION_PENDING" },
          afterRedacted: { payoutStatus: "PAID", confirmationReference, journalId },
          dataClassification: "FINANCIAL",
        },
        actor,
      );
      return payoutView({
        ...request,
        payoutStatus: "PAID",
        completedByUserId: actorUserId,
        completedAt: confirmation.providerOccurredAt,
        version: request.version + 1,
        updatedAt: new Date(),
      });
    });
  }

  private async recordVerifiedProviderEvent(
    verified: VerifiedProviderEvent,
    payloadSha256: string,
    actor: ActorContext,
  ) {
    validateVerifiedProviderPayment(verified);
    return this.db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`finance-provider:${verified.providerCode}:${verified.externalEventId}`}, 0))`,
      );
      const [duplicate] = await transaction
        .select()
        .from(providerEventInbox)
        .where(
          and(
            eq(providerEventInbox.providerCode, verified.providerCode),
            eq(providerEventInbox.externalEventId, verified.externalEventId),
          ),
        );
      if (duplicate) {
        if (duplicate.payloadSha256 !== payloadSha256) {
          throw conflict("PROVIDER_EVENT_REPLAY_MISMATCH", "O mesmo evento chegou com conteúdo divergente.");
        }
        return {
          duplicate: true as const,
          processingResult: duplicate.processingResult,
          paymentId: duplicate.paymentId,
        };
      }
      const [payment] = await transaction
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.providerCode, verified.providerCode),
            eq(payments.providerPaymentReference, verified.providerPaymentReference),
          ),
        )
        .for("update");
      if (!payment) {
        await transaction.insert(providerEventInbox).values({
          providerEventId: createUuidV7(),
          providerCode: verified.providerCode,
          externalEventId: verified.externalEventId,
          payloadSha256,
          providerPaymentReference: verified.providerPaymentReference,
          processingResult: "PAYMENT_NOT_FOUND",
          providerOccurredAt: verified.providerOccurredAt,
          verifiedAt: new Date(),
        });
        return { duplicate: false as const, processingResult: "PAYMENT_NOT_FOUND" as const, paymentId: null };
      }
      assertProviderMatchesPayment(payment, verified);
      let processingResult:
        | "SETTLED"
        | "PAYMENT_QUARANTINED"
        | "IGNORED_FAILED"
        | "IGNORED_PENDING" =
        verified.providerState === "SETTLED"
          ? "SETTLED"
          : verified.providerState === "FAILED"
            ? "IGNORED_FAILED"
            : "IGNORED_PENDING";
      if (verified.providerState === "SETTLED") {
        processingResult = await this.settlePayment(transaction, payment, {
          settledAt: verified.providerOccurredAt,
          reconciliationStatus: "RECONCILED_PROVIDER",
          transitionSource: "PROVIDER_VERIFIED",
          sourceReference: verified.externalEventId,
          actor,
        });
      }
      await transaction.insert(providerEventInbox).values({
        providerEventId: createUuidV7(),
        providerCode: verified.providerCode,
        externalEventId: verified.externalEventId,
        payloadSha256,
        providerPaymentReference: verified.providerPaymentReference,
        paymentId: payment.paymentId,
        processingResult,
        providerOccurredAt: verified.providerOccurredAt,
        verifiedAt: new Date(),
      });
      return { duplicate: false as const, processingResult, paymentId: payment.paymentId };
    });
  }

  private async recordVerifiedProviderLookup(
    paymentId: string,
    lookup: VerifiedProviderLookup,
    actor: ActorContext,
  ) {
    validateVerifiedProviderPayment(lookup);
    return withSerializableTransaction(this.db, async (transaction) => {
      const [duplicate] = await transaction
        .select()
        .from(providerReconciliations)
        .where(
          and(
            eq(providerReconciliations.providerCode, lookup.providerCode),
            eq(providerReconciliations.providerReconciliationReference, lookup.reconciliationReference),
          ),
        );
      if (duplicate) return { duplicate: true as const, paymentId, providerState: duplicate.providerState };
      const [payment] = await transaction.select().from(payments).where(eq(payments.paymentId, paymentId)).for("update");
      if (!payment) throw notFound("PAYMENT_NOT_FOUND", "Pagamento não encontrado.");
      assertProviderMatchesPayment(payment, lookup);
      await transaction.insert(providerReconciliations).values({
        reconciliationId: createUuidV7(),
        paymentId,
        providerCode: lookup.providerCode,
        providerReconciliationReference: lookup.reconciliationReference,
        providerState: lookup.providerState,
        providerOccurredAt: lookup.providerOccurredAt,
      });
      if (lookup.providerState === "SETTLED") {
        await this.settlePayment(transaction, payment, {
          settledAt: lookup.providerOccurredAt,
          reconciliationStatus: "RECONCILED_PROVIDER",
          transitionSource: "PROVIDER_LOOKUP",
          sourceReference: lookup.reconciliationReference,
          actor,
        });
      }
      return { duplicate: false as const, paymentId, providerState: lookup.providerState };
    });
  }

  private async settlePayment(
    transaction: MidasTransaction,
    payment: PaymentRow,
    input: {
      settledAt: Date;
      reconciliationStatus: "RECONCILED_PROVIDER" | "RECONCILED_MANUAL";
      transitionSource: "PROVIDER_VERIFIED" | "PROVIDER_LOOKUP" | "MANUAL_RESOLUTION";
      sourceReference: string;
      actor: ActorContext;
    },
  ): Promise<"SETTLED" | "PAYMENT_QUARANTINED"> {
    if (payment.paymentStatus === "SETTLED") return "SETTLED";
    if (payment.paymentStatus === "PAYMENT_QUARANTINED") return "PAYMENT_QUARANTINED";
    if (payment.paymentStatus !== "PENDING") {
      throw conflict("PAYMENT_NOT_SETTLEABLE", "O pagamento não pode mais ser liquidado.");
    }
    const [order] = await transaction
      .select()
      .from(orderFinancialStates)
      .where(eq(orderFinancialStates.orderId, payment.orderId))
      .for("update");
    if (!order) throw notFound("ORDER_FINANCIAL_STATE_NOT_FOUND", "Pedido financeiro não encontrado.");
    if (order.fulfillmentStatus === "CANCELLED") {
      const quarantineId = createUuidV7();
      await transaction
        .update(payments)
        .set({
          paymentStatus: "PAYMENT_QUARANTINED",
          reconciliationStatus: input.reconciliationStatus,
          reconciledAt: input.settledAt,
          version: payment.version + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(payments.paymentId, payment.paymentId), eq(payments.paymentStatus, "PENDING")));
      await transaction.insert(paymentStateTransitions).values({
        transitionId: createUuidV7(),
        paymentId: payment.paymentId,
        fromStatus: "PENDING",
        toStatus: "PAYMENT_QUARANTINED",
        transitionSource: input.transitionSource,
        sourceReference: input.sourceReference,
        ...(input.actor.actorUserId ? { actorUserId: input.actor.actorUserId } : {}),
        occurredAt: input.settledAt,
      });
      await transaction.insert(paymentQuarantines).values({
        paymentQuarantineId: quarantineId,
        paymentId: payment.paymentId,
        providerCode: payment.providerCode ?? "UNSET",
        providerReference: payment.providerPaymentReference ?? "UNSET",
        providerEventReference: input.sourceReference,
        reasonCode: "LATE_SETTLEMENT_ORDER_CANCELLED",
        providerSettledAt: input.settledAt,
      });
      await appendOutboxEvent(
        transaction,
        {
          eventType: "finance.payment.quarantined.v1",
          aggregateType: "Payment",
          aggregateId: payment.paymentId,
          aggregateVersion: payment.version + 1,
          ownerModule: "finance",
          sellerAccountId: payment.sellerAccountId,
          dataClassification: "FINANCIAL",
          payload: {
            paymentId: payment.paymentId,
            orderId: payment.orderId,
            paymentQuarantineId: quarantineId,
            reasonCode: "LATE_SETTLEMENT_ORDER_CANCELLED",
            providerSettledAt: input.settledAt.toISOString(),
          },
        },
        input.actor,
      );
      await appendAuditEvent(
        transaction,
        {
          action: "finance.payment.quarantine_late_settlement",
          resourceType: "Payment",
          resourceId: payment.paymentId,
          sellerAccountId: payment.sellerAccountId,
          beforeRedacted: { paymentStatus: "PENDING", orderStatus: "CANCELLED" },
          afterRedacted: {
            paymentStatus: "PAYMENT_QUARANTINED",
            paymentQuarantineId: quarantineId,
            reasonCode: "LATE_SETTLEMENT_ORDER_CANCELLED",
          },
          dataClassification: "FINANCIAL",
        },
        input.actor,
      );
      return "PAYMENT_QUARANTINED";
    }
    const eligibleAt = calculateHoldEligibleAt(input.settledAt);
    const journalId = createUuidV7();
    const balanceLotId = createUuidV7();
    const holdId = createUuidV7();
    const providerAccountId = await this.ensureLedgerAccount(
      transaction,
      `platform:provider-clearing:${payment.currency}`,
      null,
      "PROVIDER_CLEARING",
      payment.currency,
    );
    const heldAccountId = await this.ensureLedgerAccount(
      transaction,
      `seller:${payment.sellerAccountId}:held:${payment.currency}`,
      payment.sellerAccountId,
      "SELLER_PAYABLE_HELD",
      payment.currency,
    );
    await this.insertBalancedJournal(transaction, {
      journalId,
      journalType: "PAYMENT_SETTLEMENT",
      referenceId: payment.paymentId,
      sellerAccountId: payment.sellerAccountId,
      currency: payment.currency,
      occurredAt: input.settledAt,
      actor: input.actor,
      entries: [
        { ledgerAccountId: providerAccountId, amountMinor: payment.amountMinor },
        { ledgerAccountId: heldAccountId, amountMinor: -payment.amountMinor },
      ],
    });
    await transaction
      .update(payments)
      .set({
        paymentStatus: "SETTLED",
        reconciliationStatus: input.reconciliationStatus,
        settledAt: input.settledAt,
        reconciledAt: input.settledAt,
        version: payment.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(payments.paymentId, payment.paymentId), eq(payments.paymentStatus, "PENDING")));
    await transaction.insert(paymentStateTransitions).values({
      transitionId: createUuidV7(),
      paymentId: payment.paymentId,
      fromStatus: "PENDING",
      toStatus: "SETTLED",
      transitionSource: input.transitionSource,
      sourceReference: input.sourceReference,
      ...(input.actor.actorUserId ? { actorUserId: input.actor.actorUserId } : {}),
      occurredAt: input.settledAt,
    });
    await transaction.insert(balanceLots).values({
      balanceLotId,
      paymentId: payment.paymentId,
      sellerAccountId: payment.sellerAccountId,
      currency: payment.currency,
      originalAmountMinor: payment.amountMinor,
      remainingAmountMinor: payment.amountMinor,
      reservedAmountMinor: 0n,
      lotStatus: "HELD",
    });
    await transaction.insert(holds).values({
      holdId,
      balanceLotId,
      holdStatus: "ACTIVE",
      startsAt: input.settledAt,
      eligibleAt,
      version: 1,
    });
    await transaction.insert(holdStateTransitions).values({
      transitionId: createUuidV7(),
      holdId,
      toStatus: "ACTIVE",
      reasonCode: "PAYMENT_SETTLED",
      ...(input.actor.actorUserId ? { actorUserId: input.actor.actorUserId } : {}),
      occurredAt: input.settledAt,
    });
    await appendOutboxEvent(
      transaction,
      {
        eventType: "finance.payment.settled.v1",
        aggregateType: "Payment",
        aggregateId: payment.paymentId,
        aggregateVersion: payment.version + 1,
        ownerModule: "finance",
        sellerAccountId: payment.sellerAccountId,
        dataClassification: "FINANCIAL",
        payload: {
          paymentId: payment.paymentId,
          orderId: payment.orderId,
          sellerAccountId: payment.sellerAccountId,
          amountMinor: payment.amountMinor.toString(),
          currency: payment.currency,
          reconciliationStatus: input.reconciliationStatus,
          settledAt: input.settledAt.toISOString(),
          balanceLotId,
          holdId,
          eligibleAt: eligibleAt.toISOString(),
        },
      },
      input.actor,
    );
    await appendAuditEvent(
      transaction,
      {
        action: "finance.payment.settle",
        resourceType: "Payment",
        resourceId: payment.paymentId,
        sellerAccountId: payment.sellerAccountId,
        beforeRedacted: { paymentStatus: "PENDING" },
        afterRedacted: {
          paymentStatus: "SETTLED",
          reconciliationStatus: input.reconciliationStatus,
          journalId,
          balanceLotId,
          holdId,
          eligibleAt: eligibleAt.toISOString(),
        },
        dataClassification: "FINANCIAL",
      },
      input.actor,
    );
    return "SETTLED";
  }

  private async ensureLedgerAccount(
    transaction: MidasTransaction,
    accountCode: string,
    sellerAccountId: string | null,
    accountType: string,
    currency: Currency,
  ): Promise<string> {
    const [existing] = await transaction
      .select({ ledgerAccountId: ledgerAccounts.ledgerAccountId })
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.accountCode, accountCode));
    if (existing) return existing.ledgerAccountId;
    const ledgerAccountId = createUuidV7();
    const inserted = await transaction
      .insert(ledgerAccounts)
      .values({
        ledgerAccountId,
        accountCode,
        ...(sellerAccountId ? { sellerAccountId } : {}),
        accountType,
        currency,
      })
      .onConflictDoNothing({ target: ledgerAccounts.accountCode })
      .returning({ ledgerAccountId: ledgerAccounts.ledgerAccountId });
    if (inserted[0]) return inserted[0].ledgerAccountId;
    const [concurrent] = await transaction
      .select({ ledgerAccountId: ledgerAccounts.ledgerAccountId })
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.accountCode, accountCode));
    if (!concurrent) throw new Error("LedgerAccount não pôde ser materializada.");
    return concurrent.ledgerAccountId;
  }

  private async insertBalancedJournal(
    transaction: MidasTransaction,
    input: {
      journalId: string;
      journalType: string;
      referenceId: string;
      sellerAccountId: string;
      currency: string;
      occurredAt: Date;
      actor: ActorContext;
      entries: Array<{ ledgerAccountId: string; amountMinor: bigint }>;
    },
  ): Promise<void> {
    if (input.entries.length < 2 || input.entries.reduce((sum, entry) => sum + entry.amountMinor, 0n) !== 0n) {
      throw new Error("Journal desbalanceado recusado antes da persistência.");
    }
    await transaction.insert(ledgerJournals).values({
      journalId: input.journalId,
      journalType: input.journalType,
      referenceId: input.referenceId,
      sellerAccountId: input.sellerAccountId,
      currency: input.currency,
      correlationId: input.actor.correlationId,
      ...(input.actor.actorUserId ? { actorUserId: input.actor.actorUserId } : {}),
      occurredAt: input.occurredAt,
    });
    await transaction.insert(ledgerEntries).values(
      input.entries.map((entry, index) => ({
        ledgerEntryId: createUuidV7(),
        journalId: input.journalId,
        ledgerAccountId: entry.ledgerAccountId,
        entrySequence: index + 1,
        amountMinor: entry.amountMinor,
      })),
    );
  }

  private async assertSellerMembership(
    userId: string,
    sellerAccountId: string,
    requirePayoutRole: boolean,
  ): Promise<void> {
    const now = new Date();
    const [membership] = await this.db
      .select({ membershipRole: sellerMemberships.membershipRole })
      .from(sellerMemberships)
      .where(
        and(
          eq(sellerMemberships.userId, userId),
          eq(sellerMemberships.sellerAccountId, sellerAccountId),
          eq(sellerMemberships.membershipStatus, "ACTIVE"),
          lte(sellerMemberships.validFrom, now),
          or(isNull(sellerMemberships.validUntil), gt(sellerMemberships.validUntil, now)),
        ),
      );
    if (!membership) throw notFound("SELLER_ACCOUNT_NOT_FOUND", "Conta vendedora não encontrada.");
    if (requirePayoutRole && !["OWNER", "MANAGER"].includes(membership.membershipRole)) {
      throw forbidden("PAYOUT_PERMISSION_MISSING", "A membership não pode solicitar saque.");
    }
  }

  private async assertPlatformPermission(userId: string, permissionCode: string): Promise<void> {
    const now = new Date();
    const [grant] = await this.db
      .select({ permissionCode: rolePermissions.permissionCode })
      .from(userRoleAssignments)
      .innerJoin(roles, eq(roles.roleId, userRoleAssignments.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.roleId))
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.assignmentStatus, "ACTIVE"),
          lte(userRoleAssignments.validFrom, now),
          or(isNull(userRoleAssignments.validUntil), gt(userRoleAssignments.validUntil, now)),
          eq(roles.roleScope, "PLATFORM"),
          eq(rolePermissions.permissionCode, permissionCode),
        ),
      );
    if (!grant) throw forbidden("PLATFORM_PERMISSION_MISSING", "A operação exige permissão administrativa explícita.");
  }
}

function paymentView(payment: PaymentRow) {
  return {
    paymentId: payment.paymentId,
    orderId: payment.orderId,
    buyerUserId: payment.buyerUserId,
    sellerAccountId: payment.sellerAccountId,
    providerCode: payment.providerCode,
    amountMinor: payment.amountMinor.toString(),
    currency: payment.currency,
    paymentStatus: payment.paymentStatus as
      | "PENDING"
      | "SETTLED"
      | "FAILED"
      | "CANCELLED"
      | "PAYMENT_QUARANTINED",
    reconciliationStatus: payment.reconciliationStatus as
      | "PENDING"
      | "RECONCILED_PROVIDER"
      | "RECONCILED_MANUAL",
    settledAt: payment.settledAt,
    createdAt: payment.createdAt,
  };
}

function resolutionView(resolutionCase: typeof paymentResolutionCases.$inferSelect) {
  return {
    resolutionCaseId: resolutionCase.resolutionCaseId,
    paymentId: resolutionCase.paymentId,
    caseStatus: resolutionCase.caseStatus as "OPEN" | "APPROVED" | "REJECTED",
    reasonCode: resolutionCase.reasonCode,
    evidenceLocator: resolutionCase.evidenceLocator,
    createdByUserId: resolutionCase.createdByUserId,
    reviewedByUserId: resolutionCase.reviewedByUserId,
    reviewReason: resolutionCase.reviewReason,
    createdAt: resolutionCase.createdAt,
    reviewedAt: resolutionCase.reviewedAt,
    version: resolutionCase.version,
  };
}

function payoutView(payout: PayoutRow) {
  return {
    payoutRequestId: payout.payoutRequestId,
    sellerAccountId: payout.sellerAccountId,
    requestedByUserId: payout.requestedByUserId,
    amountMinor: payout.amountMinor.toString(),
    currency: payout.currency,
    destinationCountry: payout.destinationCountry,
    payoutStatus: payout.payoutStatus as
      | "REQUESTED"
      | "UNDER_REVIEW"
      | "INFORMATION_REQUIRED"
      | "APPROVED"
      | "REJECTED"
      | "EXECUTING"
      | "CONFIRMATION_PENDING"
      | "PAID"
      | "FAILED"
      | "RETURNED"
      | "CANCELED",
    claimedByUserId: payout.claimedByUserId,
    approvedByUserId: payout.approvedByUserId,
    completedByUserId: payout.completedByUserId,
    claimedAt: payout.claimedAt,
    approvedAt: payout.approvedAt,
    completedAt: payout.completedAt,
    createdAt: payout.createdAt,
    version: payout.version,
  };
}

function assertProviderMatchesPayment(
  payment: PaymentRow,
  provider: Pick<VerifiedProviderEvent, "providerCode" | "providerPaymentReference" | "amountMinor" | "currency">,
): void {
  if (
    payment.providerCode !== provider.providerCode ||
    payment.providerPaymentReference !== provider.providerPaymentReference ||
    payment.amountMinor !== provider.amountMinor ||
    payment.currency !== normalizeCurrency(provider.currency)
  ) {
    throw conflict("PROVIDER_PAYMENT_MISMATCH", "O retorno do provider diverge do pagamento canônico.");
  }
}

function validateVerifiedProviderPayment(provider: {
  providerCode: string;
  providerPaymentReference: string;
  amountMinor: bigint;
  currency: string;
  providerOccurredAt: Date;
}): void {
  requireText(provider.providerCode, "providerCode", 120);
  requireText(provider.providerPaymentReference, "providerPaymentReference", 300);
  assertPositiveAmount(provider.amountMinor);
  normalizeCurrency(provider.currency);
  if (!Number.isFinite(provider.providerOccurredAt.getTime())) {
    throw validation("PROVIDER_DATE_INVALID", "A data confirmada pelo provider é inválida.");
  }
}

function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw validation("CURRENCY_INVALID", "Moeda inválida.");
  return normalized;
}

function normalizeCountryCode(countryCode: string): string {
  const normalized = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw validation("COUNTRY_CODE_INVALID", "País do destino inválido.");
  }
  return normalized;
}

function normalizeOptionalIdentifier(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return requireText(value, "identifier", 300);
}

function requireText(value: string, field: string, max: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw validation("VALIDATION_ERROR", `O campo ${field} é obrigatório e deve ter até ${String(max)} caracteres.`);
  }
  return normalized;
}

function assertPositiveAmount(amountMinor: bigint): void {
  if (amountMinor <= 0n) throw validation("AMOUNT_INVALID", "O valor deve ser positivo.");
}

function hashIdempotencyKey(key: string): string {
  const normalized = requireText(key, "idempotency-key", 200);
  if (normalized.length < 16) {
    throw validation("IDEMPOTENCY_KEY_INVALID", "A chave de idempotência deve ter ao menos 16 caracteres.");
  }
  return createHash("sha256").update(normalized).digest("hex");
}

function requireSha256(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw validation("EVIDENCE_HASH_INVALID", "O hash da evidência deve ser SHA-256 hexadecimal.");
  }
  return normalized;
}

function validation(code: string, detail: string): AppProblem {
  return new AppProblem({ status: 422, code, title: "Dados inválidos", detail });
}

function conflict(code: string, detail: string): AppProblem {
  return new AppProblem({ status: 409, code, title: "Conflito financeiro", detail });
}

function forbidden(code: string, detail: string): AppProblem {
  return new AppProblem({ status: 403, code, title: "Operação não autorizada", detail });
}

function notFound(code: string, detail: string): AppProblem {
  return new AppProblem({ status: 404, code, title: "Recurso não encontrado", detail });
}

function capabilityProblem(error: ProviderCapabilityError): AppProblem {
  return new AppProblem({
    status: 503,
    code: error.capability.reasonCode,
    title: "Provider de pagamento indisponível",
    detail: "A confirmação automática permanece bloqueada até contrato, adapter e credenciais válidos.",
  });
}

function payoutCapabilityProblem(error: PayoutCapabilityError): AppProblem {
  return new AppProblem({
    status: 503,
    code: error.capability.reasonCode,
    title: "Execução de saque indisponível",
    detail: "O saque permanece reservado até existir modo homologado para país, moeda e contrato.",
  });
}
