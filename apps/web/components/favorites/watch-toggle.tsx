"use client";

import { useId, useState } from "react";
import { BellOff, BellRing } from "lucide-react";
import { StatusBadge } from "@midas/ui";
import { formatMinorCurrency } from "@/components/marketplace/formatters";
import { formatDateTime } from "@/lib/date-format";
import { parseTargetPriceMinor, type WatchChannel, type WatchOptIn } from "./favorites-storage";
import styles from "./favorites.module.css";

export type WatchSyncMode = "ACCOUNT" | "DEVICE_ONLY";

export interface WatchToggleProps {
  itemTitle: string;
  channel: WatchChannel;
  optIn: WatchOptIn | null;
  currency: string;
  /** Preço publicado que a pessoa salvou — base honesta para a comparação. */
  referencePriceMinor: string;
  syncMode: WatchSyncMode;
  onEnable: (options: { targetPriceMinor: string | null }) => void;
  onDisable: () => void;
}

const channelLabels: Record<WatchChannel, string> = {
  PRICE_DROP: "Avisar se o preço cair",
  BACK_IN_STOCK: "Avisar quando voltar ao estoque",
};

const channelActiveLabels: Record<WatchChannel, string> = {
  PRICE_DROP: "Aviso de queda de preço ligado",
  BACK_IN_STOCK: "Aviso de reposição ligado",
};

/**
 * Controle de "me avise" (SCR-ACC-009).
 *
 * Contrato de consentimento, verificável em auditoria:
 * - nada vem marcado: o estado inicial é sempre desligado;
 * - o texto diz exatamente o que acontece antes de a pessoa ligar;
 * - desligar é um clique no mesmo botão;
 * - cada opt-in carrega carimbo de tempo e versão de política;
 * - sem sincronização com a conta, o controle diz que nada será enviado.
 */
export function WatchToggle({
  itemTitle,
  channel,
  optIn,
  currency,
  referencePriceMinor,
  syncMode,
  onEnable,
  onDisable,
}: WatchToggleProps) {
  const fieldId = useId();
  const describedById = `${fieldId}-explicacao`;
  const errorId = `${fieldId}-erro`;
  const [targetInput, setTargetInput] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);

  const enabled = optIn !== null;
  const visibleLabel = enabled ? channelActiveLabels[channel] : channelLabels[channel];
  const reference = formatMinorCurrency(referencePriceMinor, currency);

  function explanation(): string {
    if (channel === "BACK_IN_STOCK") {
      return "Ao ligar, você recebe uma única mensagem quando o vendedor repuser a quantidade disponível deste anúncio. "
        + "Se o anúncio sair do catálogo, nenhuma mensagem é enviada.";
    }
    const target = optIn?.targetPriceMinor;
    if (target) {
      return `Ao ligar, você recebe uma única mensagem quando o preço publicado ficar igual ou menor que ${formatMinorCurrency(target, currency)}. `
        + "A mensagem traz o preço real e a data da leitura.";
    }
    return `Ao ligar, você recebe uma única mensagem quando o preço publicado ficar menor que ${reference}, o valor salvo. `
      + "Você pode definir outro valor de referência abaixo. A mensagem traz o preço real e a data da leitura.";
  }

  function handleToggle() {
    if (enabled) {
      setTargetError(null);
      onDisable();
      return;
    }
    if (channel !== "PRICE_DROP") {
      onEnable({ targetPriceMinor: null });
      return;
    }
    const parsed = parseTargetPriceMinor(targetInput);
    if (!parsed.ok) {
      setTargetError("Informe um valor como 1.499,90 ou deixe em branco para qualquer queda.");
      return;
    }
    setTargetError(null);
    onEnable({ targetPriceMinor: parsed.amountMinor });
  }

  return (
    <div className={styles.watchControl}>
      <div className={styles.watchHeading}>
        <button
          type="button"
          className={styles.watchButton}
          aria-pressed={enabled}
          aria-label={`${visibleLabel} — ${itemTitle}`}
          aria-describedby={targetError ? `${describedById} ${errorId}` : describedById}
          onClick={handleToggle}
        >
          {enabled
            ? <BellRing aria-hidden="true" size={16} />
            : <BellOff aria-hidden="true" size={16} />}
          <span>{visibleLabel}</span>
        </button>
        {enabled ? (
          <StatusBadge tone={syncMode === "ACCOUNT" ? "success" : "warning"}>
            {syncMode === "ACCOUNT" ? "Ligado na conta" : "Ligado só neste dispositivo"}
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Desligado</StatusBadge>
        )}
      </div>

      <p className={styles.watchExplanation} id={describedById}>
        {explanation()}
        {syncMode === "DEVICE_ONLY" ? (
          <>
            {" "}
            <strong>
              Enquanto a sincronização com a sua conta estiver pendente, este registro fica só neste
              navegador e nenhuma mensagem é enviada.
            </strong>
          </>
        ) : (
          " Todo envio traz link de descadastro de um clique."
        )}
      </p>

      {optIn ? (
        <p className={styles.watchReceipt}>
          Você ligou este aviso em{" "}
          <time dateTime={optIn.optedInAt}>{formatDateTime(optIn.optedInAt)}</time>{" "}
          (política {optIn.policyVersion}). Um clique no botão acima desliga.
        </p>
      ) : null}

      {!enabled && channel === "PRICE_DROP" ? (
        <div className={styles.watchField}>
          <label htmlFor={`${fieldId}-alvo`}>Avisar somente abaixo de (opcional)</label>
          <input
            id={`${fieldId}-alvo`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={targetInput}
            placeholder={`Em branco = qualquer queda abaixo de ${reference}`}
            aria-invalid={targetError ? true : undefined}
            aria-describedby={targetError ? errorId : undefined}
            onChange={(event) => {
              setTargetInput(event.target.value);
              if (targetError) setTargetError(null);
            }}
          />
          {targetError ? (
            <small className={styles.watchError} id={errorId} role="alert">{targetError}</small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
