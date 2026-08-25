import { Box, ImageOff } from "lucide-react";
import { assetTypeLabel, listingTitle, primaryImageAsset, safeAssetUrl } from "./formatters";
import type { PublicCatalogAsset, PublicListing } from "./types";
import styles from "./marketplace.module.css";

export function AssetVisual({
  listing,
  assets = listing.assets ?? [],
  detail = false,
}: {
  listing: PublicListing;
  assets?: PublicCatalogAsset[];
  detail?: boolean;
}) {
  const imageAsset = primaryImageAsset(assets);
  const imageUrl = imageAsset ? safeAssetUrl(imageAsset.storageUri) : null;
  const modelAsset = assets.find((asset) => (
    asset.assetType === "MODEL_3D_GLB" && (!asset.approvalStatus || asset.approvalStatus === "APPROVED")
  ));

  if (imageAsset && imageUrl) {
    return (
      <div className={detail ? styles.detailVisual : styles.cardVisual}>
        <img
          src={imageUrl}
          alt={listingTitle(listing)}
          loading={detail ? "eager" : "lazy"}
          decoding="async"
        />
        {/* O carimbo so aparece quando o tipo do asset muda a decisao de quem
            compra — um modelo 3D para inspecionar. Rotular toda foto de
            "Imagem principal" e ruido sobre a propria imagem. */}
        {imageAsset.assetType === "POSTER_2D" ? null : (
          <span className={styles.assetStamp}>{assetTypeLabel(imageAsset.assetType)}</span>
        )}
      </div>
    );
  }

  return (
    <div className={`${detail ? styles.detailVisual : styles.cardVisual} ${styles.assetFallback}`}>
      {modelAsset
        ? <Box aria-hidden="true" size={detail ? 54 : 36} strokeWidth={1.25} />
        : <ImageOff aria-hidden="true" size={detail ? 54 : 36} strokeWidth={1.25} />}
      <span>{modelAsset ? "Modelo 3D disponível" : "Imagem ainda não publicada"}</span>
    </div>
  );
}
