# Matriz de implementação e lacunas — Midas Marketplace

Versão 2.2 · 24 de agosto de 2026 · matriz viva com evidência executável

## 1. Estado confirmado do repositório

| Camada | Estado atual | Evidência executada / limite |
|---|---|---|
| Aplicação web/PWA | **PARCIAL · VALIDADA NO CORTE** | `report-screen-routes.mjs --functional` confirmou 95/95 rotas resolvíveis, 39 superfícies dedicadas e 56 superfícies que continuam recusando operação como `CONTRACT_REQUIRED` |
| API/BFF/workers | **PARCIAL · VALIDADA NO CORTE** | identidade, SellerAccount, financeiro, Catalog/Listing e o corte de retenção expõem rotas reais; a existência desses cortes não comprova os demais domínios |
| Banco/migrações | **PARCIAL · VALIDADA NO CORTE** | `pnpm db:check` valida o PostgreSQL local em `0001–0009` e `0011`; `0007_catalog.sql` cria catálogo/listings, `0008_catalog_authorization.sql` cria permissões IAM e `0011_retention.sql` sustenta consentimentos, notificações, carrinho salvo e watchlist |
| Contratos HTTP/eventos | **PARCIAL · VALIDADA NO CORTE** | Catalog/Listing e retenção têm rotas, schemas e comandos reais; mutações relevantes persistem audit/outbox. PSP e execução bancária continuam sem adapter homologado e falham fechados |
| Testes/CI | **VALIDADA NO CORTE ATUAL** | `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` passaram globalmente; a Web executou 37 arquivos e 442 testes; o E2E passou 7/7 em desktop, mobile e WebGL. Isso valida o código presente, não as 56 superfícies ainda contratuais |
| Containers/infra local | **VALIDADA LOCALMENTE** | Podman mantém PostgreSQL, Valkey, NATS, MinIO e Mailpit com health check saudável; isso não comprova ambiente de produção |
| PRD, arquitetura e UX | **ESPECIFICADOS** | `RF-001–300`, `RNF-001–050`, 95 telas, 9 shells, 41 templates, 19 ADRs e documentos especializados |
| Diagrama navegável | **GERADO E RENDERIZADO** | `reports/MIDAS-ARQUITETURA-EXECUTAVEL.html` e `graphify-out/graph.html` |
| HTML/PDF mestre antigo | **SNAPSHOT DESATUALIZADO** | regenerar a partir da fonte 2.2 e revalidar paginação/links |

O estado agora é misto. Rota existente não significa função pronta: `tools/traceability/report-screen-routes.mjs --functional` é o gate canônico e, corretamente, ainda termina com falha enquanto houver superfície `CONTRACT_REQUIRED`. Nesta versão, 39 telas são dedicadas e 56 continuam como contrato explícito sem domínio. Nenhum handler fixo, dado inventado ou sucesso temporizado pode alterar esse estado.

### 1.1 Cortes funcionais implementados

| Corte | Estado | Limite explícito |
|---|---|---|
| Identidade + SellerAccount | **IMPLEMENTADO E TESTADO** | cadastro, verificação real por e-mail local, sessão e criação do tenant; retry de transação reconhece `40001/40P01` encapsulados pelo Drizzle e quatro cadastros concorrentes retornaram 202; passkey/MFA/device trust ainda faltam |
| Pagamento, ledger, lote e hold | **IMPLEMENTADO NO DOMÍNIO** | settlement idempotente, journal balanceado e hold de 168h; registries runtime permanecem vazios até PSP real ser contratado |
| Resolução manual de pagamento | **IMPLEMENTADO NO DOMÍNIO** | aprovação exige referência confirmada por lookup `SETTLED`; não existe atalho de liquidação manual sem evidência do provider |
| Saque manual maker-checker | **IMPLEMENTADO NO DOMÍNIO E NA UI** | solicitação, claim, aprovação, execução, evidência e confirmação; adapter bancário/Pix homologado e destino financeiro ainda faltam |
| Níveis, ranking e planos | **IMPLEMENTADO COMO POLICY PURA** | L1–L10, contribuições reversíveis, 750/1.000/1.200 bps e badge de dez vendas Premium possuem 50 testes; persistência/read model/publicação ainda faltam |
| Catálogo, assets e anúncios | **IMPLEMENTADO E TESTADO NO CORTE** | schema `0007`, autorização `0008`, itens/assets/listings reais, publicação separada, revisão, snapshot comercial, audit/outbox, leitura pública somente de anúncios publicados e assets aprovados; upload binário/object storage e pipeline 2D→3D não fazem parte deste corte |
| Marketplace e operação de catálogo | **IMPLEMENTADO E TESTADO NO CORTE** | `/market`, `/vender/novo`, `/vender/anuncios` e `/admin/catalogo` consomem API real e tratam loading/erro/vazio; detalhe público e o restante de orders ainda exigem gate próprio |
| Retenção pós-venda | **IMPLEMENTADO E TESTADO NO CORTE** | `/conta/preferencias` e `/conta/notificacoes` usam `/v1/me/reminder-consents` e `/v1/me/notifications` reais; grant/revogação são persistidos e auditáveis. Favoritos ainda não têm sincronização vertical completa e não são confundidos com consentimento |
| Landing e inspeção 3D | **IMPLEMENTADO E TESTADO** | GLB fornecido, canvas único, poster, reduced motion, controles e fallback; pipeline 2D→3D/admin Studio não existe |
| Growth, refund, reviews, Studio e omnicanal | **FORA DESTE CORTE / CONTRACT_REQUIRED ONDE INDICADO** | superfícies surgidas em ondas externas não são evidência de integração vertical até passarem domínio, autorização, persistência e testes próprios |

