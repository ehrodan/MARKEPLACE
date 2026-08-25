# SEO técnico, conteúdo, busca por IA e atribuição — Midas Marketplace

Versão 1.0 · Documento pré-código · 22 de agosto de 2026 · **PROPOSTA PARA ACEITE**

> **Estado real:** não existe aplicação, domínio público, `robots.txt`, sitemap, JSON-LD, collector ou Search Console configurado neste repositório. Este documento fecha contratos e gates para a implementação futura; não declara indexação, ranking, métricas ou integrações como existentes.

## 1. Objetivo

Construir uma presença global rastreável para o marketplace, com arquitetura de URL estável, HTML público compreensível sem executar a experiência 3D, conteúdo útil e atribuição reconciliável até pagamento liquidado.

O trabalho divide-se em cinco camadas:

1. **Descoberta técnica:** crawl, render, index, canonical, sitemap, status HTTP e performance.
2. **Semântica:** taxonomia, entidades, structured data e relações entre catálogo, item e oferta.
3. **Conteúdo:** páginas editoriais e programáticas com valor próprio, autoria e atualização real.
4. **Busca por IA:** permitir descoberta/citação separadamente de eventual uso para treinamento.
5. **Mensuração:** eventos versionados, link/cupom/afiliado e modelo de atribuição explícito.

Não se promete posição, rich result, citação por IA, tráfego ou conversão. Motores de busca decidem crawl, indexação e apresentação.

## 2. Nomenclatura e hierarquia

### 2.1 Objetos

| Nome | Definição | Fonte |
|---|---|---|
| `CatalogItem` | conceito canônico do produto, como skin, assinatura, crédito ou serviço | Catalog |
| `CatalogVariant` | variação real do item, somente quando existir dimensão canônica | Catalog |
| `Listing` | oferta individual de um `SellerAccount` | Listings |
| `OfferProjection` | preço/disponibilidade pública derivados da listing | Search/SEO projection |
| `AggregateOfferProjection` | resumo de várias ofertas reais para um mesmo item | Search/SEO projection |
| `PublicSellerProfile` | reputação e ofertas públicas permitidas do seller | Sellers/Trust projection |
| `EditorialPage` | guia, explicação ou comparação com autoria e revisão | Content |
| `ProgrammaticPage` | página gerada por template e dados canônicos que passa por quality gate | Content/SEO |
| `CanonicalUrlDecision` | URL escolhida, motivo e versão da política | SEO policy |
| `CrawlPolicy` | decisão versionada por superfície e crawler | SEO policy |
| `AttributionTouch` | toque observado em canal/campanha | Analytics |
| `AttributionSnapshot` | contribuições e modelo congelados para uma compra | Attribution projection |

### 2.2 Hierarquia de informação

```text
Midas
├── Mercado
│   ├── jogo/plataforma
│   │   ├── categoria
│   │   │   ├── coleção/raridade quando houver valor próprio
│   │   │   └── item canônico
│   │   │       ├── ofertas agregadas
│   │   │       ├── inspeção 2D/3D
│   │   │       └── conteúdo de decisão
│   └── perfil público do vendedor
├── Conteúdo
│   ├── guias de compra e entrega
│   ├── segurança e confiança
│   ├── glossário do catálogo
│   ├── preços e metodologia
│   └── comparações editoriais
└── Aplicação privada
    ├── conta/compras/vendas
    ├── carrinho/checkout
    ├── seller studio
    └── admin/master
```

## 3. Arquitetura internacional de URL

### 3.1 Convenção proposta

Usar locale explícito, slugs legíveis e IDs internos fora da URL pública quando não agregarem identidade:

```text
/{locale}/
/{locale}/mercado
/{locale}/mercado/{gameSlug}
/{locale}/mercado/{gameSlug}/{categorySlug}
/{locale}/itens/{itemSlug}
/{locale}/itens/{itemSlug}/3d
/{locale}/vendedores/{sellerPublicSlug}
/{locale}/guias/{articleSlug}
/{locale}/colecoes/{collectionSlug}
```

Decisões:

- locale inicial proposto: `pt-br`; outros só existem após tradução real;
- URL é minúscula, UTF-8 normalizada e usa hífen; mudança de slug preserva redirect permanente;
- preço, moeda, ordenação, cursor, sessão, UTM, affiliate/coupon e feature flag não mudam a canonical;
- filtros combinatórios permanecem query string até uma página programática passar no gate editorial;
- um item canônico agrega ofertas; a oferta individual só recebe URL indexável se tiver informação única e estável suficiente;
- rota 3D é uma experiência do mesmo item. Por padrão aponta canonical para a página do item e fica fora do sitemap; só ganha canonical própria se houver conteúdo HTML independente e aprovado;
- redirecionamento geográfico nunca aprisiona o usuário; locale/moeda podem ser trocados explicitamente.

### 3.2 `hreflang`

Quando duas versões realmente traduzidas existirem:

