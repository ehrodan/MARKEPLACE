# PRD — Midas Marketplace

Versão 3.1 · Baseline de produto com implementação em andamento · 23 de agosto de 2026

> **Limite deste documento:** Produto e Engenharia. Autorizações, enquadramento jurídico e decisões fiscais são premissas externas fornecidas pelo dono do projeto e centralizadas no documento próprio; aqui elas entram apenas como parâmetros de capacidade. O repositório não contém aplicação executável, portanto “existente” neste PRD significa **capacidade já especificada**, não código validado.

## 1. Legenda de rastreabilidade

- **[C] Confirmado:** pedido explícito do usuário.
- **[R] Recomendado:** decisão proposta para segurança, coerência ou qualidade.
- **[D] Dependência:** fornecedor, licença, contrato ou validação externa.
- **[Q] Questão:** decisão de negócio que permanece aberta.

## 2. Visão

Midas é o produto-alvo de marketplace de itens digitais, condicionado a licença por publicador. Se a Axlebolt autorizar Standoff 2, terá duas vitrines:

1. **Market P2P [C]:** anúncios criados por vendedores e aprovados manualmente pela staff.
2. **Compre do Midas [C]:** estoque próprio, curado e precificado pelo operador Midas.

**Promessa:** “Veja o preço de referência, negocie com proteção e receba com rastreio.”

**North Star [R]:** valor e quantidade semanal de transações cujo saldo de vendas chegou a `DISPONIVEL` no fluxo administrado pelo PSP, descontando disputas procedentes, reembolsos e chargebacks.

O produto é orientado por estados verificáveis de anúncio, pagamento, entrega, disputa e saldo. O catálogo é a vitrine; a confiança operacional é o produto.

## 3. Problema

Compradores temem fraude, preço injusto e entrega incompleta. Vendedores temem chargeback, bloqueio indefinido e compradores mal-intencionados. Os dois lados tendem a levar a conversa para canais externos, o que apaga evidências e reduz a proteção da plataforma.

Midas precisa permitir descoberta e negociação rápidas sem esconder:

- quem vende;
- o que foi aprovado;
- de onde veio o preço em gold;
- quando o pagamento foi realmente confirmado;
- como e quando o produto foi entregue;
- quem confirmou;
- por que um valor está em retenção;
- como contestar uma decisão.

## 4. Jobs to be Done

- **Comprador:** quando eu quiser adquirir uma skin, craft ou outro item, quero entender seu valor de referência, negociar com segurança e acompanhar a entrega para não pagar sem receber.
- **Vendedor:** quando eu tiver um item para vender, quero anunciá-lo sem preencher dados errados, receber compradores qualificados e saber quando meu saldo estará disponível.
- **Midas:** quando eu vender estoque próprio, quero separá-lo do P2P, controlar o preço e manter a mesma transparência de mercado.
- **Staff:** quando surgir anúncio, mensagem, pagamento ou disputa de risco, quero decidir com contexto, permissão adequada e trilha de auditoria.
- **Master:** quando a operação mudar, quero configurar catálogo, equipe, permissões, taxas, integrações e regras sem editar banco ou código.
- **Suporte:** quando um usuário pedir ajuda por site ou e-mail, quero uma fila única com todo o contexto necessário e nenhum segredo exposto.
- **Financeiro:** quando uma transação avançar ou falhar, quero reconciliar cada valor e liberar somente o que estiver elegível.
- **Growth/Marketing:** quando houver carrinho abandonado, renovação ou oportunidade real, quero acionar uma jornada consentida, mensurar o retorno e interromper a comunicação no momento certo.
- **Curador do Studio:** quando um produto 2D/3D entrar na biblioteca, quero comprovar origem, padronizar atributos e publicá-lo uma vez para que tenants criem ofertas sem duplicar catálogo.
- **Creator/Afiliado:** quando eu indicar uma oferta autorizada, quero link/cupom atribuível e comissão rastreável sem poder manipular compra, preço ou saldo.

## 5. Personas

| Persona | Trabalho principal | Maior risco |
|---|---|---|
| Comprador iniciante | Entender item e preço antes de pagar | Confundir referência em gold com o preço monetário da oferta ou cair em golpe |
| Colecionador | Encontrar crafts e raridades relevantes | Busca pobre e recomendação repetitiva |
| Vendedor casual | Criar anúncio correto | Escolher item/adesivo errado |
| Vendedor profissional | Gerir anúncios, pedidos, hold e saque | Dupla venda e status financeiro opaco |
| Operador Midas | Gerir estoque e preço próprio | Misturar estoque da casa com P2P |
| Moderador | Decidir anúncios com velocidade e qualidade | Aprovação inconsistente |
| Trust & Safety | Tratar fraude, PII, restrições e recursos | Falso positivo e evasão ofuscada |
| Suporte | Resolver tickets e e-mails | Filas fragmentadas e acesso excessivo |
| Financeiro | Reconciliar, congelar, liberar e pagar | Duplicidade, chargeback e fraude interna |
| Growth/Marketing | Criar audiências, jornadas e medir recorrência | Enviar sem consentimento ou creditar conversão falsa |
| Curador do Studio | Publicar catálogo e ativos reutilizáveis | Duplicar item ou publicar asset sem direito/fidelidade |
| Creator/Afiliado | Divulgar link/cupom e acompanhar atribuição | Self-referral, fraude e comissão opaca |
| Master | Governar configuração e administradores | Privilégios excessivos e ação sem trilha |

## 6. Objetivos

- **[C]** Publicar anúncios P2P somente após aprovação manual.
- **[C]** Permitir catálogo administrável de itens e adesivos.
- **[C]** Modelar crafts com quatro posições condicionais.
- **[C]** Exibir preço atual e histórico em gold da skin base e preço dos adesivos.
- **[C]** Permitir negociação no site com bloqueio anti-PII antes da compra.
- **[C]** Abrir sala pós-pagamento para entrega e confirmação bilateral.
- **[C]** Manter o saldo em retenção por sete dias antes do saque.
- **[C]** Permitir mensagens transacionais e marketing por WhatsApp/Instagram/outros canais somente com finalidade, consentimento, template e supressão aplicáveis.
- **[C]** Oferecer tickets e caixa própria de e-mail na operação.
- **[C]** Oferecer painel Master e ADM com permissões granulares.
- **[C]** Proteger contas por passkeys/2FA e confiança de dispositivo.
- **[C]** Personalizar descoberta a partir de busca, visualização e compra.
- **[C]** Persistir carrinho, recuperar abandono e organizar pós-venda/renovação sem entregar o telefone bruto ao vendedor por padrão.
- **[C]** Oferecer avaliação bilateral, níveis, insígnias, recompensas, ranking e planos comerciais com regras versionadas.
- **[C]** Oferecer Midas Studio compartilhado para catálogo 2D/3D e criação de anúncio pré-preenchido sem entidade paralela.
- **[C]** Oferecer cupons, afiliados, links atribuíveis e campanhas multi-tenant com comissão reconciliada.
- **[R]** Entregar SEO técnico, localização e políticas de mercado por país/moeda sem prometer presença global antes de homologação.
- **[R]** Aumentar conversão por clareza, relevância e confiança, sem padrão manipulativo.

## 7. Não-objetivos e limites

- Aplicativo nativo.
- Leilões, crédito próprio ou investimento/aposta sobre itens.
- Um pedido único com múltiplos vendedores: o carrinho pode agregá-los, mas o checkout cria pedidos e efeitos financeiros separados.
- Transferência automatizada dentro do jogo sem API oficial autorizada.
- Custódia financeira própria ou armazenamento de PAN/CVV.
- Precificação automática do anúncio do vendedor ou do estoque Midas.
- Exportar telefone/e-mail bruto de compradores para prospecção do seller, disparar cold DM ou inferir consentimento de termos genéricos.
- Chamar imagem única de reconstrução 3D exata ou publicar ativo sem origem/licença/revisão.
- Habilitar hold, split, payout, WhatsApp ou Instagram porque um provider “parece suportar”; capability depende de território, conta e contrato homologados.
- Venda de contas de Standoff 2; atualmente incompatível com EULA/Code of Conduct e removida do escopo real.
- Reutilização de PNGs, textos, marca, CSS ou identidade de terceiros sem licença.
- “Tempo real” baseado em endpoint privado, engenharia reversa ou scraping autenticado.

## 8. Princípios de produto e UX

1. **Confiança antes da pressão.** Origem, preço, entrega, hold e disputa aparecem antes do pagamento.
2. **Gold é referência.** Nunca parecer moeda do checkout nem soma garantida do craft.
3. **Nenhum dado inventado.** Feed ausente fica indisponível; estoque e popularidade precisam de evidência.
4. **Uma ação, um próximo passo.** Rejeição, pagamento pendente e saque falho sempre oferecem recuperação.
5. **Progressive disclosure.** Craft só aparece quando aplicável; contato só depois do pagamento.
6. **Configuração versionada.** Catálogo, permissões, métodos, taxas, prazos e políticas não ficam hardcoded.
7. **Menor privilégio.** Nível hierárquico não concede automaticamente todas as capacidades.
8. **Clean room.** A referência ensina hierarquia; não fornece ativos nem código.
9. **Acessível e móvel.** Jornada completa por teclado e em viewport pequeno.
10. **Transparência algorítmica.** Personalização tem explicação, opção de desligar e diversidade.

## 9. Arquitetura de informação e rotas

| Superfície | Rota sugerida | Função |
|---|---|---|
| Início | `/` | Busca, categorias, recomendações e duas vitrines |
| Market P2P | `/market` | Anúncios de usuários |
| Compre do Midas | `/midas` | Estoque próprio identificado |
| Busca | `/buscar?q=` | Resultado, filtros, ordem e recuperação |
| Item-base | `/itens/:slug` | Histórico, referência, ofertas, poster e entrada para a inspeção 3D quando disponível |
| Inspeção 3D do item | `/itens/:slug/3d` | Experiência dedicada a uma arma/item por rota, com entrada curta e interação direta sobre o artefato aprovado |
| Anúncio | `/anuncios/:id` | Oferta, craft, vendedor, entrada para inspeção 3D, chat, gráfico e compra |
| Vendedor público | `/vendedores/:id` | Reputação e anúncios públicos |
| Ranking público | `/ranking` | Temporada mensal, fórmula, elegibilidade, top e histórico encerrado |
| Recompensas públicas | `/recompensas` | Níveis, regras, benefícios e prêmios publicados |
| Favoritos | `/conta/favoritos` | Itens e ofertas salvos |
| Entrar/cadastrar | `/entrar`, `/cadastro` | Identidade |
| Segurança | `/conta/seguranca` | MFA, passkeys, sessões e dispositivos |
| Conta | `/conta` | Visão geral contextual e atalhos autorizados |
| Criar anúncio | `/vender/novo` | Wizard estruturado |
| Meus anúncios | `/vender/anuncios` | Rascunhos, revisões e publicados |
| Conversas | `/mensagens` | Chat e propostas pré-compra |
| Checkout | `/checkout/:intentId` | Reserva e pagamento |
| Entrega | `/pedidos/:id/entrega` | Sala, cofre, contato e confirmações |
| Compras | `/conta/compras` | Lista, detalhe, timeline e casos relacionados dos pedidos do comprador |
| Carrinho | `/carrinho` | Linhas persistidas, revalidação e agrupamento de checkout por vendedor/provider |
| Avaliações | `/conta/avaliacoes` | Avaliações elegíveis, dadas, recebidas, resposta e denúncia |
| Conquistas | `/conta/conquistas` | Nível, progresso, insígnias, recompensas e histórico de grants |
| Vendas | `/conta/vendas` | Dashboard, lista e detalhe dos pedidos no escopo de `SellerAccount` autorizado por `SellerMembership` |
| Clientes e pós-venda | `/conta/vendas/clientes` | Recência/frequência/lifecycle e oportunidades explicadas no tenant |
| Marketing do vendedor | `/conta/vendas/marketing` | Campanhas, jornadas, audiência aprovada, criativos e resultados agregados |
| Studio do vendedor | `/vender/studio` | Biblioteca 2D/3D compartilhada e criação do mesmo `Listing`/`ListingRevision` em `DRAFT`, pré-preenchido |
| Saldo de vendas | `/conta/carteira` *(alias técnico legado; nome público: Saldo de vendas)* | Valores fiduciários administrados pelo PSP: pendente, retenção, disponível e extrato |
| Saques | `/conta/saques` | Solicitar e acompanhar |
| Suporte | `/conta/suporte` | Abrir e responder tickets |
| Recurso | `/conta/recurso` | Revisão de restrição/banimento |
| Direitos sobre dados | `/conta/privacidade` | Acesso, correção, exportação, oposição e eliminação |
| Preferências | `/conta/preferencias` | Personalização, cookies e comunicações |
| Cadastro de vendedor | `/vender/cadastro` | Elegibilidade, KYC/KYB e destino de recebimento via PSP |
| Central de ajuda | `/ajuda` | Compra, venda, entrega, disputa, segurança e contato |
| Central de confiança | `/seguranca` | Antigolpe, proteção da transação e canais de denúncia |
| Políticas públicas | `/termos`, `/privacidade`, `/cookies`, `/taxas`, `/politicas/*` | Termos, dados, taxas, vendedor, disputa, conteúdo e acessibilidade |
| Operação | `/admin` | Filas e alertas |
| Moderação | `/admin/anuncios` | Checklist e decisão |
| Catálogo | `/admin/catalogo` | Itens, adesivos, taxonomia, ativos e origem de modelos 3D |
| Job/revisão 3D | `/admin/catalogo/modelos-3d/:jobId` | Geração assíncrona, comparação, validação e decisão de publicação |
| Confiança | `/admin/confianca` | PII, fraude, restrições e dispositivos |
| Pedidos | `/admin/pedidos` | Entrega e disputas |
| Suporte/inbox | `/admin/suporte` | Tickets, e-mails unificados e contexto 360° autorizado do caso |
| Financeiro | `/admin/financeiro` | Conciliação, hold, reembolso e saque |
| Estoque Midas | `/admin/midas` | Inventário e preço próprio |
| Usuários | `/admin/usuarios` | Status e histórico permitido |
| Moderação de avaliações | `/admin/avaliacoes` | Denúncia, abuso, inelegibilidade e recurso de avaliações |
| Marketing operacional | `/admin/marketing` | Campanhas, canais, consentimento, supressão, cupons, afiliados e SEO técnico |
| Studio administrativo | `/admin/studio` | Curadoria, submissões, assets 2D/3D, relações e publicação |
| Growth — plataforma | `/admin/growth` | North Star, ativação bilateral, liquidez, conclusão e retenção |
| Growth — funil | `/admin/growth/funil` | Etapas, conversão, abandono e tempo entre marcos |
| Growth — tenants | `/admin/growth/tenants`, `/admin/growth/tenants/:sellerAccountId` | Comparação e detalhe do `SellerAccount` |
| Growth — membros | `/admin/growth/membros`, `/admin/growth/membros/:membershipId` | Progresso e interações de `SellerMembership`/`User` no tenant |
| Growth — coortes | `/admin/growth/coortes` | Retenção e reativação por coorte versionada |
| Growth — interações | `/admin/growth/interacoes` | Eventos aceitos, rejeitados, atrasados e correlacionados |
| Growth — oportunidades | `/admin/growth/oportunidades` | Bloqueios e próxima ação derivados, sem CRM paralelo |
| Growth — vendedor | `/conta/vendas/growth` | Mesmo template de tenant, limitado ao `SellerAccount` ativo |
| Master | `/master` | IAM, configuração e integrações |
| Progressão Master | `/master/progressao` | Levels, recompensas, badges, temporadas e prêmios top 3 |
| Planos de anúncio | `/master/planos-de-anuncio` | Taxas, boosts, prioridades, bônus e vigência |
| Políticas de marketing | `/master/marketing` | Capabilities, templates, frequency cap, canais, afiliados e atribuição |
| Auditoria | `/master/auditoria` | Eventos e exportação governada |

### Contratos de API adicionais obrigatórios

As rotas abaixo completam os fluxos críticos do PRD. São contratos candidatos e permanecem condicionados aos gates de publicador, PSP, privacidade e políticas; sua presença neste documento não autoriza integração real com Standoff 2.

```text
POST   /v1/seller-accounts
GET    /v1/me/seller-accounts
POST   /v1/seller-accounts/{sellerAccountId}/onboarding
GET    /v1/seller-accounts/{sellerAccountId}/onboarding
POST   /v1/seller-accounts/{sellerAccountId}/onboarding/provider-session
POST   /v1/seller-accounts/{sellerAccountId}/payout-destinations
POST   /v1/listings/{id}/ownership-proofs
POST   /v1/admin/listings/{id}/revalidate

POST   /v1/orders/{orderId}/disputes
GET    /v1/disputes/{disputeId}
POST   /v1/disputes/{disputeId}/evidence
POST   /v1/disputes/{disputeId}/evidence-submission
POST   /v1/admin/disputes/{disputeId}/claim
POST   /v1/admin/disputes/{disputeId}/decisions
POST   /v1/disputes/{disputeId}/appeals
GET    /v1/disputes/{disputeId}/appeals/{appealId}

POST   /v1/account-restrictions/{restrictionId}/appeals
GET    /v1/account-restrictions/{restrictionId}/appeals/{appealId}
POST   /v1/admin/account-appeals/{appealId}/decisions

GET    /v1/me/privacy
PATCH  /v1/me/privacy/preferences
POST   /v1/me/data-rights-requests
GET    /v1/me/data-rights-requests/{id}
POST   /v1/age-assurance/sessions
GET    /v1/age-assurance/status

POST   /v1/webhooks/email/{provider}
GET    /v1/admin/payments/quarantined
POST   /v1/admin/payments/{paymentId}/quarantine/reconcile
POST   /v1/admin/payments/{paymentId}/quarantine/refund

GET    /v1/me/overview
GET    /v1/me/purchases?cursor=&limit=&status=&from=&to=&query=
GET    /v1/orders/{orderId}
GET    /v1/seller-accounts/{sellerAccountId}/sales-metrics?from=&to=
GET    /v1/seller-accounts/{sellerAccountId}/sales?cursor=&limit=&status=&from=&to=&query=

GET    /v1/sales-balance?sellerAccountId=
GET    /v1/sales-balance/ledger?cursor=&limit=&sellerAccountId=
GET    /v1/payouts?cursor=&limit=&status=&sellerAccountId=
POST   /v1/payouts
GET    /v1/payouts/{payoutId}
POST   /v1/payouts/{payoutId}/retry
POST   /v1/payouts/{payoutId}/cancel

GET    /v1/tickets?cursor=&limit=&status=&category=
POST   /v1/orders/{orderId}/refund-requests
GET    /v1/me/refund-requests?cursor=&limit=&status=
GET    /v1/refund-requests/{refundRequestId}
GET    /v1/admin/refund-requests?cursor=&limit=&status=
GET    /v1/admin/refund-requests/{refundRequestId}
POST   /v1/admin/refund-requests/{refundRequestId}/request-information
POST   /v1/admin/refund-requests/{refundRequestId}/decision
POST   /v1/admin/refund-requests/{refundRequestId}/execute
POST   /v1/admin/refund-requests/{refundRequestId}/retry
POST   /v1/admin/refund-requests/{refundRequestId}/escalate-dispute
GET    /v1/admin/tickets/{ticketId}/context

GET    /v1/admin/growth/overview?from=&to=&timezone=&currency=&channel=
GET    /v1/admin/growth/funnel?from=&to=&funnelVersion=&sellerAccountId=
GET    /v1/admin/growth/tenants?cursor=&limit=&stage=&status=&risk=&query=
GET    /v1/admin/growth/tenants/{sellerAccountId}
GET    /v1/admin/growth/members?cursor=&limit=&sellerAccountId=&stage=&blocker=
GET    /v1/admin/growth/members/{membershipId}
GET    /v1/admin/growth/cohorts?cohortType=&from=&to=&sellerAccountId=
GET    /v1/admin/growth/interactions?cursor=&limit=&sellerAccountId=&memberId=&eventType=
GET    /v1/admin/growth/opportunities?cursor=&limit=&sellerAccountId=&reasonCode=
GET    /v1/seller-accounts/{sellerAccountId}/growth/overview?from=&to=&timezone=&currency=

POST   /v1/admin/catalog/items/{itemId}/model-3d-jobs
GET    /v1/admin/model-3d-jobs/{jobId}
POST   /v1/admin/model-3d-jobs/{jobId}/cancel
POST   /v1/admin/model-3d-jobs/{jobId}/decision
GET    /v1/catalog/items/{itemId}/model-3d-manifest

POST   /v1/admin/payment-resolution-cases
GET    /v1/admin/payment-resolution-cases?cursor=&status=&provider=&query=
GET    /v1/admin/payment-resolution-cases/{caseId}
POST   /v1/admin/payment-resolution-cases/{caseId}/retrieve-provider
POST   /v1/admin/payment-resolution-cases/{caseId}/associate-reference
POST   /v1/admin/payment-resolution-cases/{caseId}/decision
POST   /v1/admin/payouts/{payoutId}/claim
POST   /v1/admin/payouts/{payoutId}/approve
POST   /v1/admin/payouts/{payoutId}/executions
POST   /v1/admin/payouts/{payoutId}/confirm-paid

GET    /v1/me/reviews?cursor=&role=&status=
POST   /v1/orders/{orderId}/reviews
PATCH  /v1/reviews/{reviewId}
POST   /v1/reviews/{reviewId}/reply
POST   /v1/reviews/{reviewId}/reports
GET    /v1/seller-accounts/{sellerAccountId}/reputation
GET    /v1/admin/reviews?cursor=&status=&reason=
POST   /v1/admin/reviews/{reviewId}/decision

GET    /v1/me/progression
GET    /v1/seller-accounts/{sellerAccountId}/progression
GET    /v1/leaderboards/current
GET    /v1/leaderboards/{seasonId}
GET    /v1/rewards
GET    /v1/master/progression-policies
POST   /v1/master/progression-policies
POST   /v1/master/progression-policies/{versionId}/publish
POST   /v1/master/reward-definitions
POST   /v1/master/badge-definitions
POST   /v1/master/badge-awards
POST   /v1/master/leaderboard-seasons/{seasonId}/finalize
POST   /v1/master/leaderboard-seasons/{seasonId}/awards
GET    /v1/master/listing-plans
POST   /v1/master/listing-plans
POST   /v1/master/listing-plans/{versionId}/publish

GET    /v1/cart
POST   /v1/cart/lines
PATCH  /v1/cart/lines/{lineId}
DELETE /v1/cart/lines/{lineId}
POST   /v1/cart/revalidate
POST   /v1/cart/checkout-groups
GET    /v1/seller-accounts/{sellerAccountId}/customers?cursor=&segment=&lifecycle=
GET    /v1/seller-accounts/{sellerAccountId}/customers/{relationshipId}

GET    /v1/me/communication-consents
POST   /v1/me/communication-consents
POST   /v1/me/communication-consents/{consentId}/revoke
GET    /v1/seller-accounts/{sellerAccountId}/campaigns?cursor=&status=
POST   /v1/seller-accounts/{sellerAccountId}/campaigns
POST   /v1/seller-accounts/{sellerAccountId}/campaigns/{campaignId}/preview-audience
POST   /v1/seller-accounts/{sellerAccountId}/campaigns/{campaignId}/publish
POST   /v1/seller-accounts/{sellerAccountId}/campaigns/{campaignId}/pause
GET    /v1/seller-accounts/{sellerAccountId}/campaigns/{campaignId}/metrics
POST   /v1/webhooks/channels/{provider}
GET    /v1/admin/marketing/suppressions?cursor=&channel=&reason=
POST   /v1/admin/marketing/suppressions
POST   /v1/admin/coupons
POST   /v1/coupons/validate
POST   /v1/admin/affiliates
GET    /v1/admin/affiliates?cursor=&status=
POST   /v1/admin/affiliates/{affiliateId}/links

GET    /v1/studio/catalog?cursor=&query=&category=&format=&lifecycle=
GET    /v1/studio/catalog/{itemId}
POST   /v1/studio/catalog/{itemId}/listing-drafts
POST   /v1/studio/catalog-submissions
GET    /v1/studio/catalog-submissions/{submissionId}
GET    /v1/admin/studio/submissions?cursor=&status=&tenant=
POST   /v1/admin/studio/submissions/{submissionId}/claim
POST   /v1/admin/studio/submissions/{submissionId}/decision
POST   /v1/admin/catalog/items/{itemId}/relationships

GET    /robots.txt
GET    /sitemap.xml
GET    /v1/admin/seo/health?locale=&status=
```

