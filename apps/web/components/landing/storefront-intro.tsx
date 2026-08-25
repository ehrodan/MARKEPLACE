"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Box, ShieldCheck } from "lucide-react";
import { Reveal, Tilt3D } from "@midas/ui";
import {
  formatMinorCurrency,
  listingTitle,
  primaryImageAsset,
  safeAssetUrl,
} from "@/components/marketplace/formatters";
import type { PublicListing, PublicListingPage } from "@/components/marketplace/types";
import { useApiResource } from "@/hooks/use-api-resource";
import { BRAND } from "@/lib/brand";
import { viewer3dHref } from "@/lib/viewer-routing";
import styles from "./storefront-intro.module.css";

const viewerHref = viewer3dHref("ochpoch-market", "/");

function listingImage(listing: PublicListing): string | null {
  const asset = primaryImageAsset(listing.assets ?? []);
  return asset ? safeAssetUrl(asset.storageUri) : null;
}

function InventoryStack({ listings }: { listings: readonly PublicListing[] }) {
  if (listings.length === 0) {
    return (
      <div className={styles.fallbackArt} aria-hidden="true">
        <Image src={BRAND.assets.posterAngle} alt="" fill priority sizes="28rem" />
      </div>
    );
  }

  const primary = listings[0];
  const primaryImage = listingImage(primary);

  return (
    <div className={styles.stack}>
      {listings.slice(1, 3).reverse().map((listing, index) => {
        const imageUrl = listingImage(listing);
        return imageUrl ? (
          <span className={styles.stackCard} data-layer={String(index + 1)} key={listing.listingId}>
            <img src={imageUrl} alt="" decoding="async" />
          </span>
        ) : null;
      })}

      <Link
        className={styles.primaryCard}
        href={`/anuncios/${encodeURIComponent(primary.publicSlug)}`}
        aria-label={`Abrir oferta ${listingTitle(primary)}`}
      >
        {primaryImage ? (
          <img src={primaryImage} alt="" decoding="async" />
        ) : (
          <Image src={BRAND.assets.posterAngle} alt="" fill priority sizes="28rem" />
        )}
        <span className={styles.productMeta}>
          <small>OFERTA PUBLICADA</small>
          <strong>{listingTitle(primary)}</strong>
          <b>{formatMinorCurrency(primary.priceMinor, primary.currency)}</b>
        </span>
        <span className={styles.openOffer} aria-hidden="true">
          Ver oferta <ArrowUpRight size={15} />
        </span>
      </Link>
    </div>
  );
}

export function StorefrontIntro() {
  const resource = useApiResource<PublicListingPage>("/v1/listings?limit=3");
  const listings = resource.status === "ready" ? resource.data.data : [];

  return (
    <section className={styles.section} aria-labelledby="storefront-title">
      <div className={styles.banner}>
        <span className={styles.ambientOne} aria-hidden="true" />
        <span className={styles.ambientTwo} aria-hidden="true" />

        <Reveal className={styles.copy} threshold={0.05}>
          {/* Desejo com fato: a peça é a figura, o ouro fica só no CTA.
              Cada afirmação abaixo é capability real — imagem grande na
              vitrine, preço/estoque do catálogo, vendedor identificado. */}
          <span className={styles.eyebrow}>MARKETPLACE DE ITENS DIGITAIS</span>
          <h1 id="storefront-title">
            Aquele item,
            <span>agora de perto.</span>
          </h1>
          <p>
            A vitrine mostra a peça em tamanho grande, com preço publicado e estoque do
            catálogo. Pronta para ir ao carrinho.
          </p>
          <div className={styles.proofs} aria-label="Compromissos da vitrine">
            <span><ShieldCheck aria-hidden="true" size={15} /> Preço do catálogo</span>
            <span><ShieldCheck aria-hidden="true" size={15} /> Estoque verificável</span>
            <span><ShieldCheck aria-hidden="true" size={15} /> Vendedor identificado</span>
          </div>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="#vitrine">
              <span>Explorar ofertas</span>
              <ArrowDown aria-hidden="true" size={16} />
            </Link>
            <Link className={styles.secondaryAction} href={viewerHref}>
              <Box aria-hidden="true" size={16} />
              <span>Ver símbolo em 3D</span>
            </Link>
          </div>
        </Reveal>

        <Reveal className={styles.stageReveal} delay={80} threshold={0.05}>
          <Tilt3D className={styles.stageTilt} max={4} glare={false}>
            <div className={styles.glassStage}>
              <span className={styles.stageLabel}>INVENTÁRIO PUBLICADO</span>
              <InventoryStack listings={listings} />
              <span className={styles.stageStatus}>
                {resource.status === "ready"
                  ? `${String(listings.length)} ofertas carregadas agora`
                  : "Lendo o catálogo agora"}
              </span>
            </div>
          </Tilt3D>
        </Reveal>
      </div>
    </section>
  );
}
