# Requirements — Midas Marketplace

Versão: 1.0  
Status: **SDD_PRONTO_IMPLEMENTACAO_PENDENTE** (cobertura global; primeira fatia executável implementada)  
Owner: Produto + Engenharia  
Revisores requeridos: Segurança, Operações, Financeiro, Jurídico, Privacidade, Catálogo, Marketing e Design  
Última atualização: 23 de agosto de 2026  
Contratos relacionados: `docs/01-PRD-MIDAS.md`, `docs/02-UML-ARQUITETURA.md`, `docs/07-MAPA-DE-TELAS-E-FLUXOS.md`, `docs/08-ADRS-DECISOES-ARQUITETURAIS.md`, `docs/12-MATRIZ-DE-IMPLEMENTACAO.md`, `docs/20-BENCHMARK-COMPETIDORES-E-LAYOUTS.md`, `docs/21-SISTEMA-DE-LAYOUTS-E-TEMPLATES-UI.md`

## Introdução

Este SDD converte o blueprint documental do Midas Marketplace em critérios EARS implementáveis sem reproduzir os 300 requisitos do PRD. O [PRD](../../docs/01-PRD-MIDAS.md) continua sendo o owner do comportamento de produto; aqui cada requisito representa uma **capability contínua**, conserva a faixa canônica `RF-001–300` e define o envelope de aceite que uma implementação deverá provar.

O repositório não está mais em estado pré-código. A primeira fatia executável contém landing OCHPOCH MARKET com experiência 3D e fallback 2D, identidade/autenticação com verificação SMTP, tenant `SellerAccount` com membership `OWNER`, cockpit inicial com estados honestos, PostgreSQL, migrations, outbox/auditoria, serviços locais Podman e testes. Os critérios abaixo continuam sendo o contrato global: somente capacidades respaldadas por código, persistência, contrato e prova aplicável descrevem o runtime atual.

OCHPOCH MARKET é a marca apresentada à pessoa usuária; MIDAS permanece como codinome de arquitetura e namespace interno. Checkout, PSP, ledger, hold, saldo, payout/saque e operação financeira master ainda não integram esta fatia e não podem ser inferidos da presença das rotas visuais do cockpit. A especificação-fonte `MIDAS_SPEC_IMPLEMENTACAO_CODEX.md` foi analisada apenas como fonte histórica de `RF-181–202`; os contratos correntes e nomes canônicos deste repositório prevalecem.

### Regras de leitura

- Cada critério usa EARS em pt-BR: `QUANDO`, `SE`, `ENQUANTO` ou `ONDE` + `ENTÃO O SISTEMA DEVE`.
- A faixa indicada em **Rastreabilidade** aponta ao comportamento completo no PRD; este arquivo não o substitui.
- Nenhuma capability pode criar identidade, tenant, catálogo, pedido, saldo, estado ou integração paralelos.
- `User` autentica; `SellerAccount` é o tenant comercial; `SellerMembership` autoriza atuação naquele escopo.
- Read models e dashboards são derivados e reconstruíveis; comandos relêem a fonte canônica e revalidam versão, escopo e permissão.
- Integrações declaradas prontas precisam usar dependência local real ou sandbox/homologação oficial; resposta fixa ou sucesso simulado não satisfaz aceite.

---

### Requisito 1: Identidade, conta e dispositivo

**História de usuário:** Como pessoa usuária, quero uma identidade única com autenticação forte e dispositivos revogáveis, para comprar e atuar em seller accounts sem cadastros duplicados.

**Rastreabilidade:** `RF-001–010` · `SCR-ACC-001..008` · Identity / Device Trust

#### Critérios de aceite

1.1. QUANDO uma pessoa cadastrar, autenticar, recuperar acesso ou gerenciar uma sessão ENTÃO O SISTEMA DEVE operar sobre o mesmo `User` e os fatores canônicos definidos em `RF-001–010`, sem criar identidade separada para comprador e vendedor.
1.2. QUANDO um dispositivo, fator ou sessão mudar de confiança ENTÃO O SISTEMA DEVE aplicar step-up, validade, revogação e alerta conforme risco, preservando trilha auditável e resposta não enumerável.
1.3. SE a pessoa perder capacidade de vender ou sacar ENTÃO O SISTEMA DEVE restringir a mutação correspondente sem apagar o acesso legalmente devido a histórico, pedido, saldo, caso ou comprovante.

### Requisito 2: Catálogo e ativos canônicos

**História de usuário:** Como curador, quero um catálogo versionado e ativos com proveniência, para que anúncio, Studio, busca e histórico apontem à mesma fonte factual.

**Rastreabilidade:** `RF-011–018` · `SCR-PUB-005` · `SCR-ADM-003` · Catalog

#### Critérios de aceite

2.1. QUANDO staff autorizada criar, importar, revisar, versionar ou desativar um item ENTÃO O SISTEMA DEVE persistir a mudança em `CatalogItem`, `CatalogItemVersion` e `CatalogAsset`, com ID estável, licença, hash, origem e auditoria.
2.2. QUANDO uma superfície selecionar conteúdo de catálogo ENTÃO O SISTEMA DEVE retornar somente versões ativas e visíveis no escopo permitido, sem copiar o item para anúncio, tenant ou viewer.
2.3. SE um ativo não possuir direitos, integridade ou status aprovados ENTÃO O SISTEMA DEVE bloquear novas publicações e conservar referências históricas necessárias à auditoria e aos pedidos existentes.

### Requisito 3: Anúncios, craft e revisões

