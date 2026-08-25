"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button, PageState } from "@midas/ui";
import { apiRequest, isApiError } from "@/lib/api-client";
import { hasFieldErrors, validateVerificationToken, type AuthFieldErrors } from "@/lib/auth-validation";
import { getStringField } from "@/lib/form-data";

export function VerificationForm({ initialToken = "" }: { initialToken?: string }) {
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [serverError, setServerError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStringField(new FormData(event.currentTarget), "token").trim();
    const nextErrors = validateVerificationToken(token);
    setErrors(nextErrors);
    setServerError(undefined);
    if (hasFieldErrors(nextErrors)) return;
    setSubmitting(true);
    try {
      await apiRequest<unknown>("/v1/auth/email-verifications", { method: "POST", body: JSON.stringify({ token }) });
      setCompleted(true);
    } catch (error) {
      setServerError(isApiError(error) ? (error.problem.detail || error.problem.title) : "Não foi possível alcançar a API. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return <PageState kind="empty" title="E-mail verificado" description="Sua identidade foi confirmada. Agora você já pode iniciar uma sessão." actions={<Link className="button-link" href="/entrar"><CheckCircle2 aria-hidden="true" size={18} /> Entrar</Link>} />;
  }

  return (
    <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
      {serverError ? <div className="form-alert" role="alert">{serverError}</div> : null}
      <div className="form-field">
        <label htmlFor="token">Código de verificação</label>
        <input id="token" name="token" defaultValue={initialToken} autoComplete="one-time-code" minLength={32} maxLength={256} required aria-invalid={Boolean(errors.token)} aria-describedby={errors.token ? "token-error" : "token-hint"} />
        <p id={errors.token ? "token-error" : "token-hint"} className={errors.token ? "form-field__error" : "form-field__hint"}>{errors.token || "Cole o código completo recebido no seu e-mail."}</p>
      </div>
      <Button type="submit" fullWidth size="large" loading={submitting} loadingLabel="Verificando">Verificar e-mail</Button>
    </form>
  );
}
