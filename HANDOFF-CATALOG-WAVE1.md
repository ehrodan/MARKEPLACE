# HANDOFF — Catálogo/Listings: corte vertical validado (E4/E5)

**Data:** 2026-08-24  
**Branch:** `codex/rf181-202-conta-reembolsos`  
**Estado:** **EXECUTADO NO CORTE · PRD PARCIAL**

Este handoff substitui o snapshot inicial da Onda 1. Catálogo, assets, anúncios e suas quatro superfícies principais estão funcionais contra API/PostgreSQL reais. O marketplace completo **não** está pronto: o gate canônico ainda aponta 56 superfícies `CONTRACT_REQUIRED` e o PSP continua fail-closed sem provider homologado.

## 1. Resultado executado

### Persistência e autorização

- `modules/catalog/migrations/0007_catalog.sql` cria `catalog_items`, `catalog_assets`, planos BASIC/VIP/PREMIUM, listings, revisions, snapshots comerciais, categorias e relações.
- `modules/catalog/migrations/0008_catalog_authorization.sql` persiste `catalog.items.manage`, `catalog.assets.manage` e `catalog.assets.review`.
- Create/update/publish/list do vendedor exigem membership `ACTIVE`, dentro da validade e do `SellerAccount` informado. A suíte de integração cobre negação cross-tenant.
- Commands persistidos mantêm audit/outbox. Publicação é comando separado da criação do draft.
- A leitura pública inclui apenas listing `PUBLISHED`, item não tombstoned, seller não suspenso e asset `APPROVED` com URI aceita pela policy. Asset pendente, rejeitado ou URI insegura não vaza para a vitrine.

### API real

| Papel | Método e rota | Estado |
|---|---|---|
| Público | `GET /v1/catalog/items` | EXECUTADO |
| Público | `GET /v1/catalog/listing-plans` | EXECUTADO |
| Público | `GET /v1/catalog/items/:slug` | EXECUTADO |
| Público | `GET /v1/listings` | EXECUTADO · somente publicados |
| Público | `GET /v1/listings/:listingRef` | EXECUTADO · aceita id/slug público |
| Público | `GET /v1/catalog/items/:catalogItemId/assets` | EXECUTADO · somente aprovados/seguros |
| Vendedor | `GET /v1/seller-accounts/:sellerAccountId/listings` | EXECUTADO · escopo tenant |
| Vendedor | `POST /v1/listings` | EXECUTADO · cria `DRAFT` |
| Vendedor | `PATCH /v1/listings/:listingId` | EXECUTADO · revisiona |
| Vendedor | `POST /v1/listings/:listingId/publish` | EXECUTADO · publica separadamente |
| Catálogo admin | `POST /v1/admin/catalog/items` | EXECUTADO · `catalog.items.manage` |
| Catálogo admin | `POST /v1/catalog/assets` | EXECUTADO · `catalog.assets.manage` |
| Catálogo admin | `POST /v1/admin/catalog/assets/:catalogAssetId/decide` | EXECUTADO · `catalog.assets.review` |
| Catálogo admin | `GET /v1/admin/catalog/items/:catalogItemId/assets` | EXECUTADO · visão de revisão |

### Superfícies Web

| Rota | Entrega real | Limite explícito |
|---|---|---|
| `/market` | consulta API, filtra, ordena, pagina e trata loading/erro/vazio | não inventa oferta, avaliação, urgência nem estoque |
| `/vender/novo` | lê itens/planos, valida, cria draft e publica por confirmação separada | não substitui upload/object storage nem concede permissão de asset ao seller |
| `/vender/anuncios` | lista o tenant, filtra/pagina e publica listing elegível | membership ativo obrigatório; subfluxos sob claim externo precisam de gate próprio |
| `/admin/catalogo[/:resourceType/:resourceId]` | cria item, registra asset e aprova/rejeita | registrar URI não comprova malware scan, licença ou pipeline 3D |

### Dados locais reais do corte

O ambiente local ficou com um conjunto de demonstração persistido, não com resposta mockada:

- item `ochpoch-market-emblem`;
- listing público `ochpoch-market-emblem-founder`, plano BASIC;
- três assets aprovados: duas imagens PNG e o GLB fornecido pelo dono;
- fixtures efêmeras dos testes foram removidas após a execução; audit append-only foi preservado e os testes agora fazem autocleanup.

## 2. Gates executados

