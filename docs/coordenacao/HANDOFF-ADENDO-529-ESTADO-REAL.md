# ADENDO ao handoff — resultado REAL da onda

**Data:** 2026-08-24, madrugada
**Complementa:** [HANDOFF-ONDA-COMPRA-RETENCAO.md](HANDOFF-ONDA-COMPRA-RETENCAO.md)
**Regra de leitura:** o handoff principal descreve o *plano*. Este arquivo descreve o *resultado*. Em conflito, este vence.

---

## O evento: API Error 529 Overloaded

Foram despachadas **4 ondas / 37 agentes**. Despachar 37 em paralelo estourou a capacidade da API: **32 morreram com `API Error: 529 Overloaded`** (um com `Server error mid-response`).

| Onda | Run ID | Agentes | Concluídos | Mortos |
|---|---|---|---|---|
| 1 — compra + descoberta | `wf_ff3f683d-639` | 11 | 3 | 8 |
| 2 — retenção + PRDs | `wf_5d22fb5f-1b5` | 12 | 2 | 10 |
| 3 — template + 6 telas | `wf_6686ec9f-04b` | 7 | 0 | 7 |
| 4 — loop compra contínua | `wf_4ad58a38-a97` | 7 | 0 | 7 |

**Lição operacional (gravada em memória):** teto prático de ~15–18 agentes em voo. Acima disso, escalonar em pares de ondas.
`Workflow({scriptPath, resumeFromRunId})` recupera tudo — agente concluído volta do cache instantaneamente, só o que falhou re-roda. **Nenhum trabalho concluído foi perdido.** O 529 é falha de servidor, não de código: não existe regressão possível na retomada, só avanço.

---

## VERIFICADO POR MIM (não é relato de agente)

```
npx tsc --noEmit -p modules/orders/tsconfig.json      exit 0
npx tsc --noEmit -p modules/retention/tsconfig.json   exit 0
```

### `modules/orders` — ENTREGUE E VERDE

9 arquivos em `src/` + `migrations/0009_orders.sql`. **30 testes passando.**
Schema `orders` com 6 tabelas (`carts`, `cart_lines`, `orders`, `order_items`, `order_events`, `deliveries`), 14 índices, CHECK em todo enum, FK real para `identity.users`, `sellers.seller_accounts`, `catalog.listings`, `catalog.catalog_items`.
Migration validada contra o Postgres real (`midas-local-postgres-1`) dentro de transação com `ON_ERROR_STOP=1` e `rollback` — nada persistido.

Decisões do domínio que importam:

- `total_minor = subtotal_minor` (comprador paga o anunciado). `fee_minor` é a comissão da plataforma, vinda de `catalog.listing_commercial_snapshots.platform_fee_rate`, com fallback em `listing_plans`; sem fonte → `500 ORDER_COMMERCIAL_TERMS_UNAVAILABLE`. Nenhum número inventado.
- Reserva de 30 min (`defaultReservationMinutes`, injetável). `cancelExpiredReservations()` devolve estoque.
- Estoque atômico: `UPDATE catalog.listings SET quantity_available = quantity_available - n WHERE listing_id = ? AND quantity_available >= n RETURNING ...`; zero linhas → `409 LISTING_INSUFFICIENT_QUANTITY`.
- Idempotência por `orders.idempotency_key` UNIQUE. Replay do mesmo comprador devolve o pedido; chave de outro comprador → `409 ORDER_IDEMPOTENCY_KEY_CONFLICT`.
- `BOTH_CONFIRMED` produz `COMPLETED` + outbox `order.completed` e `funds.hold_started` (classificação `FINANCIAL`).
- `carts.currency` é NULLABLE, definida pela primeira linha adicionada; mistura de moeda → `409 CART_CURRENCY_MISMATCH`.
- Coluna `version` em `carts`, `orders` e `deliveries` para `aggregateVersion` do outbox e concorrência otimista.

### `modules/retention` — ENTREGUE E VERDE

