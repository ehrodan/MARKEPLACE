import { describe, expect, it } from "vitest";
import {
  amountMinorSchema,
  completePayoutBodySchema,
  providerCapabilitySchema,
} from "../src/finance.js";

describe("contratos financeiros", () => {
  it("mantém dinheiro em unidade menor decimal sem float", () => {
    expect(amountMinorSchema.safeParse("7500").success).toBe(true);
    expect(amountMinorSchema.safeParse("75.00").success).toBe(false);
    expect(amountMinorSchema.safeParse("0").success).toBe(false);
  });

  it("não aceita conclusão externa sem referência e evidência", () => {
    expect(completePayoutBodySchema.safeParse({ externalReference: "", evidenceLocator: "" }).success).toBe(false);
  });

  it("publica capability fail-closed", () => {
    expect(
      providerCapabilitySchema.parse({
        providerCode: null,
        status: "CONTRACT_REQUIRED",
        reasonCode: "PROVIDER_CONTRACT_NOT_SELECTED",
      }),
    ).toBeTruthy();
  });
});
