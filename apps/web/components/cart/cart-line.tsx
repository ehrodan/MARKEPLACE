"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Check, Minus, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button, StatusBadge, type StatusTone } from "@midas/ui";
import { formatMinorCurrency, formatQuantity } from "@/components/marketplace/formatters";
import type { PublicListing } from "@/components/marketplace/types";
import {
  MAX_LINE_QUANTITY,
  isMinorUnits,
  lineTotalMinor,
  parseQuantityInput,
  type StoredCartLine,
} from "./cart-storage";
import styles from "./cart.module.css";

/** Resultado da releitura de um anúncio no catálogo público. */
export type CartLineCheck =
  | { status: "CHECKING" }
  | { status: "FOUND"; listing: PublicListing }
  | { status: "GONE" }
  | { status: "FAILED"; message: string };

export type CartLineStatusKind =
  | "CHECKING"
  | "OK"
  | "PRICE_CHANGED"
  | "QUANTITY_REDUCED"
  | "OUT_OF_STOCK"
  | "CURRENCY_CHANGED"
  | "GONE"
  | "UNVERIFIED";

export interface CartLineStatus {
  kind: CartLineStatusKind;
  tone: StatusTone;
  label: string;
  detail: string;
  /** Preço unitário vigente confirmado pelo catálogo. `null` = não confirmado. */
  currentUnitPriceMinor: string | null;
  currentCurrency: string | null;
  quantityAvailable: number | null;
  priceChanged: boolean;
  /** Quantidade disponível quando ela é menor do que a pedida (e maior que zero). */
  quantityShortfall: number | null;
  /** O catálogo confirmou que este anúncio pode ser comprado agora. */
  purchasable: boolean;
  /** Enquanto verdadeiro, o grupo deste vendedor não avança. */
  blocksCheckout: boolean;
}

/**
 * Traduz linha guardada + releitura do catálogo em um estado por extenso.
 * Função pura: mesma entrada, mesma saída, sem relógio nem rede.
 *
 * Nenhuma divergência é silenciada. Preço diferente, estoque menor, moeda
 * trocada, anúncio fora do catálogo e verificação falha travam o avanço do
 * grupo até a pessoa reconhecer explicitamente o que mudou.
 */
export function describeCartLine(line: StoredCartLine, check: CartLineCheck | undefined): CartLineStatus {
  const base = {
    currentUnitPriceMinor: null,
    currentCurrency: null,
    quantityAvailable: null,
    priceChanged: false,
    quantityShortfall: null,
    purchasable: false,
    blocksCheckout: true,
  } as const;

  if (!check || check.status === "CHECKING") {
    return {
      ...base,
      kind: "CHECKING",
      tone: "neutral",
      label: "Conferindo",
      detail: "Lendo preço e disponibilidade atuais no catálogo público.",
    };
  }

  if (check.status === "FAILED") {
    return {
      ...base,
      kind: "UNVERIFIED",
      tone: "warning",
      label: "Não confirmado",
      detail: `O preço e a disponibilidade deste item não foram confirmados nesta sessão: ${check.message}`,
    };
  }

  if (check.status === "GONE") {
    return {
      ...base,
      kind: "GONE",
      tone: "danger",
      label: "Fora do catálogo",
      detail: "Este anúncio deixou de responder no catálogo público. O item continua listado aqui em vez de sumir sem aviso, mas não pode virar pedido.",
    };
  }

  const listing = check.listing;
  const available = listing.quantityAvailable;

  if (listing.currency !== line.currency) {
    return {
      ...base,
      kind: "CURRENCY_CHANGED",
      tone: "danger",
      label: "Moeda diferente",
      detail: `O anúncio passou a ser cotado em ${listing.currency}, e você adicionou em ${line.currency}. Nenhuma conversão é feita por esta tela.`,
      currentCurrency: listing.currency,
      quantityAvailable: available,
    };
  }

  if (!isMinorUnits(listing.priceMinor)) {
    return {
      ...base,
      kind: "UNVERIFIED",
      tone: "warning",
      label: "Não confirmado",
      detail: "O preço vigente não chegou em formato válido de unidades mínimas, então nada foi recalculado a partir dele.",
      quantityAvailable: available,
    };
  }

  const priceChanged = listing.priceMinor !== line.unitPriceMinor;

  if (available <= 0) {
    return {
      ...base,
      kind: "OUT_OF_STOCK",
      tone: "warning",
      label: "Sem estoque",
      detail: "O vendedor está com zero unidade disponível agora. Guarde para depois ou remova: o item não entra em nenhum pedido neste estado.",
      currentUnitPriceMinor: listing.priceMinor,
      currentCurrency: listing.currency,
      quantityAvailable: available,
      priceChanged,
    };
  }

  const shortfall = available < line.quantity ? available : null;

  if (priceChanged) {
    const direction = BigInt(listing.priceMinor) > BigInt(line.unitPriceMinor) ? "subiu" : "caiu";
    return {
      kind: "PRICE_CHANGED",
      tone: "info",
      label: "Preço mudou",
      detail: `O preço unitário ${direction} desde que você adicionou. O valor exibido já é o vigente; aceite a mudança para este vendedor poder avançar.`,
      currentUnitPriceMinor: listing.priceMinor,
      currentCurrency: listing.currency,
      quantityAvailable: available,
      priceChanged: true,
      quantityShortfall: shortfall,
      purchasable: true,
      blocksCheckout: true,
    };
  }

  if (shortfall !== null) {
    return {
      kind: "QUANTITY_REDUCED",
      tone: "warning",
      label: "Quantidade indisponível",
      detail: `Você pediu ${formatQuantity(line.quantity)} e o vendedor tem ${formatQuantity(shortfall)} disponível agora.`,
      currentUnitPriceMinor: listing.priceMinor,
      currentCurrency: listing.currency,
      quantityAvailable: available,
      priceChanged: false,
      quantityShortfall: shortfall,
      purchasable: true,
      blocksCheckout: true,
    };
  }

  return {
    kind: "OK",
    tone: "success",
    label: "Confirmado",
    detail: "Publicado, com estoque suficiente e pelo mesmo preço que você adicionou.",
    currentUnitPriceMinor: listing.priceMinor,
    currentCurrency: listing.currency,
    quantityAvailable: available,
    priceChanged: false,
    quantityShortfall: null,
    purchasable: true,
    blocksCheckout: false,
  };
}

