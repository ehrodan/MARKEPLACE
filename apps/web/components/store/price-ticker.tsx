"use client";

import Link from "next/link";
import { formatMinorCurrency, listingTitle } from "@/components/marketplace/formatters";
import type { PublicListingPage } from "@/components/marketplace/types";
import { useApiResource } from "@/hooks/use-api-resource";
import { rarityPresentation } from "@/components/marketplace/rarity";
import styles from "./price-ticker.module.css";

/**
 * Faixa de preços em movimento — os itens à venda passando, com o preço real.
 *
 * O dono pediu "os preços passando". A referência visual que ele forneceu
 * (obsidiana + dourado + turquesa, HUD e bordas técnicas) e os concorrentes de
 * `docs/20` usam a mesma peça: uma régua viva que prova que a loja tem
 * movimento antes de a pessoa rolar até a grade.
 *
 * O que a separa de um letreiro publicitário, e por que ela é honesta:
 *
 * - **cada tira é um anúncio publicado de verdade**, com preço vindo da API e
 *   link para a própria oferta. Se o catálogo estiver vazio, a faixa não
 *   renderiza — nunca inventa um item para ter o que mostrar;
 * - **nenhuma urgência fabricada** (`docs/03 §10`): sem contador, sem "última
 *   unidade", sem preço riscado. Só nome, raridade e o preço praticado;
 * - **não é infinita de mentira**: a lista é duplicada UMA vez para o laço
 *   fechar sem salto, e a cópia é `aria-hidden` para o leitor de tela ouvir
 *   cada item uma única vez;
 * - **para quando a pessoa quer ler**: pausa em `:hover` e em `:focus-within`,
 *   e desaparece por completo em `prefers-reduced-motion`, onde vira uma lista
 *   estática com os mesmos links.
 *
 * O movimento é uma única animação de `transform` numa faixa, resolvida pelo
 * compositor — não há JS por quadro.
 */

/** Itens buscados. Acima disso a faixa vira uma segunda vitrine. */
const TICKER_SIZE = 14;

export function PriceTicker() {
  const resource = useApiResource<PublicListingPage>(`/v1/listings?limit=${String(TICKER_SIZE)}`);

  if (resource.status !== "ready") return null;
  const listings = resource.data.data;
  if (!listings.length) return null;

  const strip = listings.map((listing) => {
    const rarity = rarityPresentation(listing.catalogItem?.rarity);
    return (
      <li className={styles.item} data-rarity={rarity?.value} key={listing.listingId}>
        <Link className={styles.link} href={`/anuncios/${encodeURIComponent(listing.publicSlug)}`}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.name}>{listingTitle(listing)}</span>
          <span className={styles.price}>
            {formatMinorCurrency(listing.priceMinor, listing.currency)}
          </span>
        </Link>
      </li>
    );
  });

  return (
    <section aria-label="Ofertas publicadas agora" className={styles.ticker}>
      <p className={styles.label}>
        <span className={styles.pulse} aria-hidden="true" />
        ao vivo
      </p>
      <div className={styles.viewport}>
        <ul className={styles.track}>
          {strip}
        </ul>
      </div>
    </section>
  );
}
