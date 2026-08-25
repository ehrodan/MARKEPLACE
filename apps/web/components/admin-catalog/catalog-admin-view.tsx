"use client";

import { useEffect, useMemo, useState, type SubmitEvent } from "react";
import { Box, FileBox, ShieldCheck } from "lucide-react";
import { Button, PageState, Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { StatusLabel } from "@/components/status-label";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError } from "@/lib/api-client";
import type {
  AssetApprovalStatus,
  CatalogAsset,
  CatalogAssetType,
  CatalogItem,
  CatalogItemPage,
  CatalogItemType,
  CatalogRarity,
} from "./catalog-types";
import styles from "./catalog-admin-view.module.css";

const itemTypes: Array<{ value: CatalogItemType; label: string }> = [
  { value: "SKIN", label: "Skin" },
  { value: "WEAPON", label: "Arma" },
  { value: "STICKER", label: "Adesivo" },
  { value: "CASE", label: "Caixa" },
  { value: "KEY", label: "Chave" },
  { value: "OTHER", label: "Outro" },
];

const rarities: Array<{ value: CatalogRarity | ""; label: string }> = [
  { value: "", label: "Sem raridade" },
  { value: "COMMON", label: "Comum" },
  { value: "UNCOMMON", label: "Incomum" },
  { value: "RARE", label: "Rara" },
  { value: "EPIC", label: "Épica" },
  { value: "LEGENDARY", label: "Lendária" },
  { value: "MYTHIC", label: "Mítica" },
  { value: "CONTRABAND", label: "Contrabando" },
];

const assetTypes: Array<{ value: CatalogAssetType; label: string; defaultMime: string }> = [
  { value: "POSTER_2D", label: "Imagem 2D", defaultMime: "image/png" },
  { value: "MODEL_3D_GLB", label: "Modelo 3D GLB", defaultMime: "model/gltf-binary" },
  { value: "MULTI_VIEW", label: "Conjunto multivista", defaultMime: "application/json" },
  { value: "SINGLE_VIEW", label: "Vista única", defaultMime: "image/png" },
];

function messageFrom(error: unknown): string {
  if (isApiError(error)) return error.problem.detail || error.problem.title;
  return error instanceof Error ? error.message : "A operação não foi concluída.";
}

export function normalizeCatalogSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