- cada versão referencia a si e todas as alternates;
- os conjuntos são recíprocos e usam URLs absolutas;
- canonical aponta para a página do mesmo idioma, não para `pt-br` por padrão;
- `x-default` aponta para seletor/fallback global quando existir;
- idioma usa ISO 639-1 e região opcional ISO 3166-1 Alpha 2, como `pt-BR`, `en-US`;
- HTML, HTTP header ou sitemap são opções equivalentes; escolher um método principal para reduzir divergência;
- tradução parcial de shell não cria versão indexável se o conteúdo principal continuar sem tradução.

## 4. Matriz de crawl e indexação

| Superfície | Resposta | Indexação proposta | Canonical | Sitemap | Observação |
|---|---|---|---|---|---|
| home pública | `200` | `index,follow` | self | sim | HTML útil no primeiro response |
| categoria validada | `200` | `index,follow` | self | sim | descrição e oferta reais |
| item canônico | `200` | `index,follow` | self | sim | produto, preço/disponibilidade e conteúdo visíveis |
| inspeção 3D | `200` | indexável somente se conteúdo próprio | item por padrão | não por padrão | poster/HTML funcionam sem WebGL |
| perfil público seller | `200` | condicional a reputação/conteúdo/atividade | self | após quality gate | sem PII e sem conteúdo privado |
| listing individual | `200` | `noindex` por padrão | item | não | evita páginas voláteis/duplicadas; política pode promover exceção |
| filtros, sort e cursor | `200` | `noindex` ou canonical para categoria limpa | categoria | não | não usar robots como canonicalização |
| busca interna | `200` | `noindex` | nenhuma/self conforme implementação | não | resultados arbitrários não viram landing |
| campanha temporária | `200` | `noindex` por padrão | self | não | indexar só se virar landing durável e útil |
| guia/editorial | `200` | `index,follow` | self | sim | autor, fontes e datas verdadeiras |
| carrinho/checkout | `200/401` | `noindex` | nenhuma | não | autenticação/estado, nunca conteúdo SEO |
| conta/seller/admin | `401/403` | `noindex` | nenhuma | não | auth é controle; robots não é segurança |
| preview/draft | `404/401` | não indexar | nenhuma | não | token curto e `X-Robots-Tag` |
| item removido sem equivalente | `410` | remover | nenhuma | não | não redirecionar tudo para home |
| slug antigo com equivalente | `301/308` | destino | destino | somente destino | preservar cadeia única de redirect |

`robots.txt` controla requisição de crawler; não garante remoção do índice. Páginas privadas usam autenticação e, quando acessíveis, `noindex`/`X-Robots-Tag`. Uma URL bloqueada por robots ainda pode ser conhecida por links externos.

## 5. `robots.txt` como decisão versionada

### 5.1 Processo de governança

O arquivo final deve ser gerado de uma fonte versionada, revisada e testada no deploy. Cada mudança registra:

- owner e aprovador;
- data, razão e ticket/decisão;
- superfície e crawler afetados;
- impacto em Search, busca por IA, user fetch ou treinamento;
- teste do parser, fetch público e WAF/CDN;
- checksum da versão publicada;
- plano de rollback e data de revisão.

Não se publica `Allow: /` para crawler de treinamento por conveniência. A decisão de licenciar conteúdo para treinamento pertence ao Master/negócio e é independente de SEO tradicional.

### 5.2 Política conservadora proposta

| Classe | Tokens conhecidos | Decisão inicial | Efeito conhecido |
|---|---|---|---|
| busca tradicional | `Googlebot`, `Bingbot` | permitir somente superfícies públicas | descoberta/indexação nos respectivos mecanismos |
| busca por IA | `OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot` | permitir superfícies públicas | elegibilidade para descoberta/citação; não garante presença |
| fetch pedido pelo usuário | `ChatGPT-User`, `Perplexity-User`, `Claude-User` | permitir conteúdo público; autenticação continua fechando o privado | resposta a navegação solicitada; regras variam por fornecedor |
| treinamento/model development | `GPTBot`, `ClaudeBot`, `Google-Extended` | **bloquear por padrão até aceite explícito** | separa, onde o fornecedor oferece, busca de possível uso em treino/grounding |
| crawler desconhecido | `*` | aplicar política pública mínima + WAF/rate limit | nome de user-agent não é identidade confiável |

Pontos confirmados nas fontes oficiais atuais:

- OpenAI usa `OAI-SearchBot` para descoberta no ChatGPT Search e orienta bloquear `GPTBot` nas páginas que o publisher quer excluir de eventual treinamento;
- Anthropic separa `ClaudeBot`, `Claude-SearchBot` e `Claude-User` por finalidade;
- Perplexity declara `PerplexityBot` como crawler de busca, não de foundation-model training, e informa que `Perplexity-User` é fetch acionado pelo usuário;
- `Google-Extended` controla uso em treinamento de futuros Gemini e grounding descrito pelo Google, mas não afeta inclusão/ranking no Google Search;
- tokens, IPs e políticas mudam. A matriz deve ser revisada em ciclo definido e antes de alteração de WAF.