**História de usuário:** Como vendedor autorizado, quero criar uma oferta por revisão e prova, para publicar dados comerciais sem duplicar o item de catálogo.

**Rastreabilidade:** `RF-019–036` · `SCR-SEL-004..007` · Listings

#### Critérios de aceite

3.1. QUANDO uma `SellerMembership` autorizada iniciar ou retomar um anúncio ENTÃO O SISTEMA DEVE criar ou alterar apenas a revisão mutável de `Listing`, referenciando catálogo, craft, preço, entrega, mídia, plano e prova aplicáveis.
3.2. QUANDO uma alteração material for submetida ENTÃO O SISTEMA DEVE congelar uma nova `ListingRevision`, preservar o histórico e encaminhar a moderação canônica antes de publicação P2P.
3.3. SE item, craft, prova, disponibilidade ou capability forem incompatíveis ENTÃO O SISTEMA DEVE rejeitar a transição com problema tipado e recuperação acionável, sem publicar nem reservar a unidade.

### Requisito 4: Moderação de anúncios

**História de usuário:** Como revisor autorizado, quero uma fila com claim, checklist e decisão motivada, para moderar sem autoaprovação ou sobrescrita de histórico.

**Rastreabilidade:** `RF-037–043` · `SCR-ADM-002` · Moderation

#### Critérios de aceite

4.1. QUANDO uma revisão entrar na fila ENTÃO O SISTEMA DEVE apresentar risco, prioridade, SLA, prova e checklist sobre um snapshot imutável, com claim concorrente seguro.
4.2. QUANDO um revisor aprovar, rejeitar ou pedir correção ENTÃO O SISTEMA DEVE exigir grant, escopo, motivo e versão esperada, registrar a decisão e emitir o evento canônico correspondente.
4.3. SE criador e aprovador coincidirem onde houver segregação, ou se faltar step-up para override ENTÃO O SISTEMA DEVE falhar fechado e auditar a tentativa.

### Requisito 5: Descoberta, busca e recomendação

**História de usuário:** Como comprador, quero pesquisar ofertas disponíveis e entender sua ordenação, para escolher sem manipulação ou recomendação opaca.

**Rastreabilidade:** `RF-044–052` · `SCR-PUB-001..007` · Search / Recommendation

#### Critérios de aceite

5.1. QUANDO uma busca ou navegação ocorrer ENTÃO O SISTEMA DEVE consultar projeções derivadas de catálogo e anúncios publicados, com filtros, cursor, disponibilidade e canal explícitos.
5.2. QUANDO houver personalização ou boost comercial ENTÃO O SISTEMA DEVE explicar os principais sinais, rotular patrocínio e preservar segurança, relevância, diversidade e a ordenação escolhida.
5.3. SE a pessoa desligar personalização ou o índice estiver stale ENTÃO O SISTEMA DEVE respeitar a preferência e informar freshness/degradação sem inventar resultado, disponibilidade ou tendência.

### Requisito 6: Dados de mercado, preço e gráfico

**História de usuário:** Como comprador, quero preço e histórico com fonte e frescor, para diferenciar referência de mercado do valor real da oferta.

**Rastreabilidade:** `RF-053–062` · `SCR-PUB-004..006` · Market Data

#### Critérios de aceite

6.1. QUANDO preço, componente ou candle forem exibidos ENTÃO O SISTEMA DEVE informar fonte autorizada, moeda/unidade, `asOf`, qualidade e distinção entre referência em gold e preço fiduciário da oferta.
6.2. QUANDO o gráfico estiver disponível ENTÃO O SISTEMA DEVE fornecer alternativa textual/tabular equivalente, períodos sustentados pelos dados e navegação acessível.
6.3. SE a fonte estiver ausente, atrasada ou divergente ENTÃO O SISTEMA DEVE mostrar ausência/stale e acionar observabilidade, sem converter falta de dado em zero nem sobrescrever preço Midas.

### Requisito 7: Conversa, proposta e proteção anti-PII

**História de usuário:** Como participante de uma negociação, quero conversar e propor valores dentro da plataforma, para negociar sem vazamento de contato ou bypass do fluxo protegido.

**Rastreabilidade:** `RF-063–076` · `SCR-BUY-001..002` · Conversation / Trust

#### Critérios de aceite

7.1. QUANDO participantes autorizados enviarem mensagem ou proposta ENTÃO O SISTEMA DEVE validar participação, sequência, validade e política anti-PII antes da entrega.
7.2. SE conteúdo proibido, spam ou tentativa de evasão for detectado ENTÃO O SISTEMA DEVE bloquear a entrega, aplicar resposta proporcional e preservar evidência redigida para revisão/recurso.
7.3. QUANDO existir pagamento reconciliado e sala pós-pagamento elegível ENTÃO O SISTEMA DEVE aplicar a política de contato pós-compra sem revelar segredo antes do gate canônico.

### Requisito 8: Checkout, pedido e entrega

**História de usuário:** Como comprador e vendedor, quero reserva, pagamento e confirmações independentes, para concluir uma entrega sem dupla venda ou confirmação unilateral.

**Rastreabilidade:** `RF-077–090` · `SCR-BUY-003/006` · Orders / Delivery / Payments

#### Critérios de aceite

