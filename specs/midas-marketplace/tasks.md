# Tasks — Midas Marketplace

Versão: 1.0  
Status: **SDD_PRONTO_IMPLEMENTACAO_PENDENTE**  
Owner: Engenharia  
Última atualização: 22 de agosto de 2026

> Ordem executável de implementação. Todas as tarefas estão pendentes porque o repositório atual é documental. Cada tarefa só avança com a evidência indicada e com as dependências anteriores concluídas. `docs/05-BACKLOG-ROADMAP.md` continua owner das ondas e gates; este arquivo decompõe o trabalho técnico sem reescrever o backlog.

## Regras transversais de execução

- Não declarar uma capability pronta com handler fixo, timer de sucesso, dado fabricado, provider simulado ou função mockada.
- Testes de infraestrutura usam dependências reais em containers Podman; integrações externas usam sandbox/homologação oficial e reconciliação por consulta/webhook.
- Fixtures determinísticas podem representar dados de entrada, mas não substituir o comportamento do serviço sob teste.
- Cada slice deve ligar `RF → SCR-ID → route/operationId → schema → estado/evento → permission → teste → owner`.
- Dinheiro usa unidade mínima + moeda; comandos financeiros relêem a fonte canônica e nunca derivam saldo no frontend.
- Toda task sensível inclui teste negativo de autorização e registra comando, saída e artefato de evidência.
- G0–G3 podem bloquear publicação/operação comercial sem impedir implementação clean-room e sandbox; bloqueio precisa permanecer visível.

---

- [ ] 1. Registrar baseline, decisões e gates de início
  - Arquivos-alvo: `docs/08-ADRS-DECISOES-ARQUITETURAIS.md`, `docs/05-BACKLOG-ROADMAP.md`, `docs/coordenacao/implementation-readiness.md`.
  - Confirmar responsáveis e estado de ADR-001..019; registrar escolhas pendentes de stack, PSP, broker/cache, object storage, busca, canais e provider 3D; mapear G0–G3 a owner, evidência e comportamento fail-closed.
  - Não remover bloqueios jurídicos/financeiros por decisão técnica; separar implementação genérica de habilitação comercial.
  - Evidência/teste: revisão assinada por owners; links válidos; nenhum ADR contraditório sem registro de substituição; relatório termina em `READY_FOR_BOOTSTRAP` ou bloqueio objetivo.
  - _Requisitos: 18.3, 34.4, 35.8_
  - _Onda: 0_

- [ ] 2. Escolher stack e congelar layout físico do workspace
  - Arquivos-alvo: manifests/lockfile a definir, `apps/web/`, `apps/api/`, `apps/realtime/`, `apps/worker/`, `modules/`, `packages/contracts/`, `infra/`, ADR de stack sem número inventado antes do registro.
  - Avaliar e registrar frontend, backend/runtime, acesso PostgreSQL/migrations, test runners, broker, Redis/Valkey e object storage; conservar os três processos da ADR-001 e módulos com portas públicas.
  - Definir regras automáticas contra ciclos, import interno de outro módulo e SQL cross-schema.
  - Evidência/teste: manifests e lockfile reais; `lint`, `typecheck`, teste mínimo e build executados; pipeline falha intencionalmente em fixture de dependência proibida e passa após removê-la.
  - _Requisitos: 35.2, 35.7_
  - _Onda: 0_

- [ ] 3. Subir infraestrutura local reproduzível em Podman
  - Arquivos-alvo: `infra/podman/`, configuração de PostgreSQL, broker, Redis/Valkey e object storage escolhidos, scripts de health/teardown seguros.
  - Criar serviços com volumes nomeados, health checks, limites e redes; comprovar cada dependência antes de iniciar API/workers; cache nunca recebe fato final.
  - Adicionar ambiente de teste isolado, migrations vazias iniciais e política de secrets por referência.
  - Evidência/teste: `podman ps` com health real; conexão autenticada de cada processo; parada de cache/broker mostra degradação prevista; teardown preserva volumes não alvo.
  - _Requisitos: 35.3, 35.7_
  - _Onda: 0_

