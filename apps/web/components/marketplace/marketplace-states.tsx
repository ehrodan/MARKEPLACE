"use client";

import Link from "next/link";
import { Button, PageState, Skeleton } from "@midas/ui";
import { isApiError, type ApiError } from "@/lib/api-client";
import styles from "./marketplace.module.css";

export function MarketplaceLoading({ detail = false }: { detail?: boolean }) {
  if (detail) {
    return (
      <section className={styles.detailLoading} aria-busy="true" aria-label="Carregando anúncio">
        <Skeleton height="1.25rem" />
        <div className={styles.detailLoadingGrid}>
          <Skeleton height="35rem" />
          <div className={styles.detailLoadingAside}>
            <Skeleton height="3rem" />
            <Skeleton height="8rem" />
            <Skeleton height="15rem" />
          </div>
        </div>
      </section>
    );
  }

  // O esqueleto tem o FORMATO do card real (visual quadrado + taxonomia +
  // título + preço + CTA), não um retângulo genérico: a página não "pula"
  // quando os dados chegam, porque o que carrega ocupa o lugar do que vem.
  return (
    <section className={styles.catalogLoading} aria-busy="true" aria-label="Carregando anúncios">
      <Skeleton height="4.5rem" />
      <div className={styles.loadingCards}>
        {Array.from({ length: 8 }, (_, index) => (
          <div className={styles.loadingCard} key={index}>
            <Skeleton className={styles.loadingVisual} height="auto" />
            <div className={styles.loadingBody}>
              <Skeleton height=".68rem" width="52%" />
              <Skeleton height="1rem" width="84%" />
              <Skeleton height="1.3rem" width="46%" />
              <Skeleton height="2.75rem" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MarketplaceError({
  error,
  retry,
  scope,
}: {
  error: Error | ApiError;
  retry: () => void;
  scope: "catalog" | "listing";
}) {
  if (!isApiError(error)) {
    return (
      <div role="status" aria-live="polite">
        <PageState
          kind="offline"
          title="Não foi possível carregar os anúncios"
          description="Verifique sua conexão e tente novamente."
          actions={<Button onClick={retry}>Tentar novamente</Button>}
        />
      </div>
    );
  }

  const { problem } = error;
  if (scope === "listing" && problem.status === 404) {
    return (
      <div role="status" aria-live="polite">
        <PageState
          kind="empty"
          title="Anúncio não encontrado"
          description="O endereço não corresponde a um anúncio publicado ou a oferta deixou de estar disponível."
          actions={<Link className="button-link" href="/market">Voltar ao marketplace</Link>}
          reference={problem.correlationId}
        />
      </div>
    );
  }

  if (problem.status === 503) {
    return (
      <div role="status" aria-live="polite">
        <PageState
          kind="unavailable"
          title="Catálogo temporariamente indisponível"
          description="Preço e disponibilidade não puderam ser atualizados agora. Tente novamente em instantes."
          actions={<Button onClick={retry}>Tentar novamente</Button>}
          reference={problem.correlationId}
        />
      </div>
    );
  }

  return (
    <PageState
      kind="error"
      title="Não foi possível carregar esta página"
      description="Tente novamente. Se o problema continuar, informe a referência abaixo ao suporte."
      actions={<Button onClick={retry}>Tentar novamente</Button>}
      reference={problem.correlationId}
    />
  );
}
