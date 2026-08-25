# WIRING — pós-venda em `/conta/notificacoes` e `/conta/preferencias`

**Estado:** integrado ao contrato real de `apps/api/src/retention-routes.ts`  
**Escopo web:** `apps/web/components/notifications/**`, as duas páginas de conta e o BFF genérico.

## Contratos consumidos

| Método | Path | Uso no front |
|---|---|---|
| `GET` | `/v1/me/notifications?limit=30&cursor=<uuid>` | Feed real, cursor, `unreadCount` global e `asOf`. |
| `POST` | `/v1/me/notifications/:notificationId/read` | Marcação individual; mutação otimista revertida se a API não confirmar o mesmo id. |
| `GET` | `/v1/me/reminder-consents` | Matriz completa de 3 canais × 4 finalidades. |
| `PUT` | `/v1/me/reminder-consents` | Uma decisão por chamada, com CSRF do `apiRequest`. |

O BFF aceita `PUT` na mesma allowlist restrita a `v1`/`health` e exporta o handler
`PUT` pelo mesmo proxy protegido. Não existe rota paralela nem tradução de compatibilidade.

## Formas canônicas usadas

```ts
interface NotificationItemModel {
  notificationId: string;
  kind: string;
  title: string;
  body: string;
  deepLink: string | null;
  relatedRef: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationPage {
  data: NotificationItemModel[];
  unreadCount: number;
  nextCursor: string | null;
  asOf: string;
}

type ConsentState = "GRANTED" | "MISSING" | "REVOKED";

interface ConsentRecord {
  channel: "EMAIL" | "PUSH" | "IN_APP";
  purpose: "CART_RECOVERY" | "PRICE_WATCH" | "STOCK_WATCH" | "ORDER_UPDATE";
  state: ConsentState;
  granted: boolean;
  policyVersion: string | null;
  decidedAt: string | null;
}
```

## Invariantes preservados

1. `MISSING` nunca aparece autorizado. O checkbox só liga quando `state === "GRANTED"`
   **e** `granted === true`.
2. Um par `REVOKED` só é religado com `reoptIn: true`, produzido exclusivamente depois
   do gesto explícito de marcar e salvar. O campo não é enviado para `MISSING`, `GRANTED`
   ou revogação.
3. `ORDER_UPDATE` continua identificado como transacional, mas a UI não inventa bloqueio:
   a rota canônica permite revogação e a policy respeita essa revogação em qualquer canal.
4. A API grava uma decisão por `PUT`. Um salvamento com várias células é sequencial e
   a tela separa o que foi confirmado do que falhou; nunca declara rollback inexistente.
5. `unreadCount` vem da API para a conta inteira, não da quantidade carregada no browser.
   A UI o ajusta otimisticamente e restaura em falha.
6. `deepLink` só vira navegação quando é caminho interno iniciado por `/` e não por
   `//`. URL externa, protocol-relative e esquema executável falham fechados.
7. Ausência/erro de API gera loading, erro ou vazio real. Não há notificação,
   consentimento ou contagem simulada.

## Limite nomeado

Favorito/listing-detail não foi ligado a consentimento. Acompanhar um anúncio e autorizar
um canal/finalidade são fatos diferentes; conflá-los daria consentimento implícito. Esse
fluxo exige uma ação de watchlist separada e, se a pessoa quiser e-mail/push, um opt-in
posterior e explícito.

## Validação

Os comandos e resultados executados nesta onda ficam no handoff final do orquestrador;
este arquivo descreve o contrato e não congela uma saída de teste que pode ficar obsoleta.