Os contratos já presentes no documento de arquitetura preservam sua nomenclatura canônica; as extensões de RF-181–211 seguem o mesmo namespace `/v1` e o prefixo administrativo `/v1/admin`. Os rascunhos `/seller-onboarding`, `/me/data-rights/requests`, `/admin/payment-exceptions`, `/api/me/*` e `/api/staff/*` estão aposentados e não devem virar aliases implícitos.

Todos os endpoints de mutação usam autorização por objeto/campo, `Idempotency-Key` quando houver efeito repetível, auditoria e `application/problem+json`. Evidência, recursos, dados pessoais e exceções financeiras exigem escopo próprio e nunca são retornados por listagens genéricas. Listagens novas usam cursor opaco e retornam `nextCursor`; `page`/`pageSize` e carga integral em memória não são contratos alternativos. As rotas de conta, venda, saldo, payout, ticket e contexto são fachadas de leitura ou extensões dos domínios canônicos, não novos motores.

## 10. Hierarquia e permissões

### Níveis funcionais

- **L0 — Usuário:** comprador; vendedor após requisitos de segurança.
- **L1 — Agente:** suporte ou moderador júnior com escopo limitado.
- **L2 — Especialista:** catálogo, confiança, financeiro ou estoque Midas.
- **L3 — Admin gerente:** gerencia filas e membros do próprio domínio.
- **L4 — Master:** governa roles, configurações e integrações.

A política combina `role template + grants explícitos + escopo + expiração + deny`. Um L4 continua incapaz de editar ledger histórico, segredo de autenticação ou auditoria imutável.

`User` continua sendo a identidade única. `SellerAccount` representa o contexto comercial e `SellerMembership` vincula a pessoa a esse contexto com papel, grants, escopo, validade e estado; nenhuma dessas entidades duplica cadastro, sessão ou credencial. Leituras e mutações do painel do vendedor sempre validam a membership e o `SellerAccount` alvo no servidor.

### Matriz resumida

| Função | Pode | Não pode |
|---|---|---|
| Comprador | comprar, negociar, confirmar, disputar | moderar ou ver PII de terceiro |
| Vendedor | anunciar, entregar, confirmar, sacar | aprovar próprio anúncio ou hold |
| Moderador | revisar anúncios no escopo | alterar pagamento ou ledger |
| Catálogo | gerir itens, adesivos e ativos | liberar saldo |
| Trust & Safety | restringir, revisar, banir/desbanir | editar preço Midas ou ledger |
| Suporte | tickets e ações de baixo risco | ver segredo ou mudar saldo |
| Financeiro operador | reconciliar e propor ação | aprovar a própria ação crítica |
| Financeiro aprovador | aprovar dentro do limite | editar catálogo ou auditoria |
| Operador Midas | estoque e preço próprio | burlar segregação de aprovação |
| Curador do Studio | catálogo, submissões, relações e assets no escopo | publicar sem licença/revisão ou editar oferta do seller |
| Growth/Marketing | campanhas, templates, segmentos e resultados permitidos | exportar contato bruto, ignorar opt-out ou confirmar conversão |
| Gestor de reputação | denúncia, abuso e recurso de avaliação | editar ledger, nota elegível sem decisão ou própria review |
| Gestor de progressão | policy, reward, badge, ranking e plano | alterar contribuição financeira ou snapshot encerrado |
| Afiliado/creator | links/códigos e resultado próprio agregado | aprovar comissão, acessar compradores ou autoatribuir venda |
| Admin gerente | staff/configuração do domínio | conceder o que não possui |
| Master | RBAC, configuração e emergência | editar fatos financeiros históricos |

### Permissões atômicas mínimas

`catalog.read/write/publish`, `asset.manage`, `studio.read/submit/review/publish`, `listing.review/approve/reject/override`, `listing_plan.read/manage/publish`, `midas.inventory/manage_price`, `chat.review`, `user.restrict/ban/unban`, `appeal.resolve`, `ticket.read/reply/assign/close/context`, `email.reply`, `order.read/intervene`, `dispute.read/resolve`, `refund.request/read/approve/execute/retry/escalate`, `order_review.read/moderate/appeal`, `hold.freeze/release`, `payout.request/read/claim/approve/execute/confirm`, `payment.configure`, `payment_resolution.read/claim/decide`, `campaign.read/create/approve/publish/pause`, `consent.read/suppress`, `coupon.manage`, `affiliate.read/manage/approve_commission`, `progression.read/manage/publish`, `badge.manage/award/revoke`, `leaderboard.read/finalize/award`, `seo.read/manage`, `roles.read/manage`, `admin.invite/revoke`, `device.review/revoke`, `audit.read/export`, `feature_flag.manage`.

### Guardas

- default deny; deny explícito vence;
- passkey ou 2FA obrigatória para staff;
- step-up para IAM, segredo, reembolso, hold, saque e exportação;
- maker-checker para ação financeira acima de limite configurável;
- elevação temporária expira;
- ninguém aprova a própria ação sensível;
- toda negação e todo override relevante são auditados.

## 11. Jornadas ponta a ponta

### Comprador

1. Entra por Início, Market ou Midas.
2. Busca/filtra por arma, coleção, raridade, preço, craft e adesivo.
3. Abre anúncio e compara preço da oferta, referência em gold, componentes, gráfico, frescor e vendedor.
4. Favorita, conversa ou envia proposta estruturada.
5. PII detectada é bloqueada antes de chegar à outra parte.
6. Aceita preço e inicia checkout; o anúncio é reservado atomicamente.
7. O servidor aguarda confirmação autenticada do PSP.
8. Após pagamento: sala de entrega, mensagem automática/cofre e WhatsApp opcional são liberados.
9. Comprador e vendedor confirmam de forma independente.
10. A retenção já tem relógio desde a liquidação canônica; sem disputa e com conclusão bilateral, o lote pode ser liberado quando `settledAt + 168h` vencer.
11. Comprador avalia ou abre disputa/ticket.

### Vendedor

1. Ativa fator forte, conclui cadastro de vendedor e cumpre KYC/KYB e destino de recebimento exigidos pelo PSP/política.
2. Escolhe tipo e item do catálogo.
3. Declara craft; se `sim`, vê quatro slots; se `não`, slots desaparecem e são limpos.
4. Define preço, descrição, instrução e contato pós-pago.
5. Visualiza prévia e envia revisão imutável.
6. Corrige, se necessário; após aprovação, anúncio é publicado.
7. Negocia por chat/proposta.
8. Após pagamento, entrega na sala e confirma.
9. Acompanha retenção e, quando elegível, solicita saque.

### Compre do Midas

1. Operador autorizado vincula item do catálogo ao estoque próprio.
2. Define preço, craft, quantidade/identificador e entrega.
3. Política decide se quatro-olhos é obrigatório.
4. Oferta aparece apenas na vitrine Midas e recebe identificação permanente.
5. Preço de referência, gráfico, pagamento, entrega e auditoria usam os mesmos motores.
6. Relatórios separam GMV P2P, estoque, receita e margem Midas.

### Moderação

1. Fila prioriza risco e tempo.
2. Moderador assume um caso e verifica versão congelada.
3. Checklist valida item, craft, mídia, preço, descrição e entrega.
4. Aprova, rejeita ou solicita alteração com motivo estruturado.
5. Reenvio gera nova revisão; histórico não é apagado.

### Suporte e e-mail

1. Ticket nasce no portal ou de inbound e-mail.
2. Threading associa resposta ao caso correto.
3. Fila aplica categoria, prioridade, SLA e responsável.
4. Agente vê apenas contexto necessário, responde no mesmo histórico e escala.
5. Bounce, reabertura e decisão preservam trilha.

### Financeiro

1. Concilia PSP, pedido e ledger.
2. Monitora pendente, protegido, hold, congelado e disponível.
3. Divergência congela ação relacionada e abre caso.
4. Liberação depende de todos os gates, não apenas do relógio.
5. Saque usa maker-checker e confirmação do PSP.

## 12. Requisitos funcionais

### Identidade, conta e dispositivo

- **RF-001 [C]** Cadastrar e autenticar com verificação de e-mail.
- **RF-002 [R]** Uma conta pode comprar e vender, sem duplicação de identidade.
- **RF-003 [R]** Estados: `ATIVO`, `RESTRITO`, `SUSPENSO`, `BANIDO`, `ENCERRADO`.
- **RF-004 [C]** Suportar 2FA e passkeys.
- **RF-005 [R]** TOTP, passkey e recovery codes; SMS não é fator principal.
- **RF-006 [C]** Disponibilizar API própria de dispositivo confiável.
- **RF-007 [R]** Registrar desafio, chave pública, risco, validade e revogação; sem fingerprint como identidade.
- **RF-008 [R]** Usuário lista e revoga sessões/dispositivos.
- **RF-009 [R]** Novo dispositivo ou ação de risco exige step-up e alerta.
- **RF-010 [R]** Staff e vendedor antes do primeiro saque possuem fator forte.

### Catálogo e ativos

- **RF-011 [C]** Administradores autorizados gerenciam skins e adesivos.
- **RF-012 [R]** Item possui ID imutável, tipo, nome, coleção, arma, raridade, atributos e estado.
- **RF-013 [R]** Desativar item bloqueia novos anúncios sem quebrar históricos.
- **RF-014 [C]** Wizard aceita somente itens ativos do catálogo.
- **RF-015 [R]** Ativo guarda origem, licença, hash, versão, autor e vínculo.
- **RF-016 [D]** Importação de PNG depende de autorização comprovada.
- **RF-017 [R]** Catálogo é versionado e auditado.
- **RF-018 [R]** Importação em lote oferece dry-run, prévia, erros e rollback lógico.

### Anúncios e craft

- **RF-019 [C]** Vendedor cria anúncio por wizard com rascunho.
- **RF-020 [C]** Skin exige seleção da skin base.
- **RF-021 [C]** “Tem craft?” controla quatro posições ordenadas.
- **RF-022 [R]** Craft ativo permite até quatro adesivos e exige ao menos um; vazio é explícito.
- **RF-023 [R]** Ordem persiste e repetição é permitida salvo regra do catálogo.
- **RF-024 [C]** Craft desligado oculta e remove posições.
- **RF-025 [C]** Vendedor define preço monetário da oferta.
- **RF-026 [R]** Gold aparece separado e rotulado como referência.
- **RF-027 [C]** Vendedor cadastra mensagem automática pós-pagamento.
- **RF-028 [C]** Vendedor cadastra WhatsApp opcional, oculto antes do pagamento.
- **RF-029 [D/R]** Somente para categoria de conta cuja transferência seja expressamente autorizada por outro publisher, login/senha/token ficam em cofre, nunca em texto comum. Esta capacidade permanece integralmente desabilitada no canal Standoff 2.
- **RF-030 [R]** Wizard salva e restaura rascunho.
- **RF-031 [R]** Prévia reproduz a página pública.
- **RF-032 [C]** Todo P2P exige aprovação manual.
- **RF-033 [R]** Estados cobrem rascunho, revisão, publicação, reserva, venda, pausa e expiração.
- **RF-034 [R]** Alteração material cria nova revisão e pode exigir nova aprovação.
- **RF-035 [R]** Reserva atômica impede dupla venda.
- **RF-036 [D]** Tipo `ACCOUNT` não existe no canal Standoff 2. Só poderá existir para outro publisher com prova de transferibilidade e autorização expressa.

### Moderação

- **RF-037 [C]** Admin autorizado aprova, rejeita ou pede correção.
- **RF-038 [R]** Fila possui risco, prioridade, filtro, atribuição e SLA.
- **RF-039 [R]** Checklist cobre item, craft, preço, texto, mídia e entrega.
- **RF-040 [R]** Rejeição/ajuste exige código de motivo e orientação.
- **RF-041 [R]** Vendedor corrige sem perder histórico.
- **RF-042 [R]** Staff não aprova o próprio conteúdo quando segregação estiver ativa.
- **RF-043 [R]** Override exige permissão, step-up e justificativa.

### Descoberta e recomendação

- **RF-044 [C]** Usuários pesquisam e navegam por anúncios.
- **RF-045 [R]** Filtros: arma, coleção, raridade, preço, craft, adesivo, vendedor e canal.
- **RF-046 [C]** Busca, visualização e compra alimentam prioridade personalizada.
- **RF-047 [R]** Sinais: busca, clique, favorito, proposta, compra, categoria, preço e recência.
- **RF-048 [R]** MVP usa ranking explicável por regras.
- **RF-049 [R]** Cold start usa tendências reais, disponibilidade e diversidade.
- **RF-050 [R]** Usuário limpa histórico e desliga personalização.
- **RF-051 [R]** Ranking limita repetição e concentração de vendedor.
- **RF-052 [R]** “Por que estou vendo isto?” explica sinais principais.

### Preço e gráfico

- **RF-053 [C]** Página exibe preço atual em gold da skin base.
- **RF-054 [C]** Cada adesivo preenchido exibe preço atual em gold.
- **RF-055 [C]** Gráfico histórico representa a skin base.
- **RF-056 [R]** Feed mostra fonte, timestamp, cadência e estado de frescor.
- **RF-057 [R]** Soma de componentes é “referência bruta”, não valor garantido do craft.
- **RF-058 [R]** Períodos só aparecem se houver dados suficientes.
- **RF-059 [R]** Falha mostra último valor como desatualizado; ausência não vira zero.
- **RF-060 [D]** Conector depende de API/feed autorizado.
- **RF-061 [R]** Lacuna e divergência geram alerta operacional.
- **RF-062 [C]** Preço Midas é manual e não é sobrescrito por gold.

### Chat, proposta e anti-PII

- **RF-063 [C]** Comprador e vendedor conversam antes da compra.
- **RF-064 [R]** Proposta tem valor, validade e estado estruturado.
- **RF-065 [R]** Oferta aceita cria checkout reservado com expiração.
- **RF-066 [C]** Pré-compra bloqueia telefone, e-mail, nick, URL, Pix e redes sociais.
- **RF-067 [R]** Detector combina normalização, padrões, ofuscação e classificador.
- **RF-068 [R]** Mensagem violadora não é entregue.
- **RF-069 [C]** Primeira tentativa bloqueia e avisa.
- **RF-070 [C]** Segunda bloqueia e apresenta aviso final.
- **RF-071 [C/R]** Terceira bloqueia uso normal e leva a `RESTRICTED_PENDING_REVIEW`; banimento definitivo exige decisão humana.
- **RF-072 [C]** Restrito acessa recurso e funções essenciais.
- **RF-073 [R]** Staff autorizada vê evidência redigida, regra e confiança.
- **RF-074 [R]** Falso positivo pode ser contestado e revertido com motivo.
- **RF-075 [R]** Rate limit, spam e denúncia são controles independentes.
- **RF-076 [R]** Sala pós-pagamento usa política de contato diferente.

### Checkout, pedido e entrega

- **RF-077 [C]** Métodos de pagamento são configuráveis pelo Master após escolha do PSP.
- **RF-078 [R]** Checkout reserva anúncio por prazo configurado.
- **RF-079 [R]** Criação/confirmação são idempotentes.
- **RF-080 [R]** Pago depende de confirmação server-side do PSP.
- **RF-081 [C]** Mensagem, cofre e WhatsApp só são revelados após pagamento.
- **RF-082 [C]** Pedido pago abre sala exclusiva.
- **RF-083 [R]** Sala registra mensagens, eventos e evidências permitidas.
- **RF-084 [C]** Vendedor confirma entrega.
- **RF-085 [C]** Comprador confirma recebimento.
- **RF-086 [C]** Venda conclui somente com as duas confirmações.
- **RF-087 [R]** Uma parte não confirma em nome da outra.
- **RF-088 [R]** Divergência abre disputa e congela o fluxo.
- **RF-089 [R]** Ausência gera lembretes/escalonamento; sem confirmação silenciosa no MVP.
- **RF-090 [R]** Avaliação só por participante de pedido concluído.

### Ledger, hold e saque

- **RF-091 [R]** Movimentação financeira gera lançamento imutável de partidas dobradas.
- **RF-092 [R]** Saldos: `PENDENTE`, `PROTEGIDO`, `EM_HOLD`, `DISPONIVEL`, `CONGELADO`, `EM_SAQUE`, `PAGO`, `ESTORNADO`.
- **RF-093 [C]** Liquidação canônica inicia o relógio de sete dias e cria lote protegido; confirmação bilateral é gate de liberação, não uma segunda retenção.
- **RF-094 [R]** Padrão: `eligibleAt = Payment.settledAt + 168h`, em UTC; atraso na entrega não reinicia o relógio, mas impede `DISPONIVEL` até a conclusão e os demais gates.
- **RF-095 [R]** Disputa, chargeback ou risco pausa liberação.
- **RF-096 [R]** Liberação exige pagamento conciliado, pedido concluído e nenhum bloqueio.
- **RF-097 [R]** A tela “Saldo de vendas” mostra início, previsão e motivo por lote administrado pelo PSP; `/conta/carteira` permanece apenas como alias técnico legado e não representa carteira própria ou custódia Midas.
- **RF-098 [R]** Saque usa apenas saldo disponível.
- **RF-099 [R]** Saque possui estados e recuperação de falha.
- **RF-100 [R]** Reembolso/saque crítico usa maker-checker.
- **RF-101 [R]** Taxas e retenções são exibidas antes da venda.
- **RF-102 [D]** Regras finais dependem do PSP e análise jurídica/financeira.

