"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ExternalLink, Send, ShieldCheck } from "lucide-react";
import { Button, Panel, StatusBadge } from "@midas/ui";
import { useAccountContext } from "@/components/account/account-context";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError } from "@/lib/api-client";
import { formatMinorString, formatRate, parseBrlMinor } from "./price";
import type {
  CatalogItemsResponse,
  ListingPlansResponse,
  SellerListing,
} from "./types";
import styles from "./seller-listings.module.css";

type FormErrors = Partial<Record<
  "publicSlug" | "catalogItemId" | "listingPlanId" | "price" | "quantity" | "conditionNotes",
  string
>>;

function requestMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.problem.code === "LISTING_SLUG_ALREADY_EXISTS") {
      return "Esse endereço já está em uso. Escolha outro.";
    }
    return error.problem.detail || error.problem.title;
  }
  return "Não foi possível salvar o anúncio. Tente novamente.";
}

function formString(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value : "";
}

export function NewListingView() {
  const { selectedSeller } = useAccountContext();
  const catalog = useApiResource<CatalogItemsResponse>("/v1/catalog/items?limit=200");
  const plans = useApiResource<ListingPlansResponse>("/v1/catalog/listing-plans");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submissionError, setSubmissionError] = useState<string>();
  const [createdListing, setCreatedListing] = useState<SellerListing>();
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setCreatedListing(undefined);
    setSubmissionError(undefined);
    setFormErrors({});
  }, [selectedSeller?.sellerAccountId]);

  useEffect(() => {
    if (createdListing) completionHeadingRef.current?.focus();
  }, [createdListing]);

  if (
    catalog.status === "loading"
    || catalog.status === "idle"
    || plans.status === "loading"
    || plans.status === "idle"
  ) {
    return <ResourceLoading label="Preparando o formulário de anúncio" />;
  }
  if (catalog.status === "error") return <ResourceError error={catalog.error} retry={catalog.retry} />;
  if (plans.status === "error") return <ResourceError error={plans.error} retry={plans.retry} />;
  if (!selectedSeller) return <ResourceLoading label="Carregando sua loja" />;

  const catalogItems = catalog.data?.data ?? [];
  const availablePlans = plans.data?.data ?? [];
  const seller = selectedSeller;
  if (!catalogItems.length) {
    return (
      <section className={styles.emptyState}>
        <span className={styles.eyebrow}>NOVO ANÚNCIO · INDISPONÍVEL</span>
        <h1>Ainda não há itens disponíveis para anunciar.</h1>
        <p>A criação ficará disponível assim que houver itens cadastrados para venda.</p>
        <div className={styles.inlineActions}>
          <Button variant="outline" onClick={catalog.retry}>Tentar novamente</Button>
          <Link className={styles.textAction} href="/vender/anuncios">Ver meus anúncios</Link>
        </div>
      </section>
    );
  }
  if (!availablePlans.length) {
    return (
      <section className={styles.emptyState}>
        <span className={styles.eyebrow}>NOVO ANÚNCIO · INDISPONÍVEL</span>
        <h1>Os planos de anúncio estão indisponíveis.</h1>
        <p>Você poderá continuar quando houver um plano disponível.</p>
        <Button variant="outline" onClick={plans.retry}>Tentar novamente</Button>
      </section>
    );
  }

  async function createListing(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const publicSlug = formString(form, "publicSlug").trim().toLowerCase();
    const catalogItemId = formString(form, "catalogItemId");
    const listingPlanId = formString(form, "listingPlanId");
    const price = formString(form, "price");
    const quantityInput = formString(form, "quantity");
    const conditionNotes = formString(form, "conditionNotes").trim();
    const priceMinor = parseBrlMinor(price);
    const quantityAvailable = Number(quantityInput);
    const errors: FormErrors = {};

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicSlug) || publicSlug.length > 200) {
      errors.publicSlug = "Use letras minúsculas, números e hífens, sem espaços.";
    }
    if (!catalogItems.some((item) => item.catalogItemId === catalogItemId)) {
      errors.catalogItemId = "Selecione um item da lista.";
    }
    if (!availablePlans.some((plan) => plan.listingPlanId === listingPlanId)) {
      errors.listingPlanId = "Escolha um plano de anúncio.";
    }
    if (priceMinor === null) errors.price = "Informe um preço maior que zero, por exemplo 1.249,90.";
    if (!Number.isInteger(quantityAvailable) || quantityAvailable < 1 || quantityAvailable > 10_000) {
      errors.quantity = "Informe uma quantidade entre 1 e 10.000.";
    }
    if (conditionNotes.length > 5_000) {
      errors.conditionNotes = "Reduza a descrição para até 5.000 caracteres.";
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || priceMinor === null) {
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    setSubmissionError(undefined);
    setSubmitting(true);
    try {
      const listing = await apiRequest<SellerListing>("/v1/listings", {
        method: "POST",
        body: JSON.stringify({
          publicSlug,
          catalogItemId,
          sellerAccountId: seller.sellerAccountId,
          listingPlanId,
          priceMinor: String(priceMinor),
          currency: "BRL",
          quantityAvailable,
          ...(conditionNotes ? { conditionNotes } : {}),
        }),
      });
      setCreatedListing(listing);
    } catch (error) {
      setSubmissionError(requestMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function publishListing() {
    if (!createdListing) return;
    setSubmissionError(undefined);
    setPublishing(true);
    try {
      const listing = await apiRequest<SellerListing>(
        `/v1/listings/${encodeURIComponent(createdListing.listingId)}/publish`,
        { method: "POST" },
      );
      setCreatedListing(listing);
    } catch (error) {
      setSubmissionError(requestMessage(error));
    } finally {
      setPublishing(false);
    }
  }

  if (createdListing) {
    const published = createdListing.listingStatus === "PUBLISHED";
    return (
      <section className={styles.completion} aria-labelledby="listing-created-title">
        <div className={styles.completionMark} data-published={published || undefined}>
          {published ? <CheckCircle2 aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
        </div>
        <span className={styles.eyebrow}>{published ? "ANÚNCIO PUBLICADO" : "RASCUNHO SALVO"}</span>
        <h1 id="listing-created-title" ref={completionHeadingRef} tabIndex={-1}>
          {published ? "Seu anúncio está no ar." : "Seu rascunho está pronto."}
        </h1>
        <p>
          {published
            ? "A publicação foi concluída e o anúncio já pode ser visto pelos compradores."
            : "Revise o resumo abaixo e publique quando estiver pronto."}
        </p>
        <Panel as="div" className={styles.createdCard}>
          <div>
            <small>Endereço</small>
            <strong>/{createdListing.publicSlug}</strong>
          </div>
          <div>
            <small>Preço</small>
            <strong>{formatMinorString(createdListing.priceMinor, createdListing.currency)}</strong>
          </div>
          <div>
            <small>Situação</small>
            <StatusBadge tone={published ? "success" : "warning"}>{published ? "Publicado" : "Rascunho"}</StatusBadge>
          </div>
        </Panel>
        {submissionError ? <p className={styles.errorBanner} role="alert">{submissionError}</p> : null}
        <div className={styles.inlineActions}>
          {!published ? (
            <Button
              size="large"
              loading={publishing}
              loadingLabel="Publicando"
              iconAfter={<Send aria-hidden="true" size={18} />}
              onClick={() => { void publishListing(); }}
            >
              Publicar anúncio
            </Button>
          ) : (
            <Link className={styles.primaryAction} href={`/anuncios/${encodeURIComponent(createdListing.publicSlug)}`}>
              Abrir anúncio <ExternalLink aria-hidden="true" size={17} />
            </Link>
          )}
          <Link
            className={styles.textAction}
            href={`/vender/anuncios?sellerAccountId=${encodeURIComponent(seller.sellerAccountId)}`}
          >
            Ver todos os anúncios
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className={styles.pageStack}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>ÁREA DO VENDEDOR · NOVO ANÚNCIO</span>
          <h1>Crie um anúncio para vender.</h1>
          <p>Escolha o item, defina preço e estoque e revise tudo antes de publicar.</p>
        </div>
        <div className={styles.sourceStamp}>
          <span>Opções disponíveis</span>
          <strong>{catalogItems.length} itens · {availablePlans.length} planos</strong>
        </div>
      </header>

      <form ref={formRef} className={styles.formLayout} onSubmit={(event) => { void createListing(event); }} noValidate>
        <div className={styles.formMain}>
          <Panel className={styles.formSection}>
            <header>
              <span>01</span>
              <div><h2>O que você vai vender</h2><p>Escolha o item e crie um endereço fácil de reconhecer.</p></div>
            </header>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="catalogItemId">Item</label>
                <select id="catalogItemId" name="catalogItemId" required aria-invalid={Boolean(formErrors.catalogItemId)} aria-describedby={formErrors.catalogItemId ? "catalogItemId-error" : "catalogItemId-hint"} defaultValue="">
                  <option value="" disabled>Selecione um item</option>
                  {catalogItems.map((item) => (
                    <option value={item.catalogItemId} key={item.catalogItemId}>{item.displayName} · {item.gameOrigin}</option>
                  ))}
                </select>
                <small id={formErrors.catalogItemId ? "catalogItemId-error" : "catalogItemId-hint"} role={formErrors.catalogItemId ? "alert" : undefined} className={formErrors.catalogItemId ? styles.fieldError : undefined}>{formErrors.catalogItemId || "Escolha um item cadastrado para começar."}</small>
              </div>
              <div className={styles.field}>
                <label htmlFor="publicSlug">Endereço do anúncio</label>
                <input id="publicSlug" name="publicSlug" type="text" autoComplete="off" required maxLength={200} placeholder="ak-47-redline" aria-invalid={Boolean(formErrors.publicSlug)} aria-describedby={formErrors.publicSlug ? "publicSlug-error" : "publicSlug-hint"} />
                <small id={formErrors.publicSlug ? "publicSlug-error" : "publicSlug-hint"} role={formErrors.publicSlug ? "alert" : undefined} className={formErrors.publicSlug ? styles.fieldError : undefined}>{formErrors.publicSlug || "Use letras minúsculas, números e hífens."}</small>
              </div>
            </div>
          </Panel>

          <Panel className={styles.formSection}>
            <header>
              <span>02</span>
              <div><h2>Preço e disponibilidade</h2><p>Defina o valor e quantas unidades estão disponíveis.</p></div>
            </header>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label htmlFor="price">Preço em reais</label>
                <div className={styles.moneyInput}><span>R$</span><input id="price" name="price" type="text" inputMode="decimal" required placeholder="1.249,90" aria-invalid={Boolean(formErrors.price)} aria-describedby={formErrors.price ? "price-error" : "price-hint"} /></div>
                <small id={formErrors.price ? "price-error" : "price-hint"} role={formErrors.price ? "alert" : undefined} className={formErrors.price ? styles.fieldError : undefined}>{formErrors.price || "Exemplo: 1.249,90."}</small>
              </div>
              <div className={styles.field}>
                <label htmlFor="quantity">Quantidade disponível</label>
                <input id="quantity" name="quantity" type="number" inputMode="numeric" required min={1} max={10_000} step={1} defaultValue={1} aria-invalid={Boolean(formErrors.quantity)} aria-describedby={formErrors.quantity ? "quantity-error" : "quantity-hint"} />
                <small id={formErrors.quantity ? "quantity-error" : "quantity-hint"} role={formErrors.quantity ? "alert" : undefined} className={formErrors.quantity ? styles.fieldError : undefined}>{formErrors.quantity || "Informe quantas unidades podem ser vendidas."}</small>
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="conditionNotes">Condição e observações</label>
              <textarea id="conditionNotes" name="conditionNotes" maxLength={5_000} rows={5} placeholder="Descreva estado, variação, detalhes visuais e o que será entregue." aria-invalid={Boolean(formErrors.conditionNotes)} aria-describedby={formErrors.conditionNotes ? "conditionNotes-error" : "conditionNotes-hint"} />
              <small id={formErrors.conditionNotes ? "conditionNotes-error" : "conditionNotes-hint"} role={formErrors.conditionNotes ? "alert" : undefined} className={formErrors.conditionNotes ? styles.fieldError : undefined}>{formErrors.conditionNotes || "Não inclua telefone, e-mail ou dados de pagamento."}</small>
            </div>
          </Panel>
        </div>

        <aside className={styles.planColumn}>
          <fieldset className={styles.planPicker} aria-invalid={Boolean(formErrors.listingPlanId)} aria-describedby={formErrors.listingPlanId ? "listingPlanId-error" : "listingPlanId-hint"}>
            <legend>03 · Escolha como anunciar</legend>
            {availablePlans.map((plan, index) => (
              <label key={plan.listingPlanId}>
                <input type="radio" name="listingPlanId" value={plan.listingPlanId} required defaultChecked={index === 0} />
                <span className={styles.planTopline}><strong>{plan.displayName}</strong></span>
                <span className={styles.planFee}>{formatRate(plan.platformFeeRate)} de comissão sobre a venda</span>
                <span className={styles.planMeta}>
                  {plan.planCode === "BASIC" ? "Exibição padrão" : plan.planCode === "VIP" ? "Exibição com prioridade" : "Maior prioridade de exibição"}
                </span>
              </label>
            ))}
          </fieldset>
          <small id={formErrors.listingPlanId ? "listingPlanId-error" : "listingPlanId-hint"} role={formErrors.listingPlanId ? "alert" : undefined} className={formErrors.listingPlanId ? styles.fieldError : styles.planHint}>{formErrors.listingPlanId || "A comissão e os benefícios ficam definidos ao salvar o rascunho."}</small>
          {submissionError ? <p className={styles.errorBanner} role="alert">{submissionError}</p> : null}
          <Button type="submit" size="large" fullWidth loading={submitting} loadingLabel="Salvando rascunho" iconAfter={<ArrowRight aria-hidden="true" size={18} />}>Salvar rascunho</Button>
          <p className={styles.submitNotice}><ShieldCheck aria-hidden="true" size={16} /> Nada será publicado sem sua confirmação.</p>
        </aside>
      </form>
    </div>
  );
}
