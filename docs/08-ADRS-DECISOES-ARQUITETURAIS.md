# ADRs e decisões arquiteturais — Midas Marketplace

Versão 2.1 · Contrato vivo com registro de execução · 23 de agosto de 2026 · 19 ADRs

> **Escopo:** decisões técnicas implementáveis para o motor de marketplace. Este documento não faz análise jurídica. O estado formal da ADR e o estado da implementação são distintos: aceite continua humano; evidência técnica só é registrada após execução no pipeline ou em ambiente controlado.

## 1. Como usar este documento

- **PROPOSTA** significa que a decisão orienta a implementação, mas ainda depende de aceite formal e evidência executável.
- Ao aceitar uma ADR, registrar responsável e data no histórico de decisões; não apagar contexto ou alternativas.
- Mudança incompatível deve criar nova ADR e marcar a anterior como substituída.
- A ordem de precedência é: invariantes aceitas nas ADRs, contratos versionados, testes de contrato/arquitetura e implementação.
- Valores operacionais configuráveis, como limites de aprovação e retenção, não podem alterar invariantes financeiras ou de isolamento.
- Os checkboxes de evidência são critérios de saída, não afirmações de trabalho já concluído.

## 2. Índice de decisões

| ADR | Decisão | Estado |
|---|---|---|
| ADR-001 | Monólito modular com API, realtime e workers | PROPOSTA |
| ADR-002 | PostgreSQL canônico, outbox/inbox e concorrência explícita | PROPOSTA |
| ADR-003 | User autentica; SellerAccount é tenant; SellerMembership autoriza | PROPOSTA |
| ADR-004 | PSP movimenta fundos; ledger registra obrigações; hold, transfer e payout são distintos | PROPOSTA |
| ADR-005 | Liquidação tardia entra em PAYMENT_QUARANTINED | PROPOSTA |
| ADR-006 | RefundRequest, RefundAttempt, refund, ledger, ticket e disputa permanecem separados | PROPOSTA |
| ADR-007 | CQRS pragmático com read models reconstruíveis | PROPOSTA |
| ADR-008 | Growth multi-tenant com freshness, deduplicação, RLS e drill-down seguro | PROPOSTA |
| ADR-009 | Autorização contextual, segregação de funções, step-up e auditoria | PROPOSTA |
| ADR-010 | REST /v1, idempotência transversal e application/problem+json | PROPOSTA |
| ADR-011 | Observabilidade correlacionada, reconciliação, replay controlado e DR testado | PROPOSTA |
| ADR-012 | Contratos e documentação versionados como gates de entrega | PROPOSTA |
| ADR-013 | Pipeline 2D→3D assíncrono, versionado e revisado | PROPOSTA |
| ADR-014 | Payment resolution, hold de 168h e payout manual comprovável | PROPOSTA |
| ADR-015 | Reputação, progressão e leaderboard são projeções versionadas | PROPOSTA |
| ADR-016 | Consentimento e capabilities governam o pós-venda omnicanal | PROPOSTA |
| ADR-017 | Studio reutiliza catálogo e anúncio; submissão não é produto paralelo | PROPOSTA |
| ADR-018 | Plano comercial do anúncio é policy versionada e snapshot | PROPOSTA |
| ADR-019 | Mercado, SEO e crawl derivam de publicação e políticas canônicas | PROPOSTA |

### 2.1 Registro de implementação verificado em 23/08/2026

Este registro impede que documentação, rota ou interface sejam confundidas com função pronta. `VALIDADO NO CORTE` significa que o comportamento indicado possui código e teste executado; não significa que toda a ADR foi aceita ou concluída. Integrações sem contrato/adaptador real permanecem **fail-closed**.

| ADR | Estado técnico atual | Evidência executada e limite explícito |
|---|---|---|
| ADR-001 | PARCIAL · VALIDADO NO CORTE | API, realtime, worker e módulos separados; teste de fronteira e ciclos passou. Isolamento de processos sob falha ainda não possui game day. |
| ADR-002 | PARCIAL · VALIDADO NO CORTE | PostgreSQL canônico, migrations `0001–0006`, outbox/inbox e transações seriais; banco local retornou `CURRENT`. Concorrência de todos os domínios ainda não está coberta. |
| ADR-003 | PARCIAL · VALIDADO NO CORTE | `User`, `SellerAccount` e `SellerMembership` distintos, com integração real de cadastro e tenant. RLS de todos os módulos ainda não existe. |
| ADR-004 | PARCIAL · VALIDADO NO CORTE | Finance persiste journal balanceado, lotes, hold e payout separados. Reconciliação com PSP contratado real segue bloqueada. |
| ADR-005 | IMPLEMENTADA NO CORTE FINANCEIRO | Settlement tardio de pagamento cancelado gera `PAYMENT_QUARANTINED`, sem journal, lote ou hold; reassociação/refund completo ainda é outro corte. |
| ADR-006 | NÃO IMPLEMENTADA | Não existe módulo canônico de `RefundRequest`/`RefundAttempt`; as telas permanecem `CONTRACT_REQUIRED`. |
| ADR-007 | NÃO IMPLEMENTADA | Não há infraestrutura geral de projeções reconstruíveis/checkpoints. |
| ADR-008 | NÃO IMPLEMENTADA | Rotas Growth existem como contrato, mas read models, RLS e drill-down canônicos não foram implementados. |
| ADR-009 | PARCIAL · VALIDADO NO CORTE | IAM/auditoria existem; resolução financeira e payout aplicam grants e segregação de atores. PDP/step-up transversal ainda não está completo. |
| ADR-010 | PARCIAL · VALIDADO NO CORTE | REST `/v1`, `application/problem+json`, correlação e `Idempotency-Key` no financeiro. Registro transversal de idempotência ainda não cobre todos os comandos. |
| ADR-011 | PARCIAL | Health checks e correlation ID existem; métricas, tracing, restore e game days continuam pendentes. |
| ADR-012 | PARCIAL · VALIDADO NO CORTE | Gates reconheceram `300 RF`, `50 RNF`, `95 SCR`, `35 capabilities` e `26 operações`; OpenAPI/event schemas existem, mas não cobrem os 300 RF. |
| ADR-013 | PARCIAL · VALIDADO NO CORTE | Viewer GLB dedicado, fallback 2D, reduced motion e um único canvas passaram build/validação visual. Pipeline assíncrono 2D→3D e revisão humana não existem. |
| ADR-014 | IMPLEMENTADA NO DOMÍNIO · INTEGRAÇÕES BLOQUEADAS | Webhook com bytes originais, lookup obrigatório, hold de 168h e payout maker-checker passaram 4 testes Finance + 7 API. Registries runtime vazios bloqueiam PSP/banco ainda não homologados. |
| ADR-015 | PARCIAL · VALIDADO NO CORTE | Política pura de L1–L10, contribuições compensatórias, checksum, ranking em half-points e badge Premium possuem 50 testes. Review bilateral, temporada/top 3 e persistência ainda não existem. |
| ADR-016 | NÃO IMPLEMENTADA | Consentimento, supressão, Meta/WhatsApp/Instagram, jornadas e atribuição permanecem sem adapters. |
| ADR-017 | NÃO IMPLEMENTADA | Não existe módulo canônico de catálogo/Studio/submissão; viewer 3D não equivale ao Studio. |
| ADR-018 | PARCIAL · VALIDADO NO CORTE | Policies 750/1.000/1.200 bps, snapshot imutável, Premium 6× e marco de 10 vendas fazem parte dos 50 testes de Progression. Publicação maker-checker/persistência ainda falta. |
| ADR-019 | PARCIAL · VALIDADO NO CORTE | `robots.ts`, `sitemap.ts` e CrawlPolicy fail-closed possuem testes; canonical/hreflang/JSON-LD e MarketPolicy ainda faltam. |

Gates realmente executados neste registro:

```text
pnpm lint:architecture
pnpm lint:traceability
pnpm lint:screens
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @midas/web lint
pnpm --filter @midas/web typecheck
pnpm --filter @midas/web test:unit
pnpm --filter @midas/contracts test
pnpm --filter @midas/finance test:integration   # PostgreSQL real local
pnpm --filter @midas/api test:integration      # PostgreSQL real local
pnpm db:check                                  # migrationState=CURRENT
pnpm --filter @midas/web build
pnpm build
pnpm test:e2e                                 # 7 cenários desktop, mobile e WebGL
```

---

## ADR-001 — Monólito modular com processos especializados

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Engenharia e Operações

### Contexto

O núcleo transacional exige consistência entre anúncio, reserva, pedido, pagamento, entrega, ledger, reembolso e payout. Separar esses fluxos prematuramente em serviços distribuídos introduziria rede, transações compensatórias e maior superfície operacional antes de haver necessidade comprovada de escala independente.

### Decisão

Adotar um **monólito modular orientado a domínios**, em um único repositório e ciclo de release, com três processos implantáveis:

1. **API HTTP/BFF:** comandos, consultas autenticadas e webhooks.
2. **Gateway realtime:** chat, presença e fan-out, sem autoridade financeira.
3. **Workers:** outbox, inbox, integração PSP, projeções, reconciliação, notificações e jobs.

Os módulos iniciais são Identity, Sellers, Catalog/Pricing, Listings, Orders/Delivery, Payments/Refunds, Ledger/Payouts, Disputes, Support, Growth/Projections e Notifications.

Cada módulo possui namespace, API de aplicação, tabelas/schema, migrations e testes próprios. Outro módulo não importa seu código interno nem consulta suas tabelas privadas. Colaboração síncrona ocorre por portas públicas dentro do processo; propagação assíncrona ocorre por eventos canônicos. Extração para serviço independente só acontece após evidência de escala, disponibilidade ou ownership autônomo.

### Alternativas consideradas

**Microserviço por domínio**

- Vantagem: deploy e escala independentes.
- Rejeição: adiciona consistência eventual, falhas de rede, observabilidade distribuída e operação 24x7 antes de haver benefício mensurado.

**Monólito sem fronteiras**

- Vantagem: menor esforço inicial.
- Rejeição: permite acoplamento de tabelas, ciclos de dependência e mudanças financeiras sem contrato.

### Consequências

**Positivas**

- Transações locais preservam invariantes críticas.
- Menos componentes para implantar, observar e recuperar no início.
- Fronteiras lógicas deixam pontos de extração identificáveis.

**Custos e limites**

- O release continua coordenado.
- Escala independente fica restrita aos três processos até extração formal.
- Testes de arquitetura precisam impedir erosão de fronteiras.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| Importação de implementação interna de outro módulo | Regra estática de dependência e teste de arquitetura no CI |
| SQL atravessa schema privado | Roles por módulo, revisão de migration e teste que procura referência cross-schema não publicada |
| Ciclo entre módulos | Grafo de dependências acíclico validado no pipeline |
| Worker pesado degrada API | Processos, pools, filas e limites de recursos separados |
| Realtime passa a decidir estado financeiro | Gateway só chama contratos públicos; nenhuma credencial de escrita no schema financeiro |

### Evidência e teste de aceite

- [ ] O pipeline falha em importação proibida ou ciclo de módulos.
- [ ] Cada processo inicia isoladamente com health check e configuração mínima.
- [ ] API continua disponível quando workers ou realtime estão indisponíveis, com degradação explícita.
- [ ] Teste de integração prova uma operação transacional atravessando apenas portas públicas.
- [ ] Documento de ownership lista módulo, schema, contratos publicados e responsável.

