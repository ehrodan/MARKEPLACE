import Link from "next/link";
import { ArrowUpRight, Store } from "lucide-react";
import { shortIdentifier } from "@/components/marketplace/formatters";
import type { PublicListing } from "@/components/marketplace/types";
import styles from "./listing-detail.module.css";

function firstGrapheme(value: string): string | undefined {
  const iterator = new Intl.Segmenter("pt-BR", { granularity: "grapheme" })
    .segment(value)[Symbol.iterator]();
  const first = iterator.next();
  return first.done ? undefined : first.value.segment;
}

/**
 * Resumo público do vendedor (SCR-PUB-006 -> SCR-PUB-007).
 *
 * Sem PII: apenas o nome público do contexto comercial e o identificador
 * público do `SellerAccount`. Membros, contato e documento nunca aparecem.
 * O avatar é a inicial do próprio nome público — nenhum dado novo entra.
 *
 * Reputação: não existe projeção publicada. A tela diz isso em vez de estimar
 * nota, percentual de aprovação ou número de vendas do vendedor — dado social
 * fabricado é exatamente o que doc 03 secao 10 proíbe. O plano do anúncio saiu
 * daqui: é metadado de auditoria e mora na "Procedência do anúncio" da página.
 */
export function SellerSummary({ listing }: { listing: PublicListing }) {
  const sellerAccountId = listing.seller?.sellerAccountId ?? listing.sellerAccountId;
  const displayName = listing.seller?.displayName.trim();
  const initial = displayName ? firstGrapheme(displayName)?.toLocaleUpperCase("pt-BR") : undefined;
  const href = `/vendedores/${encodeURIComponent(sellerAccountId)}`;

  return (
    <div className={styles.sellerRegion}>
      <h3 className={styles.regionLabel}>Quem vende</h3>

      <p className={styles.sellerIdentity}>
        <span className={styles.sellerMark} aria-hidden="true">
          {initial ?? <Store size={18} />}
        </span>
        <span className={styles.sellerNames}>
          <strong>{displayName || "Nome público não enviado pela API"}</strong>
          <code>{shortIdentifier(sellerAccountId)}</code>
        </span>
      </p>

      <p className={styles.regionNote}>
        Nenhuma reputação pública foi publicada: esta página não estima nota nem total de vendas.
      </p>

      <Link className="text-link" href={href}>
        Ver perfil e outros anúncios <ArrowUpRight aria-hidden="true" size={15} />
      </Link>
    </div>
  );
}
