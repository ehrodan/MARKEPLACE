"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  CircleAlert,
  Flag,
  LockKeyhole,
  Package,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { Button, StatusBadge } from "@midas/ui";
import {
  browserStorage,
  findCartLine,
  parseCartLine,
  readCart,
  upsertCartLine,
  writeCart,
  type StorageLike,
} from "@/components/cart/cart-storage";
import { FavoriteButton } from "@/components/favorites/favorite-button";
import {
  formatMinorCurrency,
  formatQuantity,
  humanizeCode,
  listingTitle,
} from "@/components/marketplace/formatters";
import type { PublicListing, PublicListingPlan } from "@/components/marketplace/types";
import styles from "./listing-detail.module.css";

/**
 * Bloco de decisão de SCR-PUB-006.
 *
 * Ordem de leitura fixada pelo contrato da tela: preço -> disponibilidade ->
 * ação -> taxas -> vendedor -> proteção. O painel recebe o resumo do vendedor
 * por slot para manter essa ordem sem quebrar a região comum do bloco de decisão.
 *
 * Nada aqui estima valor. Toda taxa exibida vem do `listingPlan` enviado pela
 * API; quando a API não envia, a interface diz que não enviou.
 */

/** `serializeListingPlan` (apps/api/src/catalog-routes.ts) publica as duas taxas. */
export interface DetailListingPlan extends PublicListingPlan {
  platformFeeRate?: string | null;
  pspFeeRate?: string | null;
}

export interface DetailListing extends Omit<PublicListing, "listingPlan"> {
  listingPlan?: DetailListingPlan | null;
}

export interface DecimalRate {
  readonly numerator: bigint;
  readonly scale: number;
  readonly source: string;
}

/** `numeric(5, 4)` no schema do catálogo: até 3 inteiros e 4 casas decimais. */
const RATE_PATTERN = /^(\d{1,3})(?:\.(\d{1,6}))?$/u;

export function parseRate(raw: string | null | undefined): DecimalRate | null {
  if (typeof raw !== "string") return null;
  const source = raw.trim();
  const match = RATE_PATTERN.exec(source);
  if (!match) return null;
  const [, whole = "0", fraction = ""] = match;
  return { numerator: BigInt(`${whole}${fraction}`), scale: fraction.length, source };
}

export function parseMinorUnits(raw: string): bigint | null {
  return /^\d+$/u.test(raw) ? BigInt(raw) : null;
}

/** Aplica a taxa em BigInt puro, arredondamento half-up. Dinheiro nunca vira Number. */
export function applyRate(amountMinor: bigint, rate: DecimalRate): bigint {
  const divisor = 10n ** BigInt(rate.scale);
  return (amountMinor * rate.numerator + divisor / 2n) / divisor;
}

export function formatRatePercent(rate: DecimalRate): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(rate.source));
}

export interface FeeLine {
  readonly id: string;
  readonly label: string;
  readonly percent: string;
  readonly amountMinor: string;
}

export interface FeeBreakdown {
  readonly buyerTotalMinor: string;
  readonly lines: readonly FeeLine[];
}

/**
 * Composição da taxa. Doc 01 RF-248 e doc 13 secao 688: o percentual do plano é
 * taxa de serviço deduzida do repasse do vendedor, não um acréscimo ao
 * comprador. A tela mostra a conta inteira exatamente por isso: o total do
 * comprador continua sendo o preço publicado.
 */
export function buildFeeBreakdown(listing: DetailListing): FeeBreakdown | null {
  const priceMinor = parseMinorUnits(listing.priceMinor);
  if (priceMinor === null) return null;

  const plan = listing.listingPlan ?? null;
  const lines: FeeLine[] = [];
  const platformRate = parseRate(plan?.platformFeeRate);
  if (platformRate) {
    lines.push({
      id: "platform",
      label: "Taxa da venda (plano do anúncio)",
      percent: formatRatePercent(platformRate),
      amountMinor: applyRate(priceMinor, platformRate).toString(),
    });
  }
  const pspRate = parseRate(plan?.pspFeeRate);
  if (pspRate) {
    lines.push({
      id: "psp",
      label: "Taxa do provedor de pagamento",
      percent: formatRatePercent(pspRate),
      amountMinor: applyRate(priceMinor, pspRate).toString(),
    });
  }

  if (lines.length === 0) return null;
  return { buyerTotalMinor: listing.priceMinor, lines };
}

