# Runbook local — como rodar e testar o OCHPOCH MARKET

**Data:** 2026-08-24
**Para:** abrir o produto na máquina e clicar nele. Nada aqui é teoria.

---

## 1. Subir tudo

```bash
pnpm infra:up
```

Sobe os 5 serviços em Podman: `postgres:5432`, `valkey:6379`, `minio:9000-9001`, `nats:4222`, `mailpit:1025/8025`.

```bash
pnpm --filter api dev
pnpm --filter web dev
```

| Serviço | Porta | Observação |
|---|---|---|
| Web (Next.js) | **3000** | `http://localhost:3000` |
| API (Fastify) | **3001** | o web faz proxy same-origin; o navegador nunca fala direto com ela |
| Mailpit (caixa de e-mail de dev) | **8025** | `http://localhost:8025` — é onde chega o e-mail de verificação |

**Atenção:** a porta **8000 não é deste projeto**. Nesta máquina ela está ocupada por um processo Python de outro projeto do dono. A API do marketplace é a **3001**, definida por `PORT` em `apps/api/src/config.ts` e apontada por `MIDAS_API_URL` em `apps/web/.env`.

Também existe `.claude/launch.json` com os dois serviços nomeados (`web`, `api`), para reinício gerenciado.

---

## 2. Contas de teste

Criadas pelo fluxo real: `POST /v1/auth/register` → e-mail no Mailpit → `POST /v1/auth/email-verifications` → `POST /v1/auth/login`. Todas com `user_status = ACTIVE`.

| Papel | E-mail | Senha |
|---|---|---|
| Comprador | `comprador@teste.local` | `SenhaDeTeste2026!` |
| Vendedor | `vendedor@teste.local` | `SenhaDeTeste2026!` |
| **Staff / admin** | `admin@teste.local` | `SenhaDeTeste2026!` |

São contas de **desenvolvimento local**. Existem apenas no Postgres desta máquina e não têm valor fora dela.

Verificadas por comando em 2026-08-24 — as duas devolvem `204` e gravam a sessão:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:3001/v1/auth/login \
  -H "Content-Type: application/json" -H "x-midas-csrf: 1" \
  -d '{"email":"comprador@teste.local","password":"SenhaDeTeste2026!"}'
