"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, UserRound } from "lucide-react";
import { Button } from "@midas/ui";
import { apiRequest, isApiError } from "@/lib/api-client";
import type { SellerAccountSummary } from "@/lib/api-types";
import { getStringField } from "@/lib/form-data";

export function SellerAccountForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [nameError, setNameError] = useState<string>();

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = getStringField(form, "displayName").trim();
    const accountType = getStringField(form, "accountType") || "INDIVIDUAL";
    if (displayName.length < 2 || displayName.length > 120) {
      setNameError("Use um nome entre 2 e 120 caracteres.");
      return;
    }
    setNameError(undefined);
    setError(undefined);
    setSubmitting(true);
    try {
      const seller = await apiRequest<SellerAccountSummary>("/v1/seller-accounts", {
        method: "POST",
        body: JSON.stringify({ displayName, accountType }),
      });
      router.replace(`/conta/vendas?sellerAccountId=${encodeURIComponent(seller.sellerAccountId)}`);
      router.refresh();
    } catch (requestError) {
      setError(isApiError(requestError) ? (requestError.problem.detail || requestError.problem.title) : "Não foi possível alcançar a API. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form seller-onboarding" onSubmit={(event) => void submit(event)} noValidate>
      {error ? <div className="form-alert" role="alert">{error}</div> : null}
      <div className="form-field"><label htmlFor="displayName">Nome público da operação</label><input id="displayName" name="displayName" minLength={2} maxLength={120} required aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "seller-name-error" : "seller-name-hint"} /><p id={nameError ? "seller-name-error" : "seller-name-hint"} className={nameError ? "form-field__error" : "form-field__hint"}>{nameError || "Pode ser diferente do nome da sua identidade pessoal."}</p></div>
      <fieldset className="seller-type-options"><legend>Tipo de conta</legend><label><input type="radio" name="accountType" value="INDIVIDUAL" defaultChecked /><UserRound aria-hidden="true" /><span><strong>Pessoa física</strong><small>Operação individual.</small></span></label><label><input type="radio" name="accountType" value="ORGANIZATION" /><Building2 aria-hidden="true" /><span><strong>Organização</strong><small>Empresa ou equipe com contexto próprio.</small></span></label></fieldset>
      <div className="capability-banner"><span>Esta etapa cria apenas a SellerAccount real. Elegibilidade, KYC/KYB e destino de recebimento continuarão em integrações próprias quando a API publicar essas capabilities.</span></div>
      <Button type="submit" size="large" loading={submitting} loadingLabel="Criando contexto" iconAfter={<ArrowRight aria-hidden="true" size={18} />}>Criar contexto de venda</Button>
    </form>
  );
}
