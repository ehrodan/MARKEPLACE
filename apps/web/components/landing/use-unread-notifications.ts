"use client";

import { useApiResource } from "@/hooks/use-api-resource";

/**
 * Contagem REAL de notificações não lidas da conta autenticada.
 *
 * Fonte: GET /v1/me/notifications (borda de retenção em
 * apps/api/src/retention-routes.ts). O `unreadCount` da resposta vem de um
 * COUNT dedicado no módulo de retenção e não depende do `limit`; pedimos
 * `limit=1` só para não trafegar a primeira página inteira a cada carga.
 *
 * HONESTIDADE (PRD §19, docs/03 §10): sem sessão (401), com erro de rede ou
 * enquanto a resposta não chega, devolve `null` — quem consome mostra o sino
 * sem número. Nenhuma contagem é inventada e nenhum estado é simulado; o
 * ApiError fica contido no useApiResource, sem vazar para o console.
 */
export const UNREAD_NOTIFICATIONS_ENDPOINT = "/v1/me/notifications?limit=1";

interface UnreadNotificationsPage {
  unreadCount: number;
}

export function useUnreadNotifications(): number | null {
  const resource = useApiResource<UnreadNotificationsPage>(UNREAD_NOTIFICATIONS_ENDPOINT);
  if (resource.status !== "ready") return null;
  const count = resource.data.unreadCount;
  // Resposta fora do contrato conta como ausência de dado, nunca como zero.
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return null;
  return count;
}

/**
 * Nome acessível do sino. Sem dado confiável (`null`) ou com zero não lidas o
 * rótulo fica só "Notificações": badge ausente e rótulo dizem a mesma coisa.
 */
export function notificationsLinkLabel(unread: number | null): string {
  if (unread === null || unread === 0) return "Notificações";
  return `Notificações, ${String(unread)} não ${unread === 1 ? "lida" : "lidas"}`;
}
