# HANDOFF — sessão de retomada (reembolsos + segurança da conta)

**Branch:** `codex/rf181-202-conta-reembolsos` · **Data:** 2026-08-24 · **Pedido original:** “termine de
onde parou, os agentes” — retomar o `HANDOFF-ONDA-COMPRA-RETENCAO.md` depois que a onda de agentes
morreu no API Error 529.

**Sessões vivas no repo neste momento:** 3 (`markeplace-c4`, `mkt-67` e esta). Fronteira de arquivo
negociada por mensagem entre sessões — ver seção 6.

---

## 1. O QUE FIZ

### 1.1 Superfícies dedicadas novas (7)

| Tela | Screen ID | Arquivos |
|---|---|---|
| `/conta/reembolsos` | SCR-BUY-010 | `apps/web/components/refunds/refunds-view.tsx`, `apps/web/app/conta/reembolsos/page.tsx` |
| `/conta/reembolsos/:refundRequestId` | SCR-BUY-011 | `apps/web/components/refunds/refund-detail-view.tsx`, `apps/web/app/conta/reembolsos/[refundRequestId]/page.tsx` |
| `/conta/seguranca` | SCR-ACC-006 | `apps/web/components/security/security-view.tsx`, `apps/web/app/conta/seguranca/page.tsx` |
| `/conta/seguranca/sessoes` | SCR-ACC-007 | `apps/web/components/security/sessions-view.tsx`, `apps/web/app/conta/seguranca/sessoes/page.tsx` |
| `/conta/seguranca/dispositivos` | SCR-ACC-008 | `apps/web/components/security/devices-view.tsx`, `apps/web/app/conta/seguranca/dispositivos/page.tsx` |
| `/conta/carteira/extrato` | SCR-SEL-011 | `apps/web/components/wallet/statement-view.tsx`, `apps/web/app/conta/carteira/extrato/page.tsx` |
| `/conta/carteira/retencoes` | SCR-SEL-012 | `apps/web/components/wallet/holds-view.tsx`, `apps/web/app/conta/carteira/retencoes/page.tsx` |

Domínio de apoio, com teste: `apps/web/components/refunds/refund-request.ts` (+ `.test.ts`, 11
testes), `apps/web/components/security/session-facts.ts` (+ `.test.ts`, 7 testes) e
`apps/web/components/wallet/hold-facts.ts` (+ `.test.ts`, 12 testes).

**Retenções é a tela com mais fato real das sete.** `modules/finance/src/hold-policy.ts` tem a regra
codificada: janela de 168 horas contada da **liquidação do pagamento** e seis gates avaliados em
ordem determinística (`HOLD_WINDOW_ACTIVE`, `ORDER_NOT_COMPLETED`, `PAYMENT_NOT_RECONCILED`,
`DISPUTE_OPEN`, `CHARGEBACK_OPEN`, `ACCOUNT_FROZEN`). A tela explica cada gate, diz quando o
vendedor **não pode fazer nada** em vez de inventar ação, e nomeia o primeiro gate como o que vale.
`apps/web` só depende de `@midas/ui`, então a política é espelhada — e três testes leem o arquivo do
domínio e falham se duração, motivos ou ordem divergirem.

### 1.2 Correções

- `apps/web/components/sales/sale-detail-view.tsx` — repontado de
  `GET /v1/seller-accounts/{id}/orders/{orderId}` (rota redundante) para `GET /v1/orders/{orderId}`, e
  **o parser foi corrigido**: ele esperava payload plano contra o `serializeOrderDetail` aninhado
  (`{ order, items, timeline, delivery, asOf }`). Era falha 100% silenciosa — tela vazia sem motivo.
  Novo `orderDetailSource()` lê o envelope real e ainda aceita o plano. Teste novo:
  `sale-detail-view.test.ts`, 4 testes.
- Lint: `components/checkout/checkout-view.tsx:238` (index -1 do `findIndex` — ternário mantido de
  propósito, ver seção 4), `components/sales/sales-dashboard.tsx:313`, `lib/scroll-reveal.ts:46`,
  `components/security/sessions-view.tsx:125`.
- `apps/api/src/adapters/mercadopago-payment-adapter.ts` — guarda `paymentId === undefined` em cima de
  `toPaymentReference()` (que devolve `string | undefined`). Correção de type-safety numa edição minha
  anterior, feita antes de a fronteira com a outra sessão existir.