### 1.2 Catálogo/Listings — mapa executado

| Escopo | Contratos reais no corte | Controle comprovado |
|---|---|---|
| Público | `GET /v1/catalog/items`, `GET /v1/catalog/listing-plans`, `GET /v1/catalog/items/:slug`, `GET /v1/listings`, `GET /v1/listings/:listingRef`, `GET /v1/catalog/items/:catalogItemId/assets` | somente `PUBLISHED` chega à vitrine; item tombstoned, seller suspenso, asset não aprovado ou URI insegura não é publicado |
| Vendedor | `GET /v1/seller-accounts/:sellerAccountId/listings`, `POST /v1/listings`, `PATCH /v1/listings/:listingId`, `POST /v1/listings/:listingId/publish` | exige sessão e membership `ACTIVE`, válido e do tenant informado; leitura/mutação cross-tenant é recusada |
| Administração de catálogo | `POST /v1/admin/catalog/items`, `POST /v1/catalog/assets`, `POST /v1/admin/catalog/assets/:catalogAssetId/decide`, `GET /v1/admin/catalog/items/:catalogItemId/assets` | `catalog.items.manage`, `catalog.assets.manage` e `catalog.assets.review` são permissões persistidas por `0008`; aprovação de URI insegura falha fechada |

| Superfície | Estado executado | Limite honesto |
|---|---|---|
| `/market` | listagem pública real, filtros, ordenação, paginação e estados loading/erro/vazio | não inventa estoque, reputação ou urgência; mostra somente o que a API publicou |
| `/vender/novo` | carrega catálogo/planos, cria `DRAFT` e publica por comando separado | não faz upload binário nem contorna a permissão de assets |
| `/vender/anuncios` | lista anúncios do SellerAccount, filtra/pagina e publica elegíveis | depende do membership ativo e não acessa outro tenant |
| `/admin/catalogo[/:resourceType/:resourceId]` | cria item, registra asset e executa decisão approve/reject | cadastro de URI não substitui object storage, antivírus, licença ou geração 3D |

Evidência executada em 24 de agosto de 2026: gates globais de lint, fronteiras, typecheck, testes e build com exit 0; Web com 37 arquivos e 442 testes; Catalog com 12/12 testes unitários; integração API/PostgreSQL com 8/8 cenários, incluindo isolamento tenant; e smoke autenticado das superfícies de catálogo, vendedor e retenção. O gate funcional produziu exatamente `39/95` dedicadas e `56` `CONTRACT_REQUIRED`, portanto não fecha o PRD.

Distribuição do mesmo gate: Público 9/15, Conta 9/16, Comprador 8/12, Vendedor 11/17, Administração 1/18, Master 1/8 e Growth 0/9 superfícies dedicadas. Esses números medem superfície de rota, não completude do domínio.

## 2. Hierarquia canônica

```text
Plataforma Midas
├── User                         identidade global
│   ├── compras pessoais
│   ├── sessões, segurança e privacidade
│   └── SellerMembership ─────── atuação autorizada em um SellerAccount
├── SellerAccount               tenant comercial
│   ├── membros/grants
│   ├── anúncios e vendas
│   ├── balance lots/holds
│   ├── payouts
│   ├── campanhas/audiências consentidas
│   └── projeções Growth e Customer Insights
├── Domínios transacionais
│   ├── Catalog/Studio → Listing → Cart/CheckoutGroup → Reservation → Order
│   ├── Payment → Ledger → BalanceLot/Hold → Payout
│   └── Delivery → RefundRequest/Dispute/Ticket
└── Derivados reconstruíveis
    ├── Search/Recommendation/Minha Conta/Visão 360°
    ├── Growth buckets/contributions/timelines
    ├── Reputation/Level/Leaderboard/Attribution projections
    └── Model3DJob → Model3DArtifact → ponteiro ativo do CatalogItem
```

`SellerAccount` é o tenant; `SellerMembership` é o vínculo; Growth não cria CRM; `Model3DArtifact` não cria novo item; dashboards não criam saldo.

## 3. Unidade de entrega vertical

Uma tela só muda para implementada quando o mesmo slice contém:

```text
SCR-ID → rota React → query/command client tipado → rota OpenAPI real
       → application service → autorização server-side → repository/migration
       → outbox/audit quando aplicável → adapter real de sandbox/homologação
       → testes unitário + integração + autorização + E2E → observabilidade/runbook
```

Regras:

1. Nada de handler que retorna objeto fixo, saldo calculado no browser, progresso inventado ou sucesso por `setTimeout`.
2. Integração externa começa no sandbox oficial do provedor por uma porta/adaptador; indisponibilidade retorna problema tipado.
3. O frontend pode renderizar estado vazio real, mas não inventa venda, compra, saldo, job, métrica ou usuário.
4. Query/read model nunca autoriza mutação; o comando relê agregado, versão, membership e grant.
5. A evidência mínima por tela é `E2E-{SCR-ID}`; ações sensíveis também exigem teste negativo `AUTHZ-{SCR-ID}`.

