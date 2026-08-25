# WIRING — `/conta/carteira/extrato` (SCR-SEL-011) e `/conta/carteira/retencoes` (SCR-SEL-012)

**Sessão:** retomada do `HANDOFF-ONDA-COMPRA-RETENCAO.md`, branch `codex/rf181-202-conta-reembolsos`.

**Arquivos de propriedade exclusiva deste trabalho:**

```
apps/web/components/wallet/hold-facts.ts
apps/web/components/wallet/hold-facts.test.ts
apps/web/components/wallet/holds-view.tsx
apps/web/components/wallet/statement-view.tsx
apps/web/app/conta/carteira/extrato/page.tsx
apps/web/app/conta/carteira/retencoes/page.tsx
docs/coordenacao/WIRING-carteira-extrato-retencoes.md
```

`/conta/carteira` (SCR-SEL-010) e `apps/web/components/account/wallet-view.tsx` **não** são deste
trabalho — são da sessão `markeplace-c4`. Nenhuma rota de API foi criada.

---

## 1. O que já é real

`GET /v1/seller-accounts/{sellerAccountId}/finance/balance` **existe**
(`apps/api/src/finance-routes.ts`, `getSellerFinancialBalance`) e responde no `sellerBalanceSchema` de
`packages/contracts/src/finance.ts`:

```ts
{
  sellerAccountId,                       // sac_<uuid>
  currency,                              // ISO-4217
  heldAmountMinor,                       // string /^[0-9]+$/
  availableAmountMinor,                  // string /^[0-9]+$/
  reservedAmountMinor,                   // string /^[0-9]+$/
  asOf                                   // ISO-8601
}
```

As duas telas leem esse contrato de verdade. `readSellerBalance()` confere **campo a campo** e
**recusa `number`** em qualquer bucket: `useApiResource` faz cast, não validação, e aqui é dinheiro.
Valor fora do formato derruba a leitura inteira em vez de renderizar número errado. `hasAmount()`
compara em `BigInt` — `"0"` e `"00"` são zero, `"-1"` e `"1,00"` são ausência, nunca positivo.

---

## 2. A política de retenção, espelhada com trava

`/conta/carteira/retencoes` explica o hold com a regra real de
`modules/finance/src/hold-policy.ts`:

- **Janela:** `HOLD_DURATION_HOURS = 168`, contadas de `settledAt` — a **liquidação do pagamento pelo
  provedor**. Não da data do pedido, não da entrega, não da conclusão.
- **Gates**, na ordem exata em que `evaluateHoldRelease()` decide:
  `HOLD_WINDOW_ACTIVE` → `ORDER_NOT_COMPLETED` → `PAYMENT_NOT_RECONCILED` → `DISPUTE_OPEN` →
  `CHARGEBACK_OPEN` → `ACCOUNT_FROZEN`.

A ordem é exibida numerada porque **o primeiro gate que bloqueia é o motivo que vale**: resolver um
gate posterior não adianta o anterior, e sugerir o contrário faria o vendedor trabalhar de graça.

Para cada motivo a tela diz o que o vendedor pode fazer — e, quando ele **não pode fazer nada**
(`HOLD_WINDOW_ACTIVE`, `PAYMENT_NOT_RECONCILED`, `ELIGIBLE`), diz isso em vez de inventar ação.
`ELIGIBLE` afirma que o ledger pode liberar, **não** que o dinheiro saiu.

### Por que é espelho, e como a duplicação é segurada

`apps/web/package.json` depende só de `@midas/ui` — não pode importar `@midas/finance`. Então a
política é duplicada, com a fonte nomeada no comentário, e `hold-facts.test.ts` **lê
`modules/finance/src/hold-policy.ts` do disco** em três testes:

1. a constante de duração continua igual;
2. o conjunto de `reasonCode` de bloqueio é exatamente o mesmo, sem sobra dos dois lados;
3. a ordem dos motivos no arquivo do domínio é a mesma da lista da interface.

Mudar o domínio quebra esses testes. É a única forma honesta de manter espelho.

---