### 1.3 Documentação de costura

- `docs/coordenacao/WIRING-reembolsos.md` — contrato que a API precisa publicar para as duas telas de
  reembolso, com envelope, estados e as regras que o backend não pode quebrar.
- `docs/coordenacao/WIRING-seguranca-conta.md` — o mesmo para segurança, incluindo as rotas de
  revogação e os campos que faltam no `sessionSchema`.
- `docs/coordenacao/WIRING-carteira-extrato-retencoes.md` — `/v1/sales-balance/ledger` e
  `/v1/sales-balance/holds` com os envelopes esperados, e como o espelho da política de retenção é
  travado por teste que lê o arquivo do domínio.

### 1.4 Memória de projeto atualizada

`~/.claude/projects/C--Users-ELISOR-Desktop-MARKEPLACE/memory/`:
`midas-placar-telas-e-gargalo-orders.md` (trilha do placar + risco de repo sem commit) e
`midas-sessoes-paralelas-fronteira.md` (protocolo de fronteira entre sessões paralelas), com a linha
no `MEMORY.md`.

---

## 2. POR QUE FIZ ASSIM

- **Reembolso separa três fatos** (solicitação → decisão → execução no PSP) porque o doc 07 exige
  “sem confundir workflow humano com refund financeiro”. `APPROVED` diz por extenso que aprovação não
  é dinheiro devolvido; só `COMPLETED` afirma devolução. Aprovado com tentativa `FAILED` renderiza as
  duas coisas ao mesmo tempo. Se a tela fundir os dois, o comprador lê “aprovado” e acha que o
  dinheiro caiu.
- **Nenhum número inventado.** `approvedAmountMinor` nunca é deduzido do solicitado (há teste que
  falha se isso aparecer). Sem prazo, sem percentual, sem valor elegível calculado no browser: G2
  está fechado, não existe execução real, e número inventado em tela de reembolso é problema de CDC,
  não de UX.
- **`null` ≠ `[]`** em toda parte: “o contrato não expôs” e “o servidor afirmou que não há” são
  frases diferentes na tela. É a espinha do repo.
- **Filtro de reembolso vai ao servidor** (`?status=`), não recorta a página carregada — o contrato
  aceita o parâmetro.
- **Sem botão que não executa.** Não existe `DELETE /v1/me/sessions/{id}`; a tela de sessões diz isso
  em vez de oferecer revogação falsa. Em tela de segurança, botão morto é pior que ausência
  declarada: o usuário acredita ter protegido a conta.
- **Não peguei os 7 stubs de `master/**`** de propósito: nenhum endpoint admin existe
  (`/v1/admin/roles`, `/v1/admin/audit`, ConfigRegistry, integrações — nada no `app.ts`). Sete cascas
  derrubariam `CONTRACT_REQUIRED` sem entregar tela, ou seja, maquiariam o placar.

---

## 3. ESTADO — evidência, não relato

```
pnpm typecheck    31/31 successful                                    exit 0
pnpm lint         31/31 + "Fronteiras arquiteturais válidas."         exit 0
pnpm test         31/31 + check-boundaries 3/3 pass                   exit 0
pnpm build        18/18 successful                                    exit 0

cd apps/web && npx vitest run components/security components/refunds components/sales components/wallet
                  5 arquivos, 42 testes, 42 passando

pnpm db:migrate   {"applied":[],"existing":["0001_eventing.sql","0002_audit.sql","0003_identity.sql",
                  "0004_iam.sql","0005_sellers.sql","0006_finance.sql","0007_catalog.sql",
                  "0008_catalog_authorization.sql","0009_orders.sql","0011_retention.sql"]}

node tools/traceability/report-screen-routes.mjs --functional
                  TOTAL: 95/95 rotas resolvíveis; 0 ausentes.
                  SUPERFÍCIES: 41/95 dedicadas; 54 em CONTRACT_REQUIRED.
```

Rotas novas confirmadas no manifest do build:
`○ /conta/reembolsos` · `ƒ /conta/reembolsos/[refundRequestId]` · `○ /conta/seguranca` ·
`○ /conta/seguranca/dispositivos` · `○ /conta/seguranca/sessoes` · `○ /conta/carteira/extrato` ·
`○ /conta/carteira/retencoes`.

Trilha do placar nesta onda: **16/95 (79 CONTRACT_REQUIRED) → 31/95 (64) → 39/95 (56) → 41/95 (54)**.