/**
 * Escassez honesta (docs/03 secao 10, RF-279): abaixo deste teto o estoque REAL
 * do banco ganha tom de aviso com o número exato. O valor exibido é sempre
 * `quantityAvailable` como veio da API — nunca contador fabricado nem cronômetro.
 */
export const LOW_STOCK_THRESHOLD = 5;

export type PurchaseState =
  | { readonly kind: "open" }
  | { readonly kind: "blocked"; readonly reason: string };

export function resolvePurchaseState(listing: DetailListing): PurchaseState {
  if (listing.pausedAt) {
    return {
      kind: "blocked",
      reason:
        "Esta oferta está pausada pelo vendedor. A compra volta a ficar disponível quando o anúncio for republicado.",
    };
  }
  if (listing.listingStatus !== "PUBLISHED") {
    return {
      kind: "blocked",
      reason: `A oferta está com status ${humanizeCode(listing.listingStatus)} e só aceita compra enquanto estiver publicada.`,
    };
  }
  if (listing.quantityAvailable <= 0) {
    return {
      kind: "blocked",
      reason:
        "Não há unidade disponível neste anúncio. Nenhuma reserva é criada enquanto o vendedor não repuser o estoque.",
    };
  }
  return { kind: "open" };
}

/**
 * O aviso de reposição só faz sentido quando a oferta pode voltar: estoque
 * zerado ou pausa do vendedor. O opt-in do aviso NÃO mora aqui — mora em
 * /conta/favoritos (WIRING-favoritos §3: consentimento explícito, nada
 * pré-marcado). Esta página apenas aponta o caminho real.
 */
export function showsRestockWatchHint(listing: DetailListing): boolean {
  return Boolean(listing.pausedAt) || listing.quantityAvailable <= 0;
}

export type CartPersistenceResult =
  | { readonly kind: "stored" }
  | { readonly kind: "blocked"; readonly reason: string };

/**
 * Persiste só a fotografia pública que o carrinho precisa para revalidar a oferta.
 * Pedido, reserva, PSP e liquidação continuam fora desta página.
 */
export function persistListingInCart(
  listing: DetailListing,
  storage: StorageLike | null,
  addedAt: string,
): CartPersistenceResult {
  const line = parseCartLine({
    listingId: listing.listingId,
    publicSlug: listing.publicSlug,
    title: listingTitle(listing),
    sellerAccountId: listing.sellerAccountId,
    ...(listing.seller?.displayName ? { sellerDisplayName: listing.seller.displayName } : {}),
    unitPriceMinor: listing.priceMinor,
    currency: listing.currency,
    quantity: 1,
    addedAt,
  });

  if (!line) {
    return {
      kind: "blocked",
      reason: "Os dados publicados desta oferta não formam uma linha de carrinho válida. Atualize a página e tente novamente.",
    };
  }

  const current = readCart(storage);
  if (current.issue === "UNAVAILABLE") {
    return {
      kind: "blocked",
      reason: "O armazenamento local está indisponível. Permita o uso de dados neste navegador e tente novamente.",
    };
  }

  const written = writeCart(storage, upsertCartLine(current.lines, line));
  const persisted = findCartLine(written.lines, listing.listingId);
  if (written.issue === "TRIMMED") {
    // A escolha nova nunca justifica descartar silenciosamente outra linha.
    writeCart(storage, current.lines);
    return {
      kind: "blocked",
      reason: "O carrinho deste dispositivo atingiu o limite. Remova um item no carrinho e tente novamente.",
    };
  }
  if (written.issue === "UNAVAILABLE" || written.issue === "QUOTA" || !persisted) {
    return {
      kind: "blocked",
      reason: "Não foi possível guardar este item no dispositivo. Libere espaço ou permita o armazenamento local e tente novamente.",
    };
  }

  return { kind: "stored" };
}

