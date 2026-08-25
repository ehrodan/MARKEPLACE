# HANDOFF — a home virou loja, e o que isso corrigiu

**Data:** 2026-08-24, manhã
**Como rodar e testar:** [RUNBOOK-LOCAL.md](RUNBOOK-LOCAL.md)
**LEIA DEPOIS DESTE:** [HANDOFF-LOJA-ESCURA-E-GRAFO-DOCS.md](HANDOFF-LOJA-ESCURA-E-GRAFO-DOCS.md) — loja escura, estoque semeado, abertura 3D, ticker e o grafo dos 39 documentos.
**Handoff anterior:** [HANDOFF-FINAL-SESSAO-ORDERS-LOOP.md](HANDOFF-FINAL-SESSAO-ORDERS-LOOP.md)

---

## O erro de direção que o dono apontou, e ele estava certo

A home era uma **landing narrativa em cinco seções**. O dono repetiu quatro vezes que não fazia sentido. Não fazia mesmo, e o próprio contrato provava:

> `docs/07`, SCR-PUB-001: *"Orientar entrada por busca, categoria, P2P ou Midas."*

Manifesto não é entrada por categoria. A landing **furava a própria spec**.

Pior: os sites de referência estavam listados em `docs/06-INVENTARIO-REFERENCIAS-E-ASSETS.md` e `docs/20-BENCHMARK-COMPETIDORES-E-LAYOUTS.md` desde o começo — **csfloat.com, dmarket.com, ggmax.com.br, neshastore.com** — e nunca foram abertos. Só foram depois de cobrança direta.

**Lição operacional:** quando um doc lista referência externa, abrir a referência faz parte de ler o doc. Grepar URL não é ler.

---

## DNA extraído, em clean room

Estrutura e comportamento foram transportados. Paleta, texto, asset e layout pixel a pixel **não** — regra de `docs/03 §1`.

**Nesha Store**, anatomia medida ao vivo:

```
card 268x250px · radius 12px · fundo rgb(24,36,46) sobre body rgb(9,13,17)
[5 D] [FASE 2] · imagem · R$ 34.000,00 riscado · R$ 24.999,99 · -26% · FN / 0.025
sinal de vantagem: ciano rgb(0,229,229)
```

Faixa rotativa no topo → carrossel → categorias horizontais → **grid de produto direto**. Zero hero editorial.

**DMarket** — categoria com contagem real de ofertas (`Knives 22.233`, `Rifles 114.091`). O visitante vê onde há liquidez antes de clicar.

**CSFloat** — `Top Deals / Newest / Unique` como entradas distintas; seletor de moeda e idioma na nav.

O ciano do sinal de vantagem **não briga com a marca**: `docs/03` já manda *"Ciano chama para ação, dourado sinaliza valor"*.

---

## O que mudou no produto

### A home é a loja

Removidos da rota `/`: `LandingDepthCut`, `LandingPrinciples`, `LandingViewerInvite`, `LandingFinalCta`. `LandingStory` caiu de 3 capítulos para 1.

Custódia e confirmação dupla **não foram apagadas** — viraram `variant="full"` no mesmo componente, disponíveis para a central de confiança, onde a pergunta da pessoa já é "posso confiar em pagar por isto?".

Ordem final:

```
faixa rotativa de garantia → nav + busca → hero curto (1 dobra)
→ categorias com contagem real → grid de produto
```

### `AnnouncementBar`

Faixa rotativa. DNA da **posição** e do **comportamento**; conteúdo é nosso.

O benchmark usa `CUPOM 1COMPRA = DESCONTO MÁXIMO` e `2X SEM JUROS`. `docs/03 §10` proíbe desconto sem preço de referência praticado, e anunciar parcelamento com o PSP desconectado seria afirmar capability inexistente. A faixa carrega as três garantias estruturais, que são verdade hoje.

Altura fixa de uma linha para não empurrar a página. Em `prefers-reduced-motion` as três mensagens aparecem empilhadas, sem temporizador. Pausa em hover e em foco.

### `LandingCatalog`

Categorias com contagem real derivada dos anúncios carregados, e grid de ofertas publicadas. Nenhum número estimado. Estado vazio leva a criar anúncio em vez de ser beco sem saída.

### Card reordenado

A densidade já batia — 254×248 o nosso contra 268×250 deles. O problema era **hierarquia**:

- morreu o rótulo "Preço do anúncio": `R$` já diz o que é, e a linha roubava peso do número;
- preço subiu de `1.24rem` para `1.5rem` e virou a âncora visual;
- condição e raridade desceram para o rodapé, no lugar onde o benchmark põe o float.

### Animação que vende

`Tilt3D` (7°, com brilho especular) e `Reveal` escalonado nos cards. As primitivas existiam em `packages/ui/src/scroll-3d.tsx` desde a primeira onda e **estavam sem uso**.

Justificativa: é a técnica de **visualização de posse** do livro de neuromarketing — inclinar a peça faz o cérebro simular posse antes da compra — aplicada no único lugar onde é honesta, o próprio produto.

Limites codificados: 7° para o item não parecer distorcido; **o preço nunca se move**, porque o tilt é do container e o preço vive dentro; a primitiva desliga sozinha em ponteiro grosso e em `prefers-reduced-motion`; o atraso do `Reveal` satura em 6 cards para a última linha não ficar esperando.

---

## Bugs encontrados por RODAR o app, não por ler o código

