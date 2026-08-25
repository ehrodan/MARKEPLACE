# WIRING — `/conta/reembolsos` (SCR-BUY-010) e `/conta/reembolsos/:refundRequestId` (SCR-BUY-011)

**Sessão:** retomada do handoff `HANDOFF-ONDA-COMPRA-RETENCAO.md`, branch `codex/rf181-202-conta-reembolsos`.

**Arquivos de propriedade exclusiva deste trabalho:**

```
apps/web/components/refunds/refund-request.ts
apps/web/components/refunds/refunds-view.tsx
apps/web/components/refunds/refund-detail-view.tsx
apps/web/components/refunds/refund-request.test.ts
apps/web/app/conta/reembolsos/page.tsx
apps/web/app/conta/reembolsos/[refundRequestId]/page.tsx
docs/coordenacao/WIRING-reembolsos.md
```

Nenhum arquivo fora desta lista foi alterado. **Nenhuma rota de API foi criada**, portanto não há
trecho a colar em `apps/api/src/app.ts` nem linha nova em `apps/api/package.json`. O que segue é o
contrato que as duas telas consomem e as regras que o backend precisa honrar quando publicá-lo.

---

## 1. Endpoints consumidos (ainda não publicados pela API)

Fonte: `docs/01-PRD-MIDAS.md` (lista canônica de rotas, RF-199/RF-200) e
`docs/07-MAPA-DE-TELAS-E-FLUXOS.md` (SCR-BUY-010, SCR-BUY-011).

| Método | Path | Uso |
|---|---|---|
| `GET` | `/v1/me/refund-requests?cursor=&limit=&status=` | Lista do solicitante. Filtro de estado é **server-side**. |
| `GET` | `/v1/refund-requests/{refundRequestId}` | Detalhe, decisão e tentativas de execução. |
| `POST` | `/v1/orders/{orderId}/refund-requests` | Criação. **A tela de lista não cria** — a solicitação nasce no pedido. |
| `GET` | `/v1/orders/{orderId}` | **Já existe.** É a fonte do estado do pedido; a tela de reembolso não o deduz. |

Enquanto os três primeiros não existirem, as telas mostram `PageState kind="unavailable"` citando o
contrato por extenso. Nenhuma solicitação, valor, prazo ou contagem fictícia aparece em nenhum
estado — inclusive no estado de erro.

### Formas esperadas (fonte: `refund-request.ts`)

```ts
// GET /v1/me/refund-requests
interface RefundRequestPage {
  data: RefundRequestRow[];
  nextCursor?: string | null;
  asOf?: string;                    // ISO-8601. Sem isto a tela declara que não afirma o momento.
  freshness?: "READY" | "STALE";
}

interface RefundRequestRow {
  refundRequestId: string;
  orderId: string;
  status: RefundRequestStatus;      // ver seção 2
  requestedAmountMinor: string;     // minor units em STRING, nunca number
  currency: string;                 // ISO-4217, 3 letras maiúsculas
  createdAt: string;                // ISO-8601
  approvedAmountMinor?: string;     // ausente enquanto não houver decisão
  reasonCode?: string;              // motivo estruturado (RF-199)
  updatedAt?: string;
}

// GET /v1/refund-requests/{id} — envelope OU objeto plano, os dois são aceitos
interface RefundRequestDetailEnvelope {
  refundRequest: RefundRequestRow & {
    description?: string;
    decision?: {
      approvedAmountMinor?: string;
      decidedAt?: string;
      rationale?: string;
    };
    relatedTicketId?: string;
    relatedDisputeId?: string;
  };
  attempts?: RefundAttemptRow[];
  asOf?: string;
}

interface RefundAttemptRow {
  refundAttemptId: string;
  status: string;                   // estado da TENTATIVA no PSP, não da solicitação
  occurredAt: string;               // ISO-8601
  providerReference?: string;
  failureCode?: string;
}
```

**`requestedAmountMinor` e `approvedAmountMinor` têm que vir como string.** O parser recusa `number`
(teste explícito). Dinheiro em `number` é o começo de erro de arredondamento em centavo.

---

## 2. Estados aceitos, e por que a interface não guarda máquina própria

Transcritos de `docs/01-PRD-MIDAS.md`, seção “Solicitação de reembolso”:

```
REQUESTED → UNDER_REVIEW → APPROVED | PARTIALLY_APPROVED | DENIED
UNDER_REVIEW → AWAITING_CUSTOMER_INFORMATION → UNDER_REVIEW
APPROVED | PARTIALLY_APPROVED → PROCESSING → COMPLETED | FAILED
FAILED → PROCESSING          (somente por retry sobre a MESMA RefundRequest)
```

