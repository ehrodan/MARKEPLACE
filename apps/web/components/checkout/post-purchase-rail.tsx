"use client";

import type { PublicListing, PublicListingPage } from "@/components/marketplace/types";
import { RecommendationRail } from "@/components/recommendations/recommendation-rail";
import type { RelatedAnchor } from "@/components/recommendations/related-offers";
import { useApiResource } from "@/hooks/use-api-resource";
import {
  projectPurchasedItems,
  type CheckoutStageCode,
  type OrderDetailEnvelope,
  type PurchasedItemFacts,
} from "./checkout-state";

/**
 * SCR-BUY-003 — rail POST_PURCHASE ("Continue a coleção") no painel de
 * confirmação do checkout.
 *
 * ================= DECISÃO DE MONTAGEM (denylist × pós-conclusão) =================
 * A rota /checkout está em RECOMMENDATION_DENIED_PREFIXES porque checkout é
 * superfície de decisão financeira ativa — "ali a pessoa está decidindo dinheiro
 * e merece silêncio" (components/recommendations/recommendation-rail.tsx). O
 * ponto pós-conclusão legítimo deste fluxo é o painel de confirmação: o estágio
 * SETTLED_BY_WEBHOOK, que só existe depois de o webhook autenticado do provedor
 * confirmar a liquidação (checkout-state.ts §FL-05.5/§FL-11.1). Nesse estágio
 * não resta decisão de dinheiro em aberto nesta tela, então o motivo que
 * justifica a denylist deixou de valer.
 *
 * O gate aqui é por ESTADO, não por rota — e é mais restritivo que o gate por
 * prefixo para o dano que a denylist evita: o rail é estruturalmente
 * inalcançável antes da conclusão porque a montagem exige
 * `stage === "SETTLED_BY_WEBHOOK"`. Pagamento aguardando sessão, sessão aberta,
 * retorno do provedor (CONFIRMING_WITH_PROVIDER — ainda NÃO é conclusão: o
 * webhook não chegou), falha, reserva vencida, quarentena e cancelamento
 * permanecem em silêncio absoluto. Enquanto o gate não passa, nem a leitura de
 * candidatos é feita (o hook recebe `null`).
 *
 * ============================ ORIGEM DOS CANDIDATOS ==============================
 * Mesma mecânica e mesmo endpoint do item-view (components/item/item-view.tsx):
 * `GET /v1/listings?limit=200` + `relatedOffers` (dentro do RecommendationRail).
 * A âncora deriva dos ITENS COMPRADOS: `data.items[].listingSnapshot`, gravado
 * pelo servidor no ato da compra. Cada candidato carrega motivo obrigatório —
 * regra do próprio rail; sem motivo o card não existe.
 *
 * Falha ou carregamento da leitura de anúncios = silêncio, não erro: a
 * recomendação é opcional e um alerta aqui daria a um bloco acessório mais peso
 * que a própria confirmação. Nada é simulado no lugar.
 */

/** Mesmo endpoint usado pelo item-view para o slot ANCHOR_ITEM. */
const LISTINGS_PATH = "/v1/listings?limit=200";

/**
 * Âncora do rail = primeiro item do pedido (ordem enviada pelo servidor,
 * determinística). Preço só entra com a moeda conhecida: minor units sem moeda
 * é número sem unidade e tornaria "faixa de preço parecida" uma afirmação falsa.
 */
export function postPurchaseAnchor(
  purchased: readonly PurchasedItemFacts[],
): RelatedAnchor | null {
  const first = purchased.at(0);
  if (!first) return null;
  return {
    catalogItemId: first.catalogItemId,
    gameOrigin: first.gameOrigin,
    itemType: first.itemType,
    sellerAccountId: first.sellerAccountId,
    priceMinor: first.currency ? first.unitPriceMinor : null,
  };
}

/**
 * Filtra os candidatos ANTES do rail:
 * 1. Nenhum item recém-comprado volta como recomendação — outra oferta do mesmo
 *    item-base não é "continuar a coleção", é recompra. `relatedOffers` só
 *    exclui a âncora; num pedido com vários itens os demais sairiam sem isto.
 * 2. Moeda diferente da compra sai: o teto de preço do `relatedOffers` compara
 *    minor units às cegas, e comparar moedas distintas seria dado falso.
 */
export function postPurchaseCandidates(
  candidates: readonly PublicListing[],
  purchased: readonly PurchasedItemFacts[],
): PublicListing[] {
  const boughtCatalogItems = new Set(purchased.map((item) => item.catalogItemId));
  const purchaseCurrency = purchased[0]?.currency ?? null;
  return candidates.filter((listing) => {
    if (boughtCatalogItems.has(listing.catalogItemId)) return false;
    if (purchaseCurrency && listing.currency !== purchaseCurrency) return false;
    return true;
  });
}

export interface PostPurchaseRailProps {
  /** Estágio resolvido pelo checkout. Só SETTLED_BY_WEBHOOK monta o rail. */
  stage: CheckoutStageCode;
  /** Envelope de `GET /v1/orders/{orderId}`, ou `null` enquanto não lido. */
  orderEnvelope: OrderDetailEnvelope | null;
}

export function PostPurchaseRail({ stage, orderEnvelope }: PostPurchaseRailProps) {
  const settled = stage === "SETTLED_BY_WEBHOOK";
  const purchased = settled ? projectPurchasedItems(orderEnvelope) : [];

  // Antes da conclusão (ou sem item legível no pedido) o caminho é `null`:
  // nenhuma requisição de candidatos é disparada em tela de pagamento ativo.
  const listings = useApiResource<PublicListingPage>(
    purchased.length > 0 ? LISTINGS_PATH : null,
  );

  if (purchased.length === 0) return null;
  if (listings.status !== "ready") return null;

  const anchor = postPurchaseAnchor(purchased);
  if (!anchor) return null;

  // Sem candidato após os filtros, o próprio rail não renderiza (regra dele).
  return (
    <RecommendationRail
      slot="POST_PURCHASE"
      candidates={postPurchaseCandidates(listings.data.data, purchased)}
      anchor={anchor}
    />
  );
}
