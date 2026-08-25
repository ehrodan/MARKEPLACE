# WIRING — rotas HTTP de retenção (`apps/api/src/retention-routes.ts`)

Escrito pelo agente `api-retencao`. Este agente **não** editou `apps/api/src/app.ts` nem
`apps/api/package.json` — são de outros agentes. Abaixo está o trecho literal para colar.

> O arquivo irmão `WIRING-retention-domain.md` é do agente `dominio-retencao` e trata do
> módulo `@midas/retention` (migration, permissões de job, fronteira de módulo). Este aqui
> trata só da borda HTTP.

---

## 1. Dependência de pacote

`apps/api/package.json`, bloco `dependencies` (mesma linha já pedida pelo agente de domínio;
se ele já foi aplicado, não duplicar):

```json
    "@midas/retention": "workspace:*",
```

## 2. Import em `apps/api/src/app.ts`

Junto dos outros imports de rota:

```ts
import { registerRetentionRoutes } from "./retention-routes.js";
import {
  ConsentService,
  ReminderService,
  SavedCartService,
  WatchlistService,
} from "@midas/retention";
```

## 3. Instanciação dos serviços

Ao lado de `const catalog = new CatalogService(options.database.db);`:

```ts
  const savedCarts = new SavedCartService(options.database.db);
  const watchlist = new WatchlistService(options.database.db);
  const reminders = new ReminderService(options.database.db);
  const reminderConsent = new ConsentService(options.database.db);
```

## 4. Registro das rotas

Depois de `registerCatalogRoutes(...)` — a ordem importa porque a rota de watchlist lê o
anúncio publicado pelo `CatalogService` para ancorar o preço de referência:

```ts
  registerRetentionRoutes(app, {
    savedCarts,
    watchlist,
    reminders,
    consent: reminderConsent,
    catalog,
    requireSession,
    requireCsrf: (request) => {
      requireCsrf(request, options.config);
    },
  });
```

## 5. ⚠️ BLOQUEIO — `PUT` não está liberado no CORS

`apps/api/src/app.ts`, hook `onRequest`, hoje envia:

```ts
      reply.header("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
```

`PUT /v1/me/reminder-consents` é a única rota `PUT` do corte e **o preflight vai falhar no
navegador** enquanto `PUT` não estiver nessa lista. Trocar por:

```ts
      reply.header("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
```

`DELETE` (watchlist) já está coberto. Sem essa linha, a tela de preferências de lembrete não
funciona a partir do `apps/web`, embora a rota responda normalmente a chamadas server-side.

---

## 6. Rotas entregues e guarda de cada uma

Todas as rotas exigem sessão. Todas as mutações exigem CSRF (`x-midas-csrf: 1` + origem
permitida). Nenhuma rota aceita identificador de usuário vindo do cliente: o titular é sempre
derivado do cookie de sessão.

| Método | Rota | Guarda de rota | Guarda de domínio |
|---|---|---|---|
| GET | `/v1/me/saved-cart` | `requireSession` | `assertRetentionActor` em `getActiveForUser` |
| POST | `/v1/me/saved-cart` | `requireSession` + `requireCsrf` + conferência de subtotal e moeda | `assertRetentionActor` em `saveSnapshot` |
| POST | `/v1/me/saved-cart/recover` | `requireSession` + `requireCsrf` + 403→404 | `assertRetentionActor` em `markRecovered` |
| GET | `/v1/me/watchlist` | `requireSession` + cursor | `assertRetentionActor` em `listForUser` |
| POST | `/v1/me/watchlist` | `requireSession` + `requireCsrf` + anúncio tem que estar PUBLISHED | `assertRetentionActor` em `watch` |
| DELETE | `/v1/me/watchlist/:watchlistEntryId` | `requireSession` + `requireCsrf` + 403→404 | `assertRetentionActor` em `unwatch` |
| GET | `/v1/me/notifications` | `requireSession` + cursor + filtro `unread` | `assertRetentionActor` em `listNotifications` |
| POST | `/v1/me/notifications/:notificationId/read` | `requireSession` + `requireCsrf` + 403→404 | `assertRetentionActor` em `markNotificationRead` |
| POST | `/v1/me/notifications/read-all` | `requireSession` + `requireCsrf` + teto de 200 por chamada | `assertRetentionActor` em cada marcação |
| GET | `/v1/me/reminder-consents` | `requireSession` + matriz fail-closed | `assertRetentionActor` em `listForUser` |
| PUT | `/v1/me/reminder-consents` | `requireSession` + `requireCsrf` + porta de reopt-in | `assertRetentionActor` em `grant`/`revoke` |