8.1. QUANDO checkout for iniciado ENTÃO O SISTEMA DEVE reservar a unidade atomicamente, congelar oferta/policies aplicáveis e criar `Order` e `Payment` idempotentes.
8.2. QUANDO o PSP confirmar e reconciliar o pagamento server-side ENTÃO O SISTEMA DEVE liberar somente a entrega autorizada e registrar confirmações independentes de comprador e vendedor.
8.3. SE houver expiração, divergência, ausência de confirmação ou disputa ENTÃO O SISTEMA DEVE preservar unicidade, bloquear conclusão incompatível e conduzir o fluxo de recuperação canônico.

### Requisito 9: Ledger, retenção e saque

**História de usuário:** Como vendedor, quero enxergar valores protegidos, em retenção e disponíveis e solicitar saque, para acompanhar obrigações financeiras sem um saldo paralelo.

**Rastreabilidade:** `RF-091–102` · `SCR-SEL-010..014` · Ledger / Payouts

#### Critérios de aceite

9.1. QUANDO um efeito financeiro ocorrer ENTÃO O SISTEMA DEVE registrá-lo em `JournalEntry` e `Posting` balanceados e append-only, derivando `BalanceLot`, `Hold` e saldo por moeda.
9.2. QUANDO um `Payment` reconciliado liquidar ENTÃO O SISTEMA DEVE usar `Payment.settledAt` como única âncora do prazo de 168 horas e exigir os demais gates antes de promover o lote a disponível.
9.3. QUANDO um saque for solicitado ENTÃO O SISTEMA DEVE criar `PayoutRequest` idempotente somente contra saldo disponível relido na operação, com step-up, destino mascarado e tentativas rastreáveis.
9.4. SE disputa, refund, chargeback, risco ou falha externa bloquear o valor ENTÃO O SISTEMA DEVE impedir liberação/saque e explicar o motivo permitido sem editar saldo diretamente.

### Requisito 10: Canal Compre do Midas

**História de usuário:** Como comprador, quero distinguir estoque próprio da plataforma de ofertas P2P, para entender vendedor, preço e responsabilidade comercial.

**Rastreabilidade:** `RF-103–109` · `SCR-PUB-003` · `SCR-ADM-014` · Midas Inventory

#### Critérios de aceite

10.1. QUANDO estoque próprio for publicado ENTÃO O SISTEMA DEVE rotulá-lo como vendido pelo Midas e manter preço, estoque, receita e margem separados do canal P2P.
10.2. QUANDO busca ou detalhe misturar canais ENTÃO O SISTEMA DEVE preservar origem, políticas, vendedor e disponibilidade inequívocos em cada resultado.
10.3. SE a fonte canônica de estoque/preço Midas estiver indisponível ENTÃO O SISTEMA DEVE suspender a ação incompatível sem inventar disponibilidade ou preço.

### Requisito 11: Tickets e mailbox

**História de usuário:** Como usuário e atendente, quero abrir e acompanhar suporte contextual em portal e e-mail, para resolver casos numa única thread protegida.

**Rastreabilidade:** `RF-110–120` · `SCR-BUY-008..009` · `SCR-ADM-009` · Support / Mailbox

#### Critérios de aceite

11.1. QUANDO um ticket ou mensagem for criado ENTÃO O SISTEMA DEVE usar `Ticket` e `TicketMessage` canônicos, taxonomia, SLA, fila, thread e anexos autorizados.
11.2. QUANDO e-mail inbound/outbound participar do atendimento ENTÃO O SISTEMA DEVE correlacionar provider/thread, evitar duplicação e refletir a conversa autorizada no portal.
11.3. SE houver anexo inseguro, segredo, bounce ou remetente não autorizado ENTÃO O SISTEMA DEVE quarentenar ou degradar com motivo seguro, preservando alternativa de atendimento.

### Requisito 12: Master, IAM, configuração e auditoria

**História de usuário:** Como Master, quero delegar capacidades e governar mudanças sensíveis, para operar com menor privilégio, segregação e reversibilidade.

**Rastreabilidade:** `RF-121–132` · `SCR-ADM-*` · `SCR-MST-001..005` · Administration / IAM / Audit

#### Critérios de aceite

12.1. QUANDO um papel, grant ou configuração for criado ou alterado ENTÃO O SISTEMA DEVE explicitar escopo, validade, versão, impacto, aprovadores e rollback aplicável.
12.2. QUANDO uma ação sensível for executada ENTÃO O SISTEMA DEVE revalidar autorização contextual, step-up e segregação, gravando auditoria append-only com dados redigidos.
12.3. SE um ator tentar conceder privilégio que não possui, editar ledger/auditoria ou ultrapassar finalidade/escopo ENTÃO O SISTEMA DEVE falhar fechado e registrar a tentativa.

### Requisito 13: Notificações e analytics base

**História de usuário:** Como usuário e operador, quero notificações acionáveis e métricas minimizadas, para acompanhar eventos sem expor conteúdo sensível.

**Rastreabilidade:** `RF-133–138` · `SCR-ACC-014` · Notifications / Analytics Intake

#### Critérios de aceite

13.1. QUANDO um evento notificável ocorrer ENTÃO O SISTEMA DEVE produzir comunicação idempotente com contexto permitido, prioridade e link ao objeto canônico.
13.2. QUANDO analytics receber interação ou fato de domínio ENTÃO O SISTEMA DEVE validar schema/version, finalidade, correlação e minimização, separando P2P de Midas.
13.3. SE a preferência desativar canal não crítico ENTÃO O SISTEMA DEVE respeitá-la; SE o alerta for obrigatório de segurança ou transação ENTÃO O SISTEMA DEVE preservar ao menos o canal exigido pela policy.

### Requisito 14: Disputa, evidência e recurso

