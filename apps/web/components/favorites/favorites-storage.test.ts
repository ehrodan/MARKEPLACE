import { describe, expect, it } from "vitest";
import {
  FAVORITES_STORAGE_KEY,
  MAX_STORED_FAVORITES,
  WATCH_POLICY_VERSION,
  clearWatchOptIn,
  findOptIn,
  isFavoriteOnDevice,
  mergeFavorites,
  parseFavorite,
  parseTargetPriceMinor,
  readFavorites,
  removeFavorite,
  removeFavoriteFromDevice,
  saveFavoriteToDevice,
  setWatchOptIn,
  writeFavorites,
  type StorageLike,
  type StoredFavorite,
} from "./favorites-storage";

function favorite(overrides: Partial<StoredFavorite> = {}): StoredFavorite {
  return {
    listingId: "0192f0aa-0000-7000-8000-000000000001",
    publicSlug: "ak-47-redline",
    title: "AK-47 Redline",
    savedPriceMinor: "129900",
    currency: "BRL",
    savedAt: "2026-08-01T12:00:00.000Z",
    watch: [],
    ...overrides,
  };
}

class MemoryStorage implements StorageLike {
  readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe("readFavorites", () => {
  it("devolve lista vazia sem incidente quando nada foi salvo", () => {
    const result = readFavorites(new MemoryStorage());
    expect(result).toEqual({ entries: [], issue: null, discarded: 0 });
  });

  it("trata JSON corrompido sem derrubar a tela e sem inventar entradas", () => {
    const storage = new MemoryStorage();
    storage.setItem(FAVORITES_STORAGE_KEY, "{ isto nao e json ]");
    const result = readFavorites(storage);
    expect(result.entries).toEqual([]);
    expect(result.issue).toBe("CORRUPTED");
  });

  it("trata conteúdo válido que não é lista como corrompido", () => {
    const storage = new MemoryStorage();
    storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify({ listingId: "x" }));
    expect(readFavorites(storage).issue).toBe("CORRUPTED");
  });

  it("descarta entradas fora do formato e preserva as íntegras", () => {
    const storage = new MemoryStorage();
    storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([
      favorite(),
      { listingId: "sem-preco", publicSlug: "s", title: "t", currency: "BRL", savedAt: "2026-08-01T12:00:00.000Z" },
      favorite({ savedPriceMinor: "12,99" }),
      null,
      "texto solto",
    ]));

    const result = readFavorites(storage);
    expect(result.entries).toHaveLength(1);
    expect(result.entries.at(0)?.listingId).toBe("0192f0aa-0000-7000-8000-000000000001");
    expect(result.issue).toBe("PARTIAL");
    expect(result.discarded).toBe(4);
  });

  it("reporta armazenamento indisponível quando o navegador bloqueia a leitura", () => {
    const blocked: StorageLike = {
      getItem() { throw new DOMException("bloqueado", "SecurityError"); },
      setItem() { /* irrelevante neste caso */ },
      removeItem() { /* irrelevante neste caso */ },
    };
    expect(readFavorites(blocked)).toEqual({ entries: [], issue: "UNAVAILABLE", discarded: 0 });
    expect(readFavorites(null)).toEqual({ entries: [], issue: "UNAVAILABLE", discarded: 0 });
  });

  it("ignora opt-in sem carimbo de tempo ou versão de política", () => {
    const parsed = parseFavorite({
      ...favorite(),
      watch: [
        { channel: "PRICE_DROP" },
        { channel: "BACK_IN_STOCK", optedInAt: "2026-08-02T10:00:00.000Z", policyVersion: WATCH_POLICY_VERSION },
        { channel: "INVENTADO", optedInAt: "2026-08-02T10:00:00.000Z", policyVersion: "x" },
      ],
    });
    expect(parsed?.watch.map((optIn) => optIn.channel)).toEqual(["BACK_IN_STOCK"]);
  });
});

