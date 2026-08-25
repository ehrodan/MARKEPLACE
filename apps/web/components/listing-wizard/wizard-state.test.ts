import { describe, expect, it } from "vitest";
import type { SellerListing } from "@/components/seller-listings/types";
import {
  addRates,
  buildCreateListingBody,
  buildUpdateListingBody,
  centsToPriceInput,
  computeFeeBreakdown,
  createEmptyDraft,
  draftFromListing,
  draftStorageKey,
  estimateCaveats,
  evaluateWizard,
  fieldErrors,
  hasPendingChanges,
  isFieldEditable,
  multiplyMinorByRate,
  parseDeliveryWindowHours,
  parseQuantity,
  parseStoredDraft,
  serializeDraft,
  type WizardContext,
  type WizardDraft,
} from "./wizard-state";

const CATALOG_ITEM_ID = "0192f0aa-0000-7000-8000-000000000001";
const LISTING_PLAN_ID = "0192f0aa-0000-7000-8000-000000000002";

function completeDraft(overrides: Partial<WizardDraft> = {}): WizardDraft {
  return {
    ...createEmptyDraft(),
    catalogItemId: CATALOG_ITEM_ID,
    publicSlug: "ak-47-vulcan-field-tested",
    conditionNotes: "Unidade única, sem stickers, entregue por troca no jogo.",
    quantityAvailable: "1",
    priceInput: "1.249,90",
    listingPlanId: LISTING_PLAN_ID,
    proofKind: "INVENTORY_CAPTURE",
    proofReference: "Captura do inventário com a data visível na interface do jogo.",
    proofAttested: true,
    deliveryMethod: "IN_GAME_TRADE",
    deliveryWindowHours: "24",
    deliveryInstructions: "Combino a troca pelo canal da plataforma e confirmo no jogo.",
    ...overrides,
  };
}

function context(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    catalogItemIds: [CATALOG_ITEM_ID],
    listingPlanIds: [LISTING_PLAN_ID],
    listingStatus: null,
    ...overrides,
  };
}

describe("multiplyMinorByRate", () => {
  it.each([
    ["10000", "0.12", "1200"],
    ["1250", "0.125", "156"],
    ["1500", "0.125", "188"],
    ["9990", "0.0000", "0"],
    ["9990", "1", "9990"],
  ])("%s x %s = %s", (amount, rate, expected) => {
    expect(multiplyMinorByRate(amount, rate)).toBe(expected);
  });

  it("permanece exato acima do limite de Number.MAX_SAFE_INTEGER", () => {
    expect(multiplyMinorByRate("90071992547409910000", "0.10")).toBe("9007199254740991000");
  });

  it("rejeita entrada que não é minor unit inteira ou taxa decimal", () => {
    expect(multiplyMinorByRate("12,50", "0.12")).toBeNull();
    expect(multiplyMinorByRate("1250", "12%")).toBeNull();
  });
});

describe("addRates", () => {
  it.each([
    ["0.1200", "0.0399", "0.1599"],
    ["0.12", "0.0399", "0.1599"],
    ["0", "0", "0"],
  ])("%s + %s = %s", (a, b, expected) => {
    expect(addRates(a, b)).toBe(expected);
  });
});

describe("computeFeeBreakdown", () => {
  it("devolve bruto, taxas e líquido em minor units string", () => {
    const breakdown = computeFeeBreakdown({
      priceMinor: "124990",
      quantity: 1,
      platformFeeRate: "0.1200",
      pspFeeRate: "0.0399",
    });

    expect(breakdown).toEqual({
      grossMinor: "124990",
      platformFeeMinor: "14999",
      pspFeeMinor: "4987",
      netMinor: "105004",
      netIfAllUnitsSoldMinor: "105004",
      effectiveRate: "0.1599",
    });
  });

  it("mantém a identidade bruto - taxas = líquido", () => {
    const breakdown = computeFeeBreakdown({
      priceMinor: "999999999999999999999",
      quantity: 3,
      platformFeeRate: "0.15",
      pspFeeRate: "0.02",
    });
    if (!breakdown) throw new Error("breakdown esperado");

    const gross = BigInt(breakdown.grossMinor);
    const fees = BigInt(breakdown.platformFeeMinor) + BigInt(breakdown.pspFeeMinor);
    expect((gross - fees).toString()).toBe(breakdown.netMinor);
    expect(breakdown.netIfAllUnitsSoldMinor).toBe((BigInt(breakdown.netMinor) * 3n).toString());
  });

  it("recusa quantidade inválida em vez de arredondar em silêncio", () => {
    expect(
      computeFeeBreakdown({
        priceMinor: "124990",
        quantity: 0,
        platformFeeRate: "0.12",
        pspFeeRate: "0.03",
      }),
    ).toBeNull();
  });
});

