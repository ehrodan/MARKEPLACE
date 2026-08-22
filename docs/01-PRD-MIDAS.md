# PRD — Midas Marketplace

Versão 1.1 · Documento pré-código · 21 de agosto de 2026

> **Gate P0 — NO-GO atual.** A operação descrita contraria as [Regras oficiais do Standoff 2](https://help.standoff2.com/pt-BR/articles/8446575-regras-do-jogo) sem permissão expressa. A categoria de contas contraria também a [EULA](https://standoff2.com/en/eula.html) e o [Code of Conduct](https://help.standoff2.com/en/articles/15253027-code-of-conduct). Este PRD é uma especificação condicional: nenhum marketplace, API, asset ou entrega real de Standoff 2 deve ser implementado/publicado antes de autorização escrita da Axlebolt.

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
| Master | Governar configuração e administradores | Privilégios excessivos e ação sem trilha |

## 6. Objetivos

- **[C]** Publicar anúncios P2P somente após aprovação manual.
- **[C]** Permitir catálogo administrável de itens e adesivos.
- **[C]** Modelar crafts com quatro posições condicionais.
- **[C]** Exibir preço atual e histórico em gold da skin base e preço dos adesivos.
- **[C]** Permitir negociação no site com bloqueio anti-PII antes da compra.
- **[C]** Abrir sala pós-pagamento para entrega e confirmação bilateral.
- **[C]** Manter o saldo em retenção por sete dias antes do saque.
- **[C]** Permitir mensagem automática e WhatsApp somente após pagamento.
- **[C]** Oferecer tickets e caixa própria de e-mail na operação.
- **[C]** Oferecer painel Master e ADM com permissões granulares.
- **[C]** Proteger contas por passkeys/2FA e confiança de dispositivo.
- **[C]** Personalizar descoberta a partir de busca, visualização e compra.
- **[R]** Aumentar conversão por clareza, relevância e confiança, sem padrão manipulativo.

## 7. Não-objetivos do MVP

- Aplicativo nativo.
- Leilões, loyalty, mídia patrocinada ou crédito próprio.
- Carrinho multivendedor; cada pedido compra um anúncio.
- Transferência automatizada dentro do jogo sem API oficial autorizada.
- Custódia financeira própria ou armazenamento de PAN/CVV.
- Precificação automática do anúncio do vendedor ou do estoque Midas.
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
| Item-base | `/itens/:slug` | Histórico, referência e ofertas disponíveis |
| Anúncio | `/anuncios/:id` | Oferta, craft, vendedor, chat, gráfico e compra |
| Vendedor público | `/vendedores/:id` | Reputação e anúncios públicos |
| Favoritos | `/conta/favoritos` | Itens e ofertas salvos |
| Entrar/cadastrar | `/entrar`, `/cadastro` | Identidade |
| Segurança | `/conta/seguranca` | MFA, passkeys, sessões e dispositivos |
| Conta | `/conta` | Resumo transacional |
| Criar anúncio | `/vender/novo` | Wizard estruturado |
| Meus anúncios | `/vender/anuncios` | Rascunhos, revisões e publicados |
| Conversas | `/mensagens` | Chat e propostas pré-compra |
| Checkout | `/checkout/:intentId` | Reserva e pagamento |
| Entrega | `/pedidos/:id/entrega` | Sala, cofre, contato e confirmações |
| Compras | `/conta/compras` | Pedidos do comprador |
| Vendas | `/conta/vendas` | Pedidos do vendedor |
| Saldo de vendas | `/conta/carteira` *(alias técnico legado; nome público: Saldo de vendas)* | Valores administrados pelo PSP: pendente, hold, disponível e extrato |
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
| Catálogo | `/admin/catalogo` | Itens, adesivos, taxonomia e ativos |
| Confiança | `/admin/confianca` | PII, fraude, restrições e dispositivos |
| Pedidos | `/admin/pedidos` | Entrega e disputas |
| Suporte/inbox | `/admin/suporte` | Tickets e e-mails unificados |
| Financeiro | `/admin/financeiro` | Conciliação, hold, reembolso e saque |
| Estoque Midas | `/admin/midas` | Inventário e preço próprio |
| Usuários | `/admin/usuarios` | Status e histórico permitido |
| Master | `/master` | IAM, configuração e integrações |
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
```

Estes nomes e caminhos são canônicos para o OpenAPI e coincidem com o documento de arquitetura. Os rascunhos `/seller-onboarding`, `/me/data-rights/requests` e `/admin/payment-exceptions` estão aposentados e não devem virar aliases implícitos.

Todos os endpoints de mutação usam autorização por objeto/campo, `Idempotency-Key` quando houver efeito repetível, auditoria e `application/problem+json`. Evidência, recursos, dados pessoais e exceções financeiras exigem escopo próprio e nunca são retornados por listagens genéricas.

## 10. Hierarquia e permissões

### Níveis funcionais

- **L0 — Usuário:** comprador; vendedor após requisitos de segurança.
- **L1 — Agente:** suporte ou moderador júnior com escopo limitado.
- **L2 — Especialista:** catálogo, confiança, financeiro ou estoque Midas.
- **L3 — Admin gerente:** gerencia filas e membros do próprio domínio.
- **L4 — Master:** governa roles, configurações e integrações.

A política combina `role template + grants explícitos + escopo + expiração + deny`. Um L4 continua incapaz de editar ledger histórico, segredo de autenticação ou auditoria imutável.

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
| Admin gerente | staff/configuração do domínio | conceder o que não possui |
| Master | RBAC, configuração e emergência | editar fatos financeiros históricos |

### Permissões atômicas mínimas

`catalog.read/write/publish`, `asset.manage`, `listing.review/approve/reject/override`, `midas.inventory/manage_price`, `chat.review`, `user.restrict/ban/unban`, `appeal.resolve`, `ticket.read/reply/assign/close`, `email.reply`, `order.read/intervene`, `dispute.resolve`, `refund.request/approve`, `hold.freeze/release`, `payout.request/approve`, `payment.configure`, `roles.read/manage`, `admin.invite/revoke`, `device.review/revoke`, `audit.read/export`, `feature_flag.manage`.

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
10. Se não houver disputa, começa a retenção de 168 horas.
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
- **RF-093 [C]** Confirmação bilateral inicia sete dias de retenção.
- **RF-094 [R]** Padrão: 168 horas a partir de `completedAt`, em UTC.
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
12. Hold inicia em `completedAt` e expira em `completedAt + 168h`.
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
Cenário: apenas uma parte confirmou
  Então o pedido não conclui e o hold não inicia

Cenário: ambas confirmaram e não há disputa
  Então o pedido conclui
  E o lote entra em hold por 168 horas
  E a data prevista fica visível

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

## 17. Requisitos não funcionais

- **RNF-01:** autorização server-side em toda operação privilegiada.
- **RNF-02:** TLS e criptografia em repouso para dados sensíveis.
- **RNF-03:** senha, token, 2FA, PII crítica e segredo nunca em logs.
- **RNF-04:** webhook assinado, idempotente e tolerante a repetição/ordem invertida.
- **RNF-05:** ledger e auditoria append-only.
- **RNF-06:** reserva, venda e saldo são transacionais.
- **RNF-07:** SLOs definidos e medidos antes do lançamento.
- **RNF-08:** modo degradado para preço/e-mail sem corromper pedidos.
- **RNF-09:** meta WCAG 2.2 AA.
- **RNF-10:** datas em UTC, exibidas no fuso do usuário.
- **RNF-11:** correlação entre pedido, pagamento, entrega, disputa e ledger.
- **RNF-12:** backup, restauração e desastre testados.
- **RNF-13:** retenção distinta por finalidade e classe.
- **RNF-14:** integrações com timeout, retry, circuit breaker e conciliação.
- **RNF-15:** testes concorrentes cobrem reserva, webhook, hold e saque.
- **RNF-16:** nenhum PAN/CVV trafega ou é persistido pela Midas.
- **RNF-17:** admin possui origem e política de sessão mais restritas.
- **RNF-18:** mensagens em tempo real possuem sequência e idempotência por cliente.
- **RNF-19:** toda corrida expiração/cancelamento/webhook preserva a unicidade da unidade e do efeito financeiro.
- **RNF-20:** inbound de e-mail valida assinatura, timestamp, thread, remetente e replay antes da persistência.
- **RNF-21:** fluxos de direitos do titular possuem SLA, trilha, segregação de terceiros e exportação segura.
- **RNF-22:** gráficos possuem equivalente textual/tabular testado com teclado e leitor de tela.
- **RNF-23:** checkout hospedado mantém escopo PCI aplicável documentado e nenhum PAN/CVV no Midas.
- **RNF-24:** relatório financeiro diferencia obrigação PSP/terceiros de receita própria e fecha por moeda.
- **RNF-25:** política pública e comprovante de contratação permanecem versionados, conserváveis e acessíveis.

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

### Confiança

- disputa/chargeback/reembolso por 100 pedidos;
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

## 20. Questões que bloqueiam contrato técnico final

1. PSP, métodos, moeda, países, taxas e limites.
2. Recebedor, split/subconta, reserva e saldo negativo.
3. Autorização escrita da Axlebolt para comércio externo e entrega.
4. Fonte autorizada de catálogo, PNG, preço e histórico.
5. Mecanismo oficial de transferência/entrega.
6. Cadência mínima que poderá ser chamada “tempo real”.
7. Evidência aceita e prazos de disputa.
8. Regra para inatividade de uma parte; recomendação MVP: sem confirmação automática.
9. Janela e expiração de strikes.
10. Contatos bloqueados além de telefone, e-mail, nick, Pix e redes.
11. WhatsApp por texto, deep link ou integração oficial.
12. Retenção de sinais de recomendação e dispositivo.
13. Provedor de e-mail, domínios e aliases.
14. Passkey obrigatória para quais perfis.
15. Valores que exigem maker-checker.
16. Aprovação do próprio estoque Midas.
17. Conteúdo editável pelo Master/CMS.
18. Comissão P2P versus Midas.
19. SLAs de moderação, entrega, disputa, suporte e saque.
20. Idade mínima, identidade do vendedor e KYC aplicável.
21. Bases legais, transparência e direitos do titular.
22. Papel contratual e financeiro da Midas em cada fluxo: marketplace/intermediadora, merchant of record, agente de cobrança ou outro enquadramento aprovado.
23. Escopo PCI DSS, modelo de checkout hospedado/tokenizado e responsabilidades entre Midas e PSP; PAN/CVV não podem entrar nos sistemas Midas.
24. Documento fiscal de venda/comissão, responsável pela emissão, eventos tributáveis, retenções e relatórios exigidos por jurisdição.
25. Método de garantia de idade, eventual consentimento do responsável e tratamento regional de menores.
26. Papéis de controlador/operador, canal do encarregado, SLAs por direito LGPD, retenção, fornecedores e transferência internacional.
27. TTL e fonte de verdade do PSP para expiração, cancelamento e liquidação tardia; regra comercial de reaquisição ou reembolso.
28. Forma autorizada, validade e cadência de revalidação da prova de posse/disponibilidade do item.
29. Critérios, periodicidade e provedor de KYC/KYB, titularidade do destino de recebimento e tratamento de revalidação/reprovação.

## 21. Critério de prontidão

O PRD está pronto para implementação quando:

- dependências críticas de publicador, preço, ativos, pagamento, entrega e categoria de conta estão resolvidas;
- estados e transições não possuem caminho órfão;
- RBAC/ABAC, maker-checker e segregação financeira foram aprovados;
- modelo PSP, enquadramento contratual, fiscal/contábil e escopo PCI foram aprovados;
- onboarding do vendedor, KYC/KYB, destino de recebimento e prova autorizada de posse/disponibilidade foram contratados;
- exceções de pagamento, liquidação tardia, disputa, recurso, split/refund e hold foram contratadas;
- idade mínima/garantia de idade, direitos LGPD, cookies e personalização opt-out foram aprovados;
- uma matriz gerada automaticamente liga cada RF MVP a superfície, contrato/domínio, evento/estado e evidência de aceite, sem RF nem artefato órfão;
- ameaça P0 possui controle e teste;
- fontes e direitos estão registrados;
- piloto financeiro, procedimento operacional e políticas públicas versionadas foram aprovados.

**Status atual:** **NO-GO**. O gate **G4 — Domínio permanece PENDENTE** até a geração automatizada e a revisão da matriz por requisito. A matriz manual abaixo cobre todos os intervalos de RF e fornece ligações representativas, mas não comprova rastreabilidade perfeita nem substitui testes, contratos ou revisão humana.

## 22. Matriz de rastreabilidade por blocos

Esta matriz oferece cobertura contínua de `RF-001` a `RF-180`. As ligações de cada linha são representativas do bloco; o detalhamento automatizado um-a-um exigido por G4 ainda deve demonstrar, para cada RF, superfície, contrato/domínio, evento/estado, teste e responsável.

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

**Saída exigida para fechar G4:** artefato gerado no pipeline que expanda as linhas acima para `RF-001` a `RF-180`, falhe em RF/tela/API/evento/estado/teste órfão e seja revisado por Produto, Engenharia, Segurança, Operações e Financeiro. Até essa evidência existir, esta matriz é um scaffold de handoff, não um sign-off.