O WAF valida user-agent **e** faixas/IPs ou mecanismo oficial quando disponível; um header pode ser falsificado. Não se allowlista crawler para caminhos privados.

### 5.3 Gates de publicação

- [ ] `robots.txt` responde `200 text/plain` na raiz e pode ser lido sem cookie.
- [ ] parser oficial/open source do Google aceita a versão.
- [ ] sitemap absoluto aparece na diretiva apropriada.
- [ ] crawler de busca permitido recebe o mesmo conteúdo público do usuário, sem cloaking.
- [ ] crawler de treinamento bloqueado recebe a política pretendida.
- [ ] CDN/WAF não contradiz a decisão nem desafia bots oficiais permitidos.
- [ ] rotas privadas continuam inacessíveis mesmo quando o user-agent é forjado.

## 6. Sitemaps

### 6.1 Estrutura

```text
/sitemap.xml                         índice
├── /sitemaps/pages.xml             home e institucionais
├── /sitemaps/catalog-{n}.xml       jogos, categorias e coleções
├── /sitemaps/items-{n}.xml         itens canônicos
├── /sitemaps/sellers-{n}.xml       perfis que passaram no gate
├── /sitemaps/content-{n}.xml       guias/editorial
└── /sitemaps/images-{n}.xml        somente imagens públicas relevantes
```

Regras:

- somente URL absoluta, canonical, indexável e com resposta `200`;
- não incluir query, cursor, busca interna, listing `noindex`, 3D canonicalizado ao item, conta, checkout, preview ou admin;
- respeitar limite oficial de 50 MB descompactado ou 50.000 URLs por sitemap e dividir antes disso;
- `lastmod` muda apenas quando conteúdo, preço, disponibilidade, review, política ou dado visível muda de verdade;
- remoção do sitemap acompanha `301`, `404` ou `410`; não deixa URL órfã anunciada;
- publicar índice no `robots.txt` e submeter no Search Console; submissão é pista, não garantia de crawl;
- gerar por read model de SEO, não por varredura indiscriminada do banco;
- métricas separam URLs submitted, fetched, indexed, excluded e errors por tipo de sitemap.

## 7. Canonicalização e facetas

### 7.1 Regras

1. Toda página indexável possui canonical absoluta e autorreferente.
2. Redirect, canonical, sitemap e links internos concordam sobre a mesma URL.
3. `robots.txt`, remoção temporária e `noindex` não substituem canonical.
4. Página em outro idioma canonicaliza para a mesma língua e usa `hreflang` para alternates.
5. UTM, affiliate, coupon, sort, view mode e sessão não entram na canonical.
6. Preço/moeda visualizados sem conteúdo regional diferente não criam páginas duplicadas.
7. Se uma faceta tiver demanda, inventário e conteúdo próprio, ela ganha slug estável e revisão; caso contrário permanece filtro não indexável.

### 7.2 Facetas e paginação

| Caso | Decisão |
|---|---|
| raridade/coleção oficial com oferta e texto próprios | candidata a landing indexável |
| faixa de preço, sort, estado transitório | não indexar; canonical para categoria limpa quando semanticamente equivalente |
| combinações arbitrárias de muitos filtros | não indexar; limitar crawl e links gerados |
| página paginada necessária ao usuário | links `<a>` crawlable; política de canonical baseada no conteúdo, sem canonicalizar páginas distintas cegamente para a primeira |
| resultado zero | `noindex`; oferecer caminhos úteis ao humano |

Decidir bloqueio de parâmetros em robots somente depois de garantir que canonical/noindex possam ser lidos e de medir o crawl. Bloquear cedo demais pode impedir o crawler de enxergar a própria sinalização.

## 8. Renderização e performance

### 8.1 Contrato de HTML público

O primeiro HTML contém:

- title, description, H1 e breadcrumbs coerentes;
- nome e descrição do item;
- preço/moeda e disponibilidade observáveis quando públicos;
- seller/reputação pública permitida;
- imagem/poster com dimensões e texto alternativo;
- links reais para categoria, item e oferta;
- JSON-LD consistente com o conteúdo visível.

Client-side JavaScript melhora a experiência; não é requisito para compreender a entidade. Google executa JavaScript, mas há fila de renderização e limitações, portanto preço/disponibilidade de alta mutação devem sair no HTML/stream do servidor e serem revalidados na ação de compra.

### 8.2 2D e 3D

- carregar poster otimizado antes do canvas;
- viewer 3D é lazy e não bloqueia H1, preço, confiança ou CTA;
- uma tela mantém um canvas/modelo ativo e descarta recursos ao trocar item;
- `prefers-reduced-motion`, teclado e fallback 2D são funcionais;
- GLB/texturas ficam em CDN com cache imutável por hash;
- imagens possuem formatos/tamanhos responsivos e dimensão reservada para evitar layout shift;
- crawler e dispositivo sem WebGL recebem o mesmo conteúdo comercial, não uma página vazia.

### 8.3 Orçamento de experiência

