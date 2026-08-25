import { describe, expect, it } from "vitest";
import {
  CART_STORAGE_KEY,
  MAX_LINE_QUANTITY,
  activeLines,
  addMinor,
  clearCart,
  findCartLine,
  groupBySeller,
  isMinorUnits,
  lineTotalMinor,
  mergeCartLines,
  normalizeQuantity,
  parseCartLine,
  parseQuantityInput,
  parseServerCart,
  readCart,
  removeCartLine,
  removeCartLines,
  savedLines,
  setLineQuantity,
  setLineSavedForLater,
  setLineUnitPrice,
  sortCartLines,
  toMergePayload,
  totalItemCount,
  upsertCartLine,
  writeCart,
  type StorageLike,
  type StoredCartLine,
} from "./cart-storage";

function line(overrides: Partial<StoredCartLine> = {}): StoredCartLine {
  return {
    listingId: "listing-a",
    publicSlug: "ak-47-redline",
    title: "AK-47 Redline",
    sellerAccountId: "seller-1",
    sellerDisplayName: "Loja Aurora",
    unitPriceMinor: "129900",
    currency: "BRL",
    quantity: 1,
    addedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

/** localStorage de mentira com orçamento de bytes, para provocar cota real. */
function budgetStorage(maxBytes: number): StorageLike & { readonly writes: number } {
  const map = new Map<string, string>();
  let writes = 0;
  return {
    get writes() { return writes; },
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      writes += 1;
      if (value.length > maxBytes) {
        throw new DOMException("cota do dispositivo excedida", "QuotaExceededError");
      }
      map.set(key, value);
    },
    removeItem: (key) => { map.delete(key); },
  };
}

/** Armazenamento que falha por motivo que NÃO é cota (bloqueio, disco, extensão). */
function hostileStorage(): StorageLike {
  return {
    getItem: () => { throw new Error("acesso negado pelo navegador"); },
    setItem: () => { throw new TypeError("acesso negado pelo navegador"); },
    removeItem: () => { throw new Error("acesso negado pelo navegador"); },
  };
}

function memoryStorage(seed?: string): StorageLike {
  const map = new Map<string, string>();
  if (seed !== undefined) map.set(CART_STORAGE_KEY, seed);
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
  };
}

describe("quantidade", () => {
  it("recusa toda quantidade que não seja inteiro de 1 a 999, em vez de arredondar", () => {
    expect(normalizeQuantity(1)).toBe(1);
    expect(normalizeQuantity(MAX_LINE_QUANTITY)).toBe(MAX_LINE_QUANTITY);

    expect(normalizeQuantity(0)).toBeNull();
    expect(normalizeQuantity(-3)).toBeNull();
    expect(normalizeQuantity(1.5)).toBeNull();
    expect(normalizeQuantity(Number.NaN)).toBeNull();
    expect(normalizeQuantity(Number.POSITIVE_INFINITY)).toBeNull();
    expect(normalizeQuantity(MAX_LINE_QUANTITY + 1)).toBeNull();
    expect(normalizeQuantity("2")).toBeNull();
    expect(normalizeQuantity(null)).toBeNull();
    expect(normalizeQuantity(undefined)).toBeNull();
  });

  it("lê o campo de quantidade só quando ele contém dígitos válidos", () => {
    expect(parseQuantityInput(" 3 ")).toBe(3);
    expect(parseQuantityInput("999")).toBe(999);

    expect(parseQuantityInput("")).toBeNull();
    expect(parseQuantityInput("0")).toBeNull();
    expect(parseQuantityInput("-1")).toBeNull();
    expect(parseQuantityInput("1,5")).toBeNull();
    expect(parseQuantityInput("1.5")).toBeNull();
    expect(parseQuantityInput("2e3")).toBeNull();
    expect(parseQuantityInput("abc")).toBeNull();
    // 1000 é sintaticamente aceitável e ainda assim recusado pelo teto.
    expect(parseQuantityInput("1000")).toBeNull();
  });

  it("não deixa a quantidade passar do teto ao somar o mesmo anúncio de novo", () => {
    const start = [line({ quantity: 998 })];
    const next = upsertCartLine(start, line({ quantity: 5 }));
    expect(next).toHaveLength(1);
    expect(next[0]?.quantity).toBe(MAX_LINE_QUANTITY);
    // A data de entrada original é preservada: a linha é a mesma.
    expect(next[0]?.addedAt).toBe("2026-08-01T12:00:00.000Z");
  });

  it("ignora pedido de quantidade inválida em vez de gravar lixo", () => {
    const start = [line({ quantity: 4 })];
    expect(setLineQuantity(start, "listing-a", 0)[0]?.quantity).toBe(4);
    expect(setLineQuantity(start, "listing-a", -2)[0]?.quantity).toBe(4);
    expect(setLineQuantity(start, "listing-a", 2.5)[0]?.quantity).toBe(4);
    expect(setLineQuantity(start, "listing-a", 1000)[0]?.quantity).toBe(4);
    expect(setLineQuantity(start, "listing-a", 7)[0]?.quantity).toBe(7);
  });
});

