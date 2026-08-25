/**
 * Copy deck comercial do OCHPOCH MARKET.
 *
 * Fonte da voz: `apps/web/lib/brand.ts`, `apps/web/app/page.tsx`,
 * `docs/03-DIRECAO-DE-ARTE.md` (secao 7, vocabulario canonico),
 * `docs/18-BRAND-KIT-DESIGN-SYSTEM.md` (secao 3, sistema verbal) e
 * `docs/01-PRD-MIDAS.md` (secao 8, principios de produto).
 *
 * Regras que este arquivo cumpre e que `copy-deck.test.ts` verifica:
 * - sem escassez fabricada, contagem regressiva ou urgencia inventada;
 * - sem metrica, prazo, percentual ou volume que a interface nao comprove;
 * - sem prova social inventada;
 * - todo texto permanece verdadeiro com os gates G0-G3 fechados: o provedor
 *   de pagamento ainda nao esta conectado, entao nada aqui promete cobranca,
 *   liberacao ou entrega automatica.
 *
 * Persuasao permitida: clareza, especificidade, reducao de risco percebido
 * (custodia no PSP, confirmacao dupla, disputa), ancoragem em fato
 * verificavel, contraste e regra de tres.
 */

export type Block = {
  readonly kicker: string;
  readonly headline: string;
  readonly subhead: string;
  readonly body: string;
  readonly cta?: string;
  readonly microcopy?: string;
};

export type BlockGroup = {
  readonly [key: string]: Block | BlockGroup;
};

export type CopyBlockEntry = {
  readonly path: string;
  readonly block: Block;
};

function deepFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
}

function frozen<T>(value: T): T {
  deepFreeze(value);
  return value;
}

function isBlock(value: Block | BlockGroup): value is Block {
  return typeof (value as { headline?: unknown }).headline === "string";
}

/** Percorre a arvore e devolve cada bloco com o caminho por extenso. */
export function copyBlocks(root: BlockGroup, prefix = ""): readonly CopyBlockEntry[] {
  const entries: CopyBlockEntry[] = [];
  for (const [key, node] of Object.entries(root)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isBlock(node)) entries.push({ path, block: node });
    else entries.push(...copyBlocks(node, path));
  }
  return entries;
}