### Compre do Midas

- **RF-103 [C]** Aba separada “Compre do Midas”.
- **RF-104 [C]** Apenas autorizados gerenciam estoque próprio.
- **RF-105 [C]** Midas define os preços.
- **RF-106 [C]** Itens Midas mantêm craft, gold, gráfico e entrega.
- **RF-107 [R]** Card/página exibem “Vendido pelo Midas”.
- **RF-108 [R]** Busca global pode misturar origens com rotulagem inequívoca.
- **RF-109 [R]** Estoque, receita e margem Midas são separados do P2P.

### Tickets e caixa de e-mail

- **RF-110 [C]** Usuário cria e acompanha tickets no perfil.
- **RF-111 [C]** Contato por e-mail ou mensagem interna.
- **RF-112 [R]** Ticket possui categoria, prioridade, estado, SLA e responsável.
- **RF-113 [R]** Estados cobrem novo, aberto, esperas, resolvido, fechado e reaberto.
- **RF-114 [C]** Staff opera caixa de e-mail própria dentro do backoffice.
- **RF-115 [R]** Headers e token de thread evitam duplicação.
- **RF-116 [R]** Resposta aparece no portal e pode seguir por e-mail.
- **RF-117 [R]** Inbox possui filas, atribuição, macros, notas, tags e escalonamento.
- **RF-118 [R]** Anexo passa por tipo, tamanho, quarentena e antivírus.
- **RF-119 [R]** Segredos nunca aparecem em e-mail operacional.
- **RF-120 [R]** Bounce fica visível e oferece canal alternativo.

### Master, administração e auditoria

- **RF-121 [C]** Master cria e gerencia administradores.
- **RF-122 [C]** Master edita capacidades granulares.
- **RF-123 [C]** Master delega catálogo.
- **RF-124 [R]** Painel combina templates e permissões atômicas.
- **RF-125 [R]** Grants possuem escopo e validade.
- **RF-126 [R]** Configurações abrangem catálogo, taxa, hold, pagamento, limites, e-mail, integrações e flags.
- **RF-127 [R]** Mudança sensível exige impacto, step-up e auditoria.
- **RF-128 [R]** Auditoria registra ator, ação, alvo, antes/depois redigido, hora, dispositivo e motivo.
- **RF-129 [R]** Auditoria e ledger não têm edição/exclusão na interface.
- **RF-130 [R]** Kill switches pausam anúncio, checkout, saque ou integração separadamente.
- **RF-131 [R]** Exportação respeita escopo, mascaramento e expiração.
- **RF-132 [R]** Ação automática identifica regra/modelo e versão.

### Notificações e analítica

- **RF-133 [R]** Notificações cobrem moderação, proposta, pagamento, entrega, disputa, hold, saque, ticket e segurança.
- **RF-134 [R]** Alertas críticos não podem ser totalmente desativados.
- **RF-135 [R]** Eventos seguem taxonomia versionada.
- **RF-136 [R]** Dashboards separam P2P e Midas.
- **RF-137 [R]** Recomendação possui retenção e controles próprios.
- **RF-138 [R]** Analytics nunca carrega chat, senha, token ou segredo.

### Disputa, evidência e recurso

- **RF-139 [R]** Comprador, vendedor, suporte autorizado ou regra de risco podem abrir disputa vinculada a um pedido elegível, com motivo estruturado e proteção contra duplicidade.
- **RF-140 [R]** A abertura congela entrega decisória, lote financeiro e ações incompatíveis, preservando snapshot de pedido, anúncio, confirmações e políticas aplicáveis.
- **RF-141 [R]** Evidência possui tipo, autoria, hash, classificação, prazo de envio, estado de análise e acesso por menor privilégio; anexos passam por quarentena e conteúdo secreto usa cofre próprio.
- **RF-142 [R]** A disputa possui janela de evidência, lembretes, encerramento auditável e tratamento explícito para ausência de uma parte; nenhum prazo presume automaticamente que houve entrega.
- **RF-143 [R]** Staff sem conflito decide `BUYER`, `SELLER` ou `SPLIT`, com reason code, fundamentação, valores e política versionada.
- **RF-144 [R]** A decisão gera comandos financeiros idempotentes de refund, release, split ou freeze; staff não edita ledger nem saldo diretamente.
- **RF-145 [R]** Cada parte pode recorrer dentro da janela configurada; recurso preserva a decisão anterior, cria revisão própria e, quando possível, é analisado por pessoa diferente.
- **RF-146 [R]** Conta restrita ou banida mantém acesso ao pedido, evidências necessárias, suporte e recurso sem recuperar funções de risco.
- **RF-147 [R]** Abertura, prazo, pedido de evidência, decisão, execução e recurso geram notificações internas e transacionais sem conteúdo secreto.
- **RF-148 [R]** Toda leitura, exportação, decisão, override e reversão de disputa/recurso é auditada e sujeita a retenção/legal hold aprovado.

### Elegibilidade do vendedor, posse e capacidade do item

- **RF-149 [D/R]** Cadastro de vendedor possui estados `DRAFT`, `PENDING_VERIFICATION`, `ACTIVE`, `RESTRICTED`, `REJECTED` e `CLOSED`, com requisitos definidos por território, PSP e risco.
- **RF-150 [D/R]** KYC/KYB é executado pelo PSP ou fornecedor contratado, com compartilhamento minimizado de status e IDs; documentos brutos não entram no banco geral Midas.
- **RF-151 [R]** Destino de recebimento é cadastrado por fluxo tokenizado/verificado; inclusão ou mudança exige step-up, notificação e cooling-off configurável.
- **RF-152 [R]** Vendedor não publica, recebe pagamento ou solicita saque quando os gates obrigatórios do seu estado/território estiverem vencidos ou incompletos.
- **RF-153 [D/R]** Cada anúncio exige prova autorizada de posse e disponibilidade compatível com o publisher, com origem, timestamp, validade e vínculo à unidade anunciada.
- **RF-154 [R]** A prova expira e é revalidada antes da reserva/checkout; falha bloqueia a compra e abre recuperação sem cobrar o comprador.
- **RF-155 [R]** Perda de disponibilidade suspende o anúncio, invalida reservas ainda não pagas e cria caso operacional quando houver pagamento ou divergência.
- **RF-156 [R]** Catálogo define `craftEligible`; o controle “Tem craft?” só aparece para item-base ativo e explicitamente elegível.
- **RF-157 [R]** Capacidades por tipo — craft, quantidade, mídia, entrega, prova de posse e atributos — são versionadas e congeladas na revisão/pedido.

### Idade, privacidade, personalização e cookies

- **RF-158 [D/R]** O produto executa avaliação de acesso provável por crianças/adolescentes e aplica age assurance proporcional antes de funções definidas pela política.
- **RF-159 [D/R]** Sinal de idade guarda somente faixa/resultado, método, confiança, validade e contestação; imagem/cópia de documento é eliminada de modo imediato e irreversível após extração quando a lei assim exigir.
- **RF-160 [D/R]** Faixas protegidas recebem defaults restritivos de chat, personalização, compra, notificações e supervisão/consentimento responsável conforme matriz jurídica aprovada.
- **RF-161 [R]** Titular solicita acesso, confirmação, correção, exportação, oposição, revisão e eliminação em fluxo autenticado com protocolo, prazo, estado e resposta justificável.
- **RF-162 [R]** Pedido de direito valida identidade de forma proporcional, separa dado exportável de segredo de terceiros e permite extensão/negação apenas com base e motivo registrados.
- **RF-163 [R]** Eliminação anonimiza o dispensável e preserva somente obrigação, prevenção à fraude, exercício de direito ou legal hold válidos, informando categorias preservadas.
- **RF-164 [D/R]** Registro de tratamento identifica finalidade, base, controlador/operador, subprocessador, compartilhamento, transferência internacional, retenção e canal do encarregado.
- **RF-165 [R]** Preferências distinguem cookies estritamente necessários, analytics, personalização e comunicação; escolhas são versionadas, revogáveis e não usam consentimento empacotado.
- **RF-166 [R]** Desligar personalização interrompe novos eventos individualizados, limpa/reconstrói o perfil dentro do SLA e mantém apenas agregados autorizados; navegação continua funcional.

### Segurança do inbound de e-mail

- **RF-167 [R]** Webhook inbound valida assinatura, timestamp, provider message ID e política anti-replay antes de aceitar conteúdo.
- **RF-168 [R]** Token de thread é opaco, escopado, expirável e rotacionável; remetente precisa estar autorizado no ticket ou seguir fluxo de verificação/escalonamento.
- **RF-169 [R]** E-mail com assinatura inválida, token vazado, remetente divergente ou anexo inseguro não entra na conversa: vai para quarentena/caso com motivo auditado.

### Acesso, políticas públicas e fiscal/contábil

- **RF-170 [R]** Todo gráfico de preço oferece tabela/descrição textual equivalente, valores de início/fim/mínimo/máximo, fonte, `asOf` e navegação por teclado/leitor de tela.
- **RF-171 [R]** O site publica e torna pesquisáveis termos, privacidade, cookies, taxas, vendedor, disputa, arrependimento, conteúdo, antiscam, acessibilidade e canais de denúncia/suporte.
- **RF-172 [R]** Checkout e pedido congelam versão das políticas, oferta, taxas e consentimentos aplicáveis e disponibilizam comprovante conservável ao usuário.
- **RF-173 [D]** Antes de transação real, jurídico/contábil definem papel comercial e fiscal da Midas, comissão, reconhecimento de receita, obrigações do vendedor e documentos fiscais por território.
- **RF-174 [D/R]** Emissão/integração de documento fiscal e recibo de taxa é configurável, idempotente e reconciliada, sem inventar obrigação ou layout antes da definição competente.
- **RF-175 [R]** Relatórios contábeis separam principal de terceiros, comissão Midas, estoque próprio, taxas PSP, refunds, chargebacks, reservas e tributos, reconciliados ao ledger/PSP.

### Pagamento tardio e expiração segura

- **RF-176 [R]** Reserva não retorna o anúncio à venda até o intent ser cancelado/expirado no estado canônico do PSP ou entrar em exceção controlada.
- **RF-177 [R]** Evento de sucesso recebido após TTL entra em `PAYMENT_QUARANTINED`; não marca venda concluída, não abre sala e não revela contato/segredo automaticamente.
- **RF-178 [R]** O sistema tenta reassumir atomicamente a mesma unidade somente se ela continuar disponível e vinculada ao mesmo pedido; caso contrário inicia refund idempotente.
- **RF-179 [R]** Pagamento tardio, reassunção e refund notificam comprador, vendedor e operação, mantendo a oferta indisponível apenas pelo tempo necessário à decisão.
- **RF-180 [R]** Corridas entre expiração, cancelamento e webhook são auditadas, reconciliadas e cobertas por teste P0; nenhum resultado pode gerar dois pedidos pagos para uma unidade.

### Minha conta e projeção de capacidades

- **RF-181 [C]** `/conta` oferece uma área autenticada central com identificação permitida, situação da conta e atalhos para compras, vendas, Saldo de vendas, saques, suporte, segurança, privacidade e preferências; senha, MFA, passkey, sessão, identidade e cadastro de vendedor continuam nos fluxos existentes.
- **RF-182 [C/R]** A visão geral apresenta cards aplicáveis de compras e vendas que exigem ação, saldo fiduciário disponível e em retenção, saques em processamento, tickets, solicitações de reembolso, disputas e notificações; cada valor é uma projeção derivada da fonte canônica e leva ao detalhe correspondente.
- **RF-183 [R]** A interface projeta capacidades calculadas no servidor a partir de `User`, `SellerAccount`, `SellerMembership`, grants e gates vigentes. Oculta ações não autorizadas sem substituir a autorização backend e distingue `pode visualizar histórico` de `pode vender` e `pode solicitar saque`; restrição posterior não apaga acesso devido a pedidos, saldo, casos ou comprovantes anteriores.

### Compras e acompanhamento pós-compra

- **RF-184 [C/R]** “Minhas compras” lista somente pedidos em que o `User` autenticado é comprador, com cursor opaco, ordem recente, busca e filtros por período, pedido, pagamento, entrega, reembolso e disputa, sem carregar o conjunto integral em memória.
- **RF-185 [C/R]** O detalhe da compra agrega snapshot do produto/anúncio, vendedor permitido, quantidade quando suportada, preço efetivamente pago em moeda fiduciária, taxas, pagamento, entrega e identificadores; referência em gold permanece separada, com fonte e `asOf`, e endereço só existe quando um adaptador de entrega autorizado realmente o exigir.
- **RF-186 [R]** A timeline do detalhe é reconstruída de eventos reais de pedido, pagamento, entrega, `RefundRequest` e disputa, preservando sequência, timestamp e origem; não persiste estado visual próprio nem inventa preparação, envio ou entrega sem evento canônico.
- **RF-187 [C/R]** O detalhe oferece somente quando elegível os comandos existentes de chat, acompanhamento, confirmação, ticket contextual e disputa, além da criação de `RefundRequest`; cada ação usa o serviço de origem e revalida propriedade, estado e permissão no servidor.
- **RF-188 [R]** Pedido, tickets, `RefundRequest`, disputa, decisão, recurso e eventos financeiros exibíveis aparecem relacionados por IDs estáveis, sem copiar integralmente estado, evidência ou histórico entre objetos.

### Painel de vendas, Saldo de vendas e saques

- **RF-189 [C/R]** O painel de vendas, escopado ao `SellerAccount` selecionado e a uma `SellerMembership` autorizada para leitura, ainda que novas mutações estejam restritas, apresenta por período quantidade e valor bruto/líquido de vendas, pedidos que exigem ação, conclusões, cancelamentos, reembolsos, disputas, valores em retenção e liberados; agregados são calculados no backend/read model e valores financeiros usam moeda fiduciária com código de moeda.
- **RF-190 [C/R]** “Minhas vendas” lista com cursor os pedidos visíveis no `SellerAccount`, permite busca e filtros compatíveis com pedido, pagamento, entrega, retenção, disputa, reembolso e liquidação, e abre o pedido canônico sob a perspectiva autorizada do vendedor.
- **RF-191 [C/R]** “Saldo de vendas” apresenta separadamente saldo pendente/protegido, em retenção, disponível para saque, congelado/sob análise e em processamento de saque, sempre a partir do ledger reconciliado e do PSP; cache, view ou read model é derivado, reconstruível, reconciliável e nunca editável como fonte financeira.
- **RF-192 [R]** A composição da retenção mostra por lote ou lançamento venda, valor fiduciário, início, previsão de liberação, situação e motivo permitido de pausa/extensão, com vínculo a disputa, reembolso ou chargeback; previsão nunca é promessa imutável nem apenas contagem regressiva.
- **RF-193 [C/R]** A tela expõe o comando canônico `POST /v1/payouts`, aceita somente saldo disponível confirmado na operação, mostra valor bruto, tarifa, líquido e destino mascarado, exige step-up/cooling-off quando aplicável e usa `Idempotency-Key`; nenhuma interface altera saldo ou cria segundo mecanismo de saque.
- **RF-194 [C/R]** O histórico de saques usa cursor e os estados do `PayoutRequest` existente para mostrar valor, tarifa, líquido, destino mascarado, tentativas, falha, retry, retorno, pagamento e ajustes relacionados, sem máquina de estados paralela.

### Suporte contextual, solicitação de reembolso e contexto administrativo

- **RF-195 [C/R]** A Central de suporte em `/conta/suporte` expõe o ticketing de RF-110–120 e recebe atalhos contextuais de compra, venda, Saldo de vendas, retenção, saque, reembolso e disputa; não cria outro serviço de tickets.
- **RF-196 [R]** Pedido/entrega, pagamento, reembolso, retenção, saque, segurança da conta, anúncio/vendedor, apoio a disputa e outros assuntos são rótulos mapeados à taxonomia canônica do ticketing, não uma segunda enumeração de categoria ou estado.
- **RF-197 [R]** Ticket aberto a partir de outro objeto recebe referências relacionais autorizadas a usuário, pedido, pagamento/transação, payout, `RefundRequest`, disputa e anúncio, categoria sugerida e resumo redigido; IDs conhecidos não são redigitados e PII não é copiada para texto livre.
- **RF-198 [C/R]** A Central lista com cursor somente tickets do usuário, filtra pela taxonomia existente e permite detalhe, mensagens, respostas, anexos, solicitações da staff, SLA e histórico conforme RF-110–120; rótulos visuais mapeiam estados canônicos, incluindo reabertura, sem nova máquina.
- **RF-199 [C/R]** Comprador de pedido elegível cria uma `RefundRequest` integral ou parcial com valor monetário tipado, moeda, motivo estruturado, descrição, evidência permitida e `Idempotency-Key`; propriedade, janela, montante reembolsável e inexistência de solicitação ativa equivalente são validados transacionalmente. Essa entidade só é criada se não houver equivalente e permanece separada de ticket, disputa, refund do PSP, lançamento do ledger e estado do pedido.
- **RF-200 [R]** A `RefundRequest` possui decisão motivada, valor aprovado, maker-checker conforme limite e execução/retry por comandos idempotentes nos motores existentes de PSP e ledger; falha não altera saldo manualmente, não cria nova solicitação e preserva tentativa, referência financeira, auditoria e notificação.
- **RF-201 [R]** Caso controvertido pode vincular uma disputa existente ou acionar, por ator autorizado, o fluxo de RF-139–148, preservando pedido, ticket, `RefundRequest`, evidências, valores e decisões; ticket não vira disputa e o mesmo conflito não gera disputa duplicada.
- **RF-202 [C/R]** O detalhe de ticket em `/admin/suporte` oferece contexto 360° derivado e não editável de conta, `SellerAccount`/`SellerMembership`, pedido, pagamento, entrega, ledger, retenção, payout, ticket, `RefundRequest`, disputa, recurso, notificação e auditoria, com cada seção e ação filtrada por grants, escopo, finalidade, mascaramento e segregação; suporte sem grant financeiro não decide nem executa reembolso.

### Growth Marketplace hierárquico e multi-tenant

- **RF-203 [C/R]** O Growth oferece navegação hierárquica **Plataforma → `SellerAccount` → `SellerMembership`/`User` → objeto canônico**, sem criar `Tenant`, `Member`, cadastro ou perfil duplicado. O `SellerAccount` é o tenant comercial; o usuário permanece identidade global e sua atuação no tenant é resolvida pela membership.
- **RF-204 [R]** Toda métrica possui registro versionado com `metricId`, finalidade decisória, fórmula, numerador, denominador, unidade de contagem, granularidade, janela, timezone, moeda, fonte, exclusões, owner, `asOf` e SLO de freshness. Dashboard referencia o registro; não copia SQL ou redefine a fórmula na tela.
- **RF-205 [C/R]** `/admin/growth` apresenta a visão da plataforma com aquisição, ativação de comprador e vendedor, liquidez, conversão, pedidos concluídos, monetização, confiança e retenção; cada card abre relatório ou lista subjacente e distingue dado completo, parcial, atrasado ou em reconstrução.
- **RF-206 [C/R]** O funil mantém versões aprovadas e informa a unidade de cada etapa. Marcos de transação (`pagou`, `concluiu`, `saldo disponível`, `saque pago`) derivam de eventos canônicos server-side; pageview, clique ou redirect nunca confirmam conversão financeira.
- **RF-207 [C/R]** A lista e o detalhe de tenants mostram estágio atingido, evolução, saúde da oferta, vendas, saldo/hold/payout apenas em projeção permitida, última atividade, situação, bloqueios, anomalias e próxima ação. O drill-down preserva filtros e abre o objeto canônico antes de qualquer comando.
- **RF-208 [C/R]** A lista e o detalhe de membros mostram dados permitidos da conta, papel/membership, progresso comprador e vendedor, milestones alcançados, interações correlacionadas, última atividade, situação, bloqueios e próximo passo. Na plataforma, pessoa única usa `userId`; dentro do tenant, participação única usa `(sellerAccountId, userId)`/`membershipId`, evitando dupla contagem.
- **RF-209 [R]** Coortes de cadastro, primeira compra, primeira publicação, primeira venda e reativação são versionadas, estáveis para o período e comparáveis por tenant/segmento; mudanças de definição criam nova versão e não reescrevem relatórios históricos silenciosamente.
- **RF-210 [R]** A tela de interações expõe ingestão, correlação, atraso, rejeição, lacuna e duplicidade sem revelar payload sensível. Cada contribuição usa `eventId` idempotente, `aggregateVersion`, `correlationId`, `sellerAccountId` e timestamp canônico; ações de staff, bots, testes e preview são marcados ou excluídos conforme a definição da métrica.
- **RF-211 [C/R]** “Oportunidade” é, nesta versão, uma recomendação derivada e não editável com `reasonCode`, evidência, fonte, confiança, `asOf`, prazo de validade e deep link para a próxima ação autorizada. Atribuição, notas, estágio manual ou SLA transformariam a função em novo agregado operacional e exigem PRD/eventos/permissões próprios antes de implementação.

