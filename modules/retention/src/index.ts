export {
  REMINDER_POLICY_VERSION,
  REMINDER_PURPOSES,
  REMINDER_CHANNELS,
  TRANSACTIONAL_PURPOSES,
  MARKETING_PURPOSES,
  PULL_CHANNELS,
  QUIET_HOURS_CHANNELS,
  REMINDER_FREQUENCY_LIMITS,
  MARKETING_MINIMUM_INTERVAL_MS,
  QUIET_HOURS_WINDOW,
  SAVED_CART_TTL_DAYS,
  SAVED_CART_TTL_MS,
  REMINDER_SUPPRESSION_REASONS,
  REMINDER_SUPPRESSION_MESSAGES,
  isTransactionalPurpose,
  isMarketingPurpose,
  isPullChannel,
  requiresExplicitConsent,
  evaluateConsentState,
  hourInTimeZone,
  isWithinQuietHours,
  quietHoursApply,
  shouldRemind,
} from "./reminder-policy.js";
export type {
  ReminderPurpose,
  ReminderChannel,
  ReminderSuppressionReason,
  ReminderConsentFact,
  ConsentState,
  ReminderFrequencyFact,
  ReminderSubjectFact,
  ReminderPolicyInput,
  ReminderDecision,
} from "./reminder-policy.js";

export {
  CONSENT_POLICY_VERSION,
  ConsentService,
  assertRetentionActor,
  buildConsentEvidence,
  toConsentFact,
} from "./consent.js";
export type {
  ConsentEvidenceInput,
  ConsentTarget,
  ConsentStatus,
  GrantConsentInput,
  RevokeConsentInput,
} from "./consent.js";

export { SavedCartService, SAVED_CART_STATUSES } from "./saved-cart-service.js";
export type {
  SavedCartStatus,
  SaveCartSnapshotInput,
  SavedCartPage,
} from "./saved-cart-service.js";

export {
  WatchlistService,
  WATCHLIST_KINDS,
  WATCHLIST_STATUSES,
  WATCHLIST_TRIGGER_REASONS,
  evaluateWatchlistPriceChange,
  evaluateWatchlistStockChange,
} from "./watchlist-service.js";
export type {
  WatchlistKind,
  WatchlistStatus,
  WatchlistPriceFacts,
  WatchlistStockFacts,
  WatchlistTriggerReason,
  WatchlistTriggerDecision,
  WatchlistTriggerHit,
  WatchInput,
} from "./watchlist-service.js";

export {
  ReminderService,
  NOTIFICATION_KINDS,
  NOTIFICATION_PURPOSE_BY_KIND,
} from "./reminder-service.js";
export type {
  NotificationKind,
  EnqueueReminderInput,
  EnqueueReminderResult,
  CreateNotificationInput,
} from "./reminder-service.js";

export * from "./schema.js";
