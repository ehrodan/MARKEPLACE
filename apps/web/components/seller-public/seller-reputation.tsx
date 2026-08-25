"use client";

import { Boxes, CalendarClock, EyeOff, Layers, ScrollText, ShieldAlert, Tags } from "lucide-react";
import { Freshness, PageState, Reveal, Tilt3D } from "@midas/ui";
import { formatPublicDate, formatQuantity, itemTypeLabel } from "@/components/marketplace/formatters";
import type { PublicListing } from "@/components/marketplace/types";
import { COPY } from "@/lib/copy-deck";
import styles from "./seller-public.module.css";

/**
 * Projeção pública do vendedor (SCR-PUB-007) + estado da reputação.
 *
 * Este módulo concentra as duas responsabilidades de risco da tela:
 * o filtro anti-PII e a recusa de exibir reputação sem fonte canônica.
 * Ambas ficam aqui, em funções puras, para que `seller-reputation.test.tsx`
 * consiga atacá-las diretamente.
 */

/** Formato do id público de conta comercial (`packages/contracts/src/account.ts`). */
export const SELLER_ACCOUNT_ID_PATTERN = /^sac_[0-9a-f-]{36}$/u;

/** Fonte canônica citada em toda superfície honesta desta tela. */
export const SELLER_PROFILE_CONTRACT = "SCR-PUB-007 · docs/07-MAPA-DE-TELAS-E-FLUXOS.md";

/** Único endpoint publicado que alimenta esta tela hoje. */
export const SELLER_LISTINGS_ENDPOINT = "GET /v1/listings?sellerAccountId=";

/* ------------------------------------------------------------------ */
/* FILTRO ANTI-PII                                                     */
/* ------------------------------------------------------------------ */

/**
 * FILTRO ANTI-PII — REQUISITO DE SEGURANÇA, NÃO ESCOLHA ESTÉTICA.
 *
 * O propósito contratado da tela (docs/07-MAPA-DE-TELAS-E-FLUXOS.md,
 * SCR-PUB-007) é "exibir reputação e ofertas públicas do contexto comercial,
 * SEM revelar membros/PII". A página é pública e indexável: qualquer campo
 * pessoal que vazar aqui vaza para a internet inteira.
 *
 * São duas barreiras independentes, ambas explícitas para auditoria:
 *
 * 1. PROJEÇÃO POR ALLOWLIST — nenhum campo do payload chega à tela por
 *    espalhamento de objeto. Só `sellerAccountId` (id público da conta
 *    comercial, que já está na própria URL) e `displayName` são copiados.
 *    Se a API passar a devolver e-mail, telefone, documento, lista de
 *    membros ou `userId` interno, esses campos são descartados por omissão —
 *    sem depender de alguém lembrar de escrever uma regra nova.
 *
 * 2. QUARENTENA DO NOME PÚBLICO — `displayName` é texto livre digitado pelo
 *    vendedor e PODE CONTER PII (gente coloca WhatsApp, e-mail ou CPF no nome
 *    da loja). Um nome que casa com os padrões abaixo é RETIDO: a tela
 *    mostra que existe um nome e que ele foi retido, em vez de publicá-lo.
 *
 * O que esta tela nunca renderiza, por construção: membros da conta, e-mail,
 * telefone, documento, endereço, `userId` e qualquer identificador interno.
 * O único identificador exibido é o id público `sac_…`, que não é PII e já
 * é público por estar na rota.
 */
const PERSONAL_DATA_PATTERNS: readonly RegExp[] = [
  // Endereço de e-mail.
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/iu,
  // Dez ou mais dígitos, com ou sem separadores: telefone, CPF ou CNPJ.
  /(?:\d[\s.\-()]*){10,}/u,
  // Identificador interno de usuário.
  /\b(?:usr|user)_[0-9a-f-]{8,}\b/iu,
  // UUID cru (nenhum id interno deve chegar ao texto visível).
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/iu,
];

/** Verdadeiro quando o texto livre carrega algo que parece dado pessoal. */
export function containsPersonalData(value: string): boolean {
  return PERSONAL_DATA_PATTERNS.some((pattern) => pattern.test(value));
}

export interface PublicSellerIdentity {
  /** Id público da conta comercial (`sac_…`), o mesmo que está na rota. */
  readonly sellerAccountId: string;
  /** Nome público confiável, ou `null` — a tela nunca inventa um nome. */
  readonly displayName: string | null;
  /** Verdadeiro quando existia nome, mas o filtro anti-PII o reteve. */
  readonly displayNameWithheld: boolean;
}