## 4. Cobertura funcional por domínio

| Bloco | RFs contínuos | Dono canônico | Superfícies principais | Épico |
|---|---|---|---|---|
| Identidade/conta/dispositivo | `RF-001–010` | Identity / Device Trust | `SCR-ACC-001..008` | E2/E3 |
| Catálogo/ativos | `RF-011–018` | Catalog | `SCR-PUB-005`, `SCR-ADM-003` | E4 |
| Anúncios/craft | `RF-019–036` | Listings | `SCR-PUB-006`, `SCR-SEL-004..007` | E5 |
| Moderação | `RF-037–043` | Moderation | `SCR-ADM-002` | E5 |
| Descoberta/recomendação | `RF-044–052` | Search / Recommendation | `SCR-PUB-001..007` | E6/E15 |
| Preço/gráfico | `RF-053–062` | Market Data | `SCR-PUB-004..006` | E7 |
| Chat/proposta/anti-PII | `RF-063–076` | Conversation / Trust | `SCR-BUY-001..002` | E8 |
| Checkout/pedido/entrega | `RF-077–090` | Orders / Delivery / Payments | `SCR-BUY-003/006` | E9/E11 |
| Ledger/hold/saque | `RF-091–102` | Ledger / Payouts | `SCR-SEL-010..014` | E10/E12 |
| Canal Midas | `RF-103–109` | Midas Inventory | `SCR-PUB-003`, `SCR-ADM-014` | E6 |
| Ticket/mailbox | `RF-110–120` | Support / Mailbox | `SCR-BUY-008..009`, `SCR-ADM-009` | E13 |
| Master/admin/auditoria | `RF-121–132` | Administration / IAM / Audit | `SCR-ADM-*`, `SCR-MST-*` | E14 |
| Notificações/analytics base | `RF-133–138` | Notifications / Analytics Intake | `SCR-ACC-014` | E13/E17 |
| Disputa/evidência/recurso | `RF-139–148` | Disputes / Trust | `SCR-BUY-007`, `SCR-ADM-008` | E11 |
| Seller/posse/capacidade | `RF-149–157` | Seller / Listings | `SCR-SEL-001/003/007` | E4/E5 |
| Idade/privacidade/cookies | `RF-158–166` | Identity / Privacy | `SCR-ACC-004/010..012` | E2 |
| Segurança de e-mail | `RF-167–169` | Mailbox Security | `SCR-BUY-008..009` | E13 |
| Acesso/políticas/fiscal | `RF-170–175` | Policy / Finance Reporting | `SCR-PUB-011..012`, `SCR-ADM-011` | E0/E10 |
| Liquidação tardia | `RF-176–180` | Payments / Orders | `SCR-ADM-012` | E9/E10 |
| Minha Conta/capabilities | `RF-181–183` | Account Overview BFF | `SCR-ACC-005` | E2/E14 |
| Compras/pós-compra | `RF-184–188` | Orders Read Side | `SCR-BUY-004..007` | E9/E11 |
| Vendas/saldo/saque | `RF-189–194` | Seller Read Side / Ledger | `SCR-SEL-002/008..014` | E12 |
| Suporte/refund/360° | `RF-195–202` | Support / Refund / Admin BFF | `SCR-BUY-008..011`, `SCR-ADM-009..011` | E10/E13/E14 |
| Growth multi-tenant | `RF-203–211` | Growth Read Side | `SCR-GRW-001..009` | E17 |
| Pipeline/aprovação 3D | `RF-212–220` | Catalog 3D Assets | `SCR-ADM-003/015` | E18 |
| Inspeção 3D individual | `RF-221–224` | Catalog 3D Assets / Public Web | `SCR-PUB-005/006/013` | E18 |
| Payment cases/hold/saque manual | `RF-225–229` | Payments / Ledger / Payouts | `SCR-ADM-012/013`, `SCR-SEL-010..014` | E19 |
| Avaliação e reputação | `RF-230–236` | Reputation / Moderation | `SCR-ACC-015`, `SCR-ADM-016`, `SCR-PUB-007` | E19 |
| Níveis/recompensas/ranking | `RF-237–247` | Progression / Leaderboard | `SCR-PUB-014/015`, `SCR-ACC-016`, `SCR-MST-006` | E19 |
| Planos de anúncio | `RF-248–255` | Listing Commercial Policy | `SCR-SEL-004/006`, `SCR-MST-007` | E19 |
| Carrinho/lifecycle/pós-venda | `RF-256–267` | Cart / Catalog Lifecycle / Customer Insights | `SCR-BUY-012`, `SCR-SEL-015` | E20 |
| Marketing/canais/cupons/afiliados | `RF-268–282` | Customer Engagement / Promotions / Attribution | `SCR-SEL-016`, `SCR-ADM-017`, `SCR-MST-008` | E20 |
| Studio e catálogo compartilhado | `RF-283–292` | Catalog Studio / Assets | `SCR-SEL-017`, `SCR-ADM-018`, `SCR-ADM-015` | E21 |
| SEO/global/mercados | `RF-293–300` | Public Content / Market Policy / SEO | `SCR-PUB-*`, `SCR-MST-003/004` | E22 |

