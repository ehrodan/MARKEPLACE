"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ListChecks, Plus, Store } from "lucide-react";
import { AccountProvider, useAccountContext } from "@/components/account/account-context";
import { SellerScopeGate } from "@/components/account/seller-scope-gate";
import { BrandWordmark } from "@/components/brand-wordmark";
import styles from "./seller-listings.module.css";

type WorkspaceSection = "new" | "list";

function WorkspaceFrame({
  children,
  current,
}: {
  children: ReactNode;
  current: WorkspaceSection;
}) {
  const {
    sellerAccounts,
    selectedSeller,
    sellerAccountsStatus,
    selectSeller,
  } = useAccountContext();
  const scopeQuery = selectedSeller
    ? `?sellerAccountId=${encodeURIComponent(selectedSeller.sellerAccountId)}`
    : "";

  return (
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <BrandWordmark />
        <nav className={styles.navigation} aria-label="Área do vendedor">
          <Link
            href={`/vender/novo${scopeQuery}`}
            aria-current={current === "new" ? "page" : undefined}
          >
            <Plus aria-hidden="true" size={17} />
            Novo anúncio
          </Link>
          <Link
            href={`/vender/anuncios${scopeQuery}`}
            aria-current={current === "list" ? "page" : undefined}
          >
            <ListChecks aria-hidden="true" size={17} />
            Meus anúncios
          </Link>
        </nav>
        <Link className={styles.accountLink} href="/conta" aria-label="Abrir minha conta">
          <ArrowLeft aria-hidden="true" size={16} />
          <span>Minha conta</span>
        </Link>
      </header>

      <div className={styles.contextBar}>
        <div className={styles.contextIdentity}>
          <span aria-hidden="true"><Store size={18} /></span>
          <div>
            <small>Loja selecionada</small>
            <strong>
              {sellerAccountsStatus === "loading"
                ? "Carregando…"
                : selectedSeller?.displayName ?? "Nenhuma loja"}
            </strong>
          </div>
        </div>
        {sellerAccounts.length > 0 ? (
          <div className={styles.scopeField}>
            <label htmlFor="seller-listings-scope">Vender pela loja</label>
            <select
              id="seller-listings-scope"
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
      </div>

      <main id="conteudo-principal" className={styles.main}>
        <SellerScopeGate>{children}</SellerScopeGate>
      </main>
    </div>
  );
}

export function SellerWorkspace({
  children,
  current,
}: {
  children: ReactNode;
  current: WorkspaceSection;
}) {
  return (
    <AccountProvider>
      <WorkspaceFrame current={current}>{children}</WorkspaceFrame>
    </AccountProvider>
  );
}

export function SellerWorkspaceFallback({ label }: { label: string }) {
  return (
    <main className={styles.fallback} aria-busy="true" aria-label={label}>
      <span />
      <p>{label}…</p>
    </main>
  );
}
