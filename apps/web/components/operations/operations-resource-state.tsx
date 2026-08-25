"use client";

import Link from "next/link";
import { Button, PageState } from "@midas/ui";
import { isApiError, type ApiError } from "@/lib/api-client";

export function OperationsResourceError({ error, retry }: { error: Error | ApiError; retry: () => void }) {
  if (!isApiError(error)) {
    return (
      <PageState
        kind="offline"
        title="API operacional inacessível"
        description="A fila real não pôde ser consultada. Nenhum caso foi presumido e nenhuma ação foi liberada."
        actions={<Button onClick={retry}>Tentar novamente</Button>}
      />
    );
  }
  const { problem } = error;
  if (problem.status === 401) {
    return (
      <PageState
        kind="forbidden"
        title="Sessão administrativa necessária"
        description="Entre novamente. O servidor revalidará papel, grant e step-up antes de revelar a fila."
        actions={<Link className="text-link" href="/entrar">Entrar</Link>}
        reference={problem.correlationId}
      />
    );
  }
  if (problem.status === 403) {
    return (
      <PageState
        kind="forbidden"
        title="Grant insuficiente para esta operação"
        description="A área permaneceu fechada e nenhum dado financeiro foi revelado. Solicite acesso ao Master responsável."
        actions={<Link className="text-link" href="/conta">Voltar para Minha conta</Link>}
        reference={problem.correlationId}
      />
    );
  }
  if (problem.status === 404 || problem.status === 501 || problem.code === "CAPABILITY_NOT_IMPLEMENTED") {
    return (
      <PageState
        kind="unavailable"
        title="Capability operacional ainda indisponível"
        description="O backend não publicou esta leitura neste corte. A interface não criou fila, contagem ou sucesso demonstrativo."
        reference={problem.correlationId}
      />
    );
  }
  if (problem.status === 503) {
    return (
      <PageState
        kind="unavailable"
        title="Dependência financeira indisponível"
        description={problem.detail || "A operação permanece bloqueada até a fonte canônica responder."}
        actions={<Button onClick={retry}>Tentar novamente</Button>}
        reference={problem.correlationId}
      />
    );
  }
  return (
    <PageState
      kind="error"
      title={problem.title || "Falha ao carregar operação"}
      description={problem.detail || "Nenhuma ação foi aplicada. Use a referência para investigação."}
      actions={<Button onClick={retry}>Tentar novamente</Button>}
      reference={problem.correlationId}
    />
  );
}
