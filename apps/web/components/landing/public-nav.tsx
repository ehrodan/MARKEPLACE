import Link from "next/link";
import {
  Gem,
  House,
  MessageCircle,
  Search,
  ShoppingBag,
  Store,
  UserRound,
} from "lucide-react";
import { BrandWordmark } from "@/components/brand-wordmark";
import styles from "./public-nav.module.css";

type PublicSection = "home" | "market";

const primaryLinks = [
  { href: "/market", label: "Marketplace" },
  { href: "/midas", label: "Compre do Midas" },
  { href: "/vender/novo", label: "Vender" },
] as const;

const mobileLinks = [
  { href: "/", label: "Início", icon: House, section: "home" },
  { href: "/market", label: "Market", icon: Store, section: "market" },
  { href: "/midas", label: "Midas", icon: Gem, section: null },
  { href: "/mensagens", label: "Mensagens", icon: MessageCircle, section: null },
  { href: "/conta", label: "Conta", icon: UserRound, section: null },
] as const;

export function PublicNav({ current = "home" }: { current?: PublicSection }) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <div className={styles.primaryRow}>
            <BrandWordmark href="/" />

            <form className={styles.search} action="/buscar" method="get" role="search">
              <Search aria-hidden="true" size={18} />
              <label className="ui-visually-hidden" htmlFor="public-search">
                Buscar no marketplace
              </label>
              <input
                id="public-search"
                name="q"
                type="search"
                placeholder="Busque por item, jogo ou vendedor"
                autoComplete="off"
              />
              <button type="submit">Buscar</button>
            </form>

            <nav className={styles.actions} aria-label="Ações da conta">
              <Link href="/carrinho" aria-label="Abrir carrinho">
                <ShoppingBag aria-hidden="true" size={19} />
                <span>Carrinho</span>
              </Link>
              <Link className={styles.account} href="/conta">
                <UserRound aria-hidden="true" size={18} />
                <span>Conta</span>
              </Link>
            </nav>
          </div>

          <div className={styles.secondaryRow}>
            <nav className={styles.primaryNav} aria-label="Navegação do marketplace">
              {primaryLinks.map((link) => (
                <Link
                  href={link.href}
                  key={link.href}
                  aria-current={current === "market" && link.href === "/market" ? "page" : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className={styles.secondaryActions}>
              <Link href="/mensagens">Mensagens</Link>
              <Link href="/seguranca">Como a compra funciona</Link>
            </div>
          </div>
        </div>
      </header>

      <nav className={styles.mobileNav} aria-label="Navegação principal móvel">
        {mobileLinks.map(({ href, label, icon: Icon, section }) => (
          <Link
            href={href}
            key={href}
            aria-current={section === current ? "page" : undefined}
          >
            <Icon aria-hidden="true" size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
