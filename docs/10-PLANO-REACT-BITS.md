# Plano de uso — React Bits no Midas

Versão 1.1 · Blueprint pré-código · 22 de agosto de 2026

## 1. Decisão

React Bits será a camada de **expressão visual e microinteração** da futura aplicação React. Não será o design system, o kit de formulários, o motor de gráficos nem a fonte de regras de negócio.

O repositório atual não possui `package.json`, aplicação React ou definição de CSS/Tailwind. Portanto:

- **DOCUMENTADO:** a intenção do dono de usar [React Bits](https://reactbits.dev/) e o mapa de uso abaixo;
- **PROPOSTO:** componentes, wrappers, regras de performance e testes;
- **NÃO INSTALADO:** `react-bits`, `three`, React Three Fiber ou qualquer dependência de UI;
- **BLOQUEADO:** variante `JS/TS + CSS/Tailwind` e comandos de instalação até a stack real existir.

O projeto oficial fornece componentes copiáveis e variantes JS/TS com CSS/Tailwind; o README recomenda instalação seletiva por shadcn/jsrepo ou cópia manual. O Midas deve trazer **somente os componentes aprovados**, registrar o commit de origem e manter o código dentro do repositório, em vez de importar toda a galeria. Fontes: [repositório oficial](https://github.com/DavidHDev/react-bits) e [guia de instalação](https://reactbits.dev/get-started/installation).

## 2. Regra de ouro

> Movimento explica hierarquia, continuidade ou resposta. Se apenas chama atenção, não entra.

React Bits pode elevar descoberta e marca. Em checkout, saldo, saque, reembolso, disputa, segurança e backoffice, clareza de estado e precisão vencem espetáculo.

## 3. Arquitetura de integração proposta

```text
src/ui/
├── primitives/                 controles acessíveis e estáveis
├── patterns/                   composição Midas por jornada
├── motion/
│   ├── MotionPolicy.tsx        reduced-motion, device tier e route policy
│   ├── LazyVisual.tsx          carrega enhancement após conteúdo essencial
│   └── StableNumber.tsx        valor sem animação em contexto financeiro
└── react-bits/
    ├── AnimatedContent/
    ├── AnimatedList/
    ├── BlurText/
    ├── CountUp/
    ├── DarkVeil/
    ├── FadeContent/
    ├── SpotlightCard/
    └── Stepper/
```

Cada componente importado deve possuir:

```text
component.tsx
styles.css ou tokens Tailwind
adapter.tsx                 API Midas estável, sem props arbitrárias na página
component.test.tsx
component.stories.tsx       se Storybook for escolhido
SOURCE.md                   URL, commit, variante, licença e alterações locais
```

Páginas consomem o **adapter Midas**, não a implementação copiada diretamente. Isso permite corrigir acessibilidade, trocar a variante ou remover a animação sem editar dezenas de rotas.

## 4. Política por zona

| Zona | Intensidade | Regra |
|---|---|---|
| Home e campanha | expressiva controlada | até um background animado e uma animação tipográfica acima da dobra |
| Market e descoberta | moderada | entrada de grid e feedback de hover; nunca mover preço/CTA de lugar |
| Item e anúncio | moderada | produto e viewer 3D dominam; React Bits apenas no shell DOM |
| Login, cadastro e recuperação | mínima | transição de painel; nenhum fundo que prejudique leitura ou foco |
| Minha conta e vendedor | baixa | continuidade entre seções e atividade recente; números financeiros estáveis |
| Growth | baixa/analítica | entrada única de cards/listas; gráficos e filtros não animam continuamente |
| Checkout, saldo, saque, refund e disputa | essencial | sem cursor, magnetismo, brilho pulsante ou contador animado |
| Admin/Master | essencial | nenhuma decoração que concorra com fila, risco, prazo, motivo ou auditoria |
| Viewer e revisão 3D | especializada | Three.js controla o canvas; React Bits anima somente carregamento/painéis DOM |

## 5. Componentes aprovados e uso exato

### 5.1. `DarkVeil`

Uso: background exclusivo da Home/hero, com paleta carvão + ouro, carregado depois do conteúdo e substituído por gradiente estático em reduced motion, economia de dados, GPU fraca ou erro.

Não usar em Market, dashboard, formulário, mobile de baixa capacidade ou junto de outro canvas WebGL.

### 5.2. `BlurText`

Uso: revelar uma única frase curta do hero na primeira visita. O título completo já existe no DOM e permanece acessível; a animação não controla SEO nem leitura.

Não usar em status, tabela, preço, validação, notificação crítica ou a cada navegação interna.

### 5.3. `AnimatedContent` e `FadeContent`

Uso: entrada discreta de uma seção após mudança de rota/estado e revelação da imagem/preview quando carregado. Distância curta, duração limitada e execução única.

Não encadear elemento por elemento em tabelas longas. Paginação e refetch preservam posição e não reproduzem a sequência inteira.

### 5.4. `SpotlightCard`

Uso: cards de categoria, benefício ou oportunidade Growth selecionada. O spotlight é enhancement de ponteiro; borda, foco, título e ação funcionam sem ele.

Não usar em toda linha de pedido, extrato, saldo, ticket, refund, disputa ou payout.

### 5.5. `AnimatedList`

Uso: atividade recente, notificações e interações Growth. Somente inserção/remoção realmente ocorrida anima; lista paginada não reordena visualmente sem explicação.

Identidade do item usa ID canônico, nunca índice. Em reduced motion a lista atualiza sem deslocamento.

### 5.6. `Stepper`

Uso: onboarding do vendedor, criação de anúncio, solicitação de refund e job 3D. O adapter deve expor `currentStep`, `completedSteps`, erros, labels e navegação por teclado; estado do servidor continua canônico.

Não usar como máquina de estados. Reabrir a tela reconstrói o step atual a partir do backend.

### 5.7. `CountUp`

Uso permitido somente para contagens agregadas não financeiras em Home/Growth — por exemplo, quantidade de pedidos concluídos — na primeira carga e com valor final disponível ao leitor de tela.

Uso proibido para preço, saldo, hold, fee, refund, dívida, payout, GMV, receita ou qualquer valor que possa parecer estar mudando em tempo real.

## 6. Componentes avaliados, mas fora do padrão

| Componente/família | Decisão | Motivo |
|---|---|---|
| `MagicBento` | piloto somente na Home | composição forte, mas densa demais para telas operacionais |
| `Masonry` | condicional em galeria editorial | catálogo transacional exige alinhamento estável de preço e CTA |
| `Dock` | não adotar no MVP | navegação móvel precisa ser previsível, acessível e compatível com safe areas |
| `TiltedCard`, `ReflectiveCard`, `GlareHover` | não combinar com cards de produto | distorção/efeito compete com imagem, preço e viewer 3D |
| `ShinyText`, `GradientText` | selo de marca pontual | proibidos em dados, status e ações críticas |
| `StarBorder`, `ElectricBorder` | apenas experimento visual | borda em movimento não deve sugerir urgência ou elegibilidade |
| `PixelTransition`, `StickerPeel` | demonstração editorial | não representam mudança de estado canônico |
| `ProfileCard` | não usar como perfil real | pode induzir um segundo modelo visual de usuário/vendedor |

## 7. Lista de exclusão explícita

Não entram na experiência transacional:

- cursores: `BlobCursor`, `GhostCursor`, `SplashCursor`, `TargetCursor`, `Crosshair`, `CursorGrid`, `SwarmCursor`;
- estímulos globais: `ClickSpark`, `Magnet`, `MagnetLines`, `ImageTrail`, `PixelTrail`;
- fundos intensos: `Hyperspeed`, `Lightning`, `FaultyTerminal`, `LightTunnel`, `Ballpit`, `Antigravity`;
- texto que reduz leitura: `GlitchText`, `FuzzyText`, `ScrambledText`, `DecryptedText` em conteúdo funcional;
- qualquer componente que intercepte scroll, cursor, foco, seleção de texto ou gesto do viewer 3D.

Uma exceção exige experimento delimitado, fallback e revisão de acessibilidade/performance. Não pode alcançar checkout, financeiro, suporte ou staff.

## 8. Mapa rota → componente

| Superfície | React Bits | Objetivo | Fallback obrigatório |
|---|---|---|---|
| `/` | `DarkVeil`, `BlurText`, `AnimatedContent` | atmosfera da marca e hierarquia inicial | fundo estático, título direto e conteúdo visível |
| `/market`, `/midas`, `/buscar` | `AnimatedContent` | entrada única do grid após carregamento | grid estático |
| `/itens/:slug`, `/anuncios/:listingId` | `FadeContent` | revelar poster e ação que navega à inspeção individual | poster/galeria 2D e link direto |
| `/itens/:slug/3d` (`SCR-PUB-013`) | `FadeContent` ou `AnimatedContent` somente no shell DOM | transição poster→shell, controles e mensagens; Three.js/R3F controla o canvas | poster/galeria 2D, dados do item e Voltar |
| `/entrar`, `/cadastro` | `FadeContent` | transição curta entre contexto e formulário | formulário imediato |
| `/vender/cadastro`, `/vender/novo` | `Stepper` | comunicar progresso do fluxo | lista numerada com estado textual |
| `/conta` | `AnimatedContent`, `AnimatedList` | cards aplicáveis e atividade | conteúdo estático ordenado |
| `/conta/vendas` | `AnimatedList` | pedidos novos que exigem ação | tabela/lista estável |
| `/conta/compras/:id/reembolso/novo` | `Stepper` | motivo → resolução → evidência → revisão | headings e navegação DOM |
| `/admin/growth` | `AnimatedContent`, `CountUp` restrito | entrada inicial dos agregados não financeiros | números finais estáveis |
| `/admin/growth/interacoes` | `AnimatedList` | novas interações válidas | tabela paginada |
| `/admin/catalogo/modelos-3d/:jobId` | `Stepper`, `FadeContent` | fases reais e preview aprovado | status textual + poster/turntable |
| checkout/financeiro/admin crítico | nenhum por padrão | reduzir ambiguidade | DOM/design system canônico |

## 9. Convivência com Three.js

O visualizador usa `three` + `@react-three/fiber` + `@react-three/drei` exclusivamente em `SCR-PUB-013`. React Bits não renderiza, gira, ilumina ou posiciona o modelo e não cria um segundo loop gráfico.

Regras:

1. no máximo um canvas WebGL e um `Model3DArtifact` ativos na aplicação; detalhes/cards apenas navegam para `/itens/:slug/3d`;
2. `DarkVeil` não monta quando o viewer 3D está montado;
3. o poster aparece antes do canvas e continua sendo fallback;
4. animações DOM não rodam continuamente durante drag/zoom;
5. `MotionPolicy` combina reduced motion, visibilidade, tier de GPU e preferência de dados;
6. Three.js/R3F executa uma única abertura de 650–900 ms e para; qualquer pointer, toque, wheel, tecla ou controle a interrompe imediatamente;
7. `prefers-reduced-motion` pula a abertura e monta diretamente a pose final, sem atraso artificial;
8. troca de slug, **Voltar** ou unmount libera geometria, materiais, texturas, loaders, observers, listeners, RAF e contexto antes do próximo artefato;
9. o router preserva a origem da seleção no histórico; deep link por slug continua independente dessa origem;
10. eventos do viewer e do React Bits usam nomes distintos e não contam conversão financeira.

## 10. Contrato de movimento

Tokens propostos, sujeitos a validação visual:

```css
:root {
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-slow: 280ms;
  --motion-distance-sm: 8px;
  --motion-distance-md: 16px;
  --motion-ease-out: cubic-bezier(.2, .8, .2, 1);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 1ms !important;
  }
}
```

A janela de 650–900 ms é uma exceção exclusiva da entrada do modelo, não um token React Bits. O tween vive no controlador Three.js/R3F, converge para uma pose neutra, não repete e pode ser cancelado no primeiro input; o shell DOM obedece aos tokens curtos acima.

Movimento automático contínuo fica pausado quando fora da viewport, em aba oculta ou após perda de foco quando aplicável.

## 11. Registro de componente

```text
ReactBitsComponent
- name
- upstreamUrl
- upstreamCommit
- upstreamVariant             TS_CSS | TS_TW | JS_CSS | JS_TW
- localPath
- directDependencies[]
- routes[]
- purpose
- reducedMotionBehavior
- staticFallback
- bundleDelta
- perfOwner
- a11yOwner
- reviewDate
```

Atualização não é automática. O fluxo é: diff upstream → revisar licença/dependências → aplicar mudanças → testes visuais, a11y e performance → registrar novo commit.

## 12. Gates executáveis

### Componente

- renderiza sem erro com animação habilitada e desabilitada;
- não muda ordem DOM, nome acessível ou foco ao terminar;
- não bloqueia clique/teclado/scroll do conteúdo essencial;
- desmonta timers, observers, listeners, RAF, canvas e recursos gráficos;
- possui fallback estático equivalente;
- não produz hydration mismatch;
- bundle delta e dependências são registrados.

### Página

- navegação e ação principal funcionam com JavaScript de animação bloqueado;
- screenshot em reduced motion mantém hierarquia completa;
- CPU 4× slower e rede lenta não impedem conteúdo/CTA;
- animação fora da viewport não consome frames continuamente;
- nenhum layout shift move preço, ação ou campo durante interação;
- foco visível, leitor de tela e zoom 200% passam;
- checkout, saldo, payout, refund e disputa não usam animação de número.

### Regressão

```text
TST-UI-MOTION-001  reduced motion remove movimento sem remover conteúdo
TST-UI-MOTION-002  teclado alcança cada ação na mesma ordem
TST-UI-MOTION-003  rota crítica funciona sem enhancement
TST-UI-MOTION-004  unmount zera RAF/listeners/canvas
TST-UI-MOTION-005  lista não duplica/reordena item por animação
TST-UI-MOTION-006  valor financeiro permanece estável
TST-UI-MOTION-007  viewer 3D e background React Bits nunca coexistem
TST-UI-MOTION-008  fallback mobile/WebGL/reduced-motion é equivalente
TST-UI-MOTION-009  item selecionado abre seu slug 3D e Voltar restaura a origem
TST-UI-MOTION-010  intro Three.js termina em 650–900 ms e não reinicia parada
TST-UI-MOTION-011  primeiro input interrompe intro; reduced motion pula à pose final
TST-UI-MOTION-012  troca/unmount descarta artefato, canvas, RAF e listeners anteriores
```

## 13. Sequência de adoção

1. Escolher stack React e variante React Bits.
2. Criar `MotionPolicy`, tokens e harness de screenshot/performance.
3. Importar `FadeContent` e `AnimatedContent`; corrigir acessibilidade no adapter.
4. Pilotar Home com `DarkVeil` + `BlurText` sob feature flag.
5. Pilotar `SCR-PUB-013`: React Bits somente no shell e Three.js/R3F na abertura finita/canvas, com harness de input, reduced motion, Voltar e descarte.
6. Pilotar `Stepper` no onboarding e job 3D.
7. Pilotar `AnimatedList` em atividade; testar reordenação e realtime.
8. Adicionar `CountUp` somente após o registro de métricas e a regra de números estáveis.
9. Medir; remover qualquer enhancement que falhe nos gates.

## 14. Definition of Done

React Bits está “bem usado” quando a interface continua completa sem ele, cada efeito tem função explícita, o custo está medido, reduced motion é real e nenhum painel financeiro/operacional troca precisão por espetáculo. Em `SCR-PUB-013`, isso também exige que o shell DOM não dispute câmera, gesto, canvas ou ciclo de renderização com Three.js/R3F.
