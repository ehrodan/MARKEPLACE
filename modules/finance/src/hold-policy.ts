export const HOLD_DURATION_HOURS = 168;
export const HOLD_DURATION_MILLISECONDS = HOLD_DURATION_HOURS * 60 * 60 * 1_000;

export type HoldReleaseFacts = {
  now: Date;
  eligibleAt: Date;
  orderCompleted: boolean;
  paymentReconciled: boolean;
  disputeOpen: boolean;
  chargebackOpen: boolean;
  accountFrozen: boolean;
};

export type HoldReleaseDecision =
  | { releasable: true; reasonCode: "ELIGIBLE" }
  | {
      releasable: false;
      reasonCode:
        | "HOLD_WINDOW_ACTIVE"
        | "ORDER_NOT_COMPLETED"
        | "PAYMENT_NOT_RECONCILED"
        | "DISPUTE_OPEN"
        | "CHARGEBACK_OPEN"
        | "ACCOUNT_FROZEN";
    };

export function calculateHoldEligibleAt(settledAt: Date): Date {
  return new Date(settledAt.getTime() + HOLD_DURATION_MILLISECONDS);
}

export function evaluateHoldRelease(facts: HoldReleaseFacts): HoldReleaseDecision {
  if (facts.now.getTime() < facts.eligibleAt.getTime()) {
    return { releasable: false, reasonCode: "HOLD_WINDOW_ACTIVE" };
  }
  if (!facts.orderCompleted) return { releasable: false, reasonCode: "ORDER_NOT_COMPLETED" };
  if (!facts.paymentReconciled) return { releasable: false, reasonCode: "PAYMENT_NOT_RECONCILED" };
  if (facts.disputeOpen) return { releasable: false, reasonCode: "DISPUTE_OPEN" };
  if (facts.chargebackOpen) return { releasable: false, reasonCode: "CHARGEBACK_OPEN" };
  if (facts.accountFrozen) return { releasable: false, reasonCode: "ACCOUNT_FROZEN" };
  return { releasable: true, reasonCode: "ELIGIBLE" };
}
