# Direção de arte — Midas Foundry

Versão 3.0 · Documento pré-código · 22 de agosto de 2026

## 1. Conceito

**Midas Foundry** é a direção de arte proposta: uma oficina noturna de comércio digital. O ouro não é luxo ornamental; é o sinal de valor validado. O carvão representa a infraestrutura e a cautela. A interface deve parecer precisa sob pressão, não um cassino de skins.

O brand kit, tokens, voz e board visual ficam em [18 — Brand kit e design system](18-BRAND-KIT-DESIGN-SYSTEM.md). A pesquisa clean-room das superfícies está no [benchmark de concorrentes e layouts](20-BENCHMARK-COMPETIDORES-E-LAYOUTS.md); a composição executável das 95 telas em 9 shells e 41 templates reutilizáveis está no [sistema de layouts e templates](21-SISTEMA-DE-LAYOUTS-E-TEMPLATES-UI.md). Esses artefatos especializam, sem substituir, este direcionamento.

Vibe: **forja noturna, ouro, precisão, confiança**.

### DNA transportado em clean room

Da Nesha Store, transportamos apenas princípios:

- densidade de catálogo;
- leitura rápida de preço e disponibilidade;
- categorias visíveis e filtros persistentes;
- produto como centro visual;
- contexto de pagamento/entrega perto do CTA;
- confiança como parte da jornada.

Do painel de preços observado, transportamos:

- leitura temporal;
- alternância de período;
- preço atual, mínimo, máximo e média;
- separação entre compra e venda quando a fonte suportar;
- tabela comparativa com variação, spread e volatilidade.

Não transportamos marcas, paletas exatas, layouts pixel a pixel, ilustrações, imagens, textos ou código.

## 2. Princípios visuais

1. **Valor tem uma cor; estado tem uma forma.** Ouro identifica ação/valor. Erro, sucesso e risco usam ícone + texto + cor.
2. **Densidade sem aperto.** Cards compactos, mas controles com alvo mínimo de 44 px e respiro consistente.
3. **Gold não é real.** Preço em gold e preço fiduciário nunca compartilham o mesmo tratamento.
4. **Origem e frescor são visíveis.** Toda cotação mostra fonte, horário e estado `atual`, `desatualizado` ou `indisponível`.
5. **Persuasão honesta.** Sem cronômetro, estoque baixo, desconto ou popularidade inventados.
6. **O produto domina; o cromado recua.** Imagem, nome, craft, preço e segurança vencem a decoração.
7. **Midas e P2P são parentes, não gêmeos.** Mesmo sistema, identificação de canal inequívoca.

## 3. Sistema cromático proposto

Tokens canônicos em OKLCH:

```css
:root {
  --color-paper:       oklch(13% 0.012 75);
  --color-paper-2:     oklch(17% 0.014 75);
  --color-paper-3:     oklch(22% 0.016 75);
  --color-ink:         oklch(94% 0.012 85);
  --color-ink-2:       oklch(78% 0.012 80);
  --color-muted:       oklch(66% 0.012 75);
  --color-rule:        oklch(31% 0.016 75);
  --color-rule-2:      oklch(26% 0.014 75);
  --color-accent:      oklch(78% 0.160 80);
  --color-accent-ink:  oklch(18% 0.018 75);
  --color-focus:       oklch(84% 0.190 80);
  --color-danger:      oklch(65% 0.190 28);
  --color-success:     oklch(72% 0.130 150);
  --color-info:        oklch(74% 0.120 225);
}
```

- Ouro ocupa no máximo ~3–5% de uma tela: CTA, foco, valor-chave, estado ativo.
- Verde, vermelho e ciano são **semânticos**, não decorativos.
- Sem preto ou branco puros; superfícies são levemente aquecidas.
- Gráficos usam ouro para a série principal, ciano apenas para comparação autorizada e padrões/ícones para não depender de cor.

