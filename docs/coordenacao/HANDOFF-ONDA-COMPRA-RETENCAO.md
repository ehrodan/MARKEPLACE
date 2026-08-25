# HANDOFF — Onda "Compra ponta a ponta + Retenção honesta"

**Data:** 2026-08-24
**Branch:** `codex/rf181-202-conta-reembolsos`
**Status:** ⚠️ **PARCIAL — ver o ADENDO no fim deste arquivo.** 4 ondas / 37 agentes despachados; **API Error 529 matou 32**. 5 completaram, 2 domínios verificados independentemente. Duas ondas retomadas do cache. Leia o ADENDO antes de qualquer coisa — o corpo abaixo descreve o *plano*, o ADENDO descreve o *resultado real*.

---

## O QUE FOI FEITO (EXECUTADO, com evidência)

### Diagnóstico do estado real do repo

Comandos rodados e saída literal:

- `node tools/traceability/report-screen-routes.mjs --functional`
  → `TOTAL: 95/95 rotas resolvíveis; 0 ausentes.`
  → `SUPERFÍCIES: 16/95 dedicadas; 79 em CONTRACT_REQUIRED.`
- `pnpm typecheck` → **exit 0** (baseline verde antes da onda)
- `podman ps` → 5 serviços no ar: postgres:5432, valkey:6379, minio:9000-9001, nats:4222, mailpit:1025/8025
- `curl 127.0.0.1:3000` → `200` · `curl 127.0.0.1:8000/health` → `404` (API viva, path de health diferente)
- Inventário de módulos: `modules/orders` com **src=0, migrations=0** — pasta vazia.

### Achado que define a onda

**`modules/orders` está vazio.** Sem ele não existe carrinho, checkout, entrega, disputa nem avaliação — é o bloqueador de 5 domínios a jusante. Era o buraco que o Codex não fechou.

### Restrições canônicas levantadas (guiaram todos os prompts)

- `docs/coordenacao/REACT-BITS-ALLOWLIST.md` → estado `EMPTY / BLOCKED_LEGAL_TECHNICAL`. **gsap, motion, ogl, framer-motion proibidos.** Logo o scroll-3D foi especificado CSS-first, dependência zero.
- `docs/07 §1.4` política de motion: `M2` expressivo só em `SCR-PUB-001..007/013`; `M0` decorativo proibido em checkout, conta, admin, master, growth.
- `docs/03 §10` regras contra design manipulativo → base da política de persuasão da onda 2.
- Gates `G0–G3` fechados: sem PSP real, sem feed de mercado, sem policy comercial em produção.

---

## POR QUE FOI FEITO ASSIM

1. **Ondas paralelas com propriedade exclusiva de arquivo.** 23 agentes no mesmo repo só não se destroem se cada um tiver uma lista fechada de arquivos. Cada prompt carrega a lista do agente *e* a lista do que é dos outros.
2. **Domínio antes de superfície.** A fase 1 de cada onda cria domínio e primitivas; a fase 2 consome do disco. `parallel()` é barreira, então a fase 2 só começa com a fase 1 gravada.
3. **Scroll-3D próprio em vez de React Bits.** A allowlist bloqueia por licença (MIT + Commons Clause) e por dependência (gsap tem licença própria). Reimplementar em CSS transform + IntersectionObserver remove o risco jurídico e o peso de bundle.
4. **Persuasão com limite jurídico.** O pedido foi "convencer o cara sempre, lembrar do carrinho". Entregue como carrinho que sobrevive, watchlist de preço/estoque e lembrete opt-in com janela de silêncio e dedupe. Escassez falsa, contagem regressiva e confirmshaming foram **proibidos por prompt e por teste automatizado** — o próprio doc 03 §10 veta, e CDC/LGPD punem.
5. **Dado fake proibido por construção.** Todo prompt exige `PageState` honesto citando o contrato quando o endpoint não existe. Um marketplace que inventa nota, taxa ou prazo tem problema legal real, não só de design.

---

## ESTADO

### PRONTO

- Diagnóstico completo do repo, com evidência colada acima.
- Onda 1 despachada: `wf_ff3f683d-639` — 11 agentes.
- Onda 2 despachada: `wf_5d22fb5f-1b5` — 12 agentes.
- Memórias gravadas: `midas-placar-telas-e-gargalo-orders`, `midas-react-bits-bloqueado`.