function readDisplayName(seller: unknown): string | null {
  if (typeof seller !== "object" || seller === null) return null;
  const candidate = (seller as { displayName?: unknown }).displayName;
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Projeção por allowlist: recebe o objeto de vendedor cru (tipado como
 * `unknown` de propósito — o filtro não pode confiar no shape declarado) e
 * devolve apenas o que é publicável.
 */
export function toPublicSellerIdentity(sellerAccountId: string, seller: unknown): PublicSellerIdentity {
  const name = readDisplayName(seller);
  if (name === null) {
    return { sellerAccountId, displayName: null, displayNameWithheld: false };
  }
  if (containsPersonalData(name)) {
    return { sellerAccountId, displayName: null, displayNameWithheld: true };
  }
  return { sellerAccountId, displayName: name, displayNameWithheld: false };
}

/** Identidade pública do perfil, lida do primeiro anúncio que é dele mesmo. */
export function resolveSellerIdentity(
  sellerAccountId: string,
  listings: readonly PublicListing[],
): PublicSellerIdentity {
  const owned = listings.find((listing) => listing.sellerAccountId === sellerAccountId);
  return toPublicSellerIdentity(sellerAccountId, owned?.seller);
}

/**
 * Prepara os anúncios que vão para o grid:
 * - descarta o que não pertence à conta pedida (a rota é um perfil, não uma
 *   busca: anúncio de terceiro aqui seria atribuição errada);
 * - troca o objeto `seller` pela projeção allowlist, para que o card não
 *   consiga renderizar nome retido nem campo que a API venha a acrescentar.
 */
export function sanitizePublicListings(
  listings: readonly PublicListing[],
  sellerAccountId: string,
): PublicListing[] {
  return listings
    .filter((listing) => listing.sellerAccountId === sellerAccountId)
    .map((listing) => {
      const identity = toPublicSellerIdentity(listing.sellerAccountId, listing.seller);
      return {
        ...listing,
        seller: identity.displayName === null
          ? null
          : { sellerAccountId: identity.sellerAccountId, displayName: identity.displayName },
      };
    });
}

/* ------------------------------------------------------------------ */
/* RESUMO DERIVADO DOS ANÚNCIOS PÚBLICOS                               */
/* ------------------------------------------------------------------ */

export interface SellerPublicSummary {
  readonly publishedListings: number;
  readonly listingsInStock: number;
  readonly unitsAvailable: number;
  /** Soma de `quantitySold` dos anúncios publicados hoje — cobertura parcial. */
  readonly unitsSoldInPublishedListings: number;
  readonly gameOrigins: readonly string[];
  readonly itemTypes: readonly string[];
  readonly firstPublishedAt: string | null;
  readonly lastPublishedAt: string | null;
}

function extremePublishedAt(
  listings: readonly PublicListing[],
  pick: (candidate: number, current: number) => boolean,
): string | null {
  let bestValue: string | null = null;
  let bestTime: number | null = null;
  for (const listing of listings) {
    if (!listing.publishedAt) continue;
    const time = Date.parse(listing.publishedAt);
    if (Number.isNaN(time)) continue;
    if (bestTime === null || pick(time, bestTime)) {
      bestTime = time;
      bestValue = listing.publishedAt;
    }
  }
  return bestValue;
}

function sortedUnique(values: readonly (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) set.add(value);
  }
  return [...set].sort((first, second) => first.localeCompare(second, "pt-BR"));
}

/**
 * Tudo aqui é contagem sobre o payload público já recebido. Nenhum número é
 * estimado, arredondado para impressionar nem completado quando falta dado.
 */
export function derivePublicSummary(listings: readonly PublicListing[]): SellerPublicSummary {
  return {
    publishedListings: listings.length,
    listingsInStock: listings.filter((listing) => listing.quantityAvailable > 0).length,
    unitsAvailable: listings.reduce((total, listing) => total + listing.quantityAvailable, 0),
    unitsSoldInPublishedListings: listings.reduce((total, listing) => total + listing.quantitySold, 0),
    gameOrigins: sortedUnique(listings.map((listing) => listing.catalogItem?.gameOrigin)),
    itemTypes: sortedUnique(listings.map((listing) => listing.catalogItem?.itemType)),
    firstPublishedAt: extremePublishedAt(listings, (candidate, current) => candidate < current),
    lastPublishedAt: extremePublishedAt(listings, (candidate, current) => candidate > current),
  };
}

/* ------------------------------------------------------------------ */
/* COMPONENTE                                                          */
/* ------------------------------------------------------------------ */

interface DerivedFact {
  readonly id: string;
  readonly icon: typeof Boxes;
  readonly label: string;
  readonly value: string;
  /** Cobertura: o que este número inclui e o que ele não inclui. */
  readonly coverage: string;
}