| Gate | Resultado observado em 2026-08-24 |
|---|---|
| `node tools/traceability/report-screen-routes.mjs --functional` | 95/95 rotas resolvíveis; 39/95 dedicadas; 56 `CONTRACT_REQUIRED`. O exit não fecha enquanto houver contratos pendentes, por desenho |
| `pnpm --filter @midas/catalog typecheck` | exit 0 |
| `pnpm --filter @midas/api typecheck` | exit 0 |
| `pnpm --filter @midas/web typecheck` | exit 0 |
| `pnpm --filter @midas/catalog test` | 1 arquivo, 12/12 testes passaram |
| testes Web isolados de marketplace/admin catálogo/listagem seller | 4 arquivos, 20/20 testes passaram |
| integração Catalog/API/PostgreSQL | 1/1 arquivo passou no gate da onda; inclui autenticação, cross-tenant, publicação, assets e URI insegura |
| Podman local | PostgreSQL, Valkey, NATS, MinIO e Mailpit foram observados healthy na onda |
| `pnpm lint` | 31/31 tarefas passaram; fronteiras arquiteturais válidas |
| `pnpm typecheck` | 31/31 tarefas passaram |
| `pnpm test` | 31/31 tarefas passaram; Web com 37 arquivos e 442 testes |
| `pnpm build` | 18/18 tarefas passaram; Next gerou 79 páginas |
| API integrada/PostgreSQL | 8/8 cenários passaram no gate final |
| Playwright E2E | 7/7 passaram em desktop, mobile e WebGL; cadastro usa e-mail real no Mailpit e cria SellerAccount persistido |
| Concorrência de cadastro | 4/4 requisições simultâneas retornaram 202 após o retry reconhecer SQLSTATE `40001/40P01` encapsulado pelo Drizzle |

O gate global foi repetido após a estabilização das ondas: Progression passou 23/23, a suíte Web passou em 37/37 arquivos (442/442 testes) e o build global terminou em 18/18 tarefas. O E2E desktop/mobile revelou uma contenção serializável no rate limit; o helper transacional foi corrigido com TDD para ler o SQLSTATE encapsulado por `DrizzleQueryError`, quatro cadastros concorrentes passaram e o E2E final fechou em 7/7.

## 3. O que não foi implementado neste corte

- upload binário, object storage assinado, antivírus, licença/proveniência e pipeline 2D→3D;
- Catalog Studio compartilhado e jobs de geração/revisão/rollback;
- prova de posse, moderação completa, search index e recommendation projection;
- PSP/banco/Pix homologados. Sem credencial/provider oficial, pagamento e saque continuam fail-closed;
- 56 superfícies ainda marcadas `CONTRACT_REQUIRED` pelo gate canônico;
- conclusão das ondas externas de orders, checkout, entrega, progressão e detalhe do anúncio — arquivo presente não equivale a vertical slice validado; retenção possui um corte real de consentimentos/notificações, mas favoritos ainda não têm sincronização completa;
- E2E por todos os `SCR-ID`, carga, DR, observabilidade completa e homologação de produção.

## 4. Próximo passo exato

1. Expandir E2E autenticado de `/vender/novo`, `/vender/anuncios` e `/admin/catalogo` para usuário sem membership/permissão e tentativa cross-tenant.
2. Integrar orders/checkout e PSP somente após o gate próprio confirmar migrations, idempotência, webhook/reconciliação, journal e adapter oficial.
3. Fechar Catalog Studio por um slice separado: upload seguro → job real → revisão → asset aprovado → publicação/fallback 2D.

## 5. Bloqueios

- **PSP/Pix/banco:** requer contrato, credencial de sandbox/homologação e adapter configurado; nenhuma tela pode afirmar liquidação automática antes disso.
- **Favoritos/pós-venda:** consentimentos e notificações estão integrados; favoritos ainda não possuem sincronização vertical completa de conta.
- **Gate funcional:** 56 `CONTRACT_REQUIRED` mantêm o PRD parcial.
- **Produção:** testes locais e serviços Podman healthy não comprovam segurança, escala, observabilidade ou operação produtiva.

## 6. Arquivos centrais

- `modules/catalog/migrations/0007_catalog.sql`
- `modules/catalog/migrations/0008_catalog_authorization.sql`
- `modules/catalog/src/catalog-service.ts`
- `modules/catalog/src/asset-service.ts`
- `modules/catalog/src/authorization.ts`
- `modules/catalog/src/asset-policy.ts`
- `apps/api/src/catalog-routes.ts`
- `apps/web/components/marketplace/**`
- `apps/web/components/seller-listings/**`
- `apps/web/components/admin-catalog/**`
- `docs/12-MATRIZ-DE-IMPLEMENTACAO.md`

---

**Conclusão honesta:** o corte Catalog/Listing está implementado e testado; o marketplace global e o PRD 3.0 permanecem parciais.