- [ ] 4. Criar contratos executáveis e lint de rastreabilidade
  - Arquivos-alvo: `packages/contracts/openapi/`, `packages/contracts/events/`, `packages/contracts/schemas/`, `tools/traceability/`, pipeline CI.
  - Materializar OpenAPI 3.1, schemas de eventos e catálogo inicial de permissões/erros; gerar matriz contínua `RF-001–300` e `RNF-001–050` contra os 95 `SCR-ID`.
  - Fazer CI falhar em RF, tela, rota, `operationId`, schema, evento/estado, teste ou owner órfão e em nome divergente do dicionário canônico.
  - Evidência/teste: lint de OpenAPI/eventos; exemplos validados; teste com órfão/duplicata proposital falha; matriz completa gerada sem atribuir novos IDs RF/RNF/SCR.
  - _Requisitos: 1.1, 2.1, 12.1, 35.7_
  - _Onda: 0_

- [ ] 5. Implementar fundação transacional, outbox/inbox e auditoria
  - Arquivos-alvo: módulo compartilhado de IDs/dinheiro/tempo/problem details, migrations de outbox/inbox/audit, dispatcher/consumer base, telemetry bootstrap.
  - Implementar dinheiro em unidade mínima, timestamps UTC, correlation/causation, aggregate version, transação agregado+outbox e inbox+efeito; audit append-only separado de analytics.
  - Implementar retry integral para SQLSTATE concorrentes, DLQ/replay autorizado, redaction e health/readiness por processo.
  - Evidência/teste: PostgreSQL real prova rollback sem outbox, crash pós-commit com publicação posterior, 100 entregas duplicadas com um efeito, ordem/lacuna/replay e audit imutável.
  - _Requisitos: 9.1, 12.2, 13.2, 17.3, 35.2, 35.3, 35.6_
  - _Onda: 1_

- [ ] 6. Implementar Identity, sessões, device trust e IAM/PDP
  - Arquivos-alvo: módulos Identity, Device Trust, IAM e Sellers; rotas `SCR-ACC-001..008`; migrations e testes próprios.
  - Implementar registro/verificação, autenticação, passkey/WebAuthn, TOTP/recovery, sessão segura, recuperação não enumerável, device enrollment/revocation, roles/grants, ABAC, step-up e break-glass.
  - Resolver `User → SellerMembership → SellerAccount` no servidor; adicionar origem/política administrativa mais restrita.
  - Evidência/teste: E2E cadastro→login→MFA/passkey→revogação; matrix BOLA/BFLA/cross-tenant; usuário sem membership não acessa seller; staff sem grant/step-up falha fechado.
  - _Requisitos: 1.1, 1.2, 1.3, 12.1, 12.2, 12.3, 15.1, 35.1_
  - _Onda: 1_

- [ ] 7. Implementar privacidade, idade, policies e direitos do titular
  - Arquivos-alvo: módulos Privacy/Policy, `SCR-ACC-004/010..012`, `SCR-PUB-011..012`, retenção/legal hold e adapters aprovados.
  - Implementar preferences versionadas, consentimento de cookies/personalização, age assurance minimizada, `DataRightsRequest`, export seguro, eliminação/anonimização e snapshots conserváveis de policy.
  - Manter obrigação/legal hold segregados; não armazenar documento bruto de idade além da necessidade definida.
  - Evidência/teste: revogação interrompe novos eventos individualizados; export exclui segredo de terceiros; eliminação preserva apenas base registrada; teclado/leitor de tela nos fluxos.
  - _Requisitos: 16.1, 16.2, 16.3, 18.1, 35.5, 35.6_
  - _Onda: 1_

- [ ] 8. Materializar design system, shells e contrato de estados
  - Arquivos-alvo: tokens/componentes no web app, catálogo visual, wrappers React Bits aprovados, `ui/shells/`, `ui/templates/` e layouts das sete famílias de tela.
  - Implementar os 9 shells e 41 templates reutilizáveis definidos em `docs/21-SISTEMA-DE-LAYOUTS-E-TEMPLATES-UI.md`, context switch de `SellerAccount`, navegação responsiva e estados loading/empty/partial/stale/error/conflict/rate-limit.
  - Manter motion fora de regra de negócio; reduced motion, foco e semântica são obrigatórios; nenhum skeleton contém fato inventado.
  - Evidência/teste: catálogo equivalente renderiza 9/9 shells e 41/41 templates; matriz `SCR → shell → template` resolve 95/95 telas; axe, teclado, zoom 200%, viewports 320/375/768/1280/1440 e budget de motion; React Bits não toca canvas nem estado financeiro.
  - _Requisitos: 5.3, 20.1, 20.2, 35.4, 35.5_
  - _Onda: 1_

