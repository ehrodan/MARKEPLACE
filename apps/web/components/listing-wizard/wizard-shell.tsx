"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SubmitEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  HardDriveDownload,
  Plus,
} from "lucide-react";
import { Button, PageState, Panel, StatusBadge } from "@midas/ui";
import { useAccountContext } from "@/components/account/account-context";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import type {
  CatalogItem,
  CatalogItemsResponse,
  ListingPlan,
  ListingPlansResponse,
  SellerListing,
} from "@/components/seller-listings/types";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError, type ApiError } from "@/lib/api-client";
import { StepDelivery, StepItem } from "./step-item";
import { StepPricing } from "./step-pricing";
import { StepProof } from "./step-proof";
import { StepPublish } from "./step-publish";
import {
  WIZARD_STEP_ORDER,
  buildCreateListingBody,
  buildUpdateListingBody,
  createEmptyDraft,
  draftFromListing,
  draftStorageKey,
  draftsDiffer,
  evaluateWizard,
  fieldDomId,
  fieldErrors,
  hasPendingChanges,
  parseStoredDraft,
  serializeDraft,
  type WizardBlocker,
  type WizardContext,
  type WizardDraft,
  type WizardFieldKey,
  type WizardStepId,
  type WizardStepState,
} from "./wizard-state";
import styles from "./listing-wizard.module.css";

/** O payload de /v1/seller-accounts/:id/listings carrega o plano congelado do anúncio. */
interface SellerListingWithPlan extends SellerListing {
  listingPlan?: ListingPlan;
}

interface SellerListingsPage {
  data: SellerListingWithPlan[];
  nextCursor: string | null;
  asOf: string;
}

/** Páginas percorridas ao procurar um rascunho: 10 x 200 anúncios. */
const LOOKUP_PAGE_SIZE = 200;
const LOOKUP_MAX_PAGES = 10;

type LookupState =
  | { status: "idle" | "loading" }
  | { status: "ready"; listing: SellerListingWithPlan }
  | { status: "exhausted" }
  | { status: "error"; error: ApiError | Error };

function problemMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.problem.detail || error.problem.title;
  return fallback;
}

function problemReference(error: unknown): string | undefined {
  if (!isApiError(error)) return undefined;
  const { code, correlationId, status } = error.problem;
  return [code ?? `HTTP ${String(status)}`, correlationId].filter(Boolean).join(" · ");
}

function readStoredDraft(key: string): WizardDraft | null {
  try {
    return parseStoredDraft(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStoredDraft(key: string, draft: WizardDraft): void {
  try {
    window.localStorage.setItem(key, serializeDraft(draft));
  } catch {
    // Armazenamento indisponível (modo privado/cota). O wizard segue em memória.
  }
}

function clearStoredDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Sem armazenamento não há o que limpar.
  }
}

/** Procura um anúncio do vendedor por id, paginando o contrato que existe. */
function useSellerListingLookup(
  sellerAccountId: string | undefined,
  listingId: string | undefined,
): { state: LookupState; retry: () => void } {
  const [state, setState] = useState<LookupState>({ status: listingId ? "loading" : "idle" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!listingId || !sellerAccountId) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading" });

    const run = async (): Promise<void> => {
      let cursor: string | null = null;
      for (let page = 0; page < LOOKUP_MAX_PAGES; page += 1) {
        const query = new URLSearchParams({ limit: String(LOOKUP_PAGE_SIZE) });
        if (cursor) query.set("cursor", cursor);
        const response: SellerListingsPage = await apiRequest<SellerListingsPage>(
          `/v1/seller-accounts/${encodeURIComponent(sellerAccountId)}/listings?${query.toString()}`,
          { signal: controller.signal },
        );
        const found = response.data.find((item) => item.listingId === listingId);
        if (found) {
          setState({ status: "ready", listing: found });
          return;
        }
        if (!response.nextCursor) break;
        cursor = response.nextCursor;
      }
      setState({ status: "exhausted" });
    };

    void run().catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setState({
        status: "error",
        error: error instanceof Error ? error : new Error("Falha desconhecida"),
      });
    });

    return () => {
      controller.abort();
    };
  }, [attempt, listingId, sellerAccountId]);

  return { state, retry };
}

