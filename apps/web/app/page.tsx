import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { LandingCatalog } from "@/components/landing/landing-catalog";
import { PublicNav } from "@/components/landing/public-nav";
import { StorefrontFooter } from "@/components/landing/storefront-footer";
import { StorefrontIntro } from "@/components/landing/storefront-intro";
import { ScrollProgress } from "@midas/ui";

/**
 * SCR-PUB-001 — a home é a LOJA.
 *
 * O contrato do doc 07 para esta tela é "orientar entrada por busca, categoria,
 * P2P ou Midas". A versão de manifesto em cinco seções furava a própria
 * especificação: o primeiro produto só aparecia depois de duas telas. Os quatro
 * concorrentes catalogados em `docs/20` (Nesha, DMarket, CSFloat, GGMax) abrem
 * em vitrine, não em narrativa.
 *
 * Ordem, e o porquê de cada peça:
 *
 *   faixa de garantia .... o que protege a compra, antes de qualquer pedido
 *   nav + busca .......... a entrada por busca que o contrato exige
 *   faixa comercial ...... canais de entrada e proposta em uma dobra curta
 *   vitrine .............. categorias com contagem real e grid de ofertas
 *
 * A home usa movimento leve e progressivo sem baixar WebGL: reveal finito,
 * profundidade 2D e indicador de scroll. O viewer 3D real continua isolado em
 * SCR-PUB-013, como exige `docs/03 §8`, e recebe uma ponte explícita daqui.
 *
 * Nada de urgência fabricada: sem contador, sem estoque falso, sem preço de
 * referência que nunca foi praticado (`docs/03 §10`).
 */
export default function LandingPage() {
  return (
    <div className="landing-page public-commerce-theme">
      <ScrollProgress label="Progresso na vitrine" />
      <AnnouncementBar />
      <PublicNav current="home" />

      <main id="conteudo-principal">
        <StorefrontIntro />
        <LandingCatalog />
      </main>

      <StorefrontFooter />
    </div>
  );
}