- [ ] 9. Implementar catálogo, taxonomia e pipeline seguro de assets 2D
  - Arquivos-alvo: módulo Catalog, migrations de `CatalogItem`/versões/`CatalogAsset`, upload direto, quarentena, import/dry-run e `SCR-ADM-003`.
  - Implementar versionamento, visibilidade/território/licença, hash, MIME real, re-encode, EXIF removal, antivírus/scan, tombstone e rollback lógico.
  - Disponibilizar query de biblioteca escopada sem criar cópias por seller ou anúncio.
  - Evidência/teste: corpus de arquivo válido/malformado/polyglot/SVG ativo; import com diff e rollback; asset não aprovado nunca chega ao público; teste negativo cross-tenant.
  - _Requisitos: 2.1, 2.2, 2.3, 33.1, 35.6_
  - _Onda: 2_

- [ ] 10. Implementar `Model3DJob` e produção de `Model3DArtifact`
  - Arquivos-alvo: módulo 3D Assets, worker isolado, adapter selecionado, migrations, object storage privado/público e `SCR-ADM-015`.
  - Implementar entradas autoritativa/multi-view/single-view, job idempotente, progresso persistido por fase, cancelamento, limits CPU/GPU/memória/tempo/egress, glTF validator, budgets e renders fixos.
  - Revisão humana promove artefato imutável ou mantém quarentena; rollback troca ponteiro ativo do `CatalogItem`.
  - Evidência/teste: job real em provider/motor homologado para amostra licenciada; GLB validado; single-view rotulado draft; arquivo externo/malicioso bloqueado; replay/cancelamento sem duplicar artefato.
  - _Requisitos: 25.1, 25.2, 25.3, 25.4, 33.1, 35.3, 35.6_
  - _Onda: 2_

- [ ] 11. Implementar a rota individual 3D e fallback 2D
  - Arquivos-alvo: `SCR-PUB-013`, loader R3F/Three.js, poster/galeria DOM, lifecycle de recursos e telemetry allowlisted.
  - Resolver slug/variante para um `CatalogItem` e um `Model3DArtifact` publicado; carregar chunk/GLB sob demanda; intro única 650–900 ms; controles, retorno à origem e fallback acessível.
  - Abortar fetch/decode obsoleto e descartar renderer, RAF/tween, geometria, materiais, texturas, observers, controles e listeners na troca/unmount.
  - Evidência/teste: E2E card→3D→voltar e A→B; um canvas/artefato; primeiro input interrompe intro; reduced motion salta à pose; context loss mantém compra/DOM; soak sem crescimento contínuo de memória.
  - _Requisitos: 26.1, 26.2, 26.3, 35.5, 35.7_
  - _Onda: 2_

- [ ] 12. Implementar Listing, craft, prova e moderação
  - Arquivos-alvo: módulos Listings/Moderation, migrations, `SCR-SEL-004..007`, `SCR-ADM-002` e contratos correspondentes.
  - Implementar draft/revisões, quatro slots de craft quando elegível, preço/entrega/mídia/prova, submission, claim, checklist, decisão, correção e publicação.
  - Aplicar version/`If-Match`, reserva de claim, segregação e capabilities por tipo/território; remover tipo `ACCOUNT` do canal Standoff 2.
  - Evidência/teste: draft restore; mudança material cria revisão; craft inválido falha; dois revisores têm um claim; autor não se aprova; anúncio P2P não publica sem decisão real.
  - _Requisitos: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 15.2, 15.3_
  - _Onda: 3_

- [ ] 13. Implementar Search, Recommendation, Market Data e canal Midas
  - Arquivos-alvo: módulos Search/Recommendation/Market Data/Midas Inventory, projectors, `SCR-PUB-001..007` e `SCR-ADM-014`.
  - Implementar índice derivado/tombstone, busca cursorizada, filtros, ranking explicável, consentimento de personalização, feeds licenciados, candles, freshness e separação P2P/Midas.
  - Validar disponibilidade canônica antes de ação; referência gold nunca substitui preço fiduciário.
  - Evidência/teste: replay reconstrói índice; item vendido sai dentro do SLO medido; fonte stale não vira zero; “por que vejo” é consistente; P2P/Midas não se misturam contabilmente.
  - _Requisitos: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 10.1, 10.2, 10.3, 35.4_
  - _Onda: 3_

