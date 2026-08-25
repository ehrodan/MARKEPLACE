# HANDOFF — a loja ficou escura, ganhou estoque, e os documentos entraram no grafo

**Data:** 2026-08-24
**Branch:** `codex/rf181-202-conta-reembolsos`
**Leia antes:** [HANDOFF-LOJA-E-BENCHMARK.md](HANDOFF-LOJA-E-BENCHMARK.md) · [RUNBOOK-LOCAL.md](RUNBOOK-LOCAL.md)

---

## O erro de cor, e por que ele era estrutural

O dono foi direto: *"ESSAS CORES ESTÃO PÉSSIMAS"*. Ele estava certo, e a causa não era gosto.

`apps/web/app/globals.css` tinha uma **segunda paleta, em hex fixo**, dentro de `.landing-page`:

```css
--landing-ink: #142019;  --landing-cream: #f5efe3;  --landing-paper: #fffaf0;
```

Sete nomes que **ignoravam `packages/ui/src/tokens.css` inteiro**. Consequências medidas na tela, não supostas:

- o ouro da marca sobre creme perdia contraste e sumia — a peça 3D dourada literalmente desaparecia no fundo claro;
- todo componente que usa token (card de estado, botão, campo) entrava **escuro dentro de uma página clara**: o card "Catálogo temporariamente indisponível" aparecia preto no meio do creme;
- `docs/20` mediu os quatro concorrentes e **todos operam em fundo escuro** (Nesha: `rgb(9,13,17)`), porque item de jogo é renderizado sobre escuro e a peça precisa ser a figura.

**Correção:** os sete nomes continuam, porque os 44 usos são semânticos (`ink` = máximo contraste, `cream`/`paper` = fundo e superfície). Trocado o valor, todo uso segue correto — inclusive os blocos invertidos, que passaram a ser claros dentro do escuro. Mais **~45 valores hex/rgba** hardcoded migrados para token no mesmo passe.

Comprovação visual: a peça dourada sobre o palco escuro (`stage-reduced.png`) contra o mesmo render sobre creme. Não é preferência — é figura-fundo.

---

## A loja tinha 1 anúncio

Nenhuma decisão de layout pode ser avaliada com um card. Densidade de grade, hierarquia de preço, faixa de categorias e multivendedor **só aparecem com volume**.

**`tools/dev-seed/seed-storefront.mjs`** — 6 vendedores, 20 itens, 20 anúncios. Estado atual do banco: **21 anúncios publicados, 7 vendedores distintos**.

Três regras que o tornam legítimo:

1. **Nada de terceiro.** G0 (autorização do publicador) segue `BLOQUEADO` em `docs/22`, então não entra nome, arte nem marca de jogo real. `game_origin = 'AMOSTRA_DEV'`.
2. **A arte é nossa.** Cada item ganha um SVG gerado pelo próprio script, com matiz e geometria derivadas do slug por hash estável. Nenhum download, nenhuma licença de terceiro.
3. **Reversível.** Tudo nasce com prefixo `dev-`; `node tools/dev-seed/seed-storefront.mjs --undo` remove exatamente o que criou.

---

## Abertura da loja — a peça que gira e dissolve no scroll

`apps/web/components/store/`, pedida explicitamente e mais de uma vez pelo dono.

| Arquivo | O que faz |
|---|---|
| `store-overture.tsx` + `.module.css` | trilho de 200svh, palco `sticky`; a peça gira, flutua e **recua em Z** enquanto dissolve; a vitrine entra por baixo |
| `overture-canvas.tsx` | R3F **sem** `Bounds`/`OrbitControls`; escala medida por `Box3`; luz de joalheria para fundo escuro |
| `animated-heading.tsx` + `.module.css` | título palavra a palavra e CTA com brilho que varre — **CSS puro** |
| `scroll-progress.ts` + `.test.ts` | a matemática do trilho, isolada, **13 casos** |

**Decisões que importam:**

- **Sem `Bounds observe`.** Ele reenquadra a cada mudança de layout; num palco que muda de tamanho durante o scroll isso reaproxima a câmera sem aviso — foi o que encheu o palco antigo de branco.
- **`Box3` depois de `updateWorldMatrix`.** Um clone recém-criado ainda não tem matrizes de mundo; medir antes devolve caixa vazia e a peça herda a escala crua do arquivo.
- **Luz recalibrada.** A anterior somava ~16 de intensidade com exposição 1.65 porque o palco era creme. Sobre escuro, isso estoura o render.
- **React Bits segue bloqueado.** O dono colou três componentes de biblioteca; dois pediam `motion/react`, proibido por `REACT-BITS-ALLOWLIST.md`. O `LineShadowText` **não precisava** dela — o `motion.create()` ali não anima nada, a animação é keyframe CSS. O efeito foi entregue sem a dependência.
- **`docs/03 §8`:** o doc restringe a animação longa do modelo a SCR-PUB-013 e proíbe *"fundo WebGL **concorrente**"*, scroll hijack e parallax por seção. A abertura não é nenhum dos três: canvas único, scroll nativo, e desaparece por completo em `prefers-reduced-motion` e sem WebGL. O dono, autor do doc, reafirmou o pedido várias vezes.