### 4.1. Contrato acrescentado para a tela individual

| ID | Contrato verificável | Evidência mínima |
|---|---|---|
| `RF-221` | selecionar card, item ou anúncio com modelo aprovado navega para `SCR-PUB-013` em `/itens/:slug/3d`; o slug resolve exatamente um `CatalogItem` e seu `Model3DArtifact` ativo | teste de rota com dois itens/artefatos persistidos no ambiente de integração |
| `RF-222` | deep link abre a inspeção; **Voltar** restaura a origem; trocar/sair desmonta o artefato anterior antes do próximo | E2E de card→3D→Voltar e A→B com contagem de canvas/recursos |
| `RF-223` | Three.js/R3F executa uma abertura premium única de 650–900 ms, interrompida pelo primeiro input; reduced motion salta à pose final | teste com relógio real/virtual controlado, pointer/teclado e media query |
| `RF-224` | após a abertura, a tela oferece rotação, zoom, vistas canônicas, reset e fullscreen, mantendo poster/galeria 2D quando WebGL/GLB falhar | E2E de controles, teclado, context loss e fallback |
| `RNF-036` | existe no máximo um canvas/artefato ativo; unmount ou troca libera tween/RAF, observers, listeners, geometria, materiais, texturas, loaders e renderer | instrumentação de lifecycle + soak de navegação |
| `RNF-037` | poster/DOM pintam antes do chunk/GLB; intro fica no limite 650–900 ms; cena parada usa render sob demanda e preload adjacente só ocorre dentro do budget medido | Lighthouse/Web Vitals + trace de rede/frames/memória em tiers mobile/desktop |
| `RNF-038` | input não é capturado pela intro, reduced motion remove percurso espacial e teclado/foco/fallback 2D mantêm inspeção equivalente | axe/leitor de tela/teclado/reduced-motion e testes manuais documentados |

### 4.2. Contratos acrescentados para operação completa

| Faixa | Contrato executável central | Evidência mínima |
|---|---|---|
| `RF-225–229` | webhook/reconciliação e `PaymentResolutionCase` convergem em um settlement; hold usa `settledAt + 168h`; baixa cria `PayoutAttempt`/`PayoutEvidence` | PSP sandbox/lookup real, corrida webhook×staff, relógio nas bordas, journal/postings e retry idempotente |
| `RF-230–236` | `OrderReview` bilateral 0–5, moderação/recurso e `ReputationProjection` reproduzível | testes participante/não participante/self-review/nota zero, rebuild e explicação de fatores |
| `RF-237–247` | níveis 1–10, awards e leaderboard mensal derivam de contribuições versionadas/reversíveis | tabelas de borda, refund compensatório, fechamento/replay/checksum e top 3 congelado |
| `RF-248–255` | plano Básico/VIP/Premium congela fee/prioridade/SLA e Premium aplica fórmula publicada | snapshots históricos, 7,5/10/12%, dez vendas elegíveis e prova de que priority não altera mérito de decisão |
| `RF-256–267` | carrinho multivendedor, lifecycle, relações e insights pós-venda sem PII bruta | partition/revalidation, expiry/reorder, consent gate, no-auto-add e cross-tenant negative tests |
| `RF-268–282` | campanhas/jornadas/disparos, Meta, cupom, afiliado e atribuição usam adapters/capabilities reais | conta dev Meta, opt-in/template/suppression, webhook/retry/dedupe, cupom concorrente e conversão reconciliada |
| `RF-283–292` | Studio reutiliza catálogo/listing, aceita 2D ou pipeline 3D e exige revisão/proveniência | catalog selection→same Listing, submission review, malware/license, job/artefato real e fallback 2D |
| `RF-293–300` | market/locale/currency/SEO/crawl derivam de políticas canônicas | SSR HTML, canonical/hreflang/schema tests, robots/sitemap diff, locale/currency e pages privadas noindex |
| `RNF-039–050` | segurança financeira/canais/assets, privacidade, SEO, escalabilidade, observabilidade e acessibilidade cobrem os novos domínios | suites de ameaça, carga/replay, tenant isolation, consent/retention, Lighthouse/axe e DR documentado |

## 5. Registro dos 95 contratos de tela

### 5.1 Público — 15