- [ ] 14. Implementar conversa, proposta e proteção anti-PII
  - Arquivos-alvo: módulos Conversation/Trust, gateway realtime, `SCR-BUY-001..002` e policies de moderação/recurso.
  - Implementar sequência/idempotência, proposta/validade, detector anti-PII, spam/rate limit, strike proporcional, revisão humana e política pós-pagamento.
  - Gateway chama portas públicas e não escreve estado financeiro.
  - Evidência/teste: mensagens concorrentes mantêm ordem; conteúdo ofuscado proibido não é entregue; falso positivo é recorrível; terceiro não lê thread; gateway sem credencial financeira.
  - _Requisitos: 7.1, 7.2, 7.3, 35.1, 35.6_
  - _Onda: 4_

- [ ] 15. Implementar reserva, checkout, `Order`, `Payment` e entrega
  - Arquivos-alvo: módulos Cart/Checkout, Orders/Delivery, Payments; `SCR-BUY-003/006`; adapters de PSP em sandbox oficial.
  - Implementar reserva atômica, policy snapshot, sessão tokenizada, `PaymentAttempt`, webhook inbox, retrieve/reconcile, sala pós-settlement, pacote seguro e confirmações independentes.
  - Segredo/contato só é revelado após settlement válido e unidade compatível; PAN/CVV não passa pela Midas.
  - Evidência/teste: PSP sandbox end-to-end; dois checkouts disputam uma unidade; webhook duplicado/invertido converge; comprador/vendedor não confirmam pelo outro; falha do PSP não inventa sucesso.
  - _Requisitos: 8.1, 8.2, 8.3, 15.2, 18.1, 35.2, 35.7_
  - _Onda: 4_

- [ ] 16. Implementar ledger, hold, refund e payout canônicos
  - Arquivos-alvo: módulos Ledger/Payouts e Payments/Refunds, migrations, schedulers e adapters PSP sandbox.
  - Implementar chart of accounts, journals/postings, `BalanceLot`, `Hold`, `RefundRequest`, `RefundAttempt`, `PayoutRequest`, allocations/attempts/evidence e reconciliação.
  - Usar `Payment.settledAt + 168h`; release exige conclusão e demais gates; nenhuma mutation edita saldo.
  - Evidência/teste: journals fecham por moeda; relógio nas bordas UTC; refund parcial/total e payout real de sandbox reconciliam; corrida saque×refund/hold tem um efeito; restore/rebuild reproduz saldos.
  - _Requisitos: 9.1, 9.2, 9.3, 9.4, 23.2, 23.3, 35.2_
  - _Onda: 5_

- [ ] 17. Implementar late payment e `PaymentResolutionCase`
  - Arquivos-alvo: Payment quarantine/reconciliation, `PaymentResolutionCase`/evidence/decision, `SCR-ADM-012` e runbook.
  - Tratar expiração/cancelamento/webhook sob locks; reassumir a mesma unidade somente quando possível; caso contrário executar refund/compensação idempotente.
  - Decisão manual chama o settlement canônico com grant, step-up, maker-checker quando exigido, motivo e fonte; não expor update de `Payment.status`.
  - Evidência/teste: permutations reais de corrida; webhook ausente + consulta provider; alegação rejeitada/aprovada; um settlement/refund; nenhuma sala/entrega antes da resolução.
  - _Requisitos: 19.1, 19.2, 19.3, 27.1, 27.2, 27.3, 35.2_
  - _Onda: 5/8_

- [ ] 18. Implementar fila e baixa operacional de payout
  - Arquivos-alvo: `SCR-ADM-013`, Payout Operations application service, object storage privado de evidência e journal/outbox.
  - Implementar fila, claim, KYC/risco/destino, maker-checker, execução automática quando provider suportar e registro manual comprovável quando o modo contratado exigir.
  - Baixa exige saldo reservado, referência externa única, `PayoutAttempt`, `PayoutEvidence`, confirmação/reconciliação e journal.
  - Evidência/teste: payout de sandbox ou transferência homologada; duplo clique/retry não duplica; criador não aprova; prova ausente rejeita; falha/retorno compensa e aparece ao seller.
  - _Requisitos: 9.3, 22.3, 27.4, 35.1, 35.2_
  - _Onda: 5/8_