Usar os limites atuais recomendados pelo Google no percentil 75, separados por mobile e desktop:

| Métrica | Gate “bom” |
|---|---|
| LCP | até 2,5 s |
| INP | até 200 ms |
| CLS | até 0,1 |

O gate de release usa laboratório para regressão e RUM para decisão. Lighthouse não mede INP real; TBT é proxy de laboratório. Nenhuma animação, SDK de marketing ou viewer 3D fica isento do orçamento.

## 9. Structured data

### 9.1 Mapeamento semântico

| Página | Tipos candidatos | Regras |
|---|---|---|
| organização/home | `Organization`, `WebSite` | identidade oficial, logo e URLs verdadeiras |
| categoria/coleção | `CollectionPage`, `ItemList`, `BreadcrumbList` | somente itens visíveis e ordem real |
| item com uma oferta | `Product` + `Offer` | preço, moeda, condition e availability visíveis/reais |
| item com vários sellers | `Product` + `AggregateOffer` | `lowPrice`, `highPrice` e `offerCount` derivados de ofertas elegíveis |
| review de produto | `Review`, `AggregateRating` aninhados em `Product` | apenas avaliações reais do produto, visíveis na página |
| guia/editorial | `Article`/`BlogPosting`, `BreadcrumbList` | autor, publicação e modificação verdadeiros |

### 9.2 Item, oferta, seller e avaliação

- `CatalogItem` mapeia para `Product`; `Listing` mapeia para `Offer`.
- `AggregateOffer` resume vendedores do mesmo produto e não representa variantes diferentes.
- `sku`, `gtin` ou `mpn` entram somente quando existe identificador legítimo; nunca fabricar GTIN para skin/item digital.
- disponibilidade e preço vêm do read model público e batem com o HTML.
- avaliação bilateral comprador↔vendedor alimenta reputação interna de `User`/`SellerAccount`; ela **não** vira automaticamente `aggregateRating` do `Product`.
- avaliação do produto só entra no markup se realmente avaliar aquele produto e estiver publicada/moderada.
- ranking, level, badge e pontos de vendedor não são review de produto.
- markup não exibe informação escondida, não agrega avaliação de outro item e não cria autor fictício.

### 9.3 Categoria de conteúdo e rich results

A documentação de Product do Google restringe rich results para conteúdo que promova bens regulados/proibidos, incluindo armas. O catálogo Midas trata skins como bens digitais/cosméticos, mas a representação visual pode ser interpretada de outra forma pelo mecanismo. Portanto:

- indexação da página e elegibilidade a Product rich result são decisões separadas;
- JSON-LD de Product é feature flag por `channelPolicyClass`/categoria;
- cada família passa pelo Rich Results Test, políticas vigentes e revisão de conteúdo;
- descrição deixa inequívoco quando o objeto é item digital de jogo, sem alegar venda de arma física;
- não há garantia de rich result mesmo com markup válido.

### 9.4 Validação

- Google Rich Results Test para elegibilidade suportada;
- Schema.org Validator para vocabulário;
- snapshot do JSON-LD e comparação com HTML/preço/disponibilidade;
- teste de ofertas vazias, sold out, múltiplas moedas, review removida e mudança de seller;
- alerta quando oferta agregada diverge das listings elegíveis.

## 10. Conteúdo e hook ético

### 10.1 Arquitetura da página de item

```text
H1 e identificação inequívoca
 -> imagem/poster e inspeção 3D opcional
 -> preço, disponibilidade e condição
 -> por que este item pode servir ao comprador
 -> prova verificável: atributos, histórico/metodologia, reputação
 -> entrega, hold/reembolso e limites explicados
 -> ofertas comparáveis
 -> produtos complementares com justificativa
 -> FAQ factual
 -> CTA com custo e consequência claros
```

### 10.2 Fórmula de hook

```text
necessidade real -> promessa específica -> prova -> adequação/limite -> ação reversível
```

Exemplos de princípios, não copies finais:

- falar do resultado que o item entrega dentro do jogo/produto, não de status social inventado;
- mostrar raridade, disponibilidade, preço e desconto somente quando derivados de fonte real;
- separar “popular”, “em alta”, “última unidade” e “preço caiu” em métricas com critério publicado;
- não usar countdown reiniciável, urgência falsa, confirmação envergonhada, botão oculto ou add-on pré-marcado;
- explicar diferença entre item, oferta, plano de anúncio, seller e política de entrega;
- manter headline e snippet descritivos, sem exagero que a página não sustenta.

Google recomenda conteúdo útil, confiável e feito primeiro para pessoas. Conteúdo gerado ou assistido por IA passa pelos mesmos gates de originalidade, fonte, autoria/revisão e precisão; não se publica em massa para ocupar consultas.

## 11. Páginas programáticas

### 11.1 Famílias candidatas

