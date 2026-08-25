"use client";

import Link from "next/link";
import { PageState, Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useApiResource } from "@/hooks/use-api-resource";
import styles from "@/components/account/account-dashboard.module.css";
import { DEVICE_LIST_CONTRACT, SESSION_LIST_CONTRACT, readSessionList } from "./session-facts";

/**
 * Fatores de autenticação e confiança de dispositivo ainda não têm contrato
 * publicado. A tela lista o que EXISTE (sessões) e nomeia o que falta, em vez de
 * desenhar um painel de segurança que não reflete o servidor.
 */
const pendingCapabilities = [
  {
    title: "Senha e recuperação",
    contract: "POST /v1/auth/password-reset (não publicado)",
    detail:
      "A troca de senha e os códigos de recuperação vivem no serviço de identidade. Enquanto o contrato não existir, esta tela não oferece o comando.",
  },
  {
    title: "Passkey (WebAuthn)",
    contract: "POST /v1/me/webauthn/credentials (não publicado)",
    detail:
      "Registro de passkey exige desafio do servidor. Sem esse contrato, um botão aqui só produziria erro.",
  },
  {
    title: "Segundo fator (TOTP)",
    contract: "POST /v1/me/mfa/totp (não publicado)",
    detail:
      "Habilitar TOTP requer segredo gerado no servidor e confirmação de código. Nada disso é feito no navegador.",
  },
  {
    title: "Dispositivos confiáveis",
    contract: `${DEVICE_LIST_CONTRACT} (não publicado)`,
    detail:
      "Confiança de dispositivo depende de desafio e registro. A tela de dispositivos existe e declara essa ausência.",
  },
] as const;

export function SecurityView() {
  const resource = useApiResource<unknown>("/v1/me/sessions");

  const header = (
    <PageHeader
      eyebrow="MINHA CONTA · SEGURANÇA"
      title="Segurança da conta"
      description="O que o servidor confirma sobre o acesso à sua conta, e o que ainda não tem comando publicado."
    />
  );

  const sessionsPanel = () => {
    if (resource.status === "error") {
      return <ResourceError error={resource.error} retry={resource.retry} />;
    }
    if (resource.status !== "ready") {
      return <ResourceLoading label="Carregando sessões" />;
    }
    const read = readSessionList(resource.data);
    if (!read) {
      return (
        <PageState
          kind="error"
          title="A resposta de sessões não corresponde ao contrato"
          description={`O envelope exigido por ${SESSION_LIST_CONTRACT} não veio no formato esperado, então nenhuma contagem é exibida.`}
          reference={SESSION_LIST_CONTRACT}
        />
      );
    }
    return (
      <>
        <dl className={styles.metricGrid}>
          <div className={styles.metricCard}>
            <dt className={styles.metricLabel}>Sessões aceitas pelo servidor</dt>
            <dd className={styles.metricValue}>{read.activeCount}</dd>
            <dd className={styles.metricMeta}>
              Contagem lida de {SESSION_LIST_CONTRACT}, não acumulada no navegador.
            </dd>
          </div>
          <div className={styles.metricCard}>
            <dt className={styles.metricLabel}>Sessões já expiradas na lista</dt>
            <dd className={styles.metricValue}>{read.expiredCount}</dd>
            <dd className={styles.metricMeta}>
              Prazo vencido: o servidor recusa, mesmo que a linha continue listada.
            </dd>
          </div>
        </dl>
        {read.discarded > 0 ? (
          <p className={styles.errorText}>
            {read.discarded} linha(s) de sessão vieram fora do contrato e não entraram na contagem.
          </p>
        ) : null}
        <div className={styles.pagerActions}>
          <Link className="button-link" href="/conta/seguranca/sessoes">
            Ver sessões
          </Link>
          <Link className="button-link" href="/conta/seguranca/dispositivos">
            Ver dispositivos
          </Link>
        </div>
      </>
    );
  };

  return (
    <div className={styles.pageStack}>
      {header}

      <Panel className={styles.section} as="section" aria-labelledby="security-sessions-title">
        <div className={styles.sectionHeader}>
          <h2 id="security-sessions-title">Sessões</h2>
        </div>
        {sessionsPanel()}
      </Panel>

      <Panel className={styles.section} as="section" aria-labelledby="security-pending-title">
        <div className={styles.sectionHeader}>
          <h2 id="security-pending-title">Sem comando publicado</h2>
        </div>
        <p className={styles.secondaryText}>
          Cada item abaixo é um comando que o servidor ainda não expõe. Nenhum botão aparece antes do
          contrato existir: botão que não executa é pior que ausência declarada, porque o usuário
          acredita ter protegido a conta.
        </p>
        <ul className={styles.holdList}>
          {pendingCapabilities.map((capability) => (
            <li className={styles.holdRow} key={capability.title}>
              <div>
                <strong>{capability.title}</strong>
                <small className={styles.secondaryText}>{capability.detail}</small>
              </div>
              <code>{capability.contract}</code>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className={styles.section} as="section" aria-labelledby="security-privacy-title">
        <div className={styles.sectionHeader}>
          <h2 id="security-privacy-title">Privacidade e dados</h2>
        </div>
        <p className={styles.secondaryText}>
          Pedido de acesso, exportação e exclusão de dados é um fluxo separado, com prazo legal
          próprio. Ele não é resolvido nesta tela.
        </p>
        <div className={styles.pagerActions}>
          <Link className="button-link" href="/conta/privacidade">
            Abrir privacidade
          </Link>
        </div>
      </Panel>
    </div>
  );
}