### Pipeline de ativo 3D e visualizador interativo

- **RF-212 [C/R]** O catálogo aceita como fontes de uma versão 3D: GLB/GLTF aprovado, conjunto multi-view coerente ou PNG/SVG de vista única. SVG é validado, sanitizado e rasterizado em ambiente isolado antes da inferência; URI externa, script e conteúdo ativo são rejeitados.
- **RF-213 [R]** O modo de entrada é explícito: `IMPORTED_AUTHORITATIVE`, `MULTI_VIEW_CANDIDATE` ou `SINGLE_VIEW_DRAFT`. Uma única vista nunca recebe o rótulo “exato”, pois faces ocultas são inferidas; publicação como fiel exige fonte autoritativa ou revisão comparativa aprovada.
- **RF-214 [C/R]** A geração ocorre em `Model3DJob` assíncrono e idempotente, relacionado ao item e aos `CatalogAsset` de origem, com estado, progresso real por fase, modelo/provider, versão, seed/configuração, custo/tempo, erro normalizado, tentativas e cancelamento. O job não duplica catálogo, mídia ou moderação.
- **RF-215 [R]** Um adapter de geração encapsula o motor selecionado após benchmark com amostras reais. A saída candidata é GLB/glTF 2.0 com malha, UV, normal e materiais PBR disponíveis; modelo, pesos, licença, hardware e configuração permanecem registrados por versão para reprodução.
- **RF-216 [R]** Pós-processamento valida estrutura glTF, elimina referências externas, centraliza escala/origem, calcula limites, inspeciona malha/material/texturas, aplica simplificação e compressão conforme perfil e gera poster/turntable. Arquivo que ultrapassa limites de bytes, triângulos, draw calls, texturas ou memória estimada não publica.
- **RF-217 [C/R]** Staff autorizada compara vistas de origem, renders fixos e viewer, registra decisão/motivo e só então promove um `Model3DArtifact` imutável como versão ativa do item. Rejeição preserva artefato em quarentena; rollback troca o ponteiro ativo, sem sobrescrever versões.
- **RF-218 [C/R]** Item-base e anúncio exibem poster/estado do artefato e abrem `SCR-PUB-013`; a tela dedicada carrega o GLB aprovado de forma lazy em React Three Fiber/Three.js, com `OrbitControls` limitado, rotação, zoom, pan quando útil, reset, fullscreen, escolha de vista e iluminação neutra. Grade, card e detalhe não mantêm canvases paralelos. Compra e dados críticos permanecem DOM sem depender de WebGL.
- **RF-219 [C/R]** Hotspots e variantes mostram somente metadados canônicos — partes, craft/stickers e vistas — por IDs estáveis. Interagir com o modelo não altera anúncio, craft, preço, estoque ou pedido; qualquer edição usa o fluxo canônico de anúncio/catálogo.
- **RF-220 [R]** O viewer oferece poster 2D e tabela/galeria equivalentes, teclado, instrução de controle, foco visível, `prefers-reduced-motion`, fallback para WebGL indisponível/context lost e perfil adaptativo por dispositivo. Falha do 3D nunca bloqueia leitura, suporte ou compra.
- **RF-221 [C/R]** Cada arma/item com `Model3DArtifact` ativo possui a tela canônica `SCR-PUB-013` em `/itens/:slug/3d`; seleção em card, item-base ou anúncio navega para essa rota e resolve exatamente um item, uma variante selecionada e um artefato aprovado, sem duplicar catálogo, oferta, craft ou estado do modelo.
- **RF-222 [C/R]** A tela dedicada preserva a origem de navegação por parâmetro seguro ou estado de rota, aceita deep link compartilhável e faz “Voltar” retornar à listagem/item/anúncio com filtros e posição recuperáveis. Trocar de item/variante cancela o carregamento anterior e libera canvas, geometria, materiais, texturas, controles e listeners antes de ativar o próximo.
- **RF-223 [C/R]** A abertura executa uma única apresentação premium de **650–900 ms**, do poster à pose neutra: leve revelação limitada a 15° e assentamento de câmera/modelo, sem rotação infinita nem iluminação que esconda defeitos. Primeiro input interrompe imediatamente e entrega controle ao usuário; `prefers-reduced-motion` pula para a pose final sem perda de conteúdo.
- **RF-224 [C/R]** Após a abertura, a tela oferece rotação, zoom, vistas canônicas, reset e fullscreen; alternativa 2D/textual permanece equivalente. Telemetria distingue `route_opened`, poster, artifact ready, intro completed/skipped/interrupted, primeira interação, fallback e descarte, sem interpretar tempo ou rotação como compra e sem PII no payload.

### Pagamento confirmado, resolução manual, hold e saque operacional

- **RF-225 [C/R/D]** Cada `PaymentProvider` — inicialmente adapters candidatos para Stripe Connect, Mercado Pago e Pix — cria tentativa própria, valida credenciais e assinatura, persiste inbox idempotente, consulta o objeto no provedor e reconcilia valor, moeda, recebedor, pedido e estado antes de emitir `PaymentConfirmed`; redirect, print, callback do browser ou card de dashboard nunca confirmam pagamento.
- **RF-226 [C/R]** Divergência “cliente pagou, mas o fluxo não confirmou” abre um `PaymentResolutionCase` vinculado a uma única `PaymentAttempt`, pedido e evidências. Master ou delegado com grant `payment_resolution.decide`, step-up e escopo financeiro pode solicitar nova consulta, associar uma referência órfã, rejeitar a alegação ou aprovar uma resolução documentada; não existe update genérico de status para `PAID`.
- **RF-227 [C/R]** Uma resolução favorável executa o mesmo comando idempotente da confirmação automática. Dentro da mesma proteção concorrente, o sistema revalida unidade, valor, beneficiário e ausência de efeito anterior; se a oferta puder ser reassumida, continua o pedido, caso contrário mantém quarentena e conduz reembolso/compensação. Toda decisão registra maker, checker quando a política exigir, motivo, fonte, referência e diff.
- **RF-228 [C/R]** A confirmação reconciliada cria obrigação, `BalanceLot` e `Hold` com `holdStartsAt=Payment.settledAt` e `eligibleAt=settledAt+168h`, visíveis como protegido/em retenção. Após entrega e confirmação bilateral, o lote fica `EM_HOLD` preservando o relógio já iniciado. Somente pedido concluído, conciliação íntegra, ausência de disputa/freeze/chargeback e `eligibleAt` vencido promovem a `DISPONIVEL`; política futura muda a âncora apenas para novos pedidos e por versão.
- **RF-229 [C/R]** `/admin/saques` oferece fila de `PayoutRequest` pendentes, em revisão, prontas, pagas, falhas, retornadas e canceladas. Operador autorizado pode assumir, revisar KYC/risco/destino, registrar que realizou o pagamento externamente e concluir manualmente com referência/comprovante; conclusão cria `PayoutAttempt`, `PayoutEvidence`, journal e evento idempotentes. Criador não aprova a própria solicitação, e “marcar pago” sem prova ou saldo reservado é rejeitado.

### Avaliação bilateral e reputação verificável

- **RF-230 [C/R]** Após `Order=CONCLUIDO`, comprador e vendedor podem criar uma `OrderReview` independente de 0 a 5 estrelas, vinculada ao papel avaliador, papel avaliado e pedido. Existe no máximo uma avaliação ativa por `(orderId, reviewerRole)` e nenhuma parte avalia a si mesma.
- **RF-231 [R]** Avaliação possui janela configurada, texto opcional moderável e versões. Edição dentro da janela cria nova versão; após o prazo, somente moderação motivada oculta conteúdo ou invalida elegibilidade, sem reescrever a nota histórica silenciosamente.
- **RF-232 [R]** Pedido cancelado, fraudulento, teste, relacionamento colusivo ou reembolsado integralmente não contribui; disputa/chargeback deixa a contribuição pendente ou a recalcula conforme política versionada. O sistema detecta reciprocidade anômala, contas relacionadas e bursts, mas não publica acusação automática.
- **RF-233 [C/R]** `ReputationSummary` separa reputação como comprador e vendedor e informa média, distribuição, contagem elegível, taxa de conclusão, disputas procedentes e janela. Média sem volume não recebe selo de alta confiança; arredondamento e mínimo de amostra são públicos.
- **RF-234 [C/R]** A pessoa avaliada pode responder uma vez e denunciar conteúdo; staff com grant específico revisa abuso, conflito de interesse e dados pessoais, registra motivo e oferece recurso. Moderação textual não altera nota, salvo decisão explícita de inelegibilidade da avaliação.
- **RF-235 [C/R]** Perfil público, anúncio e cápsula do vendedor mostram somente o resumo autorizado, com quantidade e recência; `/conta/avaliacoes` mostra avaliações dadas/recebidas e elegibilidade. Nenhum telefone, pedido, evidência ou motivo privado é revelado.
- **RF-236 [R]** “Confiabilidade” é uma `ReputationProjection` explicável composta apenas por sinais versionados e elegíveis, nunca uma previsão opaca. A interface apresenta fatores positivos/negativos, cobertura, `asOf` e estado `INSUFFICIENT_DATA`; avaliação paga, apagada ou manipulada não aumenta confiança.

### Progressão, recompensas, insígnias e ranking

- **RF-237 [C/R]** A política inicial de nível vendedor usa volume vitalício elegível normalizado em BRL: L1 `R$0–100`; L2 `>R$100–500`; L3 `>R$500–1.000`; L4 `>R$1.000–3.000`; L5 `>R$3.000–5.000`; L6 `>R$5.000–7.500`; L7 `>R$7.500–10.000`; L8 `>R$10.000–20.000`; L9 `>R$20.000–50.000`; L10 `>R$50.000`. Limites inferiores são exclusivos e superiores inclusivos, salvo L10.
- **RF-238 [C/R]** `eligibleSoldBrl` soma principal de pedidos concluídos cujo lote venceu hold e não possui fraude/disputa procedente, menos refund/chargeback elegível; mantém valor/moeda originais, taxa/fonte/data da conversão e contribuição por pedido. Evento duplicado, venda própria, teste e cancelamento valem zero.
- **RF-239 [R]** `AccountLevelAssignment` registra conjunto versionado de `AccountLevelDefinition`, contribuição, nível e `asOf`. Refund posterior pode reduzir o nível corrente; prêmio já concedido não é removido silenciosamente, salvo fraude e regra publicada. Mudança de faixa cria novas definições versionadas e não reclassifica histórico sem migração auditada.
- **RF-240 [C/R]** `/master/progressao` permite ao Master publicar, agendar e aposentar `RewardDefinition` por nível, com nome, descrição, tipo, valor/benefício, estoque/limite, elegibilidade, validade, termos, asset e forma de concessão. Versão publicada é imutável; correção cria sucessora.
- **RF-241 [C/R]** `BadgeDefinition` controla nome, descrição, arte 2D/3D autorizada, slots de perfil, raridade editorial, origem, critério e visibilidade; `BadgeAward` registra destinatário, evento/nível/plano, data e revogação motivada. Slot vazio não mostra insígnia inventada.
- **RF-242 [C/R]** Eventos podem conceder insígnias por regra ou decisão manual com lote idempotente, audiência, período e prova. Master visualiza simulação e impacto antes de publicar; grant manual exige motivo e não altera nível, reputação ou verificação.
- **RF-243 [C/R]** `/conta/conquistas`, perfil público e perfil do vendedor mostram nível, progresso, regras e insígnias autorizadas. Identidade verificada, plano comercial, ranking e badge de evento têm formas/rótulos distintos para não sugerir endosso inexistente.
- **RF-244 [C/R]** Cada `LeaderboardSeason` mensal usa timezone, moeda base BRL, início/fim, elegibilidade e fórmula congelados. Na regra base, cada R$10 elegíveis de vendas concluídas gera 1 ponto (`floor(eligibleBrl / 10)` conforme precisão publicada), com `LeaderboardContribution` rastreável por pedido.
- **RF-245 [C/R/Q]** Venda elegível com snapshot de plano Premium acrescenta literalmente `0,5 ponto por R$1` além da base de `0,1 por R$1`; portanto gera até `0,6 ponto/R$1`, seis vezes a taxa base. A UI e o Master exibem essa consequência; alterar multiplicador exige decisão de negócio e nova versão, nunca ajuste silencioso.
- **RF-246 [C/R]** Ao fechar a temporada, o sistema congela top 3, contribuições, desempate e auditoria. Master define previamente ou vincula depois um `LeaderboardAward` manual por posição; concessão registra recebimento/estado, mas não muda o ranking encerrado.
- **RF-247 [R]** Ranking exclui self-dealing, contas relacionadas, refund, chargeback, fraude, sandbox e pedidos ainda em hold; desempate usa maior valor elegível, menor taxa de disputa procedente e primeiro timestamp de alcance, nesta ordem. Detecção de abuso pode congelar premiação com motivo e recurso, não apagar pontos por update direto.

### Planos de destaque do anúncio

- **RF-248 [C/R]** Ao criar/publicar anúncio, vendedor escolhe um `ListingPlan`: **Básico** com `platformFeeRate=7,5%`, exibição comum; **VIP** com `10%`, prioridade acima do comum e prioridade operacional definida; **Premium** com `12%`, prioridade máxima permitida, bônus mensal e badge por marco. Percentual é tarifa/desconto sobre o valor da venda, não preço de assinatura nem desconto ao comprador.
- **RF-249 [C/R]** `ListingCommercialSnapshot` congela plano, percentuais, benefícios, ranking policy e versão no anúncio e no pedido; checkout mostra bruto, tarifa Midas, tarifa PSP quando aplicável e líquido estimado/confirmado. Mudança de plano só afeta nova publicação ou regra expressamente versionada.
- **RF-250 [C/R]** Prioridade de exposição é um boost limitado dentro de itens elegíveis, disponíveis e relevantes. Resultado pago recebe rótulo `Destaque`/`Patrocinado`, oferece explicação e não elimina diversidade, segurança, filtros ou ordenação escolhida pelo usuário.
- **RF-251 [C/R]** VIP e Premium podem elevar a posição em filas de ticket e reembolso, mas não alteram direito material, decisão, evidência, SLA legal, ordem de incidente crítico ou outcome. A interface separa `queuePriority` de `decision`.
- **RF-252 [C/R]** “Saque prioritário” ordena revisão/executabilidade entre solicitações igualmente elegíveis; nunca reduz 168 horas, KYC/KYB, risco, freeze, maker-checker, disponibilidade financeira ou confirmação de destino.
- **RF-253 [C/R]** O bônus Premium do ranking segue RF-245 somente para valor elegível do pedido com snapshot Premium. Cancelamento, refund, chargeback e reclassificação por fraude geram contribuição compensatória, sem editar o total manualmente.
- **RF-254 [C/R]** Dez vendas Premium concluídas, maduras e elegíveis concedem uma insígnia Premium exclusiva por `BadgeAward` idempotente. Venda que depois se torna inelegível recalcula o marco conforme política publicada; selo não equivale a identidade verificada.
- **RF-255 [C/R]** `/master/planos-de-anuncio` administra versões futuras de taxas, boosts, prioridades, bônus e requisitos, com simulação, aprovação, vigência e rollback para novos snapshots. Nenhum plano hardcoded ou configuração retroativa altera contrato já aceito.

### Carrinho, lifecycle e pós-venda

- **RF-256 [C/R]** `Cart` persistente aceita linhas de anúncios disponíveis e produtos próprios, preserva canal, vendedor, moeda, preço observado, quantidade permitida e expiração; reabrir revalida cada linha e explica alteração/indisponibilidade. Guest cart usa identificador opaco, pode ser mesclado uma vez no login e não reserva unidade por tempo indefinido.
- **RF-257 [C/R/D]** Carrinho pode reunir múltiplos vendedores para descoberta, mas checkout cria `CheckoutGroup` e um `Order` canônico por anúncio/vendedor. Método, moeda, split, tarifa, refund e falha são validados por grupo compatível; se o PSP não suportar liquidação 1:N contratada, a interface separa pagamentos sem fingir uma transação atômica.
- **RF-258 [C/R]** `CartAbandoned` nasce somente após janela versionada de inatividade, identidade/canal correlacionável e ausência de pedido equivalente; nova atividade, conversão, indisponibilidade ou opt-out cancela/suprime o gatilho. Job é idempotente e não transforma abandono em lead vendido.
- **RF-259 [C/R]** Telefone/WhatsApp capturado no cadastro ou checkout fica protegido e vinculado a `ConsentRecord` por finalidade. Vendedor vê contato mascarado e solicita campanha à plataforma; número bruto não é exportado ou revelado por padrão. Compartilhamento direto exige consentimento separado, necessidade e política.
- **RF-260 [C/R]** Lembrete de carrinho contém itens ainda válidos, total atualizado, link assinado de retorno, identidade do remetente e opt-out. Frequência, horário silencioso, template aprovado e supressão por compra/disputa impedem repetição; mídia usa apenas `CreativeAsset` aprovado.
- **RF-261 [C/R]** A taxonomia separa `verticalCode`, `categoryNodeId` e `productClassCode` — por exemplo Standoff/skin, assinatura/Nitro, gift card/Play Store, serviço ou outro catálogo autorizado — de marca, plataforma, região, modalidade de entrega e `ProductLifecyclePolicy`; Standoff pode ser foco editorial sem virar raiz técnica fixa.
- **RF-262 [C/R]** `ProductLifecyclePolicy` classifica `ONE_TIME`, `RENEWABLE`, `EXPIRING`, `CONSUMABLE` ou `SERVICE`, com duração, `expiresAt`/regra de cálculo, renovação, aviso e recorrência permitida. Lifecycle não decide sozinho devolução; `ReturnPolicySnapshot` separado define elegibilidade conforme produto, revelação, entrega e norma aplicável.
- **RF-263 [C/R]** Pedido concluído pode criar oportunidade de recomprar/renovar somente quando lifecycle, compatibilidade, disponibilidade e consentimento permitirem. Janela de aviso deriva de data real; produto sem expiração não recebe lembrete fictício.
- **RF-264 [C/R]** `/conta/vendas/clientes` oferece ao vendedor uma projeção `SellerCustomerInsight` limitada ao próprio `SellerAccount`: pedidos entre as partes, valor/recência/frequência permitidos, lifecycle, consentimentos acionáveis, suporte relevante e próxima oportunidade explicada. Não replica perfil global, risco secreto, telefone ou compras em outro tenant.
- **RF-265 [R]** Sinal de “pode comprar novamente” usa regra ou modelo versionado, amostra mínima, fatores explicáveis, janela, qualidade e `asOf`; exibe `INSUFFICIENT_DATA` quando não há base. Nunca toma decisão de crédito, preço individual, banimento ou envio sem consentimento.
- **RF-266 [C/R]** `CatalogItemRelation` versionada liga produtos como `COMPATIBLE_WITH`, `ACCESSORY`, `BUNDLE_CANDIDATE`, `UPSELL` ou `RENEWAL_OF`, com fonte, direção, prioridade e validade. Recomendação deixa claro por que apareceu e nunca pré-adiciona item ao carrinho.
- **RF-267 [C/R]** Pós-venda acompanha entrega, instrução, avaliação, suporte, renovação e cross-sell em uma jornada por pedido. Conversão encerra o ramo correspondente; refund, disputa, contato excessivo ou pedido do usuário pausam marketing sem bloquear comunicação transacional obrigatória.

### Marketing omnichannel, cupons, afiliados e atribuição