10 arquivos + `migrations/0011_retention.sql`. **64 testes passando.** Schema `retention`, 5 tabelas.
Sem FK cruzada com orders/catalog — a ordem de migration entre módulos não é garantida; documentado no cabeçalho do SQL.

Política de lembrete como **dado exportado**, não `if` espalhado:

```
REMINDER_FREQUENCY_LIMITS = { cartRecoveryPerCart: 1, cartRecoveryPerUserTotal: 2, marketingMinimumIntervalHours: 72 }
QUIET_HOURS_WINDOW = { startHour: 21, endHour: 9 }
```

12 motivos de supressão nomeados (`CONSENT_MISSING`, `CONSENT_REVOKED`, `QUIET_HOURS`, `DEDUPE_KEY_ALREADY_USED`, `CART_ALREADY_RECOVERED`, `LISTING_UNPUBLISHED`, ...). `shouldRemind` nunca devolve booleano mudo.
Índice único de `dedupe_key` é **parcial** (`where suppressed_reason is null`): o mesmo motivo não dispara duas vezes, mas uma tentativa suprimida não queima a chave para sempre.

### Também no disco (entregue)

- `packages/ui/src/scroll-3d.{tsx,css,test.tsx}` — primitivas CSS-first, dependência zero. `index.ts` apenas acrescentado, 7 exports originais intactos.
- `apps/web/lib/copy-deck.ts` + teste que reprova termo de escassez.
- `/conta/notificacoes` e `/conta/preferencias` + `components/notifications/**` com a matriz de consentimento.
- `docs/coordenacao/WIRING-retention-domain.md`, `WIRING-retention.md`, `WIRING-notificacoes-preferencias.md`.

### Trabalho PARCIAL no disco (não verificado)

Deixado por agentes que morreram no meio. Existe, compila ou não — desconhecido:
`components/listing-wizard/**`, `components/listing-detail/**`, `components/checkout/checkout-view.tsx`, `components/seller-public/**`, `components/progression/**`, `components/cart/**`, `components/disputes/dispute-state.test.ts`, `app/vender/novo/page.tsx`.

---

## GAPS — pedidos do dono AINDA NÃO ENTREGUES

Auditoria honesta contra todas as rajadas da sessão:

1. **`21st.dev` — NÃO ENDEREÇADO.** O dono pediu "use o 21st" e isso não foi verificado nem usado em onda nenhuma. Falta checar se existe MCP/registry disponível na sessão ou se é para replicar os padrões de componente à mão.
2. **Skills `/impeccable`, `/ponytail`, `/graphify`, `/organismo-forge:site` — NÃO INVOCADAS.** A substância foi codificada nos prompts (YAGNI, tokens, hierarquia, grafo antes de editar), mas as skills nunca foram carregadas pela ferramenta Skill. O dono digitou como slash command.
3. **"cores pra converter o cara" — NÃO ENTREGUE.** Nenhuma decisão cromática de conversão foi aplicada em `packages/ui/src/tokens.css` nem em lugar algum.
4. **CRM (Twenty) + WhatsApp — DESENHADO, NÃO DESPACHADO.** Onda 5 existe só como plano.
5. **Ondas 3 e 4 — zeradas pelo 529.** Retomada segurada de propósito, para não repetir o estouro.
6. **Sem commit.** Trabalho grande não versionado, sem ponto de restauração.

---

## MARCA — RESOLVIDO E TRAVADO

Nome público do market: **OCHPOCH MARKET**, tagline "VALOR QUE CONVERGE."
Evidência convergente: `.env.example` (`BRAND_NAME` e `NEXT_PUBLIC_BRAND_NAME`), `apps/web/lib/brand.ts`, e os assets `apps/web/public/assets/brand/ochpoch-market.{glb,png}` — o GLB que o dono mandou já está no repo.
**MIDAS** é a marca-mãe e o codinome do repositório (`docs/18 §1`: MIDAS mãe, com Market / Studio / Growth / Operações como descritores, não logotipos).
O HTML **"Batalha de Biblioteca — Redenção, Pará"** anexado é **outro projeto** do dono, descartado desta onda por instrução dele.