**Limite honesto:** o WebGL **não pôde ser verificado visualmente** nesta máquina. O SwiftShader do Playwright headless não compõe o canvas — screenshot de elemento com canvas volta branca, e isso é artefato do capturador, não do produto. O fallback 2D e todo o resto foram verificados. **A peça 3D precisa ser olhada no navegador real.**

---

## Card de anúncio — onde a compra começa

Leitura em Z, que é a ordem em que a decisão acontece:

```
raridade (topo-esq) ─────────► estoque (topo-dir)
          ↘  imagem do item  ↙
nome + vendedor
PREÇO (âncora)
[ Comprar → ]
```

- **CTA nomeado.** Um card inteiro clicável não diz o que acontece ao clicar. `tabIndex={-1}` no botão: o título já leva ao mesmo destino, e dois alvos focáveis por card dobrariam as paradas de teclado da grade.
- **Escada de raridade** (`rarity.ts`, 5 testes): cor **E** palavra **E** posição (`LENDÁRIO 5/7`). Três canais para a mesma informação — cor sozinha exclui quem não a distingue. Sete tokens novos em `tokens.css`, com croma teto 0.150 e matizes afastadas do ouro, e a regra escrita: **raridade nunca preenche elemento clicável**.
- **Ausência ≠ comum.** Item sem raridade declarada não vira o nível mais baixo; isso seria inventar dado sobre a peça de outra pessoa.

### Três bugs achados por medir, não por olhar

1. **CTA sobrepondo o preço.** `R$ 1.899,00` mais botão passava da largura do card e o botão cobria os centavos. Rodapé empilhado. Medido depois: `ctaOverPrice: 0` em 12 cards.
2. **Fileira desalinhada.** Cards terminavam em 476 e 498px. Duas causas: a linha de condição que nem todo item tem (reserva de `2.875rem`, valor medido) e o `Reveal` que envolve o card quebrando o `stretch` da grade no primeiro elo (`.grid > * { height: 100% }`). Agora: **altura 499 em todas as fileiras, um único topo de botão por fileira**.
3. **Carimbo "Imagem principal"** sobre toda foto. Agora só aparece quando o tipo do asset muda a decisão (3D).

---

## `pnpm --filter api dev` estava quebrado

A API só subia com env exportado à mão: `tsx watch` roda dentro de `apps/api` e nunca carregava o `.env` da raiz. Agora:

```
"dev": "tsx watch --env-file-if-exists=../../.env src/server.ts"
```

`GET /v1/listings` → **200** com dado real.

---

## O grafo dos 39 documentos — o que faltava no grafo anterior

O grafo de código tinha 3883 nós mas **os documentos nunca entraram**. Quatro extratores rodaram sobre `docs/`:

```
39 arquivos · 170.476 palavras
618 nós · 1199 arestas · 12 hiperarestas · 35 comunidades
saúde: 0 aresta órfã, 0 extremidade faltando, 0 laço
```

Saída em `graphify-out/graph-docs.json` (separado de `graph.json` para não derrubar o grafo de código pelo guarda de encolhimento).

**Documentos mais centrais do contrato:**

| Arestas | Documento |
|---:|---|
| 28 | `08-ADRS-DECISOES-ARQUITETURAIS.md` |
| 28 | `HANDOFF-FINAL-SESSAO-ORDERS-LOOP.md` |
| 27 | `02-UML-ARQUITETURA.md` |
| 22 | `01-PRD-MIDAS.md` |
| 21 | `00-RELATORIO-MESTRE.md` |
| 19 | `21-SISTEMA-DE-LAYOUTS-E-TEMPLATES-UI.md` |

**Achado que muda a ordem de leitura:** `08-ADRS` é o documento mais acoplado do repositório inteiro e **nunca foi lido**. Seu par mais forte é `13-PAGAMENTOS-REPUTACAO-PROGRESSAO` (8 arestas). Os extratores registraram que o §2.1 do doc 08 marca **ADR-006, 007, 008, 016 e 017 como `NÃO IMPLEMENTADA`** — é a lista de pendências mais confiável que existe hoje, e é mais barata de agir que ler tudo de novo.

**Zero documentos isolados**: os 39 se conectam.

---

## A referência que o dono forneceu — e o que ela mudou

