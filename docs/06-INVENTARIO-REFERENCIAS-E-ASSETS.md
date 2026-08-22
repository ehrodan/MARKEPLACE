# Inventário de referências e ativos

## 1. Finalidade e limite

Este documento registra o que foi observado nas referências e o que pode orientar produto, UX e arquitetura. Ele **não concede licença** e não autoriza copiar marca, textos, CSS, imagens ou base de dados.

Data da coleta: 21 de agosto de 2026.

## 2. Nesha Store — mapa funcional observado

Referência: [https://neshastore.com/](https://neshastore.com/)

O sitemap público retornou 33.266 URLs, majoritariamente páginas de item. As superfícies relevantes auditadas foram:

| Superfície | Padrões observados | Aplicação no Midas |
|---|---|---|
| Início | banner promocional, categorias, ordenação, catálogo denso | busca, categorias e recomendação; sem promoção inventada |
| Produto | imagem dominante, preço, desconto, float, disponibilidade, CTA | anúncio com preço, craft, vendedor, gráfico e proteção |
| Carrinho | resumo, cupom, checkout e condição | pedido unitário no MVP; sem carrinho multivendedor |
| Login/conta | Steam e e-mail; pedidos/inventário | identidade própria, passkey/2FA, compras/vendas |
| Prime | vitrine premium separada | inspiração estrutural para “Compre do Midas” |
| Venda | cotação/fluxo em etapas | wizard de anúncio, mas com moderação e P2P real |
| FAQ | compra, entrega, pagamento e suporte | educação contextual e central de ajuda |
| Privacidade/termos | integrações e regras operacionais | apenas benchmark; documentos Midas serão próprios |
| Antiscam | educação sobre golpe e conta | central de confiança integrada às jornadas |

### Padrões visuais observados

- base quase preta e superfícies azul-carvão;
- acento ciano/teal e sinal amarelo;
- catálogo em cards compactos;
- tipografia condensada em títulos e sans em UI;
- preço, disponibilidade, estado e CTA próximos;
- banners, popup, cookie, prêmio e chat concorrendo por atenção.

### Diagnóstico

**Manter:** densidade, leitura comercial, categorização, detalhe de produto, explicação de confiança.  
**Transformar:** reduzir ruído, separar referência em gold do preço monetário da oferta, distinguir P2P/Midas, tornar estados operacionais explícitos.  
**Recusar:** clone pixel a pixel, ativos, textos, escassez e métricas não verificadas.

## 3. Standoff 2 Shop — mapa funcional observado

Referência: [https://standoff-2.com/shop/](https://standoff-2.com/shop/)

### Aviso de autoridade

O site informa em seu próprio cabeçalho/rodapé que é **não oficial**. Portanto:

- não representa necessariamente o publicador do jogo;
- nenhum endpoint é classificado como “API oficial”;
- disponibilidade pública não significa permissão de reuso;
- integração de produção depende de documentação/licença separada.

Além disso, as [Regras oficiais do Standoff 2](https://help.standoff2.com/pt-BR/articles/8446575-regras-do-jogo), atualizadas em 03/07/2026, proíbem comércio externo por dinheiro real e parsers/clientes de API não oficiais, salvo autorização expressa. A [EULA oficial](https://standoff2.com/en/eula.html) reserva os direitos sobre artwork, conteúdo e bens virtuais, e a [licença do Asset Kit](https://standoff2.com/assets/AXLEBOLT_Assets_license_EN.pages) não foi confirmada para uso comercial do marketplace.

### Interface observada

- seletor com 2.256 nomes;
- filtros por tipo, raridade, categoria e coleção;
- dados descritivos do item;
- preço atual, mínimo, máximo e médio em gold;
- alternância compra/venda;
- períodos 1 hora, 1 dia, 1 mês, 6 meses, ano e todo histórico;
- gráfico Plotly com overview inferior;
- tabela com preço, variações, spread e volatilidade.

### Endpoints observados no JavaScript público

| Endpoint | Uso observado | Status para Midas |
|---|---|---|
| `/skins-new.php?command=getNames` | lista de nomes | somente evidência de benchmark |
| `/skins-new.php?command=getModelInfo` | metadados e URL de imagem | somente pesquisa interna; licença pendente |
| `/skins-new.php?command=getStat&name=…` | série de compra | proibido integrar sem permissão/documentação |
| `/skins-new.php?command=getStatSale&name=…` | série de venda | proibido integrar sem permissão/documentação |

As rotas de estatística retornaram `403` fora do contexto esperado durante a verificação. Esse comportamento reforça que não existe contrato público confiável para o Midas assumir.

## 4. Manifesto dos PNGs observados

Resultado do snapshot de `getModelInfo`:

| Medida | Quantidade |
|---|---:|
| Registros | 1.782 |
| Nomes únicos | 1.777 |
| URLs de imagem | 1.782 |
| URLs únicas | 1.779 |
| Extensão `.png` | 1.782 |
| Coleções preenchidas | 49 |
| Imagens ausentes | 0 |

Tipos observados incluem armas, adesivos, facas, luvas, chaveiros, grafites e contêineres.

### Qualidade e cobertura do manifesto

O manifesto é uma fotografia de uma fonte não oficial, sem contrato de esquema, garantia de completude ou identificador canônico. A lista de nomes e o snapshot de metadados não fecham entre si:

| Verificação | Resultado observado | Consequência |
|---|---|---|
| Lista de nomes vs. metadados | 2.256 nomes no seletor e 1.782 registros em `getModelInfo` | diferença bruta de 474; não pode ser interpretada automaticamente como 474 itens ausentes, porque há duplicidade e normalização desconhecida |
| Completude de campos | `type`: 512 vazios; `subtype`: 783; `rarity`: 784; `category`: 1.778 | filtros, validação de craft e taxonomia ficariam incompletos |
| Duplicatas exatas | 2 linhas exatamente duplicadas | contagem, importação e deduplicação por linha não são confiáveis |
| Colisões de nome | 1.782 registros, mas 1.777 nomes únicos | nome não serve como chave primária; o mesmo rótulo pode representar linhas diferentes |
| Colisões de URL | 1.782 URLs, mas 1.779 URLs únicas | URL de imagem não identifica item e pode ser compartilhada/repetida |
| Colisões de raridade | foram observados nomes/linhas com classificações de raridade conflitantes ou ambíguas | não escolher uma raridade “vencedora” sem fonte autoritativa e regra de reconciliação |
| Identificador estável | nenhum ID oficial, imutável e documentado foi fornecido | impossível garantir upsert, histórico, referência de preço ou migração segura |

Essas anomalias não devem ser “corrigidas” por inferência silenciosa. Uma futura fonte autorizada deverá fornecer ID estável, versão/esquema, constraints, relação entre variantes, política de tombstone/merge e mecanismo de correção. Até lá, qualquer comparação serve apenas para auditoria da pesquisa.

### Política de extração

O projeto gera um **CSV de URLs e metadados**, sem baixar ou republicar os binários. Seu status obrigatório é `PESQUISA_INTERNA_NAO_AUTORITATIVA`: ele **nunca será semente de catálogo**, migration, fixture de staging/produção, fonte de SKU, preço, craft, busca pública ou publicação de asset. Cada linha recebe:

- nome;
- tipo/subtipo;
- raridade;
- categoria/coleção;
- URL de origem;
- extensão;
- host;
- estado de direitos `PENDENTE_DE_LICENCA`;
- data de observação.

Download, transformação, ingestão no catálogo e publicação ficam bloqueados até existir autorização comercial escrita da Axlebolt e uma fonte autoritativa com ID estável. O [Asset Kit oficial](https://standoff2.com/assets/) não substitui essa autorização; suas permissões precisam ser lidas no contexto da licença incluída. Quando autorizados, o pipeline deverá registrar hash SHA-256, autor/origem, licença, data, dimensões, revisão e derivados. A autorização futura não transforma retroativamente este CSV em fonte confiável: o catálogo deve nascer de nova ingestão autorizada e validada.

## 5. Contrato necessário para uma fonte de preço

O adaptador Midas só aceita uma fonte que ofereça:

1. documentação pública ou contrato;
2. direito de armazenar e exibir preço/histórico;
3. identificação estável de item;
4. limites e política de cache;
5. timestamp de observação;
6. semântica de compra/venda e moeda gold;
7. política de correção e indisponibilidade;
8. SLA ou expectativa de cadência;
9. termos de atribuição;
10. canal de suporte e mudança de versão.

Sem isso, o produto opera com importação administrativa identificada como manual, nunca como “tempo real”.

## 6. Modelo de proveniência de ativo

```text
CatalogAsset
  id
  catalogItemId
  sourceType = OFFICIAL | LICENSED | USER_SUPPLIED | INTERNAL
  sourceUrl
  licenseId
  authorizationEvidence
  author
  observedAt
  importedAt
  sha256
  mimeType
  width / height
  status = QUARANTINED | APPROVED | BLOCKED | EXPIRED
  parentAssetId
  transformationRecipe
```

Nenhum ativo em `QUARANTINED`, `BLOCKED` ou `EXPIRED` pode aparecer no catálogo público.

## 7. Registro clean-room

| Elemento da referência | Regra abstrata aprendida | Reexpressão Midas |
|---|---|---|
| Catálogo escuro e denso | comparação rápida pede alta densidade | charcoal aquecido, grid adaptativo e menos ruído |
| Categoria perto do catálogo | reduzir custo de navegação | busca dominante + filtros persistentes |
| Preço/estado no card | decisão antes do clique | oferta real + gold separado + `asOf` |
| Página de detalhe em duas zonas | imagem e decisão simultâneas | mídia/craft à esquerda, transação à direita |
| Gráfico e métricas | preço precisa de contexto temporal | série licenciada + frescor + modo degradado |
| Vitrine premium separada | origem da oferta importa | canal “Compre do Midas” inequivocamente rotulado |

## 8. Conclusão do inventário

Há material suficiente para definir taxonomia, experiências, componentes e contrato de integração. Há, porém, evidência oficial de que a operação é proibida sem permissão expressa. Os PNGs, endpoints e o CSV observados **não podem** ser tratados como base, semente ou fallback de produção. O estado permanece **NO-GO**. O próximo passo externo obrigatório é obter autorização escrita da Axlebolt e fonte autoritativa com ID estável; até lá, usar apenas dados sintéticos e arte própria.