### PENDENTE / NÃO VERIFICADO

Tudo que os 23 agentes produzirem. **Nada foi conferido.** Os dois gates finais ainda não retornaram.

### Escopo despachado

**Onda 1 — `wf_ff3f683d-639`**

| Agente | Propriedade de arquivo |
|---|---|
| `orders-domain` | `modules/orders/**` |
| `scroll-3d-primitives` | `packages/ui/src/scroll-3d*`, `index.ts`, `styles.css` |
| `copy-deck-schwartz` | `apps/web/lib/copy-deck.ts` |
| `orders-api` | `apps/api/src/order-routes.ts`, `app.ts`, `package.json`, `packages/database/src/migration-layout.ts` |
| `tela-carrinho` | `apps/web/app/carrinho/**`, `components/cart/**` |
| `tela-compras` | `apps/web/app/conta/compras/**`, `components/purchases/**` |
| `tela-buscar` | `apps/web/app/buscar/**`, `components/search/**` |
| `tela-vendedor-publico` | `apps/web/app/vendedores/**`, `components/seller-public/**` |
| `telas-progressao` | `apps/web/app/recompensas`, `ranking`, `components/progression/**` |
| `landing-scroll-3d` | `apps/web/app/page.tsx`, `components/landing/**`, seção da landing em `globals.css` |
| `gate-verificacao` | qualquer arquivo (fase final) |

**Onda 2 — `wf_5d22fb5f-1b5`**

| Agente | Propriedade de arquivo |
|---|---|
| `dominio-retencao` | `modules/retention/**` (migration **0011**, sem FK cruzada com orders) |
| `api-retencao` | `apps/api/src/retention-routes.ts`, `docs/coordenacao/WIRING-retention.md` |
| `tela-favoritos-watchlist` | `apps/web/app/conta/favoritos`, `components/favorites/**` |
| `tela-notificacoes-consentimento` | `apps/web/app/conta/notificacoes`, `preferencias`, `components/notifications/**` |
| `prd-item-canonico` | `apps/web/app/itens/[slug]/page.tsx`, `components/item/**` |
| `prd-conteudo-confianca` | `apps/web/app/{ajuda,seguranca,politicas}/**`, `components/content/**`, `apps/web/content/**` |
| `prd-mensagens-negociacao` | `apps/web/app/mensagens/**`, `components/messages/**` |
| `prd-seo-tecnico` | `apps/web/lib/seo.ts`, `structured-data.ts`, `app/sitemap.ts`, `robots.ts` |
| `prd-growth-multitenant` | `apps/web/app/admin/growth/**`, `components/growth/**` |
| `prd-reputacao-progressao` | `apps/web/app/conta/{avaliacoes,conquistas}`, `components/reputation/**` |
| `prd-canal-midas` | `apps/web/app/midas`, `components/midas-channel/**` |
| `gate-final` | qualquer arquivo (fase final) |

