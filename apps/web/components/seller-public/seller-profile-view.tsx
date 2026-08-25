"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Flag, ShieldCheck, Store, TriangleAlert } from "lucide-react";
import { Button, PageState, Reveal, StatusBadge, Tilt3D } from "@midas/ui";
import { MarketplaceError, MarketplaceLoading } from "@/components/marketplace/marketplace-states";
import type { PublicListing, PublicListingPage } from "@/components/marketplace/types";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest } from "@/lib/api-client";
import { COPY } from "@/lib/copy-deck";
import { SellerListingsGrid } from "./seller-listings-grid";
import {
  SELLER_ACCOUNT_ID_PATTERN,
  SELLER_LISTINGS_ENDPOINT,
  SELLER_PROFILE_CONTRACT,
  SellerReputation,
  derivePublicSummary,
  resolveSellerIdentity,
  sanitizePublicListings,
  type PublicSellerIdentity,
} from "./seller-reputation";
import styles from "./seller-public.module.css";

const PAGE_SIZE = 48;

function listingsPath(sellerAccountId: string, cursor?: string): string {
  const query = new URLSearchParams({
    sellerAccountId,
    limit: String(PAGE_SIZE),
  });
  if (cursor) query.set("cursor", cursor);
  return `/v1/listings?${query.toString()}`;
}

/** Monograma decorativo derivado do nome já aprovado pelo filtro anti-PII. */
function monogram(name: string): string {
  const parts = name.split(/\s+/u).filter((part) => part.length > 0);
  const first = parts[0]?.charAt(0) ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return `${first}${second}`.toLocaleUpperCase("pt-BR");
}

function mergeListings(current: PublicListing[], incoming: PublicListing[]): PublicListing[] {
  const byId = new Map(current.map((listing) => [listing.listingId, listing]));
  for (const listing of incoming) byId.set(listing.listingId, listing);
  return [...byId.values()];
}

function SellerIdentityHeader({ identity }: { identity: PublicSellerIdentity }) {
  const copy = COPY.sellerPublic.header;
  const name = identity.displayName;

  return (
    <Reveal as="section" className={styles.hero} aria-labelledby="seller-title">
      <div className={styles.heroMain}>
        <span className={styles.eyebrow}><Store aria-hidden="true" size={14} /> {copy.kicker}</span>
        {/* h1 = nome público do vendedor. Sem nome publicável, o título diz o
            que a página é, em vez de inventar ou repetir um identificador. */}
        <h1 id="seller-title">{name ?? "Perfil do vendedor"}</h1>
        <p className={styles.heroLead}>{copy.subhead}</p>

        <dl className={styles.heroFacts}>
          <div>
            <dt>Identificador público da conta comercial</dt>
            <dd><code>{identity.sellerAccountId}</code></dd>
          </div>
          <div>
            <dt>O que este perfil mostra</dt>
            <dd>Reputação declarada e ofertas publicadas. Nada além disso.</dd>
          </div>
        </dl>

        {identity.displayNameWithheld ? (
          <p className={styles.withheldNote}>
            <TriangleAlert aria-hidden="true" size={16} />
            <span>
              O nome cadastrado por esta conta contém algo com formato de dado pessoal
              (e-mail, telefone ou documento) e foi retido por esta página. Perfil público não
              publica dado pessoal, nem quando ele chega dentro do nome da loja.
            </span>
          </p>
        ) : null}

        {name === null && !identity.displayNameWithheld ? (
          <p className={styles.withheldNote}>
            <TriangleAlert aria-hidden="true" size={16} />
            <span>
              Nenhum nome público chegou junto dos anúncios desta conta. A projeção pública de
              conta comercial ainda não foi formalizada ({SELLER_PROFILE_CONTRACT}), então esta
              página não tem de onde ler o nome — e não inventa um.
            </span>
          </p>
        ) : null}
      </div>

      {/* Crista decorativa: elemento sem preço e sem ação, único lugar da
          página com inclinação por ponteiro. Desliga em reduced-motion/touch. */}
      <Tilt3D max={6} className={styles.crest} aria-hidden="true">
        <span className={styles.crestMark}>{name === null ? <Store size={30} /> : monogram(name)}</span>
      </Tilt3D>
    </Reveal>
  );
}