export interface PurchasePanelProps {
  listing: DetailListing;
  /** Resumo público do vendedor, renderizado dentro da região de decisão. */
  sellerSlot: ReactNode;
}

export function PurchasePanel({
  listing,
  sellerSlot,
}: PurchasePanelProps) {
  const router = useRouter();
  const baseId = useId();
  const priceHeadingId = `${baseId}-preco`;
  const purchaseNoteId = `${baseId}-compra-motivo`;
  const feeNoteId = `${baseId}-taxa-nota`;
  const [cartError, setCartError] = useState<string | null>(null);
  const [openingCart, setOpeningCart] = useState(false);

  const fees = buildFeeBreakdown(listing);
  const state = resolvePurchaseState(listing);
  const available = listing.quantityAvailable;
  const inStock = available > 0;
  const lowStock = inStock && available <= LOW_STOCK_THRESHOLD;

  function handleAddToCart() {
    setCartError(null);
    setOpeningCart(true);
    const result = persistListingInCart(listing, browserStorage(), new Date().toISOString());
    if (result.kind === "blocked") {
      setCartError(result.reason);
      setOpeningCart(false);
      return;
    }
    router.push("/carrinho");
  }

  return (
    <section aria-labelledby={priceHeadingId} className={styles.decisionPanel}>
      <div className={styles.priceRegion}>
        <h2 className={styles.regionLabel} id={priceHeadingId}>Preço desta oferta</h2>
        {/* O preço nunca anima: sem transição, sem contagem, sem entrada. */}
        <p className={styles.priceValue}>
          {formatMinorCurrency(listing.priceMinor, listing.currency)}
        </p>
        {/* Prova real de tração, junto do preço: `quantitySold` vem do banco.
            Zero venda não vira linha — omitir zero não é inventar dado. */}
        {listing.quantitySold > 0 ? (
          <p className={styles.soldProof}>
            <BadgeCheck aria-hidden="true" size={14} />
            <span>
              {formatQuantity(listing.quantitySold)}{" "}
              {listing.quantitySold === 1 ? "unidade vendida" : "unidades vendidas"} neste anúncio
            </span>
          </p>
        ) : null}
        <p className={styles.priceMeta}>Valor total do comprador em {listing.currency}.</p>
      </div>

      <div className={styles.availabilityRegion}>
        <h3 className={styles.regionLabel}>Disponibilidade</h3>
        <p className={styles.availabilityValue}>
          <Package aria-hidden="true" size={18} />
          <StatusBadge tone={inStock && !lowStock ? "success" : "warning"}>
            {!inStock
              ? "Sem unidade disponível"
              : `${lowStock ? "Só " : ""}${formatQuantity(available)} ${available === 1 ? "unidade disponível" : "unidades disponíveis"}`}
          </StatusBadge>
        </p>
      </div>

      <div className={styles.actionRegion}>
        <h3 className={styles.regionLabel}>Continuar compra</h3>

        {state.kind === "open" ? (
          <Button
            className={styles.primaryAction}
            fullWidth
            iconBefore={<ShoppingCart aria-hidden="true" size={18} />}
            loading={openingCart}
            loadingLabel="Abrindo carrinho"
            onClick={handleAddToCart}
            size="large"
          >
            Adicionar ao carrinho
          </Button>
        ) : (
          <>
            <Button
              aria-describedby={purchaseNoteId}
              className={styles.primaryAction}
              disabled
              fullWidth
              iconBefore={<LockKeyhole aria-hidden="true" size={18} />}
              size="large"
            >
              Adicionar ao carrinho
            </Button>
            <p className={styles.blockedNote} id={purchaseNoteId}>
              <CircleAlert aria-hidden="true" size={16} />
              <span>{state.reason}</span>
            </p>
          </>
        )}
        {/* Costura de WIRING-favoritos.md secao 2: uma chamada por clique nas
            funções puras do storage, sem aviso ligado por efeito colateral.
            Disponível também com a compra bloqueada — salvar item esgotado é
            exatamente o caso de uso da watchlist. */}
        <div className={styles.favoriteRow}>
          <FavoriteButton
            listing={{
              listingId: listing.listingId,
              publicSlug: listing.publicSlug,
              title: listingTitle(listing),
              priceMinor: listing.priceMinor,
              currency: listing.currency,
            }}
            variant="labeled"
          />
        </div>
        {/* WIRING-favoritos §3: nenhum opt-in é criado aqui — o consentimento
            do aviso mora em /conta/favoritos, desligado por padrão. */}
        {showsRestockWatchHint(listing) ? (
          <p className={styles.watchHint}>
            <Bell aria-hidden="true" size={15} />
            <span>
              Salve nos favoritos e ative o aviso de reposição em{" "}
              <Link className="text-link" href="/conta/favoritos">Favoritos</Link>.
            </span>
          </p>
        ) : null}
        {cartError ? (
          <p className={styles.blockedNote} role="alert">
            <CircleAlert aria-hidden="true" size={16} />
            <span>{cartError}</span>
          </p>
        ) : state.kind === "open" ? (
          <p className={styles.actionNote}>
            O carrinho revalida preço, estoque e total antes do pedido.
          </p>
        ) : null}
      </div>

      <details className={styles.feeDisclosure}>
        <summary className={styles.feeSummary}>
          <span>Taxas e total</span>
          <strong>{formatMinorCurrency(listing.priceMinor, listing.currency)}</strong>
        </summary>
        <div className={styles.feeRegion}>
          <h3 className={styles.regionLabel}>Composição da taxa</h3>
          {fees ? (
            <>
              <dl aria-describedby={feeNoteId} className={styles.feeList}>
                <div className={styles.feeRow}>
                  <dt>Preço do item</dt>
                  <dd>{formatMinorCurrency(listing.priceMinor, listing.currency)}</dd>
                </div>
                {fees.lines.map((line) => (
                  <div className={styles.feeRow} key={line.id}>
                    <dt>
                      {line.label} <span className={styles.feePercent}>{line.percent}</span>
                    </dt>
                    <dd>{formatMinorCurrency(line.amountMinor, listing.currency)}</dd>
                  </div>
                ))}
                <div className={`${styles.feeRow} ${styles.feeTotalRow}`}>
                  <dt>Total que você paga</dt>
                  <dd>{formatMinorCurrency(fees.buyerTotalMinor, listing.currency)}</dd>
                </div>
              </dl>
              <p className={styles.regionNote} id={feeNoteId}>
                Taxas deduzidas do repasse do vendedor, nunca somadas ao seu pagamento.
                Percentuais vêm do plano enviado pela API.
              </p>
            </>
          ) : (
            <p className={styles.regionNote}>
              A API não enviou as taxas deste plano e nada foi estimado: você paga exatamente o
              preço publicado acima.
            </p>
          )}
        </div>
      </details>

      {sellerSlot}

      <div className={styles.protectionRegion}>
        <h3 className={styles.regionLabel}>
          <ShieldCheck aria-hidden="true" size={17} /> Proteção e prazos
        </h3>
        <p className={styles.regionNote}>
          Pagamento, custódia e liquidação só avançam com resposta real dos contratos
          financeiros; nada aqui é simulado.
        </p>
        <div className={styles.protectionLinks}>
          <Link className="text-link" href="/seguranca">Como a compra é protegida</Link>
          <Link className="text-link" href="/seguranca">
            <Flag aria-hidden="true" size={15} /> Denunciar este anúncio
          </Link>
        </div>
      </div>
    </section>
  );
}