describe("writeFavorites", () => {
  it("grava a lista ordenada do mais recente para o mais antigo", () => {
    const storage = new MemoryStorage();
    const older = favorite({ listingId: "a", savedAt: "2026-07-01T12:00:00.000Z" });
    const newer = favorite({ listingId: "b", savedAt: "2026-08-10T12:00:00.000Z" });

    const result = writeFavorites(storage, [older, newer]);
    expect(result.issue).toBeNull();
    expect(result.entries.map((entry) => entry.listingId)).toEqual(["b", "a"]);
    expect(readFavorites(storage).entries.map((entry) => entry.listingId)).toEqual(["b", "a"]);
  });

  it("descarta os mais antigos e avisa quando a cota do dispositivo estoura", () => {
    const storage = new MemoryStorage();
    const limit = 3;
    const quotaStorage: StorageLike = {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => {
        const parsed = JSON.parse(value) as unknown[];
        if (parsed.length > limit) throw new DOMException("cheio", "QuotaExceededError");
        storage.setItem(key, value);
      },
      removeItem: (key) => { storage.removeItem(key); },
    };

    const entries = Array.from({ length: 10 }, (_, index) => favorite({
      listingId: `item-${String(index)}`,
      savedAt: new Date(Date.UTC(2026, 7, index + 1)).toISOString(),
    }));

    const result = writeFavorites(quotaStorage, entries);
    expect(result.issue).toBe("TRIMMED");
    expect(result.entries.length).toBeLessThanOrEqual(limit);
    expect(result.discarded).toBe(entries.length - result.entries.length);
    // Os favoritos mais recentes são os que sobrevivem.
    expect(result.entries.at(0)?.listingId).toBe("item-9");
  });

  it("reporta QUOTA quando nem uma lista vazia cabe", () => {
    const always: StorageLike = {
      getItem: () => null,
      setItem() { throw new DOMException("cheio", "QuotaExceededError"); },
      removeItem() { /* irrelevante neste caso */ },
    };
    const result = writeFavorites(always, [favorite()]);
    expect(result.issue).toBe("QUOTA");
    expect(result.entries).toHaveLength(1);
  });

  it("mantém a lista em memória quando não há armazenamento disponível", () => {
    const result = writeFavorites(null, [favorite()]);
    expect(result.issue).toBe("UNAVAILABLE");
    expect(result.entries).toHaveLength(1);
  });

  it("respeita o teto de entradas guardadas", () => {
    const storage = new MemoryStorage();
    const entries = Array.from({ length: MAX_STORED_FAVORITES + 5 }, (_, index) => favorite({
      listingId: `item-${String(index)}`,
      savedAt: new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString(),
    }));
    const result = writeFavorites(storage, entries);
    expect(result.entries).toHaveLength(MAX_STORED_FAVORITES);
    expect(result.issue).toBe("TRIMMED");
    expect(result.discarded).toBe(5);
  });
});

describe("mergeFavorites", () => {
  it("une dispositivo e conta sem apagar nenhum lado", () => {
    const local = [favorite({ listingId: "so-local", savedAt: "2026-08-05T12:00:00.000Z" })];
    const remote = [favorite({ listingId: "so-conta", savedAt: "2026-08-06T12:00:00.000Z" })];
    const merged = mergeFavorites(local, remote);
    expect(merged.map((entry) => entry.listingId)).toEqual(["so-conta", "so-local"]);
  });

  it("no conflito, servidor manda no preço salvo e o registro mais antigo mantém a data", () => {
    const local = favorite({ savedPriceMinor: "129900", savedAt: "2026-07-01T12:00:00.000Z", title: "Título antigo" });
    const remote = favorite({ savedPriceMinor: "118000", savedAt: "2026-08-01T12:00:00.000Z", title: "AK-47 Redline" });

    const merged = mergeFavorites([local], [remote]).at(0);
    expect(merged?.savedPriceMinor).toBe("118000");
    expect(merged?.title).toBe("AK-47 Redline");
    expect(merged?.savedAt).toBe("2026-07-01T12:00:00.000Z");
  });

  it("mantém a escolha explícita mais recente por canal e nunca cria opt-in novo", () => {
    const local = favorite({
      watch: [{ channel: "PRICE_DROP", optedInAt: "2026-08-01T10:00:00.000Z", policyVersion: WATCH_POLICY_VERSION, targetPriceMinor: "100000" }],
    });
    const remote = favorite({
      watch: [
        { channel: "PRICE_DROP", optedInAt: "2026-08-09T10:00:00.000Z", policyVersion: WATCH_POLICY_VERSION },
        { channel: "BACK_IN_STOCK", optedInAt: "2026-08-03T10:00:00.000Z", policyVersion: WATCH_POLICY_VERSION },
      ],
    });

    const merged = mergeFavorites([local], [remote]).at(0);
    expect(merged).toBeDefined();
    const priceDrop = merged ? findOptIn(merged, "PRICE_DROP") : null;
    expect(priceDrop?.optedInAt).toBe("2026-08-09T10:00:00.000Z");
    expect(priceDrop?.targetPriceMinor).toBeUndefined();
    expect(merged?.watch).toHaveLength(2);
  });

  it("não duplica quando a entrada existe dos dois lados", () => {
    const merged = mergeFavorites([favorite()], [favorite()]);
    expect(merged).toHaveLength(1);
  });
});

