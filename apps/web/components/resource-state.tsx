"use client";

import Link from "next/link";
import { Button, PageState, Skeleton } from "@midas/ui";
import { isApiError, type ApiError } from "@/lib/api-client";

export function ResourceLoading({ label = "Carregando dados" }: { label?: string }) {
  return (
    <section className="resource-loading" aria-busy="true" aria-label={label}>
      <Skeleton height="4.5rem" />
      <div className="resource-loading__grid">
        <Skeleton height="8rem" />
        <Skeleton height="8rem" />
        <Skeleton height="8rem" />
      </div>
      <Skeleton height="14rem" />
    </section>
  );
}

export function ResourceError({ error, retry }: { error: Error | ApiError; retry: () => void }) {
  if (!isApiError(error)) {
    return (
      <PageState
        kind="offline"
        title="Não foi possível alcançar a API"
        description="A conexão falhou. Nenhum dado foi presumido ou substituído por valores demonstrativos."
        actions={<Button onClick={retry}>Tentar novamente</Button>}
      />
    );
  }

  const { problem } = error;
  if (problem.status === 401) {
    return (
      <PageState
        kind="forbidden"
        title="Sua sessão precisa ser renovada"
        description="Entre novamente para acessar esta área. O endereço atual pode ser retomado após a autenticação."
        actions={<Link className="text-link" href="/entrar">Entrar</Link>}
        reference={problem.correlationId}
      />
    );
  }

  if (problem.status === 403) {
    return (
      <PageState
        kind="forbidden"
        title="Acesso não autorizado"
        description="Esta seção não está disponível no contexto atual. Nenhuma informação protegida foi revelada."
        actions={<Link className="text-link" href="/conta">Voltar para Minha conta</Link>}
        reference={problem.correlationId}
      />
    );
  }

  if (problem.status === 404 || problem.code === "CAPABILITY_NOT_IMPLEMENTED") {
    return (
      <PageState
        kind="unavailable"
        title="Capacidade ainda não disponibilizada pela API"
        description="A interface está pronta para o contrato canônico, mas o backend não expôs esta leitura neste corte. Nenhum registro fictício foi criado."
        actions={<Link className="text-link" href="/conta">Voltar para Minha conta</Link>}
        reference={problem.correlationId}
      />
    );
  }

  if (problem.status === 503) {
    return (
      <PageState
        kind="unavailable"
        title="Dependência temporariamente indisponível"
        description={problem.detail || "Os dados reais não puderam ser consultados. Ações financeiras permanecem bloqueadas."}
        actions={<Button onClick={retry}>Tentar novamente</Button>}
        reference={problem.correlationId}
      />
    );
  }

  return (
    <PageState
      kind="error"
      title={problem.title || "Não foi possível carregar"}
      description={problem.detail || "Tente novamente. Se o problema continuar, use a referência ao falar com o suporte."}
      actions={<Button onClick={retry}>Tentar novamente</Button>}
      reference={problem.correlationId}
    />
  );
}
