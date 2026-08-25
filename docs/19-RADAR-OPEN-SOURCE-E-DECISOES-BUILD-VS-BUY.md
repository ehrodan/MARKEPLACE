# MIDAS — Radar open source e decisões build vs. buy

Versão 1.0 · Pesquisa pré-código · Snapshot de 22 de agosto de 2026

> **Estado verificável:** nenhum projeto listado abaixo foi instalado ou incorporado ao Midas. O repositório continua sem runtime de produto. Versão, licença, segurança e compatibilidade precisam ser novamente verificadas no commit/tag escolhido para cada POC.

Este radar responde onde aprender, integrar, experimentar ou construir. “Open source” não significa automaticamente adequado, gratuito em produção, isolado por tenant ou compatível com a licença futura do Midas.

## 1. Regra de soberania

Os seguintes objetos permanecem canônicos no núcleo Midas, ainda que uma ferramenta externa ajude na interface ou automação:

```text
User + SellerAccount + SellerMembership
CatalogItem + CatalogAsset + Model3DJob + Model3DArtifact + Listing
Cart + Order + PaymentAttempt + Delivery
JournalEntry + Posting + BalanceLot + Hold + RefundRequest + PayoutRequest + PaymentResolutionCase
ConsentRecord + Suppression + Campaign + AttributionTouch
OrderReview + ReputationProjection + ProgressionContribution + BadgeAward + LeaderboardSeason
AuditEvent
```

Uma integração recebe eventos versionados e devolve referências/status. Ela não pode criar um segundo saldo, consentimento, pedido, catálogo, reputação ou tenant “mais fácil”.

## 2. Critérios de avaliação

Cada candidato recebe nota de 0 a 3 em uma POC formal:

| Critério | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| aderência funcional | não cobre | cobre periferia | cobre fluxo relevante | cobre quase todo o limite |
| isolamento de tenant | inexistente | só filtro cliente | suporte parcial | enforcement server-side testável |
| interoperabilidade | fechado | export limitado | API/webhook | contratos e replay robustos |
| operação | inviável | alta carga | operável com gaps | health, backup, escala e upgrade claros |
| segurança/privacidade | bloqueador | gaps sérios | mitigável | controles e retenção adequados |
| licença/TCO | incompatível | incerto | aceitável com condição | aprovado jurídico e custo previsível |
| reversibilidade | lock-in alto | migração difícil | export possível | adapter + export/replay comprovados |

Gates eliminatórios: licença incompatível, falta de export, incapacidade de apagar/suprimir dado pessoal, ausência de escopo de tenant, segredo no cliente, ou autoridade externa sobre o ledger.

## 3. Anéis do radar

- **ADOTAR COMO PADRÃO:** princípio/tecnologia madura e sem dependência de POC de produto.
- **EXPERIMENTAR:** candidato a POC isolada, com hipótese e saída definida.
- **AVALIAR:** referência útil; decisão depende da stack e licença.
- **EVITAR NO NÚCLEO:** duplica fonte canônica, aumenta risco ou conflita com a arquitetura.

### 3.1 Padrões para adotar

| Padrão | Decisão | Motivo |
|---|---|---|
| PostgreSQL transacional | ADOTAR | integridade, constraints, RLS quando aplicável e outbox local |
| outbox/inbox idempotente | ADOTAR | nenhum broker torna gravação e publicação atomicamente corretas sozinho |
| adapter por PSP/canal | ADOTAR | Stripe, Mercado Pago e Meta evoluem sem contaminar domínio |
| OpenTelemetry | ADOTAR | propagação e telemetria sem acoplar o domínio a um vendor |
| glTF 2.0/GLB | ADOTAR | formato de publicação versionado e interoperável |
| object storage S3-compatible | ADOTAR COMO CONTRATO | provider só depois de POC de licença, lifecycle, CDN e backup |
| Podman/OCI | ADOTAR | padrão operacional local do projeto; manifestos não assumem Docker Desktop |

## 4. Comércio headless