function ReportControl({ identity }: { identity: PublicSellerIdentity }) {
  const [open, setOpen] = useState(false);
  const subject = identity.displayName ?? identity.sellerAccountId;

  return (
    <div className={styles.reportArea}>
      <Button
        variant="outline"
        iconBefore={<Flag aria-hidden="true" size={16} />}
        aria-expanded={open}
        aria-controls="seller-report-panel"
        onClick={() => { setOpen((value) => !value); }}
      >
        Denunciar o perfil do vendedor {subject}
      </Button>

      <div id="seller-report-panel" aria-live="polite">
        {open ? (
          <PageState
            kind="unavailable"
            title="Canal de denúncia ainda não publicado"
            description="Nenhum endpoint de denúncia de perfil ou de oferta está publicado na API. Para não perder o relato, envie o caso pela central de ajuda com o identificador público desta conta comercial; a denúncia de uma oferta específica pertence à página do anúncio."
            reference={`${SELLER_PROFILE_CONTRACT} · ${identity.sellerAccountId}`}
            actions={<Link className="button-link" href="/ajuda">Abrir a central de ajuda</Link>}
          />
        ) : null}
      </div>
    </div>
  );
}

function SellerProfile({
  sellerAccountId,
  initialPage,
}: {
  sellerAccountId: string;
  initialPage: PublicListingPage;
}) {
  const [listings, setListings] = useState<PublicListing[]>(
    () => sanitizePublicListings(initialPage.data, sellerAccountId),
  );
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [asOf, setAsOf] = useState(initialPage.asOf);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationError, setPaginationError] = useState<string | null>(null);

  const identity = useMemo(
    () => resolveSellerIdentity(sellerAccountId, initialPage.data),
    [sellerAccountId, initialPage.data],
  );
  const summary = useMemo(() => derivePublicSummary(listings), [listings]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setPaginationError(null);
    try {
      const page = await apiRequest<PublicListingPage>(listingsPath(sellerAccountId, nextCursor));
      setListings((current) => mergeListings(current, sanitizePublicListings(page.data, sellerAccountId)));
      setNextCursor(page.nextCursor);
      if (page.asOf) setAsOf(page.asOf);
    } catch {
      setPaginationError("Não foi possível carregar o restante dos anúncios deste vendedor. Tente novamente.");
    } finally {
      setLoadingMore(false);
    }
  }

  const gridFooter = (
    <div className={styles.loadMore}>
      {paginationError ? <p className={styles.paginationError} role="alert">{paginationError}</p> : null}
      {nextCursor ? (
        <Button
          variant="outline"
          loading={loadingMore}
          loadingLabel="Carregando anúncios"
          onClick={() => { void loadMore(); }}
        >
          Carregar mais anúncios deste vendedor
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className={styles.profile}>
      <nav className={styles.breadcrumb} aria-label="Trilha de navegação">
        <Link href="/market">Marketplace</Link>
        <ChevronRight aria-hidden="true" size={14} />
        <span aria-current="page">{identity.displayName ?? "Perfil do vendedor"}</span>
      </nav>

      <SellerIdentityHeader identity={identity} />

      <div className={styles.trustStrip}>
        <StatusBadge tone="info">Perfil público</StatusBadge>
        <span><ShieldCheck aria-hidden="true" size={15} /> Sem membros, sem PII, sem identificador interno</span>
        <ReportControl identity={identity} />
      </div>

      <SellerReputation
        summary={summary}
        partialCoverage={nextCursor !== null}
        {...(asOf ? { asOf } : {})}
      />

      <SellerListingsGrid
        listings={listings}
        sellerName={identity.displayName}
        footer={gridFooter}
      />
    </div>
  );
}

export function SellerProfileView({ sellerAccountId }: { sellerAccountId: string }) {
  const valid = SELLER_ACCOUNT_ID_PATTERN.test(sellerAccountId);
  const resource = useApiResource<PublicListingPage>(valid ? listingsPath(sellerAccountId) : null);

  if (!valid) {
    return (
      <div className={styles.profile}>
        <PageState
          kind="empty"
          title="Vendedor não encontrado"
          description={`O endereço não corresponde a uma conta comercial: o identificador público segue o formato sac_ seguido de um UUID. Nenhuma consulta foi enviada e nenhum dado foi exibido. Contrato da tela: ${SELLER_PROFILE_CONTRACT}.`}
          actions={<Link className="button-link" href="/market">Voltar ao marketplace</Link>}
          reference={SELLER_LISTINGS_ENDPOINT}
        />
      </div>
    );
  }

  if (resource.status === "error") {
    return (
      <div className={styles.profile}>
        <MarketplaceError error={resource.error} retry={resource.retry} scope="catalog" />
      </div>
    );
  }

  if (resource.status === "ready") {
    return <SellerProfile sellerAccountId={sellerAccountId} initialPage={resource.data} />;
  }

  return (
    <div className={styles.profile}>
      <MarketplaceLoading />
    </div>
  );
}
