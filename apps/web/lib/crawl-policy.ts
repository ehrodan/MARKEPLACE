const privateRoutePrefixes = [
  "/api/",
  "/admin/",
  "/master/",
  "/conta/",
  "/vender/",
  "/checkout/",
  "/pedidos/",
  "/mensagens/",
] as const;

export function publicSiteUrl(environment: NodeJS.ProcessEnv = process.env): URL | null {
  const configured = environment.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && environment.NODE_ENV === "production") return null;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export function crawlPolicy(environment: NodeJS.ProcessEnv = process.env) {
  const siteUrl = publicSiteUrl(environment);
  const indexable = environment.NODE_ENV === "production" && siteUrl !== null;
  return {
    indexable,
    siteUrl,
    privateRoutePrefixes,
  };
}