```

**O cabeçalho `x-midas-csrf: 1` é obrigatório em toda mutação** (`apps/api/src/app.ts`, `requireCsrf`). O navegador manda sozinho; script ou `curl` sem ele leva `403 CSRF_CHECK_FAILED`, que parece erro de senha e não é.

### Duas recusas que parecem bug e não são

**`429 AUTH_RATE_LIMITED` — "Aguarde antes de tentar novamente".** Há proteção contra força bruta no login. Testar em laço (script de E2E, várias tentativas seguidas) dispara o limite, e a partir daí **todo** `POST /v1/auth/login` volta 429 **sem gravar cookie**. O sintoma engana: a tela fica em `/entrar`, `document.cookie` fica vazio, e depois disso todo `/v1/me/*` responde `401 AUTHENTICATION_REQUIRED` — parece sessão quebrada, e é só o limite. Espere a janela passar antes de concluir que algo quebrou.

**`401` em `/v1/me/cart` logo após um 429.** É consequência do acima, não causa. Antes de investigar o carrinho, confirme que o login devolveu `204`.

Entrar em `http://localhost:3000/entrar`. Login devolve `204` e grava o cookie `midas_session` (`HttpOnly`, `SameSite=Lax`, 24h).

### Criar mais contas

```bash
curl -X POST http://127.0.0.1:3001/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"NOVO@teste.local","password":"SenhaDeTeste2026!","displayName":"Nome","acceptedTermsVersion":"v1"}'
```

**Pré-requisito:** o `.env` da raiz precisa de `SMTP_HOST=127.0.0.1` e `SMTP_PORT=1025`. Sem eles, `POST /v1/auth/register` devolve `503 EMAIL_DELIVERY_UNAVAILABLE` e **nenhuma conta nova pode ser criada** — o erro não diz que falta config de SMTP.

O token de verificação chega no Mailpit (`http://localhost:8025`). Copiar o `token=` do link e enviar:

```bash
curl -X POST http://127.0.0.1:3001/v1/auth/email-verifications \
  -H "Content-Type: application/json" -d '{"token":"COLE_AQUI"}'
```

### Conta de staff — para abrir `/admin/*` e `/master/*`

```bash
node tools/dev-seed/seed-staff.mjs
```

Cria `admin@teste.local` / `SenhaDeTeste2026!` pelo **fluxo real** (registro + verificação por e-mail no Mailpit) e concede o papel `DEV_PLATFORM_STAFF` com **as 12 permissões que as migrations criaram** — nenhuma inventada. Verificado: `GET /v1/admin/catalog/items/{id}/assets` responde **200** com essa conta.

Só o GRANT é aplicado por SQL, porque não existe rota para conceder papel; criar essa rota sem gate de segurança seria pior que o problema.

```bash
node tools/dev-seed/seed-staff.mjs --undo
```

Remove o papel e a atribuição. A conta continua existindo, sem permissão nenhuma.

**Por que isso importa:** `ADM` estava em 1/18 superfícies e `MST` em 1/8 — 25 telas que não podiam sequer ser abertas, porque a autorização é `default deny` e não havia conta com papel administrativo. Sem esta semente, todo trabalho em administração é escrito às cegas.

---

## 3. O que dá para ver funcionando hoje

| Rota | Estado |
|---|---|
| `/` | Loja: faixa rotativa, nav, hero curto, categorias com contagem real, grid de produto |
| `/market` | Catálogo completo com filtro, ordenação e paginação por cursor |
| `/buscar` | Busca com estado na URL e recuperação de zero-resultado |
| `/itens/:slug` | Item-base com as ofertas de cada vendedor |
| `/anuncios/:listingId` | Detalhe da oferta |
| `/carrinho` | Carrinho multivendedor |
| `/conta`, `/conta/compras`, `/conta/compras/:orderId` | Conta e compras |
| `/conta/carteira`, `/conta/reembolsos`, `/conta/seguranca` | Entregues pela sessão par |
| `/conta/avaliacoes` | Elegibilidade real; envio bloqueado com motivo |
| `/entrar`, `/cadastro` | Identidade |

Dado real no banco, medido em 2026-08-24 ao subir a stack: **33 anúncios publicados, 46 contas de vendedor**.

Sobre as **100 contas** em `identity.users`: só **duas** são utilizáveis à mão — as da tabela acima. As outras 98 terminam em `@example.test` e foram criadas por testes automatizados e de integração; não têm senha conhecida e não devem ser usadas para navegar.

Contagem viva, quando precisar conferir:

```bash
podman exec midas-local-postgres-1 psql -U midas_local -d midas_local -t -A -c "select count(*) from catalog.listings where listing_status='PUBLISHED';"
```

**50 das 95 telas ainda são stub** (`ScreenContractPage`). Abrir uma delas mostra o contrato da rota e o estado `CONTRACT_REQUIRED`. É proposital: a tela não inventa dado.

---

## 3.5 Encher a vitrine para avaliar layout

Com um anúncio só, densidade de grade, hierarquia de preço e multivendedor não podem ser julgados.

```bash
node tools/dev-seed/seed-storefront.mjs
```

Cria 6 vendedores, 20 itens e 20 anúncios `PUBLISHED`, com arte SVG gerada pelo próprio script — nada de terceiro, porque o gate **G0** segue bloqueado. Tudo nasce com o prefixo `dev-` e `game_origin = 'AMOSTRA_DEV'`. Rodar duas vezes é seguro: o script detecta o que já existe e não duplica.

```bash
node tools/dev-seed/seed-storefront.mjs --undo
```

Remove exatamente o que foi semeado, inclusive a arte gerada.

---

## 4. Gate de verificação

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
node tools/traceability/report-screen-routes.mjs --functional
```

Último resultado: **33/33** em typecheck e lint; fronteiras arquiteturais válidas; **45/95 superfícies dedicadas, 50 `CONTRACT_REQUIRED`**.

Distribuição, que é onde o trabalho está: `PUB 9/15 · ACC 11/16 · BUY 8/12 · SEL 15/17 · **ADM 1/18** · **MST 1/8** · **GRW 0/9**`.

**Armadilha:** `pnpm typecheck` com `next dev` no ar falha em
`.next/dev/types/validator.ts`. Esse arquivo é **gerado** pelo Next enquanto o
`tsc` lê — não é código do repositório. Pare o dev server antes do gate, ou o
erro parece regressão e não é.

### Fluxo de compra, verificado ponta a ponta

```
204 login · 200 vitrine · 200 carrinho · 201 adicionar item
200 agrupar por vendedor · 201 criar pedido · 200 ler pedido · 200 minhas compras
404 entrega  (correto: sem PSP não há pagamento, logo não há entrega)
409 item repetido no carrinho  (recusa correta, não bug)
```

---

## 5. Migrations

```bash
pnpm db:migrate
```

`db:migrate`, `db:check` e `pnpm --filter api dev` carregam o `.env` da raiz sozinhos desde 24/08. Antes só funcionavam com a variável exportada à mão, porque cada script roda dentro do próprio pacote e nunca enxergava o arquivo dois níveis acima.

Estado atual: `db:check` responde `migrationState: CURRENT` com **12 migrations aplicadas**.

Ordem registrada em `packages/database/src/migration-layout.ts` (11 diretórios de módulo, 12 arquivos):

```
0001 eventing · 0002 audit · 0003 identity · 0004 iam · 0005 sellers
0006 finance · 0007 catalog · 0008 catalog_authorization
0009 orders · 0011 retention · 0013 merchandising · 0015 progression
```

O teste `packages/database/test/migration-layout.test.ts` trava a contagem num número mágico de propósito: obriga decisão consciente sempre que um módulo passa a ter migration.

---

## 6. Problemas conhecidos e como sair deles

**`ChunkLoadError` no navegador.** O dev server do Next fica com chunks obsoletos depois de muita mudança de arquivo. Sintoma: a aba carrega o título mas a página não pinta.

```bash
rm -rf apps/web/.next/cache
```

Depois matar o processo da porta 3000 e subir de novo.

**Testes de integração falham pedindo `DATABASE_URL`.** Rodar `pnpm test` (que usa a config correta por pacote), não `npx vitest run apps/api` da raiz — este último pega a config da raiz e varre `dist/`.

**Rodar `npx vitest run packages/ui` da raiz falha em bloco.** Mesma causa: config da raiz, sem `jsdom`. Usar `pnpm test` ou entrar no diretório do pacote.

---

## 7. Gates fechados — o que não funciona por decisão, não por bug

- **G0** — autorização do publicador: `BLOQUEADO`. Sem ela, catálogo e operação reais não podem existir.
- **G1** — feed de mercado licenciado: `BLOQUEADO`. Por isso `/itens/:slug` não desenha gráfico de preço.
- **G2** — PSP: pendente. `/checkout` monta o resumo e o aceite, mas **não processa cobrança**. Nenhuma tela pode afirmar pagamento.
- **G3** — políticas comerciais: pendente. Taxa e prazo aparecem como "valor ainda não publicado" onde o PRD não fixou número.

Isso está escrito na interface, não escondido. Uma tela que finge pagamento é pior que uma tela bloqueada com motivo.