## 4. Tipografia

### Família

- **Display:** Big Shoulders Display, 700/800 — industrial, condensada, usada em títulos curtos.
- **Corpo/UI:** IBM Plex Sans, 400/700 — leitura, formulários, tabelas e operação.
- **Dados/mono:** IBM Plex Mono, 400/600 — IDs, preços, timestamps e código técnico.

Todas são gratuitas. Nenhum título usa itálico. Máximo de três famílias.

### Escala

Razão de 1,25, corpo de 16 px, medida de leitura entre 45–75 ch. Dados numéricos usam `tabular-nums`. Títulos longos caem um nível antes de quebrar a composição. Rótulos podem usar caixa alta curta com tracking controlado; parágrafos nunca.

## 5. Estrutura das superfícies

### Navegação pública

Desktop: cabeçalho compacto com busca como ação dominante; acesso direto a `Market`, `Compre do Midas`, `Vender`, `Mensagens` e `Conta`.

Mobile: barra inferior para Início, Market, Midas, Mensagens e Conta; “Vender” aparece como ação contextual na Conta e no cabeçalho do Market.

### Início

- busca acima da dobra;
- entrada separada para P2P e Midas;
- categorias por arma/tipo;
- recomendações com explicação;
- vistos recentemente;
- educação curta: aprovação, pagamento, entrega e hold.

Não usar carrossel automático. Se houver faixa editorial, avanço é manual e pausável.

### Catálogo e cards

O card contém apenas o que decide clique:

- imagem licenciada;
- nome e variante;
- canal `P2P` ou `Midas`;
- preço da oferta;
- referência em gold com `asOf`;
- badge de craft e contagem de adesivos;
- reputação/estado do vendedor quando aplicável;
- disponibilidade real.

Sem card dentro de card, borda lateral colorida ou sombra brilhante. Elevação em dark mode é feita por aumento de luminosidade.

### Página do anúncio

Desktop em duas zonas assimétricas:

- esquerda maior: imagem, craft posicionado e detalhes;
- direita: preço, vendedor, estado, proposta e compra;
- abaixo: gráfico, componentes em gold, condições de entrega, chat e ofertas semelhantes.

No mobile, preço e CTA formam uma barra inferior fixa que não encobre conteúdo; o gráfico vira área rolável por período sem tabela de dez colunas.

### Wizard de anúncio

Fluxo vertical por etapas:

1. Tipo do produto.
2. Item-base do catálogo.
3. Craft (`não` ou `sim`), exibido somente quando o item-base tiver `craftEligible=true` na versão autorizada do catálogo.
4. Quatro posições de adesivo, somente se `sim`.
5. Preço, descrição e entrega.
6. Prévia e envio para revisão.

Ao trocar craft para `não`, explicar que os slots serão limpos. Salvar rascunho. Erros apontam campo, motivo e correção.

### Minha conta

Desktop usa navegação lateral compacta; mobile usa lista de destinos e cabeçalho contextual, sem reproduzir formulários de identidade, segurança ou privacidade. A visão geral mostra apenas blocos autorizados e alimentados por fontes reais:

- compras e vendas que exigem ação;
- Saldo de vendas disponível e em retenção no PSP;
- saques em processamento;
- tickets, solicitações de reembolso e disputas em andamento;
- atalhos para segurança, privacidade e preferências existentes.

Quando houver mais de um `SellerAccount`, o contexto selecionado fica inequívoco e cada opção depende da `SellerMembership`. Restrição de uma ação mostra motivo e recuperação sem esconder histórico, saldo devido ou casos que a pessoa ainda pode consultar.

### Minhas compras e detalhe

A listagem combina busca, filtros persistentes, ordenação e paginação por cursor. Em desktop pode usar tabela; em mobile vira lista de cards equivalentes. Cada linha/card prioriza pedido, item, vendedor permitido, data, valor fiduciário e estado com ícone + texto.

