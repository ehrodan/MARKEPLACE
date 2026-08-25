"use client";

import Link from "next/link";
import { Button, PageState, Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useApiResource } from "@/hooks/use-api-resource";
import { isApiError } from "@/lib/api-client";
import styles from "@/components/account/account-dashboard.module.css";
import { DEVICE_LIST_CONTRACT, SESSION_LIST_CONTRACT } from "./session-facts";

export function DevicesView() {
  const resource = useApiResource<unknown>("/v1/me/devices");

  const header = (
    <PageHeader
      eyebrow="MINHA CONTA · SEGURANÇA"
      title="Dispositivos"
      description="Dispositivos que a conta reconhece. Confiança de dispositivo não é prova de identidade, e esta tela não trata como se fosse."
    />
  );

  const notPublished =
    resource.status === "error" &&
    isApiError(resource.error) &&
    (resource.error.problem.status === 404 ||
      resource.error.problem.code === "CAPABILITY_NOT_IMPLEMENTED");

  return (
    <div className={styles.pageStack}>
      {header}

      {notPublished || resource.status === "idle" ? (
        <PageState
          kind="unavailable"
          title="Dispositivos ainda não publicados pela API"
          description={`Esta tela lê ${DEVICE_LIST_CONTRACT}, que ainda não existe. Sem desafio e registro no servidor, marcar um dispositivo como confiável no navegador não protegeria nada — então nenhum controle é oferecido aqui.`}
          reference={DEVICE_LIST_CONTRACT}
          actions={
            <>
              <Button variant="outline" onClick={resource.retry}>
                Tentar novamente
              </Button>
              <Link className="button-link" href="/conta/seguranca/sessoes">
                Ver sessões ativas
              </Link>
            </>
          }
        />
      ) : resource.status === "error" ? (
        <ResourceError error={resource.error} retry={resource.retry} />
      ) : resource.status !== "ready" ? (
        <ResourceLoading label="Carregando dispositivos" />
      ) : (
        <PageState
          kind="empty"
          title="A API respondeu, mas o contrato de dispositivos não está definido nesta versão"
          description="Enquanto o formato de resposta não estiver fixado no contrato, esta tela não interpreta o corpo recebido nem exibe dispositivo por suposição."
          reference={DEVICE_LIST_CONTRACT}
          actions={
            <Button variant="outline" onClick={resource.retry}>
              Tentar novamente
            </Button>
          }
        />
      )}

      <Panel className={styles.section} as="section" aria-labelledby="devices-meaning-title">
        <div className={styles.sectionHeader}>
          <h2 id="devices-meaning-title">O que dispositivo confiável significa</h2>
        </div>
        <p className={styles.notice}>
          Dispositivo confiável reduz atrito em verificações repetidas. Ele não substitui senha,
          passkey ou segundo fator, e não garante que a pessoa na frente do aparelho é você.
        </p>
        <p className={styles.secondaryText}>
          Enquanto o registro de dispositivos não existir, o sinal mais próximo disponível é a lista
          de sessões, lida de {SESSION_LIST_CONTRACT} — e ela também não informa origem nem
          equipamento.
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