| Família | Exemplo conceitual | Valor próprio exigido |
|---|---|---|
| item | item/skin canônico | atributos, mídia, ofertas, método de preço e relações |
| categoria | facas, skins, assinaturas, créditos | taxonomia, filtros e inventário real |
| coleção/raridade | coleção oficial | definição, itens e dados distintos |
| guia de preço | preço de item/categoria | metodologia, período, moeda, amostra e freshness |
| comparação | itens ou planos comparáveis | critérios consistentes, prós/limites e atualização |
| vendedor | seller público | reputação, níveis/badges válidos e ofertas ativas |
| compatibilidade/uso | produto para necessidade específica | regra de compatibilidade e orientação útil |

### 11.2 Quality gate

Uma página programática só recebe `index` quando:

- consulta/intenção está definida por evidência de pesquisa ou navegação real;
- existe entidade canônica, URL estável e conteúdo único suficiente;
- inventário/preço ou informação útil atual estão disponíveis;
- title/H1/texto não são apenas troca de palavra em template;
- fontes, metodologia, owner e `lastReviewedAt` existem;
- canonical, links internos, structured data e sitemap concordam;
- página sem oferta ainda entrega valor informacional; caso contrário fica `noindex`/não é criada;
- revisão amostral e monitoramento detectam thin, duplicate, soft 404 e conteúdo obsoleto.

Não criar todas as combinações de jogo × item × raridade × preço × seller × moeda. A taxonomia comercial deve preceder a geração.

## 12. Conteúdo para busca tradicional e por IA

### 12.1 Conteúdo extraível e confiável

- começar seções importantes com resposta direta;
- usar H1/H2/H3 descritivos, tabelas para comparação e passos para processos;
- explicar termos do domínio e vincular ao objeto canônico;
- citar fonte primária e data em preço, política, integração ou afirmação mutável;
- atribuir autor/reviewer com competência demonstrável;
- mostrar “atualizado em” somente quando houve alteração substancial;
- publicar metodologia para ranking, preço de referência e agregados;
- manter FAQ como conteúdo visível, não como markup oculto;
- evitar texto genérico reescrito de concorrente e estatística sem fonte.

O Google informa que as práticas normais de SEO continuam válidas para AI Overviews/AI Mode. Não há markup especial que garanta entrada. OpenAI informa que `OAI-SearchBot` precisa de acesso para elegibilidade no ChatGPT Search. O desenho combina crawl permitido, conteúdo verificável e entidade clara; não tenta “enganar LLM”.

### 12.2 `llms.txt`

`llms.txt` pode ser estudado como índice auxiliar experimental, mas não é tratado neste projeto como padrão universal, diretiva de opt-out, substituto de robots, sitemap ou API. Só será adotado se testes de logs e documentação dos consumidores relevantes mostrarem uso real. Seu conteúdo nunca expõe rota privada, segredo ou feed diferente daquele disponível ao público.

### 12.3 Clusters de conteúdo

| Cluster | Perguntas atendidas | Ligação comercial legítima |
|---|---|---|
| como comprar | checkout, pagamento, entrega e confirmação | item/categoria correspondente |
| confiança | reputação, avaliação, disputa, reembolso e segurança | seller/item sem prometer risco zero |
| catálogo | definição de item, coleção, raridade e compatibilidade | páginas canônicas |
| preço | valor observado, período, moeda e metodologia | ofertas atuais, sem previsão inventada |
| 2D/3D | como inspecionar, limites do modelo e fidelidade | viewer do item |
| seller | como anunciar, planos, fees, nível e ranking | onboarding/painel privado |
| renovação/uso | duração, vencimento e recompra por classe | pós-venda consentido |

## 13. Social, campanhas e distribuição

- landing de campanha usa URL estável sem PII; UTM/click token são parâmetros de atribuição e canonicalizam para a URL limpa;
- Open Graph/Twitter cards usam imagem aprovada, título factual e descrição específica;
- Instagram/WhatsApp/e-mail apontam para deep link HTTPS que relê preço, disponibilidade, consentimento e login;
- cupom pode ser pré-informado pelo link, mas é validado no servidor e nunca aplicado como preço oculto;
- link de afiliado resolve somente destinos internos allowlisted;
- conteúdo distribuído em várias redes mantém uma entidade/URL canônica; copiar texto não cria páginas duplicadas no site;
- campaign landing temporária fica `noindex` até provar valor durável; após a campanha, redireciona apenas quando houver destino semanticamente equivalente.

## 14. Plano de tracking

### 14.1 Princípios

- evento existe para responder a uma decisão;
- eventos de interação usam `snake_case`; fatos de domínio preservam nomes canônicos como `payment.settled`;
- contexto vira propriedade, não explosão de nomes;
- schema é versionado e validado antes da ingestão;
- PII, telefone, e-mail, username social, termo de busca bruto, mensagem, segredo e destino financeiro não entram em analytics;
- valor usa minor units ou decimal canônico definido no contrato e sempre inclui moeda;
- evento do cliente não prova pagamento, entrega, refund ou comissão;
- dedupe por `eventId` e joins por chaves opacas/correlation ID.

### 14.2 Envelope mínimo