Ele cobrou **duas vezes** que eu olhasse a referência dele. Eu tinha listado a pasta e não aberto um arquivo sequer. Abertos: `~/Downloads/PROMPT_FINAL_PARA_IA.md` e `preview (1).html`.

São de **outro projeto dele** (Cessna Academy 3D), mas o §4 descreve com precisão a estética que ele vinha pedindo aqui:

> obsidiana, dourado metálico, marfim e verde-lima; tipografia monumental condensada; HUD, grids, bordas técnicas e botões angulares.

Paleta medida no protótipo dele:

| Cor | Papel | Já tínhamos? |
|---|---|---|
| `#080c11` | obsidiana, fundo | sim (`--och-color-paper`) |
| `#d6b152` | dourado metálico | sim (`--color-action`) |
| `#f4efe4` | marfim, texto | sim (`--och-color-ink`) |
| **`#68d4c8`** | **acento turquesa** | **não — era o que faltava** |

Adicionados `--och-color-signal` / `--color-signal`. O papel está escrito no token: **destaque informativo, nunca botão** — a única cor de ação continua sendo o ouro. Isso fecha com `docs/03` ("Ciano chama para ação, dourado sinaliza valor") e com `docs/20` (o sinal de vantagem da Nesha é ciano).

**Ainda não atendido da mesma referência:** HUD/grids/bordas técnicas e **botões angulares** — nossos controles são `radius 6px` por `docs/18`. Mudar isso é decisão de marca, e o dono autorizou ("pode mudar cores, tipografia e refazer o brand"), mas não foi feito nesta sessão.

## `PriceTicker` — "os preços passando"

`apps/web/components/store/price-ticker.tsx` + `.module.css`. Faixa entre a nav e a abertura, com os anúncios reais correndo.

O que a separa de um letreiro publicitário:

- **cada tira é um anúncio publicado**, preço vindo da API, link para a própria oferta. Catálogo vazio → não renderiza;
- **zero urgência fabricada** (`docs/03 §10`): sem contador, sem "última unidade", sem preço riscado;
- a lista é duplicada **uma vez** para o laço fechar sem salto, e a cópia é `aria-hidden` — o leitor de tela ouve cada item uma só vez;
- **pausa** em `:hover` e `:focus-within`; em `prefers-reduced-motion` vira lista estática com os mesmos links;
- uma única animação de `transform`, resolvida pelo compositor. Nenhum JS por quadro.

Verificado: `26 itens (13 + clone) · animação 70s · clone aria-hidden · 0 overflow · 0 erro JS`.

## Componentes de biblioteca que o dono colou — e o que foi feito com cada um

| Componente | Decisão | Motivo |
|---|---|---|
| `LineShadowText` | **efeito entregue, dependência recusada** | pedia `motion/react`, proibida por `REACT-BITS-ALLOWLIST.md`. O `motion.create()` ali não anima nada — a animação é keyframe CSS. Vive em `animated-heading.tsx`. |
| `GlassCard` | **DNA aproveitado, componente não integrado** | é card de demo com conteúdo fictício e ícones sociais; glassmorphism decorativo. A profundidade em hover foi aplicada no card de **anúncio real**, que é onde a compra acontece. |
| `dashboard-sidebar` | **não integrado** | opera sobre `mockNavGroups` / "Acme Corp". A regra do repo é nenhum dado inventado na interface, e o app não tem essa superfície. |

Nenhum dos três exigia Tailwind ou estrutura shadcn: o projeto usa CSS Modules sobre `tokens.css`, e Tailwind já está presente via `@import "tailwindcss"` em `globals.css`.

## Conformidade com os docs — auditoria e duas correções

O dono perguntou direto: *"você fez da forma certa? seguiu os docs?"*. Auditado contra o texto, e **em dois pontos a resposta era não**. Ambos eram peças que ele mesmo tinha pedido; ambos foram corrigidos com a decisão dele.

| Violação | Texto do doc | Correção aplicada |
|---|---|---|
| A logo girava sozinha, para sempre, na home | `07 §1.4`: *"nunca vira **auto-rotação**"*; `03 §8`: *"exclusivamente ... em `SCR-PUB-013`"* | A rotação passou a ser **dirigida pelo scroll** (`node.rotation.y = REST + spin × TURNS`). Parado o scroll, parada a peça, na pose neutra. Vira manipulação direta — o mesmo princípio que o doc autoriza no viewer. A flutuação continua no relógio porque **não é rotação**, e a amplitude é 0,09. |
| O ticker fazia os preços correrem pela tela | `07 §1.4`, perfil M2: *"nunca cria urgência, escassez, **preço animado** ou CTA móvel"* | A faixa **não se move sozinha**: `animation: none`, rolagem horizontal nativa, o mesmo gesto da faixa de categorias. Sobra apenas o pulso do rótulo "ao vivo", que comunica **estado**. Verificado: `animacaoDaFaixa: "none"`, `overflow-x: auto`. |