describe("dinheiro em unidades mínimas", () => {
  it("só aceita string de dígitos como valor monetário", () => {
    expect(isMinorUnits("0")).toBe(true);
    expect(isMinorUnits("129900")).toBe(true);

    expect(isMinorUnits(129900)).toBe(false);
    expect(isMinorUnits("1299.00")).toBe(false);
    expect(isMinorUnits("1299,00")).toBe(false);
    expect(isMinorUnits("-100")).toBe(false);
    expect(isMinorUnits("1e5")).toBe(false);
    expect(isMinorUnits("")).toBe(false);
    expect(isMinorUnits(null)).toBe(false);
  });

  it("soma e multiplica em BigInt, sem perder precisão acima do limite seguro de Number", () => {
    const beyondSafeInteger = "9007199254740993"; // Number.MAX_SAFE_INTEGER + 2
    expect(addMinor(beyondSafeInteger, "1")).toBe("9007199254740994");
    expect(lineTotalMinor({ unitPriceMinor: beyondSafeInteger, quantity: 3 }))
      .toBe("27021597764222979");
    // Prova de por que nada aqui passa por Number: o valor não sobrevive à ida e volta.
    expect(String(Number(beyondSafeInteger))).not.toBe(beyondSafeInteger);
    expect(String(Number(beyondSafeInteger))).toBe("9007199254740992");
  });

  it("devolve null quando alguma parcela não é valor monetário válido", () => {
    expect(addMinor("100", "1.5")).toBeNull();
    expect(lineTotalMinor({ unitPriceMinor: "abc", quantity: 2 })).toBeNull();
    expect(lineTotalMinor({ unitPriceMinor: "100", quantity: 0 })).toBeNull();
  });
});