/** Preço unitário que a linha deve exibir e somar: o vigente, quando confirmado. */
export function effectiveUnitPriceMinor(line: StoredCartLine, status: CartLineStatus): string {
  return status.currentUnitPriceMinor ?? line.unitPriceMinor;
}

/**
 * Queda de preço confirmada pelo catálogo: diferença exata por unidade, em
 * unidades mínimas, calculada em BigInt — dinheiro nunca passa por Number.
 * `null` quando não houve queda, quando a moeda mudou (diferença entre moedas
 * seria mentira) ou quando o preço vigente não foi confirmado.
 */
export function priceDropMinor(line: StoredCartLine, status: CartLineStatus): string | null {
  if (!status.priceChanged || status.currentUnitPriceMinor === null) return null;
  if (status.currentCurrency !== line.currency) return null;
  if (!isMinorUnits(status.currentUnitPriceMinor) || !isMinorUnits(line.unitPriceMinor)) return null;
  const drop = BigInt(line.unitPriceMinor) - BigInt(status.currentUnitPriceMinor);
  return drop > 0n ? drop.toString() : null;
}

export interface CartLineProps {
  line: StoredCartLine;
  status: CartLineStatus;
  /** Alguma mutação está em voo para esta linha. */
  busy: boolean;
  onQuantityChange: (line: StoredCartLine, quantity: number) => void;
  onAcceptPrice: (line: StoredCartLine) => void;
  onSaveForLater: (line: StoredCartLine, savedForLater: boolean) => void;
  onRemove: (line: StoredCartLine) => void;
  onRecheck: (line: StoredCartLine) => void;
}