| SCR-ID | Rota | Contrato real mínimo | RFs | Primeira prova |
|---|---|---|---|---|
| SCR-PUB-001 | `/` | discovery query + canais/categorias + freshness | `044–052,103–109` | `E2E-SCR-PUB-001` |
| SCR-PUB-002 | `/market` | busca P2P cursorizada | `019–052` | `E2E-SCR-PUB-002` |
| SCR-PUB-003 | `/midas` | estoque/preço Midas canônicos | `103–109` | `E2E-SCR-PUB-003` |
| SCR-PUB-004 | `/buscar` | search query, filtros, sort e explicação | `044–062` | `E2E-SCR-PUB-004` |
| SCR-PUB-005 | `/itens/:slug` | catálogo + candles + ofertas + manifesto 3D; poster e link para a rota individual, sem canvas embutido | `011–018,053–062,212–222` | `E2E-SCR-PUB-005` |
| SCR-PUB-006 | `/anuncios/:listingId` | listing/craft/seller/preço + commands relacionais; link ao slug 3D, sem canvas embutido | `019–090,149–157,212–222` | `E2E-SCR-PUB-006` |
| SCR-PUB-007 | `/vendedores/:sellerAccountId` | perfil público e anúncios do SellerAccount | `044–052,149–157` | `E2E-SCR-PUB-007` |
| SCR-PUB-008 | `/ajuda` | conteúdo versionado + entrada no ticketing | `110–120,170–174` | `E2E-SCR-PUB-008` |
| SCR-PUB-009 | `/ajuda/:articleSlug` | artigo endereçável/versionado | `110–120` | `E2E-SCR-PUB-009` |
| SCR-PUB-010 | `/seguranca` | conteúdo Trust & Safety + rotas de recuperação | `001–010,063–076,139–148` | `E2E-SCR-PUB-010` |
| SCR-PUB-011 | `/politicas` | índice de políticas/versionamento | `158–175` | `E2E-SCR-PUB-011` |
| SCR-PUB-012 | `/politicas/:policySlug` | snapshot vigente/histórico/consentimento aplicável | `158–175` | `E2E-SCR-PUB-012` |
| SCR-PUB-013 | `/itens/:slug/3d` | `CatalogItem` + `Model3DArtifact` ativo; canvas único, intro finita/interrompível, controles, Voltar/descarte e fallback 2D | `212–224` | `E2E-SCR-PUB-013` |
| SCR-PUB-014 | `/ranking` | season/projection/top 3/fórmula/desempate/freshness | `244–247` | `E2E-SCR-PUB-014` |
| SCR-PUB-015 | `/recompensas` | levels/badges/rewards publicados sem prêmio inventado | `237–243,246` | `E2E-SCR-PUB-015` |

### 5.2 Identidade e conta — 16

| SCR-ID | Rota | Contrato real mínimo | RFs | Primeira prova |
|---|---|---|---|---|
| SCR-ACC-001 | `/entrar` | login/passkey/MFA/sessão | `001–010` | `E2E-SCR-ACC-001` |
| SCR-ACC-002 | `/cadastro` | registro, verificação e aceites | `001–010,158–166` | `E2E-SCR-ACC-002` |
| SCR-ACC-003 | `/recuperar-acesso` | recovery não enumerável + revogação | `001–010` | `E2E-SCR-ACC-003` |
| SCR-ACC-004 | `/verificar-idade` | sessão/status de age assurance real | `158–166` | `E2E-SCR-ACC-004` |
| SCR-ACC-005 | `/conta` | overview/capabilities derivadas | `181–183` | `E2E-SCR-ACC-005` |
| SCR-ACC-006 | `/conta/seguranca` | fatores, sessões, dispositivos e step-up | `001–010` | `E2E-SCR-ACC-006` |
| SCR-ACC-007 | `/conta/seguranca/sessoes` | query/revogação de sessões próprias | `001–010` | `E2E-SCR-ACC-007` |
| SCR-ACC-008 | `/conta/seguranca/dispositivos` | enrollment/challenge/revogação | `001–010` | `E2E-SCR-ACC-008` |
| SCR-ACC-009 | `/conta/favoritos` | projeção e comandos idempotentes de favorito | `044–052` | `E2E-SCR-ACC-009` |
| SCR-ACC-010 | `/conta/preferencias` | privacy/notification preferences versionadas | `133–138,158–166` | `E2E-SCR-ACC-010` |
| SCR-ACC-011 | `/conta/privacidade` | visão e criação de rights request | `158–166` | `E2E-SCR-ACC-011` |
| SCR-ACC-012 | `/conta/privacidade/solicitacoes/:requestId` | acompanhamento/download autorizado | `158–166` | `E2E-SCR-ACC-012` |
| SCR-ACC-013 | `/conta/recurso` | restrição, evidência e recurso | `139–148` | `E2E-SCR-ACC-013` |
| SCR-ACC-014 | `/conta/notificacoes` | inbox transacional e preferências | `133–138` | `E2E-SCR-ACC-014` |
| SCR-ACC-015 | `/conta/avaliacoes` | review bilateral/elegibilidade/reveal/moderação/recurso | `230–236` | `E2E-SCR-ACC-015` |
| SCR-ACC-016 | `/conta/conquistas` | level progress + badge/reward awards e origem | `237–243,254` | `E2E-SCR-ACC-016` |

### 5.3 Comprador — 12