describe("estimateCaveats", () => {
  it("nomeia o snapshot não congelado enquanto o rascunho não existe no servidor", () => {
    const caveats = estimateCaveats({ listingStatus: null, quantity: 1 });
    expect(caveats.some((text) => text.includes("snapshot comercial"))).toBe(true);
  });

  it("nomeia a dependência de quantidade quando há mais de uma unidade", () => {
    const caveats = estimateCaveats({ listingStatus: "DRAFT", quantity: 4 });
    expect(caveats.some((text) => text.includes("quantas unidades"))).toBe(true);
    expect(caveats.some((text) => text.includes("snapshot comercial"))).toBe(false);
  });
});

describe("evaluateWizard", () => {
  it("marca todos os passos de dados como pendentes num rascunho vazio", () => {
    const evaluation = evaluateWizard(createEmptyDraft(), context());
    const pending = evaluation.steps.filter((step) => step.status === "pending").map((step) => step.id);

    expect(pending).toEqual(["item", "pricing", "proof", "delivery", "publish"]);
    expect(evaluation.canSubmitDraft).toBe(false);
    expect(evaluation.canPublish).toBe(false);
  });

  it("libera a gravação do rascunho mas não a publicação enquanto o servidor não tem o anúncio", () => {
    const evaluation = evaluateWizard(completeDraft(), context());

    expect(evaluation.canSubmitDraft).toBe(true);
    expect(evaluation.canPublish).toBe(false);
    expect(evaluation.publishBlockers).toHaveLength(1);
    expect(evaluation.publishBlockers[0]?.message).toContain("ainda não foi gravado no servidor");
  });

  it("libera a publicação apenas em DRAFT ou REVIEW, espelhando LISTING_NOT_PUBLISHABLE", () => {
    const draft = completeDraft();
    expect(evaluateWizard(draft, context({ listingStatus: "DRAFT" })).canPublish).toBe(true);
    expect(evaluateWizard(draft, context({ listingStatus: "REVIEW" })).canPublish).toBe(true);

    const published = evaluateWizard(draft, context({ listingStatus: "PUBLISHED" }));
    expect(published.canPublish).toBe(false);
    expect(published.publishBlockers[0]?.message).toContain("PUBLISHED");
  });

  it("aponta o campo exato de cada bloqueio para o botão de publicar poder navegar até ele", () => {
    const draft = completeDraft({ priceInput: "", proofAttested: false });
    const evaluation = evaluateWizard(draft, context({ listingStatus: "DRAFT" }));

    expect(evaluation.publishBlockers.map((item) => [item.stepId, item.fieldKey])).toEqual([
      ["pricing", "priceInput"],
      ["proof", "proofAttested"],
    ]);
  });

  it("rejeita item ou plano que não vieram da API", () => {
    const draft = completeDraft({ catalogItemId: "outro-item", listingPlanId: "outro-plano" });
    const evaluation = evaluateWizard(draft, context());
    const messages = evaluation.blockers.map((item) => item.message);

    expect(messages).toContain("O item escolhido não está entre os itens retornados pela API.");
    expect(messages).toContain(
      "O plano escolhido não está ativo na resposta de /v1/catalog/listing-plans.",
    );
  });
});

describe("fieldErrors", () => {
  it("expõe o primeiro erro por campo para ligar em aria-describedby", () => {
    const evaluation = evaluateWizard(createEmptyDraft(), context());
    const errors = fieldErrors(evaluation.blockers);

    expect(errors.catalogItemId).toBe("Escolha o item do catálogo que será anunciado.");
    expect(errors.priceInput).toBe("Informe um preço maior que zero, por exemplo 1.249,90.");
    expect(errors.deliveryInstructions).toBe("Explique o passo a passo que o comprador vai seguir.");
  });
});

