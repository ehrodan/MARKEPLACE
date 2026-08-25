import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/landing/announcement-bar";
import { PublicNav } from "@/components/landing/public-nav";
import { StorefrontFooter } from "@/components/landing/storefront-footer";
import styles from "./marketplace.module.css";

export function MarketplaceShell({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.shell} public-commerce-theme`}>
      <AnnouncementBar />
      <PublicNav current="market" />
      <main id="conteudo-principal" className={styles.main}>{children}</main>
      <StorefrontFooter />
    </div>
  );
}
