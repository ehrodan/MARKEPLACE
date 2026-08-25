"use client";

import type { ReactNode } from "react";
import { AlertCircle, Info, Lock, PackageCheck, ShieldAlert } from "lucide-react";
import type { CatalogItem } from "@/components/seller-listings/types";
import {
  DELIVERY_METHODS,
  fieldDomId,
  isFieldEditable,
  normalizeSlug,
  type DeliveryMethod,
  type StepFieldsProps,
  type WizardFieldKey,
} from "./wizard-state";
import styles from "./listing-wizard.module.css";

/**
 * Primitivas de campo compartilhadas por todos os passos do wizard.
 * Ficam aqui para os quatro arquivos de passo usarem a mesma ligação de
 * rótulo, dica e erro (label + aria-describedby + aria-invalid).
 */
export interface WizardFieldProps {
  fieldKey: WizardFieldKey;
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  frozen?: boolean;
  children: (control: {
    id: string;
    describedBy: string;
    invalid: boolean;
  }) => ReactNode;
}

export function WizardField({ fieldKey, label, hint, error, frozen = false, children }: WizardFieldProps) {
  const id = fieldDomId(fieldKey);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? `${errorId} ${hintId}` : hintId;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        {frozen ? (
          <>
            {" "}
            <span className={styles.frozenBadge}>
              <Lock aria-hidden="true" size={11} /> congelado
            </span>
          </>
        ) : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p className={styles.fieldError} id={errorId}>
          <AlertCircle aria-hidden="true" size={14} />
          <span>{error}</span>
        </p>
      ) : null}
      <p className={styles.hint} id={hintId}>
        {hint}
      </p>
    </div>
  );
}

export function WizardNote({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger";
  title: string;
  children: ReactNode;
}) {
  const Icon = tone === "info" ? Info : ShieldAlert;
  return (
    <div className={styles.note} data-tone={tone}>
      <Icon aria-hidden="true" size={17} />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

/** Passo 1 — Dados do item. */
export function StepItem({
  draft,
  errors,
  listingStatus,
  onFieldChange,
  catalogItems,
}: StepFieldsProps & { catalogItems: readonly CatalogItem[] }) {
  const identityEditable = isFieldEditable("catalogItemId", listingStatus);
  const notesLength = draft.conditionNotes.trim().length;

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend>Produto do catálogo</legend>
        <p className={styles.legendNote}>
          Escolha um produto já aprovado pela plataforma. Se não encontrar o item certo, solicite
          o cadastro antes de publicar.
        </p>

        <div className={styles.fieldGrid}>
          <WizardField
            fieldKey="catalogItemId"
            label="Item do catálogo"
            frozen={!identityEditable}
            error={errors.catalogItemId}
            hint={
              identityEditable
                ? "A lista mostra apenas produtos disponíveis para anúncio."
                : "Depois de criado, o anúncio fica preso ao item escolhido. Para outro item, crie um novo anúncio."
            }
          >
            {({ id, describedBy, invalid }) => (
              <select
                id={id}
                name="catalogItemId"
                value={draft.catalogItemId}
                disabled={!identityEditable}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={(event) => {
                  onFieldChange("catalogItemId", event.target.value);
                }}
              >
                <option value="">Selecione um item</option>
                {catalogItems.map((item) => (
                  <option value={item.catalogItemId} key={item.catalogItemId}>
                    {item.displayName} · {item.gameOrigin}
                  </option>
                ))}
              </select>
            )}
          </WizardField>

          <WizardField
            fieldKey="publicSlug"
            label="Endereço público"
            frozen={!identityEditable}
            error={errors.publicSlug}
            hint={
              identityEditable
                ? "Vira o endereço do anúncio. Letras minúsculas, números e hífens."
                : "O endereço público é imutável depois da criação, para não quebrar links já compartilhados."
            }
          >
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="publicSlug"
                type="text"
                inputMode="url"
                autoComplete="off"
                maxLength={200}
                value={draft.publicSlug}
                disabled={!identityEditable}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={(event) => {
                  onFieldChange("publicSlug", normalizeSlug(event.target.value));
                }}
              />
            )}
          </WizardField>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Unidade e disponibilidade</legend>
        <p className={styles.legendNote}>
          Esta parte continua editável depois da criação: o contrato{" "}
          <code>PATCH /v1/listings/{"{listingId}"}</code> aceita preço, quantidade e descrição, e cada
          alteração vira uma revisão registrada.
        </p>

        <div className={styles.fieldGrid}>
          <WizardField
            fieldKey="quantityAvailable"
            label="Quantidade disponível"
            error={errors.quantityAvailable}
            hint="O servidor impede venda além da disponibilidade declarada."
          >
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="quantityAvailable"
                type="number"
                inputMode="numeric"
                min={1}
                max={10_000}
                step={1}
                value={draft.quantityAvailable}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={(event) => {
                  onFieldChange("quantityAvailable", event.target.value);
                }}
              />
            )}
          </WizardField>
        </div>

        <WizardField
          fieldKey="conditionNotes"
          label="Condição da unidade e o que o comprador recebe"
          error={errors.conditionNotes}
          hint="Não inclua telefone, e-mail, link de pagamento ou dados de acesso: isso é bloqueado na moderação."
        >
          {({ id, describedBy, invalid }) => (
            <textarea
              id={id}
              name="conditionNotes"
              rows={6}
              maxLength={5_000}
              value={draft.conditionNotes}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onChange={(event) => {
                onFieldChange("conditionNotes", event.target.value);
              }}
            />
          )}
        </WizardField>
        <span className={styles.charCount}>{notesLength} / 5.000</span>
      </fieldset>
    </>
  );
}