O detalhe organiza:

1. resumo do pedido e snapshot da oferta;
2. pagamento e taxas em moeda fiduciária;
3. Referência em gold separada, com fonte e `asOf`, quando disponível;
4. timeline derivada de pedido, pagamento, entrega, reembolso e disputa;
5. ações contextuais permitidas;
6. tickets, `RefundRequest`, disputa e recurso relacionados.

Eventos ausentes não ganham etapas decorativas. Endereço, preparação e envio só aparecem quando uma modalidade autorizada realmente os produzir.

### Painel de vendas

O cabeçalho fixa período e `SellerAccount`; abaixo, indicadores de volume, valor bruto/líquido, pedidos que exigem ação, cancelamentos, reembolsos e disputas usam dados reais e informam o horário de atualização quando houver consistência eventual. Valores financeiros exibem moeda fiduciária e `tabular-nums`; gold nunca representa faturamento, saldo ou saque.

Pedidos que exigem ação precedem gráficos. Vendas recentes usam a mesma gramática responsiva de Minhas compras. O resumo financeiro direciona a Saldo de vendas e saques, sem somar pedidos no cliente nem sugerir que a Midas custodia recursos.

### Saldo de vendas e saques

A superfície apresenta em blocos separados saldo pendente/protegido, em retenção, disponível, congelado/sob análise e em processamento de saque. Cada quantia traz moeda; a retenção abre composição por lote com início, previsão de liberação e motivo permitido. Um prazo operacional pode ter contagem complementar, nunca substituir data, estado e explicação.

“Solicitar saque” abre confirmação com saldo atual, valor, tarifa, líquido, destino mascarado e step-up quando exigido. Ausência de saldo elegível desabilita ou remove a ação com explicação, mas a validação final permanece no backend. O histórico diferencia processamento, pagamento, falha, retry e retorno sem criar rótulos incompatíveis com `PayoutRequest`.

### Suporte e solicitação de reembolso

A Central de suporte reutiliza a conversa do ticketing e mostra busca/filtros, estado, SLA, última atualização e objeto relacionado. Abrir suporte de um pedido, saque ou disputa preenche o contexto conhecido; PII não é copiada para o texto livre.

“Solicitar reembolso” parte do detalhe de uma compra elegível e apresenta modalidade integral/parcial, valor fiduciário, motivo, descrição, evidências, resumo e confirmação. Depois do envio, protocolo e estado da `RefundRequest` ficam visíveis; a interface não representa pedido, ticket, disputa, refund do PSP ou lançamento do ledger como se fossem o mesmo objeto.

### Carrinho e checkout multivendedor

O carrinho usa uma coluna principal de itens e um resumo sticky apenas em desktop largo. As linhas são agrupadas por `SellerAccount`, moeda e modalidade; cada grupo mostra subtotal, condição, cupom e resultado de checkout próprios. No mobile, resumo fica depois dos grupos e o CTA fixo informa quantos pedidos/pagamentos serão criados.

- preço/estoque alterado aparece como diferença explícita antes da confirmação;
- complemento/upsell vem depois do item principal, com razão e botão `Adicionar`; checkbox não vem pré-marcado;
- cupom mostra reservado, aplicado, inválido ou estornado sem alterar o total no browser;
- falha parcial apresenta o status de cada `CheckoutGroup`, sem banner genérico de sucesso;
- nenhum countdown/“última chance” aparece sem fato e prazo operacional verificáveis.

### Avaliações, nível, conquistas e ranking

`OrderReview` usa escala 0–5 com rótulos textuais, teclado e confirmação clara de que zero é nota válida. A avaliação do outro lado permanece oculta até a regra de revelação; moderação/recurso aparecem como timeline, não como média editável.

