import Link from "next/link";
import { BrandWordmark } from "@/components/brand-wordmark";
import { BRAND } from "@/lib/brand";
import styles from "./storefront-footer.module.css";

const groups = [
  {
    title: "Comprar",
    links: [["/market", "Marketplace"], ["/buscar", "Buscar"], ["/carrinho", "Carrinho"]],
  },
  {
    title: "Minha conta",
    links: [["/entrar", "Entrar"], ["/conta/compras", "Compras"], ["/conta/vendas", "Vendas"]],
  },
  {
    title: "Confiança",
    links: [["/seguranca", "Compra segura"], ["/politicas", "Políticas"], ["/ajuda", "Ajuda"]],
  },
] as const;

export function StorefrontFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <BrandWordmark href="/" />
          <p>Marketplace de itens digitais com oferta, estoque e origem visíveis.</p>
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
