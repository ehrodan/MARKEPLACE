# MIDAS — Visão executiva de produto e arquitetura

**Documento de orientação com registro de execução**

Versão: 3.1 · Data-base: 23 de agosto de 2026 · Idioma: pt-BR

> **Promessa do produto:** descobrir o item certo, negociar com proteção, acompanhar cada etapa e entender quando o valor fica disponível.

> **Estado verificável:** existe uma aplicação modular executável com identidade/SellerAccount, corte financeiro fail-closed, painéis críticos, policies de progressão e experiência 3D. Isso ainda não é o marketplace completo: 84 das 95 superfícies continuam `CONTRACT_REQUIRED`, e PSP, Growth, refunds, reviews, Studio e canais externos não estão operacionais.

## 1. Resultado definido

Midas é o blueprint de um marketplace transacional de itens digitais. A experiência conecta catálogo/Studio, anúncio aprovado, carrinho, pagamento reconciliado, entrega rastreável, reputação, progressão, pós-venda consentido, suporte contextual, saldo compreensível, saque auditável e aquisição orgânica global.

O desenho atual cobre:

| Dimensão | Inventário corrente |
|---|---:|
| Requisitos funcionais | `RF-001–300` |
| Requisitos não funcionais | `RNF-001–050` |
| Contratos de tela (`SCR-*`) | 95 |
| Shells de interface | 9 |
| Templates reutilizáveis de interface | 41 |
| Decisões arquiteturais | 19 ADRs |
| Diagramas no documento de arquitetura | 34 Mermaid |

Esses números medem especificação, não implementação. O estado técnico por ADR está em `08-ADRS-DECISOES-ARQUITETURAIS.md`; a matriz viva e seus limites estão em `12-MATRIZ-DE-IMPLEMENTACAO.md`.

## 2. Hierarquia do produto

```text
Midas Platform
├── Público
│   ├── Início, busca e descoberta
│   ├── Market P2P
│   ├── Compre do Midas
│   ├── Item-base e anúncio específico
│   ├── Ranking e recompensas
│   └── Inspeção 3D individual do item
├── Cliente autenticado
│   ├── Minha conta
│   ├── Carrinho, compras e sala de entrega
│   ├── Vendas e dashboard do vendedor
│   ├── Saldo de vendas, holds e saques
│   ├── Avaliações, nível, insígnias e recompensas
│   ├── Suporte, disputas e reembolsos
│   └── Segurança, privacidade e preferências
├── Tenant vendedor
│   ├── SellerAccount
│   ├── SellerMembership + User
│   ├── Biblioteca/Studio, anúncios e estoque
│   └── clientes, marketing, cupons, afiliados, Growth e recomendações
└── Operação da plataforma
    ├── Moderação, Studio e catálogo
    ├── Pedidos, pagamentos, payout e conciliação
    ├── Reputação, progressão, planos, marketing, suporte e financeiro
    └── IAM, mercados/SEO, configurações, integrações e auditoria
```

O limite multi-tenant é `SellerAccount`. A identidade continua em `User`; a autorização para operar naquele tenant fica em `SellerMembership`. Painéis de Growth, vendas e saldo são projeções dessas fontes e dos domínios transacionais — não novos cadastros ou livros financeiros.

## 3. Jornadas prioritárias

### 3.1 Comprar

```text
Descoberta → Item/anúncio → Proposta ou checkout → Pagamento reconciliado
→ Sala de entrega → Confirmação/disputa → Pedido concluído
```

O redirect do PSP não confirma pagamento. O estado pago nasce de webhook autenticado, idempotente e reconciliado com a tentativa correta.

### 3.2 Vender e receber

```text
Onboarding do vendedor → Novo anúncio → Moderação → Publicação
→ Reserva/pedido → Entrega → Hold → Saldo disponível → Solicitação de saque
```

O dashboard explica cada parcela do valor: pendente, retida, disponível, em saque, paga, estornada ou afetada por disputa. A confirmação de saque consulta a fonte financeira canônica; um card de dashboard nunca movimenta dinheiro.

### 3.3 Acompanhar compras e suporte

“Minha conta” centraliza compras, vendas, ações pendentes, suporte, segurança e privacidade. Cada detalhe continua pertencendo ao objeto canônico correspondente (`Order`, `Delivery`, `Dispute`, `RefundRequest`, ticket ou sessão), evitando dados paralelos no perfil.