### 6.1 Por que existe o mapeamento 403 → 404

`assertRetentionActor` devolve **403 `RETENTION_ACTOR_MISMATCH`** quando o recurso é de outra
pessoa. Isso confirmaria a existência do identificador para quem estivesse sondando. A função
`maskForeignResource` na borda HTTP converte `RETENTION_ACTOR_MISMATCH` e qualquer 404 do
módulo na **mesma** resposta 404. Recurso alheio e recurso inexistente são indistinguíveis de
fora. Isso não afeta o 403 de CSRF, que acontece antes da chamada ao serviço.

## 7. Decisões da borda HTTP que o restante do time precisa conhecer

1. **Preço de referência nunca vem do cliente.** `POST /v1/me/watchlist` recebe só
   `{ listingId, kind, targetPriceMinor? }`. `catalogItemId`, `currency` e
   `referencePriceMinor` são lidos de `catalog.getPublishedListingByReference(listingId)`.
   Anúncio inexistente, despublicado ou tombstoned devolve 404 `LISTING_NOT_FOUND`. É o que
   impede um "de R$ X por R$ Y" com um X que nunca foi praticado.
2. **Snapshot de carrinho é conferido antes de gravar.** `subtotalMinor` tem que bater com a
   soma de `unitPriceMinor * quantity` (422 `SAVED_CART_SUBTOTAL_MISMATCH`) e todos os itens
   têm que usar a moeda do carrinho (422 `SAVED_CART_CURRENCY_MISMATCH`). Um total que não
   fecha viraria preço mentiroso na tela de retomada.
3. **O snapshot não é fonte de verdade de preço.** É continuidade de exibição. O checkout
   relê o catálogo. Divergência é diferença real, para mostrar — nunca para esconder.
4. **Ausência de consentimento é resposta explícita.** `GET /v1/me/reminder-consents` devolve
   a matriz completa 3 canais × 4 finalidades = 12 linhas. Par sem linha no livro-razão vem
   como `state: "MISSING", granted: false`. A tela nunca precisa interpretar silêncio.
5. **`policyVersion` não entra no corpo do PUT.** Quem carimba é o módulo
   (`CONSENT_POLICY_VERSION`). Versão de política declarada pelo cliente não é evidência.
   Ela volta na resposta.
6. **Reativar consentimento revogado exige `reoptIn: true`.** Se o estado corrente do par é
   `REVOKED` e o corpo pede `granted: true` sem `reoptIn`, a rota devolve 409
   `CONSENT_REOPTIN_REQUIRED`. Revogação não é desfeita por um PUT repetido de tela ou de
   script. O `reoptIn` nunca vem por padrão e nunca é inferido.
7. **`ORDER_UPDATE` está exposto no PUT.** É transacional e `requiresExplicitConsent` devolve
   `false` para ele, mas `shouldRemind` bloqueia qualquer finalidade cujo consentimento tenha
   sido revogado. Negar à pessoa o botão de revogar seria contraditório com a própria política
   do módulo. Cabe à tela deixar claro o que ela perde ao desligar aviso de pedido.
8. **A evidência de consentimento não captura PII nova.** `actorContext` já produz
   `correlationId`, `sessionId`, `ipPrefix` minimizado e `userAgentFamily` redigida; é isso e
   nada mais que vai para `buildConsentEvidence`. O campo `source` é a constante de servidor
   `"api:PUT /v1/me/reminder-consents"`, nunca um valor do cliente.

## 8. Divergências entre o contrato pedido e o módulo entregue

| Item | Pedido na tarefa | O que o módulo tem | Como ficou |
|---|---|---|---|
| `kind` da watchlist | "vigilância de preço" / "volta ao estoque" | `WATCHLIST_KINDS = PRICE_DROP, BACK_IN_STOCK, ANY_OFFER` | rota aceita os três; `targetPriceMinor` só para `PRICE_DROP` |
| Canais de consentimento | não especificados | `REMINDER_CHANNELS = EMAIL, PUSH, IN_APP` | adotados como estão |
| Finalidades | não especificadas | `REMINDER_PURPOSES = CART_RECOVERY, PRICE_WATCH, STOCK_WATCH, ORDER_UPDATE` | adotadas como estão |
| `cartId` no corpo | `{ cartId, snapshot }` | coluna `saved_carts.source_cart_id` | corpo mantém `cartId`; rota mapeia para `sourceCartId`; resposta expõe `cartId` |
| `POST /saved-cart/recover` sem corpo | marca recuperado | `markRecovered(savedCartId, actor)` exige o id | rota lê o snapshot ativo mais recente e usa o id dele; sem nenhum ativo, 404 |
| `GET /saved-cart` singular | carrinho salvo ativo | `getActiveForUser` devolve **lista** (um por `sourceCartId`) | rota devolve o mais recente; `null` quando não há |
| `read-all` | marca todas | **não existe** método em lote no `ReminderService` | rota busca até 200 não lidas e marca uma a uma; devolve `updatedCount` e `remaining` |