describe("opt-in", () => {
  it("liga e desliga um canal preservando carimbo e versão de política", () => {
    const entries = [favorite()];
    const enabled = setWatchOptIn(entries, entries.at(0)?.listingId ?? "", "PRICE_DROP", {
      optedInAt: "2026-08-20T09:30:00.000Z",
      targetPriceMinor: "99900",
    });
    const first = enabled.at(0);
    const optIn = first ? findOptIn(first, "PRICE_DROP") : null;
    expect(optIn).toEqual({
      channel: "PRICE_DROP",
      optedInAt: "2026-08-20T09:30:00.000Z",
      policyVersion: WATCH_POLICY_VERSION,
      targetPriceMinor: "99900",
    });

    const disabled = clearWatchOptIn(enabled, entries.at(0)?.listingId ?? "", "PRICE_DROP");
    expect(disabled.at(0)?.watch).toEqual([]);
  });

  it("não grava alvo de preço em canal de reposição", () => {
    const entries = setWatchOptIn([favorite()], favorite().listingId, "BACK_IN_STOCK", {
      optedInAt: "2026-08-20T09:30:00.000Z",
      targetPriceMinor: "99900",
    });
    const saved = entries.at(0);
    expect(saved ? findOptIn(saved, "BACK_IN_STOCK") : null).toEqual({
      channel: "BACK_IN_STOCK",
      optedInAt: "2026-08-20T09:30:00.000Z",
      policyVersion: WATCH_POLICY_VERSION,
    });
  });

  it("removeFavorite tira apenas o item pedido", () => {
    const entries = [favorite({ listingId: "a" }), favorite({ listingId: "b" })];
    expect(removeFavorite(entries, "a").map((entry) => entry.listingId)).toEqual(["b"]);
  });
});

describe("seam de uma chamada para a página do anúncio", () => {
  const draft = {
    listingId: "0192f0aa-0000-7000-8000-000000000001",
    publicSlug: "ak-47-redline",
    title: "AK-47 Redline",
    savedPriceMinor: "129900",
    currency: "BRL",
    savedAt: "2026-08-01T12:00:00.000Z",
  };

  it("salva no dispositivo sem nenhum aviso ligado", () => {
    const storage = new MemoryStorage();
    const result = saveFavoriteToDevice(storage, draft);
    expect(result.issue).toBeNull();
    expect(result.entries).toHaveLength(1);
    expect(result.entries.at(0)?.watch).toEqual([]);
    expect(isFavoriteOnDevice(storage, draft.listingId)).toBe(true);
  });

  it("salvar de novo é no-op e jamais mexe num opt-in já dado", () => {
    const storage = new MemoryStorage();
    saveFavoriteToDevice(storage, draft);
    const withOptIn = setWatchOptIn(readFavorites(storage).entries, draft.listingId, "PRICE_DROP", {
      optedInAt: "2026-08-20T09:30:00.000Z",
    });
    writeFavorites(storage, withOptIn);

    const again = saveFavoriteToDevice(storage, { ...draft, savedPriceMinor: "999999" });
    expect(again.entries).toHaveLength(1);
    expect(again.entries.at(0)?.savedPriceMinor).toBe("129900");
    expect(again.entries.at(0)?.watch).toHaveLength(1);
  });

  it("recusa rascunho fora do formato em vez de gravar entrada meia-boca", () => {
    const storage = new MemoryStorage();
    const result = saveFavoriteToDevice(storage, { ...draft, savedPriceMinor: "R$ 1.299,00" });
    expect(result.issue).toBe("CORRUPTED");
    expect(readFavorites(storage).entries).toHaveLength(0);
  });

  it("remove em uma chamada e não derruba os outros itens", () => {
    const storage = new MemoryStorage();
    saveFavoriteToDevice(storage, draft);
    saveFavoriteToDevice(storage, { ...draft, listingId: "outro", publicSlug: "outro-item" });

    const result = removeFavoriteFromDevice(storage, draft.listingId);
    expect(result.entries.map((entry) => entry.listingId)).toEqual(["outro"]);
    expect(isFavoriteOnDevice(storage, draft.listingId)).toBe(false);
  });

  it("funciona sem armazenamento, avisando que nada sobrevive ao recarregamento", () => {
    const result = saveFavoriteToDevice(null, draft);
    expect(result.issue).toBe("UNAVAILABLE");
    expect(result.entries).toHaveLength(1);
    expect(isFavoriteOnDevice(null, draft.listingId)).toBe(false);
  });
});

describe("parseTargetPriceMinor", () => {
  it("aceita vazio como ausência de alvo", () => {
    expect(parseTargetPriceMinor("   ")).toEqual({ ok: true, amountMinor: null });
  });

  it("converte pt-BR para unidades mínimas sem passar por ponto flutuante", () => {
    expect(parseTargetPriceMinor("1.499,90")).toEqual({ ok: true, amountMinor: "149990" });
    expect(parseTargetPriceMinor("12,5")).toEqual({ ok: true, amountMinor: "1250" });
    expect(parseTargetPriceMinor("1234")).toEqual({ ok: true, amountMinor: "123400" });
    expect(parseTargetPriceMinor("0")).toEqual({ ok: true, amountMinor: "0" });
    expect(parseTargetPriceMinor("1.234")).toEqual({ ok: true, amountMinor: "123400" });
    expect(parseTargetPriceMinor("1.50")).toEqual({ ok: true, amountMinor: "150" });
  });

  it("rejeita entrada malformada em vez de adivinhar valor", () => {
    expect(parseTargetPriceMinor("abc")).toEqual({ ok: false });
    expect(parseTargetPriceMinor("1,2,3")).toEqual({ ok: false });
    expect(parseTargetPriceMinor("12,999")).toEqual({ ok: false });
    expect(parseTargetPriceMinor("-5")).toEqual({ ok: false });
  });
});
