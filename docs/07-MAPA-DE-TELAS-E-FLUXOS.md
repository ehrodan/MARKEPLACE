# Mapa de telas e fluxos — Midas Marketplace

> **Versão:** 2.0 · **Data:** 22 de agosto de 2026 · **Escopo:** contrato de navegação e comportamento para implementação.

Este documento transforma o PRD em um inventário roteável verificável. Ele define **exatamente 95 contratos de tela (`SCR-*`)**, suas fontes, guardas, ações e estados. Os 9 shells e 41 templates reutilizáveis que compõem essas telas pertencem ao [sistema de layouts e templates](21-SISTEMA-DE-LAYOUTS-E-TEMPLATES-UI.md). Este mapa não substitui OpenAPI, catálogo de eventos, modelo de permissões nem máquinas de estado; quando esses contratos ainda não existem, a tela fica identificada como proposta ou bloqueada.

## 1. Como ler este contrato

### 1.1 Status de definição

| Status | Significado | Consequência para implementação |
|---|---|---|
| **DOCUMENTADO** | A rota ou a capacidade está explícita no PRD/arquitetura atual. | Pode orientar protótipo e contrato, mas não significa código existente nem go-live autorizado. |
| **PROPOSTO** | A superfície é necessária para fechar uma jornada já especificada, mas rota, API ou comportamento ainda precisa de aceite. | Não congelar URL pública nem desenvolver integração definitiva sem decisão de produto/arquitetura. |
| **BLOQUEADO** | Falta uma decisão semântica ou fornecedor técnico indispensável para implementar o comportamento real. | A rota não recebe função simulada: permanece indisponível até existir contrato executável. |

O status mede a maturidade **da tela**, não a existência de código. Dependências externas e gates de operação ficam centralizados no backlog; não alteram a hierarquia funcional deste mapa.

### 1.2 Convenções

- `:id`, `:slug` e equivalentes são parâmetros obrigatórios.
- Colchetes representam seleção opcional dentro do **mesmo workbench master-detail**, por exemplo `/admin/suporte[/:ticketId]`; lista e detalhe compartilham layout, autorização e componente de rota.
- Query strings preservam filtros e drill-down: `?from=&to=&status=&cursor=&selected=`.
- Redirecionamentos como `/termos` → `/politicas/termos` não contam como outro template.
- Wizard, aba, drawer, modal e etapa de formulário não contam como tela roteável separada.
- `SCR-PUB-013` é um único template reutilizável, mas cada arma/item publicado possui sua própria instância endereçável por `slug`; isso entrega “uma tela por peça” sem copiar componente, rota ou estado de domínio.
- Toda listagem usa cursor opaco; `page/pageSize` não é contrato alternativo.
- Toda fonte derivada exibe `asOf`, freshness e, quando aplicável, moeda/timezone.
- A UI nunca calcula saldo, elegibilidade, autorização, estágio financeiro ou permissão definitiva; o servidor devolve o fato ou a capacidade autorizada.

### 1.3 Fontes oficiais já levantadas

As decisões de tela devem respeitar as fontes oficiais já registradas no repositório:

