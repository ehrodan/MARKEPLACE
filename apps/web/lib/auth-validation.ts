import { safeInternalHref } from "./internal-href";

export interface AuthFieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
  terms?: string;
  token?: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(input: { email: string; password: string }): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const email = input.email.trim();
  if (!emailPattern.test(email) || email.length > 320) errors.email = "Informe um e-mail válido.";
  if (input.password.length < 1 || input.password.length > 256) errors.password = "Informe sua senha.";
  return errors;
}

export function validateRegistration(input: {
  displayName: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
}): AuthFieldErrors {
  const errors = validateLogin(input);
  const displayNameLength = input.displayName.trim().length;
  if (displayNameLength < 2 || displayNameLength > 100) errors.displayName = "Use um nome entre 2 e 100 caracteres.";
  if (input.password.length < 12 || input.password.length > 256) errors.password = "Use pelo menos 12 caracteres.";
  if (!input.acceptedTerms) errors.terms = "É necessário aceitar os termos vigentes.";
  return errors;
}

export function validateVerificationToken(token: string): AuthFieldErrors {
  const length = token.trim().length;
  return length >= 32 && length <= 256 ? {} : { token: "Informe o código completo enviado para seu e-mail." };
}

export function hasFieldErrors(errors: AuthFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function safeReturnTo(value: string | undefined): string {
  return safeInternalHref(value, "/conta") ?? "/conta";
}
