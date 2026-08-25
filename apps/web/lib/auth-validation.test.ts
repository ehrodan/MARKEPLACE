import { describe, expect, it } from "vitest";
import { hasFieldErrors, safeReturnTo, validateLogin, validateRegistration, validateVerificationToken } from "./auth-validation";

describe("validação de autenticação", () => {
  it("respeita o contrato de cadastro", () => {
    expect(hasFieldErrors(validateRegistration({ displayName: "Ana", email: "ana@example.com", password: "uma-senha-segura", acceptedTerms: true }))).toBe(false);
    expect(validateRegistration({ displayName: "A", email: "inválido", password: "curta", acceptedTerms: false })).toEqual({
      email: "Informe um e-mail válido.",
      password: "Use pelo menos 12 caracteres.",
      displayName: "Use um nome entre 2 e 100 caracteres.",
      terms: "É necessário aceitar os termos vigentes.",
    });
  });

  it("não permite redirecionamento externo", () => {
    expect(safeReturnTo("/conta/compras")).toBe("/conta/compras");
    expect(safeReturnTo("//example.com")).toBe("/conta");
    expect(safeReturnTo("/\\evil.example")).toBe("/conta");
    expect(safeReturnTo("https://example.com")).toBe("/conta");
  });

  it("valida login e token sem inferir autenticação", () => {
    expect(validateLogin({ email: "eu@example.com", password: "x" })).toEqual({});
    expect(validateVerificationToken("x".repeat(32))).toEqual({});
    expect(validateVerificationToken("curto").token).toBeDefined();
  });
});