- **RF-268 [C/R]** `ConsentRecord` é append-only por pessoa, canal, finalidade, tenant/operador, origem, política, evidência e timestamp; opt-out cria evento de revogação e `Suppression` efetiva antes do próximo envio. Aceite genérico de termos não vale como consentimento promocional.
- **RF-269 [C/R]** Política de comunicação aplica frequency cap, quiet hours no fuso do destinatário, prioridade, exclusão de menores quando aplicável, lista de supressão e preferência de canal. Mensagem transacional e marketing têm finalidades/templates separados.
- **RF-270 [C/R]** `Campaign` possui objetivo, owner, `SellerAccount` opcional, audiência versionada, oferta, assets, canais, janela, orçamento, cupom/link, variante, aprovação e métricas. Rascunho não envia; publicação congela snapshot e alteração cria versão.
- **RF-271 [C/R/D]** Adapter WhatsApp usa API oficial, templates aprovados quando exigidos, mídia suportada, token em secret manager e webhook autenticado de enviado/entregue/lido/falhou/opt-out. Número e conteúdo sensível não entram em analytics comum; indisponibilidade não dispara por canal alternativo sem consentimento.
- **RF-272 [C/R/D]** Adapter Instagram usa API oficial e permissões contratadas para mensagens/interações permitidas; não faz scraping, automação por senha ou cold DM. Identidade social fica vinculada por autorização/revogação e não substitui `User`.
- **RF-273 [C/R]** `Journey` e `JourneyVersion` orquestram passos, delays persistentes, condições e saídas sobre eventos canônicos; `Dispatch` guarda o envio lógico e `DeliveryAttempt` cada tentativa por canal/provider. Reexecução/replay não duplica envio, e nenhum provedor externo se torna fonte de consentimento ou conversão.
- **RF-274 [C/R]** Vendedor autorizado cria campanha somente no próprio tenant, escolhe segmentos aprovados e vê contagem/resultado agregado. Destinatários brutos, telefones e e-mails não são exportados; Master define limites, templates e capabilities por plano/risco.
- **RF-275 [C/R]** `Coupon` versiona código, campanha/tenant, tipo de desconto, teto, moeda, produtos/categorias, audiência, período, limite total/por pessoa, combinabilidade e financiamento; `CouponRedemption` é reservado/consumido/estornado idempotentemente junto ao checkout.
- **RF-276 [C/R]** `AffiliateAccount` liga pessoa/empresa, tenant/plataforma, verificação, termos e payout destination; link/código assinado registra `affiliateId`, campanha, creator, tenant e validade sem confiar em parâmetros manipuláveis.
- **RF-277 [C/R]** `AttributionTouch` preserva origem, consentimento, timestamp, landing e identificadores pseudônimos. Modelo e janela são versionados; deduplicação, self-referral, cookie reset e cross-device explícito evitam dupla atribuição.
- **RF-278 [C/R]** Comissão de afiliado nasce apenas de pedido reconciliado, concluído e maduro, por `AffiliateCommission` e journal próprios; refund/chargeback compensa a contribuição. Aprovação, hold e payout seguem segregação financeira e nunca somam saldo no browser.
- **RF-279 [C/R]** `CreativeAsset` referencia `CatalogAsset` ou mídia promocional com origem, licença, revisão, alt text, safe-area, versões e expiração. Criativo pode conter imagem/vídeo aprovado, mas não altera a representação factual do anúncio nem inventa preço, review ou urgência.
- **RF-280 [R]** Catálogo de eventos de marketing separa exposição, clique, retorno ao carrinho, opt-out, entrega de mensagem, conversão reconciliada e receita elegível; schema, identidade, tenant, experimento e retenção são versionados. Pixel cliente não confirma venda.
- **RF-281 [C/R]** Painéis de campanha mostram alcance, entrega, opt-out, conversão, receita elegível, custo e atribuição com numerador/denominador, janela, `asOf` e qualidade. Não somam moedas nem creditam canal quando a atribuição é desconhecida.
- **RF-282 [R]** Exportação, correção, oposição e eliminação alcançam perfis de marketing, identidades de canal e ferramentas integradas; retenção legal de transação permanece segregada. Segmento sensível, inferência discriminatória e audiência cross-tenant são proibidos.

### Midas Studio, biblioteca 2D/3D e anúncio pré-preenchido

- **RF-283 [C/R]** Midas Studio é uma superfície sobre os domínios existentes: staff cadastra `CatalogItem`, taxonomia, atributos e `CatalogAsset`; um 3D continua `Model3DJob → Model3DArtifact`. Não cria `StudioProduct`, `Skin3D` ou catálogo paralelo.
- **RF-284 [C/R]** Cada versão de catálogo define visibilidade `PLATFORM_SHARED`, `TENANT_SCOPED` ou `PRIVATE_REVIEW`, licença/território/canal, status e vigência. Tenant acessa apenas itens compartilhados ou próprios autorizados; busca e cache aplicam escopo no servidor.
- **RF-285 [C/R]** `/vender/studio` permite pesquisar por categoria, plataforma, item, variante, lifecycle, formato 2D/3D e disponibilidade, abrir ficha canônica e iniciar o mesmo `Listing`/`ListingRevision` em `DRAFT`, pré-preenchido. Vendedor informa apenas campos específicos da oferta — preço, quantidade permitida, entrega, instruções e prova — sem copiar nome/asset técnico.
- **RF-286 [C/R]** Produto 2D usa galeria responsiva com `CatalogAsset` aprovado, crop não destrutivo, alt text, hash e fallback; vendedor pode submeter imagem própria por `CatalogSubmission` com `submissionKind=ASSET`, em quarentena, nunca publicá-la diretamente.
- **RF-287 [C/R]** Produto 3D usa somente `Model3DArtifact` publicado no viewer individual. Studio pode iniciar/importar job autorizado, acompanhar fases reais e comparar fontes/render; geração, otimização e aprovação seguem RF-212–224.
- **RF-288 [C/R]** Seller/tenant pode propor novo item, variante, asset 2D, multi-view ou GLB por `CatalogSubmission`, com direitos declarados, arquivos, instruções e correlação. Staff deduplica contra catálogo, solicita ajuste, aprova como nova versão ou rejeita; submissão não vira listing publicável antes da decisão.
- **RF-289 [C/R]** `ListingRevision` em estado `DRAFT` referencia IDs/versões do catálogo e mantém overlay comercial separado: preço, plano, disponibilidade, método de entrega, instruções e evidência. Atualização de catálogo sinaliza diferença e exige confirmação; não sobrescreve snapshot de pedido.
- **RF-290 [C/R]** Staff administra relações conexas de RF-266 no Studio e visualiza impacto em busca, cross-sell, bundle e renovação. Relação é curada/explicável, tem início/fim e nunca autoriza oferta incompatível ou indisponível.
- **RF-291 [C/R]** Preview do Studio mostra desktop/mobile, 2D/fallback/3D, card/detalhe/cross-sell, plano patrocinado, lifecycle e acessibilidade usando dados persistidos de draft; “Publicar” executa validação/moderação real, não converte preview local em estado aprovado.
- **RF-292 [R]** Catálogo/Studio mantém provenance, licença, política de IP, scan, revisão humana, versão ativa, rollback e auditoria. Asset removido suspende novas publicações e aciona análise de anúncios dependentes sem apagar evidência ou pedido passado.

### SEO técnico, localização e operação global

- **RF-293 [C/R]** A aplicação pública gera `robots.txt` por ambiente com regras explícitas para rotas públicas, parâmetros sem valor e workbenches autenticados; robots não protege segredo e staging usa controles de acesso além de `Disallow`.
- **RF-294 [C/R]** Sitemaps particionados contêm somente URLs canônicas indexáveis com `lastmod` real. Item, variante, anúncio, locale e paginação aplicam canonical/redirect/hreflang coerentes; conteúdo removido escolhe 301, 404 ou 410 por política, sem cadeia infinita.
- **RF-295 [C/R]** Item/anúncio elegível emite JSON-LD `Product`/`Offer`/`AggregateRating` somente com dados visíveis e válidos — moeda, preço, disponibilidade, vendedor/oferta, avaliação elegível e política aplicável. Dado ausente não é inventado; item digital não é classificado como arma física.
- **RF-296 [C/R]** HTML público entrega título, descrição, breadcrumbs, produto, preço/estado e poster antes de JavaScript/WebGL; 3D permanece progressive enhancement. Metadata social usa `CreativeAsset`/`CatalogAsset` aprovado, dimensão e alt text.
- **RF-297 [C/R]** Locale, idioma, timezone e moeda são conceitos separados. Valor transacional usa moeda contratada do canal; conversão informativa mostra fonte e `asOf`; troca de locale não altera pedido nem soma moedas.
- **RF-298 [C/R/D]** `MarketPolicy` define países, moedas, PSP/métodos, Pix/cartão, requisitos de payer/payee onboarding, KYC/KYB, payout e produtos permitidos. Cadastro para pagar/receber usa sessão hospedada/tokenizada do provedor quando possível; PAN/CVV nunca passa pelo Midas.
- **RF-299 [C/R]** Canal/região/tenant aplica catálogo, preço, política, impostos/documentos, consentimento e disponibilidade por versão. Falta de integração contratada bloqueia a opção com explicação; fallback não finge suporte global.
- **RF-300 [C/R]** Workbench de SEO/conteúdo acompanha cobertura de sitemap, canonical, redirect, schema, indexabilidade, locale, performance e páginas órfãs; alerta abre o objeto fonte e workflow de correção. Nenhum painel edita pedido, preço canônico ou rating para “melhorar SEO”.

## 13. Regras de negócio

1. Anúncio P2P nunca é público antes de aprovação.
2. Comprador vê somente versão publicada; staff autorizada vê histórico.
3. Item sem elegibilidade de craft tem zero posições; item elegível em modo craft tem exatamente quatro posições persistidas.
4. Desmarcar craft limpa posições após confirmação do usuário.
5. Preço em gold é informativo, com fonte e timestamp próximos.
6. Preço próprio do Midas não é alterado automaticamente pelo feed.
7. Contato e segredo ficam ocultos antes de pagamento canônico, conciliado e compatível com uma reserva ainda válida ou reassumida.
8. Mensagem anti-PII bloqueada não é entregue e não entra em logs comuns.
9. A terceira violação restringe imediatamente; revisão humana decide o banimento definitivo.
10. Pagamento só muda por evento autenticado/idempotente e reconciliável.
11. Venda conclui quando `buyerConfirmed && sellerConfirmed` e não há disputa bloqueante.
12. O relógio do hold inicia em `Payment.settledAt` e vence em `settledAt + 168h`; pedido incompleto mantém o lote protegido e bloqueia liberação sem reiniciar o prazo.
13. Liberação exige relógio + conciliação + ausência de freeze.
14. Configuração nova não reescreve contrato passado.
15. Ninguém aprova a própria operação financeira.
16. “Popular”, “desconto” e “últimas unidades” exigem dados reais.
17. Dispositivo confiável reduz fricção, mas não substitui step-up crítico.
18. Um anúncio unitário só pode ter uma reserva ativa e um pedido vendido.
19. Reserva expirada só libera a unidade depois de confirmação canônica de cancelamento/expiração do intent ou tratamento explícito de exceção.
20. Pagamento tardio nunca revela entrega; reassunção ou refund ocorre antes de qualquer continuação.
21. Disputa congela o lote e decisões financeiras são comandos idempotentes, nunca edição de saldo.
22. Recurso preserva a decisão anterior, sua evidência e seu autor; não sobrescreve histórico.
23. Vendedor precisa estar elegível e a prova de posse/disponibilidade válida antes da reserva.
24. Preferência revogada não autoriza novos eventos individualizados; obrigação legal preservada é informada separadamente.
25. Mensagem inbound de e-mail só entra no ticket após autenticação do provedor, thread e remetente.
26. “Saldo de vendas” é visão de obrigações administradas pelo PSP; não representa depósito, conta de pagamento ou custódia própria da Midas.
27. `User` autentica; `SellerAccount` delimita a operação comercial; `SellerMembership` autoriza atuação naquele escopo. Nenhum deles pode ser inferido de ID manipulável enviado pelo cliente.
28. Perder capacidade de vender ou sacar bloqueia a mutação e apresenta motivo/recuperação, mas não apaga histórico, comprovante, saldo devido, ticket, disputa ou recurso que a pessoa ainda deva legalmente acessar.
29. Valor de venda, saldo, retenção, saque, tarifa e reembolso usam tipo monetário com moeda fiduciária; gold é apenas referência separada, versionada e acompanhada de fonte e `asOf`.
30. Read models de conta, compras, vendas, saldo, suporte e contexto 360° são derivados, reconstruíveis e não aceitam comandos nem edição de fatos canônicos.
31. `RefundRequest` expressa o pedido do comprador; refund do PSP executa devolução; journal do ledger registra o efeito; ticket comunica; disputa decide controvérsia. Vínculo não transforma um objeto no outro.
32. Criação, decisão, execução e retry de reembolso são idempotentes e concorrentes seguros; aprovação nunca reserva, libera, estorna ou debita saldo por update manual.
33. Categoria e estado apresentados na Central de suporte são rótulos da taxonomia existente; incompatibilidade exige mapeamento explícito, não enum paralelo.
34. `SellerAccount` é o único tenant comercial. `Tenant` não será outra tabela ou identidade; “membro” é uma projeção de `SellerMembership` + `User` autorizado.
35. Growth, Minha conta e visão 360° nunca autorizam comando. A mutação relê o agregado canônico e revalida estado, versão, membership e permissão.
36. Um evento de domínio produz no máximo uma contribuição por projetor e `metricId`; replay e duplicação não incrementam o resultado duas vezes.
37. Moedas diferentes não são somadas. Toda normalização informa moeda alvo, taxa, fonte e `asOf`; o valor original permanece disponível.
38. Atributo “atual” e atributo “no momento do evento” são dimensões distintas; alterar o perfil hoje não reclassifica silenciosamente o passado.
39. Situação, bloqueio e próxima ação no Growth carregam fonte, código de motivo e freshness; ausência de evento é `UNKNOWN`, nunca sucesso, falha ou zero inventado.
40. A imagem de uma vista não prova geometria oculta; seu resultado é candidato e exige rotulagem + revisão antes de publicação.
41. Modelo 3D publicado é derivado versionado do item de catálogo, não um novo item nem fonte de disponibilidade, craft ou preço.
42. Nenhum GLB/GLTF é servido antes de validação estrutural, remoção de URI externa, quarentena e decisão autorizada.
43. Otimização cria variantes de entrega do mesmo artefato; hash, fonte e versão preservam rastreabilidade até o original aprovado.
44. O viewer é apresentação: eventos de rotação, zoom ou hotspot são analíticos e nunca confirmam posse, compra, entrega ou conversão financeira.
45. `SCR-PUB-013` mantém exatamente um canvas e um `Model3DArtifact` ativo; uma grade de itens não cria um viewer WebGL por card.
46. A entrada animada roda no máximo uma vez por abertura da rota/seleção e termina em pose neutra; não há autoplay contínuo após a entrega dos controles.
47. Qualquer ponteiro, toque, tecla ou comando de acessibilidade aplicável interrompe a entrada e assume controle sem aguardar o fim da animação.
48. React Bits pode animar somente o shell DOM da tela 3D; câmera, modelo, iluminação e ciclo de render pertencem a Three.js/React Three Fiber e obedecem ao mesmo orçamento de desempenho.
49. Provider capability é avaliada por país, moeda, conta e contrato; ausência é `UNSUPPORTED` ou `CONTRACT_REQUIRED`, nunca sucesso mockado.
50. Resolver pagamento manualmente significa decidir um `PaymentResolutionCase` e executar o mesmo settlement idempotente; não significa editar `Payment.status`.
51. Payout externo só termina com tentativa, referência, prova, confirmação exigida pelo modo, journal e auditoria; status de UI não movimenta fundos.
52. O relógio `Payment.settledAt + 168h` é único. Conclusão do pedido, disputa, refund, risco e KYC são gates; não criam outro relógio nem liberam cedo.
53. Nota zero é valor; ausência é `null`. Uma parte só avalia a outra depois de pedido concluído e nunca compra avaliação.
54. Reputação, confiança, nível e ranking são projeções reconstruíveis; nenhum deles concede permissão, altera saldo ou substitui verificação.
55. Faixas de nível usam centavos e limites publicados; venda só contribui quando concluída/madura e reversões geram contribuição compensatória.
56. Temporada encerrada é imutável. Prêmio top 3 tem definição/fulfillment próprio e não reordena a classificação.
57. Premium adiciona literalmente 0,5 ponto por real aos 0,1 base até decisão em nova policy; o efeito 6× permanece visível.
58. Plano comercial é snapshot do anúncio/pedido; boost pago é rotulado, limitado e subordinado a relevância, disponibilidade e segurança.
59. Prioridade de plano altera fila/SLA permitido, nunca direito, mérito de decisão, 168h, risk gate ou segregação.
60. Um carrinho pode conter vendedores distintos; um `Order` não. `CheckoutGroup` separa pedidos, efeitos, refunds e payouts de acordo com a capacidade real do PSP.
61. Abandono é condição temporal derivada e cancelável, não estado permanente do usuário nem autorização de contato.
62. O contato pertence à identidade/cofre da plataforma. Seller opera segmentos autorizados e resultados agregados; telefone/e-mail bruto não é exportado por padrão.
63. Consentimento é específico por canal, finalidade, remetente/tenant, política e evidência; opt-out e supressão vencem fila, retry e objetivo comercial.
64. WhatsApp/Instagram usam somente APIs e capacidades oficiais; não há scraping, cold DM ou login automatizado por senha.
65. Lifecycle do produto, possibilidade de recompra e política de retorno são dimensões diferentes. Ausência de expiração confiável impede lembrete de vencimento.
66. Recomendações/cross-sell informam relação e exigem ação explícita; item não é pré-selecionado, pré-adicionado nem cobrado silenciosamente.
67. Campanha publicada congela audiência/policy/template/asset; mudança cria versão e conversão só vem de evento canônico reconciliado.
68. Cupom, toque de atribuição e afiliado são objetos separados; parâmetro de URL não concede desconto, comissão nem confirmação financeira sozinho.
69. Comissão de afiliado nasce após maturidade do pedido e recebe compensação por refund/chargeback; nunca é calculada como saldo no dashboard.
70. Studio é uma superfície do catálogo/listing/pipeline 3D existentes. Item, mídia e modelo não ganham cópia por tenant ou por anúncio.
71. Seller pode submeter asset/catálogo; somente staff promove versão aprovada e licenciada. Preview nunca equivale a publicação.
72. Relação de produto é versionada, explicável e curada; não transforma item conexo em bundle, estoque ou compatibilidade automática.
73. `robots.txt` governa crawler público e não substitui autenticação, `noindex`, canonical, WAF ou remoção.
74. Sitemap anuncia apenas URL canônica indexável; structured data reproduz exatamente o conteúdo público e rating elegível.
75. Locale, território, canal e moeda são independentes; ausência de provider/política bloqueia mercado sem fallback fictício.

## 14. Máquinas de estado de produto

### Anúncio

`RASCUNHO → ENVIADO → EM_REVISAO → APROVADO → PUBLICADO → RESERVADO → VENDIDO`

Alternativas: `AJUSTES_SOLICITADOS`, `REJEITADO`, `PAUSADO`, `EXPIRADO`, `SUSPENSO`; reserva expirada retorna a `PUBLICADO` somente após cancelamento/expiração canônica do intent ou resolução da exceção de pagamento.

### Pagamento/pedido

`CRIADO → PAGAMENTO_PENDENTE → PAGO → ENTREGA_EM_ANDAMENTO → AGUARDANDO_CONFIRMACOES → CONCLUIDO`

Alternativas: `CANCELAMENTO_PENDENTE`, `CANCELADO`, `FALHOU`, `EXPIRADO`, `PAYMENT_QUARANTINED`, `REEMBOLSO_PENDENTE`, `REEMBOLSADO`, `EM_DISPUTA`, `CHARGEBACK`. `PAYMENT_QUARANTINED` só segue para `PAGO` após reassunção atômica da mesma unidade; caso contrário segue para `REEMBOLSO_PENDENTE`.

### Saldo de vendas administrado pelo PSP

`NAO_FINANCIADO → PROCESSANDO_PSP → PROTEGIDO → EM_HOLD → DISPONIVEL → EM_SAQUE → PAGO`

Alternativas: `CONGELADO`, `ESTORNADO`, `DIVIDA_CHARGEBACK`.

### Conta/PII

`ATIVA[0..2 strikes] → RESTRITA_PENDENTE_REVISAO[3] → ATIVA | SUSPENSA | BANIDA`

`BANIDA/RESTRITA → RECURSO_ABERTO → EM_REVISAO_RECURSO → RECURSO_ACEITO | RECURSO_NEGADO`; aceite retorna ao estado determinado pela decisão humana.