1. **`ChunkLoadError`** — dev server no ar desde antes de centenas de arquivos mudarem; chunks do Turbopack obsoletos. Processo morto, `.next/cache` limpo, `.claude/launch.json` criado com `web:3000` e `api:3001`.

2. **207px de overflow horizontal** — `landing-cut__plane--back` e `landing-cut__wash` tinham 1870px num viewport de 1425. As camadas de parallax usam `inset: -8rem -12vw` de propósito para ter curso de movimento, mas a seção não recortava. `docs/03 §9` proíbe rolagem horizontal. `overflow: clip` em `.landing-hero` e `.landing-cut` resolveu: **1647px → 1425px, overflow 0**.

3. **Contador `01 / 03` órfão** — o indicador continuava apontando para três capítulos depois que a home passou a usar um. Agora só aparece com mais de um capítulo e reflete o total real. Número que não corresponde ao conteúdo é pior que número ausente.

---

## `modules/merchandising` — o domínio que faltava

Criado à mão depois de a onda 4 morrer **quatro vezes** no 529. Migration `0013`, `package.json`, `tsconfig`, duas policies puras, **17 testes**.

**`bundle-pricing.ts`** — a economia do combo só pode ser calculada contra a soma dos preços **vigentes**. A função não aceita preço de referência arbitrário, então é **impossível** calcular economia contra valor inflado — que é infração de CDC, não só má prática. Combo mais caro que a soma das partes é recusado (`TOTAL_ABOVE_SUM`) em vez de devolver economia negativa. Percentual truncado para baixo. BigInt em toda parte, com teste que prova precisão acima de `Number.MAX_SAFE_INTEGER`.

**`spend-awareness.ts`** — teto de gasto **autoimposto pelo usuário**. `NO_LIMIT` quando não há teto (ausência nunca vira zero), `NEAR` em 80% que avisa mas **não** censura (parar de sugerir antes seria paternalismo), `REACHED` suprime upsell. Existe porque marketplace de item de jogo tem risco documentado de gasto compulsivo e está sob atenção regulatória no Brasil; cliente quebrado não volta.

---

## Estado verificado

```
pnpm typecheck   32/32
pnpm lint        32/32 + "Fronteiras arquiteturais válidas."
pnpm test        32/32
report --functional: 42/95 superfícies dedicadas; 53 CONTRACT_REQUIRED
app rodando: web 3000, api 3001, 5 serviços Podman
dado real: 1 anúncio publicado — OCHPOCH Market Emblem, R$ 179,90, 25 unidades
```

Migrations registradas em `packages/database/src/migration-layout.ts` (11 diretórios), agora incluindo `0013_merchandising` e `0015_progression`. O teste que trava a contagem num número mágico foi atualizado **com a razão escrita**: o número existe para obrigar decisão consciente a cada módulo novo.

---

## Resposta honesta a "você leu cada PRD?"

**Não.**

**Lidos:** `01` parcial (RF-237, RF-244/245, RF-248, rotas), `03` (§9, §10), `04` (§11, §13), `05` integral, `07` (§1.4 e tabelas SCR), `10`, `17`, `18` índice, `19` (§5), `REACT-BITS-ALLOWLIST`, `tasks.md`.

**Não lidos:** `02-UML` (1900+ linhas), `06`, `08-ADRS`, `09-GROWTH`, `11-PIPELINE-3D`, `12-MATRIZ`, `13` (uma linha só), `14-MARKETING`, `15-STUDIO`, `16-SEO`, `20`, `21-LAYOUTS`, `22-ADR-STACK`, `requirements.md`, `design.md`.

`docs/12-MATRIZ-DE-IMPLEMENTACAO.md` é declarado pelo próprio `docs/05` como **fonte canônica de estado**. Não foi lido. É a primeira leitura pendente.

---

## Próximo passo exato

1. **Commit.** Único item que ninguém além do dono destrava. `apps/`, `modules/` e `packages/` nunca foram versionados; 4 commits no repo, todos de docs.
2. Ler `docs/12-MATRIZ-DE-IMPLEMENTACAO.md` — fonte canônica de estado, diz o que está pendente por requisito.
3. `modules/promotions` — cupom, afiliado, atribuição (tarefas 27 e 28 do SDD). Migration livre sugerida: **0017**.
4. Rotas de API de progression e `OrderReview`. As tabelas existem e estão populadas, mas `/conta/conquistas` e `/conta/avaliacoes` seguem sem fonte canônica.
5. Consolidar a comunidade de coesão **0,055** apontada pelo grafo: `Autorização de Pedido`, 117 nós fracamente ligados. Authz fragmentada é onde BOLA nasce.

---

## Bloqueios

- **SEM COMMIT** — risco mais grave aberto. Destrava com uma palavra do dono.
- **G0** autorização do publicador: `BLOQUEADO`.
- **G1** feed de mercado licenciado: `BLOQUEADO` — por isso `/itens/:slug` não desenha gráfico de preço.
- **G2** PSP: pendente — `/checkout` monta resumo e aceite, não processa cobrança.
- **G3** políticas comerciais: pendente — taxa e prazo aparecem como "valor ainda não publicado" onde o PRD não fixou número.
- **Sem conta de staff/admin** — IAM exige grant explícito, não há seed de papel administrativo. `/admin/*` e `/master/*` sob `default deny`.
- **API de subagente instável** — 529 em 5 tentativas ao longo da sessão; todo o trabalho recente foi manual.