function buildFacts(summary: SellerPublicSummary): DerivedFact[] {
  const firstPublished = formatPublicDate(summary.firstPublishedAt);
  const lastPublished = formatPublicDate(summary.lastPublishedAt);

  return [
    {
      id: "listings",
      icon: Layers,
      label: "Anúncios publicados nesta página",
      value: formatQuantity(summary.publishedListings),
      coverage: `${formatQuantity(summary.listingsInStock)} com estoque agora. Rascunho, anúncio em revisão e anúncio pausado não entram no catálogo público e não são contados.`,
    },
    {
      id: "units",
      icon: Boxes,
      label: "Unidades disponíveis",
      value: formatQuantity(summary.unitsAvailable),
      coverage: "Soma da quantidade que os anúncios acima declaram em estoque no momento desta leitura.",
    },
    {
      id: "sold",
      icon: ScrollText,
      label: "Unidades vendidas nos anúncios acima",
      value: formatQuantity(summary.unitsSoldInPublishedListings),
      coverage: "Contagem parcial por natureza: só cobre anúncios ainda publicados. Vendas de anúncios encerrados ou removidos não aparecem aqui e este número não é histórico de vendas do vendedor.",
    },
    {
      id: "catalog",
      icon: Tags,
      label: "Tipos de item ofertados",
      value: summary.itemTypes.length > 0
        ? summary.itemTypes.map((value) => itemTypeLabel(value)).join(", ")
        : "Nenhum tipo identificado",
      coverage: summary.gameOrigins.length > 0
        ? `Origem declarada no catálogo: ${summary.gameOrigins.join(", ")}.`
        : "Os anúncios publicados não trazem origem de jogo no catálogo.",
    },
    {
      id: "window",
      icon: CalendarClock,
      label: "Janela de publicação observada",
      value: firstPublished && lastPublished
        ? (firstPublished === lastPublished ? firstPublished : `${firstPublished} — ${lastPublished}`)
        : "Sem data de publicação",
      coverage: "Primeira e última publicação entre os anúncios listados nesta página. Não é a data de abertura da conta comercial.",
    },
  ];
}

export interface SellerReputationProps {
  readonly summary: SellerPublicSummary;
  /** Carimbo devolvido pela API do catálogo. */
  readonly asOf?: string;
  /** Verdadeiro quando ainda há páginas não carregadas (cobertura parcial). */
  readonly partialCoverage: boolean;
}

/**
 * Reputação é o pior lugar possível para preencher lacuna com estimativa:
 * nota inventada em marketplace vira decisão de compra errada. Sem endpoint
 * canônico publicado, esta seção declara a ausência e mostra apenas contagens
 * derivadas do próprio catálogo, cada uma com a cobertura escrita ao lado.
 */
export function SellerReputation({ summary, asOf, partialCoverage }: SellerReputationProps) {
  const copy = COPY.sellerPublic.header;
  const facts = buildFacts(summary);

  return (
    <Reveal as="section" className={styles.reputation} aria-labelledby="seller-reputation-title">
      <header className={styles.sectionHead}>
        <span className={styles.eyebrow}><ShieldAlert aria-hidden="true" size={14} /> {copy.kicker}</span>
        <h2 id="seller-reputation-title">{copy.headline}</h2>
        <p>{copy.body}</p>
      </header>

      <PageState
        kind="unavailable"
        title="Reputação ainda não publicada"
        description="Não existe endpoint de leitura de reputação publicado para esta conta comercial. Enquanto a projeção pública não existir, esta tela não exibe nota, média, distribuição de avaliações, quantidade de vendas concluídas nem tempo de resposta — nenhum desses números seria verificável."
        reference={SELLER_PROFILE_CONTRACT}
      />

      <div className={styles.derivedBlock}>
        <div className={styles.derivedHead}>
          <h3 id="seller-derived-title">O que os anúncios publicados permitem afirmar</h3>
          <p>
            Cada número abaixo é contagem direta de <code>{SELLER_LISTINGS_ENDPOINT}</code>, com a
            cobertura declarada. Nenhum deles é reputação.
          </p>
          {asOf ? <Freshness asOf={asOf} label="Catálogo lido em" /> : null}
        </div>

        {partialCoverage ? (
          <p className={styles.coverageWarning} role="note">
            Esta contagem cobre apenas os anúncios já carregados nesta página. Carregue o restante
            para que os números passem a cobrir o catálogo público inteiro do vendedor.
          </p>
        ) : null}

        <ul className={styles.factList} aria-labelledby="seller-derived-title">
          {facts.map((fact) => {
            const Icon = fact.icon;
            return (
              <li key={fact.id}>
                {/* M2: inclinação discreta em cartão sem preço e sem CTA.
                    A primitiva já desliga sozinha em reduced-motion e touch. */}
                <Tilt3D max={6} className={styles.factCard}>
                  <span className={styles.factIcon}><Icon aria-hidden="true" size={17} /></span>
                  <span className={styles.factLabel}>{fact.label}</span>
                  <strong className={styles.factValue}>{fact.value}</strong>
                  <span className={styles.factCoverage}>{fact.coverage}</span>
                </Tilt3D>
              </li>
            );
          })}
        </ul>

        <p className={styles.privacyNote}>
          <EyeOff aria-hidden="true" size={15} />
          <span>
            Perfil público não expõe membros da conta, e-mail, telefone, documento nem identificador
            interno de usuário. {copy.microcopy}
          </span>
        </p>
      </div>
    </Reveal>
  );
}
