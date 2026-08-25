# ADENDO — cores de conversão, grafo do código e onda TDD

**Data:** 2026-08-24, madrugada
**Complementa:** [HANDOFF-FINAL-SESSAO-ORDERS-LOOP.md](HANDOFF-FINAL-SESSAO-ORDERS-LOOP.md)
**Estado:** 3 ondas de agente EM VOO no momento em que este arquivo foi escrito. O que está aqui é o que **eu** verifiquei à mão.

---

## 1. O GRAFO DO CÓDIGO — e o achado que mede a dívida

O `graphify-out/graph.json` estava de **23/08 12:17**, anterior a toda a noite: 2680 nós e **zero arestas**. Reconstruí com extração AST — determinística, sem LLM, sem custo de token, então não dependeu da API de agente que estava caída.

```
antes:  2680 nós ·    0 arestas
agora:  3883 nós · 7548 arestas · 287 comunidades
```

**God nodes — os nós mais conectados do repositório:**

| Nó | Grau | Leitura |
|---|---|---|
| `useApiResource()` | 75 | o hook que toda tela usa para ler dado |
| **`ScreenContractPage()`** | **68** | **o STUB** |
| `isApiError()` | 53 | tratamento de erro da API |
| `Button` | 48 | design system |
| `PageState()` | 43 | estado honesto |
| `StatusBadge()` | 42 | estado nunca só por cor |
| `Panel()` | 39 | superfície |
| `MidasTransaction` | 37 | núcleo transacional |
| `formatDateTime()` | 32 | formatação |

**O achado:** `ScreenContractPage` é o **segundo nó mais conectado do repositório inteiro**, com grau 68 — praticamente empatado com o hook de dados que todas as telas usam. Isso é a medida objetiva da dívida: o stub é hoje quase tão central quanto a infraestrutura real.

É também o indicador de progresso mais honesto que este repo tem. Cada tela que sai de `CONTRACT_REQUIRED` reduz esse grau. Quando `ScreenContractPage` cair de god node, o produto está feito.

Comando para reproduzir (o interpretador do graphify fica em `graphify-out/.graphify_python`):

```bash
node tools/traceability/report-screen-routes.mjs --functional
```

---

## 2. AS CORES DE CONVERSÃO — bug medido e corrigido

Estava listado como gap 11 do handoff anterior. Fechado, com o defeito nomeado.

### O bug

```
--och-color-gold:         oklch(78% 0.160 80)   ← cor de AÇÃO (CTA)
--och-color-antique-gold: oklch(68% 0.110 78)   ← véu de AMBIENTE (fundo)
```

**Dois graus de matiz de distância**, com croma alto no ambiente. O `body` em `globals.css` e os dois véus de `editorial.css` lavavam a tela inteira na mesma família cromática do CTA. Resultado: figura-fundo colapsado, o botão principal não tinha para onde saltar.

Isso viola duas leis que o próprio projeto adota (`docs/03`, `docs/18`):
- **Gestalt §8, semelhança** — uma única cor exclusiva de ação por superfície; se a cor do CTA aparece em elemento não-clicável, é bug, não estilo.
- **Gestalt §3, figura-fundo** — o fundo é cenário e não disputa a figura.

### A correção

```
--och-color-antique-gold: oklch(64% 0.045 62)
```

Matiz deslocada de 78 para **62** (âmbar-terra, não ouro) e croma cortado de 0.110 para **0.045**. Continua quente e premium como fundo, e para de competir. **18 graus de distância, croma 3,5× menor.**

Uma única token, quatro consumidores — `apps/web/app/globals.css` (véu do body) e três de `packages/ui/src/editorial.css` (dois véus e o filete). Corrigido no lugar certo, propagou sozinho.

### A escada de estado que faltava

```
--och-color-gold-hover:  oklch(82% 0.175 80)
--och-color-gold-active: oklch(72% 0.150 80)
--och-color-gold-quiet:  oklch(70% 0.075 80)
```

Aliases semânticos: `--color-action-hover`, `--color-action-active`, `--color-action-quiet`.

Dois defeitos reais resolvidos junto:
1. O hover do botão primário usava `filter: brightness(1.08)`, e **`filter` não estava na lista de `transition`** — então o hover do CTA principal era instantâneo, sem transição.
2. `brightness()` clareia o elemento inteiro, **incluindo a tinta do texto**. Token explícito muda só o fundo.

`button.tsx` passou a emitir a classe `ui-button--primary` sempre (antes o primário não tinha classe própria, então não dava para estilá-lo sem afetar as outras variantes).

### O guarda-corpo