### Ambiente

Criei `.env` na raiz com `DATABASE_URL` montado a partir de `infra/podman/.runtime.env`
(`postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@127.0.0.1:5432/midas_local`). `.env` está no
`.gitignore` (linhas 12–13), não entra em commit. Sem esse arquivo, `pnpm db:migrate` não roda.
Containers no ar: `midas-local-{postgres,valkey,nats,minio,mailpit}`.

---

## 4. PRÓXIMO PASSO EXATO

1. **Autorização de commit é do dono.** O repo tem 4 commits, todos de docs; `apps/`, `modules/` e
   `packages/` **nunca foram versionados** — `git status --porcelain` = 52 entradas. Não há ponto de
   restauração para o código inteiro. Quando ele autorizar, a sessão `markeplace-c4` commita em
   poucos commits grandes (ela tem o contexto das duas ondas) — combinado entre as sessões para não
   haver dois committers.
2. Próxima superfície: `/conta/suporte[/:ticketId]` (sem endpoint, mas é destino de link do reembolso
   e das retenções), depois `/conta/privacidade` e `/conta/recurso`. Carteira já está feita.
3. `pnpm test:e2e` **nunca rodou nesta onda**. Rodar só depois do sinal da `markeplace-c4` — enquanto
   ela escreve em `apps/web`, o resultado é instável.
4. Auditoria visual pendente: subir `pnpm dev` e conferir `/conta/reembolsos`,
   `/conta/seguranca/sessoes` e `/conta/carteira/retencoes` com `prefers-reduced-motion: reduce`.
   **Sem JavaScript deixou de ser bloqueio**: decidido com a sessão `markeplace-c4` que rota
   autenticada é client-side mesmo — não tem valor de SEO, `apps/web/app/layout.tsx` já declara
   `robots index:false`, o requisito de snapshot HTML do doc 07 é da onda 11 e vale para `SCR-PUB`, e
   conta é perfil `M0`. Fica como dívida nomeada, a revisitar quando as telas públicas entrarem em SSR
   de verdade — aí é decisão de arquitetura, não de tela.
5. Se a API publicar as rotas dos dois WIRING docs, as telas passam a funcionar **sem alteração de
   front**. Nada a mudar do lado do cliente.

---

## 5. BLOQUEIOS

- **BLOQUEIO:** `GET /v1/me/refund-requests`, `GET /v1/refund-requests/{id}` e
  `POST /v1/orders/{orderId}/refund-requests` não existem. — **DESTRAVA COM:** publicar as três no
  envelope de `WIRING-reembolsos.md` §1.
- **BLOQUEIO:** revogação de sessão não existe. — **DESTRAVA COM:**
  `DELETE /v1/me/sessions/{sessionId}` e `POST /v1/me/sessions/revoke-others`, idempotentes, com
  step-up.
- **BLOQUEIO:** `sessionSchema` sem sinais de origem/uso, então `SCR-ACC-007` não cumpre “sinais
  suficientes para revogação” do doc 07. — **DESTRAVA COM:** `lastSeenAt`, `createdIp` mascarado,
  `userAgentFamily`, `approximateLocation` em `packages/contracts/src/account.ts`.
- **BLOQUEIO:** passkey, TOTP, troca de senha e `GET /v1/me/devices` sem contrato. — **DESTRAVA COM:**
  os quatro paths de `WIRING-seguranca-conta.md` §3.
- **BLOQUEIO:** `GET /v1/sales-balance/ledger?cursor=` e `GET /v1/sales-balance/holds?cursor=` não
  existem, então extrato lançamento-por-lançamento e retenção lote-por-lote não são exibidos. O
  total retido é real (vem de `finance/balance`); a distribuição por lote NÃO é estimada. —
  **DESTRAVA COM:** publicar as duas rotas com cursor.
- **BLOQUEIO:** execução financeira real depende de G2 (PSP). Nenhuma tela pode afirmar devolução até
  lá. — **DESTRAVA COM:** credencial de sandbox homologada e gate documentado por provedor.
- **BLOQUEIO:** commit do código inteiro depende de autorização do dono (item 1 da seção 4).
- **RISCO:** `apps/web/app/conta/seguranca/**` e `components/security/**` foram declarados meus por
  mensagem, mas a fronteira é acordo entre sessões, não trava técnica. Antes de editar, `ListAgents` +
  `stat -c '%y %n' <arquivo>`.
