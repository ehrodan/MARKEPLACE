# Direção de arte — Midas Foundry

## 1. Conceito

**Midas Foundry** é a direção de arte proposta: uma oficina noturna de comércio digital. O ouro não é luxo ornamental; é o sinal de valor validado. O carvão representa a infraestrutura e a cautela. A interface deve parecer precisa sob pressão, não um cassino de skins.

Vibe: **forja noturna, ouro, precisão, confiança**.

### DNA transportado em clean room

Da Nesha Store, transportamos apenas princípios:

- densidade de catálogo;
- leitura rápida de preço e disponibilidade;
- categorias visíveis e filtros persistentes;
- produto como centro visual;
- contexto de pagamento/entrega perto do CTA;
- confiança como parte da jornada.

Do painel de preços observado, transportamos:

- leitura temporal;
- alternância de período;
- preço atual, mínimo, máximo e média;
- separação entre compra e venda quando a fonte suportar;
- tabela comparativa com variação, spread e volatilidade.

Não transportamos marcas, paletas exatas, layouts pixel a pixel, ilustrações, imagens, textos ou código.

## 2. Princípios visuais

1. **Valor tem uma cor; estado tem uma forma.** Ouro identifica ação/valor. Erro, sucesso e risco usam ícone + texto + cor.
2. **Densidade sem aperto.** Cards compactos, mas controles com alvo mínimo de 44 px e respiro consistente.
3. **Gold não é real.** Preço em gold e preço fiduciário nunca compartilham o mesmo tratamento.
4. **Origem e frescor são visíveis.** Toda cotação mostra fonte, horário e estado `atual`, `desatualizado` ou `indisponível`.
5. **Persuasão honesta.** Sem cronômetro, estoque baixo, desconto ou popularidade inventados.
6. **O produto domina; o cromado recua.** Imagem, nome, craft, preço e segurança vencem a decoração.
7. **Midas e P2P são parentes, não gêmeos.** Mesmo sistema, identificação de canal inequívoca.

## 3. Sistema cromático proposto

Tokens canônicos em OKLCH:

```css
:root {
  --color-paper:       oklch(13% 0.012 75);
  --color-paper-2:     oklch(17% 0.014 75);
  --color-paper-3:     oklch(22% 0.016 75);
  --color-ink:         oklch(94% 0.012 85);
  --color-ink-2:       oklch(78% 0.012 80);
  --color-muted:       oklch(66% 0.012 75);
  --color-rule:        oklch(31% 0.016 75);
  --color-rule-2:      oklch(26% 0.014 75);
  --color-accent:      oklch(78% 0.160 80);
  --color-accent-ink:  oklch(18% 0.018 75);
  --color-focus:       oklch(84% 0.190 80);
  --color-danger:      oklch(65% 0.190 28);
  --color-success:     oklch(72% 0.130 150);
  --color-info:        oklch(74% 0.120 225);
}
```

- Ouro ocupa no máximo ~3–5% de uma tela: CTA, foco, valor-chave, estado ativo.
- Verde, vermelho e ciano são **semânticos**, não decorativos.
- Sem preto ou branco puros; superfícies são levemente aquecidas.
- Gráficos usam ouro para a série principal, ciano apenas para comparação autorizada e padrões/ícones para não depender de cor.

## 4. Tipografia

### Família

- **Display:** Big Shoulders Display, 700/800 — industrial, condensada, usada em títulos curtos.
- **Corpo/UI:** IBM Plex Sans, 400/700 — leitura, formulários, tabelas e operação.
- **Dados/mono:** IBM Plex Mono, 400/600 — IDs, preços, timestamps e código técnico.

Todas são gratuitas. Nenhum título usa itálico. Máximo de três famílias.

### Escala

Razão de 1,25, corpo de 16 px, medida de leitura entre 45–75 ch. Dados numéricos usam `tabular-nums`. Títulos longos caem um nível antes de quebrar a composição. Rótulos podem usar caixa alta curta com tracking controlado; parágrafos nunca.

## 5. Estrutura das superfícies

### Navegação pública

Desktop: cabeçalho compacto com busca como ação dominante; acesso direto a `Market`, `Compre do Midas`, `Vender`, `Mensagens` e `Conta`.

Mobile: barra inferior para Início, Market, Midas, Mensagens e Conta; “Vender” aparece como ação contextual na Conta e no cabeçalho do Market.

### Início

- busca acima da dobra;
- entrada separada para P2P e Midas;
- categorias por arma/tipo;
- recomendações com explicação;
- vistos recentemente;
- educação curta: aprovação, pagamento, entrega e hold.

Não usar carrossel automático. Se houver faixa editorial, avanço é manual e pausável.

### Catálogo e cards

O card contém apenas o que decide clique:

- imagem licenciada;
- nome e variante;
- canal `P2P` ou `Midas`;
- preço da oferta;
- referência em gold com `asOf`;
- badge de craft e contagem de adesivos;
- reputação/estado do vendedor quando aplicável;
- disponibilidade real.

Sem card dentro de card, borda lateral colorida ou sombra brilhante. Elevação em dark mode é feita por aumento de luminosidade.

### Página do anúncio

Desktop em duas zonas assimétricas:

- esquerda maior: imagem, craft posicionado e detalhes;
- direita: preço, vendedor, estado, proposta e compra;
- abaixo: gráfico, componentes em gold, condições de entrega, chat e ofertas semelhantes.