- [ ] 19. Implementar read models de Minha Conta, compras, vendas e Saldo de vendas
  - Arquivos-alvo: projectors/queries de Account Overview, Orders Read Side e Seller Read Side; `SCR-ACC-005`, `SCR-BUY-004..005`, `SCR-SEL-002/008..014`.
  - Projetar capabilities, cards, listas cursorizadas, timelines, related cases, métricas seller e buckets financeiros com `asOf`/freshness; preservar filtros e perspectiva buyer/seller.
  - Commands abertos por deep link relêem agregado, membership, grant e saldo canônicos.
  - Evidência/teste: rebuild/replay/checksum; cross-user/cross-tenant negatives; read model stale não autoriza saque/refund; valores conciliam ao ledger/PSP por moeda.
  - _Requisitos: 20.1, 20.2, 20.3, 21.1, 21.2, 21.3, 22.1, 22.2, 22.3, 35.4_
  - _Onda: 6_

- [ ] 20. Implementar ticketing, mailbox e suporte contextual
  - Arquivos-alvo: módulos Support/Mailbox, `SCR-BUY-008..009`, `SCR-ADM-009`, adapters de e-mail homologados e pipeline de anexos.
  - Implementar fila/SLA/thread, mensagens, notas/tags/macros quando contratadas, links relacionais, provider/thread dedupe, bounce, quarentena e visão de contexto por field policy.
  - Inbound valida assinatura/timestamp/token/remetente/replay antes de persistir.
  - Evidência/teste: ticket de compra chega com `orderId` sem PII copiada; e-mail round-trip real em sandbox; replay não duplica; anexo malicioso fica em quarentena; usuário/staff veem somente campos autorizados.
  - _Requisitos: 11.1, 11.2, 11.3, 17.1, 17.2, 17.3, 23.1, 35.6_
  - _Onda: 7_

- [ ] 21. Implementar disputa, recurso, reembolso operacional e visão 360°
  - Arquivos-alvo: módulos Disputes/Refund workflow/Admin BFF; `SCR-BUY-007/010..011`, `SCR-ADM-006..011`.
  - Implementar `Dispute`, evidências, janela, decisão/recurso, `RefundRequest` lifecycle, decisão/execução separadas e contexto 360° derivado por seção/campo/ação.
  - Ticket, `RefundRequest`, refund do PSP e `Dispute` mantêm IDs/estados próprios e vínculos.
  - Evidência/teste: fluxo comprador→ticket→refund→informação→decisão→execução; escalonamento sem disputa duplicada; suporte sem grant financeiro não decide; evidência mantém hash/cadeia de custódia.
  - _Requisitos: 14.1, 14.2, 14.3, 23.1, 23.2, 23.3, 23.4, 35.1, 35.6_
  - _Onda: 7_

- [ ] 22. Implementar notificações e analytics intake minimizado
  - Arquivos-alvo: módulo Notifications, analytics intake/schema registry, `SCR-ACC-014`, dispatch transacional e preferências.
  - Consumir somente eventos allowlisted, deduplicar, aplicar finalidade/prioridade/preferência e criar links ao objeto canônico; separar audit de analytics e P2P de Midas.
  - Instrumentar lag, rejeição, lacuna e replay sem payload sensível.
  - Evidência/teste: evento duplicado gera uma notificação; preferência desativa canal permitido; crítico permanece conforme policy; scanner prova ausência de chat/token/PII em evento/log.
  - _Requisitos: 13.1, 13.2, 13.3, 35.3, 35.6_
  - _Onda: 7_

- [ ] 23. Implementar `OrderReview` e `ReputationProjection`
  - Arquivos-alvo: módulo Reputation, migrations, projector/rebuild, `SCR-ACC-015`, `SCR-ADM-016`, superfícies públicas autorizadas.
  - Implementar review bilateral 0–5, janela/versionamento, resposta/denúncia/moderação/recurso, eligibility/antiabuse e projeções separadas por papel.
  - Publicar média/distribuição/amostra/fatores/`asOf`; nota zero não é ausência; review não altera permissão ou saldo.
  - Evidência/teste: participante/não participante/self-review/zero/duplicidade; refund/disputa/fraude compensam elegibilidade; rebuild reproduz projeção; perfil não vaza pedido/PII.
  - _Requisitos: 28.1, 28.2, 28.3, 35.4, 35.6_
  - _Onda: 8_

