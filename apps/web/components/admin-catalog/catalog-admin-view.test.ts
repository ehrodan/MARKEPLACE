import { describe, expect, it } from "vitest";
import { isPendingApproval, normalizeCatalogSlug } from "./catalog-admin-view";

describe("admin catalog helpers", () => {
  it("normaliza o slug sem perder a intenção do nome", () => {
    expect(normalizeCatalogSlug("Faca Dragão Dourado ++")).toBe("faca-dragao-dourado");
    expect(normalizeCatalogSlug("  ITEM---2026  ")).toBe("item-2026");
  });

  it("libera decisão somente para ativo pendente", () => {
    expect(isPendingApproval("PENDING")).toBe(true);
    expect(isPendingApproval("APPROVED")).toBe(false);
    expect(isPendingApproval("REJECTED")).toBe(false);
  });
});
