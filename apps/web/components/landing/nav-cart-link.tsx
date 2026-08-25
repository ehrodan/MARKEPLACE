"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import {
  activeLines,
  browserStorage,
  readCart,
  totalItemCount,
} from "@/components/cart/cart-storage";
import styles from "./public-nav.module.css";

/**
 * Link "Carrinho" do cabeçalho público, com contagem real do dispositivo.
 *
 * HONESTIDADE (docs/03 §10): o número é a soma das quantidades das linhas
 * ATIVAS gravadas por `cart-storage` — itens guardados para depois ficam de
 * fora, porque não entram no checkout. Nenhum número é inventado: sem
 * carrinho legível (storage indisponível, corrompido ou vazio) a bolinha
 * simplesmente não aparece.
 *
 * A contagem é lida no mount e relida quando a aba recupera o foco ou quando
 * outra aba grava o carrinho (evento `storage`). Sem polling, sem relógio.
 */
export function NavCartLink() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    setCount(totalItemCount(activeLines(readCart(browserStorage()).lines)));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const label = count > 0
    ? `Carrinho, ${String(count)} ${count === 1 ? "item" : "itens"}`
    : "Abrir carrinho";

  return (
    <Link href="/carrinho" aria-label={label}>
      <span className={styles.cartGlyph}>
        <ShoppingBag aria-hidden="true" size={19} />
        {count > 0 ? (
          <span className={styles.cartBadge} aria-hidden="true" data-testid="cart-count">
            {count}
          </span>
        ) : null}
      </span>
      <span className={styles.actionLabel}>Carrinho</span>
    </Link>
  );
}