### Referências oficiais

- [Microsoft — Common web application architectures](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures)
- [Microsoft — Logical architecture versus physical architecture](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/architect-microservice-container-applications/logical-versus-physical-architecture)
- [Microsoft — Bounded contexts e princípios arquiteturais](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles)

---

## ADR-002 — PostgreSQL canônico, outbox/inbox e concorrência explícita

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Engenharia, Dados e Operações

### Contexto

Persistir uma mudança e publicar seu evento em operações separadas cria dual write: o banco pode confirmar e a publicação falhar, ou o evento pode sair antes de uma transação abortada. Brokers entregam novamente e podem alterar a ordem observada; portanto, exactly-once não pode ser pressuposto.

### Decisão

Usar PostgreSQL como fonte durável dos domínios locais, inicialmente em um cluster com schema e role por módulo.

Toda mutação que emite evento grava o agregado e uma linha de **outbox** na mesma transação. O dispatcher reivindica lotes com lock de linha e **SKIP LOCKED**, publica e registra resultado. Cada consumidor grava uma **inbox** única e o efeito de negócio na mesma transação. A semântica é at-least-once com consumidores idempotentes.

O envelope mínimo contém eventId, eventName, schemaVersion, aggregateType, aggregateId, aggregateVersion, occurredAt, recordedAt, correlationId, causationId, actor, sellerAccountId quando aplicável, classificação e payload. Há ordem apenas por agregado; não existe ordem global.

Invariantes usam constraints únicas, foreign keys, versões e locks de linha adquiridos em ordem documentada. **SKIP LOCKED** é permitido para tabelas de fila/outbox, nunca para validar saldo, refund, reserva ou ownership. Erros SQLSTATE 40001 e 40P01 repetem a transação inteira com backoff limitado.

### Alternativas consideradas

**Commit no banco seguido de publish direto**

- Vantagem: implementação curta.
- Rejeição: perde eventos no intervalo entre commit e publicação.

**Broker como fonte primária e event sourcing integral**

- Vantagem: replay natural.
- Rejeição: amplia a mudança de modelo e a complexidade sem necessidade comprovada para todos os domínios.

**Redis como fila e fonte de verdade**

- Vantagem: baixa latência.
- Rejeição: não substitui as garantias relacionais exigidas pelos estados canônicos.

### Consequências

**Positivas**

- Alteração e intenção de publicação são atômicas.
- Replay e duplicação não criam novo efeito.
- Invariantes concorrentes ficam verificáveis no banco.

**Custos e limites**

- Outbox/inbox crescem e exigem retenção, particionamento e limpeza segura.
- Consumidores precisam ser explicitamente idempotentes.
- Ordenação por agregado exige versão e tratamento de lacunas.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| Processo cai após commit e antes de publicar | Dispatcher posterior encontra a outbox pendente |
| Broker duplica mensagem | UNIQUE em consumerId + eventId e efeito na mesma transação |
| Evento chega fora de ordem | aggregateVersion; evento antigo é no-op e lacuna vai para retry/replay |
| Dois workers reivindicam a mesma linha | Lock de linha, lease e transição atômica |
| Deadlock | Ordem de locks única por fluxo e retry integral |
| Poison message | Tentativas limitadas, erro redigido, DLQ e replay autorizado |

### Evidência e teste de aceite

- [ ] Fault injection encerra o processo após commit e antes do publish; o evento é publicado uma vez em efeito.
- [ ] Repetir o mesmo evento cem vezes produz uma inbox e um efeito.
- [ ] Rollback do agregado não deixa outbox publicável.
- [ ] Eventos N, N+2 e N+1 exercitam lacuna, retry e convergência.
- [ ] Teste concorrente real no PostgreSQL cobre 40001, 40P01 e ordem de locks.
- [ ] Métricas expõem idade da outbox mais antiga, retries, DLQ e lag por consumidor.

### Referências oficiais