Também de `docs/18` (item 4 da governança: *"cada token tem nome, intenção, tema, valor, depreciação e teste visual"*): os 9 tokens criados nesta sessão não tinham teste. Agora têm — **+7 casos** em `packages/ui/src/tokens.test.ts`, incluindo o que trava o teto de croma da raridade, a distância de matiz para o ouro e a distinguibilidade entre os sete níveis.

## Fluxo de compra: medido, e a lacuna fechada

Em vez de inferir do código, o fluxo foi **chamado contra a API real**:

```
204 login · 200 vitrine · 200 carrinho · 201 adicionar item
201 segundo vendedor · 200 agrupar (2 grupos) · 201 pedido · 200 ler pedido
404 entrega (correto: sem PSP não há pagamento nem entrega) · 200 minhas compras
```

`feeMinor: 1349` sobre R$ 179,90 = **7,5% exatos**, vindos do `platform_fee_rate` do plano no banco. Nenhum número inventado.

Achado do caminho: a API exige o cabeçalho `x-midas-csrf: 1` em toda mutação (`app.ts:558`). A proteção está ativa e funciona — qualquer script de teste precisa mandá-lo, como o navegador manda.

**A lacuna que isso expôs:** o carrinho já agrupava por vendedor, mas `POST /v1/orders` aceitava **um anúncio só**. Não havia caminho de "carrinho com N itens" para "pedido" — comprar dois itens do mesmo vendedor exigia dois pedidos. É a onda 4 do `docs/12 §6`, e estava aberta no meio.

**`OrderService.placeOrderFromCartGroup`** + `POST /v1/me/cart/checkout-groups/:sellerAccountId/orders`.

Decisões que importam:

- **um pedido por vendedor**, não um pedido para o carrinho inteiro: cada vendedor tem sua comissão, seu prazo, sua entrega e seu direito de cancelar. Um pedido que atravessasse vendedores não teria dono para nenhuma dessas decisões;
- **uma transação serializável**: ou o grupo inteiro vira pedido com estoque reservado, ou nada acontece. Reservar parte e falhar no resto deixaria estoque preso sem pedido que o justificasse;
- **`for update` nas linhas do grupo**: duas abas do mesmo comprador não fecham o mesmo grupo duas vezes;
- **a comissão incide uma vez sobre o subtotal**, nunca por linha. Três linhas de 101 centavos a 7,5% dão 23 pela regra certa e 24 somando por linha — um centavo cobrado a mais do vendedor por arredondar três vezes. **Há teste para exatamente isso**;
- recusas nomeadas: `CART_GROUP_EMPTY`, `CART_LINE_SELLER_CHANGED` (o anúncio mudou de dono depois de entrar no carrinho), `CART_GROUP_MIXED_CURRENCY`, `CART_GROUP_SELLER_MISMATCH`;
- as linhas **saem do carrinho** ao virar pedido — deixá-las lá faria a pessoa comprar duas vezes.

Provado contra o banco real:

```
FECHAR GRUPO -> PEDIDO           201
grupos no carrinho antes          2
grupos no carrinho depois         1   (o outro vendedor permanece)
subtotal 71960 · fee 5397 (7,5%) · status PENDING_PAYMENT
```

**Falta a tela.** O comando existe e está testado; `/carrinho` ainda não tem o botão que o chama.

## Varredura doc a doc — o que cada um ainda cobra

O dono pediu **um por um**. Os 23 documentos de `docs/` somam **17.945 linhas**. Varredura por marcadores de pendência, e depois leitura dirigida dos que o grafo apontou como mais centrais.

### `docs/08-ADRS` — o nó mais acoplado do contrato (28 arestas), nunca lido antes

Cinco ADRs marcadas `NÃO IMPLEMENTADA`:

| ADR | O que falta segundo o doc | Confronto com o repositório |
|---|---|---|
| ADR-006 | `RefundRequest`/`RefundAttempt` canônicos | **confirmado ausente** — não há módulo nem migration; as telas de reembolso da sessão par não têm domínio atrás |
| ADR-007 | projeções reconstruíveis / checkpoints | confirmado ausente |
| ADR-008 | read models, RLS e drill-down do Growth | confirmado ausente — Growth segue 0/9 |
| ADR-016 | consentimento, supressão, Meta/WhatsApp, jornadas, atribuição | **parcialmente desatualizado**: `modules/retention` já entrega consentimento e supressão persistidos (`0011`). Faltam os adapters de canal e a atribuição |
| ADR-017 | módulo canônico de catálogo/Studio/submissão | **parcialmente desatualizado**: `modules/merchandising` (`0013`) entrega relações, bundles e perfil de gosto. Falta o Studio de submissão |