**História de usuário:** Como parte de um pedido, quero contestar uma divergência e recorrer de decisão, para ter devido processo com efeitos financeiros controlados.

**Rastreabilidade:** `RF-139–148` · `SCR-BUY-007` · `SCR-ADM-008` · Disputes

#### Critérios de aceite

14.1. QUANDO uma disputa elegível for aberta ENTÃO O SISTEMA DEVE vinculá-la ao `Order`, congelar ações incompatíveis e preservar snapshots/policies/evidências com cadeia de custódia.
14.2. QUANDO staff decidir ou uma parte recorrer ENTÃO O SISTEMA DEVE exigir grant, ausência de conflito, motivo, versão, janela e comandos financeiros idempotentes separados da decisão.
14.3. SE houver duplicidade, prazo vencido, evidência insegura ou acesso sem finalidade ENTÃO O SISTEMA DEVE bloquear a operação sem apagar histórico nem revelar informação de outra parte.

### Requisito 15: Seller, posse e capacidades

**História de usuário:** Como operador comercial, quero um `SellerAccount` elegível com members e prova de disponibilidade, para vender no escopo correto sem duplicar meu `User`.

**Rastreabilidade:** `RF-149–157` · `SCR-SEL-001/003/007` · Seller / Listings

#### Critérios de aceite

15.1. QUANDO uma pessoa iniciar onboarding de vendedor ENTÃO O SISTEMA DEVE criar/atualizar `SellerAccount`, `SellerMembership` e `SellerOnboardingCase`, usando sessão tokenizada do provedor quando aplicável.
15.2. QUANDO anúncio, recebimento ou saque for tentado ENTÃO O SISTEMA DEVE revalidar elegibilidade, território, capacidade, destino e prova de posse/disponibilidade vigentes.
15.3. SE um gate vencer ou a unidade deixar de estar disponível ENTÃO O SISTEMA DEVE bloquear novas mutações e acionar recuperação/caso operacional sem apagar obrigações e históricos existentes.

### Requisito 16: Idade, privacidade e preferências

**História de usuário:** Como titular de dados, quero controles proporcionais de idade, consentimento e direitos, para usar a plataforma com tratamento transparente e minimizado.

**Rastreabilidade:** `RF-158–166` · `SCR-ACC-004/010..012` · Identity / Privacy

#### Critérios de aceite

16.1. QUANDO uma política exigir age assurance ENTÃO O SISTEMA DEVE obter apenas o resultado mínimo necessário, aplicar defaults protetivos e permitir contestação conforme base aprovada.
16.2. QUANDO o titular exercer acesso, correção, exportação, oposição ou eliminação ENTÃO O SISTEMA DEVE criar protocolo autenticado, aplicar prazo/retenção/legal hold e entregar resposta segura e justificável.
16.3. QUANDO consentimento ou personalização forem revogados ENTÃO O SISTEMA DEVE cessar novos usos incompatíveis e propagar a preferência dentro do SLA, mantendo somente obrigação segregada e informada.

### Requisito 17: Segurança do inbound de e-mail

**História de usuário:** Como participante de ticket, quero que somente mensagens autênticas entrem na conversa, para evitar sequestro de thread e anexos maliciosos.

**Rastreabilidade:** `RF-167–169` · `SCR-BUY-008..009` · Mailbox Security

#### Critérios de aceite

17.1. QUANDO um webhook inbound chegar ENTÃO O SISTEMA DEVE validar assinatura, timestamp, provider message ID, thread opaca, remetente e anti-replay antes da persistência.
17.2. SE assinatura, token, remetente ou anexo forem inválidos ENTÃO O SISTEMA DEVE impedir a entrada na conversa e criar quarentena/caso com motivo auditado.
17.3. QUANDO uma mensagem válida for aceita ENTÃO O SISTEMA DEVE deduplicá-la e vinculá-la ao `Ticket` existente sem expor segredo em logs ou analytics.

### Requisito 18: Acessibilidade pública, políticas e fiscal

**História de usuário:** Como cliente e responsável operacional, quero políticas conserváveis e relatórios financeiros segregados, para compreender a contratação e prestar contas por território.

**Rastreabilidade:** `RF-170–175` · `SCR-PUB-011..012` · `SCR-ADM-011` · Policy / Finance Reporting

#### Critérios de aceite

18.1. QUANDO conteúdo público, gráfico, checkout ou pedido for apresentado ENTÃO O SISTEMA DEVE oferecer informação acessível, versão vigente, fonte e comprovante conservável das policies aplicáveis.
18.2. QUANDO relatório financeiro ou documento fiscal for produzido ENTÃO O SISTEMA DEVE separar principal de terceiros, comissão, taxas, refunds, chargebacks, reservas, tributos e moedas conforme definição competente.
18.3. SE papel comercial, obrigação fiscal, licença ou adapter autorizado ainda não estiver definido ENTÃO O SISTEMA DEVE bloquear a função dependente com explicação, sem inventar documento, cálculo ou obrigação.

### Requisito 19: Pagamento tardio e expiração segura

**História de usuário:** Como comprador, vendedor e operador, quero que settlement tardio seja reconciliado sem dupla venda, para receber continuidade ou refund correto.

**Rastreabilidade:** `RF-176–180` · `SCR-ADM-012` · Payments / Orders

#### Critérios de aceite