export const COPY = frozen({
  landing: {
    hero: {
      kicker: "OCHPOCH MARKETPLACE DIGITAL",
      headline: "Encontre o item. Confira cada detalhe.",
      subhead: "Anúncios publicados, contexto real e a decisão antes do pagamento.",
      body: "Cada oferta mostra item, vendedor e estado atual. O que a plataforma ainda não confirmou não aparece como concluído.",
      cta: "Explorar itens",
      microcopy: "Ver o catálogo público não exige conta.",
    },
    proof: {
      intro: {
        kicker: "UMA EXPERIÊNCIA, SEM ADIVINHAÇÃO",
        headline: "Clareza antes do clique. Continuidade depois dele.",
        subhead: "Três perguntas que a interface responde sozinha.",
        body: "O design separa promessa comercial de estado operacional. O que ainda não aconteceu não aparece como concluído.",
        microcopy: "Origem, estado e próximo passo — nesta ordem.",
      },
      origin: {
        kicker: "01 · ORIGEM",
        headline: "Você sabe de onde veio.",
        subhead: "Item, vendedor e contexto permanecem ligados à mesma decisão.",
        body: "Nenhuma ausência é preenchida com dado inventado. Quando a origem não está confirmada, a tela diz isso em vez de estimar.",
      },
      state: {
        kicker: "02 · ESTADO",
        headline: "Você sabe onde está.",
        subhead: "Pagamento, entrega, retenção e saque são estados distintos.",
        body: "Cada um é escrito por extenso e confirmado pelo servidor, nunca deduzido pela interface a partir do tempo que passou.",
      },
      nextStep: {
        kicker: "03 · PRÓXIMO PASSO",
        headline: "Você sabe o que fazer.",
        subhead: "A interface apresenta somente ações autorizadas.",
        body: "Quando existe bloqueio, ele vem com motivo permitido e caminho de recuperação, não com uma tela sem saída.",
      },
    },
    viewerInvite: {
      kicker: "OBJETO DIGITAL, NÃO ENFEITE",
      headline: "Veja de perto. Gire por conta própria.",
      subhead: "A inspeção usa o modelo fornecido ao projeto, não uma reconstrução inferida.",
      body: "Você controla o ângulo, escolhe vistas e amplia para tela cheia. Onde existe apenas imagem, a tela chama de imagem.",
      cta: "Abrir experiência 3D",
      microcopy: "Sem WebGL ou com movimento reduzido, a mesma peça aparece em 2D.",
    },
    finalCta: {
      kicker: "ESCOLHA COM CONTEXTO",
      headline: "O próximo item começa na busca certa.",
      subhead: "Veja somente anúncios publicados e abra cada oferta antes de decidir.",
      body: "Comparar preço, plano e vendedor custa menos atenção do que desfazer uma compra errada.",
      cta: "Ver marketplace",
      microcopy: "O provedor de pagamento ainda não está conectado nesta versão: nenhuma cobrança é processada.",
    },
  },

  market: {
    header: {
      kicker: "CATÁLOGO PÚBLICO",
      headline: "Itens digitais, ofertas reais.",
      subhead: "Compare preço, disponibilidade, plano e vendedor.",
      body: "A lista mostra apenas anúncios publicados no catálogo canônico. Filtro e ordenação agem sobre os registros já retornados pela API, não sobre uma amostra montada pela tela.",
      cta: "Abrir anúncio",
      microcopy: "Anúncio com prioridade paga aparece rotulado como Destaque, com explicação de ordenação.",
    },
    loading: {
      kicker: "CARREGANDO",
      headline: "Consultando o catálogo.",
      subhead: "Preço e disponibilidade aparecem apenas depois da leitura confirmada.",
      body: "Nenhum campo é preenchido com valor provisório enquanto a resposta não chega.",
      microcopy: "Aguardando resposta da API.",
    },
    empty: {
      kicker: "SEM ANÚNCIO",
      headline: "Nenhum anúncio publicado.",
      subhead: "A API respondeu sem ofertas publicadas neste corte.",
      body: "Esta tela não preenche o catálogo com produtos fictícios. Assim que existir anúncio aprovado, ele aparece aqui.",
      cta: "Voltar ao início",
    },
    error: {
      kicker: "FALHA DE LEITURA",
      headline: "Não foi possível carregar o catálogo.",
      subhead: "A fonte canônica não respondeu.",
      body: "Preço e disponibilidade permanecem ocultos até uma leitura válida. Nenhum anúncio demonstrativo foi colocado no lugar dos dados reais.",
      cta: "Tentar novamente",
      microcopy: "Use a referência exibida ao falar com o suporte.",
    },
  },

  search: {
    /** `microcopy` carrega o texto do placeholder do campo de busca. */
    field: {
      kicker: "BUSCA",
      headline: "Procure pelo item, não pelo palpite.",
      subhead: "A busca percorre anúncios publicados e mantém filtros e ordenação visíveis.",
      body: "O resultado anuncia a contagem a cada consulta, e a ordenação escolhida por você não é substituída por prioridade comercial.",
      cta: "Buscar",
      microcopy: "Buscar item, categoria ou vendedor",
    },
    noResults: {
      kicker: "SEM CORRESPONDÊNCIA",
      headline: "Nada corresponde a esta busca.",
      subhead: "Nenhum anúncio publicado atende aos termos e filtros atuais.",
      body: "O conjunto carregado permanece intacto: a tela não ampliou o resultado por conta própria nem trouxe item fora do critério pedido.",
      microcopy: "A contagem é anunciada sempre que o resultado muda.",
    },
    recovery: {
      kicker: "COMO RECUPERAR",
      headline: "Retire um critério por vez.",
      subhead: "Comece pelo filtro mais restritivo, antes de reescrever o termo.",
      body: "O nome canônico do item costuma alcançar mais anúncios do que a descrição inteira. Categoria e faixa de preço podem ser reaplicadas depois, sem perder a busca.",
      cta: "Ver catálogo completo",
    },
  },

  listing: {
    trust: {
      kicker: "ANTES DE PAGAR",
      headline: "O que esta página deixa conferir.",
      subhead: "Preço, plano, vendedor e estado do anúncio, lado a lado.",
      body: "O valor da oferta aparece em moeda fiduciária; a referência em gold aparece como informação separada. Gold é referência de mercado, nunca meio de pagamento do checkout.",
      microcopy: "O contato acontece pela plataforma: negociar fora dela remove a proteção da compra.",
    },
    provenance: {
      kicker: "PROCEDÊNCIA",
      headline: "De onde vêm a imagem e a ficha.",
      subhead: "Item canônico, mídia aprovada e vendedor identificado.",
      body: "Modelo 3D aprovado, prévia 3D e imagem 2D recebem rótulos diferentes. Uma vista única nunca é apresentada como reconstrução exata do item.",
      microcopy: "Sem mídia aprovada, o anúncio mostra a ficha do item canônico em vez de arte genérica.",
    },
    nextStep: {
      kicker: "PRÓXIMA AÇÃO",
      headline: "Adicione ao carrinho e revise o grupo.",
      subhead: "O carrinho separa os itens por vendedor antes de virar pedido.",
      body: "Carrinho, grupo de checkout e pedido são etapas distintas. Adicionar não cobra nem reserva, e o preço é revalidado no servidor antes de qualquer confirmação.",
      cta: "Adicionar ao carrinho",
    },
  },

  cart: {
    header: {
      kicker: "CARRINHO",
      headline: "Revise antes de fechar.",
      subhead: "Itens reunidos e agrupados por vendedor.",
      body: "O carrinho guarda intenção, não reserva. Quantidade, preço e disponibilidade são conferidos de novo no servidor quando você avança.",
      cta: "Ir para o checkout",
    },
    sellerGroups: {
      kicker: "GRUPO DE CHECKOUT",
      headline: "Um grupo para cada vendedor.",
      subhead: "Cada vendedor gera um pedido próprio.",
      body: "Entrega, retenção, reembolso e disputa acompanham o pedido do vendedor correspondente. Por isso os grupos não se fundem em uma responsabilidade única.",
      microcopy: "Remover um item afeta somente o grupo dele.",
    },
    empty: {
      kicker: "CARRINHO VAZIO",
      headline: "Nenhum item reunido ainda.",
      subhead: "O que você adicionar aparece aqui, já agrupado por vendedor.",
      body: "Itens permanecem enquanto o anúncio continuar publicado. Se a oferta sair do ar, o item é marcado como indisponível em vez de desaparecer sem aviso.",
      cta: "Ver marketplace",
    },
    priceRevalidation: {
      kicker: "PREÇO REVALIDADO",
      headline: "O valor é conferido de novo antes do pedido.",
      subhead: "O servidor compara o preço do carrinho com o preço vigente do anúncio.",
      body: "Havendo diferença, a mudança é mostrada por item, com valor anterior e valor atual, e você decide se continua. Nenhuma alteração é aplicada em silêncio.",
      microcopy: "Divergência interrompe o avanço até a sua confirmação.",
    },
  },

  purchases: {
    header: {
      kicker: "MINHAS COMPRAS",
      headline: "Seus pedidos, com o estado por extenso.",
      subhead: "Pagamento, entrega, reembolso e disputa aparecem separados.",
      body: "A linha do tempo de cada pedido é reconstruída de eventos reais. A tela não presume preparação, envio ou entrega sem evento registrado.",
      cta: "Abrir pedido",
    },
    filters: {
      kicker: "FILTROS",
      headline: "Encontre o pedido pelo que aconteceu com ele.",
      subhead: "Período, pedido, pagamento, entrega, reembolso e disputa.",
      body: "Os filtros restringem a lista já autorizada para a sua conta. Combinar critérios nunca revela pedido de terceiro nem amplia o que você pode ver.",
      microcopy: "A contagem é anunciada quando o resultado muda.",
    },
    empty: {
      all: {
        kicker: "NENHUM PEDIDO",
        headline: "Você ainda não tem pedidos.",
        subhead: "Compras feitas com esta conta aparecem aqui.",
        body: "Cada pedido traz o vendedor, o estado atual e apenas as ações liberadas naquele momento.",
        cta: "Ver marketplace",
      },
      awaitingPayment: {
        kicker: "AGUARDANDO PAGAMENTO",
        headline: "Nenhum pedido aguardando pagamento.",
        subhead: "Pedidos com cobrança pendente ficariam listados aqui.",
        body: "O estado só muda quando o provedor de pagamento confirma a operação. A interface não antecipa essa confirmação.",
      },
      inDelivery: {
        kicker: "EM ENTREGA",
        headline: "Nenhum pedido em entrega.",
        subhead: "Pedidos pagos e ainda não concluídos apareceriam aqui.",
        body: "A conclusão depende da confirmação do comprador e do vendedor. Prazo decorrido, sozinho, não conclui pedido.",
      },
      inDispute: {
        kicker: "EM DISPUTA",
        headline: "Nenhum pedido em disputa.",
        subhead: "Disputas abertas por você ou pelo vendedor apareceriam aqui.",
        body: "Abrir disputa congela o fluxo financeiro do pedido até a decisão, com janela de evidência para as duas partes.",
        cta: "Como funciona a disputa",
      },
      completed: {
        kicker: "CONCLUÍDOS",
        headline: "Nenhum pedido concluído.",
        subhead: "Pedidos confirmados pelas duas partes e sem disputa bloqueante apareceriam aqui.",
        body: "Depois de concluído, o pedido continua acessível para avaliação, suporte e histórico.",
      },
    },
  },

  sellerPublic: {
    header: {
      kicker: "PERFIL DO VENDEDOR",
      headline: "Reputação com cobertura declarada.",
      subhead: "Média, distribuição, quantidade elegível e janela, juntas.",
      body: "Média sem volume não recebe selo de alta confiança. Sem amostra suficiente, a tela informa dados insuficientes em vez de exibir uma nota solta.",
      microcopy: "Reputação como comprador e como vendedor são resumos separados.",
    },
    noListings: {
      kicker: "SEM ANÚNCIO PUBLICADO",
      headline: "Este vendedor não tem anúncio publicado agora.",
      subhead: "Rascunho e anúncio em revisão não aparecem no perfil público.",
      body: "O histórico de reputação continua visível: a ausência de anúncio não apaga nem esconde avaliações já registradas.",
      cta: "Ver marketplace",
    },
  },

  rewards: {
    header: {
      kicker: "RECOMPENSAS",
      headline: "O que o seu nível libera.",
      subhead: "Recompensa publicada, com critério, validade e termos visíveis.",
      body: "Cada recompensa vem de uma definição versionada. Slot sem concessão fica vazio: a tela não exibe insígnia inventada para preencher espaço.",
      cta: "Ver conquistas",
    },
    level: {
      kicker: "NÍVEL DA CONTA",
      headline: "Nível é histórico medido, não status comprado.",
      subhead: "A contribuição vem de vendas concluídas e já fora da retenção.",
      body: "Pedido cancelado, reembolsado ou com disputa procedente não contribui. Reembolso posterior pode reduzir o nível corrente, e a mudança fica registrada com a data de referência.",
      microcopy: "As faixas de cada nível são públicas e versionadas.",
    },
  },

  ranking: {
    header: {
      kicker: "RANKING MENSAL",
      headline: "Posição derivada de pedido, não de audiência.",
      subhead: "Cada contribuição é rastreável até o pedido que a gerou.",
      body: "Venda para si mesmo, contas relacionadas, reembolso, chargeback e pedidos ainda em retenção ficam fora do cálculo. Suspeita de abuso congela a premiação com motivo e direito a recurso, em vez de apagar pontos por edição direta.",
      cta: "Ver ranking",
    },
    season: {
      kicker: "TEMPORADA",
      headline: "A temporada fecha com a regra que abriu.",
      subhead: "Início, fim, fuso, moeda base e fórmula ficam congelados na abertura.",
      body: "Venda com plano comercial de maior prioridade acrescenta pontos além da base, e a interface mostra essa consequência. Mudar o multiplicador exige nova versão publicada, nunca ajuste silencioso durante a temporada.",
      microcopy: "Encerrada a temporada, posições, contribuições e desempate ficam congelados e auditáveis.",
    },
  },

  trust: {
    custody: {
      kicker: "CUSTÓDIA",
      headline: "O valor não fica com a plataforma.",
      subhead: "O fluxo é administrado pelo provedor de pagamento homologado.",
      body: "A plataforma não mantém custódia financeira própria nem armazena dados de cartão. O saldo de vendas permanece em retenção no PSP, com início, previsão de liberação e motivo de qualquer pausa visíveis para o vendedor.",
      microcopy: "Nesta versão o provedor ainda não está conectado: nenhuma cobrança é processada.",
    },
    dualConfirmation: {
      kicker: "CONFIRMAÇÃO DUPLA",
      headline: "Pedido concluído exige as duas partes.",
      subhead: "O vendedor confirma a entrega; o comprador confirma o recebimento.",
      body: "Enquanto uma confirmação faltar, o pedido permanece em andamento e o valor segue retido. Tempo decorrido não conclui pedido nem substitui confirmação.",
      cta: "Confirmar recebimento",
    },
    dispute: {
      kicker: "DISPUTA",
      headline: "Divergência tem caminho, janela e decisão registrada.",
      subhead: "Abrir disputa congela o fluxo financeiro do pedido.",
      body: "As duas partes recebem janela de evidência e lembretes; a ausência de uma delas é tratada de forma explícita, e nenhum prazo presume que houve entrega. A decisão fica auditada e admite recurso.",
      cta: "Abrir disputa",
      microcopy: "Solicitação de reembolso e disputa são registros distintos e podem coexistir no mesmo pedido.",
    },
  },
} as const) satisfies BlockGroup;