- **PENDENTE:** a sessão `mkt-67` nunca respondeu à negociação de fronteira. O que ela edita é
  desconhecido — conferir mtime antes de tocar qualquer arquivo fora da faixa listada abaixo.

---

## 6. FRONTEIRA ACORDADA ENTRE SESSÕES

**`markeplace-c4`:** `apps/api/**` (PSP, `app.ts`, `*-routes.ts`, `package.json`, testes de
integração), `packages/database/src/migration-layout.ts`, `packages/ui/**`,
`apps/web/components/account/**`, `apps/web/lib/{api-types,order-status,price-framing}.ts`,
`/buscar` (SCR-PUB-004), `/itens/[slug]` (SCR-PUB-005) e a lista de telas de
`HANDOFF-ADENDO-529-ESTADO-REAL.md`.

**Esta sessão:** `apps/api/src/adapters/**`, `apps/api/test/**`, `apps/api/src/{config,server,migrate}.ts`,
`apps/api/src/http/**`, `tools/**`, `apps/web/components/{refunds,security,wallet,sales,checkout,operations,admin-catalog,viewer,seller-listings,auth}/**`,
`apps/web/app/{conta/reembolsos,conta/seguranca,conta/carteira/extrato,conta/carteira/retencoes,entrar,cadastro,recuperar-acesso,master}/**`,
`apps/web/lib/scroll-reveal.ts`.

**Sem dono, não pegar sem avisar:** `modules/merchandising` (especificado, nunca construído), onda do
template TRIAX (checkout, entrega/custódia, disputa, anúncio, painel de vendas, wizard), CRM (Twenty
por API/SDK — AGPL, nunca vendorizar) + WhatsApp Cloud API, 21st.dev (o dono pediu e ninguém
endereçou), cores de conversão em `tokens.css`, e os 7 stubs de `master/**`.

---

## 7. AUDITORIA DESTE HANDOFF

Conferido contra o pedido (“termine de onde parou”) e contra o `PRÓXIMO PASSO EXATO` do handoff
anterior, item por item:

| Item do handoff anterior | Situação |
|---|---|
| 1. Ler relatório dos gates | Gates morreram no 529; estado remedido do zero por comando |
| 2. `pnpm install && typecheck && lint && test && build` | Feito, tudo exit 0, saída colada na §3 |
| 3. Placar `--functional` caiu de 79 | Caiu para 54 |
| 4. Aplicar wiring dos `WIRING-*.md` | Retention já estava aplicado (dep, `registerRetentionRoutes`, `PUT` no CORS); os três docs novos são meus |
| 5. `pnpm db:migrate` com ordem 0009/0011 | Feito; `migration-layout.ts` já continha as duas linhas (conteúdo conferido, não exit code) |
| 6. Auditoria visual com reduced-motion e sem JS | **NÃO FEITO** — nomeado como pendência 4 da §4 |
| 7. `pnpm test:e2e` | **NÃO FEITO** — travado por acordo entre sessões, pendência 3 da §4 |
| 8. Commitar por frente | **NÃO FEITO** — depende de autorização do dono, §4 item 1 |

Esquecidos clássicos varridos: arquivos salvos (sim), evidência colada (sim), teste rodado (sim, 42
testes nos meus 5 arquivos), migrations aplicadas (sim), memória de projeto atualizada com o placar
41/95 (sim), caso vazio/erro/fora-de-contrato coberto nas 7 telas (sim, com teste), dependência de
rota nova (nenhuma criada), `.env` documentado (§3), outra sessão avisada (sim, 8 mensagens),
`WIRING` escrito para as 3 frentes (sim — reembolsos, segurança e carteira),
`RECOMMENDATION_DENIED_PREFIXES` respeitada nas telas de dinheiro (sim), mobile/reduced-motion
(**pendência nomeada**, não silenciada), sem-JavaScript (**dívida decidida** com a `markeplace-c4`,
não bloqueio).

Buracos que a auditoria encontrou nesta rodada e que já foram consertados: faltava o `WIRING` da
carteira (escrito), o número do placar na memória de projeto estava em 39/95 (corrigido para 41/95) e
a tabela acima citava 56 `CONTRACT_REQUIRED` (corrigido para 54).

**Não fechado, e é o único item que nenhuma sessão pode resolver:** autorização de commit do dono.