- [ ] 24. Implementar progressão, rewards, badges e `Leaderboard*`
  - Arquivos-alvo: módulo Progression & Rewards, migrations/policies/projectors, `SCR-ACC-016`, `SCR-PUB-014..015`, `SCR-MST-006`.
  - Implementar contribuições em centavos BRL, faixas L1–L10 versionadas, assignments, definitions/awards, seasons mensais, fórmula Premium explícita, desempate, freeze e fulfillment top 3.
  - Refund/chargeback/fraude criam contribuição compensatória; período encerrado não recebe update.
  - Evidência/teste: tabela completa de bordas L1–L10; FX/origem; replay/checksum; cálculo base e Premium; top 3 congelado; award idempotente e badge distinto de verificação.
  - _Requisitos: 29.1, 29.2, 29.3, 29.4, 35.2, 35.4_
  - _Onda: 8_

- [ ] 25. Implementar policies de planos comerciais
  - Arquivos-alvo: módulo Listings commercial policy, `ListingPlanPolicyVersion`, `ListingCommercialSnapshot`, `SCR-MST-007` e integração no wizard/checkout/queues.
  - Implementar Básico 7,5%, VIP 10%, Premium 12%, snapshots históricos, fee/journal, boost rotulado, prioridade operacional limitada, bônus e marco de dez vendas elegíveis.
  - Separar `queuePriority` de `decision`; mudança exige versão, simulação, aprovação, vigência e rollback para novos snapshots.
  - Evidência/teste: cálculos em unidade mínima e rounding; pedidos históricos imutáveis; prioridade não supera risco/hold/KYC/direito; dez vendas elegíveis concedem um `BadgeAward`.
  - _Requisitos: 30.1, 30.2, 30.3, 29.2, 35.2_
  - _Onda: 8_

- [ ] 26. Implementar carrinho multivendedor, lifecycle e customer insights
  - Arquivos-alvo: módulos Cart/Checkout Group e Customer Insights, policies lifecycle/return, `SCR-BUY-012`, `SCR-SEL-015`.
  - Persistir/mesclar/revalidar `Cart`; particionar `CheckoutGroup` por seller/moeda/provider/policy; criar um `Order` por grupo real; derivar abandono cancelável e oportunidades de recompra/renovação/cross-sell.
  - Manter `ProductLifecyclePolicy`, `ReturnPolicySnapshot` e `CatalogItemRelation` independentes; insight seller é minimizado e escopado.
  - Evidência/teste: cart guest→login; alteração/indisponibilidade explicada; múltiplos sellers geram orders separados; conversão/opt-out cancela abandono; cross-tenant e no-auto-add negatives.
  - _Requisitos: 31.1, 31.2, 31.3, 31.4, 35.1, 35.2_
  - _Onda: 9_

- [ ] 27. Implementar consentimento, campanhas, jornadas e `Dispatch`
  - Arquivos-alvo: módulos Consent/Engagement, cofre de contato, `Campaign*`, `Journey*`, `Dispatch`, adapters WhatsApp/Instagram/e-mail/inbox e `SCR-SEL-016`/`SCR-ADM-017`/`SCR-MST-008`.
  - Implementar consent append-only, suppression, frequency/quiet hours, versões publicadas, eligibility, timers persistentes, delivery attempts e webhooks autenticados.
  - Seller escolhe segmentos aprovados e vê agregados; worker resolve contato no cofre; Instagram não faz cold DM e canal indisponível não ganha fallback não consentido.
  - Evidência/teste: conta dev oficial e template/opt-in reais; corrida opt-out×fila/retry cancela antes da entrega; replay não duplica `Dispatch`; telefone/e-mail não aparece em export/log/analytics seller.
  - _Requisitos: 32.1, 32.2, 32.3, 13.1, 16.3, 35.3, 35.6, 35.7_
  - _Onda: 9_

- [ ] 28. Implementar cupons, afiliados e atribuição reconciliada
  - Arquivos-alvo: módulo Promotions/Attribution, migrations, links assinados, integração checkout/ledger e painéis de campanha.
  - Implementar `Coupon`/`CouponRedemption`, `AffiliateAccount`, `AttributionTouch`, `AttributionSnapshot` e `AffiliateCommission`; reservar/consumir/estornar sob concorrência.
  - Conversão nasce de `Payment`/`Order` reconciliados e comissão só após maturidade; refund/chargeback compensa.
  - Evidência/teste: cupom concorrente respeita limites; parâmetro manipulado/self-referral não concede benefício; pixel isolado não converte; order madura cria uma comissão e refund a compensa.
  - _Requisitos: 32.4, 35.2, 35.4_
  - _Onda: 9_

