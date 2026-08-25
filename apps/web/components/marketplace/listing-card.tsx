import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import {
  formatMinorCurrency,
  formatQuantity,
  itemTypeLabel,
  listingTitle,
} from "./formatters";
import { AssetVisual } from "./asset-visual";
import { rarityPresentation } from "./rarity";
import type { PublicListing } from "./types";
import styles from "./marketplace.module.css";

/**
 * Card de anúncio — a unidade onde a compra começa.
 *
 * Ordem de leitura em Z, que é a ordem em que a decisão acontece:
 *
 *   raridade -> imagem do item -> nome -> preço -> estoque/vendedor -> ação
 *
 * O preço é o maior elemento textual, em fonte de dados com `tabular-nums`, e
 * fica na diagonal do CTA — o olho sai do número direto para a ação. Condição e
 * raridade são atributos técnicos e ficam menores, sem disputar.
 *
 * O CTA existe porque um card inteiro clicável não diz o que acontece ao
 * clicar. O botão nomeia o próximo passo. O card todo continua alcançável pelo
 * título, então quem usa teclado tem um alvo só por card, não três.
 *
 * O que este card NÃO faz, por `docs/03 §10`: não mostra preço riscado que não
 * foi praticado, não mostra contador, não escreve "últimas unidades". O estoque
 * exibido é o número real do banco — se são 40, diz 40.
 */
export function ListingCard({ listing }: { listing: PublicListing }) {
  const item = listing.catalogItem;
  const inStock = listing.quantityAvailable > 0;
  const href = `/anuncios/${encodeURIComponent(listing.publicSlug)}`;
  const rarity = rarityPresentation(item?.rarity);
  const condition = item?.craftQuality?.replace(/_/g, " ").toLocaleLowerCase("pt-BR") ?? null;

  return (
    <article className={styles.listingCard} data-rarity={rarity?.value}>
      <div className={styles.visualLink}>
        {/* A faixa de raridade é a primeira coisa lida, e diz o nível por
            TEXTO além da cor — quem não distingue as matizes lê a palavra. */}
        {rarity ? (
          <p className={styles.rarityFlag}>
            <span className={styles.rarityDot} aria-hidden="true" />
            {rarity.label}
            <span className={styles.rarityStep}>
              {rarity.step}/{rarity.total}
            </span>
          </p>
        ) : null}
        <AssetVisual listing={listing} />
      </div>

      <div className={styles.cardBody}>
        <div>
          <p className={styles.cardTaxonomy}>
            {item ? `${item.gameOrigin} · ${itemTypeLabel(item.itemType)}` : "Item publicado"}
          </p>
          <h2 className={styles.cardTitle}>
            <Link href={href}>{listingTitle(listing)}</Link>
          </h2>
        </div>

        <div className={styles.cardFooter}>
          <div className={styles.priceBlock}>
            <span>Preço final</span>
            <strong>{formatMinorCurrency(listing.priceMinor, listing.currency)}</strong>
            {condition ? <small>{condition}</small> : null}
          </div>
          <div className={styles.purchaseFacts}>
            <p className={styles.stockFlag} data-stock={inStock ? "in" : "out"}>
              {inStock ? `${formatQuantity(listing.quantityAvailable)} em estoque` : "Sem estoque"}
            </p>
            {listing.quantitySold > 0 ? (
              <span>{formatQuantity(listing.quantitySold)} {listing.quantitySold === 1 ? "vendido" : "vendidos"}</span>
            ) : null}
          </div>
          <div className={styles.sellerLine}>
            <Store aria-hidden="true" size={15} />
            <span>{listing.seller?.displayName || "Vendedor"}</span>
          </div>
          {/* `tabIndex={-1}`: o título já leva ao mesmo destino. Dois alvos
              focáveis por card dobrariam o número de tabulações da grade sem
              oferecer um destino novo. */}
          <Link className={styles.cardCta} href={href} tabIndex={-1}>
            <span>Ver oferta</span>
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
