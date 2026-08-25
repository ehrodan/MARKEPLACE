"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  ShoppingBag,
  Store,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@midas/ui";
import { BrandWordmark } from "@/components/brand-wordmark";
import {
  notificationsLinkLabel,
  useUnreadNotifications,
} from "@/components/landing/use-unread-notifications";
import { apiRequest } from "@/lib/api-client";
import { AccountProvider, useAccountContext } from "./account-context";
import styles from "./account-shell.module.css";

const personalLinks = [
  { href: "/conta", label: "Visão geral", icon: LayoutDashboard },
  { href: "/conta/compras", label: "Minhas compras", icon: ShoppingBag },
] as const;

const sellerLinks = [
  { href: "/conta/vendas", label: "Vendas", icon: Store },
  { href: "/conta/carteira", label: "Saldo de vendas", icon: WalletCards },
  { href: "/conta/saques", label: "Saques", icon: ReceiptText },
] as const;

type NavigationItem = (typeof personalLinks)[number] | (typeof sellerLinks)[number];

function RailContent({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sellerAccounts, selectedSeller, sellerAccountsStatus, selectSeller } = useAccountContext();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await apiRequest<unknown>("/v1/auth/session", { method: "DELETE" });
    } finally {
      router.replace("/entrar");
      router.refresh();
    }
  }

  function NavigationLink({ item }: { item: NavigationItem }) {
    const Icon = item.icon;
    const active = pathname === item.href;
    const isSellerRoute = sellerLinks.some((entry) => entry.href === item.href);
    const href = selectedSeller && isSellerRoute
      ? `${item.href}?sellerAccountId=${encodeURIComponent(selectedSeller.sellerAccountId)}`
      : item.href;
    return (
      <Link
        className={styles.navLink}
        data-active={active || undefined}
        aria-current={active ? "page" : undefined}
        href={href}
        onClick={onNavigate}
      >
        <Icon aria-hidden="true" size={18} />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      <div className={styles.brandBlock}>
        <BrandWordmark />
        <span className={styles.workspaceLabel}>Central da conta</span>
      </div>
      <nav className={styles.nav} aria-label="Navegação da conta">
        <span className={styles.sectionLabel}>Pessoal</span>
        {personalLinks.map((item) => <NavigationLink item={item} key={item.href} />)}
        {sellerAccounts.length > 0 ? (
          <>
            <span className={styles.sectionLabel}>Operação de venda</span>
            {sellerLinks.map((item) => <NavigationLink item={item} key={item.href} />)}
          </>
        ) : null}
        {sellerAccountsStatus === "ready" && sellerAccounts.length === 0 ? (
          <Link className={styles.navLink} href="/vender/cadastro" onClick={onNavigate}>
            <Store aria-hidden="true" size={18} />
            <span>Começar a vender</span>
          </Link>
        ) : null}
      </nav>
      <div className={styles.footer}>
        {sellerAccounts.length > 0 ? (
          <div className={styles.scope}>
            <label className={styles.contextLabel} htmlFor={mobile ? "seller-scope-mobile" : "seller-scope"}>
              Contexto de venda
            </label>
            <select
              id={mobile ? "seller-scope-mobile" : "seller-scope"}
              value={selectedSeller?.sellerAccountId ?? ""}
              onChange={(event) => { selectSeller(event.target.value); }}
            >
              {sellerAccounts.map((seller) => (
                <option value={seller.sellerAccountId} key={seller.sellerAccountId}>
                  {seller.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <Link className={styles.navLink} href="/" onClick={onNavigate}>
          <BookOpen aria-hidden="true" size={18} />
          <span>Voltar ao marketplace</span>
        </Link>
        <Button
          variant="ghost"
          fullWidth
          loading={loggingOut}
          loadingLabel="Saindo"
          iconBefore={<LogOut aria-hidden="true" size={18} />}
          onClick={() => { void logout(); }}
        >
          Sair da conta
        </Button>
      </div>
    </>
  );
}

/**
 * Sino do topo da conta: o mesmo contrato do sino público (número REAL de não
 * lidas via use-unread-notifications). Sem dado confiável, o sino fica sem
 * badge — nunca inventa contagem. Badge em --color-signal: informação, não
 * ação; o ouro da conta segue reservado à marca e às ações.
 */
function NotificationsBell() {
  const unread = useUnreadNotifications();
  return (
    <Link
      className={styles.topbarBell}
      href="/conta/notificacoes"
      aria-label={notificationsLinkLabel(unread)}
    >
      <Bell aria-hidden="true" size={19} />
      {unread !== null && unread > 0 ? (
        <span
          className={styles.topbarBellBadge}
          aria-hidden="true"
          data-testid="account-notifications-count"
        >
          {unread}
        </span>
      ) : null}
    </Link>
  );
}

function AccountFrame({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { selectedSeller, sellerAccountsStatus } = useAccountContext();
  return (
    <div className={styles.shell}>
      <aside className={`${styles.rail} ${styles.desktopRail}`}>
        <RailContent />
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarStart}>
            <Button
              ref={menuButtonRef}
              className={styles.menuButton}
              size="small"
              variant="ghost"
              aria-label="Abrir navegação da conta"
              aria-haspopup="dialog"
              onClick={() => { dialogRef.current?.showModal(); }}
              iconBefore={<Menu aria-hidden="true" size={20} />}
            >
              Menu
            </Button>
            <div className={styles.route}>
              <span className={styles.routeLabel}>Área autenticada</span>
              <strong>Minha conta</strong>
            </div>
          </div>
          <div className={styles.topbarEnd}>
            <div className={styles.context} aria-live="polite">
              <span className={styles.contextIcon} aria-hidden="true"><Building2 size={17} /></span>
              <div className={styles.contextCopy}>
                <small>Contexto atual</small>
                <strong>
                  {sellerAccountsStatus === "loading"
                    ? "Carregando contexto…"
                    : selectedSeller?.displayName || "Conta pessoal"}
                </strong>
              </div>
            </div>
            <NotificationsBell />
          </div>
        </header>
        <main id="conteudo-principal" className={styles.content}>{children}</main>
      </div>
      <dialog
        ref={dialogRef}
        className={styles.drawer}
        aria-label="Navegação da conta"
        onClose={() => { menuButtonRef.current?.focus(); }}
      >
        <header className={styles.drawerHeader}>
          <strong>Minha conta</strong>
          <Button
            variant="ghost"
            size="small"
            aria-label="Fechar navegação"
            onClick={() => { dialogRef.current?.close(); }}
            iconBefore={<X aria-hidden="true" size={20} />}
          >
            Fechar
          </Button>
        </header>
        <aside className={`${styles.rail} ${styles.drawerRail}`}>
          <RailContent mobile onNavigate={() => { dialogRef.current?.close(); }} />
        </aside>
      </dialog>
    </div>
  );
}

export function AccountShell({ children }: { children: ReactNode }) {
  return <AccountProvider><AccountFrame>{children}</AccountFrame></AccountProvider>;
}