19.1. QUANDO reserva ou intent expirar ENTÃO O SISTEMA DEVE aguardar o estado canônico do PSP antes de liberar a unidade ou encaminhá-la à exceção controlada.
19.2. QUANDO sucesso chegar após o TTL ENTÃO O SISTEMA DEVE colocar o `Payment` em quarentena operacional, reconciliar a mesma unidade e executar reassunção ou refund idempotente sem revelar entrega antecipadamente.
19.3. SE expiração, cancelamento e webhook concorrerem ENTÃO O SISTEMA DEVE preservar um pedido pago por unidade e um único efeito financeiro, registrando a corrida e o desfecho.

### Requisito 20: Minha Conta e capabilities

**História de usuário:** Como usuário autenticado, quero uma visão geral contextual, para navegar somente às capacidades que realmente possuo.

**Rastreabilidade:** `RF-181–183` · `SCR-ACC-005` · Account Overview BFF

#### Critérios de aceite

20.1. QUANDO `/conta` for aberto ENTÃO O SISTEMA DEVE derivar cards e atalhos de `User`, `SellerAccount`, `SellerMembership`, grants, gates e read models canônicos, com `asOf`/freshness quando aplicável.
20.2. QUANDO uma capability mudar ENTÃO O SISTEMA DEVE adaptar a navegação sem criar cadastro, saldo, pedido, ticket ou estado paralelo.
20.3. SE o cliente manipular rota ou identificador ENTÃO O SISTEMA DEVE revalidar propriedade/escopo no servidor e negar de forma não enumerável quando necessário.

### Requisito 21: Compras e pós-compra

**História de usuário:** Como comprador, quero listar compras, abrir timeline e acessar casos relacionados, para acompanhar o pedido pela fonte real.

**Rastreabilidade:** `RF-184–188` · `SCR-BUY-004..007` · Orders Read Side

#### Critérios de aceite

21.1. QUANDO a pessoa consultar compras ENTÃO O SISTEMA DEVE retornar somente `Order` em que ela é compradora, com cursor, filtros e valores monetários tipados.
21.2. QUANDO o detalhe for aberto ENTÃO O SISTEMA DEVE compor snapshot e timeline a partir de eventos reais de `Order`, `Payment`, entrega, `RefundRequest`, ticket e disputa, preservando IDs e origem.
21.3. QUANDO uma ação contextual estiver elegível ENTÃO O SISTEMA DEVE encaminhar ao comando do domínio proprietário e revalidar estado/permissão; SE não estiver, ENTÃO O SISTEMA DEVE explicar a indisponibilidade sem inventar transição.

### Requisito 22: Vendas, Saldo de vendas e saques

**História de usuário:** Como membro autorizado do vendedor, quero métricas, vendas, retenções e saques do meu tenant, para operar sem cálculo financeiro no navegador.

**Rastreabilidade:** `RF-189–194` · `SCR-SEL-002/008..014` · Seller Read Side / Ledger

#### Critérios de aceite

22.1. QUANDO uma `SellerMembership` consultar vendas ENTÃO O SISTEMA DEVE escopar por `sellerAccountId`, paginar pedidos e derivar métricas com moeda, período e freshness explícitos.
22.2. QUANDO Saldo de vendas ou retenção forem apresentados ENTÃO O SISTEMA DEVE refletir ledger/PSP reconciliados e mostrar composição/gates sem persistir cópia mutável de saldo.
22.3. QUANDO saque for solicitado ou acompanhado ENTÃO O SISTEMA DEVE usar `PayoutRequest`, `PayoutAttempt` e seus estados canônicos, idempotência, step-up e destino mascarado.

### Requisito 23: Suporte contextual, RefundRequest e visão 360°

**História de usuário:** Como comprador ou staff autorizada, quero suporte, solicitação de reembolso e contexto relacionado, para resolver o caso sem transformar ticket em refund ou disputa.

**Rastreabilidade:** `RF-195–202` · `SCR-BUY-008..011` · `SCR-ADM-009..011` · Support / Refund / Admin BFF

#### Critérios de aceite

23.1. QUANDO suporte for aberto a partir de pedido, venda, retenção, payout, `RefundRequest` ou disputa ENTÃO O SISTEMA DEVE criar vínculo relacional autorizado no `Ticket`, sem copiar PII ou estado integral no texto livre.
23.2. QUANDO comprador elegível criar `RefundRequest` ENTÃO O SISTEMA DEVE validar propriedade, janela, moeda, montante reembolsável, equivalência ativa e idempotência em transação.
23.3. QUANDO staff decidir ou executar reembolso ENTÃO O SISTEMA DEVE separar decisão, `RefundAttempt`, PSP, ledger, maker-checker e retry, sem update manual de saldo ou duplicação de efeito.
23.4. QUANDO a visão 360° for consultada ENTÃO O SISTEMA DEVE filtrar seções, campos e ações por grant, escopo e finalidade; SE houver controvérsia ENTÃO O SISTEMA DEVE vincular o fluxo formal de `Dispute` sem converter o ticket.

### Requisito 24: Growth multi-tenant

**História de usuário:** Como operador de Growth, quero navegar da plataforma ao tenant, membership e objeto real, para analisar estágio e próxima ação sem um CRM paralelo.

**Rastreabilidade:** `RF-203–211` · `SCR-GRW-001..009` · Growth Read Side

#### Critérios de aceite