A tela usa esses códigos apenas como **rótulo pt-BR mapeado**. Não persiste segunda máquina, não
deduz transição e não infere estado seguinte. Estado desconhecido faz a linha ser **descartada**, não
renderizada com rótulo cru.

Qualquer estado fora dessa lista — inclusive `REEMBOLSO_PENDENTE`, `REEMBOLSADO` (pedido/PSP) e
`ESTORNADO` (ledger) — é recusado de propósito: são estados de **outros objetos** e não descrevem a
solicitação.

---

## 3. A regra que o backend precisa honrar: três fatos, nunca fundidos

`SCR-BUY-010` no doc 07 exige listar “sem confundir workflow humano com refund financeiro”. A
implementação separa isso em seções distintas:

| Fato | Onde aparece | O que pode afirmar |
|---|---|---|
| **Solicitação** (`RefundRequest`) | “O que você pediu” | valor solicitado, motivo, data |
| **Decisão** (humana) | “Decisão da operação” | valor aprovado, data da decisão, justificativa |
| **Execução** (`RefundAttempt` no PSP + ledger) | “Execução financeira” | tentativa, referência do provedor, falha |

Consequências que o backend não pode quebrar:

- **`APPROVED` não afirma dinheiro devolvido.** Só `COMPLETED` afirma. A tela escreve isso por
  extenso em cada estado.
- **Aprovado com tentativa `FAILED` é estado normal** e renderiza as duas coisas ao mesmo tempo.
- **`approvedAmountMinor` nunca é deduzido de `requestedAmountMinor`.** Sem decisão, a tela diz “sem
  decisão nesta resposta”. Há teste que falha se essa dedução aparecer.
- **`attempts` ausente ≠ `attempts: []`.** `null` = o contrato não expôs; `[]` = o servidor afirmou
  que não existe nenhuma. As duas frases são diferentes na tela.
- **Sem prazo, sem percentual, sem valor elegível calculado no browser.** G2 está fechado: não existe
  execução real. Número inventado em tela de reembolso é problema de CDC, não de UX.

---

## 4. Costuras que dependem de outros donos

| Destino | Link emitido | Dono |
|---|---|---|
| Pedido | `/conta/compras/{orderId}` | agente de compras (`apps/web/app/conta/compras/**`) |
| Ticket | `/conta/suporte/{ticketId}` | ainda `CONTRACT_REQUIRED` (stub gerado) |
| Disputa | `/pedidos/{orderId}/disputa/{disputeId}` | onda do template TRIAX |

Os links de ticket e disputa **só são renderizados quando o identificador vem na resposta**. Sem ID,
a linha diz “nenhum ticket vinculado nesta resposta” em vez de oferecer um destino inexistente.

A criação da solicitação (`POST /v1/orders/{orderId}/refund-requests`) **não** foi implementada aqui
de propósito: ela pertence ao detalhe do pedido (`SCR-BUY-005`, RF-187), com `Idempotency-Key` e
validação transacional de propriedade, janela e montante. A tela de lista aponta para as compras.

---

## 5. Evidência

```
cd apps/web
npx vitest run components/refunds     11 testes, 11 passando
npx eslint components/refunds app/conta/reembolsos     exit 0
```

Placar objetivo antes e depois, na raiz:

```
node tools/traceability/report-screen-routes.mjs --functional
antes:  SUPERFÍCIES: 31/95 dedicadas; 64 em CONTRACT_REQUIRED
depois: SUPERFÍCIES: 34/95 dedicadas; 61 em CONTRACT_REQUIRED
```

Duas das três superfícies novas são estas (`SCR-BUY-010`, `SCR-BUY-011`); a terceira veio da outra
sessão na mesma janela.

---

## 6. Pendências nomeadas

- **BLOQUEIO:** `GET /v1/me/refund-requests`, `GET /v1/refund-requests/{id}` e
  `POST /v1/orders/{orderId}/refund-requests` não existem. — **DESTRAVA COM:** publicar as três rotas
  no envelope da seção 1. As telas passam a operar sem alteração de front.
- **BLOQUEIO:** execução financeira real depende de G2 (PSP). Até lá nenhuma tela pode afirmar
  devolução. — **DESTRAVA COM:** credencial de sandbox homologada e gate documentado por provedor.
- **PENDENTE:** `/conta/suporte[/:ticketId]` continua stub gerado, então o link de ticket leva a uma
  superfície `CONTRACT_REQUIRED`.