| Campo | Regra |
|---|---|
| `eventId` | UUID/ID global único |
| `eventName` | catálogo publicado |
| `schemaVersion` | versão do payload |
| `occurredAt` / `receivedAt` | tempo da ação e ingestão separados |
| `anonymousSubjectKey` | pseudônimo rotacionável antes do login |
| `analyticsSubjectKey` | pseudônimo pós-login, não `User.id` exposto |
| `journeyId` | correlação de jornada, não sessão de autenticação |
| `sellerAccountId` | somente quando o evento pertence a tenant; não label irrestrita em métricas |
| `catalogItemId` / `listingId` | referência canônica quando aplicável |
| `pageType` / `locale` | valores allowlisted |
| `source` / `medium` / `campaign` / `content` | normalizados e allowlisted |
| `clickId` / `couponId` / `affiliateId` | opacos, quando validados |
| `consentStateVersion` | somente quando necessário à execução, sem conteúdo do consentimento |

### 14.3 Catálogo de eventos proposto

| Evento de interação | Trigger | Decisão |
|---|---|---|
| `session_started` | primeira atividade elegível da sessão analítica | alcance observável |
| `page_viewed` | rota pública renderizada | desempenho por tipo de página |
| `listing_impression` | card realmente visível | distribuição/ranking |
| `listing_detail_viewed` | detalhe carregado | intenção de descoberta |
| `product_3d_opened` | usuário abre inspeção 3D | valor do viewer |
| `product_3d_interacted` | primeira rotação/zoom explícito | interação real, sem contar intro |
| `search_submitted` | busca submetida | demanda; termo bruto não vai para analytics |
| `filter_applied` | filtro confirmado | arquitetura de categoria |
| `cart_item_added` | API confirma adição | funil de compra |
| `cart_saved` | usuário confirma salvar | recuperação elegível |
| `cart_reminder_opted_in` | consentimento canônico confirmado | canal de recuperação |
| `checkout_started` | checkout canônico iniciado | intenção qualificada |
| `coupon_applied` | Pricing valida código | uso promocional real |
| `affiliate_link_opened` | redirector valida token | toque afiliado observado |
| `campaign_link_clicked` | redirector valida click ID | resposta à campanha |
| `review_submitted` | Ratings aceita avaliação | confiança pós-venda |
| `communication_opted_out` | Consent registra revogação | pressão/qualidade |

Resultados como `payment.settled`, `order.completed`, `refund.completed`, `funds.available` e payout vêm dos domínios por outbox. SDK do browser nunca emite esses fatos.

### 14.4 Qualidade

| Métrica | Fórmula |
|---|---|
| valid event rate | schemas aceitos / recebidos |
| duplicate event rate | IDs descartados por duplicata / recebidos |
| late event rate | eventos além do SLA / aceitos |
| unjoined outcome rate | outcomes elegíveis sem journey/click esperado / outcomes elegíveis |
| attribution coverage | compras elegíveis com snapshot válido / compras elegíveis |
| source divergence | diferença entre projeção e fonte canônica reconciliada |

Tolerâncias e SLAs são configurados após benchmark; não são inventados neste documento.

## 15. Atribuição

### 15.1 Separação

```text
UTM/referrer/click -> AttributionTouch -> modelo analítico -> AttributionContribution
coupon validado -----------------------------------------> vínculo promocional
affiliate click + política ------------------------------> elegibilidade de comissão
payment.settled/refund ----------------------------------> resultado canônico
```

Origem de marketing, cupom e afiliado são dimensões diferentes. Uma compra pode ter contribuições analíticas, um desconto e um possível accrual de afiliado sem que um objeto se faça passar pelo outro.

### 15.2 Modelo inicial alinhado ao Growth

Para aquisição comum, permanece a proposta documentada no painel Growth: **último toque não direto anterior ao checkout, janela de sete dias**, somente quando a correlação é real. Essa escolha é uma proposta versionada, não uma verdade universal.

O snapshot preserva:

- `modelName` e `modelVersion`;
- janela e timezone usados;
- touches elegíveis e exclusões com `reasonCode`;
- contribuição resultante;
- cupom, affiliate e campaign refs separadas;
- timestamps de criação, settlement e revisão;
- moeda/valor do outcome canônico;
- compensações por refund/chargeback sem apagar o toque.

Mudança de modelo só recalcula projeções comparativas explicitamente marcadas; relatórios financeiros e snapshot histórico do pedido não são reescritos.

### 15.3 Colisões e fraude

- parâmetros de URL nunca concedem desconto ou comissão sozinhos;
- click token é opaco, expira segundo política e resolve destino allowlisted;
- atribuição cross-device exige login/ação consentida e não faz fingerprinting oculto;
- self-referral, seller comprando de si, repetição automatizada, open redirect e stuffing de cupom/link entram em regras de risco;
- prioridade entre cupom, link afiliado, campanha paga e orgânico é política comercial versionada e visível no admin;
- comissão só nasce no módulo financeiro após os fatos e gates definidos; attribution não altera ledger diretamente.