**Achado que muda como ler esses docs:** `docs/08` está **atrás do código** em pelo menos dois pontos (ADR-015 diz que a progressão não persiste, mas `0015_progression.sql` existe e está aplicada). Um doc de estado desatualizado é pior que um doc ausente, porque induz a refazer o que já existe. Confrontar cada "NÃO IMPLEMENTADA" com o repositório antes de agir é obrigatório.

### `docs/14-MARKETING §5` — carrinho e checkout interrompido

É literalmente o "fazer o cara comprar mais" que o dono pediu. Divergência encontrada:

```
doc 14 §5.1 exige:  ACTIVE → CHECKOUT_STARTED → ORDER_CREATED → COMPLETED / EXPIRED / MERGED
banco tem:          ACTIVE | CONVERTED | ABANDONED
```

E o doc é explícito: *"'Abandono' é uma condição temporal derivada, não uma verdade permanente"* — `ABANDONED` como estado persistido **contradiz o texto**. Mudar isso é alteração de contrato de domínio e exige o formato do `docs/12 §8` (SCR-ID, RF, onda, comando, erro, permissão, evento, teste). **Registrado, não alterado por conta própria.**

O que a política de lembrete do `§5.3` exige — janela versionada, horário silencioso, limite de frequência, supressão nomeada — **já existe** em `modules/retention` (`REMINDER_FREQUENCY_LIMITS`, `QUIET_HOURS_WINDOW`, 12 motivos de supressão). Falta a projeção `RecoveryCandidate` que os consome.

### Dois bugs meus, achados nesta varredura

1. **`0013_merchandising` estava registrada mas nunca aplicada.** O schema não existia no banco. Causa: `pnpm db:migrate` sofria do **mesmo** defeito que a API — rodava dentro do pacote e nunca lia o `.env` da raiz. Corrigido em `packages/database/package.json` (`db:migrate` e `db:check`). Aplicadas `0013` e `0015`; `db:check` agora diz `migrationState: CURRENT` com **12 migrations** e `merchandising` com 6 tabelas.
2. **O carrinho ficava `ACTIVE` e vazio depois de virar pedido.** Um carrinho ativo vazio é exatamente o que a projeção de recuperação de `docs/14 §5` procura para mandar lembrete — a pessoa receberia "você esqueceu algo" logo depois de comprar. Agora, quando o último grupo fecha, o carrinho vira `CONVERTED`. Provado: `CONVERTED|0` no banco.

### Inconsistência de contrato na própria API

`GET /v1/listings` devolve `sellerAccountId` como **id público com prefixo** (`sac_...`), como manda `docs/17`; `GET /v1/me/cart/checkout-groups` devolve **UUID cru**. Mesmo campo, dois formatos — um cliente que leia o vendedor do carrinho e o mande de volta recebia `500`.

A rota nova aceita os dois enquanto a divergência não for decidida, e o porquê está escrito no código, não escondido. **A correção certa é o `checkout-groups` emitir id público**; é mudança de contrato e fica registrada aqui.

### Docs ainda não lidos em profundidade

`02-UML` (2028 linhas), `01-PRD` (1821), `21-LAYOUTS` (1264), `17-NOMENCLATURA` (1145), `13-PAGAMENTOS` (1177, só o índice), `09-GROWTH`, `15-STUDIO`, `16-SEO`, `11-PIPELINE-3D`, `06-INVENTARIO`, `requirements.md`, `design.md`.

## Auditoria de design — os benchmarks abertos e medidos, e os oito erros meus

O dono mandou acessar as referências e terminar de clonar. `neshastore.com` e `csfloat.com` foram abertos e medidos ao vivo. `ggmax.com.br` está atrás de verificação Cloudflare e **não foi contornada**.

### O que foi medido

| | Nesha | CSFloat | Nosso (antes) |
|---|---|---|---|
| fundo | `rgb(9,13,17)` | `rgb(21,23,28)` | escuro, porém **quente** (hue 75) |
| superfície | `rgb(24,36,46)` | — | `oklch(17% 0.014 75)` |
| sinais | ciano `0,229,229` · verde `0,217,126` · rosa `230,55,87` | azul `30,144,255` | ouro + turquesa |
| card | **248×343, imagem 309px (90%)** | — | **254×499, imagem 187px (37%)** |

Anatomia exata do card da Nesha, com o texto **sobre** a imagem:

```
y=9    FASE 2               11px/400  cinza      (coleção)
       [imagem, 309 dos 343px]
y=212  Canivete Borboleta   15px/400  branco 50% (item base)
y=234  Doppler              15px/500  branco     (variante)
y=253  R$ 34.000,00         17px/100  rosa riscado
y=273  R$ 24.999,99         20px/400  branco
y=300  0.025                15px/100  branco 50% (float)
```

E a escada de ação, medida na página de item:

```
COMPRAR                bg ciano SÓLIDO   · texto escuro · peso 700 · 380×44
Adicionar ao carrinho  bg MESMO ciano 8% · texto ciano  · peso 600 · mesma largura
Inspecionar            bg superfície     · texto branco · peso 700 · 147×46
```

**A lição que mudou o design system:** a ação secundária usa a **mesma cor da primária em baixa intensidade**, não uma cor diferente nem borda cinza. Hierarquia por intensidade mantém os dois botões na mesma família — o olho lê "as duas são ações de compra" em vez de "uma é ação, a outra é cancelar". Aplicado em `ui-button--secondary`; a superfície neutra virou `ui-button--quiet`, que é o "Inspecionar" do benchmark.

### Os oito erros meus, medidos e corrigidos

| # | Erro | Medida antes | Depois |
|---|---|---|---|
| 1 | **Produto longe demais** — a abertura inteira antes da vitrine | **2,74 dobras** até o primeiro produto | **1,76**; as portas passaram para dentro da primeira dobra |
| 2 | **Peça pequena no card** | imagem = 37% do card | **51%**, com aspecto 1:1 |
| 3 | **Secundário com borda cinza** | lia como "cancelar" | mesma cor da ação a 10% |
| 4 | **Moldura preta em volta da peça** | PNG com fundo sólido sobre fundo escuro | `mix-blend-mode: screen` |
| 5 | **Ticker em três linhas** em `reduced-motion` | 130px de altura | **54px**, uma linha |
| 6 | **Portas centralizadas** por herança de `text-align` | 3 quebras de leitura por porta | alinhadas à esquerda |
| 7 | **CSS morto** — `.title`, `.primary`, `.secondary` duplicavam regras já vivas em `animated-heading` | duas fontes de verdade | removidos, com a razão escrita |
| 8 | **Dois links "Conta"** sem escopo de landmark | quebrava o gate de acessibilidade | asserção escopada por landmark |

O erro nº 1 é o que importa: numa loja, **produto na primeira dobra**. A abertura ganhou trilho de 120svh (era 200), palco de 84svh, peça de 24rem (era 44) e título com teto de 3,4rem (era 5). As portas de categoria passaram a viver **dentro** da primeira dobra, então quem chega vê marca, garantia, 13 preços reais no ticker e três entradas com faixa de preço praticada **sem rolar nada**.

### O que continua errado, e eu declaro

- **1,76 dobras ainda não é 1,0.** A Nesha mostra grade de produto na primeira tela. A nossa mostra preços (ticker) e categorias com preço, mas a grade só na segunda.
- **Nosso fundo é quente** (hue 75); os três benchmarks são frios. É defensável — a marca é dourada e o quente sustenta o ouro — mas é uma divergência deliberada, não um acaso.
- **HUD, grids, bordas técnicas e botões angulares** da referência que o dono forneceu: ainda não aplicados. Mexem em `docs/18` (`radius 6px`) e precisam passar por `tokens.css`.

## Conflito de sessão: cinco reversões, e por que eu parei

`apps/web/app/page.tsx` e `storefront-intro.tsx` foram revertidos **cinco vezes** entre esta sessão e outra do dono. Parei de reescrevê-los. Continuar seria destruir trabalho dos dois lados e queimar token à toa.

**Importante, e a favor da outra sessão:** ela fez nas cores um trabalho **melhor que o meu**. Criou `.public-commerce-theme` em `globals.css` que:

- move o fundo de **quente** (matiz 75) para **frio** (matiz 250) — exatamente a divergência que eu tinha medido contra os quatro benchmarks e deixado registrada como pendência;
- troca a ação de ouro para **ciano** `oklch(78% .145 195)` — que é, na prática, a cor de compra da Nesha (`rgb(0,229,229)`).

Ou seja, ela aplicou o benchmark que eu havia medido. Isso fica.

### O bug que o tema novo criou, e que eu corrigi

O tema comercial trocou a matiz de ação de 80 (ouro) para 195 (ciano). `--och-rarity-uncommon` estava em **200** — cinco graus do ciano. No tema novo, a etiqueta "incomum" ficava praticamente da cor do botão de comprar, violando a regra escrita nos próprios tokens: **raridade nunca preenche nem imita elemento clicável**.

