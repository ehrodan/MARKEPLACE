# WIRING — `@midas/retention` (domínio)

Escrito pelo agente `dominio-retencao`. Este agente **não** editou
`packages/database/src/migration-layout.ts`, `apps/api/src/app.ts` nem
`apps/api/package.json` — esses arquivos são de outros agentes. Abaixo está o trecho exato
para o orquestrador ligar depois.

> Nota separada: `apps/api/src/retention-routes.ts` e `docs/coordenacao/WIRING-retention.md`
> pertencem ao agente `api-retencao`. Este arquivo é o do domínio, e por isso tem nome
> distinto para não colidir.

---

## 1. Registrar a migration `0011_retention.sql`

Arquivo: `packages/database/src/migration-layout.ts`, função `defaultMigrationDirectories`.
Acrescentar como **último** item do array (retention depende de `identity`, migration 0003):

```ts
    resolve(workspaceRoot, "modules/retention/migrations"),
```

Ficando:

```ts
export function defaultMigrationDirectories(workspaceRoot = findWorkspaceRoot()): string[] {
  return [
    resolve(workspaceRoot, "modules/eventing/migrations"),
    resolve(workspaceRoot, "modules/administration-audit/migrations"),
    resolve(workspaceRoot, "modules/identity/migrations"),
    resolve(workspaceRoot, "modules/iam/migrations"),
    resolve(workspaceRoot, "modules/sellers/migrations"),
    resolve(workspaceRoot, "modules/finance/migrations"),
    resolve(workspaceRoot, "modules/catalog/migrations"),
    resolve(workspaceRoot, "modules/orders/migrations"),
    resolve(workspaceRoot, "modules/retention/migrations"),
  ];
}
```

A linha de `orders` fica a cargo do agente `orders-api`; se ela ainda não existir, adicione
apenas a de `retention`. `retention` **não** depende de `orders` (ver seção 3).

## 2. Dependência de pacote na API

Arquivo: `apps/api/package.json`, bloco `dependencies`:

```json
    "@midas/retention": "workspace:*",
```

## 3. Fronteira de módulo — por que não há FK cruzada

`modules/retention` **não** importa `@midas/orders` e **não** cria foreign key para tabelas
de pedido ou carrinho. As colunas `saved_carts.source_cart_id`, `watchlist_entries.listing_id`
e `watchlist_entries.catalog_item_id` são uuid simples, sem `references`. Motivo registrado
no cabeçalho de `modules/retention/migrations/0011_retention.sql`: a ordem de aplicação entre
`0009`, `0010` e `0011` não está garantida enquanto os módulos são construídos em paralelo,
e uma FK cruzada quebraria a migration se o alvo ainda não existisse.

A única FK mantida é `identity.users(user_id)` (migration `0003`, sempre anterior).

## 4. Autorização que a camada de API precisa aplicar

O módulo já protege por dentro tudo que é dado pessoal: `SavedCartService`,
`WatchlistService.watch/unwatch/listForUser`, `ConsentService` e o feed de notificações
chamam `assertRetentionActor(actor, userId)` — **só a própria pessoa** age sobre os próprios
lembretes (401 sem sessão, 403 para terceiros).

Estas operações são **rotinas de sistema** e **não** têm guarda de ator. Quem as expuser em
HTTP precisa exigir permissão de plataforma antes de chamar:

| Método | Uso |
|---|---|
| `SavedCartService.expireStale(now, actor, limit?)` | job de expiração de snapshots |
| `WatchlistService.evaluatePriceChange(listingId, novoPrecoMinor)` | reação a mudança real de preço |
| `WatchlistService.evaluateStockChange(listingId, quantidade)` | reação a reabastecimento real |
| `WatchlistService.markTriggered(ids, notifiedAt, actor)` | fecha vigilância já avisada |
| `ReminderService.enqueue / markSent / suppress / listPending` | fila de envio |
| `ReminderService.notify(...)` | escrita no feed in-app |

Sugestão de códigos de permissão a criar em `iam.permissions` (o módulo **não** os insere,
para não colidir com quem é dono do schema `iam`):

```sql
insert into iam.permissions (permission_code, description) values
  ('retention.jobs.run', 'Executar rotinas de retenção (expiração, avaliação, fila)'),
  ('retention.reminders.dispatch', 'Marcar lembretes como enviados ou suprimidos')
on conflict (permission_code) do nothing;
```

## 5. Contrato que o entregador de mensagem precisa honrar

Todo evento de outbox de lembrete carrega `requiresUnsubscribeLink`. Quando ele for `true`
(qualquer purpose de marketing: `CART_RECOVERY`, `PRICE_WATCH`, `STOCK_WATCH`), a mensagem
**tem** que sair com descadastro de um clique. Isso não é opcional e não é enfeite de
rodapé: é a contrapartida do opt-in registrado em `retention.reminder_consents`.

`ReminderService.enqueue` já recusa sozinho, com motivo nomeado, quando falta consentimento,
quando ele foi revogado, quando a frequência estoura, quando é janela de silêncio, quando a
chave de dedupe já disparou ou quando o assunto deixou de existir. A camada de API deve
propagar o motivo para a tela — a recusa é informação, não erro silencioso.

## 6. Fatos que o chamador precisa declarar

`retention` não lê `modules/orders` nem `catalog`. Por isso `enqueue` recebe
`subject: ReminderSubjectFact` com `listingPublished` e `priceAvailable` **declarados por
quem chama**, com o estado real consultado no módulo dono. Passar `savedCartId` faz o
próprio módulo ler `cartRecovered` e `cartItemCount` de `retention.saved_carts`.

Nunca preencher esses campos com valor otimista de conveniência: um `priceAvailable: true`
falso vira mensagem citando preço que o sistema não consegue comprovar.

## 7. Verificação executada por este agente

```
npx tsc --noEmit -p modules/retention/tsconfig.json   → exit 0, zero diagnósticos
npx vitest run modules/retention                      → 3 arquivos, 64 testes, 64 passaram
npx tsc -p modules/retention/tsconfig.json            → exit 0 (build de dist/)
```