Perfil/conquistas exibem nível atual, faixa seguinte, valor elegível, policy version e `asOf`. Insígnias sem arte aprovada usam slot vazio, nunca placeholder premiado. O ranking público mostra temporada, moeda, fórmula, desempate, posição, pontos e top 3; podium visual não oculta tabela completa e não usa fogos/confete.

### Clientes, pós-venda e campanhas

O painel do seller prioriza segmentos/coortes e razões de elegibilidade, não uma agenda de contatos. Cada linha mostra estado de relacionamento, última compra, lifecycle, janela de recompra, consentimento agregado e próxima ação permitida; telefone/e-mail/WhatsApp bruto nunca aparece.

O composer de campanha segue quatro zonas:

1. objetivo e audiência elegível;
2. canal/finalidade/capability e estimativa de supressão;
3. `MessageTemplate` + `CreativeAsset` com preview por canal;
4. frequência, quiet hours, revisão e ativação versionada.

Resultados separam queued, accepted, delivered, read, click, settled, refunded e opt-out. A tela nunca usa “converteu” para leitura/click nem esconde complaint/suppression.

### Studio 2D/3D

O Studio combina biblioteca pesquisável à esquerda, preview 2D/3D central e painel contextual à direita em desktop; no mobile vira sequência `buscar → inspecionar → usar/contribuir`. Um item mostra taxonomia, lifecycle, mídia aprovada, versão, proveniência pública e capacidade de criar anúncio.

- `Usar no anúncio` inicia a mesma `ListingRevision` e deixa visível quais campos vieram do catálogo;
- `Propor item ou mídia` abre `CatalogSubmission`, sem publicar diretamente;
- 2D é primeira classe; botão 3D só existe com `Model3DArtifact` real aprovado;
- revisão admin usa comparação de fontes, relatório/lineage e decisão separados do botão publicar;
- nenhum card da biblioteca monta canvas próprio; a inspeção 3D mantém um único canvas.

### Operação financeira e governança Master

As filas de pagamento/saque usam layout master-detail: filtros/SLAs à esquerda, detalhe/evidência no centro e ações autorizadas em rail fixo à direita. `PaymentResolutionCase` e `PayoutRequest` nunca compartilham botão genérico. Referência, valor/moeda, destino mascarado, maker/checker, prova, versões e divergências ficam acima da ação.

Master Progressão/Planos/Marketing usa editor draft → impacto → revisão → aprovação → agendamento/publicação. Versão ativa e futura nunca são editadas in place; comparação de diff e rollback governado precedem publicação.

### Admin/Master

Workbench denso e sóbrio, com navegação lateral por domínio. Tabelas viram listas orientadas a ação no mobile. No detalhe do ticket, o contexto 360° agrupa pedido, pagamento/entrega, financeiro, suporte, reembolso e disputa em seções progressivas, exibidas por menor privilégio; não existe painel irrestrito nem edição de saldo. Toda decisão sensível exibe escopo, objeto, efeito e exigência de step-up antes da confirmação.

### Growth multi-tenant

As nove telas Growth compartilham um shell de análise com período, timezone, moeda, canal, comparação, `asOf` e freshness sempre visíveis. A hierarquia é apresentada como breadcrumb funcional: **Plataforma → SellerAccount → SellerMembership/User → objeto canônico**.

- cards mostram fórmula/definição, valor, numerador, denominador, cobertura e fonte; não apenas um número grande;
- funil mantém unidade, elegíveis, conversão, abandono e duração no mesmo contexto;
- tabela de tenants e membros prioriza estágio, situação, bloqueio, última atividade e próxima ação derivada;
- drill-down usa drawer ou painel lateral em desktop e rota/painel empilhado no mobile, preservando filtros no URL;
- `STALE`, `PARTIAL`, `RECOMPUTING`, `NOT_INSTRUMENTED` e `UNKNOWN` são estados de primeira classe;
- nenhuma animação celebra GMV, saldo, queda de churn ou “oportunidade”; Growth explica e aponta ao domínio que possui a ação.

