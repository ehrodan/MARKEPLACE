"use client";

import Link from "next/link";
import { formatMinorCurrency, itemTypeLabel } from "@/components/marketplace/formatters";
import type { PublicListing, PublicListingPage } from "@/components/marketplace/types";
import { useApiResource } from "@/hooks/use-api-resource";
import styles from "./store-banners.module.css";

/**
 * Portas largas de entrada — o "banner" do topo da loja.
 *
 * Os concorrentes de `docs/20` põem um carrossel logo abaixo da nav (a Nesha
 * usa 340px de altura). A função dele é dar ao visitante uma entrada larga
 * antes da grade, e é o que `SCR-PUB-001` chama de "orientar entrada por
 * categoria".
 *
 * A diferença está no CONTEÚDO. O carrossel do benchmark carrega promoção:
 * cupom, "desconto máximo", campanha. Nada disso existe aqui — não há motor de
 * promoção, e anunciar desconto sem preço de referência praticado é proibido
 * por `docs/03 §10`.
 *
 * Então cada porta carrega o que é **verdade agora**: a categoria, quantas
 * ofertas ela tem e a faixa de preço real praticada nela. É informação que
 * ajuda a decidir por onde entrar, e cada número sai do mesmo recorte que a
 * grade abaixo mostra.
 *
 * Se não houver oferta suficiente para formar uma porta, a seção não renderiza.
 * Uma vitrine com portas vazias é pior que uma vitrine sem portas.
 */

/** Portas exibidas. Três é o teto da redução de opções sem virar menu. */
const MAX_DOORS = 3;
/** Abaixo disso a categoria não sustenta uma porta própria. */
const MIN_OFFERS_PER_DOOR = 2;

interface Door {
  readonly itemType: string;
  readonly label: string;
  readonly count: number;
  readonly minPriceMinor: bigint;
  readonly maxPriceMinor: bigint;
  readonly currency: string;
}

/** Derivada do recorte carregado — nenhum número é estimado. */
export function buildDoors(listings: readonly PublicListing[]): Door[] {
  const byType = new Map<string, PublicListing[]>();
  for (const listing of listings) {
    const type = listing.catalogItem?.itemType;
    if (typeof type !== "string") continue;
    byType.set(type, [...(byType.get(type) ?? []), listing]);
  }

  const doors: Door[] = [];
  for (const [itemType, group] of byType) {
    if (group.length < MIN_OFFERS_PER_DOOR) continue;
    // `group` já passou por `MIN_OFFERS_PER_DOOR`, então tem pelo menos dois
    // preços — o reduce parte do primeiro sem precisar de valor inicial falso.
    const prices = group.map((listing) => BigInt(listing.priceMinor));
    const min = prices.reduce((menor, price) => (price < menor ? price : menor));
    const max = prices.reduce((maior, price) => (price > maior ? price : maior));
    doors.push({
      itemType,
      label: itemTypeLabel(itemType),
      count: group.length,
      minPriceMinor: min,
      maxPriceMinor: max,
      currency: group[0]?.currency ?? "BRL",
    });
  }

  // Mais ofertas primeiro: a porta mais larga é a que tem mais o que oferecer.
  return doors.sort((a, b) => b.count - a.count).slice(0, MAX_DOORS);
}

export function StoreBanners() {
  const resource = useApiResource<PublicListingPage>("/v1/listings?limit=48");

  if (resource.status !== "ready") return null;
  const doors = buildDoors(resource.data.data);
  if (doors.length === 0) return null;

  return (
    <section aria-labelledby="store-doors-title" className={styles.doors}>
      <h2 className={styles.srOnly} id="store-doors-title">
        Entradas por categoria
      </h2>
      <div className={styles.grid}>
        {doors.map((door, index) => (
          <Link
            className={styles.door}
            data-emphasis={index === 0 ? "lead" : undefined}
            href={`/market?tipo=${encodeURIComponent(door.itemType)}`}
            key={door.itemType}
          >
            <span className={styles.doorLabel}>{door.label}</span>
            <span className={styles.doorCount}>
              {door.count} {door.count === 1 ? "oferta" : "ofertas"}
            </span>
            <span className={styles.doorRange}>
              {door.minPriceMinor === door.maxPriceMinor
                ? formatMinorCurrency(door.minPriceMinor.toString(), door.currency)
                : `${formatMinorCurrency(door.minPriceMinor.toString(), door.currency)} — ${formatMinorCurrency(door.maxPriceMinor.toString(), door.currency)}`}
            </span>
            <span aria-hidden="true" className={styles.doorArrow}>
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