## 16. Dashboards

### 16.1 SEO técnico

- URLs por sitemap: submitted, fetched, indexed, excluded e error;
- canonical declarada versus escolhida quando a fonte fornecer;
- status HTTP, redirect chains, soft 404 e crawl por template;
- pages com markup válido/inválido e divergência de preço/disponibilidade;
- Core Web Vitals de campo por page type, locale e dispositivo;
- frescor do read model de item/oferta;
- robots/sitemap deploy version e última verificação.

### 16.2 Conteúdo e busca por IA

- impressões, cliques, posição e query groups do Search Console quando integrados;
- landing pages, CTR e outcomes sem atribuir causalidade automática;
- conteúdo com owner/review vencida, oferta ausente ou thin-content gate falho;
- referências de ChatGPT Search identificáveis por referral/UTM quando presentes;
- verificação amostral de citações/menções por consulta definida, com data e motor;
- nenhum “share of AI voice” é mostrado sem metodologia, conjunto de queries e repetição documentados.

### 16.3 Aquisição e campanha

| Métrica | Numerador | Denominador |
|---|---|---|
| impression → detail | journeys com detalhe | journeys com impressão válida |
| detail → checkout | journeys com checkout | journeys com detalhe |
| checkout → settled | orders com `payment.settled` correlacionado | checkouts elegíveis |
| campaign delivery rate | delivered | attempts aceitos no denominador publicado |
| campaign click rate | clicks válidos deduplicados | delivered ou sent conforme definição exibida |
| attributed settled value | soma liquidada com contribuição | moeda/período/modelVersion compatíveis |
| refund value rate | valor reembolsado | valor liquidado atribuído elegível |
| opt-out rate | revogações relacionadas | delivered elegíveis |

Dashboard informa base, janela, moeda, timezone, modelo, `asOf`, freshness e dados indisponíveis. Não soma moedas sem taxa/fonte/tempo explícitos.

## 17. Testes e gates de release

### 17.1 Crawl/index

- [ ] crawler percorre links HTML da home até categoria e item sem depender de evento JS.
- [ ] matriz de rotas confirma status, robots meta, canonical, hreflang e sitemap esperados.
- [ ] URL com UTM/affiliate/coupon canonicaliza para a limpa e mantém atribuição separada.
- [ ] conta, checkout, preview, seller studio e admin não aparecem em sitemap e não vazam sem auth.
- [ ] slug antigo faz um redirect para canonical; item removido sem equivalente retorna `410`.
- [ ] robots é validado com parser, Search Console e fetch real através da CDN/WAF.
- [ ] cada sitemap passa XML schema/limites e contém somente `200` canonical/indexável.

### 17.2 Structured data e conteúdo

- [ ] JSON-LD passa Schema.org Validator e Rich Results Test quando aplicável.
- [ ] preço, moeda, availability, seller, review e count batem com o HTML e fontes.
- [ ] reputação seller não é marcada como review de produto.
- [ ] página 3D sem WebGL continua apresentando conteúdo/CTA e canonical corretos.
- [ ] página programática sem valor próprio fica `noindex` ou não é gerada.
- [ ] data de atualização só muda com alteração substantiva.
- [ ] amostra humana encontra fonte, owner, método e limites das afirmações.

### 17.3 Performance e acessibilidade

- [ ] budget de bundle, imagem, fonte, analytics e 3D falha o pipeline quando excedido.
- [ ] LCP/CLS de laboratório não regredem; INP é acompanhado em RUM após tráfego suficiente.
- [ ] p75 de campo é avaliado contra LCP 2,5 s, INP 200 ms e CLS 0,1 por mobile/desktop.
- [ ] navegação, filtros, consentimento, carrinho e viewer funcionam por teclado e reduced motion.

### 17.4 Analytics/atribuição

- [ ] schema registry rejeita campo não permitido e PII conhecida.
- [ ] repetição do mesmo `eventId`, click e webhook produz um efeito.
- [ ] browser não consegue forjar `payment.settled`, refund ou comissão.
- [ ] seller A não consulta touch, campanha, query ou resultado do Seller B.
- [ ] checkout sem join aparece como `UNJOINED`, nunca como orgânico por conveniência.
- [ ] refund/chargeback gera contribuição compensatória e preserva histórico.
- [ ] amostra reconcilia relatório com Order, Payments, Promotion e Ledger.

## 18. Experimentos e aprendizado

Antes de testar headline, card, animação, conteúdo, ordem de oferta ou mensagem:

1. registrar hipótese e decisão que o teste mudará;
2. escolher unidade de randomização e impedir contaminação cross-device/tenant;
3. definir métrica primária canônica e guardrails de refund, disputa, opt-out, performance e acessibilidade;
4. definir critério estatístico/amostra antes de olhar resultado;
5. versionar variante, exposição e janela;
6. não usar teste para remover preço, taxa, consentimento ou informação essencial;
7. publicar resultado como observado, inconclusivo ou inválido; não converter correlação em causalidade.