### Viewer 3D e revisão de catálogo

O detalhe do item/anúncio mantém o poster 2D como primeira pintura. O botão **Ver em 3D** não abre um segundo viewer embutido: ele navega para `SCR-PUB-013`, em `/itens/:slug/3d`. A rota é uma sala de inspeção individual, com um item/arma e um único canvas ativo; galeria 2D, craft, preço, vendedor e CTA continuam independentes de WebGL. O histórico guarda a origem para que **Voltar** restaure a tela, os filtros e a posição de onde o item foi selecionado; acesso direto continua funcional pelo slug.

- desktop: o modelo ocupa a zona principal da tela individual; controles curtos ficam numa barra DOM fora do canvas;
- mobile: o canvas respeita altura segura e gestos de página; rotação exige interação explícita;
- abertura premium: poster→canvas e um assentamento curto de câmera/modelo duram 650–900 ms, executam uma vez por montagem do artefato e param na pose neutra;
- qualquer pointer, toque, roda, tecla ou comando de vista interrompe a abertura imediatamente e entrega o modelo ao usuário; `prefers-reduced-motion` salta direto à pose final;
- depois da abertura, os controles são girar, zoom, vistas canônicas, resetar câmera, tela cheia, voltar à imagem e ajuda de teclado;
- não há auto-rotação contínua, câmera autônoma após a entrada, reflexo ou luz que esconda defeitos do modelo;
- selecionar outro slug ou sair da rota desmonta geometria, materiais, texturas, observers, listeners e RAF antes de montar o próximo artefato;
- React Bits anima somente o shell DOM/poster; Three.js/R3F é o único dono da câmera, do modelo e da abertura dentro do canvas;
- badge visível distingue `Modelo aprovado`, `Prévia 3D` e `Imagem 2D`; single-view draft nunca aparece como fiel/exato;
- revisão staff usa comparação lado a lado entre fontes, renders fixos e viewer, além de relatório técnico, lineage e decisão com motivo.

## 6. Componentes que constroem confiança

- **Price provenance:** valor + fonte + `observedAt` + frescor.
- **Seller capsule:** nome público, reputação verificável, histórico e status.
- **Approval trace:** data, estado e motivo de moderação sem expor staff.
- **Craft rail:** quatro posições fixas, sticker, preço gold e vazio explícito.
- **Delivery timeline:** pago → sala aberta → vendedor confirmou → comprador confirmou → hold → saldo disponível no fluxo do PSP.
- **Hold clock:** data prevista, pausas e motivo; nunca apenas um contador.
- **Capability card:** valor/quantidade, estado textual, fonte e destino; o servidor decide se o card e sua ação são permitidos.
- **Financial breakdown:** moeda, bruto, tarifa, líquido e estado reconciliado; nunca deriva saldo somando cards de pedido.
- **Related cases rail:** IDs e estados de ticket, `RefundRequest`, disputa e recurso, sem fundir históricos.
- **Refund trace:** protocolo, valor solicitado/aprovado, etapa da solicitação e resultado financeiro como informações distintas.
- **Staff context section:** bloco progressivo com finalidade, campos mascarados e ações condicionadas a grant.
- **Moderation notice:** mensagem bloqueada, regra, strike e via de contestação.
- **Secure reveal:** step-up, aviso `no-store`, revelação auditada e expiração.
- **Feed stale state:** último valor rotulado; ausência nunca vira zero.
- **Price table:** toda série gráfica possui alternativa tabular com data/hora, valor, mínimo, máximo, média, origem e frescor; leitura não depende de cor, hover ou visão.
- **Metric definition:** fórmula, unidade, população, numerador, denominador, versão, fonte e freshness acessíveis no Growth.
- **Tenant scope switcher:** `SellerAccount` atual, membership/capability e escopo inequívocos; trocar tenant invalida query/cache anteriores.
- **3D inspection handoff:** poster/galeria oferecem o link para `/itens/:slug/3d`; na tela individual, o modelo aprovado e o fallback 2D compartilham o mesmo landmark, e falha no canvas devolve foco ao controle.
- **Consent gate:** canal/finalidade/remetente, opt-in, suppression, frequência e motivo de bloqueio antes do composer.
- **Evidence rail:** hash/referência privada, scan, executor, instante e referência em decisões de pagamento/payout/Studio, sem preview público de PII.
- **Policy diff:** versão vigente/futura, campos alterados, impacto e approvals para nível, plano, campanha, market e crawl.

