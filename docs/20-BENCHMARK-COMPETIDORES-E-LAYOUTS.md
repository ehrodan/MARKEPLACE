# Benchmark de concorrentes e layouts — marketplace digital/gaming

> **Status:** pesquisa de referência e decisão de produto; não é especificação visual para clonagem.
>
> **Coleta:** 22 de agosto de 2026, America/Sao_Paulo.
>
> **Escopo:** superfícies públicas e documentação oficial acessível sem conta.
>
> **Screenshots:** nenhuma captura foi incorporada. Imagens, marcas, textos e composição visual dos terceiros não foram copiados.
>
> **Regra de leitura:** `OBSERVADO` é evidência pública; `INFERIDO` é interpretação explicitada; `OPORTUNIDADE MIDAS` é direção própria ainda sujeita à validação do produto.

## 1. Resultado executivo

O mercado analisado se divide em quatro modelos de experiência:

1. **vertical de item colecionável**, com metadados profundos, inspeção e histórico de preço: Skinport, CSFloat, DMarket e Steam Community Market;
2. **marketplace horizontal de oferta**, em que prazo, método de entrega e reputação do vendedor pesam tanto quanto o produto: G2G e GGMAX;
3. **catálogo canônico com múltiplos fornecedores**, em que uma página de produto concentra ofertas: Eneba;
4. **varejo digital com entrega controlada**, útil como referência de checkout, carteira e fidelidade, mas não de operação multivendedor: NeshaStore e Nuuvem.

Os melhores padrões não formam uma tela única. A oportunidade do Midas é combinar, com identidade própria:

- profundidade de atributos e leitura de valor dos verticais de skins;
- comparação operacional de vendedores dos marketplaces horizontais;
- catálogo canônico e prevenção de páginas duplicadas da Eneba;
- clareza brasileira de Pix, saldo, prazo de liberação e atendimento encontrada em referências locais;
- pós-venda orientado a ciclo de vida, sem entregar telefone do comprador ao vendedor;
- backoffice construído como filas auditáveis, não como uma coleção de tabelas genéricas.

### 1.1 Decisão crítica sobre Standoff 2