### Disputa

`ABERTA → COLETA_EVIDENCIA → EM_REVISAO → DECIDIDA_BUYER | DECIDIDA_SELLER | DECIDIDA_SPLIT → EXECUCAO_FINANCEIRA → ENCERRADA`

Alternativa: `ENCERRADA → RECURSO_ABERTO → EM_REVISAO_RECURSO → DECISAO_RECURSO → ENCERRADA`. Cada ciclo cria versão própria; nenhum retorno apaga a decisão anterior.

### Cadastro de vendedor

`DRAFT → PENDING_VERIFICATION → ACTIVE`

Alternativas: `RESTRICTED`, `REJECTED`, `CLOSED`; verificação vencida ou destino de recebimento em cooling-off impede publicação, pagamento ou saque conforme política.

### Dispositivo

`DESCONHECIDO → VINCULADO → CONFIAVEL → DESAFIADO → CONFIAVEL`

Qualquer estado pode ir a `QUARENTENA`, `REVOGADO` ou `EXPIRADO`.

### Solicitação de reembolso

`REQUESTED → UNDER_REVIEW → APPROVED | PARTIALLY_APPROVED | DENIED`

Alternativas: `UNDER_REVIEW → AWAITING_CUSTOMER_INFORMATION → UNDER_REVIEW`; aprovação integral ou parcial segue para `PROCESSING → COMPLETED | FAILED`, e `FAILED → PROCESSING` ocorre somente por retry controlado sobre a mesma `RefundRequest`. Esses estados descrevem a solicitação, não substituem `REEMBOLSO_PENDENTE`/`REEMBOLSADO` do pedido/PSP nem `ESTORNADO` do ledger. A interface usa rótulos pt-BR mapeados, sem persistir uma segunda máquina.

### Caso de resolução de pagamento

`OPEN → INVESTIGATING → EVIDENCE_COMPLETE → PROPOSED → APPROVED | REJECTED → EXECUTING → RESOLVED`

Alternativas: `INVESTIGATING → AWAITING_INFORMATION → INVESTIGATING`; concorrência com webhook pode levar a `SUPERSEDED_BY_AUTOMATIC_SETTLEMENT`. `APPROVED` não é `Payment.SETTLED`: a execução reconciliada ainda precisa passar pelo comando canônico.

### Solicitação e execução de saque

`REQUESTED → UNDER_REVIEW → APPROVED → EXECUTING → CONFIRMATION_PENDING → PAID`

Alternativas: `INFORMATION_REQUIRED`, `REJECTED`, `CANCELED`, `FAILED`, `RETURNED`, `REVERSED`. `PayoutAttempt` registra cada execução; retry não cria outra `PayoutRequest`, e retorno/reversão gera postings compensatórios.

### Avaliação do pedido

`ELIGIBLE → SUBMITTED → REVEALED`

Alternativas: `SUBMITTED → REPORTED → UNDER_MODERATION → VISIBLE | CONTENT_HIDDEN | INELIGIBLE`; edição permitida cria versão, resposta não muda a nota e decisão/recurso preservam histórico.

### Carrinho e recuperação

`ACTIVE → CHECKOUT_STARTED → ORDER_GROUP_CREATED → CONVERTED`

Alternativas: `EXPIRED`, `MERGED`, `INVALIDATED`. O read model de recuperação segue `OBSERVING → ELIGIBLE → QUEUED → SENT → CONVERTED`, com saídas `SUPPRESSED`, `INVALIDATED` e `EXPIRED`; ele não substitui `Cart`.

### Campanha e mensagem

`DRAFT → READY_FOR_REVIEW → APPROVED → SCHEDULED → RUNNING → COMPLETED`

Alternativas: `REJECTED`, `PAUSED`, `CANCELED`, `EXPIRED`. Cada `Dispatch` segue `QUEUED → DISPATCHING → ACCEPTED → DELIVERED | FAILED | SUPPRESSED`; leitura/opt-out são `ChannelEvent`, não conversão financeira.

### Submissão do Studio

`DRAFT → SUBMITTED → QUARANTINED → UNDER_REVIEW → APPROVED | CHANGES_REQUESTED | REJECTED`

`APPROVED` promove uma versão de `CatalogItem`/`CatalogAsset` ou inicia job 3D; não publica `Listing` automaticamente.

### Temporada do ranking

`DRAFT → SCHEDULED → ACTIVE → CALCULATING → PROVISIONAL → FINALIZED → AWARDS_PENDING → CLOSED`

`FINALIZED` congela policy/contribuições/ordem. Investigação pode pausar prêmio em `AWARDS_PENDING`, mas ajuste exige contribuição/decisão auditada, não edição de pontos.

## 15. Critérios de aceite críticos

### Craft

```gherkin
Cenário: skin sem craft
  Dado que o vendedor escolheu uma skin válida
  Quando marca “Não possui craft”
  Então os quatro slots não são exibidos
  E nenhum adesivo segue na submissão

Cenário: skin com craft
  Dado que o item-base possui craftEligible=true
  Quando marca “Possui craft”
  Então vê exatamente quatro posições ordenadas
  E só seleciona adesivos ativos do catálogo
  E preenche ao menos uma posição para enviar

Cenário: item não elegível
  Dado que o item-base possui craftEligible=false
  Então o controle “Tem craft?” não é exibido
  E qualquer payload com slots é rejeitado no servidor
```

### Moderação

```gherkin
Cenário: aprovação segregada
  Dado um anúncio EM_REVISAO
  E um moderador com listing.approve sem conflito
  Quando completa o checklist e aprova
  Então a versão analisada fica registrada
  E o anúncio pode ser publicado
  E o vendedor é notificado
```

### Preço

```gherkin
Cenário: feed atualizado
  Dado um anúncio com craft
  E uma fonte autorizada disponível
  Quando o comprador abre a página
  Então vê oferta monetária separada de gold
  E vê preço da skin e de cada adesivo
  E vê fonte e horário
  E o gráfico representa a skin base

Cenário: feed indisponível
  Então nenhum valor é inventado ou exibido como zero
  E o último valor, se houver, aparece como desatualizado

Cenário: alternativa acessível ao gráfico
  Quando uma pessoa usa teclado ou leitor de tela
  Então acessa tabela ou resumo equivalente por período
  E os mesmos valores, fonte, horário e frescor ficam disponíveis sem depender de cor
```

### PII

```gherkin
Cenário: terceira tentativa de alta confiança
  Dado que o usuário possui dois strikes válidos
  Quando tenta novamente compartilhar contato
  Então a mensagem não é entregue
  E a conta fica RESTRITA_PENDENTE_REVISAO
  E o usuário é direcionado ao recurso
```

### Pagamento e revelação

```gherkin
Cenário: pagamento pendente
  Então WhatsApp, mensagem secreta e cofre permanecem ocultos

Cenário: webhook confirmado
  Dado um evento assinado, único e reconciliado
  E uma reserva válida ou reassumida atomicamente
  Quando o pagamento muda para PAGO
  Então a sala de entrega é criada uma vez
  E os dados pós-pagos autorizados ficam acessíveis

Cenário: pagamento confirmado após expiração
  Dado que a reserva expirou
  Quando chega um sucesso tardio do PSP
  Então o pedido entra em PAYMENT_QUARANTINED
  E nenhum contato, mensagem secreta ou cofre é revelado
  E a mesma unidade é reassumida atomicamente ou um refund idempotente é iniciado
```

### Confirmação e hold

```gherkin
Cenário: pagamento liquidado e apenas uma parte confirmou
  Então o pedido não conclui
  E o lote permanece protegido/em retenção
  E nunca fica DISPONIVEL apesar de o relógio continuar

Cenário: ambas confirmaram e não há disputa
  Então o pedido conclui
  E o lote preserva eligibleAt = Payment.settledAt + 168 horas
  E a data prevista e os gates ficam visíveis

Cenário: pedido conclui depois de eligibleAt
  Dado que pagamento, conciliação e demais gates continuam válidos
  Então o lote pode ser liberado sem iniciar outras 168 horas

Cenário: disputa durante o hold
  Então o lote fica CONGELADO e não pode ser sacado
```

### Idempotência

```gherkin
Cenário: webhook repetido cem vezes
  Dado o mesmo providerEventId
  Quando o evento é reenviado
  Então existe exatamente uma transição financeira e um journal válido

Cenário: compras concorrentes
  Dado um anúncio unitário ativo
  Quando cem checkouts tentam reservá-lo
  Então exatamente um pedido vence
```

### E-mail unificado

```gherkin
Cenário: resposta por e-mail
  Dado um webhook assinado e não repetido
  E um token de thread válido
  E um remetente autorizado ou verificado
  Quando o e-mail chega
  Então ele vira mensagem no ticket existente
  E não cria duplicata
  E o portal preserva o histórico mesmo em caso de bounce posterior

Cenário: remetente ou assinatura inválida
  Então o conteúdo não entra na conversa
  E um caso de quarentena auditado é criado sem notificar o cliente como se fosse resposta válida
```

### Disputa e recurso

```gherkin
Cenário: decisão dividida
  Dado que a janela de evidência encerrou
  E o analista não possui conflito
  Quando decide DECIDIDA_SPLIT com valores e reason code
  Então a decisão e a política ficam versionadas
  E comandos financeiros idempotentes somam exatamente o valor elegível
  E as partes são notificadas sobre decisão e prazo de recurso

Cenário: recurso
  Dado que a parte está dentro da janela
  Quando apresenta recurso fundamentado
  Então nasce uma revisão sem apagar decisão ou evidência anterior
  E, quando possível, outro analista recebe o caso
```

### Vendedor, posse e disponibilidade

```gherkin
Cenário: prova vencida no checkout
  Dado que o anúncio estava publicado
  E a prova autorizada de disponibilidade venceu
  Quando o comprador tenta reservar
  Então o checkout não cobra
  E o anúncio é suspenso ou enviado à revalidação

Cenário: mudança de destino de recebimento
  Quando o vendedor cadastra novo destino
  Então ocorre step-up e notificação
  E o cooling-off bloqueia o saque pelo prazo configurado
```

### Direitos sobre dados e idade

```gherkin
Cenário: desligar personalização
  Quando o usuário revoga personalização
  Então novos eventos deixam de alimentar perfil individual
  E o perfil derivado é limpo ou reconstruído dentro do SLA
  E a navegação não personalizada continua funcionando

Cenário: documento usado para aferição de idade
  Quando o sinal mínimo de faixa etária é extraído
  Então imagem e cópia são eliminadas de modo imediato e irreversível quando exigido
  E ficam apenas resultado, método, confiança, validade e trilha de contestação
```

### Minha conta, compras e vendas

```gherkin
Cenário: capacidade sem exposição indevida
  Dado um usuário com histórico de venda e SellerMembership restrita para novas mutações
  Quando abre Minha conta
  Então ainda consulta pedidos, saldo devido e casos próprios
  E não consegue publicar nem solicitar saque enquanto o gate permanecer bloqueado

Cenário: acesso horizontal manipulado
  Dado um pedido ou SellerAccount de terceiro
  Quando o cliente altera o ID da rota
  Então o servidor responde com o padrão seguro de não autorização ou não localização
  E nenhum dado do objeto é revelado

Cenário: paginação por cursor
  Dado um histórico com mais itens que o limite
  Quando a pessoa solicita a próxima janela com nextCursor
  Então recebe itens estáveis sem duplicar nem omitir registros durante a navegação prevista
```

### Saldo de vendas e saque

```gherkin
Cenário: resumo financeiro coerente
  Quando o vendedor autorizado abre Saldo de vendas
  Então valores aparecem em moeda fiduciária e coincidem com o ledger reconciliado
  E qualquer referência em gold fica visual e semanticamente separada

Cenário: submissão repetida de saque
  Dado o mesmo SellerAccount e Idempotency-Key
  Quando a solicitação é repetida
  Então existe um PayoutRequest e uma reserva financeira
```

### Suporte e reembolso

```gherkin
Cenário: ticket contextual
  Dado que o comprador abre suporte a partir de uma compra
  Quando confirma a criação do ticket
  Então o ticketing existente recebe referência ao pedido sem PII copiada para texto livre
  E o usuário não redigita o identificador conhecido

Cenário: reembolso idempotente
  Dado um pedido elegível e um valor reembolsável
  Quando o comprador repete a mesma criação com uma Idempotency-Key
  Então existe exatamente uma RefundRequest
  E nenhum refund do PSP ou journal do ledger ocorre antes de decisão autorizada

Cenário: execução segregada
  Dado uma RefundRequest aprovada e um agente sem refund.execute
  Quando tenta executar a devolução
  Então a operação é negada e auditada
  E nenhum saldo é alterado

Cenário: contexto 360° por menor privilégio
  Dado um agente de suporte sem permissão financeira
  Quando abre o contexto de um ticket
  Então vê somente as seções e campos necessários ao atendimento
  E não decide nem executa reembolso
```

### Growth multi-tenant

```gherkin
Cenário: isolamento entre SellerAccounts
  Dado um agente ou membro autorizado somente no SellerAccount A
  Quando altera sellerAccountId, filtro, cursor ou rota para o SellerAccount B
  Então o servidor não retorna agregado, membro, interação nem objeto do B
  E a tentativa gera evidência auditável sem revelar a existência do alvo

Cenário: marco financeiro vem da fonte canônica
  Dado um clique no retorno do checkout sem webhook conciliado
  Quando o funil Growth é projetado
  Então a etapa pagamento confirmado não é incrementada
  E somente o evento canônico server-side pode contribuir para essa etapa

Cenário: replay não duplica métrica
  Dado o mesmo eventId entregue duas vezes ao projetor Growth
  Quando ambas as entregas são processadas
  Então existe uma contribuição para o metricId
  E o agregado final permanece idêntico ao anterior ao replay

Cenário: membro em dois tenants
  Dado o mesmo User com memberships em A e B
  Quando a plataforma mede pessoas únicas
  Então conta um userId
  Mas o relatório por tenant conta uma participação em A e outra em B

Cenário: drill-down não executa por projeção
  Dado um payout exibido como elegível numa projeção atrasada
  Quando o operador abre a próxima ação
  Então o sistema carrega e reautoriza o PayoutRequest e o saldo canônicos
  E não executa usando o estado do Growth
```

### Ativo 3D e viewer

```gherkin
Cenário: uma vista não é rotulada como exata
  Dado somente um PNG frontal válido
  Quando o job produz uma malha
  Então o artefato permanece SINGLE_VIEW_DRAFT e aguarda revisão
  E a UI informa que superfícies ocultas foram inferidas

Cenário: SVG hostil é rejeitado antes da GPU
  Dado um SVG com script ou referência externa
  Quando a fonte é validada
  Então o arquivo não é rasterizado nem enviado ao gerador
  E o motivo seguro fica auditado

Cenário: aprovação e rollback são versionados
  Dado um candidato aprovado para o item
  Quando uma versão posterior é rejeitada ou sofre rollback
  Então o ponteiro ativo volta à versão aprovada selecionada
  E nenhum binário ou decisão anterior é sobrescrito

Cenário: WebGL indisponível
  Dado um navegador sem WebGL ou com contexto perdido
  Quando a inspeção dedicada do item é aberta
  Então poster, galeria, descrição, preço e CTA continuam utilizáveis
  E o erro do viewer não derruba a página

Cenário: seleção abre uma inspeção individual
  Dado um card ou detalhe de arma com artefato 3D publicado
  Quando a pessoa seleciona “Ver em 3D”
  Então navega para /itens/:slug/3d com somente esse item e sua variante ativa
  E voltar restaura a origem sem criar outro estado de catálogo

Cenário: apresentação termina e entrega controle
  Dado que o poster e o GLB aprovado foram resolvidos
  Quando a tela dedicada fica pronta
  Então a revelação limitada termina entre 650 e 900 ms na pose neutra
  E rotação, zoom, vistas, reset e fullscreen respondem ao usuário sem autoplay contínuo

Cenário: interação e reduced motion interrompem a entrada
  Dado que a apresentação de abertura ainda está em curso
  Quando ocorre o primeiro input ou prefers-reduced-motion está ativo
  Então a animação é interrompida ou pulada imediatamente
  E conteúdo, controles e fallback permanecem equivalentes

Cenário: troca de item libera o anterior
  Dado um item carregado na tela 3D
  Quando a navegação seleciona outro slug ou variante
  Então requests obsoletos são cancelados e recursos do artefato anterior são descartados
  E nunca existem dois canvases ou dois modelos ativos na mesma tela
```

### Resolução financeira e saque manual

```gherkin
Cenário: webhook e decisão humana concorrem
  Dado um PaymentResolutionCase aberto para uma tentativa realmente liquidada
  Quando o webhook reconciliado e a decisão autorizada chegam ao mesmo tempo
  Então existe uma única transição Payment SETTLED
  E um único journal, BalanceLot, Hold e evento de domínio

Cenário: Master resolve alegação sem prova suficiente
  Quando tenta marcar o pagamento como confirmado
  Então o comando falha fechado
  E o caso preserva a alegação, a evidência e a próxima ação
  E nenhum endpoint atualiza PAID diretamente

Cenário: baixa manual de saque
  Dado um PayoutRequest aprovado, reservado e em execução
  Quando operador distinto informa referência externa única e comprovante válido
  Então uma PayoutAttempt, sua PayoutEvidence e os postings finais são criados uma vez
  E o vendedor vê PAGO somente após confirmação/conciliação exigida pelo modo homologado
```

### Avaliação, progressão, ranking e plano

```gherkin
Cenário: zero estrela é avaliação real
  Dado um pedido concluído entre comprador e vendedor distintos
  Quando uma parte envia nota 0
  Então a avaliação guarda zero, não null
  E ausência de avaliação continua separada

Cenário: limites de nível
  Quando o volume elegível é R$100,00
  Então o nível é L1
  Quando o volume elegível passa a R$100,01
  Então o nível é L2

Cenário: bônus Premium literal
  Dado R$100 elegíveis em uma venda com snapshot Premium
  Quando a temporada calcula base e bônus
  Então a contribuição é 10 pontos base + 50 pontos adicionais
  E a tela informa que o total de 60 é seis vezes o Básico/VIP

Cenário: prioridade não compra decisão
  Dado um refund Premium e um Básico com evidência e prazo legal distintos
  Quando a fila é ordenada
  Então prioridade comercial pode afetar primeira análise
  Mas regra, evidência, direito e resultado permanecem iguais
```

### Carrinho, consentimento e pós-venda

```gherkin
Cenário: abandono deixa de ser elegível
  Dado um carrinho inativo com lembrete WhatsApp consentido
  Quando o comprador conclui pedido equivalente antes do dispatch
  Então o candidato é invalidado
  E nenhuma mensagem promocional é enviada

Cenário: opt-out concorre com retry
  Dado um Dispatch aguardando retry
  Quando a pessoa revoga a finalidade promocional
  Então a Suppression vence a fila
  E o provider não recebe nova tentativa

Cenário: vendedor consulta pós-venda
  Dado que o comprador realizou pedidos com SellerAccount A
  Quando um membro autorizado de A abre clientes
  Então vê somente métricas e lifecycle permitidos da relação com A
  E não vê telefone bruto, compras no Seller B ou inferência sem explicação

Cenário: carrinho possui dois vendedores
  Quando o comprador inicia checkout
  Então o CheckoutGroup cria pedidos canônicos separados
  E só apresenta pagamento conjunto se o provider/contrato suportar a alocação real
```

### Studio e SEO global

```gherkin
Cenário: tenant cria anúncio a partir da biblioteca
  Dado um CatalogItem PLATFORM_SHARED com assets aprovados
  Quando o seller inicia um Listing com ListingRevision em DRAFT no Studio
  Então nome, taxonomia e mídia permanecem referências versionadas ao catálogo
  E apenas preço, plano, entrega, instruções e evidência pertencem à oferta

Cenário: submissão 2D não publica direto
  Dado uma imagem enviada pelo seller
  Quando o upload termina
  Então ela fica em quarentena como CatalogSubmission do tipo ASSET
  E só vira CatalogAsset após scan, direitos e decisão staff

Cenário: página de item sem WebGL e JavaScript
  Quando crawler ou usuário acessa o HTML público
  Então título, descrição, preço/estado, seller elegível e poster continuam disponíveis
  E canonical, hreflang, sitemap e JSON-LD concordam com o conteúdo visível
```

## 16. Estados vazios e recuperação