- [ ] 29. Implementar Midas Studio sobre Catalog/Listing/3D
  - Arquivos-alvo: Studio application/query services, `SCR-SEL-017`, `SCR-ADM-018`, integrações com Catalog, Listings, Moderation e 3D Assets.
  - Implementar biblioteca pesquisável por taxonomia/lifecycle/formato/visibilidade, prefill do mesmo `Listing`/`ListingRevision` em `DRAFT`, overlay comercial separado, preview persistido e `CatalogSubmission` tipada em quarentena.
  - Staff deduplica, classifica, solicita correção, vincula/mescla, aprova/rejeita e publica em decisão separada; relações curadas permanecem versionadas.
  - Evidência/teste: seleção da biblioteca cria o mesmo `Listing`; seller informa somente overlay; asset privado não enumera cross-tenant; submission não publica; 2D/3D usam artefatos aprovados e fallback.
  - _Requisitos: 33.1, 33.2, 33.3, 33.4, 2.2, 3.1, 25.4, 35.1_
  - _Onda: 10_

- [ ] 30. Implementar Growth multi-tenant e registro semântico
  - Arquivos-alvo: módulo Growth, metric registry, projectors/read models/reconciliation, `SCR-GRW-001..009`.
  - Implementar definitions versionadas, platform/tenant/funnel/cohort/timeline/contribution/quality, `sellerAccountId` em toda dimensão aplicável, freshness e RLS como defesa em profundidade quando adotada.
  - Oportunidade é recomendação derivada com motivo/deep link; qualquer comando ocorre no owner após nova autorização.
  - Evidência/teste: replay/dedupe/checksum; totais=drill-down dentro da tolerância; moedas não misturadas; ausência vira estado de qualidade; cross-tenant negative e export agregado.
  - _Requisitos: 24.1, 24.2, 24.3, 24.4, 35.1, 35.4_
  - _Onda: 11_

- [ ] 31. Implementar SSR público, SEO técnico e política de mercado
  - Arquivos-alvo: módulo Public Content/SEO, SSR web, `robots.txt`, sitemaps, canonical/hreflang/redirect, JSON-LD, `MarketPolicy`/`CrawlPolicy`, SEO health workbench.
  - Derivar HTML/metadata/schema de fatos publicados; excluir conta/checkout/admin/Master/Studio privado do sitemap; resolver locale/timezone/moeda/mercado separadamente.
  - Provider/licença/policy ausente retorna indisponível real; 3D permanece progressive enhancement.
  - Evidência/teste: snapshot HTML sem JavaScript; canonical/hreflang/schema por template/locale; robots/sitemap diff por ambiente; 301/404/410 sem loop; structured data igual ao conteúdo visível.
  - _Requisitos: 18.1, 34.1, 34.2, 34.3, 34.4, 35.5_
  - _Onda: 11_

- [ ] 32. Fechar as 95 telas por cortes verticais
  - Arquivos-alvo: rotas/componentes/testes definidos para `SCR-PUB-001..015`, `SCR-ACC-001..016`, `SCR-BUY-001..012`, `SCR-SEL-001..017`, `SCR-ADM-001..018`, `SCR-MST-001..008`, `SCR-GRW-001..009`.
  - Para cada tela, conectar o shell/template canônico, query/command tipado, OpenAPI, application service, PDP, repository/migration, outbox/audit e estados visuais; nenhuma tela pode ficar só com dado estático nem criar layout artesanal fora dos 41 templates.
  - Registrar status por evidência, não por existência do componente.
  - Evidência/teste: um `E2E-{SCR-ID}` por tela e `AUTHZ-{SCR-ID}` por ação sensível; gate automatizado prova 95/95 telas, 9/9 shells e 41/41 templates, zero tela fora de template e falha em rota/contrato/teste órfão.
  - _Requisitos: 1.1, 2.2, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.3, 10.1, 11.1, 12.1, 13.1, 14.1, 15.1, 16.1, 17.1, 18.1, 19.1, 20.1, 21.1, 22.1, 23.1, 24.1, 25.1, 26.1, 27.1, 28.1, 29.1, 30.1, 31.1, 32.1, 33.1, 34.1, 35.5, 35.7_
  - _Onda: contínua; gate final na 12_

