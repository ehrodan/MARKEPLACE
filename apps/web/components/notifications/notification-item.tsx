"use client";

import Link from "next/link";
import { ArrowUpRight, MailOpen } from "lucide-react";
import { Button, StatusBadge } from "@midas/ui";
import styles from "./notifications.module.css";

/** Resposta canônica de `GET /v1/me/notifications`. */
export interface NotificationItemModel {
  notificationId: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  /** Deep link para o objeto canônico. Sem destino interno seguro, nenhum link é exibido. */
  deepLink: string | null;
  relatedRef: string | null;
}

const kindLabels: Record<string, string> = {
  ORDER: "Pedido",
  PAYMENT: "Pagamento",
  DELIVERY: "Entrega",
  DISPUTE: "Disputa",
  REFUND: "Reembolso",
  PAYOUT: "Saque",
  HOLD: "Retenção",
  SECURITY: "Segurança",
  MODERATION: "Moderação",
  TICKET: "Atendimento",
  PROPOSAL: "Proposta",
};

/** Código desconhecido é exibido como veio da API, nunca traduzido por suposição. */
export function notificationKindLabel(kind: string): string {
  return kindLabels[kind] ?? kind;
}

export function formatNotificationDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function safeNotificationHref(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export interface NotificationItemProps {
  item: NotificationItemModel;
  /** Estado efetivo, já considerando a marcação otimista pendente. */
  read: boolean;
  saving: boolean;
  error?: string | undefined;
  onMarkRead: (notificationId: string) => void;
}

export function NotificationItem({ item, read, saving, error, onMarkRead }: NotificationItemProps) {
  const createdAt = formatNotificationDate(item.createdAt);
  const readAt = formatNotificationDate(item.readAt);
  const href = safeNotificationHref(item.deepLink);
  const titleId = `notification-${item.notificationId}-title`;

  return (
    <article
      className={styles.item}
      data-read={read ? "true" : "false"}
      aria-labelledby={titleId}
    >
      <div className={styles.itemHead}>
        <div className={styles.itemTags}>
          <StatusBadge tone={read ? "neutral" : "info"}>{notificationKindLabel(item.kind)}</StatusBadge>
          <span className={styles.itemReadFlag} data-read={read ? "true" : "false"}>
            {read ? "Lida" : "Não lida"}
          </span>
        </div>
        {createdAt ? <time className={styles.itemTime} dateTime={item.createdAt}>{createdAt}</time> : null}
      </div>

      <h3 className={styles.itemTitle} id={titleId}>{item.title}</h3>
      {item.body ? <p className={styles.itemBody}>{item.body}</p> : null}

      <div className={styles.itemFooter}>
        <span className={styles.itemMeta}>
          {item.relatedRef ? <span>Referência: {item.relatedRef}</span> : null}
          {read && readAt ? <span>Lida em {readAt}</span> : null}
          {read && !readAt ? <span>Marcada como lida nesta sessão</span> : null}
        </span>
        <div className={styles.itemActions}>
          {href ? (
            <Link className="text-link" href={href}>
              Abrir contexto <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          ) : (
            <span className={styles.itemNoLink}>Sem link canônico nesta notificação</span>
          )}
          {read ? null : (
            <Button
              variant="outline"
              size="small"
              loading={saving}
              loadingLabel="Marcando"
              iconBefore={<MailOpen aria-hidden="true" size={16} />}
              onClick={() => { onMarkRead(item.notificationId); }}
            >
              Marcar como lida
            </Button>
          )}
        </div>
      </div>

      {error ? <p className={styles.itemError} role="alert">{error}</p> : null}
    </article>
  );
}