No mobile, preço e CTA formam uma barra inferior fixa que não encobre conteúdo; o gráfico vira área rolável por período sem tabela de dez colunas.

### Wizard de anúncio

Fluxo vertical por etapas:

1. Tipo do produto.
2. Item-base do catálogo.
3. Craft (`não` ou `sim`), exibido somente quando o item-base tiver `craftEligible=true` na versão autorizada do catálogo.
4. Quatro posições de adesivo, somente se `sim`.
5. Preço, descrição e entrega.
6. Prévia e envio para revisão.

Ao trocar craft para `não`, explicar que os slots serão limpos. Salvar rascunho. Erros apontam campo, motivo e correção.

### Admin/Master

Workbench denso e sóbrio, com navegação lateral por domínio. Tabelas viram listas orientadas a ação no mobile. Toda decisão sensível exibe escopo, objeto, efeito e exigência de step-up antes da confirmação.

## 6. Componentes que constroem confiança

- **Price provenance:** valor + fonte + `observedAt` + frescor.
- **Seller capsule:** nome público, reputação verificável, histórico e status.
- **Approval trace:** data, estado e motivo de moderação sem expor staff.
- **Craft rail:** quatro posições fixas, sticker, preço gold e vazio explícito.
- **Delivery timeline:** pago → sala aberta → vendedor confirmou → comprador confirmou → hold → saldo disponível no fluxo do PSP.
- **Hold clock:** data prevista, pausas e motivo; nunca apenas um contador.
- **Moderation notice:** mensagem bloqueada, regra, strike e via de contestação.
- **Secure reveal:** step-up, aviso `no-store`, revelação auditada e expiração.
- **Feed stale state:** último valor rotulado; ausência nunca vira zero.
- **Price table:** toda série gráfica possui alternativa tabular com data/hora, valor, mínimo, máximo, média, origem e frescor; leitura não depende de cor, hover ou visão.

## 7. Conteúdo e microcopy

### Vocabulário canônico

- `Entrar`, não alternar com “Login”.
- `Criar anúncio`, não “Cadastrar produto”.
- `Enviar para revisão`, não “Submit”.
- `Preço da oferta` e `Referência em gold`.
- `Saldo de vendas em retenção no PSP`, não “carteira” ou “dinheiro preso”.
- `Abrir disputa`, `Confirmar entrega`, `Confirmar recebimento`.
- `Compre do Midas` sempre por extenso em títulos.

### Erro de PII

Primeira tentativa:

> Esta mensagem não foi enviada porque contém informação de contato. Negocie aqui para manter a proteção da compra. Esta é sua primeira ocorrência.

Segunda:

> Esta mensagem não foi enviada. Uma nova tentativa de compartilhar contato restringirá sua conta e abrirá revisão da staff.

Terceira:

> Sua conta foi restringida para revisão. Você ainda pode acessar esta tela e enviar um recurso à staff.

### Estados vazios

Todo vazio contém: o que está vazio, por que importa e uma ação. Exemplo: “Nenhum anúncio enviado. Seus rascunhos e revisões aparecerão aqui. Criar anúncio.”

## 8. Motion e interação

Movimento só comunica mudança:

- 120 ms para press/toggle;
- 180–220 ms para hover e menu;
- 250–300 ms para modal e troca de conteúdo;
- sem `transition-all`, bounce, parallax ou fade em cada seção;
- foco aparece instantaneamente;
- resultados de busca usam debounce e anunciam contagem;
- sucesso visível é silencioso; erro oferece recuperação;
- `prefers-reduced-motion` reduz movimento espacial a crossfade de até 150 ms.

## 9. Acessibilidade e responsividade

- Meta WCAG 2.2 AA.
- Contraste mínimo 4,5:1 para texto e 3:1 para componentes/ícones grandes.
- Foco visível em todos os elementos interativos.
- Alvos mínimos de 44 × 44 px.
- Labels visíveis; placeholder nunca substitui label.
- Estado não depende apenas de cor.
- Gráfico sempre tem resumo textual, tabela navegável por teclado e valores expostos ao leitor de tela.
- 320, 375, 414, 768, 1280 e 1440 px são viewports obrigatórios de revisão.
- Sem rolagem horizontal; `overflow-x: clip` no documento.
- CTAs e links de navegação não quebram em duas linhas.
- Diálogos nativos, popovers acessíveis e navegação completa por teclado.

## 10. Regras contra design manipulativo

Bloqueado:

- contagem regressiva sem prazo operacional real;
- “última unidade” sem estoque real;
- preço riscado que não foi praticado;
- “mais vendido” sem amostra e período;
- prova social fabricada;
- default que adiciona seguro/taxa opcional;
- botão de cancelamento escondido;
- recomendações pagas sem rótulo;
- urgência visual em disputa, saque ou segurança.

## 11. Stamp do sistema

```text
Hallmark · macroestrutura: Long Document / workbench transacional
tema: custom · vibe: “forja noturna, ouro, precisão, confiança”
display: Big Shoulders Display · corpo: IBM Plex Sans · dados: IBM Plex Mono
eixos: dark / display-condensed-bold / chromatic-amber
DNA estudado: Nesha + painel de preços, reconstruído em clean room
```