## 7. Conteúdo e microcopy

### Vocabulário canônico

- `Entrar`, não alternar com “Login”.
- `Criar anúncio`, não “Cadastrar produto”.
- `Enviar para revisão`, não “Submit”.
- `Preço da oferta` e `Referência em gold`.
- `Saldo de vendas em retenção no PSP`, não “carteira” ou “dinheiro preso”.
- `Painel de vendas`, `Saldo de vendas`, `Solicitar saque` e `Histórico de saques`.
- `Solicitação de reembolso` para o pedido do comprador; `Reembolso processado` somente para o resultado confirmado do fluxo financeiro.
- Valores de venda, saldo, retenção, saque, tarifa e reembolso sempre mostram moeda fiduciária; `gold` nunca é chamado de saldo.
- `Abrir disputa`, `Confirmar entrega`, `Confirmar recebimento`.
- `Compre do Midas` sempre por extenso em títulos.
- `Avaliação do pedido`, `Reputação`, `Nível`, `Insígnia`, `Recompensa` e `Ranking mensal`; não alternar com score genérico.
- `Carrinho`, `Grupo de checkout` e `Pedido` são etapas/objetos distintos.
- `Contato protegido pela plataforma`, não “lista de WhatsApp”.
- `Campanha`, `Jornada`, `Disparo` e `Tentativa de entrega`; leitura não é compra.
- `Studio`, `Biblioteca do catálogo` e `Submissão`; não “produto do seller” para item canônico.

### Erro de PII

Primeira tentativa:

> Esta mensagem não foi enviada porque contém informação de contato. Negocie aqui para manter a proteção da compra. Esta é sua primeira ocorrência.

Segunda:

> Esta mensagem não foi enviada. Uma nova tentativa de compartilhar contato restringirá sua conta e abrirá revisão da staff.

Terceira:

> Sua conta foi restringida para revisão. Você ainda pode acessar esta tela e enviar um recurso à staff.

### Estados vazios

Todo vazio contém: o que está vazio, por que importa e uma ação. Exemplo: “Nenhum anúncio enviado. Seus rascunhos e revisões aparecerão aqui. Criar anúncio.”

## 8. Motion e interação

Movimento só comunica mudança:

- 120 ms para press/toggle;
- 180–220 ms para hover e menu;
- 250–300 ms para modal e troca de conteúdo;
- 650–900 ms exclusivamente para a abertura finita do modelo em `SCR-PUB-013`, controlada por Three.js/R3F e interrompível por input;
- sem `transition-all`, bounce, parallax ou fade em cada seção;
- foco aparece instantaneamente;
- resultados de busca usam debounce e anunciam contagem;
- sucesso visível é silencioso; erro oferece recuperação;
- `prefers-reduced-motion` reduz movimento espacial a crossfade de até 150 ms.

### React Bits com função definida