### 3.4 Analisar Growth no tenant

```text
Platform → SellerAccount selecionado → período/filtros → KPI
→ etapa do funil → lista canônica → objeto operacional
```

O painel mostra aquisição, ativação, conversão, retenção e receita em níveis progressivos, sempre com escopo aplicado no servidor. Recomendações explicam fonte, janela, confiança e ação possível. Oportunidades continuam leitura derivada até existir um ciclo operacional aprovado; não recebem estado paralelo.

### 3.5 Inspecionar uma peça em 3D

Selecionar um item leva a `SCR-PUB-013`, em `/itens/:slug/3d`. Cada slug resolve uma tela própria com uma única peça e um único canvas ativos.

```text
Card/detalhe → rota 3D do slug → poster/fallback → GLB pronto
→ introdução finita → interação livre → voltar à origem preservada
```

A abertura faz um reveal curto e delimitado, então para completamente. Rotação, zoom, vistas canônicas, reset e tela cheia ficam sob controle do usuário. Qualquer gesto interrompe a introdução; `prefers-reduced-motion` abre diretamente na pose final. Ao trocar o item, a tela descarta geometria, materiais, texturas e listeners anteriores antes de montar o próximo artefato.

O pipeline aceita fontes autorizadas como PNG, SVG rasterizado e vistas múltiplas, mas não promete reconstrução exata a partir de uma única imagem. `Model3DArtifact` publicado registra origem, versão, validação e revisão humana.

### 3.6 Resolver pagamento, liberar hold e pagar o seller

```text
PaymentAttempt → webhook/inbox → reconciliação PSP → Payment.SETTLED
→ JournalEntry/Postings → BalanceLot + Hold de 168h
→ gates concluídos → disponível → PayoutRequest → PayoutAttempt/Evidence → pago
```

Quando o pagamento não é reconhecido, `PaymentResolutionCase` reúne prova e provider lookup; decisão do Master autorizado chama o mesmo settlement idempotente. Hold começa em `Payment.settledAt`; conclusão do pedido é gate. Baixa manual de saque exige modo homologado, maker-checker, referência, comprovante privado e reconciliação — não existe botão que edita saldo.

### 3.7 Avaliar, progredir e competir

Comprador e vendedor podem criar uma `OrderReview` 0–5 após pedido concluído. `ReputationProjection`, níveis 1–10 e leaderboard mensal são projeções versionadas com contribuições rastreáveis e compensação de refund/chargeback. Master publica definições, insígnias, rewards, prêmio top 3 e planos Básico/VIP/Premium; nenhuma recompensa muda ledger ou compra mérito em suporte/refund/risco.

### 3.8 Recuperar carrinho e fidelizar com consentimento

```text
Cart → abandono/lifecycle elegível → ConsentRecord + SuppressionEntry
→ CampaignVersion/JourneyVersion → Dispatch/DeliveryAttempt
→ click/cupom/touch → Order/Payment reconciliado → AttributionSnapshot
```

O seller vê segmentos/coortes e resultados do próprio `SellerAccount`, não números de WhatsApp ou e-mails brutos. WhatsApp usa API oficial/opt-in/template; Instagram só continua conversa iniciada pela pessoa. Compra, opt-out, dispute ou refund suprimem jornadas aplicáveis. Cupom/afiliado só produz comissão após conversão reconciliada e suporta reversão.

### 3.9 Criar anúncio pelo Studio

O vendedor pesquisa a `CatalogLibrary`, inspeciona mídia 2D ou artefato 3D e inicia o mesmo `Listing` pré-preenchido. Item ou asset ausente vira `CatalogSubmission` privada para curadoria; não nasce outro catálogo. `ProductLifecyclePolicy`, `ReturnPolicySnapshot` e `CatalogItemRelation` permanecem conceitos separados. Publicação exige proveniência, licença, segurança e revisão.

### 3.10 Ser encontrado globalmente

`MarketPolicy` governa locale, moeda de exibição, disponibilidade, PSP, termos e indexação. HTML público, canonical, hreflang, robots, sitemap e structured data derivam da publicação/`CrawlPolicy`; conta, carrinho, checkout, admin, preview e drafts ficam fora do índice. 3D é progressive enhancement e nunca bloqueia conteúdo essencial.