| raridade | distância do ouro (80) | distância do ciano (195) |
|---|---:|---:|
| common | 180 | 65 |
| **uncommon** | 120 | **5** ← violava |
| rare | 175 | 60 |
| epic | 130 | 115 |
| legendary | 55 | 170 |
| mythic | 90 | 155 |
| contraband | 25 | 140 |

`uncommon` foi para **120**: 75° do ciano, 40° do ouro.

**Por que isso passou despercebido:** `packages/ui/src/tokens.test.ts` testava a separação só contra a ação declarada em `tokens.css`, e não pode ler `apps/web` — a fronteira arquitetural proíbe o design system depender do app. Temas locais ficavam sem cobertura.

Criei **`apps/web/components/marketplace/theme-rarity.test.ts`**: ele varre cada bloco `.*theme*` do `globals.css`, extrai a cor de ação de cada um e confere as sete raridades contra todas elas. Um tema novo passa a ser coberto sozinho, sem ninguém lembrar de atualizar o teste.

Provado que o guarda-corpo pega o bug: devolvendo `uncommon` a 200, o teste quebra com
`raridade UNCOMMON está a menos de 12° da ação do tema .public-commerce-theme`; restaurado, passa.

### A escada de raridade tinha sido desligada — restaurada

Achado ao verificar o tema comercial no navegador: **as 19 etiquetas de raridade estavam todas da mesma cor**. A regra `.rarityFlag` tinha sido reescrita, e `color: var(--rarity, ...)` virou `var(--color-text-secondary)` fixo. Os sete tokens ficaram inertes e a escada deixou de informar.

Diagnóstico preciso: `--rarity` **estava** correto no `article` — `lab(63.7 46.9 26.8)` para lendário. Quem ignorava era a etiqueta.

Restaurado mantendo o estilo novo (borda, fundo, `backdrop-filter`), trocando só a origem da cor:

```css
border: 1px solid color-mix(in oklch, var(--rarity, var(--color-border-strong)) 48%, transparent);
color: var(--rarity, var(--color-text-secondary));
```

Verificado depois: **6 cores distintas em 19 etiquetas**, com `INCOMUM` em verde-amarelado (matiz 120), longe do ciano do botão.

Isto NÃO é disputa de layout — é perda de função. A regra vale: ordem de seção e estética são visão da outra sessão e não se disputa; função verificada que some, conserta-se.

---

### Componentes prontos, testados e DESLIGADOS

Estão no disco e não estão referenciados por nenhuma tela. Nada foi apagado; só não estão ligados.

| Arquivo | O que é | Como ligar |
|---|---|---|
| `components/store/intro-piece.tsx` | a peça girando **pelo scroll**, feita para caber exatamente no `<div className={styles.art}>` de `storefront-intro.tsx`, no lugar do `<Image>` | trocar o `<Image>` por `<IntroPiece />` |
| `components/store/price-ticker.tsx` | régua de preços reais, sem animação | `<PriceTicker />` entre `PublicNav` e `<main>` |
| `components/store/store-banners.tsx` + teste (7 casos) | portas por categoria com contagem e faixa de preço reais | `<StoreBanners />` entre `StorefrontIntro` e `LandingCatalog` |
| `components/store/store-overture.tsx` + `animated-heading.tsx` + `scroll-progress.ts` (13 casos) | abertura de tela cheia, alternativa mais expressiva à faixa atual | usar no lugar de `StorefrontIntro` |

As duas violações de doc que existiam neles **já foram corrigidas**: a peça não gira sozinha (rotação = pose neutra + progresso do scroll) e o ticker não move preço (`animation: none`, arraste nativo).

**Esta é uma decisão do dono, não das sessões.** Duas sessões dele leram o mesmo doc e chegaram a conclusões opostas sobre a peça 3D na home; ele já escolheu "girar pelo scroll" num menu de decisão, mas a tela hoje não reflete isso.

## Estado verificado por comando

```
pnpm typecheck                32/32
pnpm lint                     32/32 + "Fronteiras arquiteturais válidas."
pnpm build                    19/19
pnpm --filter web test        44 arquivos · 494 testes
pnpm --filter @midas/ui test   4 arquivos ·  34 testes
pnpm --filter @midas/orders test 2 arquivos · 33 testes
report --functional           42/95 superfícies; 53 CONTRACT_REQUIRED
API GET /v1/listings          200 · 21 anúncios · 7 vendedores
grade da vitrine              altura uniforme por fileira; 0 colisão CTA/preço; 0 overflow
escada de raridade            6 cores distintas em 19 etiquetas
viewports do doc 03 §365      320/375/414/768/1280/1440 — overflow 0 em todos
alvos de toque                0 abaixo do mínimo WCAG (24×24)
```

