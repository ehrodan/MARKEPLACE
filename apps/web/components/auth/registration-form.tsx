"use client";

import { useState, type SubmitEvent } from "react";
import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";
import { Button, PageState } from "@midas/ui";
import { apiRequest, isApiError } from "@/lib/api-client";
import type { RegistrationResponse } from "@/lib/api-types";
import { hasFieldErrors, validateRegistration, type AuthFieldErrors } from "@/lib/auth-validation";
import { getStringField } from "@/lib/form-data";

export function RegistrationForm({ termsVersion }: { termsVersion?: string }) {
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [serverError, setServerError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      displayName: getStringField(form, "displayName").trim(),
      email: getStringField(form, "email").trim(),
      password: getStringField(form, "password"),
      acceptedTerms: form.get("acceptedTerms") === "on",
    };
    const nextErrors = validateRegistration(input);
    setErrors(nextErrors);
    setServerError(undefined);
    if (hasFieldErrors(nextErrors) || !termsVersion) return;
    setSubmitting(true);
    try {
      await apiRequest<RegistrationResponse>("/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          displayName: input.displayName,
          acceptedTermsVersion: termsVersion,
        }),
      });
      setCompleted(true);
    } catch (error) {
      setServerError(isApiError(error) ? (error.problem.detail || error.problem.title) : "Não foi possível alcançar a API. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return <PageState kind="empty" title="Verifique seu e-mail" description="Se o endereço puder ser cadastrado, as instruções de confirmação serão enviadas. Esta resposta não revela a existência de outra conta." actions={<Link className="button-link" href="/verificar-email"><MailCheck aria-hidden="true" size={18} /> Inserir código</Link>} />;
  }

  return (
    <>
      <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
        {!termsVersion ? <div className="form-alert" role="alert">O cadastro está fechado até a plataforma publicar uma versão de termos em <code>NEXT_PUBLIC_TERMS_VERSION</code>.</div> : null}
        {serverError ? <div className="form-alert" role="alert">{serverError}</div> : null}
        <div className="form-field">
          <label htmlFor="displayName">Como quer ser chamado</label>
          <input id="displayName" name="displayName" autoComplete="name" minLength={2} maxLength={100} required aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? "displayName-error" : undefined} />
          {errors.displayName ? <p id="displayName-error" className="form-field__error">{errors.displayName}</p> : null}
        </div>
        <div className="form-field">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={320} required aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "register-email-error" : undefined} />
          {errors.email ? <p id="register-email-error" className="form-field__error">{errors.email}</p> : null}
        </div>
        <div className="form-field">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required aria-invalid={Boolean(errors.password)} aria-describedby="password-hint" />
          <p id="password-hint" className={errors.password ? "form-field__error" : "form-field__hint"}>{errors.password || "Mínimo de 12 caracteres. Não reutilize uma senha de outro serviço."}</p>
        </div>
        <label className="form-checkbox"><input name="acceptedTerms" type="checkbox" aria-invalid={Boolean(errors.terms)} /><span>Aceito os termos vigentes da plataforma. Consentimento promocional, quando existir, será solicitado separadamente.</span></label>
        {errors.terms ? <p className="form-field__error" role="alert">{errors.terms}</p> : null}
        <Button type="submit" fullWidth size="large" disabled={!termsVersion} loading={submitting} loadingLabel="Criando conta" iconAfter={<ArrowRight aria-hidden="true" size={18} />}>Criar conta</Button>
      </form>
      <p className="auth-card__footer">Já tem conta? <Link href="/entrar">Entrar</Link></p>
    </>
  );
}