- [Regras oficiais do Standoff 2](https://help.standoff2.com/pt-BR/articles/8446575-regras-do-jogo), [EULA](https://standoff2.com/en/eula.html) e [Code of Conduct](https://help.standoff2.com/en/articles/15253027-code-of-conduct): mantêm bloqueadas as transações Standoff 2 sem autorização expressa.
- [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm) e [Guia de Legítimo Interesse da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_hipoteses_legais_tratamento_de_dados_pessoais_legitimo_interesse): condicionam perfil, Growth, direitos do titular e minimização.
- [W3C WebAuthn](https://www.w3.org/TR/webauthn-3/): referência para passkeys e cerimônias de autenticação.
- [OWASP API Security](https://owasp.org/www-project-api-security/) e [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/): referência para autorização por objeto/função e controles de aplicação.
- [PCI Security Standards Council](https://www.pcisecuritystandards.org/): referência para o escopo do checkout hospedado/tokenizado; PAN/CVV não entram no Midas.

### 1.4 Política de motion e uso futuro de React Bits

[React Bits](https://reactbits.dev) é uma referência futura para superfícies de descoberta e feedback visual. **Não é dependência instalada ou escolhida**: o repositório não possui runtime frontend. Antes de adotar qualquer componente, será obrigatório validar licença, bundle, SSR/hydration, teclado, foco, contraste, `prefers-reduced-motion`, desempenho móvel e manutenção.

| Perfil | Regra | Superfícies |
|---|---|---|
| `M2 — expressivo permitido` | Motion decorativo discreto pode apoiar descoberta, entrada de seção, hover/focus e transição entre mídia; nunca cria urgência, escassez, preço animado ou CTA móvel. Em `SCR-PUB-013`, a entrada 3D é finita, interrompível e termina antes da manipulação livre. | `SCR-PUB-001..007` e `SCR-PUB-013`. |
| `M1 — somente funcional` | Apenas feedback de seleção, expansão, skeleton, progresso determinístico e transição curta que preserve foco/layout. | `SCR-PUB-008..015`, `SCR-ACC-005/009/014..016`, `SCR-BUY-001/002`, `SCR-SEL-002/005/008/017`. |
| `M0 — decorativo proibido` | Sem parallax, partículas, texto embaralhado, números contando, scroll hijack, entrada coreografada ou animação de urgência. Só feedback de sistema indispensável, sem atrasar a ação. | `SCR-ACC-001..004/006..008/010..013`, `SCR-BUY-003..012`, `SCR-SEL-001/003/004/006/007/009..016`, **todo** `SCR-ADM-*`, `SCR-MST-*` e `SCR-GRW-*`. |

Regras inegociáveis:

- Checkout, saldo, refund, payout, IAM, formulários críticos e qualquer tela staff/Master/Growth usam `M0`.
- `prefers-reduced-motion: reduce` elimina motion não essencial também em `M1/M2`; conteúdo e ação permanecem equivalentes.
- Viewer 3D permite órbita/zoom por manipulação direta. A tela dedicada pode executar uma revelação inicial única de 650–900 ms, limitada a 15°, mas ela para na pose neutra, é interrompida pelo primeiro input e nunca vira auto-rotação ou artifício para esconder defeitos.
- React Bits, se aprovado, entra por componentes encapsulados do design system e apenas em `M1/M2`; nenhuma menção neste mapa autoriza instalação.

## 2. Árvore hierárquica

~~~text
Midas Marketplace — 95 contratos de tela
├── Público, descoberta, confiança, ajuda e políticas — 15
│   ├── Descoberta e inspeção 3D individual — SCR-PUB-001..007 + SCR-PUB-013
│   └── Ajuda, políticas, ranking e recompensas — SCR-PUB-008..012 + SCR-PUB-014..015
├── Identidade, conta e superfícies comuns — 16
│   ├── Entrada e garantia de idade — SCR-ACC-001..004
│   ├── Conta e segurança — SCR-ACC-005..008
│   └── Preferências, privacidade, comunicação e reputação — SCR-ACC-009..016
├── Comprador, pedido e suporte — 12
│   ├── Conversas, carrinho e checkout — SCR-BUY-001..003 + SCR-BUY-012
│   ├── Compras, entrega e disputa — SCR-BUY-004..007
│   └── Tickets e reembolsos — SCR-BUY-008..011
├── Vendedor — 17
│   ├── Onboarding, painel e equipe — SCR-SEL-001..003
│   ├── Anúncios e prova de posse — SCR-SEL-004..007
│   ├── Vendas, saldo e saques — SCR-SEL-008..014
│   └── Clientes, marketing e Studio — SCR-SEL-015..017
├── Administração e operações — 18
│   ├── Cockpit, anúncios, catálogo e vendedores — SCR-ADM-001..004
│   ├── Confiança, usuários, pedidos e disputas — SCR-ADM-005..008
│   ├── Suporte, reembolso, financeiro, pagamentos, saques, Midas e pipeline 3D — SCR-ADM-009..015
│   └── Avaliações, marketing e Studio — SCR-ADM-016..018
├── Master e governança — 8
│   ├── Cockpit, acessos, configuração, integrações e auditoria — SCR-MST-001..005
│   └── Progressão, planos e governança de marketing — SCR-MST-006..008
└── Growth — 9
    ├── Global e funil — SCR-GRW-001..002
    ├── Tenants e membros — SCR-GRW-003..006
    └── Coortes, interações e oportunidades — SCR-GRW-007..009
~~~

## 3. Inventário canônico — 95 contratos de tela

### 3.1 Público, descoberta, ajuda e políticas — 15

| SCR-ID | Status | Rota | Ator/guarda | Objetivo | Fonte de leitura | Ações autorizadas |
|---|---|---|---|---|---|---|
| SCR-PUB-001 | DOCUMENTADO | `/` | Público | Orientar entrada por busca, categoria, P2P ou Midas sem misturar canais. | `DiscoveryReadModel`: busca, categorias, recomendações consentidas e ofertas; `asOf`. | Buscar; abrir categoria; alternar P2P/Midas; abrir item/anúncio; desligar personalização. |
| SCR-PUB-002 | DOCUMENTADO | `/market` | Público | Explorar exclusivamente ofertas P2P publicadas. | `GET /v1/search` com canal P2P; projeções de anúncio, preço e vendedor. | Filtrar; ordenar; paginar por cursor; favoritar após login; abrir anúncio. |
| SCR-PUB-003 | DOCUMENTADO | `/midas` | Público; canal habilitado por capability | Exibir estoque próprio inequivocamente rotulado como “Vendido pelo Midas”. | `GET /v1/channels/midas/listings`; estoque/preço canônico do Midas. Se a fonte estiver indisponível, não publicar valor nem disponibilidade inventados. | Filtrar; comparar; abrir oferta; iniciar compra quando a capability transacional estiver ativa. |
| SCR-PUB-004 | DOCUMENTADO | `/buscar` | Público | Resolver uma consulta com filtros, ordenação, correção e recuperação. | `GET /v1/search?q=`; índice de busca e explicação de ranking. | Pesquisar; aplicar/remover filtros; ordenar; alternar canal; abrir resultado; limpar busca. |
| SCR-PUB-005 | DOCUMENTADO | `/itens/:slug` | Público | Mostrar item-base, histórico licenciado e ofertas disponíveis. | Catálogo canônico; `GET /v1/prices/items/{catalogItemId}` e `/candles`; ofertas, poster e `Model3DArtifact` ativo quando existir. | Trocar período; abrir tabela equivalente; comparar ofertas; abrir `SCR-PUB-013`; abrir anúncio; reportar dado ausente. |
| SCR-PUB-006 | DOCUMENTADO | `/anuncios/:listingId` | Público; ações relacionais exigem login | Permitir avaliar oferta, craft, vendedor, disponibilidade, proteção e preço antes de agir. | `GET /v1/listings/{id}`, component quotes, preço com `asOf`, resumo público do vendedor e `Model3DArtifact` publicado do item. | Abrir `SCR-PUB-013` preservando a origem; favoritar; conversar; propor; denunciar; iniciar checkout; voltar ao item-base. |
| SCR-PUB-007 | DOCUMENTADO | `/vendedores/:sellerAccountId` | Público | Exibir reputação e ofertas públicas do contexto comercial, sem revelar membros/PII. | Projeção pública de `SellerAccount`, reputação e anúncios; endpoint de leitura ainda a formalizar. | Filtrar anúncios; abrir anúncio; denunciar perfil/oferta. |
| SCR-PUB-008 | DOCUMENTADO | `/ajuda` | Público | Oferecer autosserviço por compra, venda, entrega, disputa, segurança e contato. | Conteúdo versionado da central de ajuda; taxonomia compartilhada com tickets. | Buscar artigo; navegar categoria; abrir artigo; iniciar ticket após login. |
| SCR-PUB-009 | PROPOSTO | `/ajuda/:articleSlug` | Público | Tornar artigo de ajuda endereçável, versionado e mensurável. | CMS/registro de políticas proposto, com versão, revisão e proprietário. | Navegar tópicos; copiar link; avaliar utilidade; abrir suporte contextual. |
| SCR-PUB-010 | DOCUMENTADO | `/seguranca` | Público | Explicar proteção, anti-PII, entrega, fraude, denúncia e recuperação. | Conteúdo de Trust & Safety aprovado e versionado. | Abrir orientação; denunciar; acessar segurança da conta; abrir ajuda. |
| SCR-PUB-011 | PROPOSTO | `/politicas` | Público | Indexar políticas vigentes e versões anteriores publicáveis. | `PolicyRegistry` proposto: título, versão, vigência, escopo e URL. | Abrir política; comparar vigência; baixar versão acessível. |
| SCR-PUB-012 | DOCUMENTADO | `/politicas/:policySlug` | Público | Exibir termos, privacidade, cookies, taxas, vendedor, disputa, conteúdo e acessibilidade. | Snapshot versionado de política. Aliases `/termos`, `/privacidade`, `/cookies` e `/taxas` redirecionam aqui. | Ler; buscar no texto; baixar; abrir versão anterior; ajustar cookies quando aplicável. |
| SCR-PUB-013 | DOCUMENTADO | `/itens/:slug/3d` | Público; item e artefato precisam estar publicados | Inspecionar uma arma/item por tela e rota própria, com uma entrada premium curta seguida de controle direto. | Item/variante canônicos + `GET /v1/catalog/items/{itemId}/model-3d-manifest`; exatamente um `Model3DArtifact` ativo, poster e fallback 2D; query opcional `variant`/`from` é allowlisted e não redefine o item. | Interromper ou pular a intro; rotacionar; zoom; escolher vista; reset; fullscreen; compartilhar deep link; voltar à origem preservada; selecionar outro item descartando o anterior. |
| SCR-PUB-014 | DOCUMENTADO | `/ranking` | Público; identidade mascarada conforme política | Exibir temporada corrente e encerradas com fórmula, moeda, posição, pontos, GMV elegível e premiação verificáveis. | `LeaderboardProjection`, `LeaderboardSeason`, `LeaderboardAward`, `asOf` e policy version. | Trocar temporada; abrir perfil público; entender fórmula/desempate; consultar top 3 e prêmio. |
| SCR-PUB-015 | DOCUMENTADO | `/recompensas` | Público | Explicar níveis 1–10, critérios, benefícios, insígnias e premiações sem prometer item ainda não definido. | `AccountLevelDefinition`, `BadgeDefinition`, `RewardDefinition` publicados e vigentes. | Comparar níveis; abrir regra; consultar insígnia/prêmio; navegar ao ranking ou cadastro. |

### 3.2 Identidade, conta e superfícies comuns — 16

| SCR-ID | Status | Rota | Ator/guarda | Objetivo | Fonte de leitura | Ações autorizadas |
|---|---|---|---|---|---|---|
| SCR-ACC-001 | DOCUMENTADO | `/entrar` | Anônimo | Autenticar sem revelar existência de conta ou reduzir segurança. | Auth/Identity; opções WebAuthn e política de sessão. | Entrar com passkey/senha; responder MFA; iniciar recuperação; ir ao cadastro. |
| SCR-ACC-002 | DOCUMENTADO | `/cadastro` | Anônimo | Criar identidade única e registrar aceites versionados. | `POST /v1/auth/register`; políticas vigentes; age gate. | Cadastrar; verificar contato; aceitar políticas; iniciar passkey; retomar cadastro. |
| SCR-ACC-003 | PROPOSTO | `/recuperar-acesso` | Anônimo; rate limit e resposta não enumerável | Recuperar conta com prova suficiente e revogação de sessões de risco. | Identity recovery; contrato de API ainda não formalizado. | Solicitar recuperação; validar desafio; redefinir fator; encerrar sessões. |
| SCR-ACC-004 | BLOQUEADO | `/verificar-idade` | Usuário autenticado quando exigido | Executar age assurance minimizando dados e oferecendo contestação. | `/v1/age-assurance/sessions` e `/status`; método/provedor e política etária pendentes. | Iniciar verificação; acompanhar; contestar; excluir captura temporária; voltar. |
| SCR-ACC-005 | DOCUMENTADO | `/conta` | Usuário autenticado | Entregar visão contextual sem duplicar fatos dos domínios. | `GET /v1/me/overview`; capacidades e alertas derivados. | Abrir compras, vendas, saldo, tickets, segurança e próxima ação autorizada. |
| SCR-ACC-006 | DOCUMENTADO | `/conta/seguranca` | Usuário; step-up para mutações sensíveis | Resumir fatores, risco, sessões e dispositivos. | Identity, WebAuthn, MFA e `DeviceTrust`. | Criar/remover passkey; configurar TOTP; gerar recovery codes; abrir sessões/dispositivos. |
| SCR-ACC-007 | PROPOSTO | `/conta/seguranca/sessoes` | Usuário; propriedade da sessão | Listar sessões ativas com sinais suficientes para revogação. | `GET /v1/me/sessions`. | Revogar uma sessão; revogar outras; atualizar; reportar atividade. |
| SCR-ACC-008 | PROPOSTO | `/conta/seguranca/dispositivos` | Usuário; step-up para trust | Gerenciar dispositivos confiáveis sem prometer identidade infalível. | `GET /v1/me/devices`; device challenge/enrollment. | Nomear; confiar após desafio; revogar; remover; revisar último uso. |
| SCR-ACC-009 | DOCUMENTADO | `/conta/favoritos` | Usuário | Reunir itens e ofertas salvos, distinguindo removido/indisponível. | Projeção de favoritos e anúncios; API de favoritos ainda a formalizar. | Abrir; remover; mover entre filtros; localizar oferta alternativa. |
| SCR-ACC-010 | DOCUMENTADO | `/conta/preferencias` | Usuário | Controlar personalização, cookies e comunicações por finalidade/canal. | `GET/PATCH /v1/me/privacy/preferences`; preferências de notificação. | Alterar consentimentos/preferências; desligar personalização; salvar; restaurar defaults protetivos. |
| SCR-ACC-011 | DOCUMENTADO | `/conta/privacidade` | Usuário; step-up para exportação/eliminação | Explicar tratamento e permitir exercer direitos sobre dados. | `GET /v1/me/privacy`; solicitações de direitos. | Solicitar acesso, correção, exportação, oposição ou eliminação; acompanhar protocolos. |
| SCR-ACC-012 | PROPOSTO | `/conta/privacidade/solicitacoes/:requestId` | Usuário; propriedade do protocolo | Acompanhar uma solicitação LGPD sem expor notas internas. | `GET /v1/me/data-rights-requests/{id}`. | Ver prazo/escopo; complementar identidade de forma segura; baixar resultado; recorrer ao canal indicado. |
| SCR-ACC-013 | DOCUMENTADO | `/conta/recurso` | Usuário com restrição recorrível | Explicar restrição, fundamento permitido, prazo e devido processo. | `/v1/me/account-restrictions` e recurso associado. | Criar recurso; anexar evidência segura; acompanhar; responder pedido de informação. |
| SCR-ACC-014 | PROPOSTO | `/conta/notificacoes` | Usuário | Centralizar notificações transacionais sem depender de e-mail/push. | `NotificationReadModel` proposto; preferências e outbox canônica. | Marcar como lida; filtrar; abrir contexto; ajustar canal; reenviar quando permitido. |
| SCR-ACC-015 | DOCUMENTADO | `/conta/avaliacoes` | Usuário; somente pedidos em que foi parte | Criar e acompanhar avaliações bilaterais sem revelar nota antes da regra de publicação nem misturar reputação de comprador/vendedor. | `OrderReview`, elegibilidade do `Order`, moderação e `ReputationProjection`. | Avaliar 0–5; editar dentro da janela; responder; denunciar; recorrer de moderação; abrir pedido. |
| SCR-ACC-016 | DOCUMENTADO | `/conta/conquistas` | Usuário; contexto pessoal e SellerAccount selecionado | Mostrar nível, progresso, insígnias e recompensas concedidas com regra e origem. | `AccountLevelAssignment`, contribuições, `BadgeAward`, `RewardAward` e freshness. | Trocar contexto; abrir regra/origem; organizar slots permitidos; acompanhar fulfillment; abrir recompensas públicas. |

### 3.3 Comprador, pedido e suporte — 12

| SCR-ID | Status | Rota | Ator/guarda | Objetivo | Fonte de leitura | Ações autorizadas |
|---|---|---|---|---|---|---|
| SCR-BUY-001 | DOCUMENTADO | `/mensagens` | Usuário participante | Listar conversas e propostas sem vazar participantes ou conteúdo. | Projeção de conversas; endpoints de listagem ainda a formalizar. | Filtrar; abrir conversa; iniciar a partir de anúncio; arquivar localmente. |
| SCR-BUY-002 | PROPOSTO | `/mensagens/:conversationId` | Participante da conversa; anti-BOLA | Conversar e negociar por proposta estruturada antes da compra. | Conversation/Message/Offer; leitura da thread ainda a formalizar. | Enviar mensagem; propor; contrapropor; aceitar; denunciar; abrir anúncio. PII bloqueada antes da entrega. |
| SCR-BUY-003 | DOCUMENTADO | `/checkout/:paymentId` | Comprador autenticado; age/risco/política/estoque elegíveis | Reservar uma unidade e concluir pagamento via PSP sem expor dados de cartão ao Midas. | Order, Reservation, Payment, policy snapshot e sessão PSP. | Revisar; aceitar política; criar/retomar sessão PSP; cancelar quando permitido; atualizar status. |
| SCR-BUY-004 | DOCUMENTADO | `/conta/compras` | Comprador; somente próprios pedidos | Listar compras com filtros, status e próxima ação. | `GET /v1/me/purchases?cursor=`. | Filtrar; pesquisar; abrir pedido; retomar pagamento; abrir suporte. |
| SCR-BUY-005 | PROPOSTO | `/conta/compras/:orderId` | Comprador do pedido | Consolidar resumo, timeline, valores e casos relacionados sem editar fatos. | `GET /v1/orders/{id}`, timeline e related-cases. | Abrir entrega, disputa, ticket ou reembolso elegível; baixar recibo; avaliar. |
| SCR-BUY-006 | DOCUMENTADO | `/pedidos/:orderId/entrega` | Comprador ou vendedor do pedido; somente após settlement válido | Conduzir entrega segura e confirmações independentes. | Order/Delivery/Vault; confirmações e policy snapshot. | Revelar pacote autorizado; enviar instrução; confirmar; reportar problema; abrir disputa. |
| SCR-BUY-007 | PROPOSTO | `/pedidos/:orderId/disputa/:disputeId` | Parte do pedido; evidência bilateral escopada | Acompanhar disputa, prazos, evidências, decisão e recurso. | `/v1/disputes/{id}`, evidências e appeal. | Abrir quando elegível; enviar/fechar submissão; responder; recorrer; ver decisão executada. |
| SCR-BUY-008 | DOCUMENTADO | `/conta/suporte` | Usuário | Listar e criar tickets com categoria coerente e vínculo contextual. | `GET/POST /v1/tickets`. | Filtrar; criar; vincular pedido; anexar; abrir ticket. |
| SCR-BUY-009 | PROPOSTO | `/conta/suporte/:ticketId` | Solicitante/participante autorizado | Manter thread, SLA e anexos de um caso. | `GET /v1/tickets/{id}` e mensagens. | Responder; anexar; reabrir quando permitido; avaliar resolução. |
| SCR-BUY-010 | PROPOSTO | `/conta/reembolsos` | Comprador; somente próprios pedidos | Listar solicitações sem confundir workflow humano com refund financeiro. | `GET /v1/me/refund-requests?cursor=&status=`. | Filtrar; abrir solicitação; voltar ao pedido; responder pendência. |
| SCR-BUY-011 | PROPOSTO | `/conta/reembolsos/:refundRequestId` | Solicitante; propriedade da solicitação | Mostrar valor elegível, decisão, execução e falha recuperável. | `GET /v1/refund-requests/{id}`; estado financeiro canônico separado. | Complementar informação; acompanhar; abrir ticket; ver/escalar disputa quando permitido. |
| SCR-BUY-012 | DOCUMENTADO | `/carrinho` | Usuário; visitante pode manter carrinho local com merge seguro após login | Revisar itens multivendedor, validade, relações opcionais e separação dos pedidos antes de pagar. | `Cart`, `CartLine`, `CatalogItemRelation`, `CheckoutGroup`, preço/disponibilidade revalidados e cupom aplicável. | Alterar quantidade quando suportada; remover; salvar; aplicar cupom; aceitar complemento explicitamente; iniciar checkout por grupos. |

### 3.4 Vendedor — 17

| SCR-ID | Status | Rota | Ator/guarda | Objetivo | Fonte de leitura | Ações autorizadas |
|---|---|---|---|---|---|---|
| SCR-SEL-001 | DOCUMENTADO | `/vender/cadastro` | Usuário com fator forte; gates de idade/política | Criar `SellerAccount`, concluir elegibilidade/KYC/KYB e destino de recebimento. | Seller onboarding e sessão do provedor/PSP. | Criar contexto; continuar etapas; abrir provedor; cadastrar destino; corrigir/reapresentar. |
| SCR-SEL-002 | PROPOSTO | `/vender` | `SellerMembership` ativa | Mostrar saúde comercial, próximas ações e métricas do SellerAccount selecionado. | Sales metrics, listings, balance e alerts; `asOf`. | Trocar SellerAccount; criar anúncio; abrir vendas/saldo/equipe; corrigir bloqueio. |
| SCR-SEL-003 | PROPOSTO | `/vender/equipe` | Membership com grant de gestão | Gerenciar membros sem duplicar `User` nem conceder privilégio superior ao próprio. | `/v1/seller-accounts/{id}/members`. | Convidar; ajustar papel/escopo/validade; revogar; reenviar convite. |
| SCR-SEL-004 | DOCUMENTADO | `/vender/novo` | Vendedor elegível; `listing.create` implícito a formalizar | Criar anúncio em wizard com craft, preço, mídia, entrega, plano e prévia. | `CatalogLibrary`, `Listing`/`ListingRevision` em rascunho, capabilities, plano e política de entrega. | Salvar revisão em rascunho; selecionar item; definir craft/preço/plano; anexar mídia/prova; pré-visualizar; enviar revisão. |
| SCR-SEL-005 | DOCUMENTADO | `/vender/anuncios` | Membership no SellerAccount | Listar rascunhos, revisões, publicados, reservados e encerrados. | Listings do SellerAccount; paginação e filtros. | Filtrar; criar; duplicar dados permitidos; abrir; retirar quando elegível. |
| SCR-SEL-006 | PROPOSTO | `/vender/anuncios/:listingId` | Membership com acesso ao anúncio | Editar apenas revisão mutável e compreender decisão/moderação. | Listing, revisions, review decision e capabilities. | Editar rascunho; corrigir; reenviar; retirar; abrir prova; ver histórico imutável. |
| SCR-SEL-007 | PROPOSTO | `/vender/anuncios/:listingId/prova-posse` | Dono/membro autorizado; step-up quando exigido | Capturar prova de posse/disponibilidade com expiração e revalidação. | OwnershipProof e provider/source autorizado. | Enviar; refazer; acompanhar verificação; excluir rascunho de prova. |
| SCR-SEL-008 | DOCUMENTADO | `/conta/vendas` | Membership no SellerAccount | Exibir dashboard e pedidos de venda no escopo correto. | Sales metrics e `/v1/seller-accounts/{id}/sales`. | Trocar conta; filtrar; pesquisar; abrir venda; ir para entrega/saldo. |
| SCR-SEL-009 | PROPOSTO | `/conta/vendas/:orderId` | Membership com acesso ao pedido | Mostrar timeline da venda, entrega, hold, disputa e líquido previsto. | Order, Delivery, Funds, Payout e casos relacionados. | Abrir entrega; responder disputa/ticket; ver retenção; baixar documento. |
| SCR-SEL-010 | DOCUMENTADO | `/conta/carteira` | Membership; nome público “Saldo de vendas” | Separar pendente, em retenção, congelado, disponível e transferido pelo PSP. | `GET /v1/sales-balance?sellerAccountId=`; ledger espelho. | Trocar conta; abrir extrato/retenções; solicitar saque quando elegível. |
| SCR-SEL-011 | PROPOSTO | `/conta/carteira/extrato` | Membership; somente lançamentos do SellerAccount | Exibir bruto, comissão, tarifa PSP, ajuste e líquido com origem. | `/v1/sales-balance/ledger?cursor=`. | Filtrar período/tipo; abrir origem; exportar com step-up e grant; contestar via suporte. |
| SCR-SEL-012 | PROPOSTO | `/conta/carteira/retencoes` | Membership | Explicar cada hold, prazo mínimo e gates que impedem disponibilidade. | `/v1/sales-balance/holds?cursor=`. | Filtrar; abrir venda/disputa; acompanhar gate; abrir suporte. |
| SCR-SEL-013 | DOCUMENTADO | `/conta/saques` | Membership com `payout.request`; step-up | Solicitar e listar transferências executadas pelo PSP. | `GET/POST /v1/payouts`; saldo elegível e destinos verificados. | Solicitar; escolher destino; filtrar; abrir; cancelar antes do processamento quando permitido. |
| SCR-SEL-014 | PROPOSTO | `/conta/saques/:payoutId` | Membership; propriedade do payout | Exibir tentativas, falha, retorno, retry e comprovante sem duplicar saldo. | `GET /v1/payouts/{id}` e tentativas. | Repetir quando permitido; cancelar; atualizar; abrir suporte; baixar comprovante. |
| SCR-SEL-015 | DOCUMENTADO | `/conta/vendas/clientes` | Membership com `customer_insights.read`; dados minimizados | Mostrar compradores, recompra, lifecycle, carrinhos e oportunidades consentidas sem entregar telefone/PII ao seller. | `SellerCustomerInsight`, `ProductLifecyclePolicy`, pedidos, consentimento e supressão. | Filtrar segmento/coorte; abrir histórico permitido; criar audiência; navegar ao pedido/campanha; excluir contato não elegível. |
| SCR-SEL-016 | PROPOSTO | `/conta/vendas/marketing` | Membership com grants de campanha; canal homologado | Criar campanhas, jornadas, cupons, links e criativos sobre audiência elegível. | `Campaign`, `Journey`, `ConsentRecord`, `SuppressionEntry`, `Coupon`, `AttributionSnapshot` e health de canal. | Criar versão; selecionar audiência; montar template/criativo; validar estimativa; pedir aprovação; ativar/pausar; acompanhar entrega/conversão. |
| SCR-SEL-017 | DOCUMENTADO | `/vender/studio` | Vendedor elegível; acesso à biblioteca publicada | Encontrar produto 2D/3D pré-cadastrado, criar anúncio pré-preenchido ou submeter contribuição sem duplicar catálogo. | `CatalogLibrary`, `CatalogItem`, `CatalogAsset`, `Model3DArtifact`, `CatalogSubmission` e capabilities. | Buscar/filtrar; inspecionar 2D/3D; iniciar Listing; anexar instruções/prova; propor item/asset; acompanhar submissão. |

### 3.5 Administração e operações — 18

Todos os itens desta seção são workbenches master-detail. A seleção opcional no path usa o mesmo template; permissões filtram **seções, campos e ações**, não apenas a entrada na rota.

| SCR-ID | Status | Rota | Ator/guarda | Objetivo | Fonte de leitura | Ações autorizadas |
|---|---|---|---|---|---|---|
| SCR-ADM-001 | DOCUMENTADO | `/admin` | Staff com grants explícitos | Priorizar filas, SLA, alertas e incidentes sem criar métricas paralelas. | Read models operacionais por domínio; health/freshness. | Abrir fila autorizada; reconhecer alerta; acionar runbook; trocar escopo. |
| SCR-ADM-002 | DOCUMENTADO | `/admin/anuncios[/:listingId]` | `listing.review` e ação atômica correspondente | Assumir e decidir revisão congelada de anúncio. | ListingRevision, checklist, ownership proof e histórico. | Claim; verificar prova; aprovar; solicitar alteração; rejeitar; revalidar. Autoaprovação proibida. |
| SCR-ADM-003 | DOCUMENTADO | `/admin/catalogo[/:resourceType/:resourceId]` | `catalog.read` e grants de escrita/publicação | Operar itens, taxonomia, ativos, modelos 3D e importações com proveniência. | Catalog, conjunto versionado de `CatalogAsset` de origem, `Model3DJob`, `Model3DArtifact` e import jobs. | Criar/editar; importar PNG/SVG/GLB; reunir múltiplas vistas; quarentenar; iniciar job 2D→3D; abrir `SCR-ADM-015`; aprovar ativo; publicar; tombstone/merge governado. |
| SCR-ADM-004 | PROPOSTO | `/admin/vendedores[/:onboardingId]` | Staff de onboarding; maker-checker conforme risco | Revisar elegibilidade, KYC/KYB e destino sem copiar dossiê do provedor. | `/v1/admin/seller-onboarding`; sinais mínimos do provedor. | Claim; solicitar correção; aprovar; rejeitar; suspender/escalar conforme grant. |
| SCR-ADM-005 | DOCUMENTADO | `/admin/confianca[/:caseId]` | Trust & Safety; grants por tipo de caso | Tratar PII, fraude, risco, dispositivo, restrição e recurso. | RiskDecision, DeviceTrust, Restriction, Appeal e audit trail. | Claim; desafiar/revogar dispositivo; advertir/restringir; decidir recurso; escalar. |
| SCR-ADM-006 | DOCUMENTADO | `/admin/usuarios[/:userId]` | `user.*` e finalidade explícita | Ver contexto 360° mascarado e executar somente ações autorizadas. | User overview derivado; account/seller/orders/cases por seção. | Buscar; abrir; restringir/desbanir com grant; revogar sessão; acessar caso; registrar motivo. |
| SCR-ADM-007 | DOCUMENTADO | `/admin/pedidos[/:orderId]` | `order.read/intervene` escopado | Investigar timeline de pedido, reserva, pagamento, entrega e hold. | Order 360°, Payment, Delivery, Funds e eventos. | Buscar; abrir; congelar ação relacionada; abrir disputa/ticket; executar intervenção permitida. |
| SCR-ADM-008 | PROPOSTO | `/admin/disputas[/:disputeId]` | `dispute.read/resolve`; segregação de decisão | Operar evidências, prazos, decisão, recurso e execução. | Dispute, EvidenceSubmission, Appeal e efeitos financeiros. | Claim; pedir evidência; decidir `BUYER/SELLER/SPLIT`; encaminhar recurso; solicitar execução. |
| SCR-ADM-009 | DOCUMENTADO | `/admin/suporte[/:ticketId]` | `ticket.read`; campos/ações por grant | Unificar inbox, SLA, thread, anexos e contexto 360° autorizado. | Ticket, e-mail normalizado e `/v1/admin/tickets/{id}/context`. | Claim/atribuir; responder; pedir informação; resolver; reabrir; escalar; abrir reembolso/disputa. |
| SCR-ADM-010 | PROPOSTO | `/admin/reembolsos[/:refundRequestId]` | `refund.read`; decidir/executar separados | Operar `RefundRequest` sem confundir decisão humana com refund confirmado pelo PSP. | RefundRequest, RefundAttempt, Payment e ledger espelho. | Claim; pedir informação; aprovar/rejeitar; enviar para execução; retry; escalar disputa. |
| SCR-ADM-011 | DOCUMENTADO | `/admin/financeiro[/:caseType/:caseId]` | Financeiro; maker-checker e step-up | Consolidar conciliação, holds, refunds, payouts e exceções com dupla aprovação. | PSP reconciliation, ledger, holds, payouts e casos financeiros. | Conciliar; propor ajuste compensatório; aprovar ação alheia; congelar/liberar; exportar governado. |
| SCR-ADM-012 | PROPOSTO | `/admin/pagamentos[/:paymentId]` | Financeiro com grant de exceção | Resolver settlement tardio/quarentena sem dupla venda ou revelação indevida. | `/v1/admin/payments/quarantined`; Order/Reservation/Payment. | Reassociar atomicamente; solicitar refund; manter quarentena; abrir incidente. |
| SCR-ADM-013 | PROPOSTO | `/admin/saques[/:payoutId]` | `payout.read/approve`; maker-checker | Revisar payout, falha, retorno, retry e risco. | PayoutRequest, PayoutAttempt, PSP e saldo reservado. | Claim; aprovar/rejeitar; agendar retry; reverter reserva; escalar fraude. |
| SCR-ADM-014 | DOCUMENTADO | `/admin/midas[/:inventoryId]` | `midas.inventory/manage_price`; SoD configurável | Gerir inventário e preço próprio mantendo canal e contabilidade separados. | MidasInventory, Catalog, Price e policy de aprovação. | Criar/retirar estoque; definir preço; pedir/aprovar publicação; reconciliar venda. |
| SCR-ADM-015 | PROPOSTO | `/admin/catalogo/modelos-3d/:jobId` | `asset.manage`; reviewer diferente quando a política exigir | Acompanhar job 2D→3D e revisar uma saída real antes de vinculá-la ao catálogo. | `Model3DJob`, conjunto imutável de `CatalogAsset` de origem, `Model3DArtifact`, proveniência, logs sanitizados e métricas de validação; contratos executáveis ainda inexistentes. | Comparar PNG/SVG/vistas/GLB de entrada; inspecionar mesh/textura; orbitar/zoom; aprovar, rejeitar, cancelar ou reprocessar; nunca publicar automaticamente. |
| SCR-ADM-016 | DOCUMENTADO | `/admin/avaliacoes[/:orderReviewId]` | `review.moderate`; segregação quando houver sanção | Moderar avaliações, denúncias, manipulação e recursos preservando a projeção reconstruível. | `OrderReview`, `Order`, sinais antiabuso, decisão e `ReputationProjection`. | Claim; ocultar/restaurar com motivo; decidir denúncia/recurso; marcar fraude; reconstruir projeção via job autorizado. |
| SCR-ADM-017 | PROPOSTO | `/admin/marketing[/:resourceType/:resourceId]` | `marketing.platform.*` por recurso/finalidade | Operar aprovações, saúde de canais, templates, supressões, abuso, campanhas e atribuição em visão master-detail. | Campaign/Journey/Dispatch, Meta adapters, consentimento, cupons, afiliados, criativos e métricas reconciliadas. | Aprovar/rejeitar; pausar; suprimir; testar canal; investigar delivery; bloquear abuso; revisar atribuição; abrir incidente. |
| SCR-ADM-018 | DOCUMENTADO | `/admin/studio[/:resourceType/:resourceId]` | `catalog.studio.*`; publicação separada de criação | Curar biblioteca 2D/3D, submissões, relations, lifecycle e assets com proveniência. | `CatalogSubmission`, `CatalogItem`, `CatalogAsset`, jobs/artifacts, policies e trilha. | Claim; comparar; classificar; vincular/mesclar; aprovar/rejeitar; iniciar/reprocessar job; publicar/tombstone em decisão separada. |

### 3.6 Master e governança — 8

| SCR-ID | Status | Rota | Ator/guarda | Objetivo | Fonte de leitura | Ações autorizadas |
|---|---|---|---|---|---|---|
| SCR-MST-001 | DOCUMENTADO | `/master` | L4 com passkey/2FA; default deny | Exibir saúde de configuração, acessos, integrações, auditoria e kill switches. | ConfigRegistry, IAM, integration health e audit summaries. | Abrir domínio; reconhecer alerta; iniciar mudança versionada; acionar emergência auditada. |
| SCR-MST-002 | PROPOSTO | `/master/acessos` | `roles.read/manage`; step-up; maker-checker | Gerir roles, grants, escopos, validade, convites e break-glass. | `/v1/admin/roles`, grants e admin memberships. | Criar versão; conceder/revogar; convidar; expirar elevação; revisar acesso. Ninguém concede o que não possui. |
| SCR-MST-003 | PROPOSTO | `/master/configuracoes` | Grant por namespace de configuração | Alterar políticas, taxas, prazos e feature flags sem hardcode. | ConfigRegistry versionado e policy snapshots. | Criar rascunho; validar impacto; pedir aprovação; publicar/rollback; comparar versões. |
| SCR-MST-004 | PROPOSTO | `/master/integracoes` | Grant por integração; segredo nunca retornado | Configurar PSP, e-mail, analytics e fontes autorizadas com health e rotação. | Integration registry, secret references e health checks. | Testar conexão; rotacionar referência; habilitar/desabilitar; ver falha sanitizada; abrir runbook. |
| SCR-MST-005 | DOCUMENTADO | `/master/auditoria` | `audit.read/export`; step-up para exportar | Consultar trilha imutável por ator, objeto, decisão e correlação. | `GET /v1/admin/audit`; armazenamento append-only. | Filtrar; abrir evento; seguir correlação; exportar governado; verificar integridade. Nunca editar/excluir. |
| SCR-MST-006 | DOCUMENTADO | `/master/progressao` | `progression.manage`; maker-checker para publicação | Definir níveis, recompensas, insígnias, slots e prêmios do ranking por versão e vigência. | `AccountLevelDefinition`, `RewardDefinition`, `BadgeDefinition`, `LeaderboardSeason/Award` e impacto projetado. | Criar versão; enviar/aprovar/publicar; anexar arte licenciada; definir top 3; revogar award com motivo; comparar/rollback seguro. |
| SCR-MST-007 | DOCUMENTADO | `/master/planos-de-anuncio` | `listing_plan.manage`; financeiro aprova fee | Definir Básico/VIP/Premium, comissão, prioridade e SLA sem alterar pedidos históricos. | `ListingPlanPolicyVersion`, simulação de impacto e `ListingCommercialSnapshot` históricos. | Criar versão; simular; pedir dupla aprovação; publicar/agendar; descontinuar; comparar adesão/resultado. |
| SCR-MST-008 | PROPOSTO | `/master/marketing` | `marketing.governance`; finalidade e step-up | Governar canais, remetentes, finalidades, frequência, opt-in, templates, afiliados, mercados e kill switches. | Channel/Market policies, integration capabilities, consent registry, suppression, campaign governance e audit. | Configurar draft; testar; aprovar; ativar/desativar; pausar globalmente; definir limites/comissão; revisar conformidade. |

### 3.7 Growth — 9

Growth é uma **projeção analítica autorizada**, não um segundo cadastro de usuário, vendedor, pedido ou estado. O tenant canônico é `SellerAccount`; `User` permanece identidade global e `SellerMembership` define a atuação no tenant. As APIs desta seção são contratos propostos e devem ser implementadas sobre eventos/read models reais, nunca por funções simuladas.

| SCR-ID | Status | Rota | Ator/guarda | Objetivo | Fonte de leitura | Ações autorizadas |
|---|---|---|---|---|---|---|
| SCR-GRW-001 | PROPOSTO | `/admin/growth` | `growth.read` proposto; ABAC por escopo | Visão global de aquisição, ativação, transação, retenção e risco. | `GrowthGlobalReadModel` proposto, derivado de eventos canônicos e KPI Registry. | Filtrar; comparar período; abrir funil/coorte/tenant; salvar visão; exportar somente com grant. |
| SCR-GRW-002 | PROPOSTO | `/admin/growth/funil` | `growth.read` | Explicar conversão por estágio comprador/vendedor e seus bloqueios. | `GrowthFunnelReadModel`, `stageModelVersion` e `asOf`. | Escolher jornada; segmentar; comparar; abrir estágio; perfurar tenant/membro/interação. |
| SCR-GRW-003 | PROPOSTO | `/admin/growth/tenants` | `growth.platform.read`; isolamento por escopo | Listar `SellerAccount` por situação, estágio, bloqueio e próxima ação derivada. | `GrowthTenantBucket` + catálogo semântico; nenhum cadastro paralelo. | Filtrar; ordenar; comparar; abrir o tenant; seguir link para o objeto canônico autorizado. |
| SCR-GRW-004 | PROPOSTO | `/admin/growth/tenants/:sellerAccountId` | `growth.platform.read` + field policy | Consolidar estágio, membros, interações, funil e oportunidades do `SellerAccount`. | `GrowthTenantBucket`, `GrowthFunnelBucket`, contribuições e timelines derivadas. | Trocar período; abrir membership/interação/contribuição; navegar ao objeto canônico. Não há mutação Growth. |
| SCR-GRW-005 | PROPOSTO | `/admin/growth/membros` | `growth.platform.read`; IDs pseudonimizados por padrão | Listar `SellerMembership`/`User` sem duplicar identidade nem perfil. | Membership canônica + projeções de estágio escopadas por `sellerAccountId`. | Filtrar; abrir membership; comparar estágio; exportar somente agregado autorizado. |
| SCR-GRW-006 | PROPOSTO | `/admin/growth/membros/:membershipId` | Autorização por membership, tenant, finalidade e campo | Mostrar jornada e interações necessárias à análise autorizada. | `User`/`SellerMembership` + `GrowthTimelineProjection`; conteúdo de chat, segredo e payload bruto excluídos. | Abrir evento contextual; navegar ao tenant/objeto canônico; registrar anomalia pelo fluxo operacional existente. |
| SCR-GRW-007 | PROPOSTO | `/admin/growth/coortes` | `growth.read` | Comparar retenção e conversão com definição de coorte estável. | `GrowthCohortReadModel`; definição, timezone, janela, moeda, exclusões e `asOf`. | Criar comparação; trocar métrica; segmentar; abrir composição; exportar agregado. |
| SCR-GRW-008 | PROPOSTO | `/admin/growth/interacoes` | `growth.read`; finalidade e minimização | Auditar eventos de jornada sem expor payload bruto indevido. | Timeline derivada de analytics consentido e eventos de domínio allowlisted. | Filtrar evento/origem; abrir contexto autorizado; inspecionar freshness; reportar anomalia. |
| SCR-GRW-009 | PROPOSTO | `/admin/growth/oportunidades` | `growth.platform.read` | Priorizar bloqueios e próximas ações **derivadas**, sem criar CRM ou estado comercial paralelo. | `GrowthObjectContribution`, regras versionadas e fontes canônicas; cada recomendação carrega motivo, freshness e link. | Filtrar; ordenar; abrir explicação; navegar ao objeto/fluxo operacional que possui a ação. Growth não atribui nem conclui oportunidade. |

### 3.8 Conferência da contagem

| Grupo | Intervalo | Quantidade |
|---|---|---:|
| Público | `SCR-PUB-001..015` | 15 |
| Identidade/conta | `SCR-ACC-001..016` | 16 |
| Comprador | `SCR-BUY-001..012` | 12 |
| Vendedor | `SCR-SEL-001..017` | 17 |
| Administração | `SCR-ADM-001..018` | 18 |
| Master | `SCR-MST-001..008` | 8 |
| Growth | `SCR-GRW-001..009` | 9 |
| **Total** |  | **95** |

Distribuição de maturidade nesta versão: **52 DOCUMENTADO · 42 PROPOSTO · 1 BLOQUEADO**.

## 4. Contrato comum de estado

Toda tela remota implementa explicitamente os seis estados abaixo. “Sem resultado” não é erro; “sem autorização” não é vazio; “stale” não pode parecer dado atual.

| Estado | Gatilho mínimo | Renderização obrigatória | Ação permitida | Observabilidade |
|---|---|---|---|---|
| `LOADING` | Primeira leitura ainda sem snapshot utilizável. | Skeleton com geometria estável, `aria-busy=true` e título real; nenhuma contagem fictícia. | Voltar, cancelar navegação e acessar ajuda. | Latência, operação e `correlationId`; nunca payload sensível. |
| `EMPTY` | Leitura válida retorna zero itens ou configuração ainda não criada. | Motivo contextual, filtros ativos e CTA possível; zero real, não “—”. | Criar, limpar filtro ou mudar período conforme permissão. | Evento de empty com filtros allowlisted. |
| `ERROR` | Timeout, `5xx`, contrato inválido ou falha não recuperada. | Mensagem segura, referência de suporte e preservação de entrada não secreta. | Tentar novamente, voltar ou abrir suporte; não repetir mutação automaticamente. | Código estável, `correlationId`, retry count. |
| `STALE` | Snapshot passou do SLA ou dependência reportou degradação. | Banner persistente “Atualizado em…”, origem/freshness e região afetada. | Ler snapshot; atualizar. Mutação dependente do fato stale fica bloqueada. | Idade do dado, fonte, SLA e início da degradação. |
| `FORBIDDEN` | `403`, deny explícito, escopo/objeto/campo não autorizado. | Página ou seção neutra sem confirmar existência, contagem ou identidade do objeto. | Voltar, trocar contexto autorizado ou solicitar acesso pelo processo formal. | Decisão do PDP, policy version e motivo sanitizado; tentativa auditada. |
| `READY` | Snapshot válido e capacidade calculada pelo servidor. | Conteúdo, `asOf` quando derivado, permissões de ação e próximo passo. | Somente ações presentes em `allowedActions`/capabilities. | Web vitals, sucesso e evento de produto minimizado. |

### 4.1 Códigos HTTP e recuperação visual

| Resposta | Estado de tela | Regra |
|---|---|---|
| `401` | Sessão expirada | Preservar URL de retorno e rascunho não sensível; enviar para login/step-up. |
| `403` | `FORBIDDEN` | Não fazer fallback para `404` textual que revele objeto; resposta visual neutra. |
| `404` | Não encontrado | Explicar que o recurso não existe ou não está mais disponível sem revelar histórico privado. |
| `409` | Conflito | Recarregar fato canônico e mostrar o que mudou; nunca sobrescrever silenciosamente. |
| `412` | Versão desatualizada | Exigir refresh/revisão antes de decisão concorrente. |
| `422` | Validação | Associar erros aos campos e manter valores seguros; foco no primeiro erro. |
| `429` | Limite | Informar espera sem expor regra antifraude; bloquear spam/reenvio. |
| `503` | `ERROR` ou `STALE` | Usar snapshot somente para leitura se permitido; checkout/financeiro ficam sem mutação. |

### 4.2 Regra de stale por família

| Família | Pode exibir snapshot stale? | Mutação quando stale |
|---|---|---|
| Catálogo, busca e preço histórico | Sim, com `asOf` e fonte. | Favoritar pode continuar; comprar exige revalidação canônica. |
| Checkout, disponibilidade e entrega | Apenas resumo não acionável. | Criar pedido, pagar, revelar ou confirmar: bloqueado até refresh válido. |
| Saldo, hold, refund e payout | Sim para consulta identificada. | Solicitar/aprovar/executar/retry: bloqueado. |
| Admin/Master | Sim para investigação. | Decisões, configuração, IAM e exportação: bloqueados. |
| Growth | Sim, com SLA e cobertura. | Exportar ou alterar oportunidade: bloqueado; filtros locais continuam. |

## 5. Matriz de ação por estado

Legenda: `✓` permitida; `C` condicional à capacidade/segurança; `—` bloqueada.

| Classe de ação | LOADING | EMPTY | ERROR | STALE | FORBIDDEN | READY |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Voltar/navegar para área pública | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Alterar filtro local já carregado | — | ✓ | C | ✓ | — | ✓ |
| Atualizar leitura | — | ✓ | ✓ | ✓ | — | ✓ |
| Criar recurso não financeiro | — | C | — | — | — | C |
| Salvar rascunho local seguro | C | C | C | C | — | ✓ |
| Enviar anúncio/evidência/decisão | — | — | — | — | — | C |
| Conversar/responder ticket | — | C | — | C se thread atual | — | C |
| Iniciar checkout ou revelar entrega | — | — | — | — | — | C |
| Solicitar/decidir/executar refund ou payout | — | — | — | — | — | C |
| Alterar IAM/configuração/integração | — | — | — | — | — | C |
| Exportar dados/auditoria/Growth | — | C | — | — | — | C + step-up |
| Criar/alterar oportunidade Growth | — | — | — | — | — | C após decisão de domínio |

Regras adicionais:

1. Botão invisível não substitui autorização; o servidor revalida ator, objeto, campo, estado e versão.
2. Duplo clique ou retry usa `Idempotency-Key` para toda mutação repetível.
3. Ação irreversível mostra alvo, efeito, valor/moeda, política/versão e confirmação; maker-checker nunca pode ser contornado no cliente.
4. “Próxima ação” é derivada das capacidades do servidor. A UI não deduz transições comparando strings.

## 6. Fluxos ponta a ponta

### FL-01 — Descoberta, negociação, compra, entrega e disputa P2P

1. `SCR-PUB-001/002/004` consulta `GET /v1/search`; canal, filtros e `asOf` seguem na URL.
2. `SCR-PUB-005` mostra item-base e histórico. Feed stale permanece visível com aviso; ausência de fonte nunca vira preço inventado.
3. `SCR-PUB-006` lê a revisão publicada e as capabilities. Conversa abre `SCR-BUY-002`; proposta aceita produz `offer.accepted`, sem criar pagamento.
4. “Comprar” exige login, idade/política aplicáveis e disponibilidade. `POST /v1/orders` com idempotência revalida prova/capability e reserva unidade; resultado abre `SCR-BUY-003`.
5. `SCR-BUY-003` cria sessão hospedada no PSP. Retorno do navegador é apenas informativo; somente webhook autenticado confirma `payment.settled`.
6. Se a reserva expirar primeiro, o pedido entra em expiração segura. Settlement tardio gera `payment.quarantined`; nenhum segredo/contato é revelado. O comprador vê status neutro e suporte, enquanto `SCR-ADM-012` decide reassociação atômica ou refund.
7. Settlement válido abre `SCR-BUY-006`; pacote/instrução autorizada é consumido uma vez. Comprador e vendedor confirmam independentemente.
8. Dupla confirmação sem disputa produz `order.completed` e `funds.hold_started`. Discordância abre `SCR-BUY-007` e `dispute.opened`.
9. Evidências possuem prazo e submissão fechada. Decisão/recurso ocorre em `SCR-ADM-008`; efeito financeiro somente após evento PSP/ledger canônico.

**Falhas verificáveis:** anúncio já reservado (`409`), preço stale, PSP indisponível, webhook duplicado, settlement tardio, pacote já consumido, evidência expirada e BOLA entre pedidos.

### FL-02 — Onboarding do vendedor, anúncio, moderação, venda e saque

1. `SCR-ACC-006` confirma fator forte. `SCR-SEL-001` cria `SellerAccount` e inicia `seller.onboarding_started`.
2. KYC/KYB e destino ocorrem no provedor; a UI guarda apenas sinais mínimos. Enquanto pendente/rejeitado, `SCR-SEL-004` pode permitir rascunho, mas não submissão/publicação.
3. `SCR-SEL-004` seleciona item canônico, craft e quatro slots condicionais, preço, mídia, instrução de entrega e prova. `ACCOUNT` e credenciais Standoff 2 permanecem bloqueados no servidor.
4. Salvar usa `PATCH /v1/listings/{id}/draft`; enviar congela revisão com `POST /submit` e `listing.submitted`.
5. `SCR-ADM-002` faz claim, revisa versão congelada e decide. Criador, vendedor ou autor da mudança não aprova a própria ação.
6. Aprovação publica `listing.approved`; correção cria nova revisão sem apagar a anterior. `SCR-SEL-005/006` exibe motivo e próximo passo.
7. Após venda, `SCR-SEL-008/009` conduz entrega. Conclusão inicia hold; `SCR-SEL-010/012` mostra gates e `asOf`.
8. Quando `funds.available`, `SCR-SEL-013` solicita payout com step-up. `SCR-ADM-013` aplica maker-checker; `SCR-SEL-014` acompanha tentativas sem criar nova reserva de saldo.

### FL-03 — Estoque e venda “Compre do Midas”

1. Operador abre `SCR-ADM-014`, escolhe item canônico e registra unidade/quantidade, origem, custo e entrega.
2. Preço e publicação seguem quatro-olhos quando a política exigir; `SellerAccount` P2P não é usado para disfarçar estoque próprio.
3. Oferta publicada aparece apenas em `SCR-PUB-003` e leva selo permanente “Vendido pelo Midas”.
4. Compra reutiliza `SCR-BUY-003`, Order, Payment, Delivery e Dispute; regras de pagamento/entrega não ganham um motor paralelo.
5. Relatórios e `SCR-GRW-001` separam GMV P2P, estoque, receita e margem Midas.

**Bloqueio:** nenhum estoque/dado/asset real de Standoff 2 entra na fonte enquanto o gate P0 estiver fechado.

### FL-04 — Ticket contextual e solicitação de reembolso

1. De `SCR-BUY-005`, o comprador abre `SCR-BUY-008` já com `orderId`, categoria e política aplicável; PII não é copiada para campos livres.
2. `ticket.created` entra em `SCR-ADM-009`; inbound e-mail válido continua a mesma thread. Anexo fica isolado, escaneado e escopado.
3. Agente vê apenas seções autorizadas do contexto 360°. Sem grant financeiro, não vê campos restritos nem decide/executa refund.
4. Se elegível, o usuário cria a mesma `RefundRequest` idempotente e acompanha em `SCR-BUY-011`.
5. `SCR-ADM-010` pode pedir informação, decidir total/parcial ou rejeitar. `If-Match` impede decisões concorrentes acima do reembolsável.
6. Execução financeira passa por `SCR-ADM-011`; sucesso real é `payment.refunded`/`payment.partially_refunded` mais `ledger.entry_posted`.
7. Falha de tentativa mantém histórico e oferece retry controlado. Escalonamento cria/relaciona disputa sem duplicar o efeito financeiro.

### FL-05 — Restrição, dispositivo e recurso

1. Sinal de risco pode exigir desafio em `SCR-ACC-001/008`; device trust não substitui MFA nem identidade.
2. Decisão de risco gera `account.restricted` e capabilities limitadas. `SCR-ACC-013` mostra categoria, duração, efeito e via de recurso permitidos.
3. O usuário envia recurso idempotente com evidência segura; `account.restriction_appealed` entra em `SCR-ADM-005`.
4. Analista diferente do autor da ação revisa quando a política exigir. Decisão mantém trilha e notifica o usuário.
5. Revogação de sessão/dispositivo não apaga evidência nem histórico de auditoria.

### FL-06 — Preferências, perfil e direitos sobre dados

1. `SCR-ACC-010` exibe finalidades separadas; desligar personalização não desliga notificações estritamente transacionais.
2. Opt-out atualiza preferência e inicia limpeza/reconstrução do perfil derivado. `SCR-PUB-001/004` passa a usar ranking não personalizado.
3. `SCR-ACC-011` cria `data_rights.requested`; `SCR-ACC-012` apresenta protocolo, prazo e complementação necessária.
4. Operação autorizada ocorre no workbench `SCR-ADM-006`/fila correspondente, com identidade verificada e minimização.
5. `data_rights.resolved` disponibiliza resultado seguro e auditável; retenções legais/antifraude são explicadas, não ocultadas.

### FL-07 — Exceção de pagamento e conciliação

1. `payment.quarantined` aparece em `SCR-ADM-012` com pedido, reserva, unidade, evento PSP, versões e locks necessários.
2. Operador não edita status. Ele propõe: reassociar se a mesma unidade puder ser readquirida atomicamente, ou solicitar refund.
3. Ação acima do limite segue para aprovador diferente em `SCR-ADM-011`.
4. Reassociação válida produz `payment.quarantine_reassociated`; refund só conclui com webhook PSP e lançamento compensatório.
5. Corrida, duplicata, evento fora de ordem e estado desconhecido mantêm caso bloqueado e abrem runbook; nunca liberam entrega por timeout.

### FL-08 — Growth: global → funil → tenant → membro → interação → oportunidade

1. `SCR-GRW-001` recebe filtros globais, `metricDefinitionVersion`, cobertura e `asOf`; nenhum KPI é recalculado no browser.
2. Clique em conversão abre `SCR-GRW-002` preservando período, timezone, moeda, canal, coorte e estágio.
3. Drill-down de estágio abre `SCR-GRW-003/005`; contagens pequenas ou campos pessoais são suprimidos conforme política.
4. `SCR-GRW-004/006` explica `stageCode`, situação, bloqueio e próxima ação com `reasonSource`; não altera Order, SellerAccount, Restriction ou Ticket.
5. `SCR-GRW-008` mostra apenas eventos allowlisted e links para a tela operacional autorizada.
6. `SCR-GRW-009` permanece uma projeção read-only: explica o motivo e navega ao objeto canônico, que revalida autorização e estado antes de qualquer ação. Growth não atribui, anota nem conclui oportunidade.
7. Todo link de retorno recompõe o mesmo conjunto de filtros; métricas da origem e do destino precisam reconciliar dentro da mesma versão/asOf.

### FL-09 — Catálogo, job 2D→3D, revisão e publicação

1. Em `SCR-ADM-003`, staff com `asset.manage` envia PNG/SVG, múltiplas vistas ou GLB com origem, licença, hash e vínculo ao item. SVG é sanitizado; tipo real, tamanho e conteúdo são validados.
2. Uma única imagem deixa o conjunto versionado de `CatalogAsset` classificado como **draft de vista única**. Múltiplas vistas coerentes ou GLB elevam a classe de fonte, mas não provam fidelidade nem autorizam publicação.
3. “Iniciar job 3D” cria um `Model3DJob` idempotente e abre `SCR-ADM-015`. O job referencia fontes imutáveis e uma configuração versionada; nunca sobrescreve tentativa anterior.
4. `SCR-ADM-015` acompanha fila/processamento sem inventar percentual. Falha exibe etapa e código sanitizados; retry cria nova tentativa ligada ao mesmo conjunto de fontes.
5. Em `REVIEW_REQUIRED`, o revisor compara fontes e GLB real, inspeciona mesh, textura, escala, orientação, materiais, performance e avisos de validação.
6. Aprovação cria um `Model3DArtifact` imutável; publicação apenas troca o ponteiro ativo do item em decisão separada e auditada. Rejeição exige motivo e não apaga artefato/evidência.
7. `SCR-PUB-005/006` exibe poster e entrada para `SCR-PUB-013`, que carrega somente GLB aprovado e publicado. Ausência, falha, incompatibilidade ou baixa confiança usa imagem 2D explícita, sem extrusion/parallax/cartão rotativo apresentado como 3D.

### FL-10 — Seleção → inspeção 3D individual → retorno

1. Card, item-base ou anúncio resolve o `slug` canônico e navega para `/itens/:slug/3d`, preservando a origem permitida; nunca instancia canvas em cada card.
2. `SCR-PUB-013` mostra o poster imediatamente e busca o manifesto do `Model3DArtifact` ativo. Um `slug` inválido ou sem artefato permanece na alternativa 2D e oferece retorno.
3. Ao ficar pronto, Three/R3F executa uma única revelação de 650–900 ms, com deslocamento angular de no máximo 15°, e termina na pose neutra. React Bits pode animar o shell DOM, não câmera/modelo.
4. O primeiro input interrompe a revelação e entrega `OrbitControls`; reduced motion pula diretamente para a pose neutra. Depois, só rotação, zoom, vistas, reset e fullscreen acionados pela pessoa.
5. Selecionar outro item/variante aborta fetch/decode obsoleto, descarta geometria, materiais, texturas, controles e listeners e só então ativa o novo artefato. Um único canvas/modelo permanece montado.
6. Deep link é compartilhável; “Voltar” restaura listagem/item/anúncio e filtros quando válidos. Falha de WebGL/contexto usa poster/galeria 2D e não bloqueia preço, oferta ou compra.

### FL-11 — Pagamento confirmado, hold de sete dias e saque manual

1. `PaymentAttempt` retorna ao browser apenas como processamento; webhook assinado entra na inbox, é deduplicado e reconciliado por consulta ao PSP.
2. Settlement cria `JournalEntry`/`Posting`, `BalanceLot` protegido e `Hold` com `eligibleAt = Payment.settledAt + 168h` na mesma transação.
3. `SCR-SEL-010/012` mostra valor, moeda, início, elegibilidade e gates. Conclusão do pedido não reinicia o relógio; disputa, risco, KYC, refund ou chargeback bloqueiam liberação.
4. Se o PSP não confirmar pagamento alegado, `SCR-ADM-012` abre `PaymentResolutionCase`. Staff coleta evidência e consulta provedor; decisão válida executa o mesmo settlement idempotente, nunca um update de status.
5. Com lote disponível, `SCR-SEL-013` cria um `PayoutRequest` e reserva exatamente os lotes alocados.
6. `SCR-ADM-013` exige claim, verificação de destino/risco e segregação. Execução externa cria `PayoutAttempt` e `PayoutEvidence`; referência duplicada ou prova ausente não conclui.
7. Seller acompanha em `SCR-SEL-014`. Falha/retorno preserva reserva para revisão/retry ou gera reversão contábil explícita; nenhum saldo é inventado.

### FL-12 — Avaliação bilateral, progressão, ranking, prêmios e plano

1. Após `order.completed`, `SCR-ACC-015` habilita uma `OrderReview` por papel, inclusive nota zero; cada lado envia sem ver a avaliação ainda oculta do outro.
2. Publicação/moderação atualiza `ReputationProjection` por job reproduzível. Denúncia/recurso segue `SCR-ADM-016`; staff não edita média.
3. Venda elegível cria `ProgressionContribution`; refund/chargeback posterior cria contribuição compensatória. `AccountLevelAssignment` mostra o nível vigente em `SCR-ACC-016`.
4. `SCR-MST-006` publica definições/recompensas por versão. `BadgeAward`/`RewardAward` guarda origem e fulfillment; arte ausente mantém slot vazio.
5. `LeaderboardSeason` mensal recebe `LeaderboardContribution` rastreável; Premium aplica a fórmula congelada, não um contador no frontend. `SCR-PUB-014` mostra ranking e desempate.
6. Fechamento congela projeção/top 3. `LeaderboardAward` vincula o prêmio manual sem alterar posições encerradas.
7. Ao criar anúncio, o seller escolhe plano publicado. `ListingCommercialSnapshot` congela fee/prioridade/SLA; Básico, VIP e Premium jamais mudam mérito legal, antifraude ou aprovação de refund.

### FL-13 — Carrinho, lifecycle, abandono, recompra e pós-venda

1. `SCR-BUY-012` mantém `Cart` e `CartLine`; preço, validade e disponibilidade são revalidados ao abrir e antes de pagar.
2. `CatalogItemRelation` pode sugerir complemento/renovação com motivo explícito. Nada é pré-selecionado nem adicionado sem ação do usuário.
3. Checkout particiona em `CheckoutGroup` por seller/moeda/capability e cria pedidos/pagamentos independentes, deixando claro o resultado de cada grupo.
4. Inatividade elegível gera evento de abandono. Sem `ConsentRecord`, nenhuma automação externa é criada; com consentimento, frequência/horário/supressão ainda são revalidados.
5. `ProductLifecyclePolicy` calcula janela de expiração/renovação/recompra, enquanto `ReturnPolicySnapshot` decide devolução separadamente.
6. `SCR-SEL-015` apresenta coortes e próxima oportunidade minimizada; seller não recebe WhatsApp/telefone bruto e navega para campanha autorizada, não para planilha de PII.

### FL-14 — Campanha, WhatsApp/Instagram, cupom, link e afiliado

1. Seller cria draft em `SCR-SEL-016`, escolhe audiência elegível, template, `CreativeAsset`, canal, frequência e objetivo; ativação congela `CampaignVersion`/`JourneyVersion`.
2. Antes de cada passo, policy verifica `ConsentRecord`, `SuppressionEntry`, quiet hours, finalidade, remetente, tenant e capability real do canal.
3. WhatsApp usa Cloud API/opt-in/template quando exigido. Instagram só continua conversa iniciada pelo usuário; cold DM permanece indisponível.
4. `Dispatch` possui chave única por jornada/destinatário/passo; retry cria `DeliveryAttempt`. `ChannelEvent` de leitura/entrega não vira conversão.
5. Cupom é reservado em `SCR-BUY-012`, consumido apenas no pedido confirmado e estornado sob falha/refund conforme policy.
6. Link/cupom registra `AttributionTouch`; `AttributionSnapshot` congela crédito somente após conversão reconciliada. `AffiliateCommission` nasce como obrigação explícita, sujeita a fraude/reversão e ledger homologado.
7. `SCR-ADM-017` investiga abuso/entrega e `SCR-MST-008` controla políticas/kill switches sem acessar segredo bruto.

### FL-15 — Studio: biblioteca → anúncio ou contribuição → 2D/3D publicado

1. `SCR-SEL-017` consulta `CatalogLibrary`; seleção de `CatalogItem` inicia a mesma `ListingRevision` de `SCR-SEL-004` já pré-preenchida, sem criar produto do seller.
2. Se o item/asset não existir, seller abre `CatalogSubmission` com fontes, licença e instruções; submissão não aparece publicamente.
3. `SCR-ADM-018` faz claim, classifica taxonomia/lifecycle/return policy, compara origem e decide vincular, criar item, pedir correção ou rejeitar.
4. Asset 2D aprovado pode ser publicado como `CatalogAsset`. Fonte candidata a 3D cria `Model3DJob` e segue `SCR-ADM-015`/FL-09.
5. Publicação separada troca o ponteiro ativo do `CatalogItem`; `SCR-PUB-005/006/013` recebe apenas versão aprovada, poster e fallback.

### FL-16 — Mercado global, SEO técnico e conteúdo indexável

1. `MarketPolicy` resolve locale, moeda de exibição, disponibilidade, PSP, termos e indexação antes de renderizar; moeda do ledger permanece a do fato financeiro.
2. Página pública entrega HTML útil, canonical/hreflang, breadcrumbs, dados estruturados factuais, poster e alt text antes do WebGL.
3. `robots.txt` e sitemaps são derivados de `CrawlPolicy` e estado publicável. Carrinho, conta, filtros infinitos, busca interna, admin e previews não entram no índice.
4. Mudança de slug mantém redirect/canonical; remoção distingue indisponível temporário, substituto e tombstone permanente.
5. Search Console/logs/crawl monitoram cobertura e erro; nenhuma biblioteca ou campanha injeta schema de review/preço sem fato canônico correspondente.

## 7. Contrato específico de Growth

### 7.1 Identidade, tenant e oportunidade

Decisões semânticas congeladas para esta versão:

1. **Tenant comercial = `SellerAccount`.** Não existe tabela, sessão, credencial ou cadastro `Tenant` paralelo.
2. **Membro = projeção autorizada de `SellerMembership` + `User`.** `membershipId` identifica a participação no tenant; `userId` identifica a pessoa global, sem duplicá-la.
3. **Oportunidade = recomendação derivada read-only.** Possui motivo, evidência, freshness e deep link, mas não aceita owner, nota, status, SLA nem comando no Growth.
4. **Objeto canônico possui a ação.** Todo deep link relê o agregado e revalida versão, estado, escopo e permissão; a projeção analítica nunca autoriza mutação.

Permanece como gate de dados reais a aprovação de finalidade, campos, retenção, limiar de agregação, exportação e opt-out aplicável.

### 7.2 Filtros globais

Todos os filtros serializam na URL e são validados pelo servidor:

`from`, `to`, `timezone`, `currency`, `channel=P2P|MIDAS`, território, cohort, buyerStage, sellerStage, `sellerAccountId`, riskStatus, situation, blocker, nextAction, `reasonCode` e source/campaign somente quando houver origem autorizada.

Filtro não aplicável deve ser desabilitado com explicação; nunca retornar zero silencioso por combinação inválida.

### 7.3 Estágios derivados

Os nomes abaixo são **PROPOSTOS**. São projeções versionadas, não novas máquinas persistidas.

| Jornada | Estágios propostos | Fontes canônicas | Exemplo de bloqueio/próxima ação |
|---|---|---|---|
| Comprador | `REGISTERED → VERIFIED → ENGAGED → INTENT → PAID → DELIVERED → REPEAT`; ramificação `AT_RISK`. | User, age/security, interaction allowlist, Order, Payment, Delivery. | `AGE_PENDING` → concluir verificação; `PAYMENT_QUARANTINED` → aguardar operação; `DISPUTED` → abrir caso. |
| Vendedor | `INVITED/DRAFT → VERIFICATION → ELIGIBLE → FIRST_LISTING → PUBLISHED → FIRST_SALE → ACTIVE → HOLD/PAYOUT`; ramificações `AT_RISK/RESTRICTED`. | SellerAccount, SellerMembership, onboarding, Listing, Order, Funds, Payout, Restriction. | `KYC_PENDING` → retomar provedor; `PROOF_EXPIRED` → revalidar; `HOLD_DISPUTED` → abrir venda/disputa. |

Cada linha analítica precisa de:

`stageCode`, `stageModelVersion`, `stageEnteredAt`, `situationCode`, `blockerCode`, `nextActionCode`, `reasonSource`, `sourceObjectId` autorizado, `asOf` e `freshness`.

### 7.4 Registro mínimo de KPIs

| KPI-ID | Nome | Fórmula proposta | Grão/fonte | Observação |
|---|---|---|---|---|
| KPI-GRW-01 | Cadastros verificados | usuários que completaram gates / cadastros elegíveis | dia; Identity/Age | Excluir bots/testes pela regra versionada. |
| KPI-GRW-02 | Ativação comprador | usuários com interação qualificada / verificados | coorte semanal; analytics allowlist | “Interação qualificada” precisa de definição aprovada. |
| KPI-GRW-03 | Conversão para pagamento | pedidos com `payment.settled` / intents elegíveis | dia e canal; Order/Payment | Settlement tardio só entra após desfecho canônico. |
| KPI-GRW-04 | Conclusão de entrega | `order.completed` / pagamentos válidos com entrega exigida | semana; Delivery/Order | Separar pendentes ainda dentro do SLA. |
| KPI-GRW-05 | Recompra | compradores com segunda compra / compradores elegíveis | coorte mensal; Order | Janela e identidade devem ser estáveis. |
| KPI-GRW-06 | Ativação vendedor | SellerAccounts com primeira publicação / onboardings aprovados | coorte semanal; Seller/Listing | Não contar membro como novo seller. |
| KPI-GRW-07 | Tempo até primeira venda | mediana entre aprovação e primeiro `order.completed` | SellerAccount; Seller/Order | Exibir percentis e censura, não apenas média. |
| KPI-GRW-08 | Taxa de disputa | pedidos com `dispute.opened` / pedidos pagos elegíveis | canal/categoria; Dispute/Order | Definir janela de maturação. |
| KPI-GRW-09 | Taxa de refund confirmado | valor confirmado pelo PSP / GMV settled | moeda/canal; Payment/Ledger | Não contar `RefundRequest` apenas aprovada. |
| KPI-GRW-10 | Aging de payout | tempo entre disponibilidade e `payout.paid` | SellerAccount; Funds/Payout | Segmentar falha/retorno e excluir atraso do usuário. |

Todo KPI também registra owner, descrição, numerador, denominador, exclusões, timezone, moeda, versão, SLA, `asOf` e teste de reconciliação. Tela alguma exibe número sem essa definição.

### 7.5 Permissões propostas

- `growth.read`: consulta agregada e drill-down conforme ABAC.
- `growth.export`: exportação com step-up, finalidade, watermark, limite e auditoria.
- `growth.opportunity.read`: leitura da recomendação derivada e do link autorizado; não concede escrita em nenhum domínio.

Dados pessoais ficam mascarados por padrão; conteúdo integral de chat, segredo, credencial, PAN/CVV, evidência privada e nota interna de outro domínio não entram no Growth.

## 8. Pipeline 2D→3D

Esta seção é **PROPOSTA**. Ela define comportamento e honestidade visual, não escolhe biblioteca, serviço de geração, storage, renderer ou runtime.

### 8.1 Classes de entrada

| Classe proposta | Entrada | Uso permitido | Limite obrigatório |
|---|---|---|---|
| `DRAFT_SINGLE_VIEW` | Um PNG ou SVG validado. | Briefing, tentativa inicial e preview interno. | É draft; o sistema não afirma geometria fiel nem publica automaticamente. |
| `MULTI_VIEW_CANDIDATE` | Duas ou mais vistas coerentes, identificadas por ângulo/lado. | Reconstrução potencialmente mais fiel e comparação entre vistas. | Maior evidência não significa aprovação; conflito entre vistas bloqueia o job/revisão. |
| `NATIVE_3D_CANDIDATE` | GLB fornecido com proveniência. | Validação, otimização e revisão direta. | Arquivo ainda exige licença, segurança, escala, materiais, performance e revisão humana. |

O conjunto versionado de `CatalogAsset` de origem registra item, arquivos, hashes, MIME real, dimensões, vistas, origem, licença, autor, data, qualidade e versão. Alterar qualquer fonte cria nova versão do conjunto, sem criar outro tipo de mídia ou catálogo.

### 8.2 Máquina proposta do job

~~~text
DRAFT → QUEUED → PROCESSING → REVIEW_REQUIRED → APPROVED
                     │               └──────────→ REJECTED
                     └──────────────────────────→ FAILED
QUEUED | PROCESSING ────────────────────────────→ CANCELLED
FAILED | REJECTED ── nova tentativa ───────────→ QUEUED
~~~

- `APPROVED` qualifica o `Model3DArtifact`; `PUBLISHED` pertence ao ponteiro ativo versionado no item de catálogo.
- Percentual só aparece quando o executor oferece progresso confiável; caso contrário, mostrar etapa e tempo decorrido.
- Cancelar não apaga input/output/log/auditoria. Retry nunca muda retroativamente a tentativa anterior.
- Aprovar/rejeitar exige `If-Match`/versão e pode exigir revisor diferente do criador/job owner.

### 8.3 Revisão e segurança

Antes de aprovação:

- validar MIME por conteúdo, malware, SVG ativo, referências externas, path traversal e limites de arquivo;
- processar conversão em sandbox sem credenciais do produto;
- validar estrutura GLB, buffers, materiais, texturas, dimensões, orientação, escala, polígonos, draw calls e orçamento móvel;
- comparar silhueta, cores e detalhes observáveis com todas as fontes;
- registrar ferramenta/versão/parâmetros, source hashes, output hash e reviewer;
- produzir poster 2D e texto alternativo para fallback;
- impedir publicação se licença/proveniência estiver pendente, fonte for conflitante ou validação falhar.

### 8.4 Contrato do viewer público

O viewer principal de `SCR-PUB-013`, acessado por `SCR-PUB-005/006`:

- carrega apenas o `Model3DArtifact` real em GLB, aprovado, publicado e vinculado à versão correta do item;
- mostra “Representação 3D” e proveniência/frescor quando relevante; não promete equivalência in-game;
- mantém um canvas e um item/variante ativos; oferece órbita, zoom, vistas, reset e fullscreen por controle direto, com teclado e alternativa textual/2D;
- pode fazer uma apresentação inicial única de 650–900 ms, limitada a 15° e interrompível; depois não usa auto-rotação, parallax ou depth fake, e `prefers-reduced-motion` vai direto à pose final;
- descarta integralmente o artefato anterior ao trocar de item/variante; preload adjacente, se existir, não cria outro canvas e respeita rede/memória;
- usa poster 2D em loading e fallback 2D em erro, WebGL indisponível ou budget excedido;
- nunca bloqueia título, preço, craft, proteção ou CTA por falha do modelo.

## 9. Wireframes textuais críticos

Os wireframes descrevem hierarquia e comportamento; não fixam direção de arte.

### WF-01 — Detalhe do anúncio (`SCR-PUB-006`)

~~~text
[Header: logo | busca | Market | Midas | conta]
[Breadcrumb: Market > item-base > anúncio]
┌──────────────────────── mídia/craft ────────────────────────┬──────── decisão ────────┐
│ mídia [Imagem 2D | 3D real aprovado] + fallback 2D         │ selo P2P ou MIDAS        │
│ item + variante + craft [slot 1..4 somente se aplicável]   │ preço fiduciário          │
│ gráfico/tabela [fonte | asOf | stale]                      │ gold: referência separada │
│ descrição e entrega permitida                              │ disponibilidade            │
│                                                             │ proteção + taxas + prazo   │
├──────────────────────── confiança ──────────────────────────┤ vendedor/reputação         │
│ políticas, denúncia e histórico permitido                  │ [Conversar] [Propor]       │
│                                                             │ [Comprar]                  │
└─────────────────────────────────────────────────────────────┴───────────────────────────┘
[Mobile: decisão após título; CTA sticky; gráfico vira tabela acessível sem perda]
~~~

O CTA recebe capability do servidor. `STALE` em preço mantém leitura; `STALE` em disponibilidade bloqueia compra e oferece “Atualizar oferta”.

### WF-02 — Checkout (`SCR-BUY-003`)

~~~text
[Voltar ao anúncio]  Checkout protegido  [contador informativo, nunca autoritativo]
┌─ Oferta congelada ───────────────┐ ┌─ Resumo financeiro ──────────────────────┐
│ item/craft/vendedor/canal        │ │ preço | comissão/taxa | total | moeda    │
│ policy version | entrega/prazo   │ │ PSP responsável | nenhum saldo em gold  │
└──────────────────────────────────┘ └──────────────────────────────────────────┘
[Gates: conta ✓ idade ? risco ✓ disponibilidade validando…]
[Aceite versionado] [Abrir checkout seguro do PSP]
[Estado: aguardando PSP | pago | expirando | quarentena | refund pendente]
[Ajuda contextual e correlationId]
~~~

Nenhum campo de PAN/CVV é renderizado pelo Midas. Em `STALE`, `ERROR` ou `PAYMENT_QUARANTINED`, o botão de pagamento/revelação fica indisponível.

### WF-03 — Wizard de anúncio (`SCR-SEL-004`)

~~~text
[Stepper: 1 item > 2 craft > 3 preço > 4 entrega/prova > 5 revisão]
┌─ formulário da etapa ───────────────────────┬─ prévia persistente ──────────────┐
│ catálogo canônico + capability              │ card como será publicado          │
│ craft? [não/sim] → slots limpos/mostrados   │ preço e gold visualmente separados│
│ mídia/proveniência + prova com expiração    │ alertas e pendências               │
│ instrução permitida; campo secreto ausente  │ [Salvar rascunho]                  │
└─────────────────────────────────────────────┴───────────────────────────────────┘
[Erros por campo] [Voltar] [Continuar] [Enviar revisão — capability]
~~~

Trocar craft de “sim” para “não” remove os quatro slots também no payload. Envio congela uma revisão; correção posterior cria outra.

### WF-04 — Entrega e disputa (`SCR-BUY-006/007`)

~~~text
[Pedido | pagamento confirmado | política congelada]
[Timeline: pago → entrega aberta → confirmações → hold/disputa]
┌─ Sala de entrega ───────────────────────────┬─ Ações ────────────────────────────┐
│ instrução/cofre permitido, consumo único    │ [Revelar] [Confirmar minha parte] │
│ mensagens transacionais e timestamps        │ [Reportar problema]               │
└─────────────────────────────────────────────┴───────────────────────────────────┘
[Disputa: prazo | alegações | evidências minhas/compartilháveis | submissão]
[Decisão/recurso/efeito financeiro em seções distintas]
~~~

Cada parte vê sua própria confirmação. A interface não marca “concluído” antes de ambas ou de decisão canônica.

### WF-05 — Suporte 360° (`SCR-ADM-009`)

~~~text
[Fila | filtros | SLA] [Ticket # | prioridade | owner | policy]
┌─ tickets ───────────┬─ thread e composer ─────────────┬─ contexto autorizado ──────┐
│ seleção persistida  │ e-mail + portal, mesma timeline│ conta [mascarada]           │
│ unread/aging/risk   │ anexos isolados/escaneados     │ pedido/pagamento/entrega    │
│                     │ [Responder] [Pedir informação] │ refund/disputa/payout        │
│                     │ [Resolver]                     │ auditoria [somente leitura] │
└─────────────────────┴─────────────────────────────────┴────────────────────────────┘
[Ações sensíveis aparecem por grant; correlationId em todas]
~~~

Se uma seção retornar `FORBIDDEN`, ela não revela título, contagem ou existência. Suporte sem grant financeiro pode encaminhar, não decidir ou executar refund.

### WF-06 — Financeiro e reembolso (`SCR-ADM-010/011/012/013`)

~~~text
[Tabs/filtros: conciliação | quarentena | refunds | holds | payouts]
┌─ fila ───────────────┬─ fato canônico ────────────────┬─ decisão/execução ──────────┐
│ aging, valor/moeda   │ PSP + Order + ledger + versões │ maker | checker | limite    │
│ risco, owner, SLA    │ eventos e tentativas           │ proposta != execução        │
│ divergência          │ asOf/freshness/correlation     │ [Propor] [Aprovar] [Retry]  │
└──────────────────────┴────────────────────────────────┴─────────────────────────────┘
[Impacto antes/depois | lançamentos compensatórios | audit trail imutável]
~~~

Estado externo desconhecido nunca vira sucesso. `STALE`, versão divergente ou mesmo ator maker/checker bloqueiam ação.

### WF-07 — Growth global e funil (`SCR-GRW-001/002`)

~~~text
[Filtros globais: período | timezone | moeda | canal | território | coorte]
[Coverage: 97% até 14:30 BRT | metric version v1 | STALE/READY]
┌─ KPIs com fórmula acessível ───────────────────────────────────────────────────┐
│ verificados | ativação | payment settled | entrega | disputa | refund | payout│
└────────────────────────────────────────────────────────────────────────────────┘
┌─ Funil comprador/vendedor ───────────┬─ bloqueios e próxima ação ──────────────┐
│ estágio | quantidade | conversão     │ blockerCode | afetados | tendência      │
│ clique preserva filtros              │ clique abre tenant/membro/interação     │
└───────────────────────────────────────┴─────────────────────────────────────────┘
[Coortes] [Tenants] [Membros] [Interações] [Oportunidades bloqueadas]
~~~

Tooltip sempre informa fórmula, janela, exclusões, fonte e `asOf`; não apenas um rótulo amigável.

### WF-08 — Growth tenant/membro/oportunidade (`SCR-GRW-004/006/009`)

~~~text
[Breadcrumb com filtros: Growth > estágio > tenant > membro]
┌─ identidade permitida ───────────────┬─ estágio derivado ──────────────────────┐
│ SellerAccount/UserMembership IDs     │ stage + version + entrou em            │
│ PII mascarada | escopo | owner       │ situação | bloqueio | próxima ação     │
└──────────────────────────────────────┴─────────────────────────────────────────┘
[Timeline allowlisted: cadastro | verificação | anúncio | pedido | ticket]
[Links para telas operacionais; nenhum payload bruto]
┌─ Opportunity ──────────────────────────────────────────────────────────────────┐
│ READ-ONLY: reasonCode + evidência + asOf + link ao objeto canônico autorizado │
└────────────────────────────────────────────────────────────────────────────────┘
~~~

### WF-09 — Job e revisão 3D (`SCR-ADM-015`)

~~~text
[Voltar ao catálogo] Job 3D # | estado | attempt | owner | versão
┌─ fontes imutáveis ────────┬─ viewer técnico ───────────────┬─ validação/revisão ───────┐
│ PNG/SVG/GLB, vistas        │ GLB real, wireframe/normais    │ escala | mesh | materiais │
│ hash, origem, licença      │ órbita/zoom/reset, sem autoplay│ textura | budget | avisos │
│ classe de fidelidade       │ poster/fallback 2D             │ comparação por vista      │
└────────────────────────────┴────────────────────────────────┴───────────────────────────┘
[Timeline: queued > processing > review | logs sanitizados | tentativas]
[Cancelar] [Reprocessar] [Rejeitar + motivo] [Aprovar saída — capability/version]
~~~

Uma fonte única recebe selo “Draft de vista única”. Múltiplas vistas ou GLB recebem classe de fonte mais alta, nunca selo automático de fidelidade. Como é tela staff, motion decorativo/React Bits é proibido; órbita/zoom são manipulação funcional.

### WF-10 — Inspeção 3D individual (`SCR-PUB-013`)

~~~text
[Voltar à origem]  Item/variante canônicos  [Compartilhar]
┌──────────────────────── um canvas / um artefato ──────────────────────────────┐
│ poster → intro única 650–900 ms → pose neutra → controle do usuário          │
│ primeira interação interrompe | reduced-motion pula | sem autoplay contínuo   │
│ [Frente] [Verso] [Lado] [Reset] [Fullscreen]                                 │
└────────────────────────────────────────────────────────────────────────────────┘
[Representação 3D + fonte/versão] [Galeria 2D] [Instruções de teclado]
[Selecionar outra arma/item → descartar anterior → carregar somente a nova]
~~~

O shell pode usar `FadeContent`/`AnimatedContent` após aprovação do React Bits; o canvas usa Three/R3F. O modelo não gira para sempre, a luz permanece neutra e a tela não duplica preço, oferta, craft ou disponibilidade.

## 10. Critérios de implementação e teste

### 10.1 Aceite transversal por template

Cada `SCR-ID` só entra em “pronto para construir” quando possuir:

1. owner de produto e ator primário;
2. rota e parâmetros canônicos;
3. fonte/read model com owner, SLA, `asOf` e classificação;
4. operações OpenAPI ou comando explícito por ação;
5. permissão atômica, escopo ABAC e fields policy;
6. estados `LOADING`, `EMPTY`, `ERROR`, `STALE`, `FORBIDDEN` e `READY`;
7. deep link e retorno com filtros preservados;
8. eventos de auditoria/produto allowlisted;
9. testes de teclado, viewport pequeno e meta WCAG 2.2 AA;
10. testes BOLA/BFLA, concorrência/idempotência e indisponibilidade compatíveis com o risco.

### 10.2 Testes P0 específicos do mapa

- Os 95 `SCR-ID` são únicos e nenhuma rota canônica aponta para dois templates incompatíveis.
- `FORBIDDEN` não revela existência, contagem, nome, valor ou seção protegida.
- Troca de `SellerAccount` invalida cache, seleção e capabilities do contexto anterior.
- Checkout não coleta PAN/CVV nem libera entrega por retorno do navegador.
- Settlement tardio nunca provoca dupla venda ou revelação.
- Refund aprovado não aparece como concluído antes do PSP/ledger.
- Maker não aprova a própria ação; versão concorrente retorna conflito.
- Lista e detalhe de workbench preservam filtros no deep link e revalidam autorização.
- Stale de disponibilidade/financeiro bloqueia mutação; stale analítico mostra `asOf`.
- Growth reconcilia global, funil e drill-down sob mesma versão, janela, timezone e moeda.
- Coorte não muda retroativamente sem nova versão explícita.
- Tenant/membro não atravessa escopo e não duplica `User`/`SellerAccount`/`SellerMembership`.
- Oportunidade permanece read-only e toda ação ocorre no objeto canônico reautorizado.
- Um PNG/SVG único permanece `DRAFT_SINGLE_VIEW`; nenhuma saída é publicada automaticamente.
- Múltiplas vistas ou GLB aumentam evidência, mas continuam sujeitos a validação, licença e revisão.
- O viewer público carrega GLB real aprovado ou fallback 2D; nenhum efeito 2D é rotulado como 3D.
- `SCR-PUB-013` mantém um canvas/artefato ativo; intro termina em 650–900 ms, o primeiro input interrompe e reduced motion pula à pose neutra.
- Trocar `slug`/variante aborta carregamento e descarta recursos do item anterior; deep link e Back preservam origem/filtros sem estado comercial duplicado.
- `SCR-ADM-015` preserva source/output hashes, tentativas e decisão do reviewer.
- Carrinho multivendedor cria grupos/pedidos independentes e não mistura settlement, cupom ou seller.
- Hold vence exatamente em `Payment.settledAt + 168h`, mas não libera antes de conclusão e dos demais gates.
- Resolução manual e baixa de saque exigem evidência/referência únicas e repetição não duplica settlement, journal ou payout.
- Nota zero permanece distinta de ausência; somente partes do pedido avaliam e nenhuma pessoa se autoavalia.
- Refund/chargeback gera contribuição compensatória em nível/ranking sem apagar o fato anterior.
- Plano Premium aplica a fórmula congelada e nunca altera mérito de refund, risco ou obrigação legal.
- Opt-out/supressão impede novo `Dispatch`; seller nunca recebe telefone/WhatsApp bruto do comprador.
- WhatsApp/Instagram ficam indisponíveis quando a capability/consentimento/template não sustenta a ação real.
- Cupom/link/afiliado só gera comissão sobre conversão reconciliada e reversão é rastreável.
- Studio inicia o mesmo `Listing` a partir do catálogo ou abre `CatalogSubmission`; não cria item paralelo.
- `robots.txt`, sitemap, canonical e indexabilidade derivam da mesma `CrawlPolicy` e excluem superfícies privadas.
- `M0` não recebe motion decorativo; `prefers-reduced-motion` mantém conteúdo e ações equivalentes em `M1/M2`.
- Teste/build futuro não assume React Bits instalado: adoção exige decisão de runtime e dependência explícita.

## 11. Bloqueios para congelar o mapa

| ID | Decisão faltante | Telas afetadas | Saída necessária |
|---|---|---|---|
| BLQ-01 | Autorização escrita do publisher, transferência e ativos/dados autorizados. | Todas as telas transacionais; especialmente `PUB-003`, `PUB-005/006`, `SEL-004` e checkout. | Gate G0/G1 aprovado e evidência versionada. |
| BLQ-02 | PSP, checkout, split/hold/payout, webhook, chargeback e escopo PCI. | `BUY-003`, `SEL-010..014`, `ADM-010..013`. | Contrato PSP, OpenAPI/webhooks e matriz maker-checker. |
| BLQ-03 | Política etária e provedor de age assurance. | `ACC-002/004`, onboarding e checkout. | Método, retenção, contestação, UX e contrato do provedor. |
| BLQ-04 | Fonte autoritativa/licenciada de catálogo, assets e preço. | Descoberta, item, anúncio, criação, catálogo e Midas. | IDs estáveis, licença, schema, SLA, cache e política de correção. |
| BLQ-05 | Catálogo OpenAPI/read models ainda em prosa. | Todos os templates com fonte remota. | `operationId`, schemas, erros, cursor, freshness e capabilities. |
| BLQ-08 | Finalidade, retenção, minimização e exportação Growth. | `GRW-001..009`. | Registro de finalidade, field policy, limiar de agregação e testes de privacidade. |
| BLQ-09 | Pipeline/renderização 3D, fornecedor, orçamento e direitos ainda não possuem implementação executável. | `PUB-005/006/013`, `ADM-003/015`. | Schemas/OpenAPI de `CatalogAsset` + `Model3DJob` + `Model3DArtifact`, benchmark do adapter, sandbox, storage/CDN, validator GLB, licença, budgets e leak test aprovados. |
| BLQ-10 | Contas Meta, opt-in, templates, remetentes, webhooks, limites e regras territoriais não homologados. | `SEL-015/016`, `ADM-017`, `MST-008`. | Business verification, capability matrix, contratos, finalidade LGPD, templates aprovados e teste real em conta de desenvolvimento. |
| BLQ-11 | Política comercial/fiscal/jurídica de afiliados, cupons, rewards e plano de anúncio ainda sem aprovação executiva. | `PUB-014/015`, `ACC-016`, `SEL-016`, `MST-006..008`. | Policy versions aprovadas, contabilização/tributação, antifraude, termos e matriz de autorização. |

## 12. Donos documentais

- O PRD define jornadas, atores, regras e RFs.
- Este mapa define templates, rotas, hierarquia visual, ações e estados de interface.
- A arquitetura define agregados, máquinas, sequências e read models.
- OpenAPI deverá ser a fonte de requests, responses e erros.
- O catálogo de eventos deverá ser a fonte de nomes, versões e payloads.
- Segurança/compliance define controles, classificação, retenção e gates.
- Backlog define ordem, aceite, evidência e responsável.

A matriz de implementação em `docs/12-MATRIZ-DE-IMPLEMENTACAO.md` relaciona, por tela e bloco de RF, os campos abaixo; OpenAPI, catálogo de eventos e testes deverão torná-la executável:

`SCR-ID → rota → ator → caso de uso/RF → permissão → operationId/comando → domínio/agregado → pré/pós-estado → evento → teste → épico/gate`.

Até essa matriz e os contratos existirem, este arquivo é um mapa implementável de UX e navegação, não evidência de implementação.
