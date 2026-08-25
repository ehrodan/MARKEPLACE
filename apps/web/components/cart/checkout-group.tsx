"use client";

import { ArrowRight, Store } from "lucide-react";
import { Button, StatusBadge } from "@midas/ui";
import { formatMinorCurrency, formatQuantity, shortIdentifier } from "@/components/marketplace/formatters";
import { COPY } from "@/lib/copy-deck";
import { CartLine, type CartLineStatus } from "./cart-line";
import type { CartMoneyLine, CartSellerGroup, StoredCartLine } from "./cart-storage";
import styles from "./cart.module.css";

/**
 * Uma linha do carrinho já cruzada com a releitura do catálogo.
 * `unitPriceMinor` e `currency` aqui são os VIGENTES quando o catálogo
 * confirmou; é esse valor que entra no subtotal do grupo, para o número
 * exibido ser o número que seria cobrado.
 */
export interface CartEntry extends CartMoneyLine {
  line: StoredCartLine;
  status: CartLineStatus;
}

export type GroupCheckoutState =
  | { status: "IDLE" }
  | { status: "WORKING" }
  | { status: "FAILED"; title: string; detail: string; reference?: string }
  | { status: "DONE"; orderCodes: string[] };

export interface CheckoutGroupProps {
  group: CartSellerGroup<CartEntry>;
  /** Posição do grupo na lista, para deixar a separação explícita em texto. */
  position: number;
  groupCount: number;
  state: GroupCheckoutState;
  busyListingId: string | null;
  onStartCheckout: (group: CartSellerGroup<CartEntry>) => void;
  onQuantityChange: (line: StoredCartLine, quantity: number) => void;
  onAcceptPrice: (line: StoredCartLine) => void;
  onSaveForLater: (line: StoredCartLine, savedForLater: boolean) => void;
  onRemove: (line: StoredCartLine) => void;
  onRecheck: (line: StoredCartLine) => void;
}

export function sellerLabel(group: CartSellerGroup<CartEntry>): string {
  return group.sellerDisplayName ?? `Vendedor ${shortIdentifier(group.sellerAccountId)}`;
}

/** Motivos que impedem este grupo de virar pedido, em texto, um por linha. */
export function blockingReasons(group: CartSellerGroup<CartEntry>): string[] {
  const reasons: string[] = [];
  if (group.mixedCurrency) {
    reasons.push("Este vendedor tem itens em moedas diferentes no carrinho. A tela não converte moeda; remova ou guarde os itens de uma delas.");
  }
  if (group.subtotalMinor === null && !group.mixedCurrency) {
    reasons.push("O subtotal deste vendedor não pôde ser calculado com os valores recebidos.");
  }
  for (const entry of group.lines) {
    if (entry.status.blocksCheckout) reasons.push(`${entry.line.title}: ${entry.status.detail}`);
  }
  return reasons;
}

export function CheckoutGroup({
  group,
  position,
  groupCount,
  state,
  busyListingId,
  onStartCheckout,
  onQuantityChange,
  onAcceptPrice,
  onSaveForLater,
  onRemove,
  onRecheck,
}: CheckoutGroupProps) {
  const seller = sellerLabel(group);
  const headingId = `grupo-${group.sellerAccountId}`;
  const reasons = blockingReasons(group);
  const done = state.status === "DONE";
  const blocked = reasons.length > 0 || done;

  return (
    <section className={styles.group} aria-labelledby={headingId} data-blocked={blocked || undefined}>
      <header className={styles.groupHeader}>
        <div>
          <span className={styles.groupEyebrow}>
            <Store aria-hidden="true" size={14} />
            Pedido {formatQuantity(position)} de {formatQuantity(groupCount)}
          </span>
          <h3 id={headingId}>{seller}</h3>
          <p className={styles.groupNote}>{COPY.cart.sellerGroups.microcopy}</p>
        </div>
        <div className={styles.groupTotals}>
          <span>
            {formatQuantity(group.itemCount)} {group.itemCount === 1 ? "unidade" : "unidades"}
          </span>
          <strong>
            {group.subtotalMinor === null || group.currency === null
              ? "Subtotal indisponível"
              : formatMinorCurrency(group.subtotalMinor, group.currency)}
          </strong>
        </div>
      </header>

      <ul className={styles.lines}>
        {group.lines.map((entry) => (
          <CartLine
            key={entry.line.listingId}
            line={entry.line}
            status={entry.status}
            busy={busyListingId === entry.line.listingId || state.status === "WORKING"}
            onQuantityChange={onQuantityChange}
            onAcceptPrice={onAcceptPrice}
            onSaveForLater={onSaveForLater}
            onRemove={onRemove}
            onRecheck={onRecheck}
          />
        ))}
      </ul>

      <footer className={styles.groupFooter}>
        {reasons.length > 0 ? (
          <div className={styles.groupBlocked}>
            <StatusBadge tone="warning">Avanço bloqueado</StatusBadge>
            <ul>
              {reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
        ) : null}

        {state.status === "FAILED" ? (
          <p className={styles.groupProblem} role="alert">
            <strong>{state.title}</strong> {state.detail}
            {state.reference ? <code> Referência: {state.reference}</code> : null}
          </p>
        ) : null}

        {done ? (
          <p className={styles.groupDone}>
            <StatusBadge tone="success">Pedido criado</StatusBadge>
            {state.orderCodes.length > 0
              ? `Código: ${state.orderCodes.join(", ")}. Acompanhe em Minhas compras.`
              : "Acompanhe em Minhas compras."}
          </p>
        ) : (
          <Button
            variant="primary"
            disabled={blocked}
            loading={state.status === "WORKING"}
            loadingLabel="Criando pedido"
            iconAfter={<ArrowRight aria-hidden="true" size={16} />}
            onClick={() => { onStartCheckout(group); }}
          >
            {COPY.cart.header.cta}
            <span className="ui-visually-hidden"> com {seller}</span>
          </Button>
        )}
      </footer>
    </section>
  );
}