| Projeto | Evidência oficial | Encaixe | Risco/gap | Radar |
|---|---|---|---|---|
| [Saleor](https://github.com/saleor/saleor) | API-only GraphQL, multichannel, catálogo, checkout, promoções e pagamentos; BSD-3-Clause | excelente referência para canal, moeda, catálogo e promoção | não resolve sozinho P2P, hold, payout manual, reputação ou Studio; stack Python/GraphQL ainda não escolhida | AVALIAR como referência; POC só após decisão de stack |
| [Medusa](https://github.com/medusajs/medusa) | módulos de comércio em TypeScript; núcleo MIT e materiais Enterprise separados | bom encaixe modular para produto, preço, carrinho e promoção | RBAC/SSO Enterprise atuais exigem acordo comercial; marketplace financeiro continua customizado | EXPERIMENTAR apenas módulos MIT, com inventário de paths/licenças |
| [Vendure](https://github.com/vendurehq/vendure) | TypeScript/NestJS/GraphQL, plugin-first; GPLv3 ou licença comercial | coerente se a stack for NestJS e houver aceitação de licença | copyleft/licença comercial é decisão jurídica e estratégica, não detalhe técnico | AVALIAR; não incorporar antes de parecer de licença |

**Decisão provisória:** não substituir o núcleo Midas por uma plataforma de e-commerce neste momento. Usar os três para comparar contratos de catálogo, carrinho, promoção e canal. A particularidade do produto está justamente em P2P, reconciliação, hold, operação manual, reputação, Studio e multi-tenant.

## 5. Atendimento, CRM e jornadas

| Projeto | Evidência oficial | Encaixe | Limite obrigatório | Radar |
|---|---|---|---|---|
| [Chatwoot](https://github.com/chatwoot/chatwoot) | inbox omnichannel com web, e-mail, WhatsApp e Instagram; licença MIT informada pelo projeto | mesa de atendimento e conversa humana | `Ticket`, pedido, consentimento e auditoria continuam no Midas; PII mínima e tenant por adapter | EXPERIMENTAR primeiro |
| [Dittofeed](https://github.com/dittofeed/dittofeed) | journeys/broadcasts por e-mail, SMS, push, WhatsApp e outros; MIT | orquestração developer-centric e teste de jornada | não decide elegibilidade nem consentimento; recebe audiência já autorizada | EXPERIMENTAR contra Mautic, não junto |
| [Mautic](https://github.com/mautic/mautic) | automação, segmentação e campanhas; GPLv3 | operação de marketing ampla e self-hosted | maior footprint PHP; licença, upgrades e isolamento precisam de POC | AVALIAR como alternativa ao Dittofeed |

### Hipótese de POC omnichannel

```text
Midas decide audiência + finalidade + consentimento + frequência
  → DispatchRequested
  → adapter envia para um orquestrador
  → provider entrega/recusa
  → status assinado volta ao Midas
  → conversão é atribuída no domínio canônico
```

Chatwoot pode coexistir com **um** orquestrador de jornadas porque resolve atendimento humano; Dittofeed e Mautic competem pela mesma responsabilidade e não devem operar simultaneamente em produção sem uma justificativa.

## 6. Analytics, feature flags e experimentação

| Projeto | Evidência oficial | Encaixe | Risco/gap | Radar |
|---|---|---|---|---|
| [PostHog](https://github.com/PostHog/posthog) | analytics, funnels, replay, flags, experimentos e CDP; MIT fora de áreas `ee` | descoberta de comportamento e diagnóstico | edição/licença mista, PII em replay e operação pesada; nunca fonte de KPI financeiro | EXPERIMENTAR subset com mascaramento e catálogo de eventos |
| [GrowthBook](https://github.com/growthbook/growthbook) | flags, experimentação e analytics; bulk MIT com diretórios comerciais | experimentos com métricas e rollout controlado | precisa inventário de licença e garantia de exposição registrada | AVALIAR como alternativa de experimento, não segundo analytics completo |
| [Metabase](https://github.com/metabase/metabase) | BI e dashboards sobre fontes analíticas | exploração interna e gerencial | embedding, edição e licença precisam de auditoria; RLS lógico não substitui segurança do dado | AVALIAR para staff, não painel público |

Decisões:

- eventos financeiros partem da outbox do núcleo, não de autocapture;
- `page_view`, `product_viewed`, `cart_abandoned`, `message_delivered` e `experiment_exposed` têm schemas versionados;
- sessão gravada mascara chat, pagamento, identidade e qualquer entrada sensível;
- uma pessoa recebe ID analítico pseudônimo; telefone/e-mail não viram propriedade padrão;
- experimento nunca reduz disclosure, segurança, hold, direito de recusa ou suporte.

## 7. Links, cupons e afiliados

| Projeto | Evidência oficial | Encaixe | Risco/gap | Radar |
|---|---|---|---|---|
| [Dub](https://github.com/dubinc/dub) | links, conversão e programas de afiliado; projeto commercial open source | referência/POC de redirect, slug e atribuição | partes exigem licença comercial; antifraude, comissão e ledger continuam customizados | AVALIAR após auditoria de edição/licença |

O link público é apenas entrada. A atribuição válida requer `AttributionTouch`, janela, modelo, tenant, campanha, creator/affiliate, consentimento, deduplicação e vínculo com conversão reconciliada. Cupom continua `Coupon`/`CouponRedemption` no Midas. Comissão de afiliado é lançamento explícito e não “saldo” calculado no dashboard.

## 8. Conteúdo e biblioteca de mídia

| Projeto | Evidência oficial | Encaixe | Risco/gap | Radar |
|---|---|---|---|---|
| [Strapi](https://github.com/strapi/strapi) | CMS TypeScript com REST/GraphQL, media library, i18n e draft/publish | páginas editoriais e conteúdo de campanha | licença da edição escolhida, RBAC e tenancy precisam ser auditados; não substituir CatalogAsset | AVALIAR para conteúdo institucional |

Studio e catálogo não entram em CMS genérico. Um CMS pode referenciar IDs publicados e montar landing pages; hashes, licença, lineage, revisão 3D, compatibilidade e `CatalogAsset` permanecem no domínio.

## 9. 3D e pipeline de ativos

| Projeto/padrão | Evidência oficial | Uso proposto | Radar |
|---|---|---|---|
| [Three.js](https://github.com/mrdoob/three.js) | engine WebGL e loaders, licença MIT | viewer, câmera, materiais e descarte | ADOTAR após lock de versão |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | renderer React para Three.js, MIT | integração declarativa com a tela individual | ADOTAR se frontend React for confirmado |
| [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) | especificação Khronos | contrato do `Model3DArtifact` publicado | ADOTAR |
| [glTF-Transform](https://github.com/donmccurdy/glTF-Transform) | toolkit de otimização e inspeção | validação/otimização em worker | EXPERIMENTAR |
| [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) | validação oficial de conformidade | gate automático de artefato | EXPERIMENTAR |
| [Blender](https://www.blender.org/about/license/) | DCC e automação por Python, GPL | revisão/conversão offline no worker isolado | AVALIAR operação e implicações de distribuição |

Nenhuma biblioteca converte um PNG único em geometria “exata”. A pipeline aceita single-view como rascunho identificado; fidelidade publicável depende de múltiplas vistas, dimensões/referência, revisão e proveniência.

## 10. Cache, fila, busca e dados

### 10.1 PostgreSQL

Fonte de verdade para escrita transacional, constraints, ledger, consentimento, campanhas e outbox. Particionamento, réplicas e read models só entram depois de medidas de volume. JSON não substitui entidades com invariantes.

### 10.2 Redis ou Valkey

[Redis 8+](https://redis.io/legal/licenses/) oferece escolha RSALv2, SSPLv1 ou AGPLv3; a escolha tem consequências comerciais/copy-left. [Valkey](https://github.com/valkey-io/valkey) é alternativa comunitária para cache/realtime com ecossistema e licença a validar no tag.

Uso permitido:

- cache com TTL e chave prefixada por ambiente/tenant quando o dado for tenant-scoped;
- rate limit distribuído;
- sessão/revogação se o desenho de autenticação aprovar;
- debounce/deduplicação não financeira;
- fila efêmera somente com persistência e replay fora dela.

Uso proibido:

- ledger, saldo, hold, payout, consentimento ou estado final de pedido;
- lock como única proteção de uma transição financeira;
- keyspace sem limite, TTL ou observabilidade;
- evento irrecuperável sem outbox.

**Decisão provisória:** POC de Valkey primeiro para cache/rate limit. Se Redis for escolhido, fixar licença/opção e política de upgrade em ADR. O nome funcional do contrato é `KeyValueCache`, não `RedisService`.

### 10.3 Busca

Começar com PostgreSQL para filtros e full-text dentro do corte inicial. Avaliar [OpenSearch](https://github.com/opensearch-project/OpenSearch) somente quando relevância, facetas, idiomas ou volume ultrapassarem metas medidas. Um índice é reconstruível e nunca autoritativo.

### 10.4 Fila/workflow

Outbox + worker é o baseline. Avaliar um broker ou [Temporal](https://github.com/temporalio/temporal) quando retries duráveis, timers e compensações excederem o que o worker consegue demonstrar com simplicidade. Hold de sete dias é regra financeira persistida com `eligibleAt`; não um `setTimeout` nem TTL.

## 11. Pagamentos e comunicação oficial

Stripe, Mercado Pago, Pix e Meta são integrações de serviço, não dependências open source. Usar somente documentação oficial e contrato comercial:

- [Stripe Connect](https://docs.stripe.com/connect), [webhooks](https://docs.stripe.com/connect/webhooks) e [manual payouts](https://docs.stripe.com/connect/manual-payouts);
- [Mercado Pago — webhooks](https://www.mercadopago.com.br/developers/pt/docs/split-payments/additional-content/your-integrations/notifications/webhooks), [pré-requisitos de split](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/prerequisites) e [Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix);
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) e [Instagram Messaging](https://developers.facebook.com/docs/messenger-platform/instagram).

O prazo de sete dias é política Midas, sujeita a contrato do PSP, risco, disputa e legislação. “Manual payout” da Stripe mantém fundos no saldo conectado dentro de limites e não deve ser chamado de escrow. Mercado Pago split 1:N e release scheduling dependem de elegibilidade/contrato; não podem ser presumidos por código.

## 12. SEO e alcance global

| Recurso | Decisão |
|---|---|
| `robots.txt` | construir no app público; bloquear workbenches e parâmetros sem valor, não usar para proteger segredo |
| sitemap | gerar apenas URLs públicas canônicas e indexáveis, particionado e com `lastmod` real |
| Product/Offer | emitir JSON-LD somente quando página e dados visíveis correspondem |
| ratings | publicar aggregateRating apenas com avaliações elegíveis e política antiabuso |
| i18n | locale no URL/metadata, tradução humana de termos críticos e `hreflang` consistente |
| moeda | preço transacional por canal/moeda; conversão informativa rotulada com fonte/hora |
| SSR/streaming | escolher após stack, garantindo conteúdo essencial sem depender de WebGL |

Fontes primárias: [Google Search — merchant listing](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing), [Product](https://developers.google.com/search/docs/appearance/structured-data/product), [canonicalização](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) e [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## 13. Benchmark competitivo clean-room

Referências públicas do mesmo espaço só podem responder a perguntas de comportamento:

- como a categoria é encontrada;
- que prova aparece perto de preço e CTA;
- como filtros, disponibilidade, seller e entrega são apresentados;
- onde existe fricção, ambiguidade ou ausência de suporte;
- como a experiência se adapta ao mobile.

Não copiar layout, texto, dados, imagens, marca, endpoint ou scraping protegido. [Nesha Store](https://neshastore.com/) e [Marketplace oficial Standoff 2](https://help.standoff2.com/en/collections/3850927-marketplace) continuam benchmarks citados no inventário; não viram dependência. Uso comercial de item, marca ou transferência de terceiros continua condicionado a autorização.

## 14. Shortlist de POCs

### POC-01 — cache e rate limit

- **Candidato:** Valkey em container OCI via Podman.
- **Hipótese:** atende cache/rate-limit sem autoridade transacional.
- **Prova:** isolamento de prefixo, TTL, eviction, indisponibilidade, métricas e recuperação.
- **Saída:** adapter substituível; aplicação funciona em modo degradado quando permitido.

### POC-02 — mesa omnichannel

- **Candidato:** Chatwoot.
- **Hipótese:** centraliza atendimento humano sem duplicar ticket/pedido/consentimento.
- **Prova:** tenant, SSO/RBAC, webhook assinado, mídia, delete/export, volume e custo.
- **Saída:** referência externa e transcript minimizado no Midas.

### POC-03 — jornadas

- **Candidatos concorrentes:** Dittofeed e Mautic.
- **Hipótese:** um deles executa jornadas decididas pelo Midas.
- **Prova:** consentimento/opt-out, frequency cap, suppression imediata, idempotência, WhatsApp template e replay.
- **Saída:** escolher um ou construir executor mínimo.

### POC-04 — analytics e experimento

- **Candidatos:** PostHog; GrowthBook somente se flags/experimentos justificarem segundo sistema.
- **Hipótese:** responde funil e retenção sem expor PII nem alterar KPI financeiro.
- **Prova:** schema registry, mask, delete, exposição, retenção, custo e reconstrução.

### POC-05 — pipeline GLB

- **Candidatos:** glTF Validator + glTF-Transform + Three.js/R3F.
- **Hipótese:** valida, otimiza e exibe artefato dentro dos budgets definidos.
- **Prova:** fixtures válidas/inválidas, poster, reduced motion, descarte e mobile.

## 15. Checklist obrigatório de uma POC

```text
[ ] hipótese e não-objetivos
[ ] tag/commit e SBOM
[ ] licença de cada pacote/imagem/container
[ ] CVEs e política de atualização
[ ] manifesto Podman/OCI reproduzível
[ ] healthcheck, logs, métricas e traces
[ ] backup, restore e export/delete
[ ] tenant isolation e least privilege
[ ] secrets fora da imagem e do git
[ ] falha, retry, idempotência e replay
[ ] carga e orçamento de infraestrutura
[ ] adapter de saída e plano de remoção
[ ] decisão registrada em ADR
```

Não vale “subiu a tela”. A POC termina com comando, saída, riscos e decisão `ADOTAR`, `ADIAR` ou `REJEITAR`.

## 16. Ordem de decisão

1. fixar linguagem/runtime e contrato do monólito modular;
2. implementar fonte canônica de identidade/tenant/catálogo;
3. provar pagamento sandbox, webhook, ledger e reconciliação sem pacote de CRM;
4. instrumentar eventos versionados e consentimento;
5. executar POCs de Valkey e Chatwoot;
6. comparar Dittofeed × Mautic com a mesma fixture de jornada;
7. adicionar analytics/experimento depois que o catálogo de eventos estiver estável;
8. avaliar CMS, BI e commerce headless apenas onde eliminarem custo comprovado.

## 17. Decisão executiva

Construir o **núcleo diferenciado e financeiro**; integrar os **provedores regulamentados**; experimentar ferramentas abertas nas **bordas reversíveis**. Neste estágio:

- PostgreSQL, outbox/inbox, adapters, OpenTelemetry, glTF e OCI são padrões;
- Valkey, Chatwoot, Dittofeed/Mautic, PostHog/GrowthBook e toolchain GLB são POCs;
- Saleor, Medusa, Vendure, Strapi, Metabase e Dub são referências/opções condicionais;
- nenhuma solução está aprovada para produção até passar licença, tenant, segurança, operação, custo e saída.

Essa separação preserva o que torna o Midas próprio e evita transformar um conjunto de ferramentas em uma arquitetura acidental.
