"use client";

import { AlertCircle, CheckCircle2, FileCheck2, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@midas/ui";
import { WizardField, WizardNote } from "./step-item";
import {
  PROOF_KINDS,
  fieldDomId,
  isFieldEditable,
  type ProofKind,
  type StepFieldsProps,
} from "./wizard-state";
import styles from "./listing-wizard.module.css";

const PROOF_COPY: Record<ProofKind, { title: string; shows: string; why: string }> = {
  INVENTORY_CAPTURE: {
    title: "Captura do inventário",
    shows: "A unidade aparecendo no seu inventário, com o nome de usuário e a data visíveis na tela.",
    why: "Liga a unidade a uma conta identificável no momento do anúncio, e não a uma imagem solta da internet.",
  },
  ACQUISITION_HISTORY: {
    title: "Histórico de aquisição",
    shows: "O registro de quando e como você obteve a unidade: compra, troca, abertura ou recompensa.",
    why: "Uma origem rastreável é o que separa a unidade legítima da que veio de conta invadida ou pagamento contestado.",
  },
  PUBLIC_INVENTORY_LINK: {
    title: "Inventário público conferível",
    shows: "O endereço do seu inventário público, aberto para quem revisa conferir por conta própria.",
    why: "Permite verificação independente: quem revisa confirma na fonte, sem depender de imagem que você enviou.",
  },
  PLATFORM_TRANSFER_RECORD: {
    title: "Transferência anterior na plataforma",
    shows: "O pedido desta mesma plataforma em que você recebeu a unidade.",
    why: "É a evidência mais forte, porque a própria plataforma já registrou a entrega para você.",
  },
};

/**
 * Passo 3 — Prova de posse (SCR-SEL-007).
 *
 * Estado real do contrato: não existe endpoint de envio de evidência para
 * vendedor. `POST /v1/catalog/assets` exige a permissão de plataforma
 * `catalog.assets.manage` (modules/catalog/src/asset-service.ts), que a
 * SellerMembership não tem. Então este passo captura a declaração, registra
 * junto do anúncio e diz a verdade sobre o que ainda não existe.
 */
export function StepProof({
  draft,
  errors,
  listingStatus,
  onFieldChange,
  listingExists,
}: StepFieldsProps & { listingExists: boolean }) {
  const editable = isFieldEditable("proofKind", listingStatus);
  const declared = Boolean(draft.proofKind) && draft.proofReference.trim().length > 0;

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend>Por que a prova é pedida antes</legend>
        <p className={styles.legendNote}>
          Prova de posse é o que impede que alguém anuncie unidade que não tem, que já vendeu em
          outro lugar ou que veio de conta invadida. Ela protege o dinheiro do comprador e o seu
          histórico de vendedor.
        </p>
        <ul className={styles.criteriaList}>
          <li>
            <ShieldCheck aria-hidden="true" size={15} />
            <span>
              <b>Anúncio sem prova não é publicado às cegas.</b> A evidência é revisada antes de a
              oferta ganhar tração pública.
            </span>
          </li>
          <li>
            <ShieldCheck aria-hidden="true" size={15} />
            <span>
              <b>A evidência tem que ser conferível por outra pessoa.</b> Imagem sem contexto,
              recorte sem data ou link quebrado não sustentam decisão.
            </span>
          </li>
          <li>
            <ShieldCheck aria-hidden="true" size={15} />
            <span>
              <b>Declaração falsa tem consequência.</b> Anúncio retirado, pedido cancelado e conta
              analisada — com o registro do que foi declarado aqui.
            </span>
          </li>
        </ul>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>O que é aceito</legend>
        <div
          className={styles.choiceList}
          role="radiogroup"
          aria-labelledby={`${fieldDomId("proofKind")}-group`}
          aria-describedby={
            errors.proofKind ? `${fieldDomId("proofKind")}-error` : `${fieldDomId("proofKind")}-hint`
          }
        >
          <span id={`${fieldDomId("proofKind")}-group`} className={styles.hint}>
            Tipo de evidência
          </span>
          {PROOF_KINDS.map((kind, index) => (
            <label className={styles.choice} key={kind}>
              <input
                type="radio"
                name="proofKind"
                value={kind}
                id={index === 0 ? fieldDomId("proofKind") : undefined}
                checked={draft.proofKind === kind}
                disabled={!editable}
                onChange={() => {
                  onFieldChange("proofKind", kind);
                }}
              />
              <span className={styles.choiceBody}>
                <span className={styles.choiceTop}>
                  <strong>{PROOF_COPY[kind].title}</strong>
                  <code>{kind}</code>
                </span>
                <p>
                  <b>Precisa mostrar:</b> {PROOF_COPY[kind].shows}
                </p>
                <p>
                  <b>Por que funciona:</b> {PROOF_COPY[kind].why}
                </p>
              </span>
            </label>
          ))}
        </div>
        {errors.proofKind ? (
          <p className={styles.fieldError} id={`${fieldDomId("proofKind")}-error`}>
            <AlertCircle aria-hidden="true" size={14} />
            <span>{errors.proofKind}</span>
          </p>
        ) : null}
        <p className={styles.hint} id={`${fieldDomId("proofKind")}-hint`}>
          {editable
            ? "Escolha o tipo que você realmente consegue apresentar quando for solicitado."
            : "A declaração de prova ficou congelada na criação do rascunho."}
        </p>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Sua declaração</legend>

        <WizardNote tone="warning" title="Envio de arquivo ainda não está aberto para vendedor">
          O contrato atual só aceita criação de asset por conta de plataforma com a permissão{" "}
          <code>catalog.assets.manage</code> (<code>POST /v1/catalog/assets</code>). Enquanto o envio
          direto não existir, o que fica registrado no anúncio é a sua declaração por escrito, e a
          equipe pede a evidência pelo canal de suporte. Esta tela não simula um envio que não
          acontece.
        </WizardNote>

        <WizardField
          fieldKey="proofReference"
          label="Onde a evidência pode ser conferida"
          frozen={!editable}
          error={errors.proofReference}
          hint="Escreva de forma que outra pessoa consiga verificar sozinha: o que ela vai ver, onde e como identificar a unidade. Não escreva senha nem código de acesso."
        >
          {({ id, describedBy, invalid }) => (
            <textarea
              id={id}
              name="proofReference"
              rows={4}
              maxLength={500}
              value={draft.proofReference}
              disabled={!editable}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              onChange={(event) => {
                onFieldChange("proofReference", event.target.value);
              }}
            />
          )}
        </WizardField>
        <span className={styles.charCount}>{draft.proofReference.trim().length} / 500</span>

        <label className={styles.attest} htmlFor={fieldDomId("proofAttested")}>
          <input
            type="checkbox"
            id={fieldDomId("proofAttested")}
            name="proofAttested"
            checked={draft.proofAttested}
            disabled={!editable}
            aria-invalid={Boolean(errors.proofAttested)}
            aria-describedby={
              errors.proofAttested
                ? `${fieldDomId("proofAttested")}-error`
                : `${fieldDomId("proofAttested")}-hint`
            }
            onChange={(event) => {
              onFieldChange("proofAttested", event.target.checked);
            }}
          />
          <span>
            Declaro que a unidade anunciada está comigo, disponível para entrega, e que não está
            anunciada nem prometida em outro lugar.
          </span>
        </label>
        {errors.proofAttested ? (
          <p className={styles.fieldError} id={`${fieldDomId("proofAttested")}-error`}>
            <AlertCircle aria-hidden="true" size={14} />
            <span>{errors.proofAttested}</span>
          </p>
        ) : null}
        <p className={styles.hint} id={`${fieldDomId("proofAttested")}-hint`}>
          Esta caixa nunca vem marcada. Marcar é uma decisão sua e fica registrada com o anúncio.
        </p>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Estado da verificação</legend>
        <div className={styles.decisionPanel}>
          <div className={styles.statusLine}>
            <FileCheck2 aria-hidden="true" size={17} />
            {!listingExists ? (
              <StatusBadge tone="neutral">Não enviada</StatusBadge>
            ) : declared ? (
              <StatusBadge tone="warning">Em análise</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Sem declaração registrada</StatusBadge>
            )}
          </div>
          {!listingExists ? (
            <p>
              A declaração é gravada junto com o rascunho, no mesmo momento em que o anúncio nasce no
              servidor. Antes disso, ela só existe neste navegador.
            </p>
          ) : declared ? (
            <p>
              A declaração está registrada no anúncio. A decisão sobre prova de posse é{" "}
              <strong>humana e assíncrona</strong>: nada aqui é aprovado automaticamente, e não há
              prazo prometido nesta tela. O contrato atual também não expõe endpoint de consulta
              desse parecer — por isso esta tela não mostra um parecer que ainda não existe.
            </p>
          ) : (
            <p>
              Este anúncio foi criado sem declaração de prova registrada em <code>metadata</code>. A
              equipe vai solicitar a evidência antes de qualquer decisão.
            </p>
          )}
          {declared && listingExists ? (
            <p className={styles.savedMark}>
              <CheckCircle2 aria-hidden="true" size={13} /> Declarado como{" "}
              {draft.proofKind ? PROOF_COPY[draft.proofKind].title : "—"}
            </p>
          ) : null}
        </div>
      </fieldset>
    </>
  );
}
