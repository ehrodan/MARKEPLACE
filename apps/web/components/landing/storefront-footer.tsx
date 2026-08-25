import Link from "next/link";
import { BrandWordmark } from "@/components/brand-wordmark";
import { BRAND } from "@/lib/brand";
import styles from "./storefront-footer.module.css";

/**
 * Rodapé da loja em quatro grupos + bloco de marca.
 *
 * HONESTIDADE (docs/03 §10): todo href aponta para rota que existe em
 * `app/` — nada de página "Sobre" fantasma, imprensa ou carreiras que não
 * temos. A missão é uma frase sobre o que o produto FAZ, sem "empresa líder"
 * nem número inventado. Não existe rota /sobre hoje, então o quarto grupo é
 * "Comunidade", com as superfícies reais de ranking, recompensas e mensagens.
 */
const groups = [
  {
    title: "Marketplace",
    links: [
      ["/market", "Todos os anúncios"],
      ["/buscar", "Buscar"],
      ["/midas", "Compre do Midas"],
      ["/vender/novo", "Vender um item"],
    ],
  },
  {
    title: "Conta",
    links: [
      ["/entrar", "Entrar"],
      ["/conta/compras", "Compras"],
      ["/conta/favoritos", "Favoritos"],
      ["/conta/vendas", "Painel de vendas"],
    ],
  },
  {
    title: "Segurança e políticas",
    links: [
      ["/seguranca", "Como a compra funciona"],
      ["/politicas", "Políticas da plataforma"],
      ["/conta/privacidade", "Privacidade e dados"],
      ["/ajuda", "Central de ajuda"],
    ],
  },
  {
    title: "Comunidade",
    links: [
      ["/ranking", "Ranking"],
      ["/recompensas", "Recompensas"],
      ["/mensagens", "Mensagens"],
    ],
  },
] as const;

export function StorefrontFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <BrandWordmark href="/" />
          <p>
            Marketplace de itens digitais com oferta, estoque e origem sempre visíveis.
            O valor converge para quem compra e para quem vende.
          </p>
        </div>

        <nav className={styles.groups} aria-label="Links do rodapé">
          {groups.map((group) => (
            <div className={styles.group} key={group.title}>
              <strong>{group.title}</strong>
              {group.links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
            </div>
          ))}
        </nav>
      </div>
      <div className={styles.legal}>
        <span>© {new Date().getFullYear()} {BRAND.name}</span>
        <span>{BRAND.tagline}</span>
      </div>
    </footer>
  );
}
