import Link from "next/link";
import {
  Gem,
  Heart,
  House,
  MessageCircle,
  Search,
  Store,
  UserRound,
} from "lucide-react";
import { BrandWordmark } from "@/components/brand-wordmark";
import { NavCartLink } from "./nav-cart-link";
import { NavNotificationsLink } from "./nav-notifications-link";
import styles from "./public-nav.module.css";

type PublicSection = "home" | "market";

// "Vender" ganha presença própria (outline), mas nunca o ouro sólido: o
// preenchimento dourado segue exclusivo da ação primária de compra/busca.
const primaryLinks = [
  { href: "/market", label: "Marketplace", emphasis: false },
  { href: "/midas", label: "Compre do Midas", emphasis: false },
  { href: "/vender/novo", label: "Vender", emphasis: true },
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
              {/* Favoritos fica em primeiro: é o link que a media query móvel
                  esconde, preservando Sino (não lidas), Carrinho (contagem) e
                  Conta. Decisão registrada: no móvel Favoritos continua
                  alcançável por /conta, e a barra inferior fica com 5 itens —
                  sino ou favoritos como 6º/7º item poluiriam a navegação. */}
              <Link href="/conta/favoritos" aria-label="Favoritos">
                <Heart aria-hidden="true" size={19} />
                <span className={styles.actionLabel}>Favoritos</span>
              </Link>
              <NavNotificationsLink />
              <NavCartLink />
              <Link className={styles.account} href="/conta" aria-label="Conta">
                <UserRound aria-hidden="true" size={18} />
                <span className={styles.actionLabel}>Conta</span>
              </Link>
            </nav>
          </div>

          <div className={styles.secondaryRow}>
            <nav className={styles.primaryNav} aria-label="Navegação do marketplace">
              {primaryLinks.map((link) => (
                <Link
                  href={link.href}
                  key={link.href}
                  className={link.emphasis ? styles.sellLink : undefined}
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