Há um bloqueio anterior a qualquer escolha de layout: as [Regras oficiais do Standoff 2 em pt-BR](https://help.standoff2.com/pt-BR/articles/8446575-regras-do-jogo), atualizadas em julho de 2026, classificam comércio externo por dinheiro real, intermediação não autorizada e automação/API fora das permissões do publicador como violações. A central oficial também declara que [comprar Gold ou skins fora do jogo é proibido](https://help.standoff2.com/pt-BR/articles/5324175-posso-comprar-ouro-ou-skins-fora-do-jogo) e que [venda de itens por dinheiro real pode levar à suspensão de comprador e vendedor](https://help.standoff2.com/pt-BR/articles/5324071-voce-tolera-a-venda-de-gold-contas-e-skins-por-dinheiro-real).

Portanto:

- páginas e sites de Standoff 2 foram estudados **somente como benchmark observacional**;
- nenhuma integração, importação de catálogo, intermediação, precificação ou venda externa de itens de Standoff 2 deve entrar em produção sem autorização comercial e técnica expressa da desenvolvedora;
- o produto deve conseguir bloquear jogo, categoria, operação e integração por política de publicador;
- o plano comercial precisa sobreviver sem depender de Standoff 2: gift cards, licenças autorizadas, serviços permitidos e outros catálogos devem ser avaliados separadamente;
- “está disponível em outro site” não prova licitude, licença de ativo, autorização da publisher nem segurança operacional.

Isso não é um detalhe de compliance a resolver depois do design. É um **gate de go/no-go do catálogo**.

## 2. Método clean-room

### 2.1 Perguntas usadas na análise

Para cada referência, a pesquisa procurou responder:

- qual é a promessa principal e para quem ela é feita;
- como o usuário descobre um produto;
- como produto, oferta e vendedor são separados;
- quais sinais reduzem a incerteza antes da compra;
- como preço, taxa, prazo, entrega e proteção aparecem;
- como o vendedor acompanha catálogo, estoque, pedidos e saldo;
- quais operações administrativas são reveladas pelas jornadas públicas;
- como a plataforma tenta gerar retorno, recompra e indicação;
- o que é realmente visível, o que está atrás de login e o que não foi encontrado.

### 2.2 Regras de evidência

| Nível | Uso neste documento | Limite |
|---|---|---|
| Alto | página pública atual ou ajuda oficial atualizada em 2025–2026 | ainda pode mudar depois da data de coleta |
| Médio | página pública dinâmica, índice de busca recente ou artigo oficial mais antigo sobre função ainda visível | não prova pixel, posição ou estado atual exato |
| Baixo | página de terceiro, conteúdo não oficial ou superfície parcialmente acessível | serve para hipótese; nunca para integração ou dado autoritativo |
| Não observado | login, KYC, pagamento real, seller center privado ou painel administrativo | não há conclusão sobre layout interno |

### 2.3 O que não foi feito

- não houve login, criação de conta, KYC, compra, venda, depósito ou saque;
- não houve captura de tela, download de asset, cópia de HTML/CSS ou medição pixel a pixel;
- não houve tentativa de contornar JavaScript, região, autenticação, rate limit ou proteção anti-bot;
- não foram inspecionados painéis administrativos privados;
- números promocionais dos próprios sites foram tratados como **alegações da fonte**, não como auditoria independente;
- preços de anúncios, quantidades e promoções dinâmicas não são requisitos do Midas.

## 3. Registro de acesso e limitações

| Referência | Papel no benchmark | Acesso em 22/08/2026 | Evidência usada | Limitação principal | Confiança |
|---|---|---|---|---|---|
| [Standoff 2 — ajuda oficial](https://help.standoff2.com/en/collections/3850927-marketplace) | mercado oficial dentro do jogo e política da publisher | central pública acessível | regras, comissão oficial e limites de comércio | interface ocorre no app; não foi aberta no jogo | alta para política; baixa para layout atual |
| [Standoff-2.com Shop](https://standoff-2.com/shop/) | rastreador não oficial de Standoff 2 | página pública acessível; russo | filtros, tabela, gráfico e declaração “não oficial” | fonte não autoritativa; sem contrato de API/licença | baixa |
| [PlayerAuctions — Standoff 2](https://www.playerauctions.com/standoff-2-marketplace/) | categoria externa dedicada | página pública acessível | hierarquia Gold/contas/serviços/top-up, ofertas e aviso de não afiliação | baixa liquidez observada e comércio sujeito às regras da publisher | média para layout; não adotável sem autorização |
| [Skinport](https://skinport.com/) | vertical de skins custodial | home/market dependentes de JavaScript no coletor | blog, API pública, ferramentas e página atual de taxas | layout exato atual do market não foi renderizado; guias antigos podem ter drift | média |
| [CSFloat](https://csfloat.com/) | vertical P2P de skins | aplicação exige JavaScript; índice público recente expôs conteúdo | home indexada, stalls públicos, FAQ e support wizard | não houve sessão autenticada nem checkout | média-alta para conteúdo; média para composição |
| [DMarket](https://dmarket.com/) | vertical/híbrido de skins e trading | home, catálogo, ajuda e API públicos acessíveis | home, catálogo, ajuda 2026 e documentação de API | nenhuma operação autenticada; alguns screenshots de ajuda podem ser antigos | alta para fluxo e campos; média para UI privada |
| [G2G](https://www.g2g.com/) | marketplace horizontal gaming | home/categorias/PDP indexáveis; parte da app exige JS | home, PDPs, seller page e ajuda oficial 2025–2026 | seller center e checkout real não observados | alta para fluxo público; média para painel |
| [Eneba](https://www.eneba.com/us/store/games) | catálogo canônico multivendor | catálogo, vendor store e ajuda públicos | catálogo, loja do vendor, compra, venda e gestão de oferta | checkout e vendor panel não autenticados | alta |
| [GGMAX](https://ggmax.com.br/) | referência brasileira P2P | FAQ, PDPs, termos e tarifas públicos | anúncio, reputação, checkout descrito, hold, saque e moderação | dashboard e backoffice privados | alta para regras públicas; média para painel |
| [NeshaStore](https://neshastore.com/) | referência brasileira vertical/retail de skins | app pública com conteúdo limitado no coletor; índice e blog acessíveis | catálogo indexado, inventário, carrinho, fluxo de trade e conteúdo | artigos de fluxo mais detalhados são antigos; não é multivendedor | média |
| [Nuuvem](https://www.nuuvem.com/br-pt/catalog) | varejo digital brasileiro adjacente | catálogo, termos e Drops públicos | catálogo, PDP/checkout descrito e fidelidade | não é marketplace P2P; checkout não concluído | alta para varejo, não comparável para seller ops |
| [Steam Community Market](https://steamcommunity.com/market/) | baseline oficial de mercado de itens Steam | mercado, busca e suporte públicos | busca avançada, listagens, histórico, ordens e restrições | saldo não sacável e ecossistema fechado; não é modelo financeiro do Midas | alta |

### 3.1 Política de screenshots

Nenhuma captura foi necessária para sustentar as conclusões. Quando uma central oficial contém imagens de orientação, o documento liga para a página original e descreve apenas o padrão funcional. Uma futura pesquisa visual pode registrar screenshots somente quando:

- os termos da fonte permitirem;
- houver finalidade interna definida;
- URL, data, viewport e contexto forem registrados;
- a imagem não for redistribuída nem usada como asset de produção;
- dados pessoais, saldos e identificadores forem removidos;
- houver comparação de estrutura, nunca pedido de reprodução.

## 4. Mapa de posicionamento

Os eixos abaixo são uma **inferência de produto**, não uma classificação declarada pelas empresas.

| Plataforma | Amplitude do catálogo | Profundidade de metadado do item | Modelo transacional observado | Centro da decisão de compra |
|---|---|---|---|---|
| Standoff 2 oficial | um jogo | alta para a economia do jogo | mercado interno em Gold | item e preço no ecossistema oficial |
| Skinport | poucos jogos/skins | muito alta | custódia por bots, venda por usuário | item individual, condição e preço |
| CSFloat | CS2 | muito alta | P2P com verificação da entrega | item único, seller online e preço relativo |
| DMarket | poucos jogos/skins | muito alta | marketplace, depósito, instant sell e buy orders | liquidez, atributos e ação de trading |
| Steam Market | múltiplos jogos Steam | alta, variável por jogo | mercado centralizado com Steam Wallet | oferta, ordem de compra e histórico |
| G2G | gaming amplo e serviços | média/alta por categoria | P2P com escrow e entrega coordenada | vendedor, prazo, método e preço |
| GGMAX | gaming e serviços digitais | média por categoria | P2P intermediado | confiança local, anúncio e entrega |
| Eneba | chaves, gift cards, top-ups e software | alta para região/plataforma, menor para item único | catálogo canônico com vendors | produto compatível, melhor oferta e condição |
| NeshaStore | CS2/skins | alta para atributos de skin | estoque/trade automatizado | item disponível e retirada para Steam |
| Nuuvem | jogos, DLCs e gift cards | alta para ativação/requisitos | varejo autorizado | compatibilidade, preço e promoção |

### 4.1 Espaço ainda mal atendido

O espaço potencial do Midas não é “mais um grid escuro de skins”. É um marketplace brasileiro e multitenant que apresente, no mesmo contrato visual:

- **produto canônico**: o que é, para qual jogo/plataforma/região e qual seu ciclo de vida;
- **oferta**: preço, estoque, prazo, método, plano e regras daquela venda;
- **vendedor**: reputação, verificações e desempenho relevante;
- **transação**: proteção, etapas, evidências, hold e pós-venda;
- **relacionamento**: recompra, expiração, suporte e campanhas consentidas;
- **governança**: licença, permissão da publisher, moderação e trilha financeira.

Essa separação reduz o problema recorrente de anúncios longos, ruidosos e contraditórios que tentam explicar produto, loja, entrega, upsell e suporte no mesmo campo de descrição.

## 5. Cartões de concorrente

### 5.1 Skinport

**Posicionamento observado.** Marketplace vertical de itens Steam com catálogo profundo e compra semelhante a e-commerce. O [guia oficial de compra](https://skinport.com/blog/how-to-buy-skins-on-skinport) descreve busca, categorias, filtros por atributos, ordenação por valor/desconto/preço/wear, comparação com preço sugerido, histórico de vendas e carrinho. O site também mantém [database de skins](https://skinport.com/db), viewer 3D e ferramenta de screenshot ligados ao domínio de descoberta.

**Força.** O item é o protagonista e recebe contexto técnico suficiente para o comprador comparar exemplares, não apenas nomes genéricos.

**Problema observado/limite.** O market atual não foi renderizado pelo coletor sem JavaScript. O guia detalhado é de 2021; ele confirma funções, mas não a composição atual exata.

**Economia pública.** A [política de taxas publicada em julho de 2025](https://skinport.com/blog/lower-fees-for-everybody) informa 8% padrão, 6% para itens acima do limiar de €1.000 e 2% para venda privada. Essa informação é comparação comercial datada, não recomendação de preço para o Midas.

**Oportunidade Midas.** Herdar a disciplina de atributo, histórico e inspeção, mas explicar proveniência, validade do preço e direitos do asset. Não esconder vendedor, hold ou regra de disputa atrás da estética do item.

### 5.2 CSFloat

**Posicionamento observado.** Vertical de CS2 com marketplace P2P e database. A home indexada publicamente descreve [envio direto do vendedor ao comprador e liberação após verificação](https://csfloat.com/profile/withdraw). Stalls públicos exibem vendedor verificado, estado online/offline, busca, agrupamentos, preço, diferença para referência, float, paint seed, screenshot/inspect, “Bargain”, carrinho e compra direta; um [stall público indexado](https://csfloat.com/stall/76561199441169279) mostra esses elementos.

**Força.** Densidade técnica alta sem separar o usuário da ação comercial. O estado do vendedor reduz a incerteza de uma entrega P2P.

**Problema observado/limite.** A aplicação é JavaScript-only para o coletor e não houve checkout autenticado. “Verified” e “Top Rated” são sinais compactos, mas a metodologia completa não foi observada naquela página.

**Economia pública.** A home indexada informa taxa de venda de 2% e taxa de saque dinâmica de 0,5% a 2,5% conforme volume. Deve ser reconfirmada antes de qualquer comparação financeira futura.

**Oportunidade Midas.** Aplicar o padrão “atributo + preço relativo + disponibilidade operacional” e expandir a reputação para entrega, disputa e reincidência, com explicação da janela de cálculo.

### 5.3 DMarket

**Posicionamento observado.** Plataforma de trading com marketplace, exchange, buy orders (“Targets”), depósito/saque de itens e API. A [home atual](https://dmarket.com/) prioriza coleções, ofertas populares, volume de catálogo, app, proteção, meios de pagamento e trading API. O [catálogo de CS2](https://dmarket.com/ingame-items/item-list/csgo-skins) conecta filtros e carrinho.

**Força.** Trata compra, venda, oferta imediata, preço sugerido e ordem de compra como operações de um mesmo mercado. A ajuda atual explica que o [Target pode comprar automaticamente por atributos e preço](https://support.dmarket.com/hc/en-us/articles/25235390455825-What-is-target).

**Problema observado/limite.** Muitas ações e métricas podem intimidar usuário casual. Números da home são declarações do próprio DMarket; não foram auditados. Screenshots antigos em artigos de ajuda não provam a tela atual.

**Operação pública relevante.** O fluxo de [colocar item à venda](https://support.dmarket.com/hc/en-us/articles/43418225797521-How-to-put-an-item-on-sale) mostra preço recomendado, menor preço, média recente, líquido a receber e saldo bloqueado por trade protection. Ofertas sem atualização por seis meses podem ser [desativadas](https://support.dmarket.com/hc/en-us/articles/25225263444881-Why-my-sale-offer-was-deactivated).

**Oportunidade Midas.** Separar modo “comprar” do modo “trader”, manter líquido a receber sempre visível e transformar expiração/desativação em estado explícito, com aviso antes da ação automática.

### 5.4 G2G

**Posicionamento observado.** Marketplace global e horizontal de game coins, items, accounts, boosting, top-up, gift cards, software e outros serviços. A [home pública](https://www.g2g.com/) organiza a descoberta por categoria, jogos em tendência, coaching, proteção, afiliação e CTA para vender.

**Força.** A comparação de ofertas traz o que importa para entrega humana: percentual de avaliação, quantidade vendida, mínimo, estoque, prazo e nível do vendedor. Um [PDP público](https://www.g2g.com/kr/categories/gray-zone-warfare-items/offer/G1769298806477OA) acrescenta método de entrega, quantidade, total, vendedor, chat, sucesso de entrega, data de entrada e avaliações verificadas.

**Problema observado/limite.** A amplitude produz páginas longas e conteúdo SEO repetitivo. “Level” e ranking são sinais fortes, mas podem virar substitutos opacos para métricas operacionais explicáveis.

**Seller ops observado.** A página [Sell on G2G](https://www.g2g.com/seller) declara ferramentas para eficiência, clientes e desempenho; a ajuda de [criação e gestão de listings](https://support.g2g.com/support/solutions/articles/5000001404-how-to-sell-) aponta `Listings > Manage Listing`. A ordenação considera vendas recentes, avaliações, ranking, nível, conclusão, velocidade e resposta no chat, conforme [ajuda de ranking de listings](https://support.g2g.com/support/solutions/articles/5000866146-how-are-the-listings-sorted-).

**Oportunidade Midas.** Manter os sinais de execução ao lado do preço, mas substituir nível opaco por decomposição verificável: prazo prometido, entrega no prazo, taxa de conclusão, disputas procedentes e amostra.

### 5.5 Eneba

**Posicionamento observado.** Catálogo canônico de chaves, gift cards, software, top-ups e assinaturas com múltiplos vendors. O [catálogo público](https://www.eneba.com/us/store/games) usa filtros por preço, país, tipo, sistema, plataforma e região; cards exibem plataforma, região, preço de referência, desconto, cashback, “Add to cart” e “View offers”.

**Força.** Produto e oferta são entidades visivelmente diferentes. Uma página pode agregar vendedores sem cada vendedor reescrever o produto. A [loja pública de um vendor](https://www.eneba.com/us/vendor/digital-game-store) mostra rating atual, tempo de plataforma, itens vendidos em seis meses, ticket ratio, tempo de disputa e condições de pagamento/entrega/garantia.

**Problema observado/limite.** Grande densidade promocional e cashback podem disputar atenção com compatibilidade de plataforma/região, que é o risco real da compra.

**Seller ops observado.** O [Vendor Panel](https://www.eneba.com/support/article/how-create-sell-digital-offer) reutiliza produto existente e permite solicitar novo cadastro com plataforma, região, descrição, expiração e compatibilidade. A tela [Currently Selling](https://www.eneba.com/us/support/article/how-manage-digital-items) reúne status, preço editável, estoque disponível/reservado, última venda, vendas em sete dias, vendas totais e posição na PDP.

**Oportunidade Midas.** Adotar catálogo canônico + ofertas e campos dinâmicos por categoria. Compatibilidade, expiração e método de entrega devem vir antes da promoção.

### 5.6 GGMAX

**Posicionamento observado.** Marketplace brasileiro P2P de produtos e serviços digitais, com pagamento intermediado, anúncio escolhido pelo vendedor, entrega por chat ou automática e reputação pública. A [FAQ atual](https://ggmax.com.br/perguntas-frequentes) descreve checkout, planos de segurança, chat do pedido, botão de problema, intervenção de moderador, entrega automática, hold e retirada.

**Força.** Linguagem e meios locais reduzem a distância operacional. PDPs públicas colocam estoque, vendas, preço, descrição, perguntas, avaliações, vendedor, verificações e garantia na mesma jornada; um [anúncio público atual](https://ggmax.com.br/anuncio/promocao-easter-update-gamepass-blox-fruits-e-frutas-permanente) evidencia a estrutura.

**Problema observado.** Descrições livres podem virar blocos extensos com emojis, links cruzados, condições e upsells difíceis de auditar. Perguntas repetidas como “está online?” indicam que disponibilidade e prazo não estão resolvidos só pelo texto.

**Operação pública relevante.** A página de [tarifas e prazos](https://www.ggmax.com.br/tarifas-e-prazos) vincula destaque a planos e informa hold por categoria. A [política de reembolso](https://ggmax.com.br/refund-policy) liga denúncia ao pedido e autorização ao moderador.

**Oportunidade Midas.** Transformar descrição em campos e blocos governados; exibir presença, janela de atendimento, entrega, SLA e risco de forma estruturada. Cross-sell deve usar relações de catálogo aprovadas, não links livres no corpo do anúncio.

### 5.7 NeshaStore

**Posicionamento observado.** Loja brasileira vertical de skins de CS2 com estoque e trades automatizadas. O índice público atual da [NeshaStore](https://neshastore.com/) expõe categorias, ordenação, conta, pedidos, inventário e carrinho. O blog atual mantém grande volume de conteúdo de coleções, itens, esports e guias no [NeshaStore Blog](https://blog.neshastore.com/).

**Força.** A navegação é inventário-first e fala a linguagem local. O histórico de produto descreve item exato, float, pattern, adesivos, inspect, trade lock e inventário intermediário; o artigo [New Nesha](https://blog.neshastore.com/new-nesha/) documenta essas funções, embora seja de 2022.

**Problema observado/limite.** É um modelo de estoque/trade, não P2P multivendedor. Parte da documentação detalhada é histórica e não deve ser tratada como prova da UI atual.

**Marketing observado.** Conteúdo contínuo e notificações de chegada de item foram explorados em blog, Discord e Telegram; o artigo [Canal das Skins](https://blog.neshastore.com/canal-das-skins/) é evidência histórica, não garantia de programa vigente.

**Oportunidade Midas.** Aproveitar a compreensão brasileira de inventário, Pix e disponibilidade sem reproduzir identidade. O conteúdo deve ser ligado a item/categoria por taxonomia e direitos editoriais.

### 5.8 Nuuvem

**Posicionamento observado.** Varejo oficial de jogos e conteúdo digital na América Latina. O [catálogo público](https://www.nuuvem.com/br-pt/catalog) organiza milhares de itens por busca, popularidade, lançamento, vendas, preço, desconto, plataforma e ativação.

**Força.** PDP e checkout priorizam compatibilidade, requisitos, região, plataforma de ativação e cupom. Os [termos atuais](https://secure.nuuvem.com/br-pt/terms-of-use) descrevem carrinho, pagamento, antifraude e entrega digital.

**Problema/limite.** Não resolve seller ops nem reputação entre usuários; é referência adjacente, não concorrente estrutural completo.

**Pós-venda observado.** O programa [Drops](https://www.nuuvem.com/br-pt/drops) torna saldo visível no carrinho, guarda cashback na conta e envia alertas antes da expiração.

**Oportunidade Midas.** Mostrar saldo e validade em contexto, com avisos progressivos e histórico de origem. Não converter cashback em mecanismo obscuro de expiração.

### 5.9 Steam Community Market

**Posicionamento observado.** Mercado oficial de itens Steam com fundos presos à Steam Wallet. A [busca avançada de CS2](https://steamcommunity.com/market/search?appid=730&lock_appid=730) apresenta filtros por classe, coleção e tipo; cards mostram qualidade, quantidade e preço inicial. A home reúne listings ativos, histórico, venda, itens populares, recém-listados e recém-vendidos.

**Força.** A distinção entre listing e ordem de compra deixa oferta e demanda legíveis. A [FAQ do Community Market](https://help.steampowered.com/fr/faqs/view/61F0-72B7-9A18-C70B) explica ordens, histórico e restrições.

**Problema/limite.** Saldo não é sacável e a experiência é vinculada ao ecossistema Steam. As regras de hold e elegibilidade são específicas da Valve.

**Oportunidade Midas.** Tornar intenção de compra e liquidez visíveis quando juridicamente e operacionalmente possíveis, sem prometer preço futuro ou tratar item como investimento.

### 5.10 Standoff 2: referência oficial e superfícies externas

**Oficial.** A central confirma marketplace interno e [comissão de 20%](https://help.standoff2.com/en/articles/5408837-do-you-have-any-kind-of-commission-at-marketplace). O FAQ oficial informa que não há trade direto entre jogadores e que a compra ocorre no marketplace interno. O uso permitido é definido pela publisher, não pelos concorrentes externos.

**Rastreador não oficial.** O [Standoff-2.com Shop](https://standoff-2.com/shop/) declara ser não oficial e apresenta filtros, preço mínimo/máximo/médio, vendas, compra/venda, gráfico e tabela de variação, spread e volatilidade. Serve para entender demanda por informação, não como fonte de dados, API ou asset.

**Marketplace externo.** A [página da PlayerAuctions](https://www.playerauctions.com/standoff-2-marketplace/) agrupa Gold, contas, serviços e top-up e declara não ter afiliação com o jogo. Em 22/08/2026 havia baixa oferta visível. A presença da categoria não remove o conflito com as regras oficiais.

**Oportunidade Midas.** Se houver autorização futura, apresentar fonte, timestamp, moeda, tipo de mercado e limites de uso; até lá, bloquear comercialização externa e manter somente conteúdo editorial/licenciado que também seja permitido.

## 6. Teardown por superfície

### 6.1 Home

| Padrão observável | Referências | Problema recorrente | Oportunidade Midas |
|---|---|---|---|
| busca global e categorias no primeiro nível | G2G, Eneba, Nesha, Nuuvem | taxonomias amplas geram menus enormes | busca federada com sugestão por jogo, produto, oferta e vendedor; categorias progressivas |
| trilhos de tendência, novidade e melhores ofertas | G2G, DMarket, Eneba, Steam | “trending” pode ser opaco ou promocional | rotular a regra: mais vendidos, recém-listados, preço reduzido ou curadoria; exibir janela temporal |
| bloco de confiança e proteção | G2G, DMarket, GGMAX | claims e contadores próprios podem parecer prova independente | explicar como hold, disputa, KYC e entrega funcionam; métricas somente com fonte e período |
| live feed e atividade recente | DMarket | ruído e falsa urgência se não houver dado real | usar apenas eventos auditados e agregados; nunca inventar venda/escassez |
| cashback e desconto dominantes | Eneba, Nuuvem | promoção pode esconder região, validade ou taxa | compatibilidade e custo total precedem recompensa |
| conteúdo/editorial conectado ao catálogo | Nesha, Skinport | blog isolado não ajuda a decisão na hora certa | módulos editoriais por item, categoria e estágio, com autoria e atualização |
| CTA “comprar” e “vender” simultâneos | G2G, DMarket, Nesha | mistura duas intenções no mesmo caminho | seletor de tarefa persistente; home pode compartilhar busca, mas jornadas divergem cedo |

#### Hierarquia recomendada da home Midas

1. cabeçalho com identidade do tenant, busca e ações de conta;
2. seletor claro `Comprar`, `Vender` e `Explorar catálogo`, condicionado a permissão;
3. categorias/jogos autorizados, sem insinuar afiliação com publisher;
4. trilho de ofertas verificadas com critério nomeado;
5. bloco de funcionamento da proteção em três etapas, sem claims absolutos;
6. recomendações personalizadas somente após sinal suficiente e consentimento aplicável;
7. conteúdo útil ligado a compatibilidade, entrega e segurança;
8. rodapé de políticas, suporte, status e propriedade intelectual.

O hero não deve depender de números inventados, countdown reiniciado, roleta, popup simultâneo ou “última unidade” sem estoque real.

### 6.2 Catálogo e busca

| Padrão observável | Referências | Problema recorrente | Oportunidade Midas |
|---|---|---|---|
| filtros específicos do domínio | Skinport, CSFloat, DMarket, Steam | um filtro universal vira genérico demais ou inconsistente | schema de atributos versionado por categoria/jogo; URL e estado compartilháveis |
| filtros comerciais e operacionais | G2G, Eneba | preço sem prazo/método não compara serviço | filtrar por entrega, presença, estoque, faixa, plano, reputação e proteção aplicável |
| cards densos com preço e atributo | CSFloat, DMarket, Eneba | excesso de números sem hierarquia | três camadas: identidade do item, decisão econômica, risco/entrega |
| agrupamento por produto com várias ofertas | Eneba | oferta errada de região/plataforma causa frustração | PDP canônica agrega ofertas compatíveis e bloqueia combinação inválida |
| página/loja do vendedor com o próprio catálogo | CSFloat, Eneba, G2G | pode fragmentar SEO e duplicar produto | seller storefront é filtro sobre ofertas, não cópia da PDP canônica |
| ordenação por desempenho do seller | G2G | ranking opaco favorece incumbente e pay-to-win | separar relevância orgânica, qualidade operacional e promoção paga; rotular patrocinado |
| dados de mercado e preço relativo | Standoff tracker, Skinport, CSFloat, DMarket | referência desatualizada pode induzir erro | fonte, horário, moeda, tamanho da amostra e aviso de não garantia próximos ao dado |

#### Contrato de card próprio

O card Midas deve reservar posições estáveis para:

- imagem aprovada ou placeholder legítimo;
- nome canônico e variante;
- jogo/plataforma/região;
- preço total e qualquer taxa conhecida;
- estoque/quantidade quando significativo;
- prazo e método de entrega;
- seller compacto com avaliação/amostra ou selo de operação própria;
- badge de promoção claramente separado de confiança;
- atributos essenciais daquela categoria;
- ação primária única por contexto.

Não colocar telefone, e-mail, username externo, claim de publisher ou link fora da plataforma no card.

### 6.3 PDP — página de produto/oferta

| Padrão observável | Referências | Problema recorrente | Oportunidade Midas |
|---|---|---|---|
| mídia dominante + detalhes técnicos | Skinport, CSFloat, DMarket, Nesha | imagem bonita pode mascarar variante/estado | galeria 2D/3D licenciada com legenda de variante, origem e correspondência do item |
| inspect, screenshot, float, seed e stickers | Skinport, CSFloat, DMarket | dado específico de CS2 não generaliza | renderizador por categoria; não mostrar campo sem semântica real |
| preço, desconto/referência e ação juntos | todos os verticais | referência pode ser marketing, não valor justo | explicar origem e validade; permitir comprar sem sugerir investimento |
| prazo, método, quantidade e seller | G2G, GGMAX | descrição tenta compensar campo ausente | bloco operacional estruturado antes do texto livre |
| várias ofertas no mesmo produto | Eneba | menor preço pode ser incompatível ou ter condição pior | comparar custo total, compatibilidade, entrega, retorno e seller na mesma tabela |
| perguntas e chat pré-compra | GGMAX, G2G | repetição, contato externo e vazamento de dado | perguntas públicas moderadas + chat relay; respostas canônicas alimentam FAQ do produto |
| avaliações verificadas e métricas do vendedor | G2G, GGMAX, Eneba | média sem volume/recência é enganosa | distribuição, amostra, período, compra verificada e dimensão de serviço |
| buy order/target | Steam, DMarket | automação e reserva de saldo aumentam complexidade | somente em categoria autorizada, com limite, expiração, saldo reservado e cancelamento explícitos |
| cross-sell no corpo do anúncio | observado em PDPs GGMAX | texto vira catálogo paralelo não moderado | relacionamentos `complementa`, `renova`, `substitui` e `bundle` administrados no catálogo |

#### Hierarquia recomendada da PDP Midas

1. breadcrumb, status de autorização e identidade canônica;
2. mídia licenciada e seletor 2D/3D quando houver asset correspondente;
3. título, variante, compatibilidade, região e validade;
4. preço total, taxa/desconto explicado e saldo/recompensa aplicável;
5. oferta selecionada: seller, estoque, presença, entrega e proteção;
6. CTA principal e alternativa `Adicionar`, sem múltiplos botões equivalentes;
7. comparador de outras ofertas compatíveis;
8. detalhes técnicos e instruções de uso/ativação;
9. política específica de entrega, reembolso e expiração;
10. reputação, perguntas e histórico verificável;
11. complementos e renovação com justificativa;
12. conteúdo editorial, segurança e itens relacionados.

Se produto e oferta forem uma entidade única na implementação inicial, a interface ainda deve separar visualmente dados canônicos de condições do vendedor. Isso evita migração dolorosa quando múltiplas ofertas forem habilitadas.

### 6.4 Carrinho e checkout

| Padrão observável | Referências | Problema recorrente | Oportunidade Midas |
|---|---|---|---|
| `Add to cart` e `Buy now` | Skinport, CSFloat, DMarket, Eneba, Nesha | duas ações sem diferença clara | `Comprar agora` pula descoberta, não validações; `Adicionar` preserva contexto |
| checkout orientado a quantidade/método de entrega | G2G | instrução do buyer pode ficar solta | campos estruturados e validados por categoria, visíveis ao seller no pedido |
| compra sem registro | Eneba | reduz fricção, mas complica suporte, risco e biblioteca | decidir por risco/categoria; bens com disputa, wallet ou seller podem exigir conta antes do pagamento |
| cupom no checkout | Eneba, Nuuvem | cupom tardio pode gerar abandono para “caçar código” | aplicar link/cupom previamente atribuído e mostrar economia sem induzir saída |
| plano de proteção adicional | GGMAX | opção pré-selecionada pode virar dark pattern | proteção básica obrigatória no modelo; extras opcionais, comparáveis e desmarcados |
| saldo/cashback no carrinho | Nuuvem, Eneba | validade e restrição podem surpreender | saldo por origem, expiração e ordem de consumo explicitados antes de pagar |
| entrega para inventário intermediário | Skinport, Nesha | usuário confunde compra aprovada com item recebido | timeline distingue pagamento, reserva, disponibilidade, retirada e aceitação |
| cart com sellers diferentes | referências não deram prova pública suficiente de tratamento uniforme | frete/hold/entrega e disputa variam | agrupar por seller e gerar pedidos independentes; mostrar totais e SLAs por grupo |

#### Fluxo de checkout recomendado

1. validar disponibilidade, preço e autorização da categoria;
2. agrupar itens por seller e método de entrega;
3. confirmar compatibilidade, região, expiração e campos necessários;
4. mostrar subtotal, desconto, taxa, crédito e total sem linha oculta;
5. apresentar proteção, prazo de entrega, hold do vendedor e política de disputa;
6. coletar somente os dados necessários, sem compartilhar telefone com o seller;
7. selecionar pagamento e concluir autenticação;
8. criar um pedido por unidade operacional e mostrar timeline;
9. levar para central de compras/chat relay, não para WhatsApp pessoal;
10. disparar recibo e evento de pós-venda consentido.

Abandono deve preservar carrinho no tenant correto e respeitar consentimento; não autoriza o vendedor a obter o WhatsApp do visitante.

### 6.5 Perfil e reputação

| Padrão observável | Referências | Problema recorrente | Oportunidade Midas |
|---|---|---|---|
| badge verificado/top seller | CSFloat, Eneba, G2G, GGMAX | selo binário esconde o que foi verificado | tooltip informa identidade, telefone, documento, empresa ou operação; dado sensível permanece privado |
| nível/ranking do seller | G2G, GGMAX | mistura volume, pagamento por destaque e confiança | nível comercial, promoção e risco em eixos separados |
| rating, quantidade e avaliações verificadas | G2G, GGMAX, Eneba | média sem recência/amostra | média, distribuição, total, janela, compra verificada e elegibilidade |
| entrega no prazo, conclusão e resposta | G2G | fórmula de ranking não é totalmente visível na PDP | mostrar métricas operacionais com definição, mínimo de amostra e janela móvel |
| tempo de plataforma e vendas recentes | Eneba | volume alto pode dominar qualidade atual | combinar tenure com desempenho recente, sem assumir causalidade |
| stall/storefront do seller | CSFloat, Eneba | descrição pessoal pode trazer link externo | catálogo filtrado, políticas aprovadas, status e reputação; conteúdo moderado |
| perguntas/respostas públicas | GGMAX | podem expor contato ou virar suporte informal | moderação automática/manual, máscara de dados e conversão de respostas úteis em FAQ |

#### Perfil público Midas

O perfil público do vendedor deve conter:

- nome de exibição e avatar moderados;
- tenant/loja e papel comercial;
- verificações explicadas, sem documento, telefone ou endereço;
- avaliação total e por dimensão, com amostra e período;
- vendas concluídas e tempo de plataforma;
- entrega no prazo, conclusão e disputa procedente quando houver amostra suficiente;
- nível/recompensa e badges, separados de verificação;
- status de atendimento e tempo típico calculado, não promessa livre;
- ofertas ativas e categorias autorizadas;
- políticas próprias permitidas dentro do contrato da plataforma;
- botão de chat relay, seguir e denunciar;
- histórico de sanções **não público**, acessível somente a operadores autorizados.

Avaliação de comprador e vendedor só deve nascer de pedido elegível. Incentivo condicionado a nota positiva é proibido; benefício por preencher uma avaliação pode existir apenas se neutro quanto à nota e claramente informado.

### 6.6 Seller dashboard

Painéis privados não foram acessados. Os componentes abaixo derivam de campos revelados em documentação oficial, não de inspeção visual autenticada.

| Evidência pública | Padrão operacional | Problema a evitar | Oportunidade Midas |
|---|---|---|---|
| [Eneba — Currently Selling](https://www.eneba.com/us/support/article/how-manage-digital-items) | status, preço inline, estoque livre/reservado, última venda, vendas em 7 dias, total, posição | dashboard só de faturamento, sem ação | fila de reposição/repricing e impacto da posição explicável |
| [G2G — Selling help](https://support.g2g.com/support/solutions/5000173216) | listings, pedidos, retirada, entrega, disputa, atualizações | menus por entidade desconectados | inbox operacional unifica “precisa agir agora” |
| [DMarket — user offers API](https://docs.dmarket.com/v1/swagger.html) | ofertas ativas, inventário, depósito, ordem e preço | expor complexidade de API ao seller casual | modo simples e modo avançado, com mesma fonte de estado |
| [GGMAX — FAQ](https://ggmax.com.br/perguntas-frequentes) | anúncio, aprovação, chat, entrega automática, hold e saque | seller descobre prazo só após vender | simulador de líquido e disponibilidade antes de publicar |
| [Nesha — inventário](https://blog.neshastore.com/resgatar-skins-neshastore/) | comprado, em tradelock, pronto para retirada e resgatado | estado técnico sem próximo passo | status + prazo + ação + ajuda contextual |

#### Hierarquia recomendada do seller workspace

1. **Hoje:** pedidos que aguardam aceite, entrega, evidência, resposta ou contestação;
2. **Pedidos:** timeline, chat, arquivos/evidências e ação permitida por estado;
3. **Ofertas:** rascunho, revisão, ativa, sem estoque, pausada, expirada e bloqueada;
4. **Catálogo:** selecionar produto canônico ou solicitar cadastro, sem duplicar SKU;
5. **Estoque/entrega:** disponível, reservado, consumido, inválido e reposição;
6. **Financeiro:** bruto, taxa, líquido, hold por venda, liberado, saque e ajuste;
7. **Clientes:** segmentos e sinais agregados, sem exportar telefone/WhatsApp;
8. **Pós-venda:** renovação, recompra, avaliações e campanhas com consentimento;
9. **Desempenho:** conversão, cancelamento, entrega, disputa, resposta e ranking explicado;
10. **Loja:** aparência dentro dos tokens do tenant, políticas e equipe;
11. **Configurações:** integrações, notificações, segurança e permissões.

O topo deve mostrar ações vencendo, não cards decorativos. Receita sem distinguir `hold`, `disponível` e `sacado` cria erro operacional.

### 6.7 Admin ops

Nenhum concorrente concedeu acesso ao admin interno. Logo, não existe base para dizer que seus painéis usam determinada tabela, gráfico ou fila. O que se observa publicamente são **obrigações operacionais**:

- GGMAX revisa anúncios, permite sinalizar problema no pedido, intervém por moderador, autoriza reembolso e segura saldo conforme categoria;
- G2G aplica políticas de listing, prova de entrega, chat interno, ranking, disputa, reserva e retirada;
- Eneba verifica vendor/KYC, recebe solicitação de novo produto, expõe ticket ratio e condições do vendor;
- DMarket mantém KYC em certos saques, bloqueio de saldo por trade protection, desativação de listing e regras anti-scam;
- CSFloat possui support wizard e verificação de aceite P2P;
- todos exigem governança de catálogo, risco, pagamento, entrega, conteúdo e suporte, ainda que a UI privada não seja pública.

#### Painel master Midas orientado por fila

| Fila | Unidade de trabalho | Contexto mínimo no primeiro viewport | Ações controladas |
|---|---|---|---|
| pagamentos não conciliados | tentativa/pedido/evento do PSP | valor, método, provider status, divergência, tentativas e timestamps | reprocessar consulta; vincular; aprovar manualmente com motivo e permissão |
| saques | solicitação + conta recebedora | disponível, origem, holds, KYC, risco, prioridade, aging | aprovar, rejeitar, marcar pago, anexar comprovante; dupla checagem conforme risco |
| disputas/reembolsos | caso + pedido | timeline, promessa, chat, evidência, valor em risco, prazo | pedir evidência, decidir, escalar, reembolsar dentro da alçada |
| anúncios | listing + produto canônico | categoria, mídia, texto, direitos, preço, seller, duplicidade | aprovar, pedir correção, bloquear, mesclar referência de catálogo |
| catálogo/assets | item + versão/licença | publisher, autorização, campos, variantes, hash, direitos e validade | publicar, quarentenar, revogar, versionar |
| risco/conta | usuário/tenant/sinal | verificações, device/account links, chargebacks, disputas, exposição | limitar, congelar, liberar, escalar, sempre com trilha |
| avaliações | review + pedido | elegibilidade, texto, sinais de coerção/duplicidade, histórico | publicar, ocultar por regra, contestar; nunca editar nota arbitrariamente |
| campanhas | campanha + segmento | tenant, consentimento, canal, template, frequência, atribuição | aprovar, pausar, cancelar, auditar envio |
| publisher policy | jogo/categoria/operação | documento vigente, autorização, territórios, integrações e data de revisão | permitir, restringir ou bloquear por escopo |

#### Regras de layout do admin

- navegação por domínio, mas home por exceção e aging;
- filtros salvos por função e tenant;
- estado, prazo e próximo responsável em todas as linhas;
- painel lateral com timeline imutável, sem perder a lista;
- ações destrutivas exigem motivo, confirmação proporcional e permissão;
- dados pessoais mascarados por padrão e revelados sob justificativa;
- totais financeiros conciliam com ledger, não com soma ad hoc de pedidos;
- nenhuma aprovação manual altera silenciosamente o histórico original;
- promoção paga nunca muda fila de risco, disputa ou verificação.

### 6.8 Marketing e pós-venda

| Padrão observável | Referências | Valor | Risco/problema | Oportunidade Midas |
|---|---|---|---|---|
| cashback na próxima compra | Eneba, Nuuvem | cria motivo de retorno | validade e restrição escondidas | mostrar origem, validade, elegibilidade e alertas graduais |
| pontos por compra | GGMAX | feedback imediato | prêmio pode estimular compra inadequada | regras versionadas, custo controlado e sem confundir com saldo sacável |
| newsletter com ofertas/cupom | Eneba, Nesha | canal próprio | excesso, consentimento fraco e código vazado | preferências por categoria, frequência e finalidade; unsubscribe imediato |
| conteúdo de catálogo | Skinport, Nesha, Nuuvem | educação e aquisição orgânica | conteúdo massificado/desatualizado | clusters por jogo/categoria, revisão editorial e ligação a produto compatível |
| afiliado com link e dashboard | Eneba, DMarket, G2G, CSFloat | distribuição mensurável | last-click opaco, autocupom e fraude | link/código assinados, janela declarada, regras de deduplicação e painel auditável |
| alerta de item/estoque | Nesha, marketplaces verticais | captura intenção específica | spam e falsa escassez | watchlist por item/atributo/preço, canal e frequência escolhidos |
| pós-compra em biblioteca/inventário | Eneba, Skinport, Nesha | reduz suporte e centraliza entrega | status pouco claro | timeline, instrução, validade, aceite, problema e avaliação na ordem correta |
| loja/stall do vendedor | CSFloat, Eneba, G2G | recorrência por confiança | exposição de contato e bypass | seguir seller e receber novidades via plataforma, sem revelar telefone |

As regras completas de consentimento, WhatsApp/Instagram, quiet hours, frequency cap, carrinho abandonado e atribuição pertencem aos documentos de marketing e SEO já produzidos. Este benchmark apenas confirma que retenção funciona melhor quando aparece como continuação da compra, não como popup isolado.

#### Pós-venda por classe de produto

| Classe | Sinal de retorno | Momento útil | Mensagem legítima | Não fazer |
|---|---|---|---|---|
| licença/key única | ativação e suporte | logo após entrega; fim da janela de problema | como ativar, onde ver chave, abrir problema | prometer recompra recorrente sem razão |
| assinatura/Nitro | expiração | antes do vencimento, conforme consentimento | renovar, comparar período, confirmar compatibilidade | assumir que cliente quer auto-renovar |
| top-up/moeda permitida | consumo estimado e recompra real | baseado em comportamento agregado, não vigilância intrusiva | repetir quantidade, ver ofertas compatíveis | sugerir urgência falsa ou uso excessivo |
| skin/colecionável autorizado | watchlist, oferta e interesse | mudança real de estoque/preço | item seguido disponível; fonte e timestamp | dizer que valor vai subir ou tratar como investimento garantido |
| serviço/boost permitido | conclusão e resultado | após aceite; quando serviço complementar fizer sentido | suporte, avaliação e próxima etapa | pedir credencial fora do fluxo seguro |
| produto com validade | vencimento registrado | cadência progressiva antes de expirar | utilizar, renovar ou substituir | esconder expiração para capturar breakage |

## 7. Matriz comparativa de superfícies

Legenda: `●` observado em página pública atual; `◐` parcialmente observado ou documentado; `○` não encontrado publicamente; `🔒` existe indício, mas a tela está autenticada/privada; `N/A` não pertence ao modelo.

| Plataforma | Home comercial | Catálogo/filtros | PDP/oferta | Carrinho/checkout | Perfil/reputação | Seller dashboard | Admin ops | Marketing/pós-venda |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Skinport | ◐ | ◐ | ◐ | ◐ | ○ | 🔒 | ○ | ● |
| CSFloat | ◐ | ● | ● | ◐ | ● | 🔒 | ○ | ◐ |
| DMarket | ● | ● | ● | ◐ | ◐ | ◐ | ○ | ● |
| G2G | ● | ● | ● | ◐ | ● | ◐ | ○ | ● |
| Eneba | ● | ● | ● | ◐ | ● | ◐ | ○ | ● |
| GGMAX | ◐ | ◐ | ● | ◐ | ● | ◐ | ○ | ● |
| NeshaStore | ◐ | ◐ | ◐ | ◐ | N/A | 🔒 | ○ | ● |
| Nuuvem | ● | ● | ● | ◐ | N/A | N/A | ○ | ● |
| Steam Market | ● | ● | ● | ◐ | N/A | ◐ | ○ | ◐ |
| Standoff oficial | 🔒 | 🔒 | 🔒 | 🔒 | N/A | N/A | ○ | ◐ |
| Standoff tracker externo | ◐ | ● | ● | N/A | N/A | N/A | ○ | ◐ |

`○` não significa que a função inexiste. Significa apenas que a pesquisa pública não produziu evidência suficiente. Esta distinção é especialmente importante para admin ops.

## 8. Taxas, planos e embalagem comercial

Valores abaixo são fotografia das páginas oficiais na data de coleta. Não são recomendação de taxa e precisam ser revalidados antes de decisão comercial.

| Plataforma | Regra pública observada | Leitura de UX | Limite de comparação |
|---|---|---|---|
| Skinport | [8% padrão, 6% high-tier e 2% private](https://skinport.com/blog/lower-fees-for-everybody) | modalidade/valor alteram taxa | vertical custodial; estrutura de custo diferente |
| CSFloat | home indexada informa 2% venda e 0,5%–2,5% saque por volume | taxa baixa é argumento principal | reconfirmar diretamente antes de usar em business case |
| DMarket | [CS2 tipicamente 2%–10% conforme liquidez; trade 2,5%](https://support.dmarket.com/hc/en-us/articles/25141430592401-DMarket-Fees) | preço do risco/liquidez influencia taxa | regra por item/jogo; não comparar só o mínimo |
| G2G | [sem listing fee; comissão por ranking e categoria](https://support.g2g.com/support/solutions/articles/5000001408-what-is-the-commission-fee-to-sell-at-g2g-marketplace-) | desempenho pode reduzir comissão | tabela mudou em agosto de 2026 e tem exceções/promos |
| GGMAX | [Prata 9,99%, Ouro 11,99%, Diamante 12,99%](https://www.ggmax.com.br/tarifas-e-prazos), com destaque crescente | plano monetiza distribuição | não copiar nomes, percentuais ou hierarquia visual |
| Eneba | comissão do vendor não verificada publicamente nesta coleta | painel e API são parte da proposta B2B | registrar como lacuna, não estimar |
| NeshaStore | margem/taxa não comparável publicamente | modelo de estoque difere do P2P | não inferir comissão de seller |
| Nuuvem | varejo; não há comissão P2P comparável | cashback atua no retorno | não usar como benchmark de take rate |
| Steam Market | fundos permanecem na Steam Wallet | ecossistema fechado reduz cashout | não é comparável a saldo sacável |

### 8.1 Conclusões de packaging para o Midas

- plano pago pode comprar **distribuição**, suporte e ferramentas; não pode comprar verificação, reputação ou decisão favorável em disputa;
- custo total e líquido do vendedor devem aparecer antes de publicar e em cada venda;
- promoção precisa ser rotulada em home, catálogo, PDP e relatório;
- taxa nominal não basta: gateway, chargeback, imposto, suporte, hold, saque, afiliado e cashback precisam entrar no unit economics;
- redução por desempenho só é aceitável com fórmula versionada e contestável;
- “saque prioritário” ordena execução operacional, mas não pula KYC, risco, conciliação ou disponibilidade financeira;
- nenhuma taxa do concorrente valida automaticamente os planos já propostos para o Midas.

## 9. Padrões observados: adotar, transformar e recusar

| Padrão | Decisão | Forma própria Midas |
|---|---|---|
| produto canônico + múltiplas ofertas | **adotar** | catálogo governado, variação e oferta separadas |
| filtros por atributo específico | **adotar** | schema por categoria com origem e unidade |
| líquido a receber antes da venda | **adotar** | breakdown de preço, taxa, hold e saque |
| prazo/método ao lado do seller | **adotar** | bloco operacional acima da descrição |
| compra verificada nas avaliações | **adotar** | elegibilidade por pedido e anti-coerção |
| inventário/biblioteca pós-compra | **adotar** | timeline com entrega, validade e suporte |
| seller storefront | **transformar** | view filtrada do catálogo, sem duplicar produto/SEO |
| nível e badge | **transformar** | separar progressão, confiança e verificação |
| histórico e preço de referência | **transformar** | fonte, timestamp, amostra, moeda e disclaimer |
| cashback/pontos | **transformar** | ledger, expiração visível e regra versionada |
| ranking de listings por performance | **transformar** | explicação, fairness, cold-start e patrocinado separado |
| destaque pago por plano | **transformar** | label claro e limites de concentração |
| descrição livre extensa com upsells | **recusar** | blocos e relações de catálogo moderadas |
| contato pessoal público | **recusar** | chat relay e campanhas consentidas pela plataforma |
| proteção opcional pré-selecionada | **recusar** | proteção base do marketplace e extras neutros |
| contadores, reviews ou vendas inventadas | **recusar** | somente evento real agregado e auditável |
| clone visual/asset/texto de concorrente | **recusar** | design system e conteúdo originais |
| integração Standoff não autorizada | **recusar** | policy gate até autorização expressa |

## 10. Oportunidades de diferenciação

### 10.1 Catálogo governado, não classificados soltos

Problema: marketplaces horizontais deixam o seller explicar tudo em texto, gerando duplicação, SEO fraco, fraude e comparação impossível.

Oportunidade: produto canônico, oferta versionada e atributos por categoria. O seller seleciona o item ou solicita cadastro; o admin resolve duplicidade, direitos e taxonomia antes de publicar.

### 10.2 Confiança explicável

Problema: estrelas, level e selo compactam sinais diferentes em um número que poucos entendem.

Oportunidade: score de reputação pode existir, mas a UI expõe seus componentes, amostra, período e data de atualização. Plano pago, badge de evento e KYC nunca alteram a nota de entrega.

### 10.3 Checkout operacional

Problema: checkouts de varejo escondem a complexidade do P2P; PDPs de classificados empurram essa complexidade para o chat.

Oportunidade: checkout conhece categoria, seller, entrega, hold, evidência e disputa. Campos necessários entram antes do pagamento; instruções sensíveis ficam criptografadas e acessíveis somente ao pedido.

### 10.4 Seller workspace como “próxima ação”

Problema: dashboards focam GMV e gráficos, enquanto pedidos vencem, estoque acaba e saldo fica bloqueado.

Oportunidade: primeira tela ordenada por urgência e impacto: aceitar, entregar, responder, repor, corrigir, contestar e sacar. Métricas ocupam a segunda camada.

### 10.5 Pós-venda nativo e privado

Problema: seller quer fidelizar e tenta mover conversa para WhatsApp, expondo dados e removendo proteção.

Oportunidade: seguir seller, segmentos de recompra, renovação e mensagem omnicanal por relay. O tenant consulta audiência elegível e resultado agregado; telefone continua protegido.

### 10.6 Publisher policy como feature

Problema: marketplaces externos listam jogos mesmo quando publisher proíbe determinadas operações.

Oportunidade: matriz de autorização por publisher, jogo, item, território, canal e operação. Catálogo e checkout avaliam a policy vigente e param cedo, com motivo e revisão agendada.

### 10.7 2D/3D com correspondência comprovável

Problema: visualização rica pode mostrar modelo genérico diferente do item vendido.

Oportunidade: asset 2D/3D tem proveniência, licença, versão e vínculo com variante. Se a correspondência não puder ser provada, a UI rotula “representação ilustrativa” ou não oferece 3D.

### 10.8 Mercado e conteúdo no mesmo grafo

Problema: blog, FAQ, item, campanha e suporte vivem isolados.

Oportunidade: conteúdo se relaciona a jogo, categoria, produto, atributo e etapa. A PDP entrega guia de ativação; pós-venda entrega renovação; suporte transforma causa recorrente em conteúdo versionado.

## 11. Sistema de layout próprio — sem copiar templates

O benchmark define relações e prioridades, não aparência. O Brand Kit e o Design System do Midas continuam sendo a fonte de cor, tipografia, grid, movimento, componente e token.

### 11.1 Princípios

- uma ação primária por bloco;
- preço, risco e entrega nunca separados por scroll excessivo;
- promoção não usa a mesma linguagem visual de verificação;
- informação técnica aparece sob progressive disclosure, mas o essencial fica visível;
- estado usa texto + ícone + cor; cor sozinha não comunica;
- métricas trazem rótulo, janela e definição;
- mobile preserva total, seller, entrega e CTA sticky sem cobrir conteúdo;
- densidade maior no catálogo e admin; respiro maior em onboarding, checkout e disputa;
- motion ajuda mudança de estado, não cria urgência artificial;
- 3D é uma aba do produto, não barreira para comprar nem substituto de acessibilidade.

### 11.2 Componentes semânticos necessários

Os nomes abaixo descrevem responsabilidades; não são IDs de implementação:

- `ProductIdentity`: produto canônico, variante, jogo, plataforma e região;
- `OfferSummary`: seller, preço, estoque, entrega, proteção e CTA;
- `PriceEvidence`: referência, fonte, timestamp, janela e amostra;
- `SellerTrust`: verificações, reputação e métricas operacionais;
- `CompatibilityGate`: plataforma, região, ativação, validade e requisitos;
- `DeliveryPromise`: método, prazo, presença, evidência e próximos passos;
- `MoneyBreakdown`: subtotal, desconto, taxa, crédito, total e líquido;
- `OrderTimeline`: pagamento, confirmação, entrega, aceite, hold, disputa e conclusão;
- `LifecyclePrompt`: ativar, renovar, recomprar, avaliar ou pedir suporte;
- `PolicyGate`: autorização, restrição territorial e razão de bloqueio;
- `OpsQueue`: prioridade, aging, dono, SLA, risco e ação disponível;
- `EvidenceDrawer`: timeline, arquivos, chat, eventos e decisões;
- `ConsentBadge`: finalidade, canal, origem, validade e revogação.

Esses contratos evitam que cada tela invente novamente preço, seller, prazo ou reputação.

## 12. Lacunas e pesquisa futura

### 12.1 Não verificado nesta coleta

- tela interna e permissões do admin de qualquer concorrente;
- seller dashboards autenticados de Skinport, CSFloat, G2G, GGMAX e Nesha;
- checkout pago completo, antifraude, 3DS, Pix e recuperação de falha;
- tratamento real de carrinho multivendedor;
- comportamento mobile e acessibilidade por leitor de tela;
- performance real, Core Web Vitals e funcionamento em rede lenta;
- metodologia completa dos selos e scores de cada plataforma;
- taxa do vendor Eneba;
- política atual de abandono de carrinho de cada concorrente;
- disponibilidade/termos de APIs privadas;
- permissão comercial de assets e dados de jogos para o Midas;
- autorização da Axlebolt para qualquer operação externa relacionada ao Standoff 2.

### 12.2 Como fechar as lacunas legitimamente

1. obter parecer jurídico/comercial por publisher e categoria;
2. solicitar demos oficiais de seller/admin às plataformas que oferecem parceria;
3. conduzir teste de tarefa com contas de pesquisa autorizadas, sem transacionar bem proibido;
4. registrar viewport, idioma, região, data e estado de autenticação;
5. medir passos, erros, compreensão e recuperação, não semelhança visual;
6. entrevistar compradores, sellers e operadores sobre eventos reais;
7. validar acessibilidade e mobile com protótipo próprio do Midas;
8. atualizar este documento quando uma fonte mudar, sem apagar a data anterior.

## 13. Plano de adoção baseado no benchmark

Este plano organiza decisões; não autoriza implementação fora do backlog e das dependências de compliance.

### 13.1 0–30 dias

- fechar matriz de publisher policy e bloquear Standoff 2 externo por padrão;
- confirmar separação `produto canônico > variante > oferta > pedido` no modelo e na nomenclatura;
- reconciliar este benchmark com mapa de telas, PRD, pagamentos, marketing e design system;
- definir campos essenciais por classe de produto e contrato do card/PDP;
- definir reputação explicável e distinção entre verificação, progressão e promoção;
- fechar estados de seller, oferta, pedido, hold, saque, disputa e campanha;
- preparar roteiro autorizado de teste de concorrentes e pesquisa com usuários.

### 13.2 31–90 dias

- validar fluxos próprios de home, catálogo, PDP, checkout unitário, compras e seller inbox;
- validar catálogo canônico e solicitação de novo produto com equipe de operação;
- testar comparação de offers, custo total, compatibilidade e prazo;
- testar admin por filas com casos reais anonimizados e trilha de decisão;
- verificar mobile, teclado, leitor de tela, rede lenta e estados vazios/erro;
- instrumentar eventos de descoberta, oferta, checkout, entrega, disputa e pós-venda sem dados sensíveis.

### 13.3 91–180 dias

- habilitar seller storefront como visão filtrada do catálogo;
- evoluir watchlist, alertas, renovação e cross-sell governado;
- abrir afiliação/cupom somente com atribuição e antifraude fechadas;
- liberar 3D somente para assets licenciados e correspondentes;
- avaliar buy orders apenas para categorias autorizadas e com reserva financeira robusta;
- revisar fairness de ranking e concentração de exposição;
- repetir benchmark com acesso autorizado e registrar mudanças.

## 14. Critérios para aceitar uma referência no produto

Uma ideia observada só pode virar decisão Midas se passar por todos estes filtros:

1. resolve um problema do usuário ou da operação, não apenas “parece premium”;
2. tem evidência suficiente ou hipótese de teste explícita;
3. não depende de asset, texto, marca, segredo comercial ou layout protegido do terceiro;
4. é compatível com publisher, legislação, PSP, privacidade e regras do tenant;
5. funciona com estados reais, inclusive loading, vazio, falha, bloqueio e disputa;
6. preserva transparência de preço, promoção, reputação e atribuição;
7. é acessível em desktop/mobile e não depende de hover ou cor;
8. possui owner, fonte de dado e métrica de resultado;
9. não cria contato fora da plataforma nem exposição de dado pessoal;
10. continua útil sem número, review, urgência ou recomendação inventados.

## 15. Fontes primárias e páginas observadas

### 15.1 Standoff 2

- [Marketplace — central oficial](https://help.standoff2.com/en/collections/3850927-marketplace)
- [Regras do jogo — pt-BR](https://help.standoff2.com/pt-BR/articles/8446575-regras-do-jogo)
- [Compra fora do jogo — pt-BR](https://help.standoff2.com/pt-BR/articles/5324175-posso-comprar-ouro-ou-skins-fora-do-jogo)
- [Venda por dinheiro real — pt-BR](https://help.standoff2.com/pt-BR/articles/5324071-voce-tolera-a-venda-de-gold-contas-e-skins-por-dinheiro-real)
- [Comissão do marketplace oficial](https://help.standoff2.com/en/articles/5408837-do-you-have-any-kind-of-commission-at-marketplace)
- [Standoff-2.com Shop — não oficial](https://standoff-2.com/shop/)
- [PlayerAuctions — categoria Standoff 2, não afiliada](https://www.playerauctions.com/standoff-2-marketplace/)

### 15.2 Skinport e CSFloat

- [Skinport](https://skinport.com/)
- [Skinport — guia de compra e filtros](https://skinport.com/blog/how-to-buy-skins-on-skinport)
- [Skinport — taxas publicadas](https://skinport.com/blog/lower-fees-for-everybody)
- [Skinport Database](https://skinport.com/db)
- [Skinport API — items](https://docs.skinport.com/items)
- [Skinport API — sales history](https://docs.skinport.com/sales/history)
- [CSFloat](https://csfloat.com/)
- [CSFloat — stall público](https://csfloat.com/stall/76561199441169279)
- [CSFloat — support wizard](https://csfloat.com/support/wizard/1/23/66)
- [CSFloat Blog](https://blog.csfloat.com/)

### 15.3 DMarket

- [DMarket — home](https://dmarket.com/)
- [DMarket — catálogo CS2](https://dmarket.com/ingame-items/item-list/csgo-skins)
- [DMarket — taxas](https://support.dmarket.com/hc/en-us/articles/25141430592401-DMarket-Fees)
- [DMarket — colocar item à venda](https://support.dmarket.com/hc/en-us/articles/43418225797521-How-to-put-an-item-on-sale)
- [DMarket — instant sell](https://support.dmarket.com/hc/en-us/articles/43415249131665-Sell-an-item-instantly)
- [DMarket — Target](https://support.dmarket.com/hc/en-us/articles/25235390455825-What-is-target)
- [DMarket — saque](https://support.dmarket.com/hc/en-us/articles/43442787170065-How-to-withdraw-funds-from-DMarket)
- [DMarket — afiliado](https://dmarket.com/affiliate-program)
- [DMarket Trading API](https://docs.dmarket.com/v1/swagger.html)

### 15.4 G2G

- [G2G — home](https://www.g2g.com/)
- [G2G — seller](https://www.g2g.com/seller)
- [G2G — catálogo de items](https://www.g2g.com/categories/minecraft-item)
- [G2G — PDP público](https://www.g2g.com/kr/categories/gray-zone-warfare-items/offer/G1769298806477OA)
- [G2G — como comprar](https://support.g2g.com/support/solutions/articles/5000001390-placing-order)
- [G2G — como vender](https://support.g2g.com/support/solutions/articles/5000001404-how-to-sell-)
- [G2G — ordenação de listings](https://support.g2g.com/support/solutions/articles/5000866146-how-are-the-listings-sorted-)
- [G2G — ratings](https://support.g2g.com/support/solutions/articles/5000880105-managing-user-ratings)
- [G2G — comissão](https://support.g2g.com/support/solutions/articles/5000001408-what-is-the-commission-fee-to-sell-at-g2g-marketplace-)
- [G2G — central do seller](https://support.g2g.com/support/solutions/5000173216)

### 15.5 Eneba

- [Eneba — catálogo](https://www.eneba.com/us/store/games)
- [Eneba — loja pública de vendor](https://www.eneba.com/us/vendor/digital-game-store)
- [Eneba — como comprar](https://www.eneba.com/us/support/article/how-to-buy-on-eneba)
- [Eneba — vender](https://www.eneba.com/us/sell-with-eneba)
- [Eneba — criar oferta](https://www.eneba.com/support/article/how-create-sell-digital-offer)
- [Eneba — gerir ofertas](https://www.eneba.com/us/support/article/how-manage-digital-items)
- [Eneba — cashback](https://www.eneba.com/us/cashback)
- [Eneba — afiliado](https://www.eneba.com/us/become-affiliate)

### 15.6 Brasil e referência adjacente

- [GGMAX — FAQ](https://ggmax.com.br/perguntas-frequentes)
- [GGMAX — tarifas e prazos](https://www.ggmax.com.br/tarifas-e-prazos)
- [GGMAX — termos atuais](https://www.ggmax.com.br/termos-de-uso)
- [GGMAX — reembolso](https://ggmax.com.br/refund-policy)
- [GGMAX — PDP público](https://ggmax.com.br/anuncio/promocao-easter-update-gamepass-blox-fruits-e-frutas-permanente)
- [NeshaStore](https://neshastore.com/)
- [NeshaStore Blog](https://blog.neshastore.com/)
- [Nesha — fluxo histórico New Nesha](https://blog.neshastore.com/new-nesha/)
- [Nuuvem — catálogo](https://www.nuuvem.com/br-pt/catalog)
- [Nuuvem — termos](https://secure.nuuvem.com/br-pt/terms-of-use)
- [Nuuvem — Drops](https://www.nuuvem.com/br-pt/drops)
- [Steam Community Market](https://steamcommunity.com/market/)
- [Steam — busca avançada CS2](https://steamcommunity.com/market/search?appid=730&lock_appid=730)
- [Steam — restrições de trade e market](https://help.steampowered.com/en/faqs/view/451E-96B3-D194-50FC)

## 16. Handoff para os demais documentos

- o inventário detalhado de fontes/assets e a vedação de integração não oficial permanecem no documento de referências;
- a lista definitiva de telas e rotas permanece no mapa de telas;
- estados financeiros, hold, saque, disputa, avaliação e progressão permanecem na especificação financeira/reputacional;
- carrinho abandonado, consentimento, WhatsApp, Instagram e automações permanecem na especificação omnicanal;
- canonical, páginas programáticas, Product/Offer/Review e atribuição permanecem na especificação de SEO;
- cor, tipografia, grid, componentes e movimento permanecem no Brand Kit/Design System;
- a conversão dos padrões em 9 shells, 41 templates e matriz das 95 telas permanece no [sistema de layouts e templates](21-SISTEMA-DE-LAYOUTS-E-TEMPLATES-UI.md);
- este documento decide **quais padrões merecem teste e quais devem ser recusados**, sem substituir essas fontes de verdade.

---

**Síntese final:** o benchmark favorece uma arquitetura em que catálogo, oferta, seller, pedido, dinheiro, reputação e relacionamento são legíveis separadamente. A diferenciação do Midas vem da ligação governada entre essas camadas e da operação brasileira auditável — não de reproduzir o visual, a copy, os assets ou as métricas de qualquer concorrente.
