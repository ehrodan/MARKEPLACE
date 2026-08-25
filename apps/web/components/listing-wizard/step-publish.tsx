"use client";

import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  Save,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Button, StatusBadge } from "@midas/ui";
import { formatMinorString, formatRate } from "@/components/seller-listings/price";
import type {
  CatalogItem,
  ListingPlan,
  ListingStatus,
  SellerListing,
} from "@/components/seller-listings/types";
import { WizardNote } from "./step-item";
import {
  computeFeeBreakdown,
  parseQuantity,
  priceInputToMinor,
  stepTitle,
  type WizardBlocker,
  type WizardDraft,
} from "./wizard-state";
import styles from "./listing-wizard.module.css";

const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Rascunho",
  REVIEW: "Em revisão",
  PUBLISHED: "Publicado",
  PAUSED: "Pausado",
  SOLD: "Vendido",
  TOMBSTONE: "Encerrado",
};

function statusTone(status: ListingStatus): "neutral" | "success" | "warning" | "info" {
  if (status === "PUBLISHED" || status === "SOLD") return "success";
  if (status === "DRAFT" || status === "REVIEW") return "warning";
  if (status === "PAUSED") return "info";
  return "neutral";
}

export interface StepPublishProps {
  draft: WizardDraft;
  listing: SellerListing | null;
  catalogItem: CatalogItem | undefined;
  plan: ListingPlan | undefined;
  publishBlockers: readonly WizardBlocker[];
  canSubmitDraft: boolean;
  canPublish: boolean;
  saving: boolean;
  publishing: boolean;
  pendingUpdate: boolean;
  changeReason: string;
  onChangeReason: (value: string) => void;
  onSave: () => void;
  onPublish: () => void;
  onGoToBlocker: (blocker: WizardBlocker) => void;
}

/**
 * Passo 5 — Publicação.
 * Gravar e publicar são DUAS decisões. O domínio nasce em DRAFT e só sai de lá
 * por POST /v1/listings/:listingId/publish, com confirmação separada aqui.
 */