[React Bits](https://reactbits.dev/) entra como biblioteca de expressão visual encapsulada, não como design system nem como lógica de estado. O plano de adoção, wrappers, registro de fonte e testes está em `10-PLANO-REACT-BITS.md`.

- `DarkVeil`: somente hero público, desligado em mobile/reduced motion e nunca junto do viewer 3D;
- `BlurText`: título curto de entrada, com texto final presente semanticamente desde o início;
- `AnimatedContent`/`FadeContent`: entrada única de blocos não críticos e do shell DOM de `SCR-PUB-013`, sem tocar câmera/modelo ou reanimar a cada refetch;
- `SpotlightCard`: descoberta e, no máximo, destaque analítico não financeiro com fallback completo;
- `AnimatedList`: inserção/remoção real em atividade/notificações, sem reordenação enganosa;
- `Stepper`: onboarding, anúncio, reembolso e job 3D, espelhando etapas canônicas do servidor;
- `CountUp`: somente contagens agregadas não financeiras, valor final exposto ao leitor de tela.

Checkout, saldo, saque, refund, IAM, disputa, staff e formulários críticos não recebem motion decorativo. Cursor customizado, scroll hijack, glitch, magnet, click spark, parallax e fundo WebGL concorrente ficam fora do produto.

## 9. Acessibilidade e responsividade

- Meta WCAG 2.2 AA.
- Contraste mínimo 4,5:1 para texto e 3:1 para componentes/ícones grandes.
- Foco visível em todos os elementos interativos.
- Alvos mínimos de 44 × 44 px.
- Labels visíveis; placeholder nunca substitui label.
- Estado não depende apenas de cor.
- Gráfico sempre tem resumo textual, tabela navegável por teclado e valores expostos ao leitor de tela.
- Atualizações assíncronas de ticket, saque, reembolso e read model anunciam mudança relevante por região viva sem roubar foco.
- Tabelas de compras, vendas, retenções, saques e tickets mantêm cabeçalhos associados; no mobile, cards preservam os mesmos rótulos e ordem semântica.
- Valores usam formatação local, código/símbolo de moeda e leitura inequívoca de bruto, tarifa e líquido.
- 320, 375, 414, 768, 1280 e 1440 px são viewports obrigatórios de revisão.
- Sem rolagem horizontal; `overflow-x: clip` no documento.
- CTAs e links de navegação não quebram em duas linhas.
- Diálogos nativos, popovers acessíveis e navegação completa por teclado.
- Viewer 3D possui instrução textual de controle, reset por teclado, foco fora do canvas, poster/galeria equivalentes e fallback de perda de contexto; o primeiro input interrompe a abertura sem capturar foco.
- Em `prefers-reduced-motion`, React Bits e a abertura Three.js apresentam o estado final sem atraso; a progressão de job/checkout continua textual e não depende de animação.

## 10. Regras contra design manipulativo

Bloqueado:

- contagem regressiva sem prazo operacional real;
- “última unidade” sem estoque real;
- preço riscado que não foi praticado;
- “mais vendido” sem amostra e período;
- prova social fabricada;
- default que adiciona seguro/taxa opcional;
- botão de cancelamento escondido;
- recomendações pagas sem rótulo;
- urgência visual em disputa, saque ou segurança.

## 11. Stamp do sistema

```text
Hallmark · macroestrutura: Long Document / workbench transacional
tema: custom · vibe: “forja noturna, ouro, precisão, confiança”
display: Big Shoulders Display · corpo: IBM Plex Sans · dados: IBM Plex Mono
eixos: dark / display-condensed-bold / chromatic-amber
DNA estudado: Nesha + painel de preços, reconstruído em clean room
```

## 12. Encerramento da versão 3.0

As superfícies autenticadas seguem a mesma Midas Foundry e apenas projetam identidade, pedido, ledger/PSP, payout, reputação, progressão, marketing, Studio, ticketing, disputa, IAM e auditoria existentes. `RefundRequest`, Growth, `Campaign`, `CatalogSubmission` e `Model3DJob` possuem linguagem e trilha próprias sem duplicar os domínios canônicos. React Bits dá assinatura ao shell das áreas adequadas; Three.js serve ao único canvas da inspeção individual em `SCR-PUB-013`; nenhum deles substitui estado real, consentimento, acessibilidade ou fallback.