| Situação | Mensagem/estado | Próxima ação |
|---|---|---|
| Busca sem resultado | termo e filtros visíveis | remover filtro, corrigir ou criar alerta |
| Item sem anúncio | item e gráfico sem card falso | favoritar/avisar disponibilidade |
| Feed fora | último valor rotulado ou indisponível | navegar ou tentar novamente |
| Item ausente no catálogo | envio bloqueado sem perder rascunho | solicitar item à staff |
| Anúncio rejeitado | motivos por campo | corrigir e reenviar |
| Reservado por outro | estado inequívoco | ver ofertas semelhantes |
| Pagamento pendente | processamento sem duplicar cobrança | atualização automática/suporte |
| Pagamento tardio | análise sem entrega liberada | acompanhar reassunção ou refund |
| Mensagem com PII | conteúdo não enviado + strike | editar e ler regra |
| Conta restrita | motivo e acesso limitado | abrir recurso |
| Cadastro de vendedor pendente | gate e requisito faltante visíveis | concluir verificação/contestar |
| Prova de posse vencida | anúncio suspenso sem cobrança | revalidar por fonte autorizada |
| Vendedor atrasado | prazo e lembretes | abrir disputa/ticket |
| Partes discordam | pedido congelado | enviar evidência |
| Disputa em recurso | decisão anterior e prazo visíveis | acompanhar revisão |
| Hold ativo | início, previsão e motivo | acompanhar |
| Saque falho | razão corrigível | ajustar destino e tentar novamente |
| E-mail retornou | falha de entrega no ticket | portal ou corrigir endereço |
| Dispositivo novo | desafio de segurança | passkey/2FA/recuperação |
| Integração fora | módulo degradado identificado | pausar fluxo afetado |
| Solicitação LGPD em andamento | protocolo, prazo e escopo | acompanhar ou complementar identidade |
| Preferência sem consentimento | experiência essencial preservada | revisar escolhas |
| Sem compras | histórico vazio e explicação | navegar no Market ou Midas |
| Sem vendas | nenhum pedido no SellerAccount selecionado | gerir ou criar anúncio quando autorizado |
| Saldo de vendas zerado | componentes zerados sem sugerir custódia | consultar extrato ou requisitos de liberação |
| Sem retenção | nenhum lote retido | consultar histórico financeiro |
| Sem saques | nenhuma solicitação anterior | solicitar quando houver saldo disponível |
| Sem tickets | nenhuma solicitação aberta | abrir suporte contextual |
| Reembolso inelegível | motivo e regra aplicável | abrir suporte ou disputa quando cabível |
| Read model atualizando | horário da última atualização | aguardar ou abrir o detalhe canônico |
| Growth sem eventos válidos | `UNKNOWN`, cobertura e período visíveis | revisar instrumentação ou ampliar período |
| Growth atrasado | `DELAYED`/`STALE`, `asOf` e lag visíveis | abrir diagnóstico; comandos seguem no objeto canônico |
| Tenant sem atividade | estágio inicial e último marco conhecido | abrir onboarding/objetos permitidos, sem inventar recomendação |
| Job 3D em fila | fase, posição/ETA somente se calculável e cancelamento permitido | acompanhar sem reenviar |
| Job 3D falhou | código seguro, tentativa e origem preservados | corrigir fonte/configuração ou repetir idempotentemente |
| Modelo 3D ausente/rejeitado | poster e galeria 2D reais | continuar navegação; staff pode iniciar novo job |
| WebGL indisponível/context lost | fallback 2D e aviso não bloqueante | tentar recarregar apenas o viewer |
| Rota 3D sem artefato publicado | identidade do item e poster reais, sem canvas vazio | voltar ao detalhe/galeria 2D ou selecionar outro item |
| Troca 3D ainda carregando | seleção nova inequívoca e poster correspondente | cancelar o pedido anterior; manter apenas a seleção atual |
| Pagamento alegado não reconciliado | caso, evidências e última consulta, sem liberar entrega | complementar prova ou aguardar decisão autorizada |
| PSP sem payout manual homologado | capability `UNSUPPORTED`/`CONTRACT_REQUIRED` | escolher modo/provider autorizado; não simular baixa |
| Nenhuma avaliação elegível | ausência separada de nota zero | concluir pedido elegível ou consultar regras |
| Progressão sem volume elegível | L1, zero real e fórmula visível | realizar venda madura; não inventar progresso |
| Ranking ainda não fechado | posição provisória, freshness e janela | acompanhar; prêmio só após fechamento |
| Carrinho com item indisponível | linha preservada e motivo | remover, substituir ou voltar ao catálogo |
| Lembrete sem consentimento | canal desabilitado e finalidade explicada | conceder consentimento opcional ou usar inbox própria |
| Pós-venda sem dados suficientes | `INSUFFICIENT_DATA` e fatores ausentes | ampliar janela sem revelar contato ou outro tenant |
| Campanha sem audiência elegível | filtros, supressões e contagem zero | revisar segmentação/consentimento; não forçar envio |
| Studio sem item compatível | busca/taxonomia preservadas | propor CatalogSubmission com direitos e arquivos |
| Asset 3D não aprovado | poster/galeria 2D e estado de revisão | acompanhar job/submissão; não publicar candidato |
| Página não indexável | motivo de policy/canonical/status visível no workbench | corrigir objeto fonte ou aceitar exclusão |

## 17. Requisitos não funcionais

- **RNF-001:** autorização server-side por objeto, campo, `SellerAccount` e `SellerMembership` em toda leitura privada e operação privilegiada.
- **RNF-002:** TLS e criptografia em repouso para dados sensíveis.
- **RNF-003:** senha, token, 2FA, PII crítica e segredo nunca em logs.
- **RNF-004:** webhook assinado, idempotente e tolerante a repetição/ordem invertida.
- **RNF-005:** ledger e auditoria append-only.
- **RNF-006:** reserva, venda, saldo, payout e criação/execução de `RefundRequest` são transacionais; read models não recebem comandos financeiros.
- **RNF-007:** SLOs definidos e medidos antes do lançamento.
- **RNF-008:** modo degradado para preço/e-mail sem corromper pedidos.
- **RNF-009:** meta WCAG 2.2 AA.
- **RNF-010:** datas em UTC, exibidas no fuso do usuário.
- **RNF-011:** correlação entre pedido, pagamento, entrega, ticket, `RefundRequest`, disputa, payout e ledger sem cópia integral de estado.
- **RNF-012:** backup, restauração e desastre testados.
- **RNF-013:** retenção distinta por finalidade e classe.
- **RNF-014:** integrações com timeout, retry, circuit breaker e conciliação.
- **RNF-015:** testes concorrentes cobrem reserva, webhook, hold, saque e criação/decisão/execução de `RefundRequest`.
- **RNF-016:** nenhum PAN/CVV trafega ou é persistido pela Midas.
- **RNF-017:** admin possui origem e política de sessão mais restritas.
- **RNF-018:** mensagens em tempo real possuem sequência e idempotência por cliente.
- **RNF-019:** toda corrida expiração/cancelamento/webhook preserva a unicidade da unidade e do efeito financeiro.
- **RNF-020:** inbound de e-mail valida assinatura, timestamp, thread, remetente e replay antes da persistência.
- **RNF-021:** fluxos de direitos do titular possuem SLA, trilha, segregação de terceiros e exportação segura.
- **RNF-022:** gráficos possuem equivalente textual/tabular testado com teclado e leitor de tela.
- **RNF-023:** checkout hospedado mantém escopo PCI aplicável documentado e nenhum PAN/CVV no Midas.
- **RNF-024:** relatório e interface financeira diferenciam obrigação PSP/terceiros de receita própria, fecham por moeda fiduciária e nunca apresentam gold como saldo sacável.
- **RNF-025:** política pública e comprovante de contratação permanecem versionados, conserváveis e acessíveis.
- **RNF-026:** toda projeção Growth, índice e cache é escopado por `sellerAccountId`; autorização server-side e teste negativo impedem leitura cross-tenant, com RLS como defesa em profundidade quando adotada.
- **RNF-027:** eventos analíticos possuem `eventId`, schema/version, timestamps, aggregate/version, correlação e identidade de tenant; ingestão é idempotente e mede atraso, rejeição, lacuna e replay.
- **RNF-028:** respostas Growth expõem `asOf`, `projectedAt`, `lagMs`, `freshness` e versão da definição; nenhuma ausência é convertida implicitamente em zero.
- **RNF-029:** dados analíticos não carregam e-mail, telefone, chat, segredo, destino financeiro ou payload de evidência; identificadores são mínimos e a exportação respeita grant e finalidade.
- **RNF-030:** definições de métrica/funil/coorte são versionadas, testáveis e mantêm paridade entre total, filtro, drill-down e exportação dentro da tolerância documentada.
- **RNF-031:** jobs 3D executam em worker isolado com limite de entrada, CPU/GPU, memória, tempo, concorrência e egress; falha ou arquivo malformado não afeta API transacional.
- **RNF-032:** GLB publicado passa por validador glTF, scan de conteúdo, limites de complexidade e remoção de referências externas; fonte, hash, provider/model/version e decisão permanecem auditáveis.
- **RNF-033:** viewer 3D carrega sob demanda, pausa fora da viewport, usa renderização `demand`, limita DPR/qualidade por capacidade e libera geometria, materiais, texturas e listeners no unmount.
- **RNF-034:** orçamento inicial por variante 3D, a confirmar em benchmark, deve registrar bytes transferidos, triângulos, draw calls, memória estimada, tempo até poster e tempo até interação; não existe aprovação baseada só na aparência desktop.
- **RNF-035:** viewer possui fallback DOM/2D funcional, controles por teclado, alternativa a hotspots, reduced motion e testes de WebGL context loss, mobile, zoom 200% e leitor de tela.
- **RNF-036:** `SCR-PUB-013` mantém um único canvas/renderer e um único artefato ativo; troca de rota/variante aborta fetch/decode obsoleto e comprova por teste o descarte de geometria, materiais, texturas, controles, observers e listeners, sem crescimento contínuo de memória.
- **RNF-037:** código e dependências 3D são carregados por rota; os budgets separam tempo até poster, tempo até artefato interativo e duração da entrada de 650–900 ms. Preload adjacente é opcional, limitado a um candidato e desativado quando rede/dispositivo/budget não comportarem.
- **RNF-038:** a apresentação de abertura é interrompível por input, não captura foco, não depende de áudio e possui caminho `prefers-reduced-motion` direto à pose neutra; controles, instruções, alternativa 2D e navegação de retorno são testados por teclado, toque e leitor de tela.
- **RNF-039:** adapters financeiros publicam capabilities por provider, país, moeda, tipo de conta e contrato; caminho `UNSUPPORTED` falha fechado, e sandbox/reconciliação real provam qualquer função declarada pronta.
- **RNF-040:** resolução manual de pagamento e baixa de payout exigem step-up, grants atômicos, segregação, idempotência, referência externa única, evidência privada verificada e journal append-only; nenhuma rota aceita edição direta de `PAID`, saldo ou posting.
- **RNF-041:** reviews, confiança, nível e ranking resistem a self-dealing, Sybil, replay, refund e chargeback por contribuições idempotentes/versionadas; nota pública não revela pedido, PII, regra secreta de risco ou parte não autorizada.
- **RNF-042:** progressão, fee, boost, recompensa, badge e temporada são determinísticos a partir de snapshots/policies; rebuild com a mesma entrada produz o mesmo resultado em centavos/pontos e não reescreve período encerrado.
- **RNF-043:** toda decisão de marketing consulta consentimento e supressão canônicos no instante do dispatch; opt-out invalida mensagens ainda não entregues dentro do SLA definido, propaga aos processors e é testado sob corrida com fila/retry.
- **RNF-044:** WhatsApp e Instagram usam API oficial, segredo server-side, assinatura/webhook, limites, template/janela e políticas vigentes; cold outreach, scraping, login por senha e fallback de canal não consentido falham fechados.
- **RNF-045:** carrinho, checkout group, abandono, jornada, mensagem, cupom e atribuição usam chaves idempotentes, locks/constraints e timers persistentes; TTL de cache/Redis nunca é a única fonte de expiração ou elegibilidade.
- **RNF-046:** Studio aplica isolamento server-side, scan, limites de arquivo, provenance/licença, egress controlado, versionamento e rollback a 2D/3D; asset privado de um tenant nunca é enumerado, servido ou sugerido a outro.
- **RNF-047:** crawl, canonical, hreflang, sitemap, status e JSON-LD possuem testes por template/locale; HTML essencial funciona sem JavaScript/WebGL e dado estruturado nunca diverge de preço, disponibilidade, seller ou rating visível.
- **RNF-048:** moeda é inteiro em unidade mínima com ISO 4217/precisão própria; FX informativo ou de consolidação registra fonte, par, taxa, instante e rounding, enquanto pedido/ledger preservam valor original e nunca somam moedas cruas.
- **RNF-049:** filas de marketing/asset/analytics possuem quota por tenant, backpressure, DLQ, retry com jitter, observabilidade e replay; cache key-value é descartável, limitado por TTL/memória e não hospeda ledger, consentimento ou fato final.
- **RNF-050:** eventos financeiros, consentimentos, campanhas publicadas, reviews moderadas, grants, policies, decisões e evidências possuem auditoria, classificação, retenção, legal hold, export/delete aplicável e acesso por finalidade; logs/analytics permanecem minimizados.

## 18. Métricas

### Funil protegido

- busca → anúncio aberto;
- anúncio → chat/proposta;
- proposta → checkout;
- checkout → pagamento confirmado;
- pago → confirmação bilateral;
- conclusão → saldo liberado;
- tempo e abandono por etapa/motivo.

### Oferta e operação

- rascunho abandonado;
- aprovação na primeira submissão;
- SLA e motivos de moderação;
- tempo até primeira venda;
- disponibilidade por canal;
- pedidos presos por estado/idade;
- divergência PSP/ledger;
- holds vencidos não liberados;
- pagamentos tardios por resultado: reassumido, refundado, divergente e tempo de resolução;
- falha/tempo de saque;
- tickets fora de SLA e reabertura.
- compras/vendas que exigem ação e latência/frescor dos read models da conta;
- divergência entre resumo de Saldo de vendas e ledger reconciliado: objetivo zero.

### Confiança

- disputa/chargeback/reembolso por 100 pedidos;
- solicitação de reembolso por motivo, elegibilidade, resultado, tempo de decisão e falha/retry de execução;
- tempo de disputa, decisão split, recurso e taxa de reversão;
- PII bloqueada, reincidência e recurso procedente;
- falso positivo do detector;
- conta comprometida;
- decisão administrativa revertida;
- segredo detectado fora do cofre: objetivo zero.

### Dados e recomendação

- cobertura e frescor de preço;
- lacunas de histórico;
- zero-result rate;
- diversidade por vendedor/item;
- conversão incremental com guarda de disputa/reclamação;
- ativo sem proveniência ou licença: objetivo zero publicado.
- cadastros de vendedor pendentes/rejeitados por motivo e tempo;
- prova de posse vencida, revalidação falha e compra bloqueada antes de cobrança;
- solicitações de titular dentro/fora do SLA;
- usuários com personalização desligada e tempo de limpeza do perfil;
- cobertura da alternativa acessível ao gráfico: objetivo 100%.

### Growth por decisão

- aquisição: visitante → cadastro, com origem/campanha somente quando capturada de modo confiável;
- ativação do comprador: cadastro → primeira compra concluída e tempo até valor;
- ativação do vendedor: onboarding → primeira publicação → primeira venda → saldo disponível → primeiro payout;
- liquidez: buscas sem resultado, intenção por anúncio, sell-through e tempo até venda por categoria/tenant;
- conclusão confiável: pagamento → entrega → conclusão → saldo disponível, com abandono e tempo entre etapas;
- retenção: recompra e vendedor recorrente por coorte, sempre com janela e unidade explícitas;
- saúde do tenant: atividade, oferta, conversão, resposta, conclusão, reembolso/disputa, payout e freshness;
- qualidade analítica: eventos aceitos/rejeitados/duplicados, lag p50/p95, lacunas de versão, rebuild e paridade dashboard↔drill-down.

### Pipeline e experiência 3D

- jobs solicitados, concluídos, falhos, cancelados e aprovados por `provider/modelVersion` e modo de entrada;
- tempo de fila, inferência, pós-processamento, revisão e publicação p50/p95;
- taxa de rejeição por geometria, textura, fidelidade, complexidade, segurança e licença/proveniência ausente;
- bytes, triângulos, draw calls, memória estimada e redução por otimização, sem degradar o perfil aprovado;
- viewer solicitado → poster → GLB carregado → primeira interação, segmentado por dispositivo/rede;
- WebGL indisponível, context lost, fallback 2D e erro de decode por versão;
- abertura da rota 3D → poster → artefato pronto → entrada concluída/pulada/interrompida → primeira interação, com descarte confirmado na troca de item;
- interação 3D seguida de detalhe/checkout somente como diagnóstico; não usar a correlação para alegar causalidade sem experimento.

### Financeiro operacional, reputação e progressão

- confirmação automática versus reconciler versus resolução humana, com tempo, causa, valor e taxa de reversão;
- `PaymentResolutionCase` aberto, aging, resultado, decisão revertida e efeito duplicado: objetivo zero;
- lote em `PROTECTED`, `HELD`, `FROZEN`, `AVAILABLE` e tempo real entre `settledAt`, conclusão e disponibilidade;
- payout por estado, modo, prioridade, aging, falha, retorno, referência/prova ausente: objetivo zero em `PAID`;
- review elegível, submetida, bilateral, denunciada, moderada e inválida por abuso;
- cobertura/frescor de `ReputationProjection`, nível e contribuições compensatórias;
- sellers por nível, tempo de progressão, grants/rewards pendentes e revogações;
- pontos base versus Premium, concentração, exclusões, fechamento e premiação top 3;
- conversão, fee líquida, ticket/refund/payout SLA e diversidade por plano, sem inferir causalidade sem experimento.

### Carrinho, pós-venda e marketing

- add-to-cart, checkout, abandono elegível, recuperação, conversão e invalidação por motivo;
- repetição/renovação por lifecycle, janela e fonte de expiração;
- audiência elegível, suprimida e `INSUFFICIENT_DATA` por tenant;
- mensagens queued/accepted/delivered/failed/suppressed e latência de opt-out;
- frequency cap, quiet-hour deferral, complaint/quality e cold-send bloqueado;
- receita reconciliada, refund e opt-out atribuídos por campanha/modelo/versão;
- coupon reservation/redemption/reversal e fraude;
- affiliate touch, comissão pendente/madura/compensada e self-referral bloqueado;
- nenhum telefone/e-mail bruto exportado ao seller: objetivo 100% de proteção.

### Studio, SEO e alcance global

- submissão, deduplicação, scan, revisão, publicação e rollback por tipo 2D/3D;
- cobertura de provenance/licença, assets órfãos e cross-tenant leak: objetivo zero;
- ListingRevision em DRAFT iniciada pelo Studio → submetida → aprovada → primeira venda;
- URLs submitted/fetched/indexed/excluded/error por sitemap e template;
- canonical/hreflang/schema divergentes, redirect chains, soft 404 e página órfã;
- Core Web Vitals por template/locale/dispositivo e poster antes do 3D;
- coverage de locale, moeda e provider capability sem “global” falso;
- touch/cupom/afiliado até outcome reconciliado, com `UNJOINED` explícito.

## 19. Anti-métricas

Não otimizar isoladamente:

- GMV bruto;
- tempo no site;
- quantidade de mensagens ou banimentos;
- CTR sem transação protegida;
- velocidade de aprovação sacrificando qualidade;
- liberação sacrificando risco;
- escassez/urgência sem fato;
- exposição que favorece Midas escondendo oferta P2P melhor;
- concentração de recomendação;
- tickets fechados rapidamente e reabertos.
- quantidade de eventos, usuários “ativos” ou oportunidades sem decisão associada;
- animação, rotação 3D, tempo no viewer ou cliques em hotspot como proxy isolada de valor;
- jobs 3D gerados sem aprovação, fidelidade e orçamento de entrega;
- conversão obtida escondendo fallback, fonte, limitação do modelo ou estado stale.
- mensagens enviadas, carrinhos “recuperados” ou contatos capturados sem considerar opt-out, reclamação e compra real;
- review média sem amostra/elegibilidade, level inflado por venda reembolsada ou ranking bruto sem compensações;
- adoção de Premium, boost ou CTR patrocinado sem diversidade, refund, disputa e benefício líquido;
- páginas indexadas, palavras-chave ou conteúdo gerado em massa sem utilidade, conversão protegida e manutenção;
- quantidade de assets/jobs/submissões do Studio sem licença, aprovação, reuso e performance.

## 20. Decisões de produto e engenharia ainda abertas

