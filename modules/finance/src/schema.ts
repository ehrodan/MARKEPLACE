import {
  bigint,
  boolean,
  char,
  integer,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@midas/identity";
import { sellerAccounts } from "@midas/sellers";

export const financeSchema = pgSchema("finance");

export const orderFinancialStates = financeSchema.table("order_financial_states", {
  orderId: uuid("order_id").primaryKey(),
  buyerUserId: uuid("buyer_user_id").notNull().references(() => users.userId),
  sellerAccountId: uuid("seller_account_id").notNull().references(() => sellerAccounts.sellerAccountId),
  fulfillmentStatus: text("fulfillment_status").notNull(),
  disputeOpen: boolean("dispute_open").notNull().default(false),
  chargebackOpen: boolean("chargeback_open").notNull().default(false),
  accountFrozen: boolean("account_frozen").notNull().default(false),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const payments = financeSchema.table(
  "payments",
  {
    paymentId: uuid("payment_id").primaryKey(),
    orderId: uuid("order_id").notNull().references(() => orderFinancialStates.orderId),
    buyerUserId: uuid("buyer_user_id").notNull().references(() => users.userId),
    sellerAccountId: uuid("seller_account_id").notNull().references(() => sellerAccounts.sellerAccountId),
    providerCode: text("provider_code"),
    providerPaymentReference: text("provider_payment_reference"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    paymentStatus: text("payment_status").notNull(),
    reconciliationStatus: text("reconciliation_status").notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true, mode: "date" }),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true, mode: "date" }),
    version: integer("version").notNull().default(1),
    createdByUserId: uuid("created_by_user_id").references(() => users.userId),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payments_provider_reference_uidx")
      .on(table.providerCode, table.providerPaymentReference),
  ],
);