const DELIVERY_COPY: Record<DeliveryMethod, { title: string; description: string }> = {
  IN_GAME_TRADE: {
    title: "Troca dentro do jogo",
    description:
      "Você e o comprador se encontram no jogo e a unidade muda de mãos pela função de troca. O combinado acontece pelo canal da plataforma, que fica registrado.",
  },
  IN_GAME_GIFT: {
    title: "Envio como presente no jogo",
    description:
      "Você envia a unidade pela função de presente, sem exigir que o comprador esteja on-line no mesmo momento.",
  },
};

/** Passo 4 — Entrega. Método e prazo que o vendedor assume. */
export function StepDelivery({ draft, errors, listingStatus, onFieldChange }: StepFieldsProps) {
  const editable = isFieldEditable("deliveryMethod", listingStatus);

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend>Como a entrega acontece</legend>
        <p className={styles.legendNote}>
          O método escolhido é o que o comprador vai ler antes de pagar. Descrever certo aqui é o que
          evita disputa depois.
        </p>

        <div
          className={styles.choiceList}
          role="radiogroup"
          aria-labelledby={`${fieldDomId("deliveryMethod")}-group`}
          aria-describedby={
            errors.deliveryMethod
              ? `${fieldDomId("deliveryMethod")}-error`
              : `${fieldDomId("deliveryMethod")}-hint`
          }
        >
          <span id={`${fieldDomId("deliveryMethod")}-group`} className={styles.hint}>
            Método de entrega
          </span>
          {DELIVERY_METHODS.map((method, index) => (
            <label className={styles.choice} key={method}>
              <input
                type="radio"
                name="deliveryMethod"
                value={method}
                id={index === 0 ? fieldDomId("deliveryMethod") : undefined}
                checked={draft.deliveryMethod === method}
                disabled={!editable}
                onChange={() => {
                  onFieldChange("deliveryMethod", method);
                }}
              />
              <span className={styles.choiceBody}>
                <span className={styles.choiceTop}>
                  <strong>{DELIVERY_COPY[method].title}</strong>
                  <code>{method}</code>
                </span>
                <p>{DELIVERY_COPY[method].description}</p>
              </span>
            </label>
          ))}
        </div>
        {errors.deliveryMethod ? (
          <p className={styles.fieldError} id={`${fieldDomId("deliveryMethod")}-error`}>
            <AlertCircle aria-hidden="true" size={14} />
            <span>{errors.deliveryMethod}</span>
          </p>
        ) : null}
        <p className={styles.hint} id={`${fieldDomId("deliveryMethod")}-hint`}>
          {editable
            ? "A entrega declarada é congelada no rascunho e não muda depois da criação."
            : "Este anúncio já existe no servidor: a declaração de entrega ficou congelada na criação."}
        </p>

        <WizardNote tone="danger" title="Entrega de conta e credencial é proibida">
          Vender ou transferir conta, login, senha ou código de acesso está bloqueado no servidor e é
          motivo de encerramento. A entrega tem que ser da unidade dentro do jogo.
        </WizardNote>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Prazo que você assume</legend>
        <div className={styles.fieldGrid}>
          <WizardField
            fieldKey="deliveryWindowHours"
            label="Prazo máximo de entrega, em horas"
            frozen={!editable}
            error={errors.deliveryWindowHours}
            hint="Compromisso seu, contado a partir da confirmação do pagamento. Máximo de 168 horas (7 dias). O comprador vê o prazo declarado, não um cronômetro."
          >
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="deliveryWindowHours"
                type="number"
                inputMode="numeric"
                min={1}
                max={168}
                step={1}
                value={draft.deliveryWindowHours}
                disabled={!editable}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={(event) => {
                  onFieldChange("deliveryWindowHours", event.target.value);
                }}
              />
            )}
          </WizardField>
        </div>

        <WizardField
          fieldKey="deliveryInstructions"
          label="Passo a passo que o comprador vai seguir"
          frozen={!editable}
          error={errors.deliveryInstructions}
          hint="Escreva na ordem em que as coisas acontecem. Combine tudo pelo canal da plataforma."
        >
          {({ id, describedBy, invalid }) => (
            <textarea
              id={id}
              name="deliveryInstructions"
              rows={5}
              maxLength={2_000}
              value={draft.deliveryInstructions}
              disabled={!editable}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onChange={(event) => {
                onFieldChange("deliveryInstructions", event.target.value);
              }}
            />
          )}
        </WizardField>
        <span className={styles.charCount}>
          <PackageCheck aria-hidden="true" size={12} /> {draft.deliveryInstructions.trim().length} /
          2.000
        </span>
      </fieldset>
    </>
  );
}
