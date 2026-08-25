import { describe, expect, it } from "vitest";
import {
  calculateHoldEligibleAt,
  evaluateHoldRelease,
  HOLD_DURATION_MILLISECONDS,
  PaymentProviderRegistry,
  PayoutCapabilityError,
  PayoutExecutionCapabilityRegistry,
  ProviderCapabilityError,
} from "../src/index.js";

describe("políticas financeiras fail-closed", () => {
  it("ancora o hold exatamente em settledAt + 168h e libera na borda", () => {
    const settledAt = new Date("2026-08-23T12:00:00.000Z");
    const eligibleAt = calculateHoldEligibleAt(settledAt);
    expect(eligibleAt.getTime() - settledAt.getTime()).toBe(HOLD_DURATION_MILLISECONDS);
    expect(
      evaluateHoldRelease({
        now: new Date(eligibleAt.getTime() - 1),
        eligibleAt,
        orderCompleted: true,
        paymentReconciled: true,
        disputeOpen: false,
        chargebackOpen: false,
        accountFrozen: false,
      }),
    ).toEqual({ releasable: false, reasonCode: "HOLD_WINDOW_ACTIVE" });
    expect(
      evaluateHoldRelease({
        now: eligibleAt,
        eligibleAt,
        orderCompleted: true,
        paymentReconciled: true,
        disputeOpen: false,
        chargebackOpen: false,
        accountFrozen: false,
      }),
    ).toEqual({ releasable: true, reasonCode: "ELIGIBLE" });
  });

  it("não inventa provider quando contrato não foi escolhido", async () => {
    const registry = new PaymentProviderRegistry();
    expect(registry.capability()).toMatchObject({
      status: "CONTRACT_REQUIRED",
      reasonCode: "PROVIDER_CONTRACT_NOT_SELECTED",
    });
    await expect(registry.lookupPayment("pix", "unknown")).rejects.toBeInstanceOf(
      ProviderCapabilityError,
    );
  });

  it("não executa nem confirma payout sem modo homologado", async () => {
    const registry = new PayoutExecutionCapabilityRegistry();
    const context = { countryCode: "BR", currency: "BRL", mode: "EXTERNAL_MANUAL" as const };
    expect(registry.capability(context)).toMatchObject({
      status: "CONTRACT_REQUIRED",
      reasonCode: "PAYOUT_CONTRACT_NOT_SELECTED",
    });
    await expect(
      registry.validateExecution({
        ...context,
        payoutRequestId: "0198f5f8-8f04-7a4d-8af4-3be2437f8123",
        amountMinor: 100n,
        externalReference: "external-1",
        evidenceSha256: "a".repeat(64),
      }),
    ).rejects.toBeInstanceOf(PayoutCapabilityError);
    await expect(
      registry.lookupConfirmation({
        ...context,
        providerExecutionReference: "external-1",
        confirmationEvidenceSha256: "b".repeat(64),
      }),
    ).rejects.toBeInstanceOf(PayoutCapabilityError);
  });
});