### 8.1 Paginação por cursor — dívida real, nomeada

`WatchlistService.listForUser` e `ReminderService.listNotifications` **não têm cursor**: a
primeira devolve a lista inteira, a segunda aceita só `limit`. As rotas honram o
`?cursor=` pedido no contrato paginando sobre o resultado já ordenado de forma estável pelo
módulo (`sliceByCursor`). Consequências, sem maquiagem:

- **watchlist**: corte exato, porque o módulo já devolve tudo. Custo = ler a lista completa
  da pessoa a cada página.
- **notificações**: sem cursor, a rota pede `limit + 1`. Com cursor, varre uma janela de
  `500`. Se o cursor já saiu dessa janela, devolve **422 `PAGINATION_CURSOR_STALE`** em vez de
  entregar outra página fingindo ser a pedida.

**Pedido ao dono do módulo:** paginação keyset nativa em ambos
(`options: { limit, cursor }`, ordenação `createdAt desc, id desc`, retorno com
`nextCursor`). Quando existir, apagar `sliceByCursor`, `notificationScanLimit` e o código
`PAGINATION_CURSOR_STALE` das rotas.

### 8.2 Outros pedidos ao dono do módulo

1. `ReminderService.markAllNotificationsRead(userId, readAt, actor)` como um único `UPDATE`.
   Hoje a rota faz N chamadas sequenciais com teto de 200, e o campo `remaining` da resposta
   existe só por causa disso.
2. `reminder-service.ts` usa o helper `notFound` com código `REMINDER_DISPATCH_NOT_FOUND`
   também quando a **notificação** não existe. A rota normaliza para `NOTIFICATION_NOT_FOUND`,
   mas o código de origem está impreciso.
3. Se a tela de preferências precisar mostrar por que um par não exige opt-in, reexportar
   `requiresExplicitConsent` e me avisar — hoje a rota não o expõe, porque não consegue
   calculá-lo para os pares que ainda não têm linha sem importar valor do módulo.

## 9. Porta estrutural — por que os tipos estão duplicados no arquivo de rotas

`apps/api/package.json` é de outro agente, então `@midas/retention` ainda não é dependência
declarada e **nenhum import de valor podia ser feito**. `retention-routes.ts` declara
`SavedCartServicePort`, `WatchlistServicePort`, `ReminderServicePort`, `ConsentServicePort` e
`WatchableCatalogPort` como tipos estruturais mínimos.

**Depois de aplicar a seção 1**, a troca é mecânica e recomendada: substituir esses tipos por

```ts
import type {
  ConsentService,
  ReminderService,
  SavedCartService,
  WatchlistService,
} from "@midas/retention";
import type { CatalogService } from "@midas/catalog";
```

e usar as classes direto em `RegisterRetentionRoutesOptions`. Os retornos declarados são o
subconjunto mínimo que os serializadores leem, então a linha real do Drizzle (com `userId`,
`version` etc. a mais) continua atribuível.

## 10. Verificação executada

Reexecutada em 2026-08-24, **depois** de `modules/retention/src/` existir em disco com os
serviços reais publicados. Comandos e saída literal:

```
$ cd apps/api && npx tsc --noEmit -p tsconfig.json
EXIT=0
```

Zero diagnósticos, saída vazia. O pacote inteiro fecha limpo — inclusive
`catalog-routes.ts`, cujo erro `isSafeCatalogAssetUri` relatado na rodada anterior já foi
resolvido pelo agente de catálogo.

```
$ npx eslint apps/api/src/retention-routes.ts
ESLINT_EXIT=0
```

Zero problemas.

### 10.1 Conferência das portas contra o módulo real

`modules/retention/src/index.ts` agora existe. As portas estruturais de
`retention-routes.ts` foram reconferidas assinatura a assinatura contra o código real, não
contra memória:

| Porta em `retention-routes.ts` | Origem real conferida | Resultado |
|---|---|---|
| `SavedCartServicePort.saveSnapshot` | `SavedCartService.saveSnapshot(SaveCartSnapshotInput, ActorContext)` | compatível; `expiresAt` opcional não é usado pela rota (TTL padrão do módulo) |
| `SavedCartServicePort.getActiveForUser` | `getActiveForUser(userId, actor): Promise<SavedCartPage>` | compatível |
| `SavedCartServicePort.markRecovered` | `markRecovered(savedCartId, actor)` | compatível |
| `WatchlistServicePort.watch` | `WatchlistService.watch(WatchInput, actor)` | campo a campo idêntico, incluindo `targetPriceMinor?: bigint \| undefined` |
| `WatchlistServicePort.unwatch` | `unwatch(watchlistEntryId, actor)` | compatível |
| `WatchlistServicePort.listForUser` | `listForUser(userId, actor, { status? })` | compatível; a rota não passa `status` |
| `ReminderServicePort.listNotifications` | `listNotifications(userId, actor, { unreadOnly?, limit? })` | compatível; retorno traz `unreadCount` real do banco |
| `ReminderServicePort.markNotificationRead` | `markNotificationRead(notificationId, readAt, actor)` | compatível |
| `ConsentServicePort.grant` / `revoke` | `ConsentService.grant(GrantConsentInput, actor)` / `revoke(RevokeConsentInput, actor)` | compatível; `{ userId, channel, purpose, source }` é exatamente o requerido, `extra` opcional não usado |
| `ConsentServicePort.listForUser` | `listForUser(userId, actor): Promise<{ data: ConsentStatus[]; asOf }>` | compatível; `ConsentStatusRecord` é subconjunto de `ConsentStatus` |
| `WatchableCatalogPort` | `CatalogService.getPublishedListingByReference(reference): Promise<ListingView \| null>` | compatível; aceita uuid **ou** slug e filtra `PUBLISHED` + não-tombstoned |

Vocabulário conferido contra `reminder-policy.ts` e `watchlist-service.ts`:
`REMINDER_CHANNELS = EMAIL, PUSH, IN_APP`; `REMINDER_PURPOSES = CART_RECOVERY, PRICE_WATCH,
STOCK_WATCH, ORDER_UPDATE`; `WATCHLIST_KINDS = PRICE_DROP, BACK_IN_STOCK, ANY_OFFER`. Os
`z.enum` das rotas batem exatamente com essas listas.

Guarda de domínio conferida em `consent.ts:69` — `assertRetentionActor` lança
**401 `AUTHENTICATION_REQUIRED`** sem ator e **403 `RETENTION_ACTOR_MISMATCH`** para recurso
de outra pessoa. É exatamente o código que `maskForeignResource` converte em 404.

Dívidas da seção 8 reconferidas e **ainda válidas** no módulo publicado: nem
`WatchlistService.listForUser` nem `ReminderService.listNotifications` aceitam cursor, e não
existe `markAllNotificationsRead`. `reminder-service.ts:639` confirma que o helper `notFound`
carimba `REMINDER_DISPATCH_NOT_FOUND` mesmo quando o ausente é uma **notificação**.

Bloqueio de CORS da seção 5 reconferido: `apps/api/src/app.ts:137` continua enviando
`"GET,POST,PATCH,DELETE,OPTIONS"`, sem `PUT`.

## 11. Estado

- **PRONTO**: `apps/api/src/retention-routes.ts` — 947 linhas, 11 rotas.
  `npx tsc --noEmit -p apps/api/tsconfig.json` → **exit 0, saída vazia**.
  `npx eslint apps/api/src/retention-routes.ts` → **exit 0**.
  Portas reconferidas contra `modules/retention/src/` real (seção 10.1).
- **PENDENTE (orquestrador)**: seções 1 a 4 — a linha em `apps/api/package.json` e os três
  trechos em `apps/api/src/app.ts`. Enquanto não forem aplicados, as rotas existem no arquivo
  mas **não estão registradas** no servidor.
- **BLOQUEIO**: `PUT` fora de `access-control-allow-methods` (`app.ts:137`) —
  **DESTRAVA COM** a linha da seção 5.
- **DÍVIDA no módulo, não nas rotas** (seção 8.1 e 8.2): sem paginação keyset em
  `listForUser`/`listNotifications` e sem `markAllNotificationsRead`. As rotas cumprem o
  contrato pedido em cima do que existe e falham de forma nomeada
  (422 `PAGINATION_CURSOR_STALE`) em vez de devolver página errada.
