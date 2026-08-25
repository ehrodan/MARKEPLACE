"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, Inbox, SlidersHorizontal } from "lucide-react";
import { Button, PageState, Panel } from "@midas/ui";
import { PageHeader } from "@/components/page-header";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { DataProvenance } from "@/components/account/data-provenance";
import { useApiResource } from "@/hooks/use-api-resource";
import { apiRequest, isApiError } from "@/lib/api-client";
import type { CursorPage } from "@/lib/api-types";
import { NotificationItem, notificationKindLabel, type NotificationItemModel } from "./notification-item";
import styles from "./notifications.module.css";

/** Contrato canônico publicado pela borda de retenção. */
export const NOTIFICATIONS_ENDPOINT = "/v1/me/notifications";
const PAGE_SIZE = 30;

type ReadFilter = "ALL" | "UNREAD" | "READ";

interface NotificationPage extends CursorPage<NotificationItemModel> {
  unreadCount: number;
}

function readEndpoint(notificationId: string): string {
  return `${NOTIFICATIONS_ENDPOINT}/${encodeURIComponent(notificationId)}/read`;
}

function mergeItems(
  current: NotificationItemModel[],
  incoming: NotificationItemModel[],
): NotificationItemModel[] {
  const byId = new Map(current.map((item) => [item.notificationId, item]));
  for (const item of incoming) byId.set(item.notificationId, item);
  return [...byId.values()];
}

function omitKey<T>(source: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(source).filter(([entryKey]) => entryKey !== key));
}

function createdDescending(first: NotificationItemModel, second: NotificationItemModel): number {
  const firstTime = Date.parse(first.createdAt);
  const secondTime = Date.parse(second.createdAt);
  if (Number.isNaN(firstTime) || Number.isNaN(secondTime)) return 0;
  return secondTime - firstTime;
}

