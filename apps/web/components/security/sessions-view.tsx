"use client";

import Link from "next/link";
import { Button, PageState, Panel, StatusBadge } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { DataProvenance } from "@/components/account/data-provenance";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/date-format";
import styles from "@/components/account/account-dashboard.module.css";
import {
  SESSION_LIST_CONTRACT,
  readSessionList,
  sessionSignalsAbsent,
  sessionStateLabel,
  sessionStateMeaning,
  type SessionState,
} from "./session-facts";

const tones: Record<SessionState, "success" | "warning" | "neutral"> = {
  CURRENT: "success",
  ACTIVE: "warning",
  EXPIRED: "neutral",
};

export function SessionsView() {
  const resource = useApiResource<unknown>("/v1/me/sessions");

  const header = (
    <PageHeader
      eyebrow="MINHA CONTA · SEGURANÇA"
      title="Sessões"
      description="Sessões que o servidor ainda reconhece na sua conta, com o prazo de cada uma."
    />
  );

  if (resource.status === "error") {
    return (
      <div className={styles.pageStack}>
        {header}
        <ResourceError error={resource.error} retry={resource.retry} />
      </div>
    );
  }

  if (resource.status !== "ready") {
    return (
      <div className={styles.pageStack}>
        {header}
        <ResourceLoading label="Carregando sessões" />
      </div>
    );
  }

  const read = readSessionList(resource.data);
  if (!read) {
    return (
      <div className={styles.pageStack}>
        {header}
        <PageState
          kind="error"
          title="A resposta não corresponde ao contrato de sessões"
          description={`A API respondeu, mas o envelope exigido por ${SESSION_LIST_CONTRACT} não veio no formato esperado. Nenhuma sessão é exibida por dedução.`}
          reference={SESSION_LIST_CONTRACT}
          actions={
            <Button variant="outline" onClick={resource.retry}>
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.pageStack}>
      {header}
      {read.asOf ? (
        <DataProvenance
          source={SESSION_LIST_CONTRACT}
          scope="somente sessões da sua própria conta"
          asOf={read.asOf}
        />
      ) : (
        <p className={styles.secondaryText}>
          A resposta não trouxe <code>asOf</code>, então esta tela não afirma a que momento a lista se
          refere.
        </p>
      )}

      <Panel className={styles.section} as="section" aria-labelledby="sessions-limits-title">
        <div className={styles.sectionHeader}>
          <h2 id="sessions-limits-title">O que esta tela não sabe</h2>
        </div>
        <p className={styles.notice}>
          O contrato devolve apenas identificador, criação, prazo e se a sessão é a deste navegador.
          Não vem {sessionSignalsAbsent.join(", ")}. Por isso nenhuma linha abaixo diz de onde a
          sessão veio nem quem a está usando — inventar essa informação numa tela de segurança seria
          pior que não tê-la.
        </p>
      </Panel>

      {read.discarded > 0 ? (
        <p className={styles.errorText} role="status">
          {read.discarded} linha(s) vieram fora do contrato e foram descartadas em vez de exibidas
          pela metade.
        </p>
      ) : null}

      {read.sessions.length === 0 ? (
        <PageState
          kind="empty"
          title="Nenhuma sessão listada"
          description="O servidor não devolveu nenhuma sessão para esta conta."
          actions={
            <Button variant="outline" onClick={resource.retry}>
              Atualizar
            </Button>
          }
        />
      ) : (
        <>
          <p className={styles.resultCount} aria-live="polite">
            {read.activeCount} sessão(ões) aceita(s) pelo servidor
            {read.expiredCount > 0 ? ` · ${String(read.expiredCount)} já expirada(s)` : ""}
          </p>
          <Panel className={styles.tablePanel}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <caption>Sessões devolvidas pela API</caption>
                <thead>
                  <tr>
                    <th scope="col">Sessão</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Criada em</th>
                    <th scope="col">Expira em</th>
                  </tr>
                </thead>
                <tbody>
                  {read.sessions.map((session) => (
                    <tr key={session.sessionId}>
                      <td className={styles.primaryCell}>
                        <strong>{session.sessionId}</strong>
                        <small>{sessionStateMeaning(session.state)}</small>
                      </td>
                      <td>
                        <StatusBadge tone={tones[session.state]}>
                          {sessionStateLabel(session.state)}
                        </StatusBadge>
                      </td>
                      <td className={styles.dateCell}>
                        <time dateTime={session.createdAt}>{formatDateTime(session.createdAt)}</time>
                      </td>
                      <td className={styles.dateCell}>
                        <time dateTime={session.expiresAt}>{formatDateTime(session.expiresAt)}</time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      <Panel className={styles.section} as="section" aria-labelledby="sessions-revoke-title">
        <div className={styles.sectionHeader}>
          <h2 id="sessions-revoke-title">Revogar sessão</h2>
        </div>
        <p className={styles.secondaryText}>
          A API publica hoje somente a leitura ({SESSION_LIST_CONTRACT}). Não existe comando de
          revogação por sessão nem de “encerrar as outras”, e esta tela não oferece um botão que não
          executa nada. Para encerrar a sessão deste navegador, saia da conta.
        </p>
        <div className={styles.pagerActions}>
          <Link className="button-link" href="/conta/seguranca">
            Voltar à segurança da conta
          </Link>
        </div>
      </Panel>
    </div>
  );
}