## 4. Decisões arquiteturais consolidadas para aceite

| Tema | Decisão |
|---|---|
| Forma inicial | monólito modular + gateway de chat + workers assíncronos |
| Persistência canônica | PostgreSQL, transações locais e outbox/inbox |
| Venda unitária | um pedido compra um anúncio no MVP |
| Catálogo | itens, variantes e assets versionados, administráveis e com proveniência |
| Tenant | `SellerAccount`; acesso por `SellerMembership` associado a `User` |
| Pagamento | confirmado por webhook autenticado e reconciliação, nunca pelo redirect |
| Dinheiro | PSP movimenta fundos; ledger imutável registra obrigações e saldos |
| Exceção financeira | `PaymentResolutionCase` converge no mesmo settlement; payout manual usa `PayoutAttempt`/`PayoutEvidence` e capability comprovada |
| Hold | `eligibleAt = Payment.settledAt + 168h`; conclusão/risco/disputa são gates, não outro relógio |
| Reembolso | `RefundRequest` registra solicitação/decisão; PSP e ledger executam o efeito financeiro |
| Dashboard | projeção eventual, reconstruível e sem autoridade para mutar saldo |
| Entrega | fluxo rastreável por tipo de item e integração autorizada |
| Chat | políticas distintas para pré-compra, entrega e suporte |
| Growth | leitura hierárquica do tenant sobre objetos canônicos |
| Reputação/progressão | reviews, nível, awards e leaderboard são projeções/fatos versionados e reconstruíveis |
| Plano comercial | policy versionada + snapshot no anúncio/pedido; prioridade não muda mérito legal/risco |
| Pós-venda | contato protegido pela Platform; consentimento/supressão/capability precedem cada disparo |
| Studio | `CatalogLibrary` é read model; seleção inicia o mesmo `Listing`; contribuição usa `CatalogSubmission` |
| SEO/global | market/crawl policies e estado publicado geram HTML, canonical, sitemap, robots e schema |
| Cache/fila | PostgreSQL é fonte; Redis/Valkey acelera cache/rate limit/locks/dedupe e pode ser reconstruído |
| 3D | job assíncrono, GLB validado, artefato versionado, revisão e publicação controlada |
| UI motion | React Bits no shell DOM; Three.js/R3F controla somente o canvas 3D |

## 5. Fontes canônicas e projeções

```text
Escrita transacional
  ├── identidade e autorização
  ├── catálogo, item, variante e anúncio
  ├── carrinho, reserva, pedido, pagamento e entrega
  ├── ledger, hold, refund e payout
  ├── review/contribuições/awards, campanha/consentimento e catálogo Studio
  └── suporte, disputa, policies e auditoria
          │
          ├── outbox/eventos idempotentes
          ▼
Leitura derivada
  ├── Minha conta
  ├── dashboard de vendas
  ├── saldo explicado
  ├── reputação, progressão e leaderboard
  ├── customer insights, atribuição e SEO público
  ├── Growth multi-tenant
  └── visão operacional 360°
```

Uma nova tela deve consumir o contrato existente ou justificar uma alteração na ADR/PRD. Não se cria um segundo `User`, tenant, pedido, saldo, item ou estado de oportunidade para facilitar a interface.

## 6. Direção de experiência

Midas Foundry usa uma interface escura, densa e legível, com hierarquia comercial clara. Preço, disponibilidade, risco, próxima ação e estado da transação aparecem no contexto em que a decisão ocorre.

React Bits é uma biblioteca de acabamento, não uma arquitetura de produto. Os componentes aprovados devem respeitar acessibilidade, `prefers-reduced-motion`, budget de bundle e orçamento de composição. Efeitos decorativos não podem disputar atenção com preço, CTA, alertas financeiros ou o canvas 3D.

Os estados mínimos de cada tela são: carregando, vazio, erro recuperável, acesso negado, dado desatualizado e sucesso. A navegação deve preservar filtros, tenant e origem quando isso reduz retrabalho do usuário.