24.1. QUANDO uma métrica, funil ou coorte for consultado ENTÃO O SISTEMA DEVE usar definição versionada, unidade, fórmula, fonte, moeda, janela, owner e freshness explícitos.
24.2. QUANDO houver drill-down ENTÃO O SISTEMA DEVE preservar a hierarquia Platform → `SellerAccount` → `SellerMembership`/`User` → objeto canônico e aplicar isolamento server-side.
24.3. QUANDO um evento for reprocessado ENTÃO O SISTEMA DEVE deduplicar contribuição por evento/projetor/métrica e produzir projeção reconstruível.
24.4. SE não houver dado ou instrumento suficiente ENTÃO O SISTEMA DEVE retornar `UNKNOWN`, `NOT_INSTRUMENTED` ou estado de qualidade equivalente, nunca zero, sucesso ou oportunidade inventados.

### Requisito 25: Pipeline e aprovação 3D

**História de usuário:** Como curador, quero importar ou gerar um candidato 3D e revisá-lo, para publicar somente artefato seguro, rastreável e fiel ao nível de evidência.

**Rastreabilidade:** `RF-212–220` · `SCR-ADM-003/015` · 3D Assets

#### Critérios de aceite

25.1. QUANDO PNG, SVG, multi-view ou GLB entrar no pipeline ENTÃO O SISTEMA DEVE criar `Model3DJob` ligado aos `CatalogAsset` de origem, classificar fidelidade e executar sanitização/quarentena antes do processamento.
25.2. QUANDO o worker produzir uma saída ENTÃO O SISTEMA DEVE validar glTF, egress, malha, materiais, texturas, budgets, hash e proveniência antes de criar `Model3DArtifact` imutável.
25.3. QUANDO staff revisar o artefato ENTÃO O SISTEMA DEVE comparar fontes/renders, registrar decisão motivada e alterar apenas o ponteiro ativo do `CatalogItem`; uma única vista nunca pode ser rotulada como reconstrução exata.
25.4. SE geração, validação, licença ou revisão falhar ENTÃO O SISTEMA DEVE preservar fallback 2D e quarentena, sem publicar artefato nem bloquear ações não dependentes de 3D.

### Requisito 26: Inspeção 3D individual

**História de usuário:** Como comprador, quero abrir uma tela 3D por item e assumir o controle após uma introdução curta, para inspecionar sem perder contexto ou acessibilidade.

**Rastreabilidade:** `RF-221–224` · `SCR-PUB-013` · Public Web / 3D Assets

#### Critérios de aceite

26.1. QUANDO um item com `Model3DArtifact` ativo for selecionado ENTÃO O SISTEMA DEVE abrir `/itens/:slug/3d`, resolver exatamente um artefato e manter um único canvas/renderer ativo.
26.2. QUANDO a rota montar ENTÃO O SISTEMA DEVE mostrar poster primeiro, executar no máximo uma intro de 650–900 ms e entregar rotação, zoom, vistas, reset e fullscreen; primeiro input interrompe a intro.
26.3. QUANDO reduced motion, WebGL indisponível, context loss, troca de item ou saída ocorrer ENTÃO O SISTEMA DEVE preservar alternativa 2D/DOM e liberar fetch, geometria, materiais, texturas, controles e listeners obsoletos.

### Requisito 27: Confirmação de pagamento, resolução manual e payout operacional

**História de usuário:** Como operação financeira, quero reconciliar pagamentos e dar baixa comprovável em saques, para corrigir exceções sem editar status ou saldo.

**Rastreabilidade:** `RF-225–229` · `SCR-ADM-012/013` · Payments / Ledger / Payouts

#### Critérios de aceite

27.1. QUANDO um provider notificar ou for consultado ENTÃO O SISTEMA DEVE autenticar, deduplicar e reconciliar `PaymentAttempt` por valor, moeda, conta, pedido e estado antes de liquidar `Payment`.
27.2. QUANDO houver divergência de confirmação ENTÃO O SISTEMA DEVE criar `PaymentResolutionCase` e permitir decisão somente a Master/delegado com grant, step-up, evidência e controle concorrente.
27.3. QUANDO uma resolução for favorável ENTÃO O SISTEMA DEVE executar o mesmo settlement idempotente da confirmação automática, preservando unicidade da unidade e o hold ancorado em `Payment.settledAt`.
27.4. QUANDO um payout manual for concluído ENTÃO O SISTEMA DEVE exigir allocation/reserva, `PayoutAttempt`, `PayoutEvidence`, referência externa, journal, confirmação conforme provider e segregação; SE faltar prova ou saldo reservado, ENTÃO O SISTEMA DEVE rejeitar a baixa.

### Requisito 28: Avaliação e reputação

**História de usuário:** Como participante de uma compra concluída, quero avaliar a contraparte de 0 a 5 e consultar confiança explicável, para construir histórico sem manipulação.

**Rastreabilidade:** `RF-230–236` · `SCR-ACC-015` · `SCR-ADM-016` · Reputation

#### Critérios de aceite

28.1. QUANDO `Order` elegível for concluído ENTÃO O SISTEMA DEVE permitir uma `OrderReview` por papel avaliador, aceitar nota zero como valor e impedir self-review ou duplicidade ativa.
28.2. QUANDO uma avaliação for editada, respondida, denunciada ou moderada ENTÃO O SISTEMA DEVE preservar versões, decisão, recurso e distinção entre conteúdo textual e elegibilidade da nota.
28.3. QUANDO reputação for exibida ENTÃO O SISTEMA DEVE usar `ReputationProjection` reconstruível por papel, amostra, fatores, cobertura e `asOf`; SE a amostra for insuficiente, ENTÃO O SISTEMA DEVE informar isso sem selo de confiança inventado.

### Requisito 29: Níveis, recompensas, badges e leaderboard

**História de usuário:** Como vendedor e Master, quero progressão determinística e temporadas auditáveis, para conceder benefícios sem editar pontos ou contratos passados.