describe("agrupamento por vendedor", () => {
  it("cria um grupo por sellerAccountId, com subtotal próprio", () => {
    const groups = groupBySeller([
      { listingId: "a", sellerAccountId: "s1", sellerDisplayName: "Loja Aurora", unitPriceMinor: "129900", currency: "BRL", quantity: 2 },
      { listingId: "b", sellerAccountId: "s2", sellerDisplayName: "Forja Nortista", unitPriceMinor: "50000", currency: "BRL", quantity: 1 },
      { listingId: "c", sellerAccountId: "s1", unitPriceMinor: "1000", currency: "BRL", quantity: 3 },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.sellerAccountId).toBe("s1");
    expect(groups[0]?.sellerDisplayName).toBe("Loja Aurora");
    expect(groups[0]?.itemCount).toBe(5);
    expect(groups[0]?.subtotalMinor).toBe("262800"); // 129900*2 + 1000*3
    expect(groups[0]?.currency).toBe("BRL");

    expect(groups[1]?.sellerAccountId).toBe("s2");
    expect(groups[1]?.itemCount).toBe(1);
    expect(groups[1]?.subtotalMinor).toBe("50000");
  });

  it("recusa somar moedas diferentes em vez de inventar conversão", () => {
    const [group] = groupBySeller([
      { listingId: "a", sellerAccountId: "s1", unitPriceMinor: "1000", currency: "BRL", quantity: 1 },
      { listingId: "b", sellerAccountId: "s1", unitPriceMinor: "1000", currency: "USD", quantity: 1 },
    ]);

    expect(group.mixedCurrency).toBe(true);
    expect(group.currency).toBeNull();
    expect(group.subtotalMinor).toBeNull();
    expect(group.itemCount).toBe(2); // a contagem de unidades continua verdadeira
  });

  it("preserva a ordem de aparição dos vendedores", () => {
    const groups = groupBySeller([
      { listingId: "a", sellerAccountId: "s2", unitPriceMinor: "1", currency: "BRL", quantity: 1 },
      { listingId: "b", sellerAccountId: "s1", unitPriceMinor: "1", currency: "BRL", quantity: 1 },
    ]);
    expect(groups.map((group) => group.sellerAccountId)).toEqual(["s2", "s1"]);
  });
});

describe("leitura do dispositivo", () => {
  it("sem armazenamento, devolve carrinho vazio marcado como UNAVAILABLE", () => {
    expect(readCart(null)).toEqual({ lines: [], issue: "UNAVAILABLE", discarded: 0 });
  });

  it("armazenamento que lança na leitura vira UNAVAILABLE, não exceção", () => {
    expect(readCart(hostileStorage())).toEqual({ lines: [], issue: "UNAVAILABLE", discarded: 0 });
  });

  it("chave ausente é carrinho vazio, não é problema", () => {
    expect(readCart(memoryStorage())).toEqual({ lines: [], issue: null, discarded: 0 });
  });

  it("JSON corrompido é descartado inteiro em vez de adivinhado", () => {
    expect(readCart(memoryStorage("{ isto nao e json ]"))).toEqual({
      lines: [], issue: "CORRUPTED", discarded: 0,
    });
  });

  it("JSON válido que não é lista também é CORRUPTED", () => {
    expect(readCart(memoryStorage('{"lines":[]}')).issue).toBe("CORRUPTED");
    expect(readCart(memoryStorage('"texto"')).issue).toBe("CORRUPTED");
    expect(readCart(memoryStorage("42")).issue).toBe("CORRUPTED");
  });

  it("descarta só as entradas inválidas e diz quantas caíram", () => {
    const raw = JSON.stringify([
      line({ listingId: "ok-1", addedAt: "2026-08-02T12:00:00.000Z" }),
      { ...line({ listingId: "sem-preco" }), unitPriceMinor: 129900 }, // número, não string
      { ...line({ listingId: "preco-decimal" }), unitPriceMinor: "1299.00" },
      { ...line({ listingId: "qtd-zero" }), quantity: 0 },
      { ...line({ listingId: "moeda-torta" }), currency: "brl" },
      { ...line({ listingId: "data-torta" }), addedAt: "ontem" },
      { ...line({ listingId: "sem-slug" }), publicSlug: "" },
      null,
      "texto",
      line({ listingId: "ok-2", addedAt: "2026-08-01T12:00:00.000Z" }),
    ]);

    const result = readCart(memoryStorage(raw));
    expect(result.issue).toBe("PARTIAL");
    expect(result.discarded).toBe(8);
    // Ordem de leitura: mais antigo primeiro.
    expect(result.lines.map((entry) => entry.listingId)).toEqual(["ok-2", "ok-1"]);
  });

  it("descarta duplicata do mesmo anúncio em vez de contar duas vezes", () => {
    const raw = JSON.stringify([line({ listingId: "a" }), line({ listingId: "a", quantity: 9 })]);
    const result = readCart(memoryStorage(raw));
    expect(result.lines).toHaveLength(1);
    expect(result.discarded).toBe(1);
  });

  it("campo desconhecido não vaza para dentro da linha", () => {
    const parsed = parseCartLine({ ...line(), savedForLater: "sim", cartLineId: "", intruso: 1 });
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty("intruso");
    expect(parsed).not.toHaveProperty("savedForLater"); // só `true` liga a marca
    expect(parsed).not.toHaveProperty("cartLineId"); // string vazia não vira id
  });
});

describe("gravação e cota", () => {
  it("grava e relê sem alterar nada", () => {
    const storage = memoryStorage();
    const written = writeCart(storage, [line({ listingId: "b", addedAt: "2026-08-02T12:00:00.000Z" }), line({ listingId: "a" })]);
    expect(written.issue).toBeNull();
    expect(written.lines.map((entry) => entry.listingId)).toEqual(["a", "b"]);
    expect(readCart(storage).lines.map((entry) => entry.listingId)).toEqual(["a", "b"]);
  });

  it("sem armazenamento, devolve UNAVAILABLE sem perder as linhas em memória", () => {
    const result = writeCart(null, [line()]);
    expect(result.issue).toBe("UNAVAILABLE");
    expect(result.lines).toHaveLength(1);
  });

  it("cota estourada corta as linhas mais antigas e denuncia quantas saíram", () => {
    const one = JSON.stringify([line({ listingId: "a" })]).length;
    const storage = budgetStorage(one + 1); // cabe uma linha, não cabem quatro
    const lines = [
      line({ listingId: "a", addedAt: "2026-08-01T12:00:00.000Z" }),
      line({ listingId: "b", addedAt: "2026-08-02T12:00:00.000Z" }),
      line({ listingId: "c", addedAt: "2026-08-03T12:00:00.000Z" }),
      line({ listingId: "d", addedAt: "2026-08-04T12:00:00.000Z" }),
    ];

    const result = writeCart(storage, lines);
    expect(result.issue).toBe("TRIMMED");
    expect(result.discarded).toBe(3);
    expect(result.lines).toHaveLength(1);
    expect(storage.writes).toBeGreaterThan(1); // houve retentativa, não desistência
    // O que sobrou no dispositivo é exatamente o que a função declarou.
    expect(readCart(storage).lines.map((entry) => entry.listingId)).toEqual(["a"]);
  });

  it("cota que não permite gravar nada vira QUOTA, e a lista continua utilizável em memória", () => {
    const storage = budgetStorage(0);
    const lines = [line({ listingId: "a" }), line({ listingId: "b", addedAt: "2026-08-02T12:00:00.000Z" })];

    const result = writeCart(storage, lines);
    expect(result.issue).toBe("QUOTA");
    expect(result.discarded).toBe(2);
    expect(result.lines).toHaveLength(2); // nada foi perdido para quem está na tela
    expect(readCart(storage).lines).toHaveLength(0);
  });

  it("falha que não é cota não entra em laço de retentativa", () => {
    const result = writeCart(hostileStorage(), [line()]);
    expect(result.issue).toBe("UNAVAILABLE");
    expect(result.lines).toHaveLength(1);
  });

  it("limpar carrinho em armazenamento hostil não lança", () => {
    expect(() => { clearCart(hostileStorage()); }).not.toThrow();
    expect(() => { clearCart(null); }).not.toThrow();
  });
});

describe("merge do dispositivo com a conta", () => {
  it("mantém os dois lados: nenhum item some ao entrar", () => {
    const local = [
      line({ listingId: "so-local", title: "Só no dispositivo" }),
      line({ listingId: "nos-dois", quantity: 3, addedAt: "2026-07-01T12:00:00.000Z" }),
    ];
    const remote = [
      line({ listingId: "so-conta", title: "Só na conta", cartLineId: "cl-1" }),
      line({ listingId: "nos-dois", quantity: 1, title: "Título do servidor", unitPriceMinor: "99900", cartLineId: "cl-2", addedAt: "2026-08-05T12:00:00.000Z" }),
    ];

    const merged = mergeCartLines(local, remote);
    expect(merged.map((entry) => entry.listingId).sort()).toEqual(["nos-dois", "so-conta", "so-local"]);

    const shared = findCartLine(merged, "nos-dois");
    // Quantidade: a maior das duas — reduzir seria descartar uma escolha real.
    expect(shared?.quantity).toBe(3);
    // Servidor é a fonte de título, preço e id da linha.
    expect(shared?.title).toBe("Título do servidor");
    expect(shared?.unitPriceMinor).toBe("99900");
    expect(shared?.cartLineId).toBe("cl-2");
    // A data mais antiga sobrevive: é quando a pessoa escolheu o item.
    expect(shared?.addedAt).toBe("2026-07-01T12:00:00.000Z");
  });

  it("guardado para depois é marca do dispositivo e sobrevive ao merge", () => {
    const merged = mergeCartLines(
      [line({ listingId: "x", savedForLater: true })],
      [line({ listingId: "x", cartLineId: "cl-9" })],
    );
    expect(merged[0]?.savedForLater).toBe(true);
    expect(merged[0]?.cartLineId).toBe("cl-9");
  });

  it("o merge respeita o teto de quantidade", () => {
    const merged = mergeCartLines(
      [line({ listingId: "x", quantity: MAX_LINE_QUANTITY })],
      [line({ listingId: "x", quantity: MAX_LINE_QUANTITY })],
    );
    expect(merged[0]?.quantity).toBe(MAX_LINE_QUANTITY);
  });

  it("merge com lado vazio devolve o outro lado intacto", () => {
    expect(mergeCartLines([], [line()])).toHaveLength(1);
    expect(mergeCartLines([line()], [])).toHaveLength(1);
    expect(mergeCartLines([], [])).toHaveLength(0);
  });

  it("o corpo enviado ao servidor carrega só listingId e quantidade", () => {
    expect(toMergePayload([line({ listingId: "a", quantity: 2 }), line({ listingId: "b", quantity: 1 })]))
      .toEqual({ lines: [{ listingId: "a", quantity: 2 }, { listingId: "b", quantity: 1 }] });
  });
});

describe("carrinho publicado pela conta", () => {
  it("lê a projeção do contrato GET /v1/me/cart", () => {
    const result = parseServerCart({
      data: {
        cartId: "cart-1",
        currency: "BRL",
        lines: [{
          cartLineId: "cl-1",
          listingId: "listing-1",
          sellerAccountId: "seller-1",
          sellerDisplayName: "Loja Aurora",
          unitPriceMinor: "129900",
          currency: "BRL",
          quantity: 2,
          addedAt: "2026-08-01T12:00:00.000Z",
          listing: { publicSlug: "ak-47-redline" },
          catalogItem: { displayName: "AK-47 Redline" },
        }],
      },
      asOf: "2026-08-24T00:00:00.000Z",
    });

    expect(result.issue).toBeNull();
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.cartLineId).toBe("cl-1");
    expect(result.lines[0]?.title).toBe("AK-47 Redline");
    expect(result.lines[0]?.publicSlug).toBe("ak-47-redline");
    expect(result.lines[0]?.unitPriceMinor).toBe("129900");
  });

  it("recusa dinheiro em ponto flutuante vindo do servidor em vez de converter", () => {
    const result = parseServerCart({
      data: {
        lines: [{
          cartLineId: "cl-1",
          listingId: "listing-1",
          sellerAccountId: "seller-1",
          unitPriceMinor: 1299,
          currency: "BRL",
          quantity: 1,
          addedAt: "2026-08-01T12:00:00.000Z",
          listing: { publicSlug: "slug" },
          catalogItem: { displayName: "Item" },
        }],
      },
    });

    expect(result.lines).toHaveLength(0);
    expect(result.issue).toBe("PARTIAL");
    expect(result.discarded).toBe(1);
  });

  it("resposta fora do contrato é CORRUPTED, nunca carrinho vazio silencioso", () => {
    expect(parseServerCart(null).issue).toBe("CORRUPTED");
    expect(parseServerCart({}).issue).toBe("CORRUPTED");
    expect(parseServerCart({ data: {} }).issue).toBe("CORRUPTED");
    expect(parseServerCart({ data: { lines: "nao e lista" } }).issue).toBe("CORRUPTED");
  });
});