export function CatalogAdminView({ initialItemId = "" }: { initialItemId?: string }) {
  const items = useApiResource<CatalogItemPage>("/v1/catalog/items?limit=200");
  const [selectedItemId, setSelectedItemId] = useState(initialItemId);
  const assets = useApiResource<CatalogAsset[]>(selectedItemId
    ? `/v1/admin/catalog/items/${encodeURIComponent(selectedItemId)}/assets?limit=100`
    : null);
  const [displayName, setDisplayName] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [gameOrigin, setGameOrigin] = useState("Standoff 2");
  const [itemType, setItemType] = useState<CatalogItemType>("SKIN");
  const [rarity, setRarity] = useState<CatalogRarity | "">("");
  const [creatingItem, setCreatingItem] = useState(false);
  const [itemFeedback, setItemFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [assetType, setAssetType] = useState<CatalogAssetType>("POSTER_2D");
  const [storageUri, setStorageUri] = useState("");
  const [storageProvider, setStorageProvider] = useState<"MINIO" | "S3" | "LOCAL">("MINIO");
  const [fileSizeBytes, setFileSizeBytes] = useState("");
  const [mimeType, setMimeType] = useState("image/png");
  const [isPrimary, setIsPrimary] = useState(true);
  const [creatingAsset, setCreatingAsset] = useState(false);
  const [assetFeedback, setAssetFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [decidingAssetId, setDecidingAssetId] = useState<string | null>(null);

  const catalogItems = items.status === "ready" ? items.data.data : [];
  const selectedItem = useMemo(
    () => catalogItems.find((item) => item.catalogItemId === selectedItemId),
    [catalogItems, selectedItemId],
  );

  useEffect(() => {
    if (catalogItems[0] && !catalogItems.some((item) => item.catalogItemId === selectedItemId)) {
      setSelectedItemId(catalogItems[0].catalogItemId);
    }
  }, [catalogItems, selectedItemId]);

  const updateDisplayName = (value: string) => {
    setDisplayName(value);
    if (!slugTouched) setPublicSlug(normalizeCatalogSlug(value));
  };

  const createItem = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatingItem(true);
    setItemFeedback(null);
    try {
      const created = await apiRequest<CatalogItem>("/v1/admin/catalog/items", {
        method: "POST",
        body: JSON.stringify({
          publicSlug: publicSlug.trim(),
          displayName: displayName.trim(),
          description: description.trim() || undefined,
          gameOrigin: gameOrigin.trim(),
          itemType,
          rarity: rarity || undefined,
        }),
      });
      setDisplayName("");
      setPublicSlug("");
      setSlugTouched(false);
      setDescription("");
      setSelectedItemId(created.catalogItemId);
      setItemFeedback({ tone: "success", text: `${created.displayName} entrou na biblioteca de produtos.` });
      items.retry();
    } catch (error) {
      setItemFeedback({ tone: "error", text: messageFrom(error) });
    } finally {
      setCreatingItem(false);
    }
  };

  const createAsset = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedItemId) return;
    setCreatingAsset(true);
    setAssetFeedback(null);
    try {
      const created = await apiRequest<CatalogAsset>("/v1/catalog/assets", {
        method: "POST",
        body: JSON.stringify({
          catalogItemId: selectedItemId,
          assetType,
          storageUri: storageUri.trim(),
          storageProvider,
          fileSizeBytes: fileSizeBytes.trim(),
          mimeType: mimeType.trim(),
          isPrimary,
        }),
      });
      setStorageUri("");
      setFileSizeBytes("");
      setAssetFeedback({ tone: "success", text: `Artefato ${created.catalogAssetId} registrado para revisão.` });
      assets.retry();
    } catch (error) {
      setAssetFeedback({ tone: "error", text: messageFrom(error) });
    } finally {
      setCreatingAsset(false);
    }
  };

  const decideAsset = async (asset: CatalogAsset, decision: "APPROVE" | "REJECT") => {
    const rejectionReason = decision === "REJECT"
      ? window.prompt("Motivo objetivo da rejeição")?.trim()
      : undefined;
    if (decision === "REJECT" && !rejectionReason) return;
    setDecidingAssetId(asset.catalogAssetId);
    setAssetFeedback(null);
    try {
      await apiRequest<CatalogAsset>(
        `/v1/admin/catalog/assets/${encodeURIComponent(asset.catalogAssetId)}/decide`,
        { method: "POST", body: JSON.stringify({ decision, rejectionReason }) },
      );
      setAssetFeedback({ tone: "success", text: decision === "APPROVE" ? "Artefato aprovado." : "Artefato rejeitado." });
      assets.retry();
    } catch (error) {
      setAssetFeedback({ tone: "error", text: messageFrom(error) });
    } finally {
      setDecidingAssetId(null);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="ADMIN · CATÁLOGO"
        title="Biblioteca de produtos"
        description="Cadastre uma vez. O vendedor escolhe o item real, define preço e publica sem recriar a ficha técnica."
        meta={<span className={styles.guard}><ShieldCheck aria-hidden="true" size={16} /> Permissões verificadas</span>}
      />

      <div className={styles.workspace}>
        <Panel className={styles.formPanel}>
          <div className={styles.panelHeading}>
            <Box aria-hidden="true" size={21} />
            <div><h2>Novo item</h2><p>Crie a referência comercial que poderá receber imagens e modelos aprovados.</p></div>
          </div>
          <form className={styles.form} onSubmit={(event) => { void createItem(event); }}>
            <label>Nome do item<input value={displayName} onChange={(event) => { updateDisplayName(event.target.value); }} maxLength={300} required /></label>
            <label>Slug público<input value={publicSlug} onChange={(event) => { setSlugTouched(true); setPublicSlug(normalizeCatalogSlug(event.target.value)); }} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={200} required /><small>Usado na URL e estável depois da publicação.</small></label>
            <div className={styles.twoColumns}>
              <label>Origem do jogo<input value={gameOrigin} onChange={(event) => { setGameOrigin(event.target.value); }} maxLength={200} required /></label>
              <label>Tipo<select value={itemType} onChange={(event) => { setItemType(event.target.value as CatalogItemType); }}>{itemTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
            <label>Raridade<select value={rarity} onChange={(event) => { setRarity(event.target.value as CatalogRarity | ""); }}>{rarities.map((option) => <option key={option.value || "none"} value={option.value}>{option.label}</option>)}</select></label>
            <label>Descrição<textarea value={description} onChange={(event) => { setDescription(event.target.value); }} maxLength={5000} rows={5} /></label>
            <Button type="submit" loading={creatingItem} loadingLabel="Cadastrando produto">Cadastrar produto</Button>
            {itemFeedback ? <p className={itemFeedback.tone === "error" ? styles.error : styles.success} role={itemFeedback.tone === "error" ? "alert" : "status"}>{itemFeedback.text}</p> : null}
          </form>
        </Panel>

        <section className={styles.library} aria-labelledby="catalog-library-title">
          <div className={styles.libraryHeading}>
            <div><h2 id="catalog-library-title">Itens disponíveis</h2><p>Selecione um item para revisar seus artefatos.</p></div>
            {items.status === "ready" ? <strong>{catalogItems.length}</strong> : null}
          </div>
          {items.status === "loading" || items.status === "idle" ? <ResourceLoading label="Carregando catálogo" /> : null}
          {items.status === "error" ? <ResourceError error={items.error} retry={items.retry} /> : null}
          {items.status === "ready" && !catalogItems.length ? <PageState kind="empty" title="A biblioteca está vazia" description="Cadastre o primeiro item real no formulário ao lado." /> : null}
          {items.status === "ready" && catalogItems.length ? (
            <div className={styles.itemList}>
              {catalogItems.map((item) => (
                <button key={item.catalogItemId} type="button" className={styles.itemButton} data-active={item.catalogItemId === selectedItemId || undefined} onClick={() => { setSelectedItemId(item.catalogItemId); setAssetFeedback(null); }}>
                  <span><strong>{item.displayName}</strong><small>{item.gameOrigin} / {item.itemType}</small></span>
                  <code>{item.publicSlug}</code>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {selectedItem ? (
        <Panel className={styles.assetPanel}>
          <div className={styles.panelHeading}>
            <FileBox aria-hidden="true" size={21} />
            <div><h2>Ativos de {selectedItem.displayName}</h2><p>Registre somente arquivos já armazenados. Publicação exige aprovação explícita.</p></div>
          </div>
          <form className={styles.assetForm} onSubmit={(event) => { void createAsset(event); }}>
            <label>Tipo do ativo<select value={assetType} onChange={(event) => { const next = event.target.value as CatalogAssetType; setAssetType(next); setMimeType(assetTypes.find((entry) => entry.value === next)?.defaultMime ?? "application/octet-stream"); }}>{assetTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>URI do armazenamento<input value={storageUri} onChange={(event) => { setStorageUri(event.target.value); }} placeholder="s3://bucket/chave ou /assets/item.glb" maxLength={2000} required /></label>
            <label>Provedor<select value={storageProvider} onChange={(event) => { setStorageProvider(event.target.value as "MINIO" | "S3" | "LOCAL"); }}><option value="MINIO">MinIO</option><option value="S3">S3</option><option value="LOCAL">Local controlado</option></select></label>
            <label>Tamanho em bytes<input inputMode="numeric" value={fileSizeBytes} onChange={(event) => { setFileSizeBytes(event.target.value.replace(/\D/g, "")); }} pattern="[0-9]+" required /></label>
            <label>MIME type<input value={mimeType} onChange={(event) => { setMimeType(event.target.value); }} maxLength={200} required /></label>
            <label className={styles.check}><input type="checkbox" checked={isPrimary} onChange={(event) => { setIsPrimary(event.target.checked); }} /> Usar como ativo principal após aprovação</label>
            <Button type="submit" loading={creatingAsset} loadingLabel="Registrando ativo">Registrar ativo</Button>
          </form>
          {assetFeedback ? <p className={assetFeedback.tone === "error" ? styles.error : styles.success} role={assetFeedback.tone === "error" ? "alert" : "status"}>{assetFeedback.text}</p> : null}
          <AssetList state={assets} decidingAssetId={decidingAssetId} decideAsset={decideAsset} />
        </Panel>
      ) : null}
    </div>
  );
}

function AssetList({
  state,
  decidingAssetId,
  decideAsset,
}: {
  state: ReturnType<typeof useApiResource<CatalogAsset[]>>;
  decidingAssetId: string | null;
  decideAsset: (asset: CatalogAsset, decision: "APPROVE" | "REJECT") => Promise<void>;
}) {
  if (state.status === "loading" || state.status === "idle") return <ResourceLoading label="Carregando ativos" />;
  if (state.status === "error") return <ResourceError error={state.error} retry={state.retry} />;
  const data = state.data ?? [];
  if (!data.length) return <PageState kind="empty" title="Nenhum ativo registrado" description="Adicione uma imagem 2D ou um modelo 3D já armazenado." />;
  return (
    <div className={styles.assetList}>
      {data.map((asset) => (
        <article className={styles.assetRow} key={asset.catalogAssetId}>
          <div><strong>{asset.assetType}</strong><a href={asset.storageUri} target="_blank" rel="noreferrer">Abrir origem</a><small>{asset.mimeType} / {asset.fileSizeBytes} bytes</small></div>
          <StatusLabel status={asset.approvalStatus} />
          {asset.approvalStatus === "PENDING" ? (
            <div className={styles.actions}>
              <Button size="small" loading={decidingAssetId === asset.catalogAssetId} onClick={() => { void decideAsset(asset, "APPROVE"); }}>Aprovar</Button>
              <Button size="small" variant="outline" disabled={decidingAssetId === asset.catalogAssetId} onClick={() => { void decideAsset(asset, "REJECT"); }}>Rejeitar</Button>
            </div>
          ) : <span className={styles.decision}>{asset.rejectionReason || "Decisão registrada"}</span>}
        </article>
      ))}
    </div>
  );
}

export function isPendingApproval(status: AssetApprovalStatus): boolean { return status === "PENDING"; }