**Rastreabilidade:** `RF-237–247` · `SCR-PUB-014/015` · `SCR-ACC-016` · `SCR-MST-006` · Progression / Leaderboard

#### Critérios de aceite

29.1. QUANDO venda se tornar madura e elegível ENTÃO O SISTEMA DEVE criar contribuição em centavos BRL com origem/FX e derivar `AccountLevelAssignment`; refund, chargeback ou fraude devem gerar contribuição compensatória.
29.2. QUANDO Master publicar nível, recompensa ou insígnia ENTÃO O SISTEMA DEVE versionar `AccountLevelDefinition`, `RewardDefinition` ou `BadgeDefinition` e conceder awards idempotentes com origem e fulfillment próprios.
29.3. QUANDO uma temporada mensal calcular ou fechar ENTÃO O SISTEMA DEVE usar `LeaderboardSeason`, `LeaderboardContribution`, `LeaderboardProjection` e `LeaderboardAward`, fórmula/desempate congelados e top 3 imutável após encerramento.
29.4. SE abuso ou inconsistência for detectado ENTÃO O SISTEMA DEVE congelar contribuição/premiação com motivo e recurso, sem alterar total por update manual.

### Requisito 30: Planos comerciais do anúncio

**História de usuário:** Como vendedor, quero escolher Básico, VIP ou Premium com efeito transparente, para decidir taxa e prioridade sem comprar decisão favorável.

**Rastreabilidade:** `RF-248–255` · `SCR-SEL-004/006` · `SCR-MST-007` · Listing Commercial Policy

#### Critérios de aceite

30.1. QUANDO plano for escolhido ou publicado ENTÃO O SISTEMA DEVE aplicar a policy versionada de 7,5%, 10% ou 12% e congelá-la em `ListingCommercialSnapshot` no anúncio/pedido.
30.2. QUANDO boost, prioridade de fila, bônus Premium ou badge forem aplicados ENTÃO O SISTEMA DEVE rotular o efeito e preservar relevância, direito material, risco, KYC, hold, segregação e mérito de decisão.
30.3. QUANDO Master alterar uma policy ENTÃO O SISTEMA DEVE simular impacto, exigir aprovação e vigência e afetar somente novos snapshots; SE houver contrato histórico, ENTÃO O SISTEMA DEVE preservá-lo.

### Requisito 31: Carrinho, lifecycle e pós-venda

**História de usuário:** Como comprador e vendedor, quero carrinho multivendedor e oportunidades de recompra explicáveis, para retomar ou complementar compras sem contato indevido.

**Rastreabilidade:** `RF-256–267` · `SCR-BUY-012` · `SCR-SEL-015` · Cart / Catalog Lifecycle / Customer Insights

#### Critérios de aceite

31.1. QUANDO linhas entrarem no `Cart` ENTÃO O SISTEMA DEVE persistir intenção e revalidar anúncio, preço, moeda, seller, quantidade e disponibilidade antes de criar `CheckoutGroup` e `Order` por grupo compatível.
31.2. QUANDO abandono for detectado ENTÃO O SISTEMA DEVE derivá-lo por janela e eventos canônicos, cancelá-lo por atividade/conversão/indisponibilidade/opt-out e nunca tratá-lo como autorização de contato.
31.3. QUANDO recompra, renovação ou cross-sell forem avaliados ENTÃO O SISTEMA DEVE combinar `ProductLifecyclePolicy`, `ReturnPolicySnapshot`, `CatalogItemRelation`, disponibilidade e consentimento sem pré-adicionar produto.
31.4. QUANDO seller consultar clientes ENTÃO O SISTEMA DEVE entregar `SellerCustomerInsight` minimizado e escopado ao próprio `SellerAccount`; SE não houver base, ENTÃO O SISTEMA DEVE retornar `INSUFFICIENT_DATA`.

### Requisito 32: Marketing omnichannel, cupom, afiliado e atribuição

**História de usuário:** Como seller autorizado, quero criar jornadas e campanhas consentidas, para reengajar clientes e medir conversão sem exportar PII ou atribuir venda por pixel.

**Rastreabilidade:** `RF-268–282` · `SCR-SEL-016` · `SCR-ADM-017` · `SCR-MST-008` · Customer Engagement / Promotions / Attribution

#### Critérios de aceite

32.1. QUANDO uma campanha ou jornada for publicada ENTÃO O SISTEMA DEVE congelar `CampaignVersion`, `JourneyVersion`, audiência, template, `CreativeAsset`, canais, janela e policies aprovadas.
32.2. QUANDO um envio for elegível ENTÃO O SISTEMA DEVE consultar `ConsentRecord` e `SuppressionEntry` no instante do `Dispatch`, persistir `DeliveryAttempt` e usar somente adapter/capability oficial do canal.
32.3. SE houver opt-out, quiet hours, frequency cap, disputa, conversão ou canal não contratado ENTÃO O SISTEMA DEVE suprimir/cancelar a tentativa incompatível sem fallback não consentido.
32.4. QUANDO cupom, afiliado ou touch participarem da jornada ENTÃO O SISTEMA DEVE manter `CouponRedemption`, `AttributionTouch`, `AttributionSnapshot` e `AffiliateCommission` separados, idempotentes e reconciliados a `Payment`/`Order` antes de creditar conversão ou comissão.

### Requisito 33: Studio e catálogo compartilhado 2D/3D

**História de usuário:** Como staff e seller, quero uma biblioteca compartilhada para selecionar item ou propor mídia, para criar anúncio pré-preenchido sem catálogo paralelo.

