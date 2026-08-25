import { describe, expect, it } from "vitest";
import { NICK_MAX_LENGTH, greetingFor, normalizeNick } from "./nick";

describe("normalizeNick", () => {
  it("aceita nick comum", () => {
    expect(normalizeNick("Elisor")).toBe("Elisor");
  });

  it("devolve null para ausente, vazio ou só espaço", () => {
    for (const value of [undefined, null, "", "   ", "\t\n"]) {
      expect(normalizeNick(value), JSON.stringify(value)).toBeNull();
    }
  });

  it("devolve null para valor não-string vindo de payload sem contrato", () => {
    expect(normalizeNick(42 as unknown as string)).toBeNull();
    expect(normalizeNick({} as unknown as string)).toBeNull();
  });

  it("remove caracteres invisíveis e de override bidirecional", () => {
    // Um nick só de marcas invisíveis não é nick.
    expect(normalizeNick("​​")).toBeNull();
    expect(normalizeNick("‮Elisor")).toBe("Elisor");
    expect(normalizeNick("Eli​sor")).toBe("Elisor");
  });

  it("colapsa espaço interno em vez de deixar buraco no texto", () => {
    expect(normalizeNick("  Elisor   Silva  ")).toBe("Elisor Silva");
  });

  it("trunca nick longo sem cortar no meio de um espaço", () => {
    const long = "A".repeat(80);
    const result = normalizeNick(long);
    expect(result).not.toBeNull();
    expect(result?.length).toBe(NICK_MAX_LENGTH);
    expect(result?.endsWith("…")).toBe(true);
  });

  it("preserva emoji, que é nick válido", () => {
    expect(normalizeNick("Elisor 🐍")).toBe("Elisor 🐍");
  });
});

describe("greetingFor", () => {
  it("personaliza quando há nick", () => {
    expect(greetingFor("Elisor")).toEqual({
      headline: "Bem-vindo de volta, Elisor",
      personalized: true,
    });
  });

  it("nunca renderiza undefined nem null no texto", () => {
    for (const value of [undefined, null, "", "  "]) {
      const greeting = greetingFor(value);
      expect(greeting.personalized).toBe(false);
      expect(greeting.headline).toBe("Bem-vindo de volta");
      expect(greeting.headline).not.toMatch(/undefined|null/);
    }
  });

  it("nunca deixa vírgula órfã ou espaço duplo", () => {
    for (const value of [undefined, "", "   ", "​"]) {
      const { headline } = greetingFor(value);
      expect(headline).not.toMatch(/,\s*$/);
      expect(headline).not.toMatch(/ {2}/);
    }
  });
});