describe("parseQuantity e parseDeliveryWindowHours", () => {
  it.each([
    ["1", 1],
    ["10000", 10_000],
  ])("aceita quantidade %s", (input, expected) => {
    expect(parseQuantity(input)).toBe(expected);
  });

  it.each(["0", "10001", "1,5", "", "dois"])('rejeita quantidade "%s"', (input) => {
    expect(parseQuantity(input)).toBeNull();
  });

  it.each(["0", "169", "-1", "24h"])('rejeita prazo "%s"', (input) => {
    expect(parseDeliveryWindowHours(input)).toBeNull();
  });

  it("aceita prazo dentro de 7 dias", () => {
    expect(parseDeliveryWindowHours("168")).toBe(168);
  });
});

describe("isFieldEditable", () => {
  it("libera tudo antes da criação", () => {
    expect(isFieldEditable("catalogItemId", null)).toBe(true);
    expect(isFieldEditable("proofReference", null)).toBe(true);
  });

  it("congela o que o PATCH não aceita depois da criação", () => {
    expect(isFieldEditable("priceInput", "DRAFT")).toBe(true);
    expect(isFieldEditable("quantityAvailable", "DRAFT")).toBe(true);
    expect(isFieldEditable("conditionNotes", "DRAFT")).toBe(true);
    expect(isFieldEditable("catalogItemId", "DRAFT")).toBe(false);
    expect(isFieldEditable("listingPlanId", "DRAFT")).toBe(false);
    expect(isFieldEditable("proofReference", "PUBLISHED")).toBe(false);
    expect(isFieldEditable("deliveryMethod", "PUBLISHED")).toBe(false);
  });
});

describe("buildCreateListingBody", () => {
  it("devolve null enquanto houver bloqueio", () => {
    expect(buildCreateListingBody(createEmptyDraft(), "seller_1", context())).toBeNull();
  });

  it("monta o corpo aceito por POST /v1/listings", () => {
    const body = buildCreateListingBody(completeDraft(), "seller_1", context());

    expect(body).toEqual({
      publicSlug: "ak-47-vulcan-field-tested",
      catalogItemId: CATALOG_ITEM_ID,
      sellerAccountId: "seller_1",
      listingPlanId: LISTING_PLAN_ID,
      priceMinor: "124990",
      currency: "BRL",
      quantityAvailable: 1,
      conditionNotes: "Unidade única, sem stickers, entregue por troca no jogo.",
      metadata: {
        ownershipProof: {
          kind: "INVENTORY_CAPTURE",
          reference: "Captura do inventário com a data visível na interface do jogo.",
        },
        delivery: {
          method: "IN_GAME_TRADE",
          windowHours: 24,
          instructions: "Combino a troca pelo canal da plataforma e confirmo no jogo.",
        },
      },
    });
  });

  it("normaliza o slug para minúsculas", () => {
    const body = buildCreateListingBody(
      completeDraft({ publicSlug: "  AK-47-Vulcan  " }),
      "seller_1",
      context(),
    );
    expect(body?.publicSlug).toBe("ak-47-vulcan");
  });
});

describe("buildUpdateListingBody", () => {
  const current = { priceMinor: "124990", quantityAvailable: 1, conditionNotes: "Texto original." };

  it("não envia nada quando nada mudou", () => {
    const body = buildUpdateListingBody(
      completeDraft({ conditionNotes: "Texto original." }),
      current,
      "sem motivo",
    );
    expect(body).toEqual({});
    expect(hasPendingChanges(body)).toBe(false);
  });

  it("envia apenas os campos alterados junto do motivo", () => {
    const body = buildUpdateListingBody(
      completeDraft({ priceInput: "999,00", conditionNotes: "Texto original." }),
      current,
      "Ajuste de preço combinado com o comprador",
    );

    expect(body).toEqual({
      priceMinor: "99900",
      changeReason: "Ajuste de preço combinado com o comprador",
    });
    expect(hasPendingChanges(body)).toBe(true);
  });

  it("trata quantidade e descrição de forma independente", () => {
    const body = buildUpdateListingBody(
      completeDraft({ quantityAvailable: "3", conditionNotes: "Nova descrição." }),
      current,
      "",
    );
    expect(body).toEqual({ quantityAvailable: 3, conditionNotes: "Nova descrição." });
    expect(body.changeReason).toBeUndefined();
  });
});