**Rastreabilidade:** `RF-283–292` · `SCR-SEL-017` · `SCR-ADM-018` · Catalog Studio / Assets

#### Critérios de aceite

33.1. QUANDO staff cadastrar item, asset ou modelo no Studio ENTÃO O SISTEMA DEVE reutilizar `CatalogItem`, `CatalogAsset`, `Model3DJob` e `Model3DArtifact`, aplicando visibilidade, território, licença, versão e status no servidor.
33.2. QUANDO seller escolher item publicado ENTÃO O SISTEMA DEVE criar o mesmo `Listing` com `ListingRevision` em `DRAFT` por referências e preencher dados canônicos, solicitando apenas overlay comercial, entrega, instruções e evidência permitidos.
33.3. QUANDO seller propuser item, asset 2D, multi-view ou GLB ENTÃO O SISTEMA DEVE criar `CatalogSubmission` tipada em quarentena para dedupe, direitos, scan e decisão staff; preview não equivale a publicação.
33.4. QUANDO relação ou lifecycle for curado ENTÃO O SISTEMA DEVE versionar `CatalogItemRelation`/policy e mostrar o impacto explicável sem transformar relação em estoque, bundle ou compatibilidade automática.

### Requisito 34: SEO, localização e mercados

**História de usuário:** Como visitante e operador global, quero páginas públicas indexáveis e mercados governados, para encontrar conteúdo verdadeiro e transacionar apenas onde houver capability.

**Rastreabilidade:** `RF-293–300` · `SCR-PUB-*` · `SCR-MST-003/004` · Public Content / Market Policy / SEO

#### Critérios de aceite

34.1. QUANDO uma página pública elegível for renderizada ENTÃO O SISTEMA DEVE entregar HTML essencial, canonical, hreflang, metadata e JSON-LD coerentes com catálogo, anúncio, seller, preço, disponibilidade e `ReputationProjection` visíveis.
34.2. QUANDO `robots.txt`, sitemap, redirect ou status forem gerados ENTÃO O SISTEMA DEVE derivá-los de `CrawlPolicy` e estado publicado, excluir workbenches privados e preservar controles reais de acesso.
34.3. QUANDO locale, timezone, território ou moeda mudarem ENTÃO O SISTEMA DEVE manter os conceitos separados e resolver `MarketPolicy`, provider, KYC/KYB, produto e documento por capability versionada.
34.4. SE mercado, PSP, moeda, licença ou policy não forem suportados ENTÃO O SISTEMA DEVE falhar fechado com explicação, sem conversão, fallback ou disponibilidade fictícios.

### Requisito 35: Qualidades transversais e prova de entrega

**História de usuário:** Como responsável pelo produto, quero segurança, consistência, acessibilidade e observabilidade verificáveis, para que “pronto” signifique comportamento real e reproduzível.

**Rastreabilidade:** `RNF-001–050` · ADR-001..019 · todas as capabilities

#### Critérios de aceite

35.1. QUANDO uma leitura privada ou mutação ocorrer ENTÃO O SISTEMA DEVE autorizar no servidor por objeto, campo, `User`, `SellerAccount`, `SellerMembership`, grant, finalidade e estado atual.
35.2. QUANDO uma mutação crítica escrever fato e evento ENTÃO O SISTEMA DEVE usar transação, constraints/locks, outbox/inbox, idempotência e dinheiro em unidade mínima por moeda.
35.3. QUANDO integração, worker ou fila falhar ENTÃO O SISTEMA DEVE aplicar timeout, retry limitado com jitter, circuit breaker/DLQ, correlação e reconciliação, sem promover cache ou provider a fonte de verdade.
35.4. QUANDO uma projeção, cache, dashboard ou exportação for lida ENTÃO O SISTEMA DEVE informar escopo, definição, `asOf`, freshness e qualidade, sendo reconstruível e incapaz de autorizar comando.
35.5. QUANDO uma superfície visual for entregue ENTÃO O SISTEMA DEVE atingir WCAG 2.2 AA, teclado, foco, reduced motion, estados de loading/empty/error/stale e alternativa sem depender apenas de cor, JavaScript ou WebGL quando aplicável.
35.6. QUANDO dado pessoal, segredo, evidência ou ativo for processado ENTÃO O SISTEMA DEVE aplicar classificação, minimização, criptografia, redaction, retenção, legal hold, scan e acesso por finalidade.
35.7. QUANDO uma capacidade for declarada pronta ENTÃO O SISTEMA DEVE apresentar contrato versionado, migration, teste unitário/integrado/autorização/E2E aplicável, evidência de sandbox ou dependência real, observabilidade e rollback; handler fixo, timer de sucesso ou função simulada não satisfazem o critério.
35.8. SE qualquer gate jurídico, financeiro, de direitos, segurança ou operação necessário estiver pendente ENTÃO O SISTEMA DEVE manter a função dependente bloqueada e registrar owner, evidência exigida e próxima decisão, sem afirmar disponibilidade operacional.

## Critério global de aceite do SDD

Uma implementação só poderá alterar o status global deste SDD quando a matriz automatizada demonstrar cobertura contínua de `RF-001–300` e `RNF-001–050` por requisito, domínio, contrato, tela, estado/evento, permissão, teste e owner; os gates G0–G8 aplicáveis precisam ter evidência real. Até lá, o estado permanece **SDD_PRONTO_IMPLEMENTACAO_PENDENTE**, ainda que cortes verticais individuais já possam estar implementados e comprovados.