export const paymentStateTransitions = financeSchema.table("payment_state_transitions", {
  transitionId: uuid("transition_id").primaryKey(),
  paymentId: uuid("payment_id").notNull().references(() => payments.paymentId),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  transitionSource: text("transition_source").notNull(),
  sourceReference: text("source_reference").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.userId),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const providerEventInbox = financeSchema.table(
  "provider_event_inbox",
  {
    providerEventId: uuid("provider_event_id").primaryKey(),
    providerCode: text("provider_code").notNull(),
    externalEventId: text("external_event_id").notNull(),
    payloadSha256: char("payload_sha256", { length: 64 }).notNull(),
    providerPaymentReference: text("provider_payment_reference").notNull(),
    paymentId: uuid("payment_id").references(() => payments.paymentId),
    processingResult: text("processing_result").notNull(),
    providerOccurredAt: timestamp("provider_occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("provider_event_inbox_delivery_uidx").on(table.providerCode, table.externalEventId)],
);

export const providerReconciliations = financeSchema.table(
  "provider_reconciliations",
  {
    reconciliationId: uuid("reconciliation_id").primaryKey(),
    paymentId: uuid("payment_id").notNull().references(() => payments.paymentId),
    providerCode: text("provider_code").notNull(),
    providerReconciliationReference: text("provider_reconciliation_reference").notNull(),
    providerState: text("provider_state").notNull(),
    providerOccurredAt: timestamp("provider_occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("provider_reconciliations_reference_uidx").on(
      table.providerCode,
      table.providerReconciliationReference,
    ),
  ],
);

export const paymentQuarantines = financeSchema.table("payment_quarantines", {
  paymentQuarantineId: uuid("payment_quarantine_id").primaryKey(),
  paymentId: uuid("payment_id").notNull().unique().references(() => payments.paymentId),
  providerCode: text("provider_code").notNull(),
  providerReference: text("provider_reference").notNull(),
  providerEventReference: text("provider_event_reference").notNull().unique(),
  reasonCode: text("reason_code").notNull(),
  providerSettledAt: timestamp("provider_settled_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const paymentResolutionCases = financeSchema.table("payment_resolution_cases", {
  resolutionCaseId: uuid("resolution_case_id").primaryKey(),
  paymentId: uuid("payment_id").notNull().references(() => payments.paymentId),
  caseStatus: text("case_status").notNull(),
  reasonCode: text("reason_code").notNull(),
  evidenceLocator: text("evidence_locator").notNull(),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.userId),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.userId),
  reviewReason: text("review_reason"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  version: integer("version").notNull().default(1),
});

export const paymentResolutionCaseHistory = financeSchema.table("payment_resolution_case_history", {
  historyId: uuid("history_id").primaryKey(),
  resolutionCaseId: uuid("resolution_case_id").notNull().references(() => paymentResolutionCases.resolutionCaseId),
  caseStatus: text("case_status").notNull(),
  actorUserId: uuid("actor_user_id").notNull().references(() => users.userId),
  reason: text("reason").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const ledgerAccounts = financeSchema.table("ledger_accounts", {
  ledgerAccountId: uuid("ledger_account_id").primaryKey(),
  accountCode: text("account_code").notNull().unique(),
  sellerAccountId: uuid("seller_account_id").references(() => sellerAccounts.sellerAccountId),
  accountType: text("account_type").notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const ledgerJournals = financeSchema.table(
  "ledger_journals",
  {
    journalId: uuid("journal_id").primaryKey(),
    journalType: text("journal_type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    sellerAccountId: uuid("seller_account_id").notNull().references(() => sellerAccounts.sellerAccountId),
    currency: char("currency", { length: 3 }).notNull(),
    correlationId: text("correlation_id").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.userId),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ledger_journals_reference_uidx").on(table.journalType, table.referenceId)],
);

export const ledgerEntries = financeSchema.table(
  "ledger_entries",
  {
    ledgerEntryId: uuid("ledger_entry_id").primaryKey(),
    journalId: uuid("journal_id").notNull().references(() => ledgerJournals.journalId),
    ledgerAccountId: uuid("ledger_account_id").notNull().references(() => ledgerAccounts.ledgerAccountId),
    entrySequence: smallint("entry_sequence").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ledger_entries_journal_sequence_uidx").on(table.journalId, table.entrySequence)],
);

export const balanceLots = financeSchema.table("balance_lots", {
  balanceLotId: uuid("balance_lot_id").primaryKey(),
  paymentId: uuid("payment_id").notNull().unique().references(() => payments.paymentId),
  sellerAccountId: uuid("seller_account_id").notNull().references(() => sellerAccounts.sellerAccountId),
  currency: char("currency", { length: 3 }).notNull(),
  originalAmountMinor: bigint("original_amount_minor", { mode: "bigint" }).notNull(),
  remainingAmountMinor: bigint("remaining_amount_minor", { mode: "bigint" }).notNull(),
  reservedAmountMinor: bigint("reserved_amount_minor", { mode: "bigint" }).notNull().default(0n),
  lotStatus: text("lot_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const holds = financeSchema.table("holds", {
  holdId: uuid("hold_id").primaryKey(),
  balanceLotId: uuid("balance_lot_id").notNull().unique().references(() => balanceLots.balanceLotId),
  holdStatus: text("hold_status").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
  eligibleAt: timestamp("eligible_at", { withTimezone: true, mode: "date" }).notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true, mode: "date" }),
  releaseJournalId: uuid("release_journal_id").references(() => ledgerJournals.journalId),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const holdStateTransitions = financeSchema.table("hold_state_transitions", {
  transitionId: uuid("transition_id").primaryKey(),
  holdId: uuid("hold_id").notNull().references(() => holds.holdId),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reasonCode: text("reason_code").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.userId),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const payoutRequests = financeSchema.table(
  "payout_requests",
  {
    payoutRequestId: uuid("payout_request_id").primaryKey(),
    sellerAccountId: uuid("seller_account_id").notNull().references(() => sellerAccounts.sellerAccountId),
    requestedByUserId: uuid("requested_by_user_id").notNull().references(() => users.userId),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    destinationCountry: char("destination_country", { length: 2 }).notNull(),
    idempotencyKeyHash: char("idempotency_key_hash", { length: 64 }).notNull(),
    payoutStatus: text("payout_status").notNull(),
    claimedByUserId: uuid("claimed_by_user_id").references(() => users.userId),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.userId),
    completedByUserId: uuid("completed_by_user_id").references(() => users.userId),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("payout_requests_idempotency_uidx").on(table.sellerAccountId, table.idempotencyKeyHash)],
);

export const payoutRequestLots = financeSchema.table(
  "payout_request_lots",
  {
    payoutRequestId: uuid("payout_request_id").notNull().references(() => payoutRequests.payoutRequestId),
    balanceLotId: uuid("balance_lot_id").notNull().references(() => balanceLots.balanceLotId),
    allocatedAmountMinor: bigint("allocated_amount_minor", { mode: "bigint" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.payoutRequestId, table.balanceLotId] })],
);

export const payoutAttempts = financeSchema.table(
  "payout_attempts",
  {
    payoutAttemptId: uuid("payout_attempt_id").primaryKey(),
    payoutRequestId: uuid("payout_request_id").notNull().references(() => payoutRequests.payoutRequestId),
    attemptNumber: integer("attempt_number").notNull(),
    executionMode: text("execution_mode").notNull(),
    attemptStatus: text("attempt_status").notNull(),
    externalReference: text("external_reference").notNull(),
    idempotencyKeyHash: char("idempotency_key_hash", { length: 64 }).notNull(),
    executedByUserId: uuid("executed_by_user_id").notNull().references(() => users.userId),
    executedAt: timestamp("executed_at", { withTimezone: true, mode: "date" }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payout_attempts_number_uidx").on(table.payoutRequestId, table.attemptNumber),
    uniqueIndex("payout_attempts_idempotency_uidx").on(table.payoutRequestId, table.idempotencyKeyHash),
  ],
);

export const payoutEvidence = financeSchema.table("payout_evidence", {
  payoutEvidenceId: uuid("payout_evidence_id").primaryKey(),
  payoutAttemptId: uuid("payout_attempt_id").notNull().references(() => payoutAttempts.payoutAttemptId),
  evidenceLocator: text("evidence_locator").notNull(),
  evidenceSha256: char("evidence_sha256", { length: 64 }),
  recordedByUserId: uuid("recorded_by_user_id").notNull().references(() => users.userId),
  recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const payoutConfirmations = financeSchema.table("payout_confirmations", {
  payoutConfirmationId: uuid("payout_confirmation_id").primaryKey(),
  payoutAttemptId: uuid("payout_attempt_id").notNull().unique().references(() => payoutAttempts.payoutAttemptId),
  confirmationReference: text("confirmation_reference").notNull().unique(),
  evidenceLocator: text("evidence_locator").notNull(),
  evidenceSha256: char("evidence_sha256", { length: 64 }).notNull(),
  idempotencyKeyHash: char("idempotency_key_hash", { length: 64 }).notNull(),
  confirmedByUserId: uuid("confirmed_by_user_id").notNull().references(() => users.userId),
  providerConfirmedAt: timestamp("provider_confirmed_at", { withTimezone: true, mode: "date" }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const payoutStateTransitions = financeSchema.table("payout_state_transitions", {
  transitionId: uuid("transition_id").primaryKey(),
  payoutRequestId: uuid("payout_request_id").notNull().references(() => payoutRequests.payoutRequestId),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reasonCode: text("reason_code").notNull(),
  actorUserId: uuid("actor_user_id").notNull().references(() => users.userId),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});
