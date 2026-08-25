"use client";

import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Box, FileText, MessageSquare, ScrollText } from "lucide-react";
import { PageState } from "@midas/ui";
import {
  approvedAssets,
  assetTypeLabel,
  craftQualityLabel,
  formatPublicDate,
  itemTypeLabel,
  rarityLabel,
} from "@/components/marketplace/formatters";
import type { PublicCatalogAsset, PublicCatalogItem, PublicListing } from "@/components/marketplace/types";
import styles from "./listing-detail.module.css";

/**
 * Abas de detalhe de SCR-PUB-006: descrição, inspeção e perguntas.
 *
 * Não existe aba de histórico de preço: `GET /v1/prices/items/{id}/candles`
 * ainda não é publicado por esta API, e um gráfico sem fonte seria número
 * inventado. Perguntas existe como contrato e declara honestamente que a
 * capability não está publicada.
 *
 * Padrão WAI-ARIA Tabs: `tablist`/`tab`/`tabpanel`, roving tabindex, setas com
 * ativação automática, Home/End, e painel focalizável.
 */

type TabId = "descricao" | "inspecao" | "perguntas";

interface TabDefinition {
  readonly id: TabId;
  readonly label: string;
  readonly icon: ReactNode;
}

const TABS: readonly TabDefinition[] = [
  { id: "descricao", label: "Descrição", icon: <FileText aria-hidden="true" size={16} /> },
  { id: "inspecao", label: "Inspeção", icon: <Box aria-hidden="true" size={16} /> },
  { id: "perguntas", label: "Perguntas", icon: <MessageSquare aria-hidden="true" size={16} /> },
];

function formatBytes(raw: string): string {
  if (!/^\d+$/u.test(raw)) return `${raw} bytes`;
  return `${new Intl.NumberFormat("pt-BR").format(BigInt(raw))} bytes`;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export interface ListingTabsProps {
  listing: PublicListing;
  item: PublicCatalogItem | null;
  assets: readonly PublicCatalogAsset[];
}

export function ListingTabs({ listing, item, assets }: ListingTabsProps) {
  const baseId = useId();
  const headingId = `${baseId}-abas`;
  const [active, setActive] = useState<TabId>("descricao");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    const target = TABS.at(next);
    if (!target) return;
    event.preventDefault();
    setActive(target.id);
    tabRefs.current[next]?.focus();
  }, []);

  const visibleAssets = approvedAssets([...assets]);
  const description = item?.description?.trim();
  const conditionNotes = listing.conditionNotes?.trim();

  return (
    <section aria-labelledby={headingId} className={styles.tabsSection}>
      <h2 className={styles.sectionTitle} id={headingId}>Detalhe verificável</h2>

      <div aria-labelledby={headingId} className={styles.tablist} role="tablist">
        {TABS.map((tab, index) => (
          <button
            aria-controls={`${baseId}-painel-${tab.id}`}
            aria-selected={active === tab.id}
            className={`${styles.tab} ${active === tab.id ? styles.tabActive : ""}`.trim()}
            id={`${baseId}-aba-${tab.id}`}
            key={tab.id}
            onClick={() => { setActive(tab.id); }}
            onKeyDown={(event) => { onKeyDown(event, index); }}
            ref={(node) => { tabRefs.current[index] = node; }}
            role="tab"
            tabIndex={active === tab.id ? 0 : -1}
            type="button"
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div
        aria-labelledby={`${baseId}-aba-descricao`}
        className={styles.tabPanel}
        hidden={active !== "descricao"}
        id={`${baseId}-painel-descricao`}
        role="tabpanel"
        tabIndex={0}
      >
        {description ? (
          <p className={styles.prose}>{description}</p>
        ) : (
          <p className={styles.regionNote}>
            O item do catálogo não traz descrição publicada. Nenhum texto de venda foi gerado para
            ocupar o lugar dela.
          </p>
        )}
        <h3 className={styles.blockTitle}>
          <ScrollText aria-hidden="true" size={16} /> Observações de condição
        </h3>
        {conditionNotes ? (
          <p className={styles.prose}>{conditionNotes}</p>
        ) : (
          <p className={styles.regionNote}>
            O vendedor não publicou observações adicionais de condição para esta oferta.
          </p>
        )}
      </div>

      <div
        aria-labelledby={`${baseId}-aba-inspecao`}
        className={styles.tabPanel}
        hidden={active !== "inspecao"}
        id={`${baseId}-painel-inspecao`}
        role="tabpanel"
        tabIndex={0}
      >
        <dl className={styles.factList}>
          <Fact label="Jogo de origem">{item?.gameOrigin || "Não enviado pela API"}</Fact>
          <Fact label="Tipo">{item ? itemTypeLabel(item.itemType) : "Não enviado pela API"}</Fact>
          <Fact label="Raridade">{item?.rarity ? rarityLabel(item.rarity) : "Não publicada"}</Fact>
          <Fact label="Qualidade de craft">
            {item?.craftQuality ? craftQualityLabel(item.craftQuality) : "Não publicada"}
          </Fact>
          <Fact label="Item do catálogo"><code>{listing.catalogItemId}</code></Fact>
          <Fact label="Anúncio"><code>{listing.listingId}</code></Fact>
          <Fact label="Slug público"><code>{listing.publicSlug}</code></Fact>
          <Fact label="Revisão publicada">v{listing.version}</Fact>
        </dl>

        <h3 className={styles.blockTitle}>
          <Box aria-hidden="true" size={16} /> Arquivos aprovados ({visibleAssets.length})
        </h3>
        {visibleAssets.length > 0 ? (
          <ul className={styles.assetList}>
            {visibleAssets.map((asset) => {
              const approvedAt = formatPublicDate(asset.approvedAt);
              return (
                <li key={asset.catalogAssetId}>
                  <strong>{assetTypeLabel(asset.assetType)}</strong>
                  <span>
                    {asset.mimeType} / {formatBytes(asset.fileSizeBytes)}
                    {asset.widthPixels && asset.heightPixels
                      ? ` / ${String(asset.widthPixels)}x${String(asset.heightPixels)} px`
                      : ""}
                  </span>
                  {approvedAt ? <small>Aprovado em {approvedAt}</small> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.regionNote}>
            Nenhum arquivo aprovado foi publicado para este item.
          </p>
        )}
      </div>

      <div
        aria-labelledby={`${baseId}-aba-perguntas`}
        className={styles.tabPanel}
        hidden={active !== "perguntas"}
        id={`${baseId}-painel-perguntas`}
        role="tabpanel"
        tabIndex={0}
      >
        <PageState
          description="A API desta versão não publica perguntas e respostas do anúncio. Nenhuma pergunta de exemplo é exibida, e a contagem no rótulo da aba permanece ausente até existir fonte."
          kind="unavailable"
          title="Perguntas ainda não publicadas"
        />
      </div>
    </section>
  );
}