A [Nesha Store](https://neshastore.com/) e a página observada em [standoff-2.com/shop](https://standoff-2.com/shop/) servem apenas como benchmarks clean-room de navegação, densidade e leitura de catálogo. Nenhum texto, layout, endpoint ou ativo desses sites vira dependência do Midas; proveniência e inventário permanecem em [Referências e assets](06-INVENTARIO-REFERENCIAS-E-ASSETS.md).

## 7. Estado de implementação

| Camada | Estado |
|---|---|
| PRD, UX, arquitetura e decisões | documentados |
| Mapa de 95 telas | documentado |
| Contratos, nomenclatura e rastreabilidade | especificados; validação documental executada nesta revisão |
| Frontend e design system executável | não implementados |
| Backend, banco e migrations | não implementados |
| PSP, autenticação e integrações externas | não implementados |
| Pipeline e viewer 3D em runtime | não implementados |
| Testes unitários, integração e E2E do produto | não implementados |
| Deploy, observabilidade e operação | não implementados |

O próximo passo correto é implementar um corte vertical real, pequeno e verificável, conforme a matriz — com persistência, autorização, contrato e teste — sem apresentar mocks como função pronta.

## 8. Ordem recomendada de construção

1. Fundar repositório de runtime, toolchain, CI, observabilidade e ambientes.
2. Implementar identidade, `SellerAccount`, `SellerMembership`, sessão e autorização server-side.
3. Entregar catálogo → item → anúncio → moderação como primeiro corte persistido.
4. Adicionar busca, vitrines e detalhes públicos com os estados completos de UX.
5. Implementar pedido, PSP sandbox, webhook, ledger e reconciliação.
6. Construir entrega, disputa, hold, saldo, reembolso e payout.
7. Ligar Minha conta, compras, vendas, suporte e operação às fontes canônicas.
8. Implementar payment resolution/payout ops, reviews, progressão, leaderboard e planos por policies versionadas.
9. Materializar carrinho, lifecycle, pós-venda/consentimento, campanhas, cupons, afiliados e attribution em adapters reais.
10. Implementar Studio/CatalogSubmission e o pipeline 2D→3D com validação, fallback e budgets.
11. Materializar Growth, SEO/market/crawl projections por eventos versionados, RLS/escopo e replay testado.
12. Executar hardening, acessibilidade, carga, segurança, reconciliação e piloto controlado.

Dependências e critérios de aceite detalhados permanecem no [backlog](05-BACKLOG-ROADMAP.md) e na [matriz de implementação](12-MATRIZ-DE-IMPLEMENTACAO.md).

## 9. Mapa dos artefatos

| Arquivo | Pergunta que responde |
|---|---|
| [01 — PRD](01-PRD-MIDAS.md) | o que o produto deve fazer e como aceitar cada requisito? |
| [02 — UML e arquitetura](02-UML-ARQUITETURA.md) | quais módulos, estados, APIs, eventos e sequências sustentam o fluxo? |
| [03 — Direção de arte](03-DIRECAO-DE-ARTE.md) | como a interface deve parecer, responder e permanecer acessível? |
| [04 — Segurança e operações](04-SEGURANCA-COMPLIANCE-OPERACOES.md) | como proteger identidade, transação, dado e operação? |
| [05 — Backlog e roadmap](05-BACKLOG-ROADMAP.md) | em qual ordem construir e como provar conclusão? |
| [06 — Referências e assets](06-INVENTARIO-REFERENCIAS-E-ASSETS.md) | quais referências e ativos têm proveniência ou restrição? |
| [07 — Mapa de telas](07-MAPA-DE-TELAS-E-FLUXOS.md) | quais são os 95 contratos de tela, rotas e transições? |
| [08 — ADRs](08-ADRS-DECISOES-ARQUITETURAIS.md) | quais decisões foram tomadas e quais consequências carregam? |
| [09 — Growth multi-tenant](09-PAINEL-GROWTH-MULTITENANT.md) | como KPIs, filtros e drill-down respeitam o tenant? |
| [10 — Plano React Bits](10-PLANO-REACT-BITS.md) | onde motion ajuda e quais limites técnicos aplicar? |
| [11 — Pipeline 3D](11-PIPELINE-3D-ARMAS.md) | como gerar, validar, revisar, publicar e exibir o ativo 3D? |
| [12 — Matriz de implementação](12-MATRIZ-DE-IMPLEMENTACAO.md) | qual requisito chega a qual domínio, tela e teste? |
| [13 — Pagamentos/reputação/progressão](13-PAGAMENTOS-REPUTACAO-PROGRESSAO.md) | como funcionam settlement, hold, payout manual, reviews, níveis, ranking e planos? |
| [14 — Marketing pós-venda](14-MARKETING-POS-VENDA-OMNICANAL.md) | como carrinho, lifecycle, consentimento, canais, cupom e afiliado se conectam? |
| [15 — Studio 2D/3D](15-STUDIO-CATALOGO-3D-2D.md) | como a biblioteca compartilhada gera anúncio ou submissão sem duplicar catálogo? |
| [16 — SEO/conteúdo/atribuição](16-SEO-CONTEUDO-ATRIBUICAO.md) | como URLs, robots, sitemaps, schema, mercados e analytics serão governados? |
| [17 — Nomenclatura](17-NOMENCLATURA-HIERARQUIA-FUNCIONAL.md) | qual é o único nome de cada objeto, tela, ação, estado e camada? |
| [18 — Brand kit](18-BRAND-KIT-DESIGN-SYSTEM.md) | quais tokens, voz, componentes e regras visuais formam a Midas Foundry? |
| [19 — Radar open source](19-RADAR-OPEN-SOURCE-E-DECISOES-BUILD-VS-BUY.md) | o que construir, avaliar ou rejeitar antes de escolher dependências? |
| [20 — Benchmark de concorrentes/layouts](20-BENCHMARK-COMPETIDORES-E-LAYOUTS.md) | o que foi observado, com qual evidência, limite e oportunidade clean-room? |
| [21 — Sistema de layouts/templates](21-SISTEMA-DE-LAYOUTS-E-TEMPLATES-UI.md) | como 9 shells e 41 templates cobrem as 95 telas sem layouts artesanais? |
| [SDD — Requirements](../specs/midas-marketplace/requirements.md) | quais critérios EARS consolidam o comportamento implementável? |
| [SDD — Design](../specs/midas-marketplace/design.md) | como arquitetura, dados, segurança e UI sustentam os requisitos? |
| [SDD — Tasks](../specs/midas-marketplace/tasks.md) | em qual ordem executar e qual evidência encerra cada gate? |
| [Atlas visual de layouts](../reports/MIDAS-ATLAS-DE-LAYOUTS.html) | como os 9 shells, 41 templates e 95 telas se encaixam visualmente? |

## 10. Restrições externas, sem travar o motor do produto

Uma operação comercial com propriedade intelectual ou economia de terceiros exige autorização, fonte licenciada de catálogo/assets/preço, mecanismo permitido de transferência e PSP contratado. Para Standoff 2, consultar as [regras oficiais](https://help.standoff2.com/pt-BR/articles/8446575-regras-do-jogo), a [EULA](https://standoff2.com/en/eula.html), o [Code of Conduct](https://help.standoff2.com/en/articles/15253027-code-of-conduct), a [central oficial do Marketplace](https://help.standoff2.com/en/collections/3850927-marketplace) e a [licença oficial de assets](https://standoff2.com/assets/AXLEBOLT_Assets_license_EN.pages).

Essas condições delimitam os dados e integrações de produção. O motor genérico, a UX, a arquitetura multi-tenant e o pipeline com ativos próprios ou autorizados podem ser construídos de forma clean-room.

## 11. Métrica que guia o produto

**North Star recomendada:** quantidade e valor de pedidos que chegaram a saldo disponível após entrega, sem disputa procedente, reembolso ou chargeback.

Métricas auxiliares devem explicar o caminho: ativação do vendedor, anúncio aprovado, conversão, pagamento reconciliado, entrega no prazo, tempo em hold, saque concluído, recorrência e qualidade do suporte. Nenhum KPI deve esconder estado financeiro ou incentivar fricção artificial.

## 12. Direção final

O diferencial do Midas não é apenas exibir itens. É tornar legível e verificável o ciclo inteiro: quem opera o tenant, o que foi anunciado, como o pagamento foi confirmado, o que foi entregue, por que o saldo está retido, quando pode ser sacado e quais evidências sustentam cada decisão.

**A interface orienta a ação. Os contratos e estados sustentam a confiança.**