## 3. O que falta na API

| Método | Path | Para que |
|---|---|---|
| `GET` | `/v1/sales-balance/ledger?cursor=&from=&to=&type=` | Extrato lançamento por lançamento (SCR-SEL-011) |
| `GET` | `/v1/sales-balance/holds?cursor=` | Retenção lote por lote (SCR-SEL-012) |

Colunas que o extrato precisa devolver (doc 07 SCR-SEL-011 + RF-175), com **origem por lançamento**:
bruto, comissão Midas, tarifa do provedor, ajuste (estorno/refund/chargeback/compensatório) e
líquido. Cada linha aponta para pedido, pagamento, refund, payout ou ajuste por identificador, sem
copiar o estado desses objetos.

Para os holds, o envelope precisa trazer por lote: `balanceLotId`, `orderId`, valor, moeda,
`settledAt`, `eligibleAt` e o `reasonCode` vigente — o mesmo enum do domínio, para a interface não ter
de adivinhar qual gate está bloqueando.

**Enquanto não existirem:**

- o total retido exibido é real, mas **não é distribuído entre lotes por estimativa**;
- nenhuma linha de extrato é reconstruída a partir do saldo — derivar lançamento de total é invenção;
- **não há botão de exportar**, porque exportação exige grant + step-up e o contrato de leitura nem
  existe. Botão que não gera arquivo desperdiça a confiança de quem precisa fechar o mês;
- previsão de liberação por lote não aparece: previsão não é promessa, e o doc 03 proíbe transformá-la
  em contagem regressiva.

---

## 4. Costuras

| Destino | Link emitido | Dono |
|---|---|---|
| Saldo | `/conta/carteira` (SCR-SEL-010) | `markeplace-c4` |
| Extrato ↔ Retenções | `/conta/carteira/{extrato,retencoes}` | este trabalho |
| Suporte | `/conta/suporte` | ainda `CONTRACT_REQUIRED` (stub gerado) |

Contestação de lançamento é feita por suporte, **não** por edição de saldo: nenhuma interface altera
ledger. As duas telas passam por `SellerScopeGate`, então operam sempre dentro da `SellerAccount`
selecionada — sem misturar tenants.

As duas rotas estão na `RECOMMENDATION_DENIED_PREFIXES` de
`apps/web/components/recommendations/recommendation-rail.tsx`: nenhum bloco de recomendação entra em
tela de dinheiro.

---

## 5. Evidência

```
cd apps/web
npx vitest run components/wallet                       12 testes, 12 passando
npx tsc -p tsconfig.json --noEmit                      exit 0
npx eslint components/wallet app/conta/carteira        exit 0

# raiz
pnpm lint / typecheck / test / build                   31/31 · 31/31 · 31/31 + 3/3 · 18/18
  ○ /conta/carteira/extrato
  ○ /conta/carteira/retencoes

node tools/traceability/report-screen-routes.mjs --functional
SUPERFÍCIES: 41/95 dedicadas; 54 em CONTRACT_REQUIRED
```

---

## 6. Pendências nomeadas

- **BLOQUEIO:** `GET /v1/sales-balance/ledger` e `GET /v1/sales-balance/holds` não existem. —
  **DESTRAVA COM:** publicar as duas com cursor, nos envelopes da seção 3. As telas passam a mostrar
  linha e lote **sem alteração de front**.
- **BLOQUEIO:** exportação do extrato depende de grant + step-up. — **DESTRAVA COM:** contrato de
  exportação governada com registro em auditoria.
- **PENDENTE:** `/conta/suporte` continua stub gerado, então o link de contestação leva a uma
  superfície `CONTRACT_REQUIRED`.
- **DÍVIDA NOMEADA:** as duas telas são client-side. Decidido com a `markeplace-c4` que rota
  autenticada segue assim (sem valor de SEO, `robots index:false` no layout, requisito de snapshot
  HTML é da onda 11 e vale para `SCR-PUB`, conta é perfil `M0`). Revisitar quando as telas públicas
  entrarem em SSR — decisão de arquitetura, não de tela.