- [ ] 33. Executar hardening de segurança, concorrência e isolamento
  - Arquivos-alvo: suites de segurança/concorrência, threat model atualizado, policies WAF/rate limit, corpus adversarial e relatório de findings.
  - Testar BOLA/BFLA, escalada, CSRF/session, webhook forgery/replay, upload/SSRF, segredo/PII, reservas, late payment, refund, payout, cupom, dispatch, projectors e quotas multi-tenant.
  - Corrigir findings altos/críticos antes de avançar; exceção exige owner, prazo, controle compensatório e aceite formal.
  - Evidência/teste: comandos e saídas das suites; scans/SAST/DAST/dependency review; testes concorrentes no PostgreSQL real; relatório sem finding aberto de severidade alta/crítica.
  - _Requisitos: 4.3, 7.2, 8.3, 9.4, 12.3, 14.3, 17.2, 19.3, 23.4, 27.4, 28.2, 29.4, 32.3, 33.3, 34.4, 35.1, 35.2, 35.6_
  - _Onda: 12_

- [ ] 34. Medir acessibilidade, performance, escala e reconciliação
  - Arquivos-alvo: suites a11y/performance/soak, dashboards OpenTelemetry, budgets medidos e relatórios de reconciliação.
  - Medir p50/p95/p99, throughput, saturação, Web Vitals, query plans, queue lag, projeção/replay, cache hit/miss, viewer memory e fairness entre tenants; definir SLOs a partir dos resultados.
  - Verificar WCAG 2.2 AA, teclado, leitor de tela, zoom 200%, reduced motion e fallback sem JS/WebGL quando aplicável.
  - Evidência/teste: relatórios reproduzíveis por ambiente/commit; load/soak sem vazamento progressivo; reconciliação provider↔`Payment`↔ledger e projection↔source com divergência tratada.
  - _Requisitos: 5.3, 6.2, 9.1, 21.1, 24.4, 25.2, 26.3, 32.2, 34.1, 35.3, 35.4, 35.5_
  - _Onda: 12_

- [ ] 35. Provar backup, restore, DR e runbooks operacionais
  - Arquivos-alvo: infraestrutura de backup/PITR, runbooks versionados, scripts de restore/replay e exercícios de incidente.
  - Cobrir perda de banco, broker, cache, object storage, provider PSP/canal/3D, outbox presa, projector divergente, payout retornado, refund falho e asset comprometido.
  - Executar restore em ambiente isolado e reconciliar checksums, journals, outbox/inbox, read models e referências de assets.
  - Evidência/teste: relatório do exercício com RPO/RTO medidos, comandos/saídas, gaps e owners; cache vazio não perde fato; replay não duplica efeito.
  - _Requisitos: 9.1, 13.1, 25.4, 27.4, 32.2, 35.2, 35.3, 35.7_
  - _Onda: 12_

- [ ] 36. Executar piloto limitado e gate final de entrega
  - Arquivos-alvo: relatório de piloto, matriz de rastreabilidade final, evidências G0–G8, release/rollback plan e handoff operacional.
  - Rodar jornadas P0 completas com contas e ativos autorizados: seller onboarding→listing→moderação→compra→settlement→entrega→hold→payout; ticket/refund/disputa; review/progressão; cart/pós-venda; Studio; Growth; SEO.
  - Exigir sign-off de Produto, Engenharia, Segurança, Operações, Financeiro, Jurídico, Privacidade, Catálogo, Marketing e Design; qualquer dependência não homologada permanece desligada por capability/kill switch.
  - Evidência/teste: matriz `RF-001–300`/`RNF-001–050` sem órfãos, cobertura 95/95 telas, 9/9 shells e 41/41 templates, 95 E2Es, reconciliação financeira fechada, rollback ensaiado e relatório que distingue EXECUTADO, INFERIDO, PROPOSTO e NÃO VERIFICADO.
  - _Requisitos: 1.1, 8.2, 9.2, 12.2, 18.2, 23.3, 24.3, 25.3, 27.3, 28.3, 29.3, 30.3, 31.3, 32.4, 33.2, 34.2, 35.7, 35.8_
  - _Onda: 12_

## Definition of Done deste SDD

Este SDD não muda para concluído pela existência dos três arquivos. O status só poderá mudar após as tarefas aplicáveis estarem marcadas por evidência real, a matriz automatizada fechar `RF-001–300`/`RNF-001–050`, os gates necessários terem sign-off e não restar função simulada apresentada como operacional. Até esse momento: **SDD_PRONTO_IMPLEMENTACAO_PENDENTE**.