SEO de página indexada exige cuidado com variantes estáveis e canonical. Experimento não serve conteúdo enganoso a crawler nem mantém versão vencedora sem atualização do HTML, schema e documentação.

## 19. Ferramentas pesquisadas e decisão

Nenhuma ferramenta está instalada no Midas. “Estudar” não significa adotar.

| Projeto/fonte oficial | Utilidade | Decisão proposta |
|---|---|---|
| [Google robots.txt parser](https://github.com/google/robotstxt) | testar sintaxe com a biblioteca usada pelo Google Search | **ADOTAR NO CI** quando houver runtime |
| [Schema.org Validator](https://validator.schema.org/) | validar vocabulário JSON-LD | **ADOTAR NO QA** |
| [Google Rich Results Test](https://search.google.com/test/rich-results) | validar recursos suportados pelo Google | **ADOTAR NO QA** |
| [PostHog](https://github.com/PostHog/posthog) | eventos, funil, retenção, flags e replay | **PILOTO**, sem PII; replay off/masked nas áreas sensíveis |
| [RudderStack](https://github.com/rudderlabs/rudder-server) | roteamento de eventos/destinos | **ALTERNATIVA EM ESTUDO**, licença Elastic 2.0 e operação avaliadas |
| [Snowplow](https://github.com/snowplow/snowplow) | schema-first behavioral data e warehouse | **ALTERNATIVA EM ESTUDO**, depende de benchmark operacional |
| [Medusa](https://github.com/medusajs/medusa), [Saleor](https://github.com/saleor/saleor), [Vendure](https://github.com/vendurehq/vendure) | padrões de catálogo, cart, promotions, channels e offers | **REFERÊNCIA**, sem duplicar os domínios Midas |

Escolher um collector/analytics principal após proof of concept. PostHog, RudderStack e Snowplow não entram simultaneamente só porque são disponíveis.

## 20. Ordem de implantação

1. taxonomia, URL policy, metadata e renderização server-side das páginas públicas;
2. canonical, status, redirects e matriz `index/noindex`;
3. sitemaps e `robots.txt` versionados com política conservadora de IA;
4. JSON-LD de Organization/Breadcrumb/Product/Offer sob feature flags;
5. event registry, collector mínimo, consent gating e reconciliação;
6. Search Console, RUM/Core Web Vitals e dashboard técnico;
7. conteúdo editorial e primeiras páginas programáticas sob quality gate;
8. links opacos, UTM, cupom, afiliado e attribution snapshot;
9. expansão de locales com tradução/revisão e `hreflang` recíproco;
10. monitoramento de busca por IA e eventual revisão da política de treinamento pelo Master.

## 21. Referências primárias e oficiais

### Google Search

- [Criar e enviar robots.txt](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt)
- [Biblioteca open source do parser de robots.txt do Google](https://github.com/google/robotstxt)
- [Construir e enviar sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Consolidar URLs duplicadas e canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Versões localizadas e `hreflang`](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Robots meta e `X-Robots-Tag`](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product)
- [Product, Offer e Review para product snippets](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)
- [Review e AggregateRating](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)
- [Diretrizes gerais de structured data](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Conteúdo útil, confiável e people-first](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Recursos de IA e o site](https://developers.google.com/search/docs/appearance/ai-features)
- [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)
- [Crawlers comuns e `Google-Extended`](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers)

### Schema.org

- [`Product`](https://schema.org/Product)
- [`Offer`](https://schema.org/Offer)
- [`AggregateOffer`](https://schema.org/AggregateOffer)
- [`Review`](https://schema.org/Review)

### Busca por IA

- [OpenAI — tornar o site elegível ao ChatGPT Search](https://help.openai.com/en/articles/9237897)
- [OpenAI — publishers, `OAI-SearchBot`, `GPTBot` e referrals](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq)
- [Anthropic — `ClaudeBot`, `Claude-SearchBot` e `Claude-User`](https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)
- [Perplexity — crawlers e finalidade](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

### Analytics e referências de implementação

- [PostHog](https://github.com/PostHog/posthog)
- [RudderStack server](https://github.com/rudderlabs/rudder-server)
- [Snowplow](https://github.com/snowplow/snowplow)
- [Medusa](https://github.com/medusajs/medusa)
- [Saleor](https://github.com/saleor/saleor)
- [Vendure](https://github.com/vendurehq/vendure)

## 22. Fechamento

O Midas deve indexar entidades estáveis — catálogo, item, seller público elegível e conteúdo útil — em vez de todas as combinações que o banco consegue gerar. `robots.txt` é uma política versionada, não segurança nem atalho de canonicalização. Busca tradicional, busca por IA e treinamento são escolhas separadas: a proposta inicial permite descoberta pública e bloqueia treinamento conhecido até decisão expressa do Master. Structured data reflete o que o usuário vê e não mistura reputação seller com avaliação de produto. Atribuição parte de touches observados e termina em resultado financeiro canônico, com modelo, janela, moeda e compensações explícitos.
