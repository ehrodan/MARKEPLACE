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

Criadas pelo fluxo real: `POST /v1/auth/register` → e-mail no Mailpit → `POST /v1/auth/email-verifications` → `POST /v1/auth/login`. Ambas com `user_status = ACTIVE`.

| Papel | E-mail | Senha |
|---|---|---|
| Comprador | `comprador@teste.local` | `SenhaDeTeste2026!` |
| Vendedor | `vendedor@teste.local` | `SenhaDeTeste2026!` |

São contas de **desenvolvimento local**. Existem apenas no Postgres desta máquina e não têm valor fora dela.

Entrar em `http://localhost:3000/entrar`. Login devolve `204` e grava o cookie `midas_session` (`HttpOnly`, `SameSite=Lax`, 24h).

### Criar mais contas

```bash
curl -X POST http://127.0.0.1:3001/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"NOVO@teste.local","password":"SenhaDeTeste2026!","displayName":"Nome","acceptedTermsVersion":"v1"}'
```

O token de verificação chega no Mailpit (`http://localhost:8025`). Copiar o `token=` do link e enviar:

```bash
curl -X POST http://127.0.0.1:3001/v1/auth/email-verifications \
  -H "Content-Type: application/json" -d '{"token":"COLE_AQUI"}'
```

**Não existe conta de staff/admin pronta.** IAM exige grant explícito e não há seed de papel administrativo. As telas `/admin/*` e `/master/*` continuam sob `default deny`.

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

Dado real no banco hoje: **21 anúncios publicados de 7 vendedores** — o `OCHPOCH Market Emblem` original mais 20 da semente de desenvolvimento (§3.5).

**53 das 95 telas ainda são stub** (`ScreenContractPage`). Abrir uma delas mostra o contrato da rota e o estado `CONTRACT_REQUIRED`. É proposital: a tela não inventa dado.

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

Último resultado: **32/32** em typecheck, lint e test; fronteiras arquiteturais válidas; **42/95 superfícies dedicadas, 53 `CONTRACT_REQUIRED`**.

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