**Armadilha do gate:** `pnpm typecheck` com `next dev` no ar falha em
`.next/dev/types/validator.ts` — arquivo **gerado** pelo Next, não código do
repositório. Mate o dev server antes de rodar o gate, ou o erro parece regressão
e não é.

**Sobre `pnpm test` (raiz):** falhou duas vezes em `favorites-view` e `level-ladder`. Rodados isolados: **31 testes, todos passam**. É contenção de recurso — dois dev servers, Podman e turbo na mesma máquina. Não é regressão, mas está registrado para não ser confundido com uma.

---

## Colisão com a sessão par

`markeplace-af` reescreveu `apps/web/app/page.tsx` importando `storefront-intro` e `storefront-footer`, **que nunca chegaram ao disco** — a home ficou em **HTTP 500**. A sessão encerrou antes de criar os arquivos.

Assumi o `page.tsx` e restaurei a home com a abertura. Se aquela sessão voltar com os componentes, a composição que preserva os dois lados é:

```
AnnouncementBar → PublicNav → StoreOverture → StorefrontIntro → LandingCatalog → StorefrontFooter
```

---

## Próximo passo exato

0. **Botão "Fechar pedido" em `/carrinho`.** O comando `POST /v1/me/cart/checkout-groups/:sellerAccountId/orders` está pronto, testado e provado contra o banco; a tela ainda não o chama. É o menor trabalho com maior efeito no fluxo de compra — um botão por grupo de vendedor, com `Idempotency-Key` estável por clique.
1. **Commit.** `apps/`, `modules/` e `packages/` seguem **sem nenhuma versão**. O repo tem 4 commits, todos de documentação. É o único item que só o dono destrava, e o risco mais grave aberto.
2. **Abrir a home no navegador real** e olhar a peça 3D girando — é a única verificação que este ambiente não fez.
3. **Ler `docs/08-ADRS`**, começando pelo §2.1. O grafo diz que é o nó mais acoplado do contrato e a lista de ADRs não implementadas está lá.
4. `docs/12-MATRIZ-DE-IMPLEMENTACAO.md` — fonte canônica de estado segundo `docs/05`. Segue não lido.
5. **Banners de merchandising** — pedidos pelo dono, ainda não construídos. `modules/merchandising` já tem `item_relations` e `bundles`; falta a superfície.
6. **HUD, grids, bordas técnicas e botões angulares** — da referência do dono, ainda não aplicados. `docs/18` fixa `radius 6px` nos controles; ele autorizou refazer o brand, então a mudança é legítima, mas precisa passar por `tokens.css` e não por CSS solto, senão renasce a paleta paralela.
7. `modules/promotions` (cupom, afiliado, atribuição — tarefas 27/28 do SDD). Migration livre sugerida: **0017**.

## Sub-pedidos do dono nesta sessão, item a item

| Pedido | Estado |
|---|---|
| `/graphify` sobre `docs/` | **feito** — 618 nós, 1199 arestas |
| "as cores estão péssimas" | **feito** — paleta paralela eliminada, loja escura |
| logo girando, flutuando, sumindo com o scroll | **feito** — não verificável em headless |
| "induza o cara a comprar / recrie tudo" | **feito** — home reescrita |
| letras animadas + CTAs | **feito** — CSS puro, sem `motion` |
| vários vendedores tipo GGMax | **feito** — 7 vendedores, 21 anúncios |
| "os preços passando" | **feito** — `PriceTicker` |
| tipografia leitura em Z + hierarquia | **feito** — no card |
| CTA, cores, formas | **feito** — CTA nomeado, raridade, alinhamento |
| ver a referência que ele fez | **feito** — token de sinal turquesa extraído dela |
| psicologia de cores | **feito** — ouro = ação, turquesa = sinal, raridade = informação |
| banners | **NÃO feito** |
| HUD / bordas técnicas / botões angulares | **NÃO feito** |
| `/huashu-design` | **NÃO carregada** — usei `impeccable` + os livros de Gestalt e neuromarketing |
| ler `docs/12` (fonte canônica de estado) | **feito** |
| conformidade com os docs | **auditada** — 2 violações achadas e corrigidas |
| fluxo de compra | **medido e completado** — carrinho→pedido por vendedor |

## Bloqueios

- **SEM COMMIT** — destrava com uma palavra do dono.
- **WebGL não verificado visualmente** — destrava abrindo `http://localhost:3000` no navegador real.
- **G0** autorização do publicador: `BLOQUEADO` (por isso o seed usa arte própria).
- **G1** feed de mercado licenciado: `BLOQUEADO`.
- **G2** PSP: pendente — `/checkout` monta resumo e aceite, não processa cobrança.
- **G3** políticas comerciais: pendente.
- **Sem conta de staff/admin** — IAM exige grant explícito; `/admin/*` e `/master/*` sob `default deny`.