export function StepPublish({
  draft,
  listing,
  catalogItem,
  plan,
  publishBlockers,
  canSubmitDraft,
  canPublish,
  saving,
  publishing,
  pendingUpdate,
  changeReason,
  onChangeReason,
  onSave,
  onPublish,
  onGoToBlocker,
}: StepPublishProps) {
  const priceMinor = priceInputToMinor(draft.priceInput);
  const quantity = parseQuantity(draft.quantityAvailable) ?? 1;
  const breakdown =
    priceMinor && plan
      ? computeFeeBreakdown({
          priceMinor,
          quantity,
          platformFeeRate: plan.platformFeeRate,
          pspFeeRate: plan.pspFeeRate,
        })
      : null;
  const firstBlocker: WizardBlocker | undefined = publishBlockers.at(0);

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend>Revisão do que será gravado</legend>
        <dl className={styles.summary}>
          <div className={styles.summaryRow}>
            <dt>Item</dt>
            <dd>
              {catalogItem
                ? `${catalogItem.displayName} · ${catalogItem.gameOrigin}`
                : "Nenhum item selecionado"}
            </dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Endereço público</dt>
            <dd>
              <code>{draft.publicSlug || "—"}</code>
            </dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Preço e quantidade</dt>
            <dd>
              {priceMinor ? formatMinorString(priceMinor, "BRL") : "—"} · {quantity}{" "}
              {quantity === 1 ? "unidade" : "unidades"}
            </dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Plano</dt>
            <dd>
              {plan
                ? `${plan.displayName} (${plan.planCode}) · comissão ${formatRate(plan.platformFeeRate)} · PSP ${formatRate(plan.pspFeeRate)}`
                : "Nenhum plano selecionado"}
            </dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Líquido estimado</dt>
            <dd>
              {breakdown
                ? `${formatMinorString(breakdown.netMinor, "BRL")} por unidade vendida (estimativa)`
                : "Depende de preço e plano válidos"}
            </dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Prova de posse</dt>
            <dd>
              {draft.proofKind ? (
                <>
                  <code>{draft.proofKind}</code> — {draft.proofReference || "sem referência escrita"}
                </>
              ) : (
                "Nenhuma declaração"
              )}
            </dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Entrega</dt>
            <dd>
              {draft.deliveryMethod ? (
                <>
                  <code>{draft.deliveryMethod}</code> — prazo assumido de{" "}
                  {draft.deliveryWindowHours || "—"} h
                </>
              ) : (
                "Nenhum método escolhido"
              )}
            </dd>
          </div>
          <div className={styles.summaryRow}>
            <dt>Descrição</dt>
            <dd>{draft.conditionNotes || "—"}</dd>
          </div>
        </dl>
      </fieldset>

      {publishBlockers.length > 0 ? (
        <div className={styles.blockerPanel} id="publish-blockers">
          <strong>
            <TriangleAlert aria-hidden="true" size={16} />
            Falta isto para publicar ({publishBlockers.length})
          </strong>
          <ul className={styles.blockerList}>
            {publishBlockers.map((blocker) => (
              <li key={`${blocker.stepId}-${blocker.fieldKey ?? "geral"}-${blocker.message}`}>
                {blocker.fieldKey ? (
                  <button
                    type="button"
                    className={styles.blockerButton}
                    onClick={() => {
                      onGoToBlocker(blocker);
                    }}
                  >
                    <span>{blocker.message}</span>
                    <span>
                      {stepTitle(blocker.stepId)} <ArrowRight aria-hidden="true" size={13} />
                    </span>
                  </button>
                ) : (
                  <p className={styles.blockerStatic}>
                    <TriangleAlert aria-hidden="true" size={14} />
                    <span>{blocker.message}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset className={styles.fieldset}>
        <legend>{listing ? "Decisão 1 · Salvar alterações" : "Decisão 1 · Gravar o rascunho"}</legend>
        <div className={styles.decisionPanel}>
          <p>
            {listing
              ? "Salvar envia apenas o que mudou para PATCH /v1/listings/{listingId} e gera uma revisão registrada. Não publica nada."
              : "Gravar cria o anúncio em DRAFT por POST /v1/listings. Ele fica no servidor, seu, invisível para o público, até você decidir publicar."}
          </p>

          {listing ? (
            <div className={styles.field}>
              <label htmlFor="wizard-changeReason">Motivo da alteração</label>
              <input
                id="wizard-changeReason"
                name="changeReason"
                type="text"
                maxLength={1_000}
                value={changeReason}
                aria-describedby="wizard-changeReason-hint"
                onChange={(event) => {
                  onChangeReason(event.target.value);
                }}
              />
              <p className={styles.hint} id="wizard-changeReason-hint">
                Opcional. Fica na revisão para você e para a moderação entenderem a mudança depois.
              </p>
            </div>
          ) : null}

          <div className={styles.actionsEnd}>
            <Button
              size="large"
              variant={listing ? "outline" : "primary"}
              loading={saving}
              loadingLabel={listing ? "Salvando" : "Gravando rascunho"}
              className={listing && !pendingUpdate ? styles.inactive : undefined}
              aria-disabled={listing ? !pendingUpdate : !canSubmitDraft}
              aria-describedby={publishBlockers.length > 0 ? "publish-blockers" : undefined}
              iconBefore={<Save aria-hidden="true" size={17} />}
              onClick={() => {
                if (!listing && !canSubmitDraft && firstBlocker) {
                  onGoToBlocker(firstBlocker);
                  return;
                }
                if (listing && !pendingUpdate) return;
                onSave();
              }}
            >
              {listing ? "Salvar alterações" : "Gravar rascunho"}
            </Button>
            {listing && !pendingUpdate ? (
              <span className={styles.savedMark}>Nada mudou desde a última gravação</span>
            ) : null}
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Decisão 2 · Publicar</legend>
        <div className={styles.decisionPanel}>
          <h4>Publicar é uma decisão separada</h4>
          <p>
            Publicar torna a oferta visível nas superfícies públicas e passa o anúncio de{" "}
            <code>DRAFT</code> para <code>PUBLISHED</code> no servidor. Enquanto você não clicar, ele
            continua sendo só seu.
          </p>

          {listing ? (
            <div className={styles.statusLine}>
              <span>Estado confirmado pela API:</span>
              <StatusBadge tone={statusTone(listing.listingStatus)}>
                {STATUS_LABELS[listing.listingStatus]}
              </StatusBadge>
              <code>versão {listing.version}</code>
            </div>
          ) : (
            <WizardNote tone="warning" title="O anúncio ainda não existe no servidor">
              Grave o rascunho primeiro. Só depois disso existe um <code>listingId</code> para
              publicar.
            </WizardNote>
          )}

          {listing?.listingStatus === "PUBLISHED" ? (
            <div className={styles.actionsEnd}>
              <Link
                className={styles.textAction}
                href={`/anuncios/${encodeURIComponent(listing.publicSlug)}`}
              >
                Abrir o anúncio publicado <ExternalLink aria-hidden="true" size={15} />
              </Link>
            </div>
          ) : (
            <div className={styles.actionsEnd}>
              <Button
                size="large"
                loading={publishing}
                loadingLabel="Publicando"
                className={canPublish ? undefined : styles.inactive}
                aria-disabled={!canPublish}
                aria-describedby={publishBlockers.length > 0 ? "publish-blockers" : undefined}
                iconAfter={<Send aria-hidden="true" size={17} />}
                onClick={() => {
                  if (!canPublish) {
                    if (firstBlocker) onGoToBlocker(firstBlocker);
                    return;
                  }
                  onPublish();
                }}
              >
                Publicar anúncio
              </Button>
              {!canPublish ? (
                <span className={styles.savedMark}>
                  {publishBlockers.length} pendência
                  {publishBlockers.length === 1 ? "" : "s"} acima
                </span>
              ) : null}
            </div>
          )}

          <p className={styles.savedMark}>
            <ShieldCheck aria-hidden="true" size={13} /> A publicação é revalidada pelo servidor: se
            o estado mudou, a API recusa e você vê o motivo aqui.
          </p>
        </div>
      </fieldset>
    </>
  );
}
