"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { notificationsLinkLabel, useUnreadNotifications } from "./use-unread-notifications";
import styles from "./public-nav.module.css";

/**
 * Sino de notificações do cabeçalho público.
 *
 * Autenticado e com a API respondendo, o badge mostra o número REAL de não
 * lidas (fonte em use-unread-notifications). Sem sessão ou com erro, o sino
 * vira link simples para /conta/notificacoes — sem contagem e sem barulho no
 * console. O badge usa --color-signal: contagem é informação, não ação.
 */
export function NavNotificationsLink() {
  const unread = useUnreadNotifications();

  return (
    <Link href="/conta/notificacoes" aria-label={notificationsLinkLabel(unread)}>
      <span className={styles.bellGlyph}>
        <Bell aria-hidden="true" size={19} />
        {unread !== null && unread > 0 ? (
          <span className={styles.bellBadge} aria-hidden="true" data-testid="notifications-count">
            {unread}
          </span>
        ) : null}
      </span>
      <span className={styles.actionLabel}>Notificações</span>
    </Link>
  );
}