export type AwarenessLevel =
  | "unaware"
  | "problemAware"
  | "solutionAware"
  | "productAware"
  | "mostAware";

/**
 * Matriz de consciencia (Eugene Schwartz) aplicada a abertura da landing.
 *
 * NIVEL EM USO HOJE: `solutionAware`. A H1 vigente, "Encontre o item.
 * Confira cada detalhe.", nao explica o que e um marketplace (necessario em
 * `unaware`/`problemAware`) e tambem nao lidera pelo mecanismo proprio (o que
 * caracterizaria `productAware`). Ela assume um leitor que ja decidiu comprar
 * item digital por marketplace e esta escolhendo QUAL, e responde a essa
 * escolha com criterio verificavel: anuncio publicado, contexto real e decisao
 * antes do pagamento.
 *
 * Por que este nivel: sem aquisicao paga ligada e com os gates G0-G3 fechados,
 * o trafego previsivel e de quem ja busca a categoria. Falar com o `unaware`
 * gastaria a dobra da pagina ensinando o obvio; falar com o `productAware`
 * exigiria provar em tela um mecanismo de pagamento que ainda nao opera.
 *
 * Cada variante abaixo e material de trabalho: so entra em producao quando a
 * evidencia que ela exige existir na tela.
 */
export const AWARENESS = frozen({
  unaware: {
    kicker: "INCONSCIENTE",
    headline: "Todo item digital passa de mão. Poucos passam com registro.",
    subhead: "Combinado por mensagem, confirmado de memória, resolvido no grito.",
    body: "Leitor que negocia por chat e ainda não chama isso de problema. A abertura nomeia a cena antes de nomear a categoria, e nenhuma prova de produto entra aqui.",
    microcopy: "Uso: conteúdo editorial e topo de funil, nunca como H1 de página de conversão.",
  },
  problemAware: {
    kicker: "CONSCIENTE DO PROBLEMA",
    headline: "Você pagou. E agora depende da palavra do outro.",
    subhead: "Sem registro do que foi combinado, quem decide é quem fala mais alto.",
    body: "Leitor que já perdeu item, dinheiro ou tempo em negociação por chat. A abertura descreve o risco com o vocabulário dele e só então apresenta a categoria.",
    microcopy: "Uso: página de ajuda sobre negociação segura e retorno de campanha de suporte.",
  },
  solutionAware: {
    kicker: "CONSCIENTE DA SOLUÇÃO",
    headline: "Encontre o item. Confira cada detalhe.",
    subhead: "Anúncios publicados, contexto real e a decisão antes do pagamento.",
    body: "Leitor que já escolheu comprar por marketplace e está decidindo qual. A abertura não explica a categoria: entrega o critério de escolha.",
    microcopy: "Nível em uso na landing atual, espelhado em COPY.landing.hero.",
  },
  productAware: {
    kicker: "CONSCIENTE DO PRODUTO",
    headline: "Custódia no provedor, confirmação das duas partes, disputa com decisão registrada.",
    subhead: "O mecanismo que separa promessa comercial de estado operacional.",
    body: "Leitor que já conhece o OCHPOCH e compara com alternativas. A abertura lidera pelo mecanismo verificável e liga direto na tira de confiança.",
    microcopy: "Uso: comparativo e páginas de política. Depende dos gates de pagamento abertos.",
  },
  mostAware: {
    kicker: "TOTALMENTE CONSCIENTE",
    headline: "Seu carrinho continua agrupado por vendedor.",
    subhead: "Retome de onde parou e revise o grupo antes de fechar.",
    body: "Leitor decidido, com conta e intenção já registrada. A abertura apenas remove atrito: mostra o estado atual e oferece a próxima ação, sem reargumentar valor.",
    microcopy: "Uso: retorno autenticado e lembrete de carrinho com itens ainda válidos, remetente identificado e opt-out.",
  },
} as const) satisfies Readonly<Record<AwarenessLevel, Block>>;