describe("draftFromListing", () => {
  const listing: SellerListing = {
    listingId: "listing-1",
    publicSlug: "ak-47-vulcan-field-tested",
    catalogItemId: CATALOG_ITEM_ID,
    sellerAccountId: "seller_1",
    listingPlanId: LISTING_PLAN_ID,
    listingStatus: "DRAFT",
    priceMinor: "124990",
    currency: "BRL",
    quantityAvailable: 2,
    quantitySold: 0,
    conditionNotes: "Unidade única.",
    metadata: {
      ownershipProof: { kind: "PUBLIC_INVENTORY_LINK", reference: "Perfil público do inventário." },
      delivery: { method: "IN_GAME_GIFT", windowHours: 12, instructions: "Envio como presente." },
    },
    publishedAt: null,
    pausedAt: null,
    version: 1,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
  };

  it("reidrata o rascunho a partir do anúncio real", () => {
    const draft = draftFromListing(listing);

    expect(draft.priceInput).toBe("1.249,90");
    expect(draft.quantityAvailable).toBe("2");
    expect(draft.proofKind).toBe("PUBLIC_INVENTORY_LINK");
    expect(draft.deliveryMethod).toBe("IN_GAME_GIFT");
    expect(draft.deliveryWindowHours).toBe("12");
    expect(draft.proofAttested).toBe(true);
  });

  it("não inventa declaração quando o anúncio veio sem metadata", () => {
    const draft = draftFromListing({ ...listing, metadata: {} });

    expect(draft.proofKind).toBe("");
    expect(draft.proofReference).toBe("");
    expect(draft.proofAttested).toBe(false);
    expect(draft.deliveryMethod).toBe("");
    expect(draft.deliveryWindowHours).toBe("");
  });

  it("ignora metadata com formato inesperado em vez de quebrar", () => {
    const draft = draftFromListing({
      ...listing,
      metadata: { ownershipProof: "texto solto", delivery: { method: "TELEPORTE", windowHours: -3 } },
    });

    expect(draft.proofKind).toBe("");
    expect(draft.deliveryMethod).toBe("");
    expect(draft.deliveryWindowHours).toBe("");
  });
});

describe("centsToPriceInput", () => {
  it.each([
    ["124990", "1.249,90"],
    ["5", "0,05"],
    ["100", "1,00"],
  ])("%s vira %s", (minor, expected) => {
    expect(centsToPriceInput(minor)).toBe(expected);
  });
});

describe("persistência local do rascunho", () => {
  it("faz round-trip sem perder campo", () => {
    const draft = completeDraft();
    expect(parseStoredDraft(serializeDraft(draft))).toEqual(draft);
  });

  it("descarta conteúdo corrompido em vez de propagar lixo", () => {
    expect(parseStoredDraft(null)).toBeNull();
    expect(parseStoredDraft("{quebrado")).toBeNull();
    expect(parseStoredDraft("[]")).toBeNull();
    expect(parseStoredDraft('"texto"')).toBeNull();
  });

  it("saneia campos com tipo errado", () => {
    const restored = parseStoredDraft(
      JSON.stringify({ publicSlug: 12, proofKind: "INVENTADO", proofAttested: "sim" }),
    );

    expect(restored?.publicSlug).toBe("");
    expect(restored?.proofKind).toBe("");
    expect(restored?.proofAttested).toBe(false);
    expect(restored?.quantityAvailable).toBe("1");
  });

  it("separa a chave de rascunho novo da chave de edição", () => {
    expect(draftStorageKey({ sellerAccountId: "seller_1" })).toBe(
      "midas.listing-wizard.new.seller_1",
    );
    expect(draftStorageKey({ sellerAccountId: "seller_1", listingId: "listing-1" })).toBe(
      "midas.listing-wizard.edit.listing-1",
    );
  });
});
