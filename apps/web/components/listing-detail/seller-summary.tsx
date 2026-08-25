import Link from "next/link";
import { ArrowUpRight, Store } from "lucide-react";
import { shortIdentifier } from "@/components/marketplace/formatters";
import type { PublicListing } from "@/components/marketplace/types";
import styles from "./listing-detail.module.css";

/**
 * Resumo público do vendedor (SCR-PUB-006 -> SCR-PUB-007).
 *
 * Sem PII: apenas o nome público do contexto comercial e o identificador
 * público do `SellerAccount`. Membros, contato e documento nunca aparecem.
 *
 * Reputação: não existe projeção publicada. A tela diz isso em vez de estimar
 * nota, percentual de aprovação ou número de vendas do vendedor — dado social
 * fabricado é exatamente o que doc 03 secao 10 proíbe.
 */
export function SellerSummary({ listing }: { listing: PublicListing }) {
  const sellerAccountId = listing.seller?.sellerAccountId ?? listing.sellerAccountId;
  const displayName = listing.seller?.displayName.trim();
  const planName = listing.listingPlan?.displayName.trim();
  const href = `/vendedores/${encodeURIComponent(sellerAccountId)}`;

  return (
    <div className={styles.sellerRegion}>
      <h3 className={styles.regionLabel}>Quem vende</h3>

      <p className={styles.sellerIdentity}>
        <span className={styles.sellerMark} aria-hidden="true">
          <Store size={18} />
        </span>
        <span className={styles.sellerNames}>
          <strong>{displayName || "Nome público não enviado pela API"}</strong>
          <code>{shortIdentifier(sellerAccountId)}</code>
        </span>
      </p>

      <p className={styles.regionNote}>
        Nenhuma reputação pública foi publicada para este contexto comercial. Esta página não
        estima nota, percentual de avaliações positivas nem total de vendas do vendedor.
        {planName ? ` Plano do anúncio: ${planName}.` : ""}
      </p>

      <Link className="text-link" href={href}>
        Ver perfil público do vendedor <ArrowUpRight aria-hidden="true" size={15} />
      </Link>
    </div>
  );
}