| SCR-ID | Rota | Contrato real mínimo | RFs | Primeira prova |
|---|---|---|---|---|
| SCR-BUY-001 | `/mensagens` | conversations query por participante | `063–076` | `E2E-SCR-BUY-001` |
| SCR-BUY-002 | `/mensagens/:conversationId` | thread + mensagem/proposta/denúncia | `063–076` | `E2E-SCR-BUY-002` |
| SCR-BUY-003 | `/checkout/:paymentId` | reserva/order/payment-session/webhook status | `077–090,176–180,225–228` | `E2E-SCR-BUY-003` |
| SCR-BUY-004 | `/conta/compras` | purchases cursorizadas e filtradas | `184–188` | `E2E-SCR-BUY-004` |
| SCR-BUY-005 | `/conta/compras/:orderId` | order snapshot/timeline/related cases | `184–188` | `E2E-SCR-BUY-005` |
| SCR-BUY-006 | `/pedidos/:orderId/entrega` | secure package + confirmações | `077–090` | `E2E-SCR-BUY-006` |
| SCR-BUY-007 | `/pedidos/:orderId/disputa/:disputeId` | disputa/evidência/decisão/recurso | `139–148,184–188` | `E2E-SCR-BUY-007` |
| SCR-BUY-008 | `/conta/suporte` | tickets próprios + criação contextual | `110–120,195–198` | `E2E-SCR-BUY-008` |
| SCR-BUY-009 | `/conta/suporte/:ticketId` | thread/anexo/SLA/reabertura | `110–120,195–198` | `E2E-SCR-BUY-009` |
| SCR-BUY-010 | `/conta/reembolsos` | refund requests próprias cursorizadas | `199–201` | `E2E-SCR-BUY-010` |
| SCR-BUY-011 | `/conta/reembolsos/:refundRequestId` | decisão/tentativa/resultado financeiro relacionados | `188,199–201` | `E2E-SCR-BUY-011` |
| SCR-BUY-012 | `/carrinho` | Cart/lines/relations/cupom + partição em CheckoutGroups | `256–267,275–277` | `E2E-SCR-BUY-012` |

### 5.4 Vendedor — 17

| SCR-ID | Rota | Contrato real mínimo | RFs | Primeira prova |
|---|---|---|---|---|
| SCR-SEL-001 | `/vender/cadastro` | SellerAccount/onboarding/provider session | `149–157` | `E2E-SCR-SEL-001` |
| SCR-SEL-002 | `/vender` | saúde/capabilities do tenant selecionado | `181–183,189–194` | `E2E-SCR-SEL-002` |
| SCR-SEL-003 | `/vender/equipe` | membership/grants/convite/revogação | `121–132,149–157` | `E2E-SCR-SEL-003` |
| SCR-SEL-004 | `/vender/novo` | ListingRevision draft/craft/mídia/prova/plano/submissão | `019–043,149–157,248–255,283–290` | `E2E-SCR-SEL-004` |
| SCR-SEL-005 | `/vender/anuncios` | listings do SellerAccount | `019–043` | `E2E-SCR-SEL-005` |
| SCR-SEL-006 | `/vender/anuncios/:listingId` | revisão mutável + histórico/decisão | `019–043` | `E2E-SCR-SEL-006` |
| SCR-SEL-007 | `/vender/anuncios/:listingId/prova-posse` | proof upload/verify/revalidate | `149–157` | `E2E-SCR-SEL-007` |
| SCR-SEL-008 | `/conta/vendas` | sales metrics + lista por membership | `189–190` | `E2E-SCR-SEL-008` |
| SCR-SEL-009 | `/conta/vendas/:orderId` | venda/timeline/hold/casos | `184–190` | `E2E-SCR-SEL-009` |
| SCR-SEL-010 | `/conta/carteira` | balance reconciliado por buckets | `091–102,191–194` | `E2E-SCR-SEL-010` |
| SCR-SEL-011 | `/conta/carteira/extrato` | ledger espelho cursorizado | `091–102,191–194` | `E2E-SCR-SEL-011` |
| SCR-SEL-012 | `/conta/carteira/retencoes` | holds/lots/motivos/fontes | `091–102,191–192` | `E2E-SCR-SEL-012` |
| SCR-SEL-013 | `/conta/saques` | payout create/list + step-up/idempotência | `091–102,193–194` | `E2E-SCR-SEL-013` |
| SCR-SEL-014 | `/conta/saques/:payoutId` | attempts/retry/cancel/comprovante | `091–102,193–194` | `E2E-SCR-SEL-014` |
| SCR-SEL-015 | `/conta/vendas/clientes` | customer insights/lifecycle/recompra/consentimento sem PII bruta | `256–267` | `E2E-SCR-SEL-015` |
| SCR-SEL-016 | `/conta/vendas/marketing` | campaign/journey/audience/template/creative/coupon/attribution | `268–282` | `E2E-SCR-SEL-016` |
| SCR-SEL-017 | `/vender/studio` | CatalogLibrary→Listing ou CatalogSubmission; 2D/3D reais | `283–292` | `E2E-SCR-SEL-017` |

### 5.5 Administração — 18