- [AWS — Transactional outbox pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
- [PostgreSQL — Explicit locking e deadlocks](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL — Transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL — SELECT, NOWAIT e SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html)
- [PostgreSQL — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

---

## ADR-003 — User autentica; SellerAccount é tenant; SellerMembership autoriza

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Engenharia e Segurança

### Contexto

Uma pessoa pode comprar em nome próprio e participar de zero ou mais operações vendedoras. Igualar User a vendedor, ou guardar um papel global SELLER, não representa organizações, troca de membros, restrições por conta nem um mesmo usuário em vários tenants.

### Decisão

Separar três conceitos:

- **User:** sujeito autenticado e dono da sessão.
- **SellerAccount:** tenant comercial e owner dos objetos de venda.
- **SellerMembership:** vínculo versionado entre User e SellerAccount, com papel, grants, status e validade.

Toda Listing, venda, hold, RefundRequest sob perspectiva do vendedor, Ticket relacionado e Payout carrega sellerAccountId canônico. O ID recebido em path, query ou body é apenas um seletor; a autorização deriva o User da sessão e consulta uma SellerMembership ativa para aquele SellerAccount e objeto.

Um usuário com múltiplas memberships seleciona contexto ativo explicitamente. Um token pode carregar o contexto para reduzir round trips, mas comandos sensíveis revalidam membership, status e capabilities canônicas. Operações de plataforma usam escopo e policies próprios; não equivalem a remover o filtro de tenant.

### Alternativas consideradas

**Campo isSeller em User**

- Vantagem: modelo simples.
- Rejeição: não possui tenant, membership, organização, papel por conta ou revogação independente.

**Uma conta de usuário por SellerAccount**

- Vantagem: isolamento aparente.
- Rejeição: duplica identidade, recuperação, MFA e auditoria da mesma pessoa.

**Confiar no sellerAccountId enviado pelo cliente**

- Vantagem: menos consultas.
- Rejeição: cria BOLA/IDOR e mistura seleção com autorização.

### Consequências

**Positivas**

- Ownership, identidade e autorização permanecem distintos.
- Usuários podem atuar em várias contas sem duplicar identidade.
- Revogar uma membership não bloqueia necessariamente compras pessoais.

**Custos e limites**

- Toda consulta privada precisa transportar tenant context.
- Cache e projeções devem incluir sellerAccountId na chave.
- Acesso histórico após revogação exige policy explícita, não inferência.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| Troca de sellerAccountId acessa objeto alheio | Predicate server-side por membership + tenant + object ownership |
| Token mantém grant revogado | Versão curta do contexto e revalidação canônica em comando sensível |
| Cache devolve dados de outro tenant | Prefixo tenant na chave e teste de colisão |
| Join perde o filtro de tenant | Repository tenant-aware, composite keys e testes negativos |
| Staff usa rota normal para visão global | Endpoints e policy de plataforma separados |

### Evidência e teste de aceite

- [ ] Matriz BOLA troca todos os IDs por objetos de outro SellerAccount e obtém deny sem vazamento.
- [ ] Usuário com duas memberships alterna contexto sem misturar cache, cursor ou resultados.
- [ ] Revogação bloqueia a próxima mutação sensível mesmo com token anterior ainda válido.
- [ ] Não existe coluna global isSeller usada como autorização.
- [ ] Toda tabela seller-scoped possui sellerAccountId não nulo e índice tenant-first.

### Referências oficiais

- [AWS — SaaS tenant isolation](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html)
- [AWS — SaaS identity](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/saas-identity.html)
- [Microsoft — Identity em soluções multi-tenant](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/identity)
- [OWASP — API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)

---

## ADR-004 — PSP, ledger, hold, transfer e payout possuem responsabilidades distintas

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Engenharia, Financeiro e Operações

### Contexto

O PSP mantém balances, captures, refunds, disputes, transfers e payouts externos. O Midas precisa explicar obrigações internas por pedido sem criar uma carteira paralela nem supor que o saldo agregado do provedor identifica quais vendas estão elegíveis.

### Decisão

O **PSP é a fonte de verdade do movimento externo**. O **ledger append-only, balanceado por moeda, é a fonte de verdade das obrigações internas**. Payment, RefundAttempt, Transfer e Payout locais registram a visão canônica interna após webhook autenticado ou consulta de reconciliação.

Cada journal contém postingKey única, moeda, amountMinor inteiro, contas, origem, provider IDs, orderId e sellerAccountId quando aplicável. Lançamentos confirmados não são editados ou apagados; correções criam postings compensatórios.

O fluxo de fundos separa:

1. **PROTECTED:** pagamento capturado, ainda sem conclusão do pedido.
2. **HELD:** pedido concluído, lote aguardando eligibleAt e ausência de freeze.
3. **AVAILABLE:** obrigação elegível para saque.
4. **PAYOUT_PENDING:** valor reservado e em tentativa de saída.
5. **PAID_OUT:** payout externo confirmado.
6. **FROZEN, REFUND_PENDING e CHARGEBACK_DEBT:** exceções explícitas.

**Transfer** move fundos entre platform e connected/balance account no PSP. **Payout** move fundos do balance account para destino bancário. **Hold** é um SettlementLot local ligado à obrigação; não é autorização de cartão, campo de saldo mutável nem sinônimo de payout schedule.

Um único PSP fica ativo em produção. O adapter preserva operações e capabilities reais do provedor. Para Stripe, separate charges and transfers é o fluxo preferencial quando o repasse ao seller ocorre só após elegibilidade; manual payout controla apenas a saída da connected account. Para Adyen, splits são explícitos e o payout usa sweep controlado ou on-demand.

### Alternativas consideradas

**Saldo local mutável por SellerAccount**

- Vantagem: leitura simples.
- Rejeição: perde proveniência, reconciliação e correção auditável.

**Destination charge sempre imediata**

- Vantagem: menos operações.
- Rejeição: transfere cedo e obriga a plataforma a recuperar valor em refund/disputa.

**Adapter PSP completamente genérico**

- Vantagem: troca aparente de fornecedor.
- Rejeição: esconde diferenças materiais entre charge, split, transfer, balance e payout.

### Consequências

**Positivas**

- Todo saldo exibido é explicável por postings e lotes.
- Divergência entre PSP e ledger é detectável, não mascarada.
- Refund e payout falho preservam histórico.

**Custos e limites**

- É necessário reconciliar eventos, balances e relatórios do PSP.
- O provider adapter expõe capabilities específicas.
- Payout depende simultaneamente de AVAILABLE local e saldo externo suficiente.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| Journal desbalanceado | Constraint/validação por moeda antes do commit |
| Webhook duplicado duplica dinheiro | providerEventId e postingKey únicas |
| Transfer ou payout falha por saldo | Estado de tentativa FAILED; retry explícito após reconciliação |
| Refund após transfer | Transfer reversal quando aplicável e seller debt/offset se já pago |
| Relatório PSP diverge do ledger | Item de reconciliação, freeze e alerta; nunca ajuste silencioso |
| Payout RETURNED após PAID | RETURN_REVIEW e posting compensatório ou nova tentativa |

### Evidência e teste de aceite

- [ ] Property test prova soma de débitos igual a créditos por journal e moeda.
- [ ] Duas requisições concorrentes não reservam o mesmo AVAILABLE.
- [ ] Transfer e payout possuem IDs, tentativas e estados independentes.
- [ ] Relatório de reconciliação explica cada diferença por provider object e posting.
- [ ] Payout FAILED/RETURNED nunca aparece como PAID e termina em retry ou reversão.
- [ ] Read model de saldo é reconstruído integralmente a partir do ledger e lotes.

### Referências oficiais

- [Stripe — Connect account balances](https://docs.stripe.com/connect/account-balances)
- [Stripe — Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
- [Stripe — Manual payouts](https://docs.stripe.com/connect/manual-payouts)
- [Adyen — Split transactions](https://docs.adyen.com/platforms/online-payments/split-transactions)
- [Adyen — Scheduled payouts](https://docs.adyen.com/platforms/custom-payouts/scheduled-payouts/)
- [Adyen — Reports and fees](https://docs.adyen.com/platforms/reports-and-fees/)

---

## ADR-005 — Liquidação tardia entra em PAYMENT_QUARANTINED

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Engenharia, Financeiro e Operações

### Contexto

Um pagamento assíncrono pode liquidar depois de timeout, expiração local ou confirmação de cancelamento. Nesse intervalo a unidade pode ter sido reativada e reservada ou vendida a outro comprador. Tratar o evento tardio como pagamento comum causaria dupla venda ou revelação indevida da entrega.

### Decisão

Todo settlement recebido para Payment em FAILED, EXPIRED ou CANCELED transita primeiro para **PAYMENT_QUARANTINED**. O webhook permanece aceito e deduplicado, mas esse estado:

- não abre sala ou pacote de entrega;
- não consome SecureDeliveryTemplate;
- não marca a unidade como SOLD;
- não cria saldo AVAILABLE;
- não envia comunicação de compra concluída.

O reconciler executa um comando único por providerEventId e adquire locks na ordem:

**payment → order → listingUnit → reservation → secureDeliveryTemplate**

Há dois desfechos:

1. **Reassociação segura:** unidade continua livre, não existe reserva/compra posterior, vínculos e hashes permanecem válidos; a transação reassocia, grava journal, marca o pedido pago e publica payment.quarantine_reassociated. A entrega só abre após esse evento pós-commit.
2. **Reassociação insegura:** inicia refund idempotente e mantém fundos congelados até confirmação canônica. Timeout ou falha inconclusiva segue para MANUAL_REVIEW.

### Alternativas consideradas

**Ignorar settlement tardio**

- Vantagem: fluxo local simples.
- Rejeição: dinheiro externo fica sem obrigação ou devolução.

**Liberar entrega automaticamente**

- Vantagem: conclui o pedido antigo.
- Rejeição: pode vender a mesma unidade duas vezes e revelar material a comprador sem ownership atual.

**Refund automático em todos os casos**

- Vantagem: elimina a reassociação.
- Rejeição: devolve desnecessariamente quando a unidade ainda está livre e a associação é comprovadamente segura.

### Consequências

**Positivas**

- Settlement tardio nunca é confundido com autorização de entrega.
- Corridas são resolvidas sob locks e com trilha auditável.
- Toda quantia termina reassociada, refundada ou em revisão com owner.

**Custos e limites**

- Exige fila operacional de quarantine e reconciliação.
- O pedido pode permanecer inconclusivo enquanto o PSP não fornece estado canônico.
- Notificações precisam distinguir recebimento financeiro de conclusão da compra.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| Cancel ack e settlement cruzam | Inbox única e estado PAYMENT_QUARANTINED |
| Novo comprador reserva antes da reassociação | Locks e revalidação da reservation atual |
| Dois reconcilers tratam o mesmo evento | Chave única providerEventId e comando idempotente |
| Refund é aceito, mas a resposta expira | Mesma chave PSP, estado desconhecido e reconciliação |
| Processo cai após journal | Journal, estado e outbox na mesma transação |

### Evidência e teste de aceite

- [ ] Barreira concorrente reproduz expiração, cancel ack e settlement em todas as ordens.
- [ ] Novo comprador permanece intacto quando o pagamento antigo chega.
- [ ] PAYMENT_QUARANTINED produz zero pacote, zero reveal e zero aviso de sucesso.
- [ ] Duplo reconciler gera um único desfecho e um único journal.
- [ ] Falha de refund deixa owner, próxima ação, alerta e fundos congelados.
- [ ] Reassociação abre entrega somente ao consumir o evento pós-commit.

### Referências oficiais

- [Stripe — Webhooks, duplicação e eventos fora de ordem](https://docs.stripe.com/webhooks)
- [Adyen — Handle webhook events](https://docs.adyen.com/development-resources/webhooks/handle-webhook-events/)
- [Adyen — API idempotency](https://docs.adyen.com/development-resources/api-idempotency)
- [PostgreSQL — Row locks e ordem contra deadlock](https://www.postgresql.org/docs/current/explicit-locking.html)

---

## ADR-006 — Solicitação, execução e efeito de refund permanecem separados

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Produto, Engenharia, Financeiro e Operações

### Contexto

Pedido do comprador, análise humana, comunicação de suporte, controvérsia, chamada ao PSP e lançamento contábil têm ciclos e responsabilidades diferentes. Fundi-los em Ticket, Payment ou um campo REFUNDED impede refund parcial, retry seguro, segregação de funções e auditoria das tentativas.

### Decisão

Usar objetos relacionados, mas não intercambiáveis:

- **RefundRequest:** workflow humano de solicitação, informação, decisão, aprovação e escalonamento.
- **RefundAttempt:** uma execução externa preservada, com idempotency key, request, provider ID, resultado e erro.
- **Refund do PSP:** devolução externa canônica.
- **Ledger posting:** efeito financeiro append-only.
- **Ticket:** comunicação e SLA.
- **Dispute:** controvérsia e decisão própria.

Aprovar não movimenta dinheiro. Execute e retry são comandos assíncronos separados. Enquanto o resultado externo for desconhecido, execute reutiliza a mesma chave. Uma falha canônica permite nova RefundAttempt com chave versionada, sem apagar a tentativa anterior.

Refund parcial usa amountMinor e currency do pagamento. Sob locks **payment → order → refundRequest**, deve valer:

**total confirmado + total reservado em tentativas inconclusivas + novo valor ≤ total capturado**

RefundRequest só chega a COMPLETED depois de confirmação canônica do PSP e postings compensatórios balanceados. Apenas payment.partially_refunded ou payment.refunded, acompanhado de ledger.entry_posted, comunica conclusão financeira. Se o valor já foi pago ao seller, cria-se CHARGEBACK_DEBT/recebível e offset futuro; o payout histórico não é reescrito.

### Alternativas consideradas

**Usar Ticket como pedido de refund**

- Vantagem: reaproveita UI e mensagens.
- Rejeição: ticket não representa valor, aprovação, tentativa PSP ou efeito financeiro.

**Guardar refund diretamente em Payment**

- Vantagem: menos entidades.
- Rejeição: apaga workflow, múltiplas tentativas, parcialidade e decisão humana.

**Criar nova RefundRequest em cada retry**

- Vantagem: execução simples.
- Rejeição: duplica o caso e quebra a trilha de decisão.

### Consequências

**Positivas**

- Responsabilidades e estados ficam inequívocos.
- Retry não perde histórico nem duplica devolução.
- Refund parcial e múltiplas tentativas são representáveis.

**Custos e limites**

- A UI precisa relacionar objetos sem copiar seu estado.
- Há mais estados assíncronos e casos de MANUAL_REVIEW.
- Aprovação e execução exigem policies diferentes.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| Duas aprovações excedem capturado | If-Match, locks e reserva do montante aprovado |
| Timeout gera segunda devolução | Mesma chave PSP enquanto resultado for desconhecido |
| Webhook duplicado cria dois postings | providerEventId e postingKey únicas |
| Staff edita saldo para concluir caso | Sem endpoint/update direto; somente comando e posting |
| Ticket vira fonte do refund | Vínculo por ID; Payment/PSP/Ledger continuam canônicos |
| Refund parcial marca tudo como REFUNDED | Estado total apenas quando acumulado confirmado iguala capturado |

### Evidência e teste de aceite

- [ ] Duplo clique cria uma RefundRequest; payload diferente com mesma chave recebe conflito.
- [ ] Duas aprovações concorrentes nunca excedem o reembolsável.
- [ ] Timeout seguido de webhook duplicado produz uma tentativa inconclusiva e um efeito financeiro.
- [ ] Refund parcial preserva Payment parcialmente reembolsado e restante conciliável.
- [ ] Agente sem refund.execute pode analisar, mas não executar.
- [ ] Retry cria nova RefundAttempt e mantém a RefundRequest original.

### Referências oficiais

- [Stripe — Refunds e múltiplos refunds parciais](https://docs.stripe.com/refunds)
- [Stripe Connect — Destination charges e reverse_transfer](https://docs.stripe.com/connect/destination-charges)
- [Adyen — Split refunds](https://docs.adyen.com/platforms/online-payments/split-transactions/split-refunds/)
- [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [Adyen — API idempotency](https://docs.adyen.com/development-resources/api-idempotency)

---

## ADR-007 — CQRS pragmático com read models reconstruíveis

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Engenharia e Produto

### Contexto

Minha conta, vendas, visão 360°, busca e relatórios combinam dados de vários módulos. Executar joins síncronos sobre todas as fontes aumenta acoplamento, latência e risco de expor campos. Entretanto, tratar uma projeção como fonte de comando cria decisões sobre dados atrasados.

### Decisão

Separar modelo de escrita e modelos de leitura sem adotar event sourcing integral.

- Write models permanecem nas tabelas canônicas dos módulos.
- Outbox publica eventos canônicos após commit.
- Projectors mantêm DTOs e agregados específicos para cada consulta.
- Read models podem começar em schemas do mesmo PostgreSQL e migrar para outro store apenas por necessidade medida.
- Projeções nunca recebem mutação de pedido, saldo, grant, RefundRequest ou caso.
- Comando sensível relê write model e reautoriza, mesmo se originado da visão 360°.

Toda projeção expõe **asOf, projectedAt, lagMs, freshness e sourceVersion/eventCursor**. Estados mínimos de freshness são FRESH, DELAYED, STALE e REBUILDING. A UI identifica atraso e não inventa sucesso.

Rebuild ocorre por replay do arquivo de eventos canônicos ou por snapshots versionados das fontes. Se a projeção for descartada, seu conteúdo deve convergir novamente sem alterar as fontes.

### Alternativas consideradas

**Joins ao vivo entre todos os módulos**

- Vantagem: leitura imediatamente consistente.
- Rejeição: alto acoplamento, consultas frágeis, N+1 e exposição excessiva.

**Banco e serviço de leitura separados desde o primeiro dia**

- Vantagem: escala independente.
- Rejeição: adiciona infraestrutura antes de medir carga.

**Event sourcing para todos os módulos**

- Vantagem: replay completo.
- Rejeição: mudança abrangente sem necessidade para o write model atual.

### Consequências

**Positivas**

- Consultas são otimizadas para a tela.
- Projeções são descartáveis e reconstruíveis.
- O write model mantém consistência e autorização finais.

**Custos e limites**

- A leitura é eventualmente consistente.
- O produto precisa comunicar freshness.
- Eventos e snapshots precisam de retenção suficiente para rebuild.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| Projector perde evento | Cursor/lacuna, retry e replay |
| Duplicata aumenta contador | Contribution/inbox única por eventId |
| Evento antigo sobrescreve novo | aggregateVersion monotônica |
| Projeção orienta comando inválido | Releitura e policy no write model |
| Rebuild diverge | Comparação de checksum/contagem com fontes canônicas |
| Read model fica indisponível | Estado degradado; fontes de escrita não são alteradas |

### Evidência e teste de aceite

- [ ] Apagar uma projeção e reconstruí-la gera o mesmo checksum lógico.
- [ ] Duplicatas e ordem invertida convergem ao mesmo resultado.
- [ ] Uma tela stale mostra freshness e comando posterior é negado se o canônico mudou.
- [ ] Read model opera com usuário de banco sem escrita nos schemas canônicos.
- [ ] Projeção em REBUILDING não é apresentada como atual.
- [ ] Teste de contrato valida DTO, cursor e campos mascarados.

### Referências oficiais

- [Microsoft — CQRS pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- [Microsoft — Materialized View pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/materialized-view)
- [AWS — CQRS pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-data-persistence/cqrs-pattern.html)

---

## ADR-008 — Growth multi-tenant com freshness, RLS e drill-down seguro

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Produto, Engenharia, Dados e Segurança

### Contexto

O painel Growth precisa agregar plataforma, tenant, membros e objetos sem criar outra fonte de verdade ou permitir vazamento entre SellerAccounts. Eventos chegam ao menos uma vez, podem atrasar e podem ser processados fora de ordem. Consultas globais da plataforma também não devem ser implementadas removendo filtros de tenant das rotas comuns.

### Decisão

Adotar a hierarquia:

**Plataforma → SellerAccount → SellerMembership/User → Order, Listing, RefundRequest, Ticket ou Payout**

SellerAccount é a chave de partição e isolamento. SellerMembership define o que o User pode ler ou acionar naquele tenant. Cada linha de projeção contém sellerAccountId explícito; o tenant nunca é inferido apenas do actor do evento.

Read models mínimos:

- **growth_account_daily:** métricas por SellerAccount, data local, moeda e asOf.
- **growth_funnel_daily:** estágio, contagem e valor por período.
- **growth_object_current:** snapshot pesquisável do objeto, canonicalVersion e freshness.
- **growth_event_contribution:** contribuição imutável por projector + eventId.
- **platform_growth_daily:** agregado global próprio, sem reutilizar endpoint de seller.

O evento consumido inclui eventId, eventName, schemaVersion, sellerAccountId, actorUserId, actorMembershipId, aggregateType, aggregateId, aggregateVersion, occurredAt, recordedAt, correlationId e causationId.

Deduplicação usa UNIQUE em projector + eventId. Uma versão antiga é no-op; lacuna bloqueia atualização daquele agregado até replay. Cada resposta expõe asOf, projectedAt, lagMs, freshness e sourceVersion. O drill-down segue resumo → métrica → lista → objeto → ação canônica; a última ação relê fonte e autorização.

PostgreSQL RLS é defesa em profundidade nas projeções seller-scoped. A role da aplicação não é owner nem possui BYPASSRLS; tabelas usam FORCE ROW LEVEL SECURITY. O tenant context é configurado localmente dentro da transação e não pode vazar pelo pool. Policies usam predicate simples na coluna sellerAccountId. Cache e busca usam chave/filtro tenant imposto pelo servidor.

### Alternativas consideradas

**BI direto nas tabelas canônicas**

- Vantagem: nenhum projector.
- Rejeição: carga, acoplamento, N+1 e exposição de campos operacionais.

**Filtro de tenant no frontend**

- Vantagem: backend genérico.
- Rejeição: não oferece isolamento e permite exfiltração trivial.

**Banco por SellerAccount desde o início**

- Vantagem: isolamento físico maior.
- Rejeição: migrations, relatórios globais e operação não escalam para o estágio atual.

### Consequências

**Positivas**

- Métricas são rápidas, explicáveis e reconstruíveis.
- Isolamento existe no BFF, repository e banco.
- Plataforma e seller têm superfícies distintas.

**Custos e limites**

- Há eventual consistency e necessidade de freshness visível.
- RLS exige configuração segura do pool e testes específicos.
- Tenant ruidoso requer quota, fairness e índices tenant-first.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| Cache ou cursor cruza tenant | Chave inclui tenant e cursor assinado/escopado |
| RLS é ignorada pelo owner | Role não-owner, sem BYPASSRLS e FORCE RLS |
| Tenant context permanece na conexão | SET LOCAL por transação e teste de reuso do pool |
| Duplicata infla KPI | growth_event_contribution única |
| Evento fora de ordem regressa status | canonicalVersion monotônica e gap queue |
| Plataforma vê campo restrito | Projeção global com schema, masking e policy próprios |
| Métrica explode cardinalidade | sellerAccountId em logs/traces e storage analítico, não como label irrestrita de métrica |
| Hot tenant atrasa todos | Rate limit, quota, fila justa e particionamento tenant-first |

### Evidência e teste de aceite

- [ ] Suite cross-tenant troca SellerAccount, Membership, objeto, cache e cursor em todas as rotas Growth.
- [ ] Teste prova que owner/BYPASSRLS não é usado pela aplicação.
- [ ] Cem eventos duplicados somam uma contribuição.
- [ ] Gap de versão marca atraso, reprocessa e converge.
- [ ] Resposta sempre contém freshness e a UI representa STALE/REBUILDING.
- [ ] Drill-down para ação stale é revalidado e pode receber conflito/deny.
- [ ] Teste de carga com hot tenant mantém fairness e SLO dos demais.

### Referências oficiais

- [AWS — Tenant isolation](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html)
- [AWS — Identity and access management no SaaS Lens](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/identity-and-access-management.html)
- [Microsoft — Storage e dados multi-tenant](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/storage-data)
- [PostgreSQL — Row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [OpenTelemetry — Cardinalidade de métricas](https://opentelemetry.io/docs/concepts/signals/metrics/)

---

## ADR-009 — Autorização contextual, SoD, step-up e auditoria

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Segurança, Engenharia e Operações

### Contexto

RBAC puro não expressa ownership, tenant, estado do objeto, montante, conflito de interesse ou dispositivo. Operações como aprovar e executar refund, liberar payout, alterar grants e usar break-glass exigem menor privilégio, segregação de funções e prova de autenticação recente.

### Decisão

Centralizar decisão em um **PDP** e aplicar enforcement em toda API/worker por **PEP**, com deny por padrão. Policies avaliam:

- User e sessão;
- SellerAccount e SellerMembership;
- grant no formato recurso.ação;
- ownership e objeto;
- estado e version do agregado;
- montante e moeda;
- risco, dispositivo e autenticação recente;
- conflito de interesse e ação anterior do mesmo ator.

Permissões financeiras são separadas, por exemplo refund.read, refund.decide, refund.execute, payout.review, payout.approve e payout.execute. Quem cria ou decide não executa a mesma operação acima do limite configurado. Limites e exceções são versionados; sua ausência falha fechado.

Step-up é obrigatório para mudança de credencial, payout destination, refund/payout sensível, grant administrativo e break-glass. Break-glass exige justificativa, escopo mínimo, expiração, alerta e revisão posterior; não apaga auditoria.

AuditLog é append-only e registra actor, membership, tenant, action, resource, decisão PDP, policyVersion, request/correlation IDs, before/after permitido, motivo e timestamp. Segredos, credenciais e conteúdo integral sensível não entram no log.

### Alternativas consideradas

**RBAC apenas**

- Vantagem: simples de administrar.
- Rejeição: não cobre tenant, ownership, estado, valor e SoD contextual.

**Checks dispersos nos controllers**

- Vantagem: pouca infraestrutura.
- Rejeição: inconsistência, bypass e auditoria incompleta.

**Superadmin permanente**

- Vantagem: operação rápida.
- Rejeição: privilégio excessivo e ausência de controle de exceção.

### Consequências

**Positivas**

- A mesma policy protege UI, API e worker.
- SoD e step-up tornam ações sensíveis demonstráveis.
- Decisões negadas também são observáveis.

**Custos e limites**

- PDP precisa alta disponibilidade e cache com invalidação segura.
- A matriz de grants e atributos exige governança.
- Policies devem ser versionadas e testadas como código.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| Alterar ID acessa outro objeto | Object-level authorization em toda função |
| Endpoint admin é chamado por usuário comum | Deny default e function-level authorization |
| Mesmo ator aprova e executa | Regra SoD usando histórico/actor e constraint de comando |
| Grant revogado continua em cache | Versionamento, TTL curto e invalidação |
| PDP indisponível | Fail closed em ação privada/sensível |
| Break-glass vira acesso permanente | Credencial JIT, expiração, alerta e revisão |
| Audit log vaza segredo | Allowlist de campos e testes de redaction |

### Evidência e teste de aceite

- [ ] Matriz automatizada cobre grant × tenant × ownership × estado × valor.
- [ ] Testes BOLA/BFLA alteram path, método, body e objeto.
- [ ] Maker não consegue checker/execute na mesma operação quando SoD se aplica.
- [ ] Sessão sem step-up recente recebe challenge, não sucesso parcial.
- [ ] Revogação de membership/grant invalida acesso dentro do SLO definido.
- [ ] Break-glass expira sozinho e gera alerta e revisão.
- [ ] Audit trail reconstrói quem decidiu e executou sem expor segredo.

### Referências oficiais

- [AWS — Multi-tenant SaaS authorization and API access control](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-api-access-authorization/introduction.html)
- [OWASP — Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [OWASP — Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
- [NIST SP 800-53 Rev. 5.1 — AC-5 Separation of Duties](https://csrc.nist.gov/CSRC/media/Projects/risk-management/800-53%20Downloads/800-53r5/SP_800-53_v5_1-derived-OSCAL.pdf)
- [NIST SP 800-63B-4 — Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)

---

## ADR-010 — REST /v1, idempotência transversal e application/problem+json

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Engenharia e Produto

### Contexto

Clientes, workers e integrações precisam distinguir retry seguro, conflito concorrente, validação, autorização e operação assíncrona. Sem convenções únicas, cada endpoint inventa erros, paginação e semântica de repetição.

### Decisão

Expor API REST JSON sob **/v1**, descrita em OpenAPI 3.1.

Convenções:

- lowerCamelCase no wire.
- Timestamps RFC 3339 em UTC.
- Money com amountMinor inteiro e currency ISO 4217; gold permanece outro tipo.
- IDs opacos; cursor opaco, estável e escopado ao tenant/filtro.
- ETag e If-Match em decisões e recursos versionados.
- 202 Accepted para comando assíncrono, com operation/resource ID consultável.
- Erros em **application/problem+json** conforme RFC 9457.

O problem detail contém type URI estável, title estável, status coerente com HTTP, detail seguro, instance, code estável, correlationId e errors estruturados quando aplicável. Nunca contém stack trace, query, segredo ou PII desnecessária.

Toda mutação com efeito não trivial aceita **Idempotency-Key**. O registro usa:

- scope = actorId + method + canonicalRoute + idempotencyKey;
- requestHash canônico;
- state = PROCESSING, COMPLETED ou FAILED_RETRYABLE;
- responseStatus, responseBody seguro, resourceId e expiresAt.

Mesma chave e hash devolvem o mesmo resultado. Mesma chave com hash diferente retorna 409 e code IDEMPOTENCY_KEY_REUSED. Timeout não gera nova chave enquanto o efeito externo é desconhecido. Idempotência do Midas é mais longa que a janela de retry/reconciliação do fluxo; não depende apenas da retenção do PSP.

### Alternativas consideradas

**GraphQL como API transacional principal**

- Vantagem: consultas flexíveis.
- Rejeição: aumenta complexidade de autorização por campo, custo e idempotência de comandos; não há necessidade demonstrada.

**Formato de erro próprio por endpoint**

- Vantagem: liberdade local.
- Rejeição: clientes não conseguem automatizar recuperação de modo uniforme.

**Idempotência somente no PSP**

- Vantagem: menos estado local.
- Rejeição: não protege criação de Order, RefundRequest, PayoutRequest ou efeitos internos.

### Consequências

**Positivas**

- Clientes têm recuperação e retry previsíveis.
- Contrato pode ser validado e gerar SDKs.
- Conflito de versão e operação assíncrona ficam explícitos.

**Custos e limites**

- Respostas idempotentes exigem retenção e política de redaction.
- Mudança breaking demanda nova versão ou migração compatível.
- Canonicalização do requestHash precisa ser única por rota.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| Mesmo POST cria dois recursos | Registro idempotente e constraint de domínio |
| Chave é reutilizada com intenção diferente | Comparação de requestHash e 409 |
| 202 não pode ser acompanhado | operation/resource ID e GET canônico |
| Erro vaza internals | Mapper central, allowlist e redaction |
| Cursor de tenant A é usado em B | Cursor assinado com tenant, filtros e ordenação |
| If-Match ausente em decisão concorrente | 428/412 ou problem code estável conforme contrato |

### Evidência e teste de aceite

- [ ] OpenAPI valida e cobre todas as rotas expostas.
- [ ] Contract test valida Content-Type e shape RFC 9457 para cada classe de erro.
- [ ] Mesma chave concorrente cria um recurso e devolve o mesmo resultado.
- [ ] Payload diferente com mesma chave recebe 409 sem novo efeito.
- [ ] Timeout PSP é repetido com a mesma chave e converge.
- [ ] Cursor não pode ser reutilizado com tenant ou filtros diferentes.
- [ ] Breaking-change detector falha o CI sem versão/migração aprovada.

### Referências oficiais

- [OpenAPI Specification](https://spec.openapis.org/oas/)
- [IETF RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [IETF RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [Adyen — API idempotency](https://docs.adyen.com/development-resources/api-idempotency)

---

## ADR-011 — Observabilidade correlacionada, replay controlado e DR testado

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Engenharia, SRE/Operações e Segurança

### Contexto

Webhooks, workers, PSP e projeções tornam falhas parcialmente assíncronas. Logs isolados não demonstram se uma operação foi recebida, publicada, processada, conciliada ou repetida. Backup sem restore testado também não comprova recuperação.

### Decisão

Instrumentar API, realtime e workers com OpenTelemetry para traces, métricas e logs correlacionados. Propagar traceId, correlationId, causationId, requestId, eventId e operationId. Order, Payment, RefundRequest, RefundAttempt, Payout e provider IDs entram como atributos controlados em logs/traces; segredo, payload financeiro integral, chat e PII não entram.

Métricas obrigatórias:

- taxa/latência/erro por rota e dependência;
- webhook ack e processamento;
- idade e volume de outbox/inbox;
- queue lag, retries e DLQ;
- projection lag e freshness;
- PAYMENT_QUARANTINED por idade/desfecho;
- refunds e payouts em UNKNOWN, FAILED ou RETURNED;
- divergências de reconciliação e journals desbalanceados;
- deadlocks, serialization retries e pool saturation.

IDs de User e SellerAccount não são labels irrestritas de métricas; permanecem em logs/traces protegidos ou tabelas de metering para evitar cardinalidade explosiva.

Replay é uma operação privilegiada. Exige seleção por consumer/event/range, dry-run, idempotency key, lease, justificativa, aprovação quando financeira, replayId e auditoria. Replay nunca ignora inbox, constraints, versions ou policy; ele repassa o mesmo contrato ao consumidor normal.

O reconciler compara PSP, Payments, Ledger, SettlementLots, Transfers, Payouts e RefundAttempts. Divergência crítica congela o fluxo afetado e alerta; nenhum job “corrige saldo” silenciosamente.

DR inicial:

- PostgreSQL com WAL/PITR e backup diário;
- backups criptografados e isolados;
- object storage versionado;
- Redis e OpenSearch reconstruíveis;
- broker com retenção e DLQ compatíveis com replay;
- RPO de pedido/financeiro de até 5 minutos e RTO de até 60 minutos;
- RPO de chat/suporte de até 15 minutos e RTO de até 4 horas;
- restore mensal e exercício integrado trimestral.

### Alternativas consideradas

**Logs textuais sem correlação**

- Vantagem: implantação simples.
- Rejeição: não reconstrói uma operação entre processos e eventos.

**Replay por script direto no banco**

- Vantagem: rapidez emergencial.
- Rejeição: contorna idempotência, autorização e auditoria.

**Backup configurado sem restore periódico**

- Vantagem: menor custo operacional.
- Rejeição: não comprova integridade, credenciais, sequência WAL nem RTO.

### Consequências

**Positivas**

- Uma operação pode ser seguida de HTTP a PSP, evento, ledger e projeção.
- Falhas assíncronas têm owner e alerta mensurável.
- Recuperação e replay são ensaiáveis.

**Custos e limites**

- Telemetria exige sampling, retenção, acesso e orçamento.
- Runbooks e exercícios consomem capacidade operacional.
- Replay e restore precisam compatibilidade de schema/contrato.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| Telemetria vaza segredo | Redaction central e teste automático de padrões proibidos |
| Métrica explode cardinalidade | Allowlist de labels e limite de cardinalidade |
| Retry storm agrava outage | Retry finito, backoff com jitter, budget e circuit breaker |
| Replay duplica dinheiro | Consumidor normal, inbox, postingKey e dry-run |
| Divergência é ajustada silenciosamente | Caso de reconciliação, freeze, aprovação e posting compensatório |
| Backup não restaura | Restore mensal automatizado com checksum e evidência |
| PITR recupera DB, mas não contratos/config | Artefatos, migrations, secrets metadata e IaC versionados separadamente |

### Evidência e teste de aceite

- [ ] Um trace demonstra checkout → PSP → webhook → ledger → projeção.
- [ ] Alertas disparam por outbox lag, webhook lag, quarantine antiga, DLQ e divergência.
- [ ] Scanner prova ausência de segredo e PII proibida em logs, spans e eventos.
- [ ] Replay duplicado é no-op financeiro e registra replayId.
- [ ] Game day derruba PSP/broker e confirma retry budget/circuit breaker.
- [ ] Restore mensal atinge RPO/RTO e valida journals, inbox/outbox e objetos.
- [ ] Exercício trimestral inclui aplicação, banco, broker, storage, DNS/configuração e rollback.

### Referências oficiais

- [OpenTelemetry — Signals](https://opentelemetry.io/docs/concepts/signals/)
- [OpenTelemetry — Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/)
- [OpenTelemetry — Metrics e cardinalidade](https://opentelemetry.io/docs/concepts/signals/metrics/)
- [Microsoft — Retry pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/retry)
- [PostgreSQL — Continuous archiving e PITR](https://www.postgresql.org/docs/current/continuous-archiving.html)
- [AWS — Definir e testar estratégia de DR](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/plan-for-disaster-recovery-dr.html)

---

## ADR-012 — Contratos e documentação versionados são gates de entrega

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Produto, Engenharia, Segurança e Operações

### Contexto

UML, texto, endpoints, eventos, migrations e implementação podem divergir. Sem contratos executáveis, um produtor pode alterar payload sem avisar consumidores, uma rota pode surgir sem autorização documentada e um requisito pode ficar sem teste.

### Decisão

Adotar contrato versionado no repositório como fonte executável de integração:

- **OpenAPI 3.1** descreve HTTP /v1, autenticação, schemas, problems, idempotência e exemplos.
- **AsyncAPI 3.x** descreve canais, produtores, consumidores, correlationId e mensagens.
- **JSON Schema 2020-12** descreve payloads de eventos e objetos compartilhados.
- **Migrations** descrevem evolução persistente; não se edita schema manualmente em produção.
- **ADRs** registram por que uma decisão existe e suas alternativas.
- **Matriz de rastreabilidade** liga requisito → superfície → contrato → módulo → evento/estado → teste → owner.

Estrutura alvo:

- contracts/http/openapi.yaml
- contracts/events/asyncapi.yaml
- contracts/schemas/events/{eventName}/v{schemaVersion}.json
- contracts/examples/
- docs/08-ADRS-DECISOES-ARQUITETURAIS.md

Compatibilidade:

- Mudança HTTP aditiva e opcional permanece em /v1.
- Remoção, alteração semântica ou campo obrigatório novo exige estratégia de depreciação ou /v2.
- Evento mantém eventName e declara schemaVersion; produtor não republica significado diferente sob a mesma versão.
- Consumidor declara versões aceitas e possui teste com fixtures reais.
- Migration segue expand → migrate/backfill → contract, preservando compatibilidade durante o rollout.

O CI valida sintaxe, links, exemplos, segurança declarada, compatibilidade e cobertura. Endpoint, evento ou estado sem contrato e teste bloqueia merge. Documentação gerada nunca substitui revisão das decisões e invariantes.

### Alternativas consideradas

**Documentação narrativa apenas**

- Vantagem: fácil de escrever.
- Rejeição: não valida payload, breaking change ou cobertura.

**Contrato derivado somente do código**

- Vantagem: reduz edição duplicada.
- Rejeição: pode publicar acidentalmente implementação sem revisão de produto, segurança e consumidores.

**Wiki externa como fonte principal**

- Vantagem: colaboração visual.
- Rejeição: perde atomicidade com código, diff, review e pipeline.

### Consequências

**Positivas**

- Breaking changes são detectadas antes do deploy.
- Produtores, consumidores, SDKs e testes compartilham schemas.
- Rastreabilidade fica auditável por diff.

**Custos e limites**

- Cada mudança exige atualizar contrato e fixtures.
- É necessário manter tooling de lint e diff.
- Compatibilidade expand/contract pode prolongar migrations.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| Código expõe rota não documentada | Comparação runtime/router versus OpenAPI |
| Evento muda sem versão | Schema registry no repo e compatibility check |
| Exemplo não valida | Teste de fixtures contra schema |
| Migration quebra versão anterior | Teste de rollout expand/migrate/contract |
| Link ou requisito fica órfão | Link checker e matriz de rastreabilidade no CI |
| Documento contradiz ADR aceita | Review obrigatório e ADR substituta explícita |

### Evidência e teste de aceite

- [ ] OpenAPI e AsyncAPI passam em validator oficial/compatível.
- [ ] Todos os exemplos validam contra seus schemas.
- [ ] Breaking-change detector bloqueia alteração incompatível sem versão.
- [ ] Consumer contract tests executam para versão atual e janela suportada.
- [ ] Migration é testada com versão anterior e atual da aplicação.
- [ ] Pipeline falha em requisito, rota, evento, estado ou teste órfão.
- [ ] Release gera inventário de contratos e histórico de depreciação.

### Referências oficiais

- [OpenAPI Specification](https://spec.openapis.org/oas/)
- [AsyncAPI Specification 3.0](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)
- [IETF RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [PostgreSQL — Transactional DDL e migrations por comandos SQL](https://www.postgresql.org/docs/current/ddl.html)

---

## ADR-013 — Pipeline 2D→3D assíncrono, versionado e revisado

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Produto, Design 3D, Engenharia, Segurança e Operações

### Contexto

Gerar um modelo 3D a partir de imagens consome GPU, pode exceder o tempo de uma requisição HTTP e depende de modelos ou provedores com falhas, custos e resultados não determinísticos. O arquivo recebido e o GLB produzido são conteúdo não confiável até validação. Publicar diretamente a saída do provedor permitiria artefato corrompido, excessivo, incompatível com o viewer ou pertencente ao tenant errado.

Uma vista única não contém informação sobre superfícies ocultas. Portanto, um resultado single-view é uma inferência visual, permanece rascunho e nunca pode ser descrito como reconstrução “exata”. Múltiplas vistas reduzem ambiguidade, mas também não provam dimensão ou geometria exata sem medição adicional.

### Decisão

Implementar o recurso como pipeline assíncrono isolado, inicialmente atrás de feature flag, usando as garantias de outbox/inbox da ADR-002, tenant da ADR-003, API/idempotência da ADR-010 e contratos da ADR-012.

**Entradas e proveniência**

- Aceitar PNG ou SVG. Validar extensão, MIME detectado por assinatura, tamanho, dimensões e quantidade de pixels antes de decodificar.
- SVG nunca chega diretamente ao modelo, storage público ou browser. Rejeitar scripts, entidades, referências externas, fontes remotas e recursos embutidos fora da allowlist; rasterizar para PNG em sandbox sem rede.
- Persistir a entrada normalizada como objeto privado, imutável e endereçado por SHA-256. Registrar sellerAccountId, actorId, listingId opcional, hash, dimensões, inputMode e versão do perfil de validação.
- Multi-view recebe vistas nomeadas — front, back, left, right e opcionais top/bottom — do mesmo objeto, com orientação, escala visual e fundo coerentes. Duplicidade de hash, vista ausente obrigatória ou inconsistência detectada leva a REJECTED_INPUT.
- Single-view recebe inputMode=DRAFT_SINGLE_VIEW e só pode gerar preview privado. Não transiciona para APPROVED ou PUBLISHED. Multi-view recebe inputMode=MULTI_VIEW e ainda exige revisão humana antes de publicar.

**Modelo de estado e processamento**

Usar o modelo canônico do PRD, sem criar um segundo ciclo de geração:

1. **`Model3DJob` (aggregate root):** intenção idempotente, item, `sellerAccountId` opcional de proveniência/escopo, conjunto versionado de `CatalogAsset` de origem, perfil, status, versão e `idempotencyKey`.
2. **`Model3DAttempt` (filho do job):** chamada concreta ao provider, `externalJobId`, provider/model version, parâmetros, seed quando suportado, timestamps, custo, resultado e erro sanitizado.
3. **`Model3DArtifact` (saída imutável):** raw privado, GLB normalizado, hashes, métricas, relatório de validação e perfil de otimização; nunca é sobrescrito nem representa outro item/variante.
4. **`Model3DReview` (decisão vinculada):** decisão humana sobre o hash exato de um artefato, reviewer, checklist, comentário, timestamp e resultado.

O fluxo normal é VALIDATING → QUEUED → GENERATING → NORMALIZING → REVIEW_REQUIRED → APPROVED → PUBLISHED. Estados terminais ou laterais são DRAFT_SINGLE_VIEW, REJECTED_INPUT, FAILED_RETRYABLE, FAILED_FINAL, QUARANTINED e CANCELLED. Toda transição usa compare-and-set de versão; worker duplicado vira no-op.

`POST /v1/admin/catalog/items/{itemId}/model-3d-jobs` exige `Idempotency-Key` e responde `202` com `jobId` e `statusUrl`; `GET /v1/admin/model-3d-jobs/{jobId}` consulta estado; `POST .../{jobId}/cancel` solicita cancelamento; `POST .../{jobId}/decision` registra aprovação ou rejeição. A publicação troca o ponteiro ativo do item apenas quando o `Model3DArtifact` está `APPROVED` e a classe de fonte permite publicação. Os contratos devem definir, no mínimo, `model3d.job.requested`, `model3d.attempt.started`, `model3d.job.completed`, `model3d.artifact.normalized`, `model3d.review.recorded`, `model3d.artifact.published` e `model3d.job.failed`.

**Adapter de geração**

- Definir porta `Model3DGenerationProvider` e adapters substituíveis. A porta expõe capabilities, submit, getStatus, cancel e fetchResult; não mascara diferenças entre providers.
- TRELLIS.2 e Hunyuan3D-2/Hunyuan3D-2mv são candidatos, não dependências aprovadas. A seleção exige benchmark reproduzível com o mesmo conjunto dourado, qualidade revisada, latência, custo, licença, hardware e suporte a multi-view/PBR.
- Habilitar uma combinação provider+modelVersion por perfil de geração. Registrar provider, modelVersion, adapterVersion, parâmetros, seed quando existir e hash do perfil em cada tentativa.
- A mesma tentativa conserva externalJobId único. Timeout com resultado externo desconhecido é consultado e reconciliado; não se cria nova geração até provar falha ou encerrar a tentativa anterior.

**Artefato canônico e otimização**

- Preservar o resultado bruto do provider em storage privado. Produzir um novo artefato canônico GLB/glTF 2.0 autocontido, com PBR metallic-roughness, unidades/orientação normalizadas, bounds calculados e hash próprio.
- Executar glTF Transform com perfil versionado para inspect, dedup/prune, resize/compress de texturas e compressão geométrica compatível com a matriz de browsers. O raw nunca é alterado e a otimização pode ser repetida.
- Executar o glTF Validator da Khronos e bloquear erro estrutural, URI externa, extensão fora da allowlist, conteúdo não permitido e orçamento excedido.
- O perfil obrigatório define limites de bytes de entrada/saída, pixels, vistas, nós, triângulos, materiais, texturas, dimensão de textura, tempo, tentativas, concorrência e créditos por SellerAccount. A feature flag permanece desligada enquanto os limites do perfil não forem preenchidos e validados pelo benchmark.

**Sandbox, storage e cotas**

- Validação, rasterização, parsing e otimização executam em job efêmero com usuário sem privilégio, filesystem raiz somente leitura, diretório temporário dedicado, sem mount do host, limites de CPU/GPU/memória/tempo/processos e rede negada por padrão.
- Somente o adapter pode alcançar endpoint allowlisted do provider. Workers que analisam arquivos não possuem credencial do provider nem acesso amplo ao storage.
- Inputs, raws, previews e GLBs usam prefixo físico por sellerAccountId, criptografia, ACL privada e URL assinada curta. O serviço resolve o tenant no servidor; nunca aceita bucket key ou URL arbitrária enviada pelo cliente.
- Reserva de cota ocorre antes de enfileirar; conclusão, falha e cancelamento liquidam a reserva de forma idempotente. Limites por tenant e globais protegem capacidade e custo.

**Revisão, publicação e viewer**

- Nenhuma saída gerada é publicada automaticamente. O reviewer compara vistas de entrada, turntable, silhueta, orientação, escala declarada, materiais, defeitos e métricas do orçamento. Aprovação referencia o hash exato do `Model3DArtifact`.
- Para publicação, reviewer deve ser diferente do solicitante e possuir permissão contextual no SellerAccount. Rejeição ou nova geração não altera a versão publicada atual.
- Publicar troca transacionalmente o ponteiro `activeModel3DArtifactId` do item de catálogo para um artefato `APPROVED` e emite `model3d.artifact.published` via outbox. Rollback aponta para outro artefato previamente aprovado; objetos permanecem imutáveis.
- O viewer usa React Three Fiber sobre Three.js e `GLTFLoader` somente para GLB próprio, validado e obtido por URL assinada/allowlisted. Draft é visível apenas a owner/reviewers; catálogo público recebe somente o artefato ativo publicado.
- Cards, `/itens/:slug` e `/anuncios/:id` exibem poster e navegam para `SCR-PUB-013` em `/itens/:slug/3d`; eles não mantêm canvas por card. A rota dedicada resolve um item/variante e exatamente um `Model3DArtifact` ativo.
- Na primeira prontidão, Three/R3F executa uma revelação finita de 650–900 ms, limitada a 15°, e entrega `OrbitControls`. Primeiro input interrompe; `prefers-reduced-motion` vai direto à pose neutra; não existe autoplay contínuo. React Bits, se aprovado, atua somente no shell DOM.
- Carregar sob demanda, exibir progresso e fallback 2D, tratar erro/WebGL context loss, usar DPR adaptativo e liberar geometrias, materiais, texturas, ImageBitmaps, controles e listeners ao desmontar, trocar versão ou mudar `slug`. Um único renderer/canvas permanece ativo.
- Toda tela single-view mostra “Rascunho 3D gerado por IA — geometria inferida, não exata”. Aprovação de uma saída multi-view significa apta para uso visual, não reconstrução metrológica exata.

### Alternativas consideradas

**Gerar sincronamente na requisição HTTP**

- Vantagem: interface aparentemente simples.
- Rejeição: timeout, retry do cliente e indisponibilidade do provider duplicariam trabalho caro e deixariam resultado externo desconhecido.

**Publicar diretamente o arquivo do provider**

- Vantagem: menor latência até o catálogo.
- Rejeição: elimina validação, orçamento, proveniência, compatibilidade do viewer, revisão e rollback seguro.

**Acoplar domínio ao SDK de um único provider**

- Vantagem: implantação inicial mais curta.
- Rejeição: mistura estado de negócio com contrato externo e impede benchmark, fallback controlado e troca de modelo.

**Tratar uma única imagem como reconstrução exata**

- Vantagem: menor atrito de entrada.
- Rejeição: superfícies ocultas não estão observadas; a afirmação não é tecnicamente sustentada.

### Consequências

**Positivas**

- Geração lenta e falhas externas não ocupam a API nem duplicam custo por retry.
- Artefatos imutáveis permitem auditoria, comparação, rollback e reprocessamento.
- Adapter e benchmark tornam a escolha de modelo reversível.
- Gate humano e validação técnica protegem catálogo e viewer.
- Cotas e isolamento limitam abuso e blast radius por tenant.

**Custos e limites**

- Exige workers com GPU ou integração externa, fila de revisão, storage adicional e reconciliação.
- Multi-view aumenta atrito de captura e não garante exatidão dimensional.
- Perfis de otimização e matriz de extensões precisam acompanhar browsers e dispositivos suportados.
- Regeração cria nova versão e pode consumir nova cota; não há atualização destrutiva.

### Falhas e controles

| Falha | Controle obrigatório |
|---|---|
| SVG executa script ou busca recurso remoto | Sanitização estrita, rasterização em sandbox sem rede e teste com corpus malicioso |
| Imagem causa decompression bomb | Limites antes/depois de decodificar, timeout e memória limitada |
| Vistas representam objetos diferentes | Hash/perceptual checks, regras de coerência e revisão humana |
| Timeout gera duas cobranças/jobs | externalJobId único, estado UNKNOWN, consulta/reconciliação e retry idempotente |
| Provider conclui após cancelamento | Consumir callback, armazenar raw em quarentena e impedir promoção de estado |
| GLB contém URI externa ou extensão não suportada | Canonicalização autocontida, allowlist e glTF Validator |
| Modelo excede GPU/memória do viewer | Budget de triângulos/texturas/bytes, teste em dispositivo alvo e fallback 2D |
| Otimização degrada visual | Preservar raw, comparação visual automatizada e revisão da versão otimizada |
| Solicitante contorna revisão | Máquina de estados, autorização contextual e reviewer diferente do solicitante |
| `CatalogAsset` cruza tenant | sellerAccountId em todas as entidades, prefixo físico, RLS e teste adversarial |
| Versão aprovada é sobrescrita | Objetos content-addressed, registro imutável e publicação por ponteiro |
| Custo foge do orçamento | Reserva de cota, concorrência global/por tenant, circuit breaker e alertas |
| Viewer perde contexto WebGL ou vaza memória | Error boundary, context-loss test, dispose explícito e fallback 2D |

### Evidência e teste de aceite

- [ ] Corpus com SVG ativo, referência externa, MIME divergente e decompression bomb é rejeitado sem rede e sem exaustão do worker.
- [ ] Duas chamadas com a mesma `Idempotency-Key` produzem um `Model3DJob` e, no máximo, uma tentativa externa ativa.
- [ ] Timeout, callback atrasado, cancelamento e worker duplicado convergem sem segunda cobrança nem promoção indevida.
- [ ] Benchmark reproduzível compara TRELLIS.2 e Hunyuan3D-2/2mv no mesmo conjunto dourado single/multi-view, com qualidade humana, latência, custo e uso de GPU.
- [ ] GLB canônico passa no glTF Validator; URI externa, extensão proibida e budget excedido bloqueiam REVIEW_REQUIRED.
- [ ] glTF Transform gera relatório antes/depois e o hash do raw permanece inalterado.
- [ ] Single-view termina em DRAFT_SINGLE_VIEW, mostra o aviso obrigatório e não alcança APPROVED/PUBLISHED por API, worker ou acesso direto ao banco.
- [ ] Publicação sem revisão, pelo solicitante ou sobre versão/hash diferente é negada e auditada.
- [ ] Teste de isolamento prova que outro SellerAccount não lê input, raw, preview, GLB, status ou URL assinada.
- [ ] E2E de `SCR-PUB-013` cobre desktop/mobile, deep link/Back, carregamento lento, GLB inválido, perda de contexto, intro finita/interrompida, reduced motion, fallback 2D e um único canvas/artefato ativo.
- [ ] Leak test troca repetidamente `slug`/variante e comprova cancelamento do decode anterior e liberação de geometria, materiais, texturas, ImageBitmaps, controles e listeners.
- [ ] Rollback restaura versão aprovada anterior sem apagar histórico e emite evento canônico uma única vez.
- [ ] Teste de carga confirma cotas, concorrência, backlog/lag, cancelamento e alertas antes de habilitar a feature flag.

### Referências oficiais

- [Microsoft — TRELLIS.2](https://github.com/microsoft/TRELLIS.2)
- [Tencent — Hunyuan3D-2 e Hunyuan3D-2mv](https://github.com/Tencent-Hunyuan/Hunyuan3D-2)
- [Khronos — glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [Khronos — glTF Validator](https://github.com/KhronosGroup/glTF-Validator)
- [glTF Transform — documentação oficial](https://gltf-transform.dev/)
- [Three.js — GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [React Three Fiber — Canvas e primeira cena](https://r3f.docs.pmnd.rs/getting-started/your-first-scene)
- [OWASP — File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

---

## ADR-014 — Payment resolution, hold de 168h e payout manual comprovável

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Engenharia, Financeiro, Risco, Compliance e Operações

### Contexto

O marketplace precisa receber confirmação por API/webhook, proteger o valor do seller por sete dias e permitir baixa manual de saque. Também precisa resolver o caso em que o comprador pagou, mas o webhook falhou. A plataforma não pode transformar um clique do Master em settlement nem anunciar um modo de saque que o PSP/território não suporta.

### Decisão

1. `Payment` é o único agregado do ciclo de pagamento; `PaymentAttempt` preserva tentativas.
2. Webhook assinado entra em inbox, é deduplicado e reconciliado por consulta/relatório canônico do PSP antes de settlement.
3. `PaymentResolutionCase` guarda evidências, proposta e decisão maker-checker; aprovação executa o mesmo comando idempotente do webhook.
4. Settlement cria `JournalEntry`/`Posting`, `BalanceLot` e `Hold` na mesma transação. `eligibleAt = Payment.settledAt + 168h`; conclusão, disputa, risco, KYC, refund e chargeback são gates sem outro relógio.
5. `PayoutRequest` reserva lotes disponíveis. A execução real é `PayoutAttempt`, seja `PROVIDER_API`, `PROVIDER_DASHBOARD` ou `EXTERNAL_BANK` homologado.
6. Baixa manual exige referência externa única, `PayoutEvidence` privada/escaneada, valor, moeda, destino tokenizado, executor, instante, auditoria e postings finais.
7. Um `ProviderCapabilityRegistry` por país/moeda/contrato bloqueia o modo indisponível; não existe fallback simulado.

### Alternativas consideradas

- confiar no redirect do browser: rejeitado por spoofing e resultado inconclusivo;
- permitir `UPDATE payment.status`: rejeitado porque quebra PSP, ledger, hold, entrega e auditoria;
- iniciar sete dias na conclusão: rejeitado nesta versão; o requisito fecha em `settledAt`, com conclusão como gate;
- “marcar como pago” sem tentativa/evidência: rejeitado;
- presumir que Stripe/Mercado Pago oferecem a mesma operação em qualquer país: rejeitado por capability contratual.

### Consequências

- operação financeira permanece auditável e repetível sob retry/corrida;
- payout manual pode exigir processo externo e maior carga operacional;
- lançamento brasileiro depende da homologação jurídica/contratual do arranjo e do PSP;
- telas precisam diferenciar protegido, hold, congelado, disponível, reservado, pago, falho e retornado.

### Evidência e teste de aceite

- [ ] PSP sandbox/conta de teste real, webhook assinado e lookup/relatório reconciliado.
- [ ] Cem eventos repetidos e corrida staff×webhook produzem um settlement/journal/lot/hold.
- [ ] Testes em `settledAt + 168h − 1ms`, no limite e `+1ms`, com todos os gates.
- [ ] Referência de payout duplicada e prova ausente são rejeitadas; retry cria nova tentativa sem saldo novo.
- [ ] Reconciliação PSP × `Payment` × ledger × lotes × payouts detecta divergência e alerta.
- [ ] Capability não homologada retorna problema tipado e deixa ação indisponível.

### Referências oficiais

- [Stripe — webhooks](https://docs.stripe.com/webhooks)
- [Stripe Connect — manual payouts e disponibilidade por país](https://docs.stripe.com/connect/manual-payouts)
- [Mercado Pago — notificações Webhooks](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
- [Mercado Pago — Split Payments 1:1](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace)

---

## ADR-015 — Reputação, progressão e leaderboard são projeções versionadas

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Produto, Trust & Safety, Dados, Operações e Engenharia

### Contexto

Avaliações 0–5, níveis por valor vendido, insígnias, recompensas e ranking mensal precisam ser explicáveis, resistentes a refund/fraude e editáveis pelo Master sem reescrever fatos históricos.

### Decisão

1. `OrderReview` pertence a um `Order` concluído; há no máximo uma por papel avaliador e nota zero é distinta de ausência.
2. `ReputationProjection` separa reputação de comprador/vendedor, registra fórmula, fatores, cobertura e `asOf` e pode ser reconstruída.
3. Cada venda elegível cria `ProgressionContribution`; refund/chargeback/fraude cria contribuição compensatória, sem apagar o evento original.
4. `AccountLevelDefinition` versionada expressa L1–L10 e thresholds; `AccountLevelAssignment` é a projeção corrente por seller.
5. `BadgeDefinition`/`RewardDefinition` são políticas; `BadgeAward`/`RewardAward` são fatos com origem, vigência, revogação motivada e fulfillment.
6. `LeaderboardSeason` congela janela, timezone, BRL base, fórmula e desempate. `LeaderboardContribution` alimenta `LeaderboardProjection`; fechamento congela top 3 e `LeaderboardAward`.
7. Nenhuma projeção/award autoriza saque, altera ledger ou serve como selo de identidade verificada.

### Alternativas consideradas

- colunas mutáveis `rating`, `level` e `points` no seller: rejeitadas por falta de lineage/rebuild;
- apagar pontos/nível após refund: rejeitado; usa-se compensação;
- ranking editável pelo Master: rejeitado; o Master configura policy/prêmio, não posição;
- publicar imediatamente a primeira review: rejeitado sem regra anti-retaliação/moderação.

### Consequências

- dashboards precisam mostrar versão/freshness e explicar divergências;
- rebuild e fechamento mensal viram jobs observáveis;
- antifraude pode excluir/congelar contribuição por decisão auditável;
- mudança de faixa exige nova versão e regra explícita de migração.

### Evidência e teste de aceite

- [ ] testes de participante, estranho, self-review, duplicata, nota zero e dupla submissão concorrente;
- [ ] rebuild da reputação/nível/ranking produz checksum idêntico para o mesmo conjunto de fatos;
- [ ] bordas R$100/R$500/R$1.000/R$3.000/R$5.000/R$7.500/R$10.000/R$20.000/R$50.000;
- [ ] refund cria contribuição negativa e não apaga award sem policy/fraude publicada;
- [ ] temporada fechada não muda; top 3 e desempate permanecem auditáveis.

---

## ADR-016 — Consentimento e capabilities governam o pós-venda omnicanal

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Marketing, Privacidade, Segurança, Produto e Engenharia

### Contexto

Carrinho abandonado, renovação, recompra, WhatsApp, Instagram, criativos, cupons e afiliados exigem automação útil sem entregar PII ao seller, disparar spam ou confundir clique/leitura com receita.

### Decisão

1. `ContactPoint` é protegido pela Platform; seller opera segmentos e resultados, não telefone/WhatsApp bruto.
2. `ConsentRecord` é específico por canal, finalidade, remetente, origem, versão e tempo; `SuppressionEntry` tem precedência em todo envio.
3. `Campaign`/`CampaignVersion` e `Journey`/`JourneyVersion` separam identidade de configuração publicada. `MessageTemplate` e `CreativeAsset` são versionados/revisados.
4. Um envio lógico é `Dispatch`; retry cria `DeliveryAttempt`; callback normalizado é `ChannelEvent`. Aceite/entrega/leitura não é conversão.
5. Delays duráveis, estado de jornada e outbox ficam em PostgreSQL. Redis/Valkey pode acelerar rate limit, locks curtos, cache e dedupe, mas nunca é a fonte canônica.
6. WhatsApp usa API oficial, opt-in e template/janela aplicáveis. Instagram apenas responde/continua conversa iniciada pelo usuário conforme capability; cold DM fica bloqueado.
7. `CouponRedemption`, `AttributionTouch` e `AttributionSnapshot` são idempotentes; `AffiliateCommission` nasce somente após conversão reconciliada e suporta reversão.
8. Ferramenta open source pode ser adotada por adapter após POC/licença/isolamento; não substitui consentimento, pedido, pagamento ou atribuição canônicos.

### Alternativas consideradas

- exportar telefone ao seller: rejeitado por minimização, abuso e isolamento;
- guardar jornada somente em fila/cache: rejeitado por perda/replay;
- Instagram como cold outreach: rejeitado por capability/política;
- atribuir receita a click/read: rejeitado; somente outcome financeiro canônico;
- adotar CRM/automation como fonte de cliente: rejeitado por duplicação.

### Consequências

- canais podem ficar indisponíveis até verificação de negócio/template/remetente;
- cada tenant/finalidade/canal possui quota, quiet hours e kill switch;
- opt-out precisa propagar rapidamente e ser comprovado;
- dashboard separa `sent/accepted/delivered/read/click/settled/refunded`.

### Evidência e teste de aceite

- [ ] opt-out entre seleção e envio suprime o `Dispatch` sem corrida;
- [ ] retry/replay cria um envio lógico e preserva tentativas/eventos fora de ordem;
- [ ] cross-tenant/PII export negative tests e logs sem contato bruto;
- [ ] conta Meta de desenvolvimento prova template, mídia, webhook e regras do Instagram;
- [ ] cupom concorrente não ultrapassa limite; refund gera reversão de atribuição/comissão;
- [ ] reinício total reconstrói schedules/projeções a partir de PostgreSQL/outbox.

### Referências oficiais

- [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy)
- [Meta — WhatsApp Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api)
- [Meta — Instagram Send API](https://www.postman.com/meta/instagram/folder/23987686-f05b6c9f-a4be-4511-9f88-1cd94828fdf3)
- [LGPD — Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)

---

## ADR-017 — Studio reutiliza catálogo e anúncio; submissão não é produto paralelo

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Produto, Catálogo, Design 3D, Segurança e Engenharia

### Contexto

O admin precisa cadastrar produtos/skins 2D ou 3D e sellers precisam iniciar anúncios pré-preenchidos ou propor novos materiais. Criar `StudioProduct`, `SellerProduct`, `ListingDraft` e outro catálogo quebraria identidade, moderação, SEO e lineage.

### Decisão

1. `CatalogItem` é a identidade compartilhada; `CatalogAsset` guarda mídia/fonte; `CatalogLibrary` é apenas read model.
2. Selecionar item no Studio inicia o mesmo `Listing`/`ListingRevision` de criação de anúncio, pré-preenchendo apenas campos governados.
3. Ausência de item/asset abre `CatalogSubmission`; aprovação vincula ou cria o recurso canônico. A submissão nunca aparece como produto público.
4. `CatalogItemRelation` representa complemento, upsell, compatibilidade e renovação com tipo/direção/vigência/justificativa.
5. `ProductLifecyclePolicy` é separado de `ReturnPolicySnapshot`.
6. 2D aprovado pode publicar sem 3D. 3D usa `CatalogAsset → Model3DJob → Model3DArtifact` da ADR-013, com proveniência, segurança, validação e revisão humana.
7. Publicação é uma decisão separada e troca ponteiro ativo; artefato rejeitado permanece em quarentena auditável.

### Alternativas consideradas

- catálogo por tenant: rejeitado como default; sellers compartilham identidade e contribuem por caso;
- gerar 3D síncrono ao criar anúncio: rejeitado por custo, falha e segurança;
- exigir 3D para todo produto: rejeitado; 2D é primeira classe;
- inferir devolução a partir de “perecível”: rejeitado; lifecycle e return policy têm owners diferentes.

### Consequências

- curadoria global reduz duplicação e melhora SEO/recomendação;
- campos seller-owned continuam preço, instruções, prova, entrega e conteúdo permitido;
- submissions e assets exigem storage, scan, licença, quotas e SLA de revisão;
- catálogo precisa de merge/tombstone/versionamento governados.

### Evidência e teste de aceite

- [ ] escolha no Studio e wizard tradicional produzem o mesmo `Listing`/estado/contrato;
- [ ] contribuição não aprovada não aparece em busca, SEO, relação ou anúncio público;
- [ ] hash/licença/MIME/malware/cross-tenant/merge são testados;
- [ ] 2D funciona sem WebGL; GLB publicado é real e possui poster/fallback;
- [ ] lifecycle não habilita devolução e relação não adiciona item ao carrinho automaticamente.

---

## ADR-018 — Plano comercial do anúncio é policy versionada e snapshot

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Produto, Financeiro, Jurídico, Trust & Safety e Engenharia

### Contexto

Os planos Básico (7,5%), VIP (10%) e Premium (12%) alteram comissão, exposição e classes de SLA. O Premium também altera a fórmula mensal e concede insígnia após dez vendas elegíveis. Essas condições não podem reprecificar pedidos históricos nem comprar decisão de refund/risco.

### Decisão

1. `ListingPlanPolicyVersion` define fee em basis points, classe de prioridade, SLAs, fórmula de bonus, território, vigência e estado.
2. `ListingCommercialSnapshot` congela a versão no anúncio e novamente no pedido, incluindo fee e disclosure apresentados.
3. Busca/ranking de anúncios aplica buckets explicáveis: Premium acima de VIP acima de Básico somente dentro da elegibilidade/relevância e dos limites publicados.
4. “Prioridade em ticket/refund/payout” significa fila/SLA de resposta; não altera prova, mérito, segregação, risco, KYC ou lei.
5. Premium mensal acrescenta meio ponto por real elegível na unidade inteira publicada; base e bonus permanecem separados em `LeaderboardContribution`.
6. Dez vendas Premium maduras/elegíveis geram `BadgeAward` idempotente.

### Alternativas consideradas

- percentuais hard-coded no frontend: rejeitados;
- recalcular pedido antigo com policy atual: rejeitado;
- comprar facilidade de aprovação: rejeitado por risco consumerista/fraude;
- usar um score opaco único para ranking de busca: rejeitado; buckets/sinais precisam ser explicáveis.

### Consequências

- publicação de policy exige simulação, maker-checker e comunicação;
- order/ledger precisam armazenar bruto, fee, líquido, policy e plan snapshot;
- experimentos de ranking não podem ultrapassar as garantias contratuais congeladas.

### Evidência e teste de aceite

- [ ] cálculos exatos de 750/1.000/1.200 bps, arredondamento e moeda em centavos;
- [ ] mudança de versão não altera anúncio/pedido concluído;
- [ ] prioridade muda fila/posição permitida, não taxa de deferimento controlada por mérito;
- [ ] R$100 Premium produz base e bonus reproduzíveis conforme fórmula publicada;
- [ ] décima venda elegível cria um `BadgeAward`; retry/refund não duplica/manipula o marco.

---

## ADR-019 — Mercado, SEO e crawl derivam de publicação e políticas canônicas

**Status:** PROPOSTA  
**Data:** 22 de agosto de 2026  
**Responsáveis pelo aceite:** Produto, SEO/Conteúdo, Internacionalização, Legal e Engenharia

### Contexto

O marketplace precisa ser indexável globalmente sem expor carrinho, conta, filtros infinitos, conteúdo privado ou dados falsos. Locale, moeda, disponibilidade, PSP e termos variam por mercado; 3D não pode impedir HTML útil.

### Decisão

1. `MarketPolicy` governa locale, território, moeda de exibição, disponibilidade, PSP/canal, termos e indexabilidade. Conversão visual nunca muda a moeda do ledger.
2. Páginas públicas entregam HTML server-rendered/prerendered com título, descrição, breadcrumbs, conteúdo factual, poster e fallback antes de JavaScript/WebGL.
3. canonical, hreflang recíproco, redirects, status HTTP, `robots.txt`, sitemap e JSON-LD derivam de `CrawlPolicy` e do mesmo estado de publicação.
4. Conta, carrinho, checkout, admin/master, busca interna, preview/draft e URLs de filtro não canônicas ficam fora do índice.
5. `Product`/`Offer`/`Review` structured data só usa fatos visíveis/canônicos; ausência de estoque/preço/review não é preenchida.
6. Políticas de `Googlebot`, `Google-Extended`, `OAI-SearchBot`, `GPTBot` e outros agentes são separadas e editáveis pelo Master; search crawling não implica autorização para training.
7. Atribuição de campanha usa links opacos e policy versionada, sem PII na URL; SEO não é fonte de conversão financeira.

### Alternativas consideradas

- SPA client-only para todas as páginas: rejeitada pelo conteúdo tardio/falhas de crawl;
- `robots.txt` manual desconectado do catálogo: rejeitado por drift;
- indexar todas as combinações de filtro/market: rejeitado por crawl trap/duplicação;
- publicar schema otimista: rejeitado por inconsistência e política de busca.

### Consequências

- publicação de catálogo dispara projeção pública, sitemap/cache purge e validação de metadata;
- locale/market precisam de fallback e revisão humana de conteúdo sensível;
- cache/CDN/search index são derivados e invalidáveis por versão;
- a expansão global depende de PSP, fiscal, consumidor, conteúdo e disponibilidade por território.

### Evidência e teste de aceite

- [ ] HTML sem JS contém conteúdo/links essenciais e 3D falho preserva compra informada;
- [ ] testes de canonical/hreflang/status/redirect e sitemaps sem URL privada/draft;
- [ ] JSON-LD corresponde ao DOM/fatos e valida em fixtures reais;
- [ ] mudança de market/crawl policy produz diff, aprovação, rollback e audit;
- [ ] Core Web Vitals, crawl logs e Search Console possuem owner/SLO/alerta.

### Referências oficiais

- [Google — robots.txt](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt)
- [Google — sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google — canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google — localized versions e hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google — Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product)

---

## 3. Ordem de implementação e gates

| Ordem | ADRs | Saída mínima |
|---:|---|---|
| 1 | ADR-001, ADR-002, ADR-003 | skeleton modular, schemas/roles, tenant context, outbox/inbox e testes de fronteira |
| 2 | ADR-010, ADR-012 | OpenAPI/AsyncAPI/JSON Schemas, problems, idempotência e contract gates |
| 3 | ADR-004, ADR-005, ADR-006, ADR-009 | ledger, adapter PSP, quarantine, refund workflow, SoD e concorrência P0 |
| 4 | ADR-007, ADR-008 | projeções Minha conta/360/Growth, freshness, RLS e rebuild |
| 5 | ADR-014 | payment resolution, hold 168h, payout manual, evidence/capability e reconciliação |
| 6 | ADR-015, ADR-018 | reviews/reputação, contribuições, níveis, leaderboard, awards e commercial snapshots |
| 7 | ADR-016 | consentimento/supressão, journeys, adapters Meta, cupom/afiliado e atribuição reconciliada |
| 8 | ADR-013, ADR-017 | Studio/catalog/submissions e pipeline 2D→3D isolado, validado e revisado |
| 9 | ADR-019 | market/crawl policies, SSR, canonical/hreflang/schema/sitemaps e budgets |
| 10 | ADR-011 | telemetria, reconciliação, replay, alertas, restore e game days |

Nenhum fluxo financeiro é considerado pronto apenas por happy path. O gate exige concorrência real no PostgreSQL, duplicação e inversão de webhooks, timeout com resultado externo desconhecido, reconciliação e restore.

## 4. Histórico

| Versão | Data | Alteração |
|---|---|---|
| 1.0 | 22/08/2026 | Criação das ADR-001 a ADR-012 e respectivos critérios de evidência |
| 1.1 | 22/08/2026 | Inclusão da ADR-013 para geração 2D→3D assíncrona, segura, versionada e revisada |
| 2.0 | 22/08/2026 | Inclusão das ADR-014 a ADR-019 para financeiro manual, reputação/progressão, pós-venda omnicanal, Studio, planos e SEO/global |
| 2.1 | 23/08/2026 | Inclusão do registro verificável de implementação, limites e gates executados sem alterar o aceite humano das ADRs |
