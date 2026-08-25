"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import {
  browserStorage,
  isFavoriteOnDevice,
  removeFavoriteFromDevice,
  saveFavoriteToDevice,
} from "./favorites-storage";
import styles from "./favorite-button.module.css";

/**
 * Botão "Favoritar" — a costura descrita em docs/coordenacao/WIRING-favoritos.md §2.
 *
 * Uma chamada por clique, direto nas funções puras do storage. O botão nunca
 * liga aviso por efeito colateral (a entrada nasce com `watch: []`) e nunca
 * exibe contagem, popularidade ou qualquer dado que o dispositivo não tenha.
 *
 * O estado inicial só é conhecido no cliente (depende de `localStorage`), então
 * o botão nasce como "Favoritar" e corrige no primeiro efeito — sem piscar
 * estado inventado no SSR.
 */
export interface FavoriteButtonListing {
  listingId: string;
  publicSlug: string;
  title: string;
  /** Preço publicado lido na resposta da API, em unidades mínimas. */
  priceMinor: string;
  currency: string;
}

export interface FavoriteButtonProps {
  listing: FavoriteButtonListing;
  /** `icon` = coração compacto para cards; `labeled` = botão com texto. */
  variant?: "icon" | "labeled";
  className?: string;
}

function announce(message: string) {
  const region = document.getElementById("global-live-region");
  if (region) region.textContent = message;
}

export function FavoriteButton({ listing, variant = "labeled", className }: FavoriteButtonProps) {
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setSaved(isFavoriteOnDevice(browserStorage(), listing.listingId));
  }, [listing.listingId]);

  function handleToggle() {
    setNote(null);
    if (saved) {
      const result = removeFavoriteFromDevice(browserStorage(), listing.listingId);
      if (result.issue === "UNAVAILABLE") {
        setNote("O armazenamento local está indisponível neste navegador.");
        return;
      }
      setSaved(false);
      announce(`${listing.title} removido dos favoritos.`);
      return;
    }

    const result = saveFavoriteToDevice(browserStorage(), {
      listingId: listing.listingId,
      publicSlug: listing.publicSlug,
      title: listing.title,
      savedPriceMinor: listing.priceMinor,
      currency: listing.currency,
      savedAt: new Date().toISOString(),
    });
    if (result.issue === "UNAVAILABLE" || result.issue === "QUOTA" || result.issue === "CORRUPTED") {
      setNote("Não foi possível salvar neste dispositivo. Libere espaço ou permita o armazenamento local.");
      return;
    }
    setSaved(true);
    announce(`${listing.title} salvo nos favoritos deste dispositivo.`);
  }

  const label = saved ? "Salvo nos favoritos" : "Favoritar";
  const classes = [
    styles.button,
    variant === "icon" ? styles.iconOnly : styles.labeled,
    saved ? styles.saved : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={styles.root}>
      <button
        aria-label={variant === "icon" ? label : undefined}
        aria-pressed={saved}
        className={classes}
        onClick={handleToggle}
        title={saved ? "Remover dos favoritos" : "Salvar nos favoritos deste dispositivo"}
        type="button"
      >
        <Heart aria-hidden="true" className={styles.heart} size={variant === "icon" ? 17 : 16} />
        {variant === "labeled" ? <span>{saved ? "Salvo" : "Favoritar"}</span> : null}
      </button>
      {note ? (
        <span className={styles.note} role="alert">
          {note}
        </span>
      ) : null}
    </span>
  );
}
