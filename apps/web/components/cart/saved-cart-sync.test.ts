import { describe, expect, it } from "vitest";
import { CART_STORAGE_KEY, type StorageLike, type StoredCartLine } from "./cart-storage";
import {
  CART_SOURCE_ID_KEY,
  MAX_SNAPSHOT_ITEMS,
  applySavedCartSnapshot,
  isUuid,
  parseSavedCartEnvelope,
  parseSavedCartRecord,
  resolveCartSourceId,
  serverCartIdOf,
  toSavedCartPayload,
  type SavedCartSnapshotItem,
} from "./saved-cart-sync";

const CART_ID = "0198f4a2-1111-7abc-8def-0123456789ab";
const LISTING_A = "0198f4a2-aaaa-7abc-8def-0123456789ab";
const LISTING_B = "0198f4a2-bbbb-7abc-8def-0123456789ab";
const LISTING_C = "0198f4a2-cccc-7abc-8def-0123456789ab";

function line(overrides: Partial<StoredCartLine> = {}): StoredCartLine {
  return {
    listingId: LISTING_A,
    publicSlug: "ak-47-redline",
    title: "AK-47 Redline",
    sellerAccountId: "seller-1",
    unitPriceMinor: "129900",
    currency: "BRL",
    quantity: 1,
    addedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

function item(overrides: Partial<SavedCartSnapshotItem> = {}): SavedCartSnapshotItem {
  return {
    listingId: LISTING_A,
    quantity: 1,
    unitPriceMinor: "129900",
    currency: "BRL",
    ...overrides,
  };
}

function savedCartRecord(items: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    savedCartId: "0198f4a2-9999-7abc-8def-0123456789ab",
    cartId: CART_ID,
    snapshot: { currency: "BRL", subtotalMinor: "129900", items },
    itemCount: items.length,
    subtotalMinor: "129900",
    currency: "BRL",
    status: "ACTIVE",
    savedAt: "2026-08-20T12:00:00.000Z",
    expiresAt: "2026-09-19T12:00:00.000Z",
    recoveredAt: null,
    ...overrides,
  };
}

function memoryStorage(seed?: Record<string, string>): StorageLike {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
  };
}

describe("corpo de POST /v1/me/saved-cart", () => {
  it("monta exatamente o shape do contrato, com subtotal somado em BigInt", () => {
    const result = toSavedCartPayload(CART_ID, [
      line({ listingId: LISTING_A, quantity: 2, unitPriceMinor: "129900" }),
      line({ listingId: LISTING_B, quantity: 1, unitPriceMinor: "50000" }),
    ]);

    expect(result.issue).toBeNull();
    expect(result.payload).toEqual({
      cartId: CART_ID,
      snapshot: {
        currency: "BRL",
        subtotalMinor: "309800", // 129900*2 + 50000
        items: [
          { listingId: LISTING_A, quantity: 2, unitPriceMinor: "129900", currency: "BRL" },
          { listingId: LISTING_B, quantity: 1, unitPriceMinor: "50000", currency: "BRL" },
        ],
      },
    });
  });

  it("não perde precisão acima do limite seguro de Number", () => {
    const beyondSafeInteger = "9007199254740993"; // Number.MAX_SAFE_INTEGER + 2
    const result = toSavedCartPayload(CART_ID, [
      line({ quantity: 3, unitPriceMinor: beyondSafeInteger }),
    ]);
    expect(result.payload?.snapshot.subtotalMinor).toBe("27021597764222979");
  });

  it("nunca duplica item por listingId: a primeira ocorrência vale", () => {
    const result = toSavedCartPayload(CART_ID, [
      line({ listingId: LISTING_A, quantity: 2 }),
      line({ listingId: LISTING_A, quantity: 9 }),
    ]);
    expect(result.payload?.snapshot.items).toHaveLength(1);
    expect(result.payload?.snapshot.items[0]?.quantity).toBe(2);
    expect(result.payload?.snapshot.subtotalMinor).toBe("259800");
  });

  it("recusa, com motivo, tudo que o contrato recusaria", () => {
    expect(toSavedCartPayload(CART_ID, []).issue).toBe("EMPTY");
    expect(toSavedCartPayload("carrinho-1", [line()]).issue).toBe("INVALID_CART_ID");
    expect(toSavedCartPayload(CART_ID, [line({ listingId: "nao-uuid" })]).issue).toBe("INVALID_LINE");
    expect(toSavedCartPayload(CART_ID, [line({ unitPriceMinor: "1299.00" })]).issue).toBe("INVALID_LINE");
    expect(toSavedCartPayload(CART_ID, [
      line({ listingId: LISTING_A, currency: "BRL" }),
      line({ listingId: LISTING_B, currency: "USD" }),
    ]).issue).toBe("MIXED_CURRENCY");

    const tooMany = Array.from({ length: MAX_SNAPSHOT_ITEMS + 1 }, (_, index) =>
      line({ listingId: `0198f4a2-aaaa-7abc-8def-${String(index).padStart(12, "0")}` }));
    expect(toSavedCartPayload(CART_ID, tooMany).issue).toBe("TOO_MANY_ITEMS");
  });
});

