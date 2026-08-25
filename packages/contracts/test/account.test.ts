import { describe, expect, it } from "vitest";
import {
  createSellerAccountBodySchema,
  registerUserBodySchema,
  sellerAccountIdSchema,
} from "../src/index.js";

describe("account contracts", () => {
  it("recusa senha curta e campos adicionais", () => {
    expect(
      registerUserBodySchema.safeParse({
        email: "pessoa@example.com",
        password: "curta",
        displayName: "Pessoa",
        acceptedTermsVersion: "terms-v1",
        isMaster: true,
      }).success,
    ).toBe(false);
  });

  it("não aceita PLATFORM como conta criada pelo usuário", () => {
    expect(
      createSellerAccountBodySchema.safeParse({
        displayName: "Minha loja",
        accountType: "PLATFORM",
      }).success,
    ).toBe(false);
  });

  it("valida prefixo de SellerAccount", () => {
    expect(sellerAccountIdSchema.safeParse("usr_0194fca1-7c2a-7b51-8c60-1ea44a5c6732").success).toBe(false);
  });
});
