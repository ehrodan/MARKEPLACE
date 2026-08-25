/**
 * Recompra honesta (RF-262/263): toda ação nasce SOMENTE de dado real gravado
 * no pedido — nunca de elegibilidade inventada, e nunca prometendo preço que
 * não foi buscado. O rótulo diz exatamente o que o clique faz.
 *
 * O snapshot congelado na compra (modules/orders/src/order-service.ts,
 * `listingSnapshot`) traz `publicSlug` do anúncio no topo e o título em
 * `catalogItem.displayName`. Pedidos antigos podem ter snapshot vazio
 * (schema default `{}`) — por isso todo campo é tratado como opcional.
 */

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Título do item vem do snapshot congelado na compra, nunca do catálogo atual. */
export function snapshotTitle(snapshot: Record<string, unknown>): string | null {
  const catalogItem = snapshot["catalogItem"];
  if (catalogItem && typeof catalogItem === "object" && !Array.isArray(catalogItem)) {
    const displayName = cleanString((catalogItem as Record<string, unknown>)["displayName"]);
    if (displayName) return displayName;
  }
  for (const key of ["displayName", "itemTitle", "title", "publicSlug"]) {
    const value = cleanString(snapshot[key]);
    if (value) return value;
  }
  return null;
}

export interface RepurchaseAction {
  /** OFFER = o pedido guarda a referência pública do anúncio; SEARCH = só o título. */
  kind: "OFFER" | "SEARCH";
  href: string;
  label: "Ver oferta atual" | "Procurar item semelhante";
}

/**
 * - Com `publicSlug` no snapshot → "Ver oferta atual" em `/anuncios/{slug}`.
 * - Sem slug, mas com título real → "Procurar item semelhante" em `/buscar?q=`.
 * - Sem nenhum dos dois → null: nenhum atalho é exibido (nada é inventado).
 */
export function repurchaseActionFor(snapshot: Record<string, unknown>): RepurchaseAction | null {
  const slug = cleanString(snapshot["publicSlug"]);
  if (slug) {
    return { kind: "OFFER", href: `/anuncios/${encodeURIComponent(slug)}`, label: "Ver oferta atual" };
  }
  const title = snapshotTitle(snapshot);
  if (title) {
    return { kind: "SEARCH", href: `/buscar?q=${encodeURIComponent(title)}`, label: "Procurar item semelhante" };
  }
  return null;
}