**Onda 3 — `wf_6686ec9f-04b`** — despachada após metacognição achar dois buracos: (1) o template TRIAX que o dono montou em `C:\Users\ELISOR\Downloads\9\` não tinha sido passado a nenhum agente, apesar de ele ter pedido explicitamente para seguir; (2) seis telas de alto valor que o template cobre ficaram fora das ondas 1 e 2.

Uso do template foi instruído como **estrutura de informação e hierarquia, nunca código nem dado**. O protótipo é cheio de dado fictício (`Karambit`, `98% positivas`, `128 vendas`, `23h 58m 12s`) e o gate da onda 3 tem grep específico para caçar contaminação.

| Agente | Tela | Referência no template | Propriedade de arquivo |
|---|---|---|---|
| `tela-checkout` | `/checkout/:paymentId` (SCR-BUY-003) | `OrderPage.jsx` + purchase-card | `app/checkout/**`, `components/checkout/**` |
| `tela-entrega-custodia` | `/pedidos/:orderId/entrega` (SCR-BUY-006) | `OrderPage.jsx` secure-vault-card | `app/pedidos/[orderId]/entrega/**`, `components/delivery/**` |
| `tela-disputa` | `/pedidos/:orderId/disputa/:disputeId` (SCR-BUY-007) | — | `app/pedidos/[orderId]/disputa/**`, `components/disputes/**` |
| `tela-anuncio` | `/anuncios/:listingId` (SCR-PUB-006) | `ProductPage.jsx` | `app/anuncios/[listingId]/**`, `components/listing-detail/**` |
| `painel-vendas` | `/conta/vendas` + 3 sub-rotas | `SellerDashboardPage.jsx` | `app/conta/vendas/**`, `components/sales/**` |
| `wizard-anuncio` | `/vender/anuncios` + 2 sub-rotas | wizard de 5 passos | `app/vender/anuncios/**`, `components/listing-wizard/**` |
| `gate-onda3` | — | — | qualquer arquivo (fase final) |

Duas dessas telas têm **backend real já pronto** e devem funcionar ponta a ponta, não ser vitrine: o `wizard-anuncio` contra `POST /v1/listings`, `POST /v1/listings/:id/publish`, `PATCH /v1/listings/:id` e `GET /v1/catalog/listing-plans` (todos existem em `modules/catalog`), e o `painel-vendas` contra `GET /v1/seller-accounts/:id/finance/balance` (existe em `modules/finance`).

---

## PRÓXIMO PASSO EXATO

Quando as notificações dos dois workflows chegarem:

1. Ler o relatório dos dois gates (`VERDE / VERMELHO / CONSERTADO / AUDITORIA / TELAS`).
2. Rodar a verificação combinada na raiz do repo:

```bash
pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

3. Conferir o placar objetivo da onda:

```bash
node tools/traceability/report-screen-routes.mjs --functional
```

O número de `CONTRACT_REQUIRED` tem que ter caído de **79**.

4. Aplicar o wiring que os gates não tiverem ligado: ler todo `docs/coordenacao/WIRING-*.md` e colar em `apps/api/src/app.ts`, `apps/api/package.json` e `packages/database/src/migration-layout.ts`.
5. Aplicar as migrations novas no PostgreSQL local e conferir a ordem numérica — orders usa **0009**, retention usa **0011**:

```bash
pnpm db:migrate
```

6. Auditoria visual real: subir `pnpm dev`, abrir `/`, `/carrinho`, `/buscar`, `/conta/favoritos`, e conferir o scroll-3D com `prefers-reduced-motion: reduce` ligado no SO **e** com JavaScript desligado.
7. Rodar `pnpm test:e2e` e ver quais `E2E-{SCR-ID}` passaram a existir.
8. Commitar por frente, não em commit único.

---

## BLOQUEIOS

- **BLOQUEIO:** PSP real, feed de mercado e policy comercial de produção continuam fechados por G0–G3. — **DESTRAVA COM:** contrato, credencial de sandbox oficial e gate documentado por provedor. Até lá nenhuma tela pode afirmar pagamento ou entrega automática.
- **BLOQUEIO:** React Bits permanece `BLOCKED`. — **DESTRAVA COM:** preencher o bloco de gate por componente do allowlist (`legalEvidence` analisando MIT + Commons Clause e a licença de `gsap`/`motion`/`ogl` resolvidos) e aprovação formal. Até lá o scroll-3D próprio é o caminho.
- **BLOQUEIO:** indexação SEO está deliberadamente desligada (`robots index:false` em `apps/web/app/layout.tsx`). — **DESTRAVA COM:** decisão explícita do dono, com gates de conteúdo fechados. O agente de SEO foi instruído a construir tudo com interruptor por variável de ambiente, **desligado por padrão**.
- **RISCO:** 23 agentes gravando em paralelo. Conflito de arquivo é o modo de falha mais provável. Mitigação: propriedade exclusiva declarada em cada prompt + dois gates adversariais. Se colidir, `git diff` mostra e a correção é pontual.
- **RISCO:** `pnpm install` só roda nos gates. Agentes de fase 2 podem ter falhado no typecheck por pacote novo ainda não linkado — os gates rodam `pnpm install` antes de julgar.

---

## APRENDIZADO DESTA RODADA

- O placar honesto deste repo é `report-screen-routes.mjs --functional`, não "a tela existe". Rota resolvível ≠ tela pronta.
- `modules/orders` vazio era o gargalo real, não a falta de visual.
- A allowlist de React Bits é o motivo de não se instalar biblioteca de animação aqui. Não é preferência de stack, é gate jurídico registrado.
