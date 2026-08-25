"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@midas/ui";
import { apiRequest, isApiError } from "@/lib/api-client";
import { hasFieldErrors, validateLogin, type AuthFieldErrors } from "@/lib/auth-validation";
import { getStringField } from "@/lib/form-data";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [serverError, setServerError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = { email: getStringField(form, "email").trim(), password: getStringField(form, "password") };
    const nextErrors = validateLogin(input);
    setErrors(nextErrors);
    setServerError(undefined);
    if (hasFieldErrors(nextErrors)) return;
    setSubmitting(true);
    try {
      await apiRequest<unknown>("/v1/auth/login", { method: "POST", body: JSON.stringify(input) });
      router.replace(returnTo);
      router.refresh();
    } catch (error) {
      setServerError(isApiError(error) ? (error.problem.detail || error.problem.title) : "Não foi possível alcançar a API. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
        {serverError ? <div className="form-alert" role="alert">{serverError}</div> : null}
        <div className="form-field">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={320} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} />
          {errors.email ? <p id="email-error" className="form-field__error">{errors.email}</p> : null}
        </div>
        <div className="form-field">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" maxLength={256} required aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : undefined} />
          {errors.password ? <p id="password-error" className="form-field__error">{errors.password}</p> : null}
        </div>
        <Button type="submit" fullWidth size="large" loading={submitting} loadingLabel="Entrando" iconAfter={<ArrowRight aria-hidden="true" size={18} />}>Entrar</Button>
      </form>
      <p className="auth-card__footer">Ainda não tem conta? <Link href="/cadastro">Criar conta</Link></p>
    </>
  );
}
