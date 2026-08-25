"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, FileText, History, LifeBuoy, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@midas/ui";
import { useApiResource } from "@/hooks/use-api-resource";
import {
  approvedAssets,
  craftQualityLabel,
  formatPublicDate,
  humanizeCode,
  itemTypeLabel,
  listingTitle,
  rarityLabel,
} from "@/components/marketplace/formatters";
import { MarketplaceError, MarketplaceLoading } from "@/components/marketplace/marketplace-states";
import type { PublicCatalogAsset } from "@/components/marketplace/types";
import { ItemOffersAnchor } from "./item-offers-anchor";
import { ListingGallery } from "./listing-gallery";
import { ListingTabs } from "./listing-tabs";
import { PurchasePanel, type DetailListing } from "./purchase-panel";
import { SellerSummary } from "./seller-summary";
import styles from "./listing-detail.module.css";

/**
 * SCR-PUB-006, a página da oferta.
 *
 * Hierarquia de leitura (é o trabalho principal desta tela):
 *   1. o que é o item      -> galeria + identidade
 *   2. quanto custa        -> preço publicado
 *   3. posso escolher      -> estoque + carrinho
 *   4. quanto pago         -> taxas recolhíveis
 *   5. quem vende          -> resumo público do vendedor
 *   6. o que me protege    -> proteção e prazos
 *
 * A separação entre blocos usa região comum (borda + superfície) e escala
 * tipográfica, nunca cor: cor aqui só reforça estado que já está escrito.
 *
 * Não existe bloco de "ofertas relacionadas": `GET /v1/listings` não filtra por
 * item do catálogo, então qualquer LISTA desse tipo seria uma amostra parcial
 * apresentada como se fosse completa. A comparação oferta a oferta pertence ao
 * item-base (SCR-PUB-005), linkado na trilha. Junto desse link vive só a
 * âncora agregada (`ItemOffersAnchor`): contagem e menor preço calculados com
 * a MESMA leitura que SCR-PUB-005 faz, e omitidos em silêncio quando a leitura
 * falha — nunca um número inventado.
 */

function MetaFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaItem}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ListingDetail({
  listing,
  assets,
  assetsPending,
  assetsFailed,
}: {
  listing: DetailListing;
  assets: readonly PublicCatalogAsset[];
  assetsPending: boolean;
  assetsFailed: boolean;
}) {
  const item = listing.catalogItem ?? null;
  const title = listingTitle(listing);
  const publishedAt = formatPublicDate(listing.publishedAt);
  const updatedAt = formatPublicDate(listing.updatedAt);
  const plan = listing.listingPlan ?? null;
  const published = listing.listingStatus === "PUBLISHED" && !listing.pausedAt;
  const itemHref = item ? `/itens/${encodeURIComponent(item.publicSlug)}` : null;

  return (
    <article className={styles.page}>
      <nav aria-label="Trilha de navegação" className={styles.breadcrumb}>
        <Link href="/market"><ArrowLeft aria-hidden="true" size={15} /> Marketplace</Link>
        <ChevronRight aria-hidden="true" size={14} />
        {itemHref && item ? (
          <>
            <Link href={itemHref}>{item.displayName}</Link>
            <ChevronRight aria-hidden="true" size={14} />
          </>
        ) : null}
        <span aria-current="page">{title}</span>
      </nav>

      <h1 className={styles.visuallyHidden}>{title}</h1>

      <div className={styles.mainGrid}>
        <div className={styles.mediaColumn}>
          <ListingGallery
            assets={assets}
            itemSlug={item?.publicSlug ?? null}
            listing={listing}
          />
          <header className={styles.identity}>
            <p className={styles.eyebrow}>
              {item ? `${item.gameOrigin} / ${itemTypeLabel(item.itemType)}` : "Item do catálogo"}
            </p>
            <p aria-hidden="true" className={styles.title}>{title}</p>
            <div className={styles.identityBadges}>
              <StatusBadge tone={published ? "success" : "warning"}>
                {published ? "Oferta publicada" : `Oferta ${humanizeCode(listing.listingStatus)}`}
              </StatusBadge>
              {item?.rarity ? (
                <StatusBadge tone="neutral">{rarityLabel(item.rarity)}</StatusBadge>
              ) : null}
              {item?.craftQuality ? (
                <StatusBadge tone="neutral">{craftQualityLabel(item.craftQuality)}</StatusBadge>
              ) : null}
              {/* O código do plano é metadado de auditoria: mora na
                  "Procedência do anúncio" abaixo, não na identidade do item. */}
            </div>
            {itemHref ? (
              <div className={styles.identityLink}>
                <Link className="text-link" href={itemHref}>
                  Voltar ao item-base e comparar ofertas
                </Link>
                <ItemOffersAnchor
                  catalogItemId={listing.catalogItemId}
                  currency={listing.currency}
                />
              </div>
            ) : (
              <p className={styles.regionNote}>
                A API não enviou o item do catálogo vinculado a esta oferta; o item-base e a
                inspeção 3D permanecem indisponíveis até essa leitura voltar.
              </p>
            )}
          </header>
          {assetsPending ? (
            <p aria-live="polite" className={styles.regionNote}>
              Carregando os arquivos aprovados deste item…
            </p>
          ) : null}
          {assetsFailed ? (
            <p className={styles.regionNote} role="status">
              A leitura complementar de arquivos falhou. A página segue apenas com o que o anúncio
              confirmou; nenhuma mídia foi substituída.
            </p>
          ) : null}
        </div>

        <div className={styles.decisionColumn}>
          <PurchasePanel listing={listing} sellerSlot={<SellerSummary listing={listing} />} />
        </div>
      </div>

      {/* Metadados de auditoria (revisão, datas, plano) ficam recolhidos:
          continuam a um clique de distância, mas não disputam a decisão. */}
      <details className={styles.metaStrip}>
        <summary className={styles.metaSummary}>
          <History aria-hidden="true" size={15} /> Procedência do anúncio
        </summary>
        <dl className={styles.metaList}>
          <MetaFact label="Publicado em" value={publishedAt ?? "Data não enviada"} />
          <MetaFact label="Atualizado em" value={updatedAt ?? "Data não enviada"} />
          <MetaFact label="Revisão" value={`v${String(listing.version)}`} />
          <MetaFact
            label="Plano do anúncio"
            value={plan?.displayName || "Não enviado pela API"}
          />
          <MetaFact
            label="Arquivos aprovados"
            value={String(approvedAssets([...assets]).length)}
          />
        </dl>
      </details>

      <ListingTabs assets={assets} item={item} listing={listing} />

      <section aria-label="Confiança e políticas" className={styles.trustStrip}>
        <p>
          <ShieldCheck aria-hidden="true" size={18} />
          <Link className="text-link" href="/seguranca">Regras de proteção e denúncia</Link>
        </p>
        <p>
          <FileText aria-hidden="true" size={18} />
          <Link className="text-link" href="/politicas">Políticas vigentes e versões</Link>
        </p>
        <p>
          <LifeBuoy aria-hidden="true" size={18} />
          <Link className="text-link" href="/ajuda">Central de ajuda</Link>
        </p>
      </section>
    </article>
  );
}

export function ListingPageView({ listingRef }: { listingRef: string }) {
  const listingResource = useApiResource<DetailListing>(
    `/v1/listings/${encodeURIComponent(listingRef)}`,
  );
  const listing = listingResource.status === "ready" ? listingResource.data : undefined;
  const needsAssetFallback = Boolean(listing && listing.assets === undefined);
  const assetResource = useApiResource<PublicCatalogAsset[]>(
    needsAssetFallback && listing
      ? `/v1/catalog/items/${encodeURIComponent(listing.catalogItemId)}/assets?approvalStatus=APPROVED&limit=100`
      : null,
  );

  if (listingResource.status === "error") {
    return (
      <MarketplaceError
        error={listingResource.error}
        retry={listingResource.retry}
        scope="listing"
      />
    );
  }
  if (!listing) return <MarketplaceLoading detail />;

  const assets = listing.assets ?? (assetResource.status === "ready" ? assetResource.data : []);

  return (
    <ListingDetail
      assets={assets}
      assetsFailed={needsAssetFallback && assetResource.status === "error"}
      assetsPending={needsAssetFallback && assetResource.status === "loading"}
      listing={listing}
    />
  );
}