describe("leitura do carrinho salvo da conta", () => {
  it("lê o envelope do contrato GET /v1/me/saved-cart", () => {
    const result = parseSavedCartEnvelope({
      savedCart: savedCartRecord([item()]),
      asOf: "2026-08-24T00:00:00.000Z",
    });
    expect(result.issue).toBeNull();
    expect(result.savedCart?.status).toBe("ACTIVE");
    expect(result.savedCart?.items).toEqual([item()]);
    expect(result.savedCart?.expiresAt).toBe("2026-09-19T12:00:00.000Z");
  });

  it("savedCart null é estado honesto, não erro", () => {
    expect(parseSavedCartEnvelope({ savedCart: null, asOf: "2026-08-24T00:00:00.000Z" }))
      .toEqual({ savedCart: null, issue: null });
  });

  it("resposta fora do contrato é CORRUPTED, nunca adivinhada", () => {
    expect(parseSavedCartEnvelope(null).issue).toBe("CORRUPTED");
    expect(parseSavedCartEnvelope({}).issue).toBe("CORRUPTED");
    expect(parseSavedCartEnvelope({ savedCart: "texto" }).issue).toBe("CORRUPTED");
    expect(parseSavedCartEnvelope({ savedCart: savedCartRecord([item()], { subtotalMinor: 1299 }) }).issue)
      .toBe("CORRUPTED");
    expect(parseSavedCartEnvelope({ savedCart: savedCartRecord([item()], { snapshot: {} }) }).issue)
      .toBe("CORRUPTED");
  });

  it("item de snapshot inválido ou duplicado é descartado e contado, nunca convertido", () => {
    const record = parseSavedCartRecord(savedCartRecord([
      item({ listingId: LISTING_A }),
      item({ listingId: LISTING_A }), // duplicata
      item({ listingId: LISTING_B, unitPriceMinor: "1299.00" }), // decimal
      { listingId: LISTING_C, quantity: 1, unitPriceMinor: 129900, currency: "BRL" }, // número
    ]));
    expect(record).not.toBeNull();
    expect(record?.items.map((entry) => entry.listingId)).toEqual([LISTING_A]);
    expect(record?.discardedItems).toBe(3);
  });
});

describe("restauração do snapshot sobre as linhas locais", () => {
  const local = [
    line({ listingId: LISTING_A }),
    line({ listingId: LISTING_B, savedForLater: true }),
  ];

  it("religa a marca por listingId sem duplicar, sem tocar preço nem quantidade", () => {
    const result = applySavedCartSnapshot(local, [
      item({ listingId: LISTING_A, quantity: 7, unitPriceMinor: "1" }),
      item({ listingId: LISTING_B }),
      item({ listingId: LISTING_C }),
    ]);

    expect(result.lines).toHaveLength(2); // nenhuma linha nova é inventada
    expect(result.lines.find((entry) => entry.listingId === LISTING_A)?.savedForLater).toBe(true);
    // Preço e quantidade continuam os locais: snapshot não é fonte de preço.
    expect(result.lines.find((entry) => entry.listingId === LISTING_A)?.quantity).toBe(1);
    expect(result.lines.find((entry) => entry.listingId === LISTING_A)?.unitPriceMinor).toBe("129900");

    expect(result.restored).toBe(1);
    expect(result.alreadySaved).toBe(1);
    expect(result.missing).toBe(1); // LISTING_C não existe aqui e é dito, não inventado
  });

  it("snapshot com o mesmo item repetido não marca nem conta duas vezes", () => {
    const result = applySavedCartSnapshot(local, [
      item({ listingId: LISTING_A }),
      item({ listingId: LISTING_A }),
    ]);
    expect(result.restored).toBe(1);
    expect(result.missing).toBe(0);
  });

  it("não muda a lista original", () => {
    const snapshot = JSON.stringify(local);
    applySavedCartSnapshot(local, [item({ listingId: LISTING_A })]);
    expect(JSON.stringify(local)).toBe(snapshot);
  });
});

describe("origem do snapshot (sourceCartId)", () => {
  it("prefere o cartId da conta quando ele é um uuid", () => {
    expect(serverCartIdOf({ data: { cartId: CART_ID, lines: [] } })).toBe(CART_ID);
    expect(serverCartIdOf({ cartId: CART_ID })).toBe(CART_ID);
    expect(serverCartIdOf({ data: { cartId: "cart-1" } })).toBeNull();
    expect(serverCartIdOf(null)).toBeNull();

    expect(resolveCartSourceId(memoryStorage(), CART_ID)).toBe(CART_ID);
  });

  it("sem cartId da conta, gera um uuid e o fixa no dispositivo", () => {
    const storage = memoryStorage();
    const first = resolveCartSourceId(storage, null);
    expect(isUuid(first)).toBe(true);
    expect(resolveCartSourceId(storage, null)).toBe(first);
    expect(storage.getItem(CART_SOURCE_ID_KEY)).toBe(first);
  });

  it("respeita um uuid já fixado e nunca inventa formato sem armazenamento", () => {
    const storage = memoryStorage({ [CART_SOURCE_ID_KEY]: CART_ID });
    expect(resolveCartSourceId(storage, null)).toBe(CART_ID);
    expect(resolveCartSourceId(null, null)).toBeNull();
  });

  it("não colide com a chave do carrinho", () => {
    expect(CART_SOURCE_ID_KEY).not.toBe(CART_STORAGE_KEY);
  });
});