`packages/ui/src/tokens.test.ts` — **6 testes**, e existem para impedir a regressão específica:
- croma do ambiente ≤ 0.060;
- distância angular de matiz ação × ambiente ≥ 12°, com aritmética circular correta (350 e 10 estão a 20°, não 340);
- croma da ação > 2× o do ambiente;
- hover/active/focus na mesma matiz da ação (mudar matiz no hover troca o significado da cor, não o estado);
- hover mais claro e active mais escuro que o repouso;
- ação silenciosa com croma menor que a primária, senão a hierarquia primário × secundário desaparece.

Se alguém subir o croma do ambiente "para ficar mais dourado", o teste falha antes de chegar em produção.

---

## 3. `/conta/avaliacoes` (SCR-ACC-015) — feita à mão

`apps/web/components/reputation/review-eligibility.ts` + `.test.ts` — **12 testes**. `tsc` exit 0.

A elegibilidade é derivada de **fato real**: `GET /v1/me/purchases` devolve status e data de conclusão, e a regra decide. Sem endpoint novo.

Decisões que o teste trava:
- **Nota ZERO é válida** e selecionável. `null` é ausência de nota, não nota baixa. A maioria dos sistemas erra isso tratando 0 como "sem avaliação".
- **Duplo cego explicado na tela**: a nota fica selada até o outro lado enviar ou o prazo fechar. Não é só regra técnica — explicar isso aumenta a taxa de avaliação, porque tira o medo de retaliação.
- Reputação de comprador e de vendedor são **separadas e nunca somadas**.
- Pedido inelegível **não desaparece da lista** — aparece com o motivo nomeado. Card que some faz a pessoa achar que o sistema esqueceu dela.
- Data de conclusão ausente ou malformada **não é presumida** — devolve `ORDER_DATE_UNKNOWN`.
- O botão de enviar está **desabilitado com o motivo escrito**: `OrderReview` não existe na API. Botão que finge enviar avaliação é pior que botão ausente.
- Seletor de nota é `radiogroup` real com nome acessível por valor, não estrela decorativa.

---

## 4. ONDAS EM VOO (não verificadas por mim)

| Onda | Run ID | Agentes | Escopo |
|---|---|---|---|
| template TRIAX | `wf_6686ec9f-04b` | 7 | checkout, entrega/custódia, disputa, anúncio, painel de vendas, wizard de anúncio |
| loop de compra | `wf_4ad58a38-a97` | 7 | `modules/merchandising`, monta-combo, perfil de gosto, continuidade pós-compra |
| **TDD estrito** | `wf_75108390-028` | 6 | mensagens + PII guard, conquistas, ajuda/políticas, canal Midas + recurso, privacidade LGPD |

A onda TDD tem regra dura no prompt: escreve o teste, roda, **vê falhar, cola o vermelho**, implementa, cola o verde. Componente antes do teste da lógica invalida a entrega. Teste que só verifica renderização não conta — cada teste tem que travar uma regra.

Se caírem no 529, o custo é zero e a retomada volta do cache.

---

## 5. ERRO MEU NESTA RODADA

Quebrei 19 testes de `packages/ui` ao adicionar a classe `ui-button--primary`. A causa **não** era o botão: era o meu próprio `tokens.test.ts` usando `import.meta.url`, que não é file URL sob o environment jsdom do pacote. As outras 18 falhas eram cascata do runner errado (config da raiz, sem jsdom). Corrigido resolvendo o caminho a partir de `process.cwd()`, aceitando as duas cwds possíveis (raiz do monorepo e raiz do pacote).

Lição registrada: rodar `npx vitest run packages/ui` da raiz usa a config da raiz, não a do pacote. O runner correto é `pnpm test` ou entrar no diretório do pacote.

---

## 6. ESTADO VERIFICADO POR MIM

```
pnpm test        pass + check-boundaries 3/3
pnpm typecheck   31/31 successful
pnpm lint        31/31 successful + "Fronteiras arquiteturais válidas."
npx tsc --noEmit -p apps/web/tsconfig.json    exit 0
report --functional    41/95 superfícies dedicadas; 54 CONTRACT_REQUIRED
```

Progresso da sessão inteira: **16 → 41 superfícies dedicadas · 79 → 54 `CONTRACT_REQUIRED`. 25 telas saíram de stub.**

---

## 7. BLOQUEIO QUE CONTINUA ABERTO, E É O ÚNICO QUE EU NÃO PODIA RESOLVER

**SEM COMMIT.** O repo tem 4 commits, todos de docs. `apps/`, `modules/`, `packages/` **nunca foram versionados**. Todo o trabalho desta noite existe só no disco de uma máquina.

Pedi autorização explícita ao dono mais de uma vez. Nenhuma das duas sessões Claude commitou. **DESTRAVA COM:** o dono dizer "commita".

Quando autorizar: poucos commits grandes, incluindo `pnpm-lock.yaml` (untracked). Fatiar em frentes bonitas uma massa que nunca foi separada é ficção.