| SCR-ID | Rota | Contrato real mínimo | RFs | Primeira prova |
|---|---|---|---|---|
| SCR-ADM-001 | `/admin` | filas/SLAs/health por grant | `121–138` | `E2E-SCR-ADM-001` |
| SCR-ADM-002 | `/admin/anuncios[/:listingId]` | claim/prova/decisão/SoD | `037–043,149–157` | `E2E-SCR-ADM-002` |
| SCR-ADM-003 | `/admin/catalogo[/:resourceType/:resourceId]` | catálogo/assets/import/conjunto de fontes `CatalogAsset`/job 3D | `011–018,212–217` | `E2E-SCR-ADM-003` |
| SCR-ADM-004 | `/admin/vendedores[/:onboardingId]` | onboarding review/decision | `149–157` | `E2E-SCR-ADM-004` |
| SCR-ADM-005 | `/admin/confianca[/:caseId]` | risco/restrição/recurso/device | `001–010,063–076,139–148` | `E2E-SCR-ADM-005` |
| SCR-ADM-006 | `/admin/usuarios[/:userId]` | 360° por seção/campo + commands autorizados | `121–132,202` | `E2E-SCR-ADM-006` |
| SCR-ADM-007 | `/admin/pedidos[/:orderId]` | order/payment/delivery/hold timeline | `077–102,176–180` | `E2E-SCR-ADM-007` |
| SCR-ADM-008 | `/admin/disputas[/:disputeId]` | claim/evidência/decisão/recurso | `139–148` | `E2E-SCR-ADM-008` |
| SCR-ADM-009 | `/admin/suporte[/:ticketId]` | inbox/thread/context 360° | `110–120,195–202` | `E2E-SCR-ADM-009` |
| SCR-ADM-010 | `/admin/reembolsos[/:refundRequestId]` | análise/decisão/execução/retry separados | `199–201` | `E2E-SCR-ADM-010` |
| SCR-ADM-011 | `/admin/financeiro[/:caseType/:caseId]` | ledger/PSP/reconciliação/refund/payout | `091–102,175–180,199–200` | `E2E-SCR-ADM-011` |
| SCR-ADM-012 | `/admin/pagamentos[/:paymentId]` | quarantine/reassociate/refund | `176–180` | `E2E-SCR-ADM-012` |
| SCR-ADM-013 | `/admin/saques[/:payoutId]` | payout review/retry/reversal | `091–102,193–194` | `E2E-SCR-ADM-013` |
| SCR-ADM-014 | `/admin/midas[/:inventoryId]` | inventory/price/publication/reconciliation | `103–109` | `E2E-SCR-ADM-014` |
| SCR-ADM-015 | `/admin/catalogo/modelos-3d/:jobId` | job/progresso/review/decision/rollback | `212–217` | `E2E-SCR-ADM-015` |
| SCR-ADM-016 | `/admin/avaliacoes[/:orderReviewId]` | review reports/moderação/recurso/rebuild de reputação | `230–236` | `E2E-SCR-ADM-016` |
| SCR-ADM-017 | `/admin/marketing[/:resourceType/:resourceId]` | channel/template/campaign/dispatch/suppression/attribution ops | `268–282` | `E2E-SCR-ADM-017` |
| SCR-ADM-018 | `/admin/studio[/:resourceType/:resourceId]` | submission/catalog/lifecycle/relation/asset review/publicação | `283–292` | `E2E-SCR-ADM-018` |

### 5.6 Master — 8

| SCR-ID | Rota | Contrato real mínimo | RFs | Primeira prova |
|---|---|---|---|---|
| SCR-MST-001 | `/master` | health/config/access/integration summary | `121–132` | `E2E-SCR-MST-001` |
| SCR-MST-002 | `/master/acessos` | roles/grants/delegação/maker-checker | `121–132` | `E2E-SCR-MST-002` |
| SCR-MST-003 | `/master/configuracoes` | config version/diff/approval/rollback | `121–132` | `E2E-SCR-MST-003` |
| SCR-MST-004 | `/master/integracoes` | adapter registry/health/secret refs | `121–132` | `E2E-SCR-MST-004` |
| SCR-MST-005 | `/master/auditoria` | audit append-only/query/export | `121–132` | `E2E-SCR-MST-005` |
| SCR-MST-006 | `/master/progressao` | level/reward/badge/leaderboard policy versions e awards | `237–247` | `E2E-SCR-MST-006` |
| SCR-MST-007 | `/master/planos-de-anuncio` | plan fee/priority/SLA version + snapshot impact | `248–255` | `E2E-SCR-MST-007` |
| SCR-MST-008 | `/master/marketing` | channel/consent/frequency/affiliate/market governance e kill switch | `268–282,293–300` | `E2E-SCR-MST-008` |

### 5.7 Growth — 9

| SCR-ID | Rota | Contrato real mínimo | RFs | Primeira prova |
|---|---|---|---|---|
| SCR-GRW-001 | `/admin/growth` | platform overview + semantic registry/freshness | `203–205` | `E2E-SCR-GRW-001` |
| SCR-GRW-002 | `/admin/growth/funil` | versioned funnel/units/conversion/duration | `204,206` | `E2E-SCR-GRW-002` |
| SCR-GRW-003 | `/admin/growth/tenants` | tenant buckets/list/filters | `203,204,207` | `E2E-SCR-GRW-003` |
| SCR-GRW-004 | `/admin/growth/tenants/:sellerAccountId` | scoped tenant detail/contributions | `203,204,207` | `E2E-SCR-GRW-004` |
| SCR-GRW-005 | `/admin/growth/membros` | membership stage list pseudonimizada | `203,204,208` | `E2E-SCR-GRW-005` |
| SCR-GRW-006 | `/admin/growth/membros/:membershipId` | scoped journey/timeline | `203,204,208` | `E2E-SCR-GRW-006` |
| SCR-GRW-007 | `/admin/growth/coortes` | versioned cohort cells/comparison | `204,209` | `E2E-SCR-GRW-007` |
| SCR-GRW-008 | `/admin/growth/interacoes` | quality/timeline/dedupe/lag | `204,210` | `E2E-SCR-GRW-008` |
| SCR-GRW-009 | `/admin/growth/oportunidades` | derived recommendations + deep links | `204,211` | `E2E-SCR-GRW-009` |