Estas decisões mudam contratos, estados ou testes e não devem ser preenchidas por mock. Premissas jurídicas, fiscais, de publisher e licença de ativos são fornecidas pelo dono do projeto no documento próprio; não são decididas por este PRD.

1. **PSP e fluxo de fundos:** provider, `charge/transfer/payout`, moedas, métodos, limites, fees, reserva e saldo negativo.
2. **Hold e payout:** a âncora desta versão está fechada em `Payment.settledAt + 168h`; faltam provider/território/contrato que suportem o papel financeiro, o modo `PROVIDER_API | PROVIDER_DASHBOARD | EXTERNAL_BANK` e a política de falha/retorno.
3. **Refund parcial:** janela, elegibilidade, motivos, evidências, taxas, responsável econômico, dívida após payout e limites de maker-checker.
4. **Disputa e entrega:** evidência aceita, SLAs, tratamento de inatividade e capacidade real de transferência de cada tipo de item.
5. **Seller lifecycle:** requisitos, revalidação, prova de posse/disponibilidade, grants por membership e acesso histórico após restrição/encerramento.
6. **Growth semântico:** versão inicial dos funis comprador/vendedor, North Star, unidade de cada etapa e catálogo de métricas.
7. **Growth temporal:** timezone e moeda de consolidação, janelas de coorte, SLOs `FRESH/DELAYED/STALE`, retenção para replay e tolerância de paridade.
8. **Evolução de oportunidade:** a versão atual permanece read-only; qualquer futuro owner/nota/status/SLA exige novo agregado operacional, PRD, eventos, permissões e migração explícita, sem reaproveitar a projeção como fonte de escrita.
9. **Analytics e identidade:** origem confiável, regra de anonymous→user merge, exclusão de staff/bot/teste e política de dimensões históricas.
10. **Motor 3D:** benchmark real entre TRELLIS.2, Hunyuan3D e alternativa contratada; hardware, throughput, custo, licença e estratégia self-hosted/provider.
11. **Fidelidade 3D:** vistas mínimas, tolerância de comparação, quem aprova, quais itens aceitam single-view draft e quando GLB autoritativo é obrigatório.
12. **Orçamento 3D web:** perfis mobile/desktop de bytes, triângulos, draw calls, textura, DPR, memória, tempo até poster/artefato interativo e limite da entrada dedicada, medidos em dispositivos-alvo.
13. **Stack de frontend:** versão React, build tool, CSS/Tailwind e variante React Bits; sem isso, nenhum comando de instalação é tratado como contrato.
14. **Operação:** SLAs de moderação, suporte, reembolso, payout, geração/revisão 3D, e-mail e recuperação de integrações.
15. **Observabilidade e DR:** SLOs, RPO/RTO, retenção, destino de telemetria, processo de replay e critérios de rollback.
16. **Reputação:** janela/reveal de review, mínimo de amostra, fórmula pública de confiança, antiabuso e regra de moderação da nota zero.
17. **Progressão:** política de downgrade/reversão, tipo/estoque/tributação de rewards e lifecycle das insígnias de evento.
18. **Planos:** confirmar que 7,5%/10%/12% são tarifas sobre a venda e aceitar ou alterar por nova policy o bônus Premium literal de 6×.
19. **Carrinho multivendedor:** provider/checkout capaz de agrupar cobrança ou UX de pagamentos separados, reserva por linha e tratamento de falha parcial.
20. **Canais:** WABA/Meta business, números, template categories, janela, quotas, opt-in, processors e rollout allowlisted; Instagram permanece resposta a conversa iniciada pelo usuário enquanto a API assim exigir.
21. **Cupons/afiliados:** funding, combinabilidade, modelo/janela de atribuição, percentual de comissão, hold, imposto/documento e antifraude.
22. **Lifecycle:** taxonomia final, fonte de expiração, política de retorno por família e produtos/regiões autorizados além de Standoff.
23. **SEO/global:** domínio, locale inicial, estratégia URL, conteúdo indexável, política de crawlers de treinamento, moedas/países e Search Console.
24. **Build vs. buy:** decisão de POC entre Chatwoot, Dittofeed/Mautic, PostHog/GrowthBook, Valkey e CMS/BI, com licença e saída.
25. **Marca:** busca marcária, logo vetorial, fontes/ícones, tokens compilados, templates de campanha e validação de acessibilidade.

## 21. Critério de prontidão

O PRD está pronto para implementação quando:

- dependências críticas de publicador, preço, ativos, pagamento, entrega e categoria de conta estão resolvidas;
- estados e transições não possuem caminho órfão;
- RBAC/ABAC, maker-checker e segregação financeira foram aprovados;
- modelo PSP, enquadramento contratual, fiscal/contábil e escopo PCI foram aprovados;
- onboarding do vendedor, KYC/KYB, destino de recebimento e prova autorizada de posse/disponibilidade foram contratados;
- exceções de pagamento, liquidação tardia, disputa, recurso, split/refund e hold foram contratadas;
- matriz de capabilities por PSP/país/moeda/conta prova confirmação, settlement, hold, split e payout; função não suportada permanece bloqueada;
- elegibilidade, reembolso integral/parcial, efeito financeiro e segregação de `RefundRequest` foram contratados;
- regra de review, confiança, níveis, bônus Premium, rewards, badge e premiação foi publicada com reversões e testes de borda;
- carrinho multivendedor, lifecycle, consentimento, contatos, canais, frequency cap, cupons, afiliados e atribuição possuem contratos e responsáveis;
- biblioteca Studio possui taxonomia, provenance, licença, revisão, tenant visibility, submissions e budgets 2D/3D;
- URL/crawl/index/schema/locale/moeda e política de mercado foram aprovados e testados por template;
- idade mínima/garantia de idade, direitos LGPD, cookies e personalização opt-out foram aprovados;
- uma matriz gerada automaticamente liga cada RF da release a superfície, contrato/domínio, evento/estado e evidência de aceite, sem RF nem artefato órfão;
- ameaça P0 possui controle e teste;
- fontes e direitos estão registrados;
- piloto financeiro, procedimento operacional e políticas públicas versionadas foram aprovados.

**Status atual:** **PRÉ-CÓDIGO**. O blueprint permite iniciar scaffold e provas isoladas depois da escolha da stack, mas o repositório ainda não contém aplicação para integrar ou validar. O gate **G4 — Domínio permanece PENDENTE** até contratos estruturados e rastreabilidade executável; a matriz manual orienta o handoff, mas não substitui OpenAPI, schemas, código e testes reais.

## 22. Matriz de rastreabilidade por blocos

Esta matriz oferece cobertura contínua de `RF-001` a `RF-300`. As ligações de cada linha são representativas do bloco; o detalhamento automatizado um-a-um exigido por G4 ainda deve demonstrar, para cada RF, superfície, contrato/domínio, evento/estado, teste e responsável.

| RFs | Superfícies principais | Contrato/domínio | Estado ou evento principal | Evidência de aceite representativa | Épico |
|---|---|---|---|---|---|
| `RF-001–010` | `/entrar`, `/cadastro`, `/conta/seguranca`, `/admin/confianca` | identidade, sessão, passkey/MFA, device trust | sessão/dispositivo confiável, desafiado ou revogado | BOLA/IDOR, step-up, revogação e recuperação testados | E2, E3 |
| `RF-011–018` | `/admin/catalogo`, `/itens/:slug` | catálogo, taxonomia, mídia e proveniência | item/adesivo/ativo em rascunho, aprovado, desativado | importação idempotente, licença/proveniência e fallback visual | E4 |
| `RF-019–036` | `/vender/novo`, `/vender/anuncios`, `/anuncios/:id` | anúncio, craft, conta condicional e cofre | `RASCUNHO → EM_REVISAO → PUBLICADO` ou correção/rejeição | cenários de craft, quatro slots e conta bloqueada em Standoff 2 | E5 |
| `RF-037–043` | `/admin/anuncios`, `/admin/usuarios` | fila de moderação, checklist e decisão | aprovado, correção solicitada, rejeitado | motivo obrigatório, permissão atômica e impedimento de autoaprovação | E5, E14 |
| `RF-044–052` | `/`, `/market`, `/midas`, `/buscar` | busca, ranking, recomendação e diversidade | busca/visualização/favorito/compra alimentam ou não o perfil conforme preferência | relevância, diversidade, explicação e fallback não personalizado | E6, E15 |
| `RF-053–062` | `/itens/:slug`, `/anuncios/:id` | cotação, histórico, frescor e proveniência | preço atual, atrasado ou indisponível | fonte/data visíveis, sem total enganoso de craft e alternativa tabular/textual | E7 |
| `RF-063–076` | `/mensagens`, `/anuncios/:id`, `/admin/confianca`, `/conta/recurso` | conversa, proposta, anti-PII, strikes e restrição | mensagem aceita/bloqueada; conta advertida/restrita/em recurso | testes adversariais de PII/ofuscação, concorrência de strikes e recurso | E8 |
| `RF-077–090` | `/checkout/:intentId`, `/pedidos/:id/entrega`, `/conta/compras`, `/conta/vendas` | reserva, pedido, pagamento, entrega e segredo pós-pagamento | reserva/pagamento/pedido conforme máquinas da seção 14 | webhook assinado e idempotente, revelação somente após pagamento válido e dupla confirmação | E9, E11 |
| `RF-091–102` | `/conta/carteira` *(alias)*, `/conta/saques`, `/admin/financeiro` | ledger, hold, conciliação, saldo de vendas e payout via PSP | `PENDENTE → EM_HOLD → DISPONIVEL → SAQUE_SOLICITADO → PAGO` | partidas balanceadas, reconciliação, retry/idempotência e nenhum PAN/CVV | E10, E12 |
| `RF-103–109` | `/midas`, `/admin/midas` | estoque próprio, preço e identificação do canal | item Midas disponível, reservado, vendido ou retirado | separação P2P/Midas, transparência do operador e estoque consistente | E6 |
| `RF-110–120` | `/conta/suporte`, `/admin/suporte` | tickets, inbox, threading, anexos e SLA | ticket aberto, em atendimento, aguardando, resolvido/reaberto | e-mail↔ticket sem duplicidade, isolamento de anexos e segredo redigido | E13 |
| `RF-121–132` | `/admin`, `/master`, `/master/auditoria` | IAM administrativo, grants, configuração, feature flag e auditoria | concessão/revogação e mudança versionada | menor privilégio, maker-checker, log imutável e break-glass auditado | E14 |
| `RF-133–138` | `/conta`, `/admin`, canais de notificação | notificação, outbox e analítica de produto | evento transacional gera entrega, retry ou dead-letter | deduplicação, preferência de canal e eventos sem PII/segredo indevido | E13, E15 |
| `RF-139–148` | `/pedidos/:id/entrega`, `/conta/recurso`, `/admin/pedidos`, `/admin/financeiro` | disputes, evidence, decisions, appeals e execução financeira | `ABERTA → EVIDENCIAS → EM_REVISAO → DECIDIDA → EXECUTADA → ENCERRADA`, com recurso | TTL, acesso bilateral, decisão `BUYER`/`SELLER`/`SPLIT`, refund/split idempotente e recurso | E11 |
| `RF-149–157` | `/vender/cadastro`, `/vender/novo`, `/admin/usuarios`, `/admin/anuncios` | seller onboarding, KYC/KYB, payout destination, ownership proof e capabilities | vendedor pendente/aprovado/rejeitado/suspenso; prova válida/vencida | gates de elegibilidade, titularidade do destino, revalidação no checkout e `craftEligible` | E0, E5 |
| `RF-158–166` | `/cadastro`, `/conta/privacidade`, `/conta/preferencias` | age assurance, privacy, consent/preferences e data-rights | idade pendente/verificada/recusada; solicitação LGPD recebida/validada/atendida | defaults protetivos, exportação/correção/eliminação e limpeza do perfil no opt-out | E0, E2, E15 |
| `RF-167–169` | `/admin/suporte`, webhook de e-mail | inbound email, assinatura, replay defense, thread token e quarantine | mensagem aceita, rejeitada ou em quarentena | assinatura/timestamp/nonce, remetente autorizado, token escopado/expirável e replay bloqueado | E13 |
| `RF-170–175` | `/itens/:slug`, `/anuncios/:id`, `/checkout/:intentId`, `/admin/financeiro`, rotas públicas | acessibilidade, policy snapshot, recibo, fiscal e contabilidade | política/oferta congelada por versão; documento fiscal pendente/emitido/falho | tabela equivalente ao gráfico, aceite versionado, taxas claras e separação entre obrigação PSP e receita Midas | E0, E7, E10, E16 |
| `RF-176–180` | `/checkout/:intentId`, `/admin/financeiro` | payment intent, reservation, late-payment exception e refund | `CANCELAMENTO_PENDENTE`/`PAYMENT_QUARANTINED`/`REEMBOLSO_PENDENTE` até desfecho | corrida P0 entre expiração e webhook, reaquisição atômica ou reembolso idempotente, sem dupla venda | E9, E10, E16 |
| `RF-181–183` | `/conta`, `/conta/seguranca`, `/conta/privacidade`, `/conta/preferencias` | overview derivado, capability projection, `User`, `SellerAccount` e `SellerMembership` | cards e ações acompanham fontes/gates sem estado próprio | BOLA/IDOR, read versus mutate e acesso histórico sob restrição testados | E2, E3, E14 |
| `RF-184–188` | `/conta/compras`, `/pedidos/:id/entrega` | projeção de pedido comprador, timeline e relações de casos | eventos canônicos de pedido/pagamento/entrega/refund/disputa | cursor estável, propriedade, moeda versus gold e ausência de estado duplicado | E9, E11, E13 |
| `RF-189–194` | `/conta/vendas`, `/conta/carteira` *(alias)*, `/conta/saques` | dashboard derivado, ledger reconciliado, hold e payout existentes | saldo e PayoutRequest canônicos; read model reconstruível | escopo de membership, moeda fiduciária, reconciliação, step-up e idempotência | E10, E12 |
| `RF-195–198` | `/conta/suporte`, `/admin/suporte` | ticketing existente, taxonomia mapeada e vínculos contextuais | estados e SLA do ticketing sem enum paralelo | cursor, propriedade, referências sem PII copiada, anexo seguro e notificação | E13 |
| `RF-199–201` | `/conta/compras`, `/conta/suporte`, `/admin/suporte`, `/admin/financeiro` | `RefundRequest` separado, `RefundAttempt`, PSP/ledger e dispute engine | `REQUESTED → UNDER_REVIEW → APPROVED/DENIED → PROCESSING → COMPLETED`; falha pertence à tentativa e retorna à revisão/retry | valor elegível, concorrência, maker-checker, efeito financeiro único e escalonamento sem duplicidade | E10, E11, E13 |
| `RF-202` | `/admin/suporte`, `/admin/financeiro`, `/admin/usuarios` | contexto 360° derivado com autorização por seção/campo | fontes permanecem canônicas; leitura/ação sensível auditada | menor privilégio, mascaramento, sem N+1 e nenhuma edição de ledger/saldo | E11, E13, E14 |
| `RF-203–211` | `/admin/growth/*`, `/conta/vendas/growth` | metric catalog, snapshots e contribuições derivadas; tenant = `SellerAccount` | milestones/eventos canônicos → projeções com `asOf/freshness`; oportunidade permanece read-only | isolamento cross-tenant, dedupe/replay, paridade, coortes, moeda/timezone, no-PII e drill-down que reautoriza o objeto | E14, E15, E16 |
| `RF-212–220` | `/itens/:slug`, `/anuncios/:id`, `/admin/catalogo`, `/admin/catalogo/modelos-3d/:jobId` | `CatalogAsset` existente + `Model3DJob`/artefato derivado versionado + adapter de geração + viewer R3F | job assíncrono → validação → revisão → artefato aprovado; viewer nunca muda domínio | single-view rotulado draft, SVG/GLB hostil bloqueado, rollback versionado, budgets mobile/desktop, WebGL fallback e acessibilidade | E4, E6, E16 |
| `RF-221–224` | `/itens/:slug/3d`, com entrada por card, item-base ou anúncio | `Model3DArtifact` ativo + manifesto público + shell DOM/React Bits + canvas R3F | rota resolve um item/variante; intro finita entrega controle; troca descarta o anterior | deep link/Back, um canvas ativo, interrupção/reduced motion, fallback 2D, leak test e telemetria sem PII | E6, E16 |
| `RF-225–229` | `/admin/pagamentos`, `/admin/saques`, `/conta/carteira`, `/conta/saques` | provider capabilities, `PaymentResolutionCase`, settlement canônico, Hold, `PayoutAttempt`/`PayoutEvidence` | evento assinado ou caso decidido → um settlement; `settledAt+168h`; request→attempt→paid/return | sandbox/provider lookup, corrida webhook×staff, bordas temporais, SoD, referência/prova e journal único | E10, E12, E14, E19 |
| `RF-230–236` | `/conta/avaliacoes`, `/vendedores/:id`, `/admin/avaliacoes` | review bilateral, resposta/report/moderação e `ReputationProjection` derivada | eligible→submitted→revealed/moderated; reputation rebuild | nota 0≠null, participante/pedido, cross-tenant, antiabuso, recurso e explicabilidade | E11, E19 |
| `RF-237–247` | `/conta/conquistas`, `/ranking`, `/recompensas`, `/master/progressao` | progression policy/contribution/snapshot, reward, badge, ranking season/award | contribuição madura/compensatória; season active→finalized→awarded | limites em centavos, replay, refund/chargeback, Premium 6×, desempate e prêmio auditado | E19 |
| `RF-248–255` | `/vender/novo`, `/anuncios/:id`, `/master/planos-de-anuncio` | listing plan policy + commercial snapshot + queue priority | policy publicada → snapshot no listing/order → fee/boost/benefits | 7,5/10/12%, rounding, disclosure patrocinado, não bypass de direito/hold/risco | E19 |
| `RF-256–267` | `/carrinho`, `/conta/vendas/clientes`, detalhe/checkout/pós-venda | `Cart`, `CheckoutGroup`, lifecycle/return policy, relações e insights derivados | cart active→group/orders; abandoned candidate; completed→review/renew/cross-sell | revalidação, multi-seller split seguro, expiração real, consentimento, PII e `INSUFFICIENT_DATA` | E20 |
| `RF-268–282` | `/conta/vendas/marketing`, `/admin/marketing`, `/master/marketing` | consent/suppression, campaign/journey/message, coupon, affiliate, attribution e commission | consent→dispatch/status; touch/coupon→order outcome→commission madura/compensada | opt-out×retry, template/webhook, no cold DM, tenant isolation, fraude e outcome server-side | E20, E22 |
| `RF-283–292` | `/vender/studio`, `/admin/studio`, `/admin/catalogo`, `/itens/:slug/3d` | catálogo/asset existentes, submission, `ListingRevision` em `DRAFT`, relation e pipeline 3D | submit→quarantine→review→catalog version; draft→moderation→publish | dedupe, licença/scan, visibility cross-tenant, preview≠publish, 2D fallback e budgets | E4, E18, E21 |
| `RF-293–300` | rotas públicas, `/admin/marketing` e configuração Master | crawl policy, sitemap/canonical/hreflang/schema, locale/currency/market policy | catalog/listing events → HTML/metadata/sitemap; redirect/remove; provider gate | parser/crawler, schema-vs-HTML, no private URL, Core Web Vitals, FX e mercado unsupported | E22 |

**Saída exigida para fechar G4:** artefato gerado no pipeline que expanda as linhas acima para `RF-001` a `RF-300`, falhe em RF/tela/API/evento/estado/teste órfão e seja revisado por Produto, Engenharia, Segurança, Operações, Financeiro, Marketing, Privacidade e Catálogo. Até essa evidência existir, esta matriz é um scaffold de handoff, não um sign-off.

## 23. Encerramento da versão 3.0

RF-225–255 fecham operação financeira manual, reputação, progressão, ranking e planos; RF-256–282 adicionam carrinho, lifecycle, pós-venda, canais, cupons, afiliados e atribuição; RF-283–292 definem o Studio como extensão do catálogo/3D existentes; RF-293–300 tratam crawl, conteúdo, localização e mercados. Nenhum bloco cria segundo usuário, tenant, pedido, saldo, catálogo, consentimento ou conversão.

A implementação foi iniciada, mas este PRD continua sendo **baseline de requisitos**, não evidência automática de conclusão. Stack, OpenAPI/schemas, rastreabilidade e testes reais já existem para os cortes registrados em `08-ADRS-DECISOES-ARQUITETURAIS.md` e `12-MATRIZ-DE-IMPLEMENTACAO.md`; todo RF fora desses cortes permanece pendente. Decisões e integrações externas são fornecidas pelo dono e nunca podem ser escondidas em mocks ou em estados de sucesso inventados.
