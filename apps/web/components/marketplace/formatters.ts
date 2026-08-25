import type { PublicCatalogAsset, PublicListing } from "./types";

const itemTypeLabels: Record<string, string> = {
  WEAPON: "Arma",
  SKIN: "Skin",
  STICKER: "Adesivo",
  KEY: "Chave",
  CASE: "Caixa",
  OTHER: "Outro",
};

const rarityLabels: Record<string, string> = {
  COMMON: "Comum",
  UNCOMMON: "Incomum",
  RARE: "Raro",
  EPIC: "Épico",
  LEGENDARY: "Lendário",
  MYTHIC: "Mítico",
  CONTRABAND: "Contrabando",
};

const craftQualityLabels: Record<string, string> = {
  FACTORY_NEW: "Nova de fábrica",
  MINIMAL_WEAR: "Pouco usada",
  FIELD_TESTED: "Testada em campo",
  WELL_WORN: "Bem desgastada",
  BATTLE_SCARRED: "Veterana de guerra",
};

const assetTypeLabels: Record<string, string> = {
  POSTER_2D: "Imagem principal",
  MODEL_3D_GLB: "Modelo 3D",
  MULTI_VIEW: "Múltiplas vistas",
  SINGLE_VIEW: "Imagem do item",
};

export function humanizeCode(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replaceAll("_", " ")
    .replace(/^./u, (character) => character.toLocaleUpperCase("pt-BR"));
}

export function itemTypeLabel(value: string): string {
  return itemTypeLabels[value] ?? humanizeCode(value);
}

export function rarityLabel(value: string): string {
  return rarityLabels[value] ?? humanizeCode(value);
}

export function craftQualityLabel(value: string): string {
  return craftQualityLabels[value] ?? humanizeCode(value);
}

export function assetTypeLabel(value: string): string {
  return assetTypeLabels[value] ?? humanizeCode(value);
}

export function listingTitle(listing: PublicListing): string {
  return listing.catalogItem?.displayName || humanizeCode(listing.publicSlug.replaceAll("-", "_"));
}

export function formatMinorCurrency(
  rawAmountMinor: string,
  currency: string,
  locale = "pt-BR",
): string {
  if (!/^\d+$/u.test(rawAmountMinor)) return "Preço indisponível";

  try {
    const amountMinor = BigInt(rawAmountMinor);
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    const divisor = 10n ** BigInt(fractionDigits);

    if (amountMinor <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return formatter.format(Number(amountMinor) / (10 ** fractionDigits));
    }

    const major = amountMinor / divisor;
    const fraction = (amountMinor % divisor).toString().padStart(fractionDigits, "0");
    const groupedMajor = new Intl.NumberFormat(locale, {
      useGrouping: true,
      maximumFractionDigits: 0,
    }).format(major);
    let integerWritten = false;

    return formatter.formatToParts(0).map((part) => {
      if (part.type === "integer" && !integerWritten) {
        integerWritten = true;
        return groupedMajor;
      }
      if (part.type === "fraction") return fraction;
      return part.value;
    }).join("");
  } catch {
    return "Preço indisponível";
  }
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

export function formatPublicDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function shortIdentifier(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function safeAssetUrl(storageUri: string): string | null {
  const value = storageUri.trim();
  if (/^https?:\/\//iu.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return null;
}

export function approvedAssets(assets: PublicCatalogAsset[]): PublicCatalogAsset[] {
  return assets.filter((asset) => !asset.approvalStatus || asset.approvalStatus === "APPROVED");
}

export function primaryImageAsset(assets: PublicCatalogAsset[]): PublicCatalogAsset | null {
  const renderable = approvedAssets(assets).filter((asset) => (
    asset.mimeType.startsWith("image/") && safeAssetUrl(asset.storageUri) !== null
  ));
  const fallback = renderable.length > 0 ? renderable[0] : null;
  return renderable.find((asset) => asset.isPrimary) ?? fallback;
}