function NotificationFeed({ initialPage }: { initialPage: NotificationPage }) {
  const [items, setItems] = useState(initialPage.data);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [asOf, setAsOf] = useState(initialPage.asOf);
  const [unreadCount, setUnreadCount] = useState(initialPage.unreadCount);
  const [readFilter, setReadFilter] = useState<ReadFilter>("ALL");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [optimisticRead, setOptimisticRead] = useState<Record<string, boolean | undefined>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean | undefined>>({});
  const [itemErrors, setItemErrors] = useState<Record<string, string | undefined>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationError, setPaginationError] = useState<string | null>(null);

  function isRead(item: NotificationItemModel): boolean {
    return Boolean(item.readAt) || optimisticRead[item.notificationId] === true;
  }

  const kinds = useMemo(() => (
    [...new Set(items.map((item) => item.kind))]
      .sort((first, second) => notificationKindLabel(first).localeCompare(notificationKindLabel(second), "pt-BR"))
  ), [items]);

  const visible = useMemo(() => {
    const matches = items.filter((item) => {
      const read = Boolean(item.readAt) || optimisticRead[item.notificationId] === true;
      const matchesRead = readFilter === "ALL"
        || (readFilter === "UNREAD" && !read)
        || (readFilter === "READ" && read);
      const matchesKind = kindFilter === "ALL" || item.kind === kindFilter;
      return matchesRead && matchesKind;
    });
    return [...matches].sort(createdDescending);
  }, [items, kindFilter, optimisticRead, readFilter]);

  async function markRead(notificationId: string) {
    const target = items.find((item) => item.notificationId === notificationId);
    if (!target || isRead(target)) return;

    setOptimisticRead((current) => ({ ...current, [notificationId]: true }));
    setUnreadCount((current) => Math.max(current - 1, 0));
    setSavingIds((current) => ({ ...current, [notificationId]: true }));
    setItemErrors((current) => omitKey(current, notificationId));

    try {
      const confirmed = await apiRequest<NotificationItemModel>(
        readEndpoint(notificationId),
        { method: "POST" },
      );
      if (confirmed.notificationId !== notificationId) {
        throw new Error("A API confirmou outra notificação. A leitura local foi desfeita.");
      }
      setItems((current) => current.map((item) => (
        item.notificationId === notificationId ? confirmed : item
      )));
      setOptimisticRead((current) => omitKey(current, notificationId));
    } catch (error: unknown) {
      // Reconciliação: o servidor não confirmou, então a marcação otimista cai.
      setOptimisticRead((current) => omitKey(current, notificationId));
      setUnreadCount((current) => current + 1);
      const reference = isApiError(error) ? error.problem.correlationId : undefined;
      const detail = error instanceof Error ? error.message : "A API não confirmou a leitura.";
      setItemErrors((current) => ({
        ...current,
        [notificationId]: reference
          ? `Não foi possível marcar como lida: ${detail} A notificação voltou para não lida. Referência: ${reference}`
          : `Não foi possível marcar como lida: ${detail} A notificação voltou para não lida.`,
      }));
    } finally {
      setSavingIds((current) => omitKey(current, notificationId));
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setPaginationError(null);
    try {
      const page = await apiRequest<NotificationPage>(
        `${NOTIFICATIONS_ENDPOINT}?limit=${String(PAGE_SIZE)}&cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((current) => mergeItems(current, page.data));
      setNextCursor(page.nextCursor);
      setUnreadCount(page.unreadCount);
      if (page.asOf) setAsOf(page.asOf);
    } catch (error: unknown) {
      setPaginationError(error instanceof Error
        ? error.message
        : "Não foi possível carregar mais notificações.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (items.length === 0) {
    return (
      <>
        <DataProvenance
          source={`GET ${NOTIFICATIONS_ENDPOINT}`}
          scope="Notificações da sua conta"
          asOf={asOf}
          {...(initialPage.freshness ? { freshness: initialPage.freshness } : {})}
        />
        <PageState
          kind="empty"
          title="Nenhuma notificação até agora"
          description="A API respondeu sem registros para esta conta. Esta tela não preenche o histórico com exemplos."
          actions={<Link className="button-link" href="/conta/preferencias">Ajustar canais de comunicação</Link>}
        />
      </>
    );
  }

  return (
    <>
      <DataProvenance
        source={`GET ${NOTIFICATIONS_ENDPOINT}`}
        scope="Notificações da sua conta"
        asOf={asOf}
        {...(initialPage.freshness ? { freshness: initialPage.freshness } : {})}
      />

      <section className={styles.filters} aria-labelledby="notifications-filter-title">
        <div className={styles.filterHeading}>
          <SlidersHorizontal aria-hidden="true" size={18} />
          <div>
            <h2 id="notifications-filter-title">Filtrar o que já foi carregado</h2>
            <p>Os filtros agem sobre os registros reais retornados pela API. Nada é gerado localmente.</p>
          </div>
        </div>
        <div className={styles.filterGrid}>
          <div className={styles.field}>
            <label htmlFor="notification-read-filter">Situação</label>
            <select
              id="notification-read-filter"
              value={readFilter}
              onChange={(event) => { setReadFilter(event.target.value as ReadFilter); }}
            >
              <option value="ALL">Todas</option>
              <option value="UNREAD">Não lidas</option>
              <option value="READ">Lidas</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="notification-kind-filter">Tipo</label>
            <select
              id="notification-kind-filter"
              value={kindFilter}
              onChange={(event) => { setKindFilter(event.target.value); }}
            >
              <option value="ALL">Todos os tipos</option>
              {kinds.map((kind) => (
                <option value={kind} key={kind}>{notificationKindLabel(kind)}</option>
              ))}
            </select>
          </div>
          <p className={styles.filterCount} aria-live="polite">
            {visible.length} de {items.length} carregadas · {unreadCount} não {unreadCount === 1 ? "lida" : "lidas"} na conta
          </p>
        </div>
      </section>

      {visible.length === 0 ? (
        <PageState
          kind="empty"
          title="Nenhuma notificação corresponde ao filtro"
          description="Altere a situação ou o tipo para voltar ao conjunto carregado. Nenhum registro foi alterado."
          actions={
            <Button
              variant="outline"
              onClick={() => { setReadFilter("ALL"); setKindFilter("ALL"); }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className={styles.feed}>
          {visible.map((item) => (
            <NotificationItem
              key={item.notificationId}
              item={item}
              read={isRead(item)}
              saving={savingIds[item.notificationId] === true}
              error={itemErrors[item.notificationId]}
              onMarkRead={(id) => { void markRead(id); }}
            />
          ))}
        </div>
      )}

      <div className={styles.loadMore}>
        {paginationError ? <p className={styles.itemError} role="alert">{paginationError}</p> : null}
        {nextCursor ? (
          <Button
            variant="outline"
            loading={loadingMore}
            loadingLabel="Carregando notificações"
            onClick={() => { void loadMore(); }}
          >
            Carregar mais notificações
          </Button>
        ) : (
          <p className={styles.loadMoreDone}>
            <Inbox aria-hidden="true" size={16} /> Todas as notificações retornadas já estão nesta lista.
          </p>
        )}
      </div>
    </>
  );
}

export function NotificationsView() {
  const resource = useApiResource<NotificationPage>(`${NOTIFICATIONS_ENDPOINT}?limit=${String(PAGE_SIZE)}`);

  return (
    <div className={styles.pageStack}>
      <PageHeader
        eyebrow="CONTA · NOTIFICAÇÕES"
        title="Notificações"
        description="O registro do que aconteceu com os seus pedidos fica aqui, dentro da conta. Não depende de e-mail nem de push chegarem."
        meta={<span><BellRing aria-hidden="true" size={15} /> Histórico da sua conta</span>}
        action={<Link className="text-link" href="/conta/preferencias">Ajustar canais de comunicação</Link>}
      />

      {resource.status === "error" ? (
        <>
          <ResourceError error={resource.error} retry={resource.retry} />
          <Panel className={styles.contractNote} as="aside">
            <div className={styles.contractIcon} aria-hidden="true"><Inbox size={20} /></div>
            <div>
              <strong>Seu histórico não foi substituído por exemplos</strong>
              <p>
                Não foi possível consultar as notificações desta conta agora. Tente novamente; nenhum aviso
                fictício é exibido no lugar dos seus registros.
              </p>
              <Link className="text-link" href="/conta/preferencias">Ver e ajustar os canais por finalidade</Link>
            </div>
          </Panel>
        </>
      ) : resource.status === "ready" ? (
        <NotificationFeed initialPage={resource.data} />
      ) : (
        <ResourceLoading label="Carregando notificações" />
      )}
    </div>
  );
}