---

## CRM E WHATSAPP — DECISÃO TÉCNICA APURADA

**Twenty CRM é AGPLv3**, com arquivos marcados `@license Enterprise` sob licença comercial paga. **Porém** existe a **"Twenty Application Exception"**: construir aplicação pelas APIs publicadas (REST, GraphQL, webhooks, SDK) fica sob licença própria, **sem disparar AGPL**. `twenty-sdk`, `twenty-client-sdk`, `twenty-ui` e `packages/twenty-apps` são **MIT**.

Arquitetura correta: **Twenty como serviço separado**, integrado por API e webhook usando o SDK MIT. Nunca vendorizar, forkar ou copiar código para dentro do monólito `UNLICENSED` — é aí que o copyleft pega.

Dois fatos do próprio repo que moldam o desenho:

- `docs/19 §5` já elegeu **Chatwoot (MIT)** como mesa omnichannel, radar "EXPERIMENTAR primeiro". Twenty é AGPL. → fazer **porta de adapter** com as duas implementações, escolha por config e não por código.
- `docs/04 §13` — **o dono já escreveu a regra**: *"não coletar agenda/contatos nem automatizar WhatsApp Web, scraping, emulador ou login de terceiros"*; só **WhatsApp Business Platform / Cloud API** com conta verificada, template aprovado, opt-in, quiet hours e webhook validado. → WhatsApp Web está fora pela spec dele. Implementar Cloud API fail-closed sem credencial.

O dono é advogado; a decisão de licença é dele. Os fatos acima ficam como insumo, não como veto.

---

## PRÓXIMO PASSO EXATO (nesta ordem)

1. Esperar as duas retomadas em voo: `wf_5d22fb5f-1b5` (10 agentes) e `wf_ff3f683d-639` (8 agentes).
2. **Commitar por frente** assim que caírem — hoje não existe ponto de restauração. Cortes sugeridos: `feat(orders)`, `feat(retention)`, `feat(ui): scroll-3d`, `feat(web): superfícies`. Commitar também o `pnpm-lock.yaml`.
3. Retomar onda 3 (`wf_6686ec9f-04b`) e onda 4 (`wf_4ad58a38-a97`) — **em par, nunca junto com outras**.
4. Conferir o bloqueio nomeado pelo agente de orders: `packages/database/src/migration-layout.ts` precisa listar `modules/orders/migrations` e `modules/retention/migrations`, senão **0009 e 0011 nunca rodam**. Um agente foi visto editando `packages/database/test/migration-layout.test.ts` — confirmar se fechou.
5. Ligar os `docs/coordenacao/WIRING-*.md` em `apps/api/src/app.ts` e `apps/api/package.json`.
6. `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build`, depois `pnpm db:migrate`.
7. Placar objetivo: `node tools/traceability/report-screen-routes.mjs --functional` — os **79 `CONTRACT_REQUIRED`** têm que cair.
8. Fechar os GAPS 1 a 4 (21st, skills, cores de conversão, onda 5 CRM).

---

## BLOQUEIOS

- **BLOQUEIO:** migrations `0009` e `0011` não rodam até `packages/database/src/migration-layout.ts` listar os dois diretórios. — **DESTRAVA COM:** `resolve(workspaceRoot, "modules/orders/migrations")` e o equivalente de retention em `defaultMigrationDirectories()`.
- **BLOQUEIO:** `pnpm-lock.yaml` está **untracked** (`??` no git) — existe no disco, 175 KB, mas nunca foi versionado. Dois agentes reportaram que "sumiu"; era `pnpm install` concorrente, falso alarme. — **DESTRAVA COM:** commitar o lockfile.
- **RISCO ALTO:** zero commits desta onda. Trabalho verificado e verde pode ser perdido por acidente. — **DESTRAVA COM:** commit imediato quando as retomadas caírem. Não commitar com agente escrevendo.
- **BLOQUEIO:** G0–G3 seguem fechados (PSP, feed de mercado, policy comercial de produção). Nenhuma tela pode afirmar pagamento ou entrega automática.
