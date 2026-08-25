const SUPPORTED_BRAND_VIEWER_SLUGS = new Set([
  "ochpoch-market",
  "ochpoch-market-emblem",
]);

const VIEWER_ORIGIN_ALLOWLIST: readonly RegExp[] = [
  /^\/$/u,
  /^\/market$/u,
  /^\/buscar$/u,
  /^\/anuncios\/[A-Za-z0-9._~-]{1,160}$/u,
  /^\/itens\/[A-Za-z0-9._~-]{1,160}$/u,
];

export function isSupportedBrandViewerSlug(slug: string): boolean {
  return SUPPORTED_BRAND_VIEWER_SLUGS.has(slug);
}

export function allowlistedViewerOrigin(
  candidate: string | string[] | undefined,
): string | null {
  if (typeof candidate !== "string") return null;
  const value = candidate.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return VIEWER_ORIGIN_ALLOWLIST.some((pattern) => pattern.test(value)) ? value : null;
}

export function viewer3dHref(itemSlug: string, origin: string): string {
  const base = `/itens/${encodeURIComponent(itemSlug)}/3d`;
  const from = allowlistedViewerOrigin(origin);
  return from === null ? base : `${base}?from=${encodeURIComponent(from)}`;
}