export function CartLine({
  line,
  status,
  busy,
  onQuantityChange,
  onAcceptPrice,
  onSaveForLater,
  onRemove,
  onRecheck,
}: CartLineProps) {
  const fieldId = useId();
  const [draft, setDraft] = useState(String(line.quantity));
  const [invalid, setInvalid] = useState(false);

  // A quantidade guardada é a fonte: qualquer ajuste vindo de fora (aceitar o
  // estoque disponível, merge com a conta) reescreve o campo.
  useEffect(() => {
    setDraft(String(line.quantity));
    setInvalid(false);
  }, [line.quantity]);

  const unitPriceMinor = effectiveUnitPriceMinor(line, status);
  const currency = status.currentCurrency ?? line.currency;
  const drop = priceDropMinor(line, status);
  const total = lineTotalMinor({ unitPriceMinor, quantity: line.quantity });
  const saved = line.savedForLater === true;
  const quantityErrorId = `${fieldId}-erro`;
  const noticeId = `${fieldId}-aviso`;
  const showNotice = status.kind !== "OK";

  function commit(next: number) {
    setDraft(String(next));
    setInvalid(false);
    if (next !== line.quantity) onQuantityChange(line, next);
  }

  function handleInput(value: string) {
    setDraft(value);
    const parsed = parseQuantityInput(value);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (parsed !== line.quantity) onQuantityChange(line, parsed);
  }

  return (
    <li className={styles.line} data-state={status.kind}>
      <div className={styles.lineMain}>
        <div className={styles.lineHeading}>
          <h4 className={styles.lineTitle}>
            <Link href={`/anuncios/${encodeURIComponent(line.publicSlug)}`}>{line.title}</Link>
          </h4>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {drop !== null ? (
            <StatusBadge tone="success">
              Preço caiu {formatMinorCurrency(drop, line.currency)} desde que você adicionou
            </StatusBadge>
          ) : null}
        </div>
        <p className={styles.lineUnit}>
          <span>{formatMinorCurrency(unitPriceMinor, currency)} por unidade</span>
          {status.priceChanged ? (
            <span className={styles.linePrevious}>
              {" "}· antes {formatMinorCurrency(line.unitPriceMinor, line.currency)}
            </span>
          ) : null}
        </p>

        {showNotice ? (
          <div className={styles.lineNotice} id={noticeId}>
            <p>{status.detail}</p>
            <div className={styles.lineNoticeActions}>
              {status.priceChanged && status.currentUnitPriceMinor !== null ? (
                <Button
                  size="small"
                  variant="outline"
                  disabled={busy}
                  iconBefore={<Check aria-hidden="true" size={15} />}
                  onClick={() => { onAcceptPrice(line); }}
                >
                  Aceitar {formatMinorCurrency(status.currentUnitPriceMinor, currency)} por unidade
                </Button>
              ) : null}
              {status.quantityShortfall !== null ? (
                <Button
                  size="small"
                  variant="outline"
                  disabled={busy}
                  onClick={() => { commit(status.quantityShortfall ?? line.quantity); }}
                >
                  Ajustar para {formatQuantity(status.quantityShortfall)}
                </Button>
              ) : null}
              {status.kind === "UNVERIFIED" || status.kind === "GONE" ? (
                <Button
                  size="small"
                  variant="outline"
                  disabled={busy}
                  iconBefore={<RefreshCw aria-hidden="true" size={15} />}
                  onClick={() => { onRecheck(line); }}
                >
                  Verificar de novo
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.lineControls}>
        <div className={styles.quantityField}>
          <label htmlFor={fieldId}>Quantidade</label>
          <div className={styles.quantityRow}>
            <button
              type="button"
              className={styles.stepper}
              onClick={() => { commit(Math.max(1, line.quantity - 1)); }}
              disabled={busy || line.quantity <= 1}
              aria-label={`Diminuir quantidade de ${line.title}`}
            >
              <Minus aria-hidden="true" size={16} />
            </button>
            <input
              id={fieldId}
              className={styles.quantityInput}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              disabled={busy}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? quantityErrorId : undefined}
              onChange={(event) => { handleInput(event.target.value); }}
              onBlur={() => { if (invalid) commit(line.quantity); }}
            />
            <button
              type="button"
              className={styles.stepper}
              onClick={() => { commit(Math.min(MAX_LINE_QUANTITY, line.quantity + 1)); }}
              disabled={busy || line.quantity >= MAX_LINE_QUANTITY}
              aria-label={`Aumentar quantidade de ${line.title}`}
            >
              <Plus aria-hidden="true" size={16} />
            </button>
          </div>
          {invalid ? (
            <p className={styles.fieldError} id={quantityErrorId}>
              Informe um número inteiro de 1 a {formatQuantity(MAX_LINE_QUANTITY)}.
            </p>
          ) : null}
        </div>

        <p className={styles.lineTotal}>
          <span>Total da linha</span>
          <strong>{total === null ? "Valor indisponível" : formatMinorCurrency(total, currency)}</strong>
        </p>

        <div className={styles.lineActions}>
          <button
            type="button"
            className={styles.lineAction}
            disabled={busy}
            aria-pressed={saved}
            onClick={() => { onSaveForLater(line, !saved); }}
          >
            {saved ? <BookmarkCheck aria-hidden="true" size={15} /> : <Bookmark aria-hidden="true" size={15} />}
            {saved ? "Voltar ao pedido" : "Guardar para depois"}
            <span className="ui-visually-hidden">: {line.title}</span>
          </button>
          <button
            type="button"
            className={styles.lineAction}
            disabled={busy}
            onClick={() => { onRemove(line); }}
          >
            <Trash2 aria-hidden="true" size={15} />
            Remover
            <span className="ui-visually-hidden"> {line.title} do carrinho</span>
          </button>
        </div>
      </div>
    </li>
  );
}
