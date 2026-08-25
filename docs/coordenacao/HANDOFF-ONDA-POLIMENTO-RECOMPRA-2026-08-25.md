# HANDOFF — Onda de polimento visual + loops de recompra

**Data:** 2026-08-25 · **Branch:** `codex/rf181-202-conta-reembolsos` · **Commits:** `4f00727` (checkpoint) → `51d6ef3` (entrega) · **Sessão:** Claude 3075e2de

## O QUE fiz (e POR QUE)

1. **Diagnóstico "3D sem sentido"**: porta 3000 servia `next start` de build ANTIGA (PID 13196, filho de scripts/start-next.mjs) — o dono via telas aposentadas. Matei os processos e subi `next dev` via launch.json. POR QUE: o dono julgava o produto por uma versão que não existia mais.
2. **Tema público**: ouro → **aço 250 + liquid-lime 100** (`.public-commerce-theme`), ciano 195 só informativo. POR QUE: direção explícita do dono ("tema mais tech voltado para jogos de armas; gold não é bom"); lime passa o guardrail `theme-rarity.test.ts` (≥12° de toda raridade — o verde 128 antigo reprovava). Guerra de edição com sessão Codex paralela resolvida via CLAIM.
3. **Onda 1 (5 agentes)**: nav com contagem real do carrinho + Favoritos + Vender em destaque; hero/announcement/footer com copy de desejo factual; market com chips de categoria, escassez honesta "Só N em estoque" (N real ≤5), FavoriteButton em card; detalhe com FavoriteButton (WIRING-favoritos §2), procedência em `<details>`, título display; ScreenContractPage digna (53 stubs); conta com recompra via snapshot real (RF-262/263). POR QUE: efeito dotação + fricção eram os maiores gaps de conversão apontados pela auditoria dos livros.
4. **Onda 3 (8 agentes)**: contrato favoritos↔watchlist corrigido (POST `{listingId, kind}`, DELETE por `watchlistEntryId` — opt-in nunca chegava à conta); sino com unreadCount real (nav + conta); gestalt sweep (ação só em clicável, piso .68rem, cardCta pleno em hover:none, geração morta de detalhe apagada com prova por grep, largura via `--page-max-public`); âncora "N ofertas · a partir de R$X" real no detalhe; saved-cart real + fix de corrida (ação durante CHECKING era descartada); rail POST_PURCHASE no checkout SETTLED; **motor de triggers ligado no worker** (`catalog.listing.updated` → evaluate → enqueue → markTriggered, 19 testes); `/conta/conquistas` dedicada fail-closed + docs/12 atualizado. POR QUE: auditoria Hooked deu 2/10 mecânica — arquitetura pronta, loops não fechavam na UI.
5. **Fundação minha**: `components/favorites/favorite-button.tsx` (+4 testes), reconciliações de tema, CLAIM da onda, relatório consolidado.
6. **Skill** `find-skills` instalada em `~/.claude/skills/find-skills` (clone manual; repo vercel-labs/find-skills não existe — a skill mora em vercel-labs/skills).
7. **Memória** atualizada: `midas-tema-lime-tech-e-sessao-fantasma` (tema vigente + Codex paralelo + armadilha da build antiga).

## ESTADO

**Pronto e verificado (evidência real):** web **641/641** testes · worker 26/26 · retention 64/64 · typecheck web+worker exit 0 · lint web exit 0 · funcional **45/95 dedicadas** (era 43) · DOM ao vivo: /market com 21 Favoritar + 5 "Só N" + sino + lime aplicado; detalhe com Favoritar + procedência; home com hero novo.

**Pendente:**
- E2E Playwright NÃO re-rodado nesta onda (só unit/integration) — rodar `pnpm test:e2e` com infra Podman de pé.
- Componentes 3D mortos sem consumidores (`store/overture-canvas`, `store/intro-piece`, `store/store-overture`, `landing/landing-story`, `landing/landing-model`, `landing/hero-model-canvas`, `landing/landing-viewer-invite` — conferir imports antes) — apagar em passe próprio.
- Pendências nomeadas dos agentes: EMAIL/PUSH da watchlist (falta fuso + entregador com descadastro), favoritos não migram entre dispositivos (falta endpoint de lista da conta), kicker fixo do rail pós-compra, `--page-max-public` 75rem (se o dono preferir 82, mudar o token em packages/ui/src/tokens.css:137).
- "/gra" na rajada do dono ficou ambíguo (graphify?) — grafo existente em graphify-out/ não foi regenerado.

## PRÓXIMO PASSO EXATO

1. Clicar os 2 chips criados: **rota de progressão na API** (conquistas mostra nível real sem mexer no front) e **evento de estoque no fluxo de pedidos** (BACK_IN_STOCK dispara em cancelamento).
2. `pnpm test:e2e` (com `pnpm infra:up` antes) e corrigir o que quebrar.
3. P0 das telas: `/seguranca` (SCR-PUB-010) e `/midas` (SCR-PUB-003) com conteúdo versionado; depois mensagens (anti-BOLA) e fila admin/anuncios.
4. Livros pendentes: copy mostAware na home, "minha coleção" do comprador, migração `ed-*`.

## BLOQUEIOS

- **Reviews no anúncio** — DESTRAVA COM: projeção pública de OrderReview/ReputationSummary na API.
- **Conquistas com dado real** — DESTRAVA COM: GET /v1/seller-accounts/{id}/progression no apps/api (chip criado).
- **BACK_IN_STOCK por pedido** — DESTRAVA COM: outbox de listing na transação do OrderService (chip criado).
- **PSP/Pix** — segue fail-closed por desenho até provider homologado.
- **Sessão Codex paralela** — regrava `apps/web/app/globals.css` sem coordenação; decisão de tema registrada em `CLAIM-CLAUDE-ONDA3-LOOPS-20260825.md`; se o lime sumir, é ela.