describe("operações de lista", () => {
  const base = [
    line({ listingId: "a", quantity: 2 }),
    line({ listingId: "b", quantity: 3, savedForLater: true, addedAt: "2026-08-02T12:00:00.000Z" }),
    line({ listingId: "c", quantity: 1, addedAt: "2026-08-03T12:00:00.000Z" }),
  ];

  it("separa ativos de guardados e conta unidades só do que foi pedido", () => {
    expect(activeLines(base).map((entry) => entry.listingId)).toEqual(["a", "c"]);
    expect(savedLines(base).map((entry) => entry.listingId)).toEqual(["b"]);
    expect(totalItemCount(activeLines(base))).toBe(3);
    expect(totalItemCount(base)).toBe(6);
  });

  it("guardar e desguardar não deixa a marca pendurada na linha", () => {
    const guardado = setLineSavedForLater(base, "a", true);
    expect(guardado[0]?.savedForLater).toBe(true);
    const devolvido = setLineSavedForLater(guardado, "a", false);
    expect(devolvido[0]).not.toHaveProperty("savedForLater");
  });

  it("aceitar o preço vigente é gravar o preço vigente, e só o válido é gravado", () => {
    const aceito = setLineUnitPrice(base, "a", "139900", "BRL");
    expect(aceito[0]?.unitPriceMinor).toBe("139900");

    expect(setLineUnitPrice(base, "a", "1399.00", "BRL")[0]?.unitPriceMinor).toBe("129900");
    expect(setLineUnitPrice(base, "a", "139900", "brl")[0]?.unitPriceMinor).toBe("129900");
  });

  it("remover afeta só a linha pedida", () => {
    expect(removeCartLine(base, "b").map((entry) => entry.listingId)).toEqual(["a", "c"]);
    expect(removeCartLines(base, ["a", "c"]).map((entry) => entry.listingId)).toEqual(["b"]);
    expect(removeCartLines(base, [])).toHaveLength(3);
  });

  it("nenhuma operação muda a lista original", () => {
    const snapshot = JSON.stringify(base);
    setLineQuantity(base, "a", 9);
    setLineSavedForLater(base, "a", true);
    setLineUnitPrice(base, "a", "1", "BRL");
    removeCartLine(base, "a");
    sortCartLines(base);
    upsertCartLine(base, line({ listingId: "z" }));
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