## 6. Ordem de implementação recomendada

| Onda | Resultado executável | Saída obrigatória |
|---:|---|---|
| 0 | workspace real + Podman + CI | frontend/API/worker/PostgreSQL/cache Redis ou Valkey sob health check; lint/test/build vazios não contam |
| 1 | Identity/IAM/Audit/Config | cadastro/login/passkey/MFA/sessão/membership e autorização negativa |
| 2 | Catalog/Asset + pipeline 3D base | migrations, upload seguro, import GLB, job real e `SCR-PUB-013` com canvas único/fallback |
| 3 | Listing/Craft/Moderation/Search | anúncio versionado, prova, claim/decisão, projeção de busca |
| 4 | Conversation/Offer/Order/Checkout | reserva concorrente, PSP sandbox oficial, webhook/inbox e entrega |
| 5 | Ledger/Refund/Hold/Payout | journals balanceados, reconciliação, refund e payout idempotentes |
| 6 | Minha Conta/Compras/Vendas/Saldo | read models reais com freshness e commands que revalidam fonte |
| 7 | Tickets/Disputes/Admin/Master | workbenches, contexto 360°, SoD, auditoria e runbooks |
| 8 | Payment Ops + reputação/progressão/planos | resolution cases, payout manual comprovado, reviews, levels, awards, leaderboard e commercial snapshots |
| 9 | Cart + lifecycle + pós-venda/marketing | carrinho multivendedor, consentimento, campanhas, Meta, cupom, afiliado e atribuição reconciliada |
| 10 | Studio compartilhado | CatalogLibrary, submissions, curadoria 2D/3D, lifecycle, relações e fluxo seller→listing |
| 11 | Growth multi-tenant + SEO/global | catálogo semântico, buckets, 9 telas, RLS/ABAC, market/crawl policies, SSR e replay |
| 12 | endurecimento e piloto | concorrência, carga, acessibilidade, DR, budgets, SLOs, reconciliação e rollback |

O corte atual executou parte das ondas 2 e 3: schema/serviços/autorização de Catalog/Asset/Listing, vitrine pública, criação/listagem do vendedor e operação administrativa. Isso **não** conclui essas ondas: upload seguro, moderação completa, search projection, job 2D→3D, Studio e testes E2E por `SCR-ID` permanecem. React Bits só pode entrar após o gate jurídico/técnico do componente; Three.js/R3F continua dono do canvas e nenhum efeito visual pode substituir contrato de domínio.

## 7. Lacunas concretas a partir do corte atual

1. Fechar as 56 superfícies `CONTRACT_REQUIRED` por slice vertical; o placar de 39 dedicadas não autoriza chamar o PRD de concluído.
2. Revalidar e integrar as ondas externas de orders, checkout, progressão persistida e detalhe público sem absorvê-las por inferência: cada uma precisa de domínio, authz, migration, API, teste e tela no mesmo gate. Retenção já possui corte real de consentimentos/notificações, mas favoritos continuam parciais.
3. Contratar/configurar sandboxes oficiais de PSP e adapter bancário/Pix. Enquanto registries de provider estiverem vazios, pagamento, refund e saque automático devem permanecer fail-closed.
4. Completar Catalog/Studio com object storage real, upload, análise de malware/licença, proveniência, job 2D→3D, revisão humana, rollback e fallback 2D.
5. Completar Listings com prova de posse, moderação maker-checker, projeção de busca/recomendação e E2E negativos cross-user/cross-tenant por `SCR-ID`.
6. Consolidar OpenAPI/AsyncAPI após as ondas concorrentes e falhar CI quando rota, `operationId`, evento, migration, owner ou teste ficar órfão.
7. Expandir o gate já verde para E2E negativos de autorização e isolamento nas novas superfícies; o resultado atual não substitui cobertura por `SCR-ID` nem testes de carga.
8. Implementar Growth, pós-venda, consentimento/supressão, campanhas, WhatsApp/Meta, cupom, afiliado e atribuição somente com adapters/capabilities reais; sem PII bruta e sem disparo simulado.
9. Completar observabilidade OpenTelemetry, correlação, métricas de autorização/tenant, runbooks, budgets, carga, DR, acessibilidade e E2E mobile dos novos cortes.
10. Manter SEO/indexação fail-closed até conteúdo, canonical/hreflang/schema, robots/sitemap, privacidade e política de mercado passarem gate próprio.

## 8. Gate de handoff

Uma solicitação de implementação futura deve citar pelo menos: `SCR-ID`, RFs, onda, query/command, estado/erro, permissão, evento/auditoria e teste. Exemplo válido:

> Implementar `SCR-SEL-013` (`RF-193–194`) com `POST /v1/payouts`, `Idempotency-Key`, step-up, saldo relido do ledger/PSP, estados de erro tipados, `AUTHZ-SCR-SEL-013` e `E2E-SCR-SEL-013`; sem saldo local e sem handler simulado.

Esse formato permite pedir código por slice verificável sem reabrir a arquitetura inteira e sem duplicar função existente.
