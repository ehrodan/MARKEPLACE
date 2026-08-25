"use client";

import { AlertCircle, Calculator } from "lucide-react";
import { formatMinorString, formatRate } from "@/components/seller-listings/price";
import type { ListingPlan } from "@/components/seller-listings/types";
import { WizardField, WizardNote } from "./step-item";
import {
  computeFeeBreakdown,
  estimateCaveats,
  fieldDomId,
  isFieldEditable,
  parseQuantity,
  priceInputToMinor,
  type StepFieldsProps,
} from "./wizard-state";
import styles from "./listing-wizard.module.css";

/**
 * Passo 2 — Preço.
 * O vendedor precisa ver quanto SOBRA, não só quanto é cobrado. As taxas vêm de
 * GET /v1/catalog/listing-plans e a conta roda em minor units com BigInt.
 */
export function StepPricing({
  draft,
  errors,
  listingStatus,
  onFieldChange,
  plans,
}: StepFieldsProps & { plans: readonly ListingPlan[] }) {
  const planEditable = isFieldEditable("listingPlanId", listingStatus);
  const selectedPlan = plans.find((plan) => plan.listingPlanId === draft.listingPlanId);
  const priceMinor = priceInputToMinor(draft.priceInput);
  const quantity = parseQuantity(draft.quantityAvailable) ?? 1;
  const breakdown =
    priceMinor && selectedPlan
      ? computeFeeBreakdown({
          priceMinor,
          quantity,
          platformFeeRate: selectedPlan.platformFeeRate,
          pspFeeRate: selectedPlan.pspFeeRate,
        })
      : null;
  const caveats = estimateCaveats({ listingStatus, quantity });

  return (
    <>
      <fieldset className={styles.fieldset}>
        <legend>Preço da unidade</legend>
        <p className={styles.legendNote}>
          O valor é enviado ao servidor em centavos e conferido lá. O que aparece abaixo é a mesma
          conta que o financeiro faz, com as taxas do plano escolhido.
        </p>
        <div className={styles.fieldGrid}>
          <WizardField
            fieldKey="priceInput"
            label="Preço em reais"
            error={errors.priceInput}
            hint="Use vírgula para os centavos. Exemplo: 1.249,90."
          >
            {({ id, describedBy, invalid }) => (
              <span className={styles.moneyInput}>
                <span aria-hidden="true">R$</span>
                <input
                  id={id}
                  name="priceInput"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.priceInput}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  onChange={(event) => {
                    onFieldChange("priceInput", event.target.value);
                  }}
                />
              </span>
            )}
          </WizardField>
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Plano de anúncio</legend>
        <p className={styles.legendNote}>
          O plano define a comissão da plataforma e a prioridade de exposição. Ele é congelado no
          snapshot comercial quando o rascunho é criado.
        </p>

        {plans.length === 0 ? (
          <WizardNote tone="warning" title="Nenhum plano ativo foi devolvido pela API">
            <code>GET /v1/catalog/listing-plans</code> respondeu sem plano válido para agora. A
            publicação fica bloqueada até existir um plano comercial ativo — nenhuma taxa é
            presumida aqui.
          </WizardNote>
        ) : (
          <>
            <div
              className={styles.choiceList}
              role="radiogroup"
              aria-labelledby={`${fieldDomId("listingPlanId")}-group`}
              aria-describedby={
                errors.listingPlanId
                  ? `${fieldDomId("listingPlanId")}-error`
                  : `${fieldDomId("listingPlanId")}-hint`
              }
            >
              <span id={`${fieldDomId("listingPlanId")}-group`} className={styles.hint}>
                Planos ativos
              </span>
              {plans.map((plan, index) => (
                <label className={styles.choice} key={plan.listingPlanId}>
                  <input
                    type="radio"
                    name="listingPlanId"
                    value={plan.listingPlanId}
                    id={index === 0 ? fieldDomId("listingPlanId") : undefined}
                    checked={draft.listingPlanId === plan.listingPlanId}
                    disabled={!planEditable}
                    onChange={() => {
                      onFieldChange("listingPlanId", plan.listingPlanId);
                    }}
                  />
                  <span className={styles.choiceBody}>
                    <span className={styles.choiceTop}>
                      <strong>{plan.displayName}</strong>
                      <code>{plan.planCode}</code>
                    </span>
                    <span className={styles.choiceMeta}>
                      <span>
                        Comissão <b>{formatRate(plan.platformFeeRate)}</b>
                      </span>
                      <span>
                        Tarifa PSP <b>{formatRate(plan.pspFeeRate)}</b>
                      </span>
                      <span>
                        Exposição <b>{plan.exposurePriority}</b>
                      </span>
                      <span>
                        Fila <b>{plan.queuePriority}</b>
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {errors.listingPlanId ? (
              <p className={styles.fieldError} id={`${fieldDomId("listingPlanId")}-error`}>
                <AlertCircle aria-hidden="true" size={14} />
                <span>{errors.listingPlanId}</span>
              </p>
            ) : null}
            <p className={styles.hint} id={`${fieldDomId("listingPlanId")}-hint`}>
              {planEditable
                ? "Prioridade de exposição e de fila são os números que a própria API devolve."
                : "O plano já foi congelado no snapshot comercial deste anúncio e não muda por PATCH."}
            </p>
          </>
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>O que sobra para você</legend>
        <div className={styles.feePanel}>
          <div className={styles.feeHead}>
            <h4>
              <Calculator aria-hidden="true" size={13} /> Líquido estimado por unidade vendida
            </h4>
            {breakdown ? (
              <span className={styles.savedMark}>
                taxa efetiva {formatRate(breakdown.effectiveRate)}
              </span>
            ) : null}
          </div>

          {!breakdown ? (
            <p className={styles.hint} role="status">
              Informe um preço válido e escolha um plano ativo para a conta aparecer. Nenhum valor de
              exemplo é mostrado no lugar.
            </p>
          ) : (
            <>
              <dl className={styles.feeRows}>
                <div className={styles.feeRow}>
                  <dt>Preço cobrado do comprador</dt>
                  <dd>{formatMinorString(breakdown.grossMinor, "BRL")}</dd>
                </div>
                <div className={styles.feeRow} data-kind="deduction">
                  <dt>
                    Comissão da plataforma
                    <small>{formatRate(selectedPlan?.platformFeeRate ?? "0")} sobre o preço</small>
                  </dt>
                  <dd>− {formatMinorString(breakdown.platformFeeMinor, "BRL")}</dd>
                </div>
                <div className={styles.feeRow} data-kind="deduction">
                  <dt>
                    Tarifa do provedor de pagamento
                    <small>{formatRate(selectedPlan?.pspFeeRate ?? "0")} sobre o preço</small>
                  </dt>
                  <dd>− {formatMinorString(breakdown.pspFeeMinor, "BRL")}</dd>
                </div>
                <div
                  className={styles.feeRow}
                  data-kind="net"
                  data-negative={breakdown.netMinor.startsWith("-") || undefined}
                >
                  <dt>Líquido estimado por venda</dt>
                  <dd>{formatMinorString(breakdown.netMinor, "BRL")}</dd>
                </div>
                {quantity > 1 ? (
                  <div className={styles.feeRow}>
                    <dt>
                      Se as {quantity} unidades forem vendidas por este preço
                      <small>projeção da sua própria oferta, não previsão de venda</small>
                    </dt>
                    <dd>{formatMinorString(breakdown.netIfAllUnitsSoldMinor, "BRL")}</dd>
                  </div>
                ) : null}
              </dl>

              {breakdown.netMinor.startsWith("-") ? (
                <WizardNote tone="danger" title="As taxas superam o preço">
                  Com este preço, o líquido fica negativo. Reveja o valor ou o plano antes de
                  publicar.
                </WizardNote>
              ) : null}

              <p className={styles.hint}>
                <strong>É estimativa.</strong> O valor definitivo sai no fechamento financeiro:
              </p>
              <ul className={styles.caveats}>
                {caveats.map((caveat) => (
                  <li key={caveat}>
                    <span>{caveat}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </fieldset>
    </>
  );
}
