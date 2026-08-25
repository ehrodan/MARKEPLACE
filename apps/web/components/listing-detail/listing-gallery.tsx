"use client";

import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Box, ImageOff, Rotate3d } from "lucide-react";
import {
  approvedAssets,
  assetTypeLabel,
  listingTitle,
  safeAssetUrl,
} from "@/components/marketplace/formatters";
import { rarityPresentation } from "@/components/marketplace/rarity";
import type { PublicCatalogAsset, PublicListing } from "@/components/marketplace/types";
import { isSupportedBrandViewerSlug, viewer3dHref } from "@/lib/viewer-routing";
import styles from "./listing-detail.module.css";

/**
 * Galeria de SCR-PUB-006.
 *
 * Só entra mídia aprovada e com URL pública resolvível; nenhum placeholder é
 * apresentado como se fosse o item. Motion M2: a troca entre mídias tem uma
 * transição curta de entrada (o `key` remonta a imagem), desligada em
 * `prefers-reduced-motion`. Nada aqui anima preço nem move ação.
 *
 * `data-rarity` tinge a moldura do palco com a cor da raridade — cor como
 * INFORMAÇÃO (docs/03): tinta sutil de borda e fundo, nunca superfície
 * clicável. O rótulo textual da raridade segue no cabeçalho da página.
 */

export interface MediaFrame {
  readonly key: string;
  readonly url: string;
  readonly label: string;
  readonly alt: string;
}

export function buildMediaFrames(
  listing: PublicListing,
  assets: readonly PublicCatalogAsset[],
): MediaFrame[] {
  const title = listingTitle(listing);
  const renderable = approvedAssets([...assets]).filter(
    (asset) => asset.mimeType.startsWith("image/") && safeAssetUrl(asset.storageUri) !== null,
  );
  const ordered = [
    ...renderable.filter((asset) => asset.isPrimary),
    ...renderable.filter((asset) => !asset.isPrimary),
  ];

  return ordered.flatMap((asset, index) => {
    const url = safeAssetUrl(asset.storageUri);
    if (url === null) return [];
    const label = assetTypeLabel(asset.assetType);
    return [{
      key: asset.catalogAssetId,
      url,
      label,
      alt: `${title}, ${label}, mídia ${String(index + 1)} de ${String(ordered.length)}`,
    }];
  });
}

export function findPublished3dArtifact(
  assets: readonly PublicCatalogAsset[],
): PublicCatalogAsset | null {
  return approvedAssets([...assets]).find((asset) => asset.assetType === "MODEL_3D_GLB") ?? null;
}

export interface ListingGalleryProps {
  listing: PublicListing;
  assets: readonly PublicCatalogAsset[];
  /** Slug do item-base; ausente quando a API não enviou o item do catálogo. */
  itemSlug: string | null;
}

export function ListingGallery({ listing, assets, itemSlug }: ListingGalleryProps) {
  const baseId = useId();
  const headingId = `${baseId}-galeria`;
  const [activeIndex, setActiveIndex] = useState(0);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const frames = useMemo(() => buildMediaFrames(listing, assets), [listing, assets]);
  const artifact3d = useMemo(() => findPublished3dArtifact(assets), [assets]);
  const rarity = rarityPresentation(listing.catalogItem?.rarity);
  const total = frames.length;
  const safeIndex = activeIndex < total ? activeIndex : 0;
  const frame = frames.at(safeIndex) ?? null;

  const focusThumb = useCallback((index: number) => {
    setActiveIndex(index);
    thumbRefs.current[index]?.focus();
  }, []);

  const onThumbKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (total < 2) return;
      const last = total - 1;
      let next: number | null = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = last;
      if (next === null) return;
      event.preventDefault();
      focusThumb(next);
    },
    [focusThumb, total],
  );

  return (
    <section aria-labelledby={headingId} className={styles.gallery} data-rarity={rarity?.value}>
      <h2 className={styles.visuallyHidden} id={headingId}>Mídia publicada do item</h2>

      {frame ? (
        <figure className={styles.galleryStage}>
          <img
            alt={frame.alt}
            className={styles.galleryImage}
            decoding="async"
            key={frame.key}
            loading="eager"
            src={frame.url}
          />
          <figcaption className={styles.galleryStamp}>{frame.label}</figcaption>
        </figure>
      ) : (
        <div className={`${styles.galleryStage} ${styles.galleryEmpty}`}>
          {artifact3d ? (
            <Box aria-hidden="true" size={54} strokeWidth={1.25} />
          ) : (
            <ImageOff aria-hidden="true" size={54} strokeWidth={1.25} />
          )}
          <p>
            {artifact3d
              ? "Este item tem modelo 3D aprovado, mas nenhuma imagem publicada. Nada foi gerado para preencher o espaço."
              : "Nenhuma imagem aprovada foi publicada para este item. A interface não exibe arte substituta."}
          </p>
        </div>
      )}

      {total > 1 ? (
        <div
          aria-label={`Selecionar mídia do item, ${String(total)} disponíveis`}
          className={styles.galleryThumbs}
          role="group"
        >
          {frames.map((item, index) => (
            <button
              aria-pressed={index === safeIndex}
              className={`${styles.thumb} ${index === safeIndex ? styles.thumbActive : ""}`.trim()}
              key={item.key}
              onClick={() => { setActiveIndex(index); }}
              onKeyDown={(event) => { onThumbKeyDown(event, index); }}
              ref={(node) => { thumbRefs.current[index] = node; }}
              tabIndex={index === safeIndex ? 0 : -1}
              type="button"
            >
              <img alt="" aria-hidden="true" decoding="async" loading="lazy" src={item.url} />
              <span className={styles.visuallyHidden}>
                Ver mídia {index + 1} de {total}: {item.label}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {frame ? (
        <p aria-live="polite" className={styles.galleryStatus}>
          Mídia {safeIndex + 1} de {total}, {frame.label}
        </p>
      ) : null}

      {artifact3d && itemSlug && isSupportedBrandViewerSlug(itemSlug) ? (
        <p className={styles.galleryActions}>
          <Link
            className="text-link"
            href={viewer3dHref(itemSlug, `/anuncios/${listing.publicSlug}`)}
          >
            <Rotate3d aria-hidden="true" size={17} /> Inspecionar em 3D sem sair da jornada
          </Link>
        </p>
      ) : null}
    </section>
  );
}