export interface WizardShellProps {
  /** Ausente = criação. Presente = edição de um anúncio real. */
  listingId?: string | undefined;
  initialStepId?: WizardStepId | undefined;
  /** Rota canônica do wizard, usada quando a URL atual é um atalho para um passo. */
  stepBasePath?: string | undefined;
  onClose?: (() => void) | undefined;
}

export function WizardShell({
  listingId,
  initialStepId = "item",
  stepBasePath,
  onClose,
}: WizardShellProps) {
  const { selectedSeller } = useAccountContext();
  const sellerAccountId = selectedSeller?.sellerAccountId;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const catalog = useApiResource<CatalogItemsResponse>("/v1/catalog/items?limit=200");
  const plansResource = useApiResource<ListingPlansResponse>("/v1/catalog/listing-plans");
  const { state: lookup, retry: retryLookup } = useSellerListingLookup(sellerAccountId, listingId);

  const [listing, setListing] = useState<SellerListingWithPlan | null>(null);
  const [draft, setDraft] = useState<WizardDraft>(createEmptyDraft);
  const [stepId, setStepId] = useState<WizardStepId>(initialStepId);
  const [pendingFocus, setPendingFocus] = useState<string>();
  const [recovered, setRecovered] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [actionError, setActionError] = useState<{ message: string; reference?: string }>();
  const [notice, setNotice] = useState<string>();
  const hydratedKeyRef = useRef<string>("");

  const lookedUpListing = lookup.status === "ready" ? lookup.listing : null;
  useEffect(() => {
    if (lookedUpListing) setListing(lookedUpListing);
  }, [lookedUpListing]);

  const storageKey = draftStorageKey({
    sellerAccountId,
    listingId: listing?.listingId ?? listingId,
  });
  const baselineDraft = useMemo(
    () => (listing ? draftFromListing(listing) : createEmptyDraft()),
    [listing],
  );
  const readyToHydrate = listingId ? listing !== null : Boolean(sellerAccountId);

  useEffect(() => {
    if (!readyToHydrate || hydratedKeyRef.current === storageKey) return;
    const stored = readStoredDraft(storageKey);
    if (stored && draftsDiffer(stored, baselineDraft)) {
      setDraft(stored);
      setRecovered(true);
    } else {
      setDraft(baselineDraft);
      setRecovered(false);
    }
    hydratedKeyRef.current = storageKey;
  }, [baselineDraft, readyToHydrate, storageKey]);

  useEffect(() => {
    if (hydratedKeyRef.current !== storageKey) return;
    writeStoredDraft(storageKey, draft);
  }, [draft, storageKey]);

  useEffect(() => {
    if (!pendingFocus) return;
    document.getElementById(pendingFocus)?.focus();
    setPendingFocus(undefined);
  }, [pendingFocus, stepId]);

  const onFieldChange = useCallback(
    <K extends WizardFieldKey>(key: K, value: WizardDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
      setNotice(undefined);
    },
    [],
  );

  const goToStep = useCallback(
    (next: WizardStepId, focusFieldKey?: WizardFieldKey) => {
      setStepId(next);
      if (focusFieldKey) setPendingFocus(fieldDomId(focusFieldKey));
      if (stepBasePath && pathname !== stepBasePath) {
        const query = searchParams.toString();
        router.replace(query ? `${stepBasePath}?${query}` : stepBasePath, { scroll: false });
      }
    },
    [pathname, router, searchParams, stepBasePath],
  );

  const goToBlocker = useCallback(
    (blocker: WizardBlocker) => {
      goToStep(blocker.stepId, blocker.fieldKey ?? undefined);
    },
    [goToStep],
  );

  const catalogItems: readonly CatalogItem[] = catalog.status === "ready" ? catalog.data.data : [];
  const activePlans: readonly ListingPlan[] =
    plansResource.status === "ready" ? plansResource.data.data : [];

  const snapshotPlan = listing?.listingPlan;
  const plansForPricing = useMemo<readonly ListingPlan[]>(() => {
    if (!snapshotPlan) return activePlans;
    return activePlans.some((plan) => plan.listingPlanId === snapshotPlan.listingPlanId)
      ? activePlans
      : [...activePlans, snapshotPlan];
  }, [activePlans, snapshotPlan]);

  const context: WizardContext = useMemo(
    () => ({
      catalogItemIds: [
        ...catalogItems.map((item) => item.catalogItemId),
        ...(listing ? [listing.catalogItemId] : []),
      ],
      listingPlanIds: [
        ...plansForPricing.map((plan) => plan.listingPlanId),
        ...(listing ? [listing.listingPlanId] : []),
      ],
      listingStatus: listing?.listingStatus ?? null,
    }),
    [catalogItems, listing, plansForPricing],
  );

  const evaluation = useMemo(() => evaluateWizard(draft, context), [context, draft]);
  const currentStep = evaluation.steps.find((step) => step.id === stepId);
  const errors = useMemo(() => fieldErrors(currentStep?.blockers ?? []), [currentStep]);
  const completedCount = evaluation.steps.filter((step) => step.status === "complete").length;

  const updateBody = useMemo(
    () =>
      listing
        ? buildUpdateListingBody(
            draft,
            {
              priceMinor: listing.priceMinor,
              quantityAvailable: listing.quantityAvailable,
              conditionNotes: listing.conditionNotes,
            },
            changeReason,
          )
        : {},
    [changeReason, draft, listing],
  );
  const pendingUpdate = hasPendingChanges(updateBody);

  const save = useCallback(async () => {
    if (!sellerAccountId) return;
    setActionError(undefined);
    setNotice(undefined);
    setSaving(true);
    try {
      if (!listing) {
        const body = buildCreateListingBody(draft, sellerAccountId, context);
        if (!body) return;
        const created = await apiRequest<SellerListingWithPlan>("/v1/listings", {
          method: "POST",
          body: JSON.stringify(body),
        });
        clearStoredDraft(storageKey);
        hydratedKeyRef.current = "";
        setListing(created);
        setRecovered(false);
        setNotice(
          `Rascunho gravado no servidor com o identificador ${created.listingId}. Ele não está público.`,
        );
      } else {
        if (!pendingUpdate) return;
        const updated = await apiRequest<SellerListingWithPlan>(
          `/v1/listings/${encodeURIComponent(listing.listingId)}`,
          { method: "PATCH", body: JSON.stringify(updateBody) },
        );
        hydratedKeyRef.current = "";
        setListing(updated);
        setChangeReason("");
        setRecovered(false);
        setNotice(`Alterações salvas. O anúncio está na versão ${String(updated.version)}.`);
      }
    } catch (error) {
      setActionError({
        message: problemMessage(error, "Não foi possível gravar. Nada foi alterado no servidor."),
        ...(problemReference(error) ? { reference: problemReference(error) } : {}),
      });
    } finally {
      setSaving(false);
    }
  }, [context, draft, listing, pendingUpdate, sellerAccountId, storageKey, updateBody]);

  const publish = useCallback(async () => {
    if (!listing) return;
    setActionError(undefined);
    setNotice(undefined);
    setPublishing(true);
    try {
      const updated = await apiRequest<SellerListingWithPlan>(
        `/v1/listings/${encodeURIComponent(listing.listingId)}/publish`,
        { method: "POST" },
      );
      clearStoredDraft(storageKey);
      hydratedKeyRef.current = "";
      setListing(updated);
      setNotice("A API confirmou a publicação. O anúncio está visível nas superfícies públicas.");
    } catch (error) {
      setActionError({
        message: problemMessage(error, "Não foi possível publicar. O estado no servidor não mudou."),
        ...(problemReference(error) ? { reference: problemReference(error) } : {}),
      });
    } finally {
      setPublishing(false);
    }
  }, [listing, storageKey]);

  const discardRecovered = useCallback(() => {
    setDraft(baselineDraft);
    setRecovered(false);
    clearStoredDraft(storageKey);
  }, [baselineDraft, storageKey]);

  // ---- Estados de carregamento e indisponibilidade -------------------------

  if (!selectedSeller) return <ResourceLoading label="Confirmando contexto de venda" />;
  if (catalog.status === "loading" || catalog.status === "idle") {
    return <ResourceLoading label="Carregando catálogo canônico" />;
  }
  if (catalog.status === "error") {
    return <ResourceError error={catalog.error} retry={catalog.retry} />;
  }
  if (plansResource.status === "loading" || plansResource.status === "idle") {
    return <ResourceLoading label="Carregando planos de anúncio" />;
  }
  if (plansResource.status === "error") {
    return <ResourceError error={plansResource.error} retry={plansResource.retry} />;
  }
  if (listingId) {
    if (lookup.status === "loading" || lookup.status === "idle") {
      return <ResourceLoading label="Carregando o anúncio desta conta" />;
    }
    if (lookup.status === "error") {
      return <ResourceError error={lookup.error} retry={retryLookup} />;
    }
    if (lookup.status === "exhausted" && !listing) {
      return (
        <PageState
          kind="empty"
          title="Este anúncio não foi encontrado nesta conta"
          description={`O contrato atual não expõe GET /v1/listings/{listingId} para rascunho: a busca percorreu ${String(LOOKUP_MAX_PAGES * LOOKUP_PAGE_SIZE)} anúncios de ${selectedSeller.displayName} e não encontrou este identificador. Confirme a conta selecionada ou abra o anúncio pela lista.`}
          reference={listingId}
          actions={
            <div className={styles.actionsEnd}>
              <Button variant="outline" onClick={retryLookup}>
                Consultar novamente
              </Button>
              <Link className={styles.textAction} href="/vender/anuncios">
                Ver meus anúncios
              </Link>
            </div>
          }
        />
      );
    }
  }
  if (!listingId && catalogItems.length === 0) {
    return (
      <PageState
        kind="empty"
        title="O catálogo canônico ainda não tem itens"
        description="Um anúncio só nasce de um item já publicado no catálogo. Nenhum item de exemplo é criado pelo navegador para destravar esta tela."
        actions={
          <Button variant="outline" onClick={catalog.retry}>
            Consultar novamente
          </Button>
        }
      />
    );
  }
  if (!listingId && activePlans.length === 0) {
    return (
      <PageState
        kind="unavailable"
        title="Nenhum plano de anúncio está ativo"
        description="GET /v1/catalog/listing-plans não devolveu plano válido para agora. Sem plano não há comissão definida, e nenhuma taxa é presumida aqui."
        actions={
          <Button variant="outline" onClick={plansResource.retry}>
            Consultar novamente
          </Button>
        }
      />
    );
  }

  const activeStep: WizardStepState | undefined = currentStep ?? evaluation.steps.at(0);
  if (!activeStep) return null;

  const stepIndex = WIZARD_STEP_ORDER.indexOf(activeStep.id);
  const previousStep = stepIndex > 0 ? WIZARD_STEP_ORDER[stepIndex - 1] : undefined;
  const nextStep =
    stepIndex >= 0 && stepIndex < WIZARD_STEP_ORDER.length - 1
      ? WIZARD_STEP_ORDER[stepIndex + 1]
      : undefined;

  function submitStep(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nextStep) goToStep(nextStep);
  }

  return (
    <div className={styles.wizard}>
      <header className={styles.wizardHeader}>
        <div>
          <span className={styles.eyebrow}>
            {listing ? "VENDEDOR · EDITAR ANÚNCIO" : "VENDEDOR · NOVO ANÚNCIO"}
          </span>
          <h2>{listing ? "Revisar antes de publicar." : "Cinco passos até a oferta."}</h2>
          <p>
            {listing
              ? "O anúncio já existe no servidor. Aqui você corrige o que o contrato permite alterar e decide a publicação separadamente."
              : "Nada vai ao ar sem a sua segunda confirmação. O rascunho é gravado primeiro e a publicação é uma decisão à parte."}
          </p>
        </div>
        <div className={styles.sourceStamp}>
          <span>Conta em operação</span>
          <strong>{selectedSeller.displayName}</strong>
          {listing ? (
            <code>{listing.listingId}</code>
          ) : (
            <code>
              {catalogItems.length} itens · {activePlans.length} planos
            </code>
          )}
        </div>
      </header>

      {recovered ? (
        <div className={styles.recovered}>
          <span>
            <HardDriveDownload aria-hidden="true" size={15} /> Recuperamos o que você tinha preenchido
            neste navegador e ainda não foi enviado ao servidor.
          </span>
          <Button variant="ghost" size="small" onClick={discardRecovered}>
            {listing ? "Descartar e usar o que está no servidor" : "Descartar e começar do zero"}
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <p className={styles.banner} data-tone="error" role="alert">
          <CircleAlert aria-hidden="true" size={17} />
          <span>
            {actionError.message}
            {actionError.reference ? <code>{actionError.reference}</code> : null}
          </span>
        </p>
      ) : null}

      {notice ? (
        <p className={styles.banner} data-tone="success" role="status">
          <CheckCircle2 aria-hidden="true" size={17} />
          <span>{notice}</span>
        </p>
      ) : null}

      <div className={styles.layout}>
        <nav className={styles.rail} aria-label="Passos do anúncio">
          <p className={styles.progressLine} aria-live="polite">
            Passo {activeStep.position} de {WIZARD_STEP_ORDER.length} · {activeStep.title} ·{" "}
            {completedCount} de {WIZARD_STEP_ORDER.length} concluídos
          </p>
          <ol className={styles.stepper}>
            {evaluation.steps.map((step) => (
              <li key={step.id}>
                <button
                  type="button"
                  className={styles.stepButton}
                  data-status={step.status}
                  aria-current={step.id === activeStep.id ? "step" : undefined}
                  onClick={() => {
                    goToStep(step.id);
                  }}
                >
                  <span className={styles.stepIndex} aria-hidden="true">
                    {step.position}
                  </span>
                  <span className={styles.stepText}>
                    <strong>{step.title}</strong>
                    <small>{step.summary}</small>
                  </span>
                  <span className={styles.stepMark}>
                    {step.status === "complete"
                      ? "ok"
                      : `${String(step.blockers.length)} pend.`}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.railFooter}>
            <small>
              Seu preenchimento fica salvo neste navegador a cada alteração e volta quando você
              retornar, mesmo antes de existir rascunho no servidor.
            </small>
            {listing ? (
              <span className={styles.statusLine}>
                <StatusBadge
                  tone={listing.listingStatus === "PUBLISHED" ? "success" : "warning"}
                >
                  {listing.listingStatus}
                </StatusBadge>
              </span>
            ) : null}
            {onClose ? (
              <Button variant="ghost" size="small" onClick={onClose}>
                Fechar o wizard
              </Button>
            ) : null}
          </div>
        </nav>

        <div className={styles.stepColumn}>
          <form
            className={styles.form}
            onSubmit={submitStep}
            noValidate
            aria-labelledby={`wizard-step-${activeStep.id}-title`}
          >
            <div className={styles.formHead}>
              <h3 id={`wizard-step-${activeStep.id}-title`}>
                {activeStep.position}. {activeStep.title}
              </h3>
              <p>{activeStep.summary}</p>
            </div>

            {activeStep.id === "item" ? (
              <StepItem
                draft={draft}
                errors={errors}
                listingStatus={context.listingStatus}
                onFieldChange={onFieldChange}
                catalogItems={catalogItems}
              />
            ) : null}
            {activeStep.id === "pricing" ? (
              <StepPricing
                draft={draft}
                errors={errors}
                listingStatus={context.listingStatus}
                onFieldChange={onFieldChange}
                plans={plansForPricing}
              />
            ) : null}
            {activeStep.id === "proof" ? (
              <StepProof
                draft={draft}
                errors={errors}
                listingStatus={context.listingStatus}
                onFieldChange={onFieldChange}
                listingExists={listing !== null}
              />
            ) : null}
            {activeStep.id === "delivery" ? (
              <StepDelivery
                draft={draft}
                errors={errors}
                listingStatus={context.listingStatus}
                onFieldChange={onFieldChange}
              />
            ) : null}
            {activeStep.id === "publish" ? (
              <StepPublish
                draft={draft}
                listing={listing}
                catalogItem={
                  catalogItems.find((item) => item.catalogItemId === draft.catalogItemId)
                  ?? listing?.catalogItem
                }
                plan={plansForPricing.find((plan) => plan.listingPlanId === draft.listingPlanId)}
                publishBlockers={evaluation.publishBlockers}
                canSubmitDraft={evaluation.canSubmitDraft}
                canPublish={evaluation.canPublish}
                saving={saving}
                publishing={publishing}
                pendingUpdate={pendingUpdate}
                changeReason={changeReason}
                onChangeReason={setChangeReason}
                onSave={() => {
                  void save();
                }}
                onPublish={() => {
                  void publish();
                }}
                onGoToBlocker={goToBlocker}
              />
            ) : null}

            <div className={styles.actions}>
              <Button
                type="button"
                variant="ghost"
                iconBefore={<ArrowLeft aria-hidden="true" size={16} />}
                disabled={!previousStep}
                onClick={() => {
                  if (previousStep) goToStep(previousStep);
                }}
              >
                Passo anterior
              </Button>
              <div className={styles.actionsEnd}>
                {activeStep.status === "pending" && activeStep.id !== "publish" ? (
                  <span className={styles.savedMark}>
                    {activeStep.blockers.length} pendência
                    {activeStep.blockers.length === 1 ? "" : "s"} neste passo
                  </span>
                ) : null}
                {nextStep ? (
                  <Button type="submit" iconAfter={<ArrowRight aria-hidden="true" size={16} />}>
                    Continuar sem perder o preenchido
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const LAUNCHER_STEPS: readonly { title: string; text: string }[] = [
  { title: "Dados do item", text: "Produto escolhido e o que o comprador recebe" },
  { title: "Preço", text: "Valor, plano e quanto sobra para você" },
  { title: "Prova de posse", text: "Comprovação para análise" },
  { title: "Entrega", text: "Método e prazo que você assume" },
  { title: "Publicação", text: "Revisar e decidir" },
];

/**
 * Cartão de entrada do wizard na lista de anúncios (SCR-SEL-005).
 * Abre por estado local ou pelo parâmetro `criar=1`, para o endereço poder ser
 * recarregado sem perder o passo.
 */
export function WizardLauncher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = searchParams.get("criar") === "1";

  const setOpen = useCallback(
    (next: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("criar", "1");
      else params.delete("criar");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  if (open) {
    return (
      <Panel as="section" className={styles.launcherSlot} aria-label="Criar novo anúncio">
        <WizardShell
          onClose={() => {
            setOpen(false);
          }}
        />
      </Panel>
    );
  }

  return (
    <Panel
      as="section"
      className={`${styles.launcherSlot} ${styles.launcher}`}
      aria-labelledby="wizard-launcher-title"
    >
      <div className={styles.launcherHead}>
        <div>
          <span className={styles.eyebrow}>CRIAR NOVO ANÚNCIO</span>
          <h2 id="wizard-launcher-title">Cinco passos, duas decisões.</h2>
          <p>
            Gravar o rascunho e publicar são confirmações separadas. Você pode parar em qualquer
            passo: o preenchimento fica salvo neste navegador e volta quando você retornar.
          </p>
        </div>
        <Button
          onClick={() => {
            setOpen(true);
          }}
          iconBefore={<Plus aria-hidden="true" size={17} />}
        >
          Começar agora
        </Button>
      </div>
      <ol className={styles.launcherSteps}>
        {LAUNCHER_STEPS.map((step, index) => (
          <li className={styles.launcherStep} key={step.title}>
            <b>{index + 1}</b>
            <div>
              <strong>{step.title}</strong>
              <small>{step.text}</small>
            </div>
          </li>
        ))}
      </ol>
      <p className={styles.savedMark}>
        <CheckCircle2 aria-hidden="true" size={13} /> Rascunho e publicação usam confirmações separadas.
      </p>
    </Panel>
  );
}
