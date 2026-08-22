# MIDAS — Relatório mestre de produto

**Documento de decisão pré-código**  
Versão: 1.0 · Data-base: 21 de agosto de 2026 · Idioma: pt-BR

> **Promessa do produto:** veja o preço de referência, negocie com proteção e receba com rastreio.

> **STATUS DE GO-LIVE: NO-GO.** As [Regras oficiais do Standoff 2](https://help.standoff2.com/pt-BR/articles/8446575-regras-do-jogo), atualizadas em 03/07/2026, proíbem comércio externo e intermediação por dinheiro real salvo permissão expressa. A [EULA oficial](https://standoff2.com/en/eula.html) proíbe comprar/vender contas e restringe uso comercial de conteúdo e bens virtuais. O projeto só pode avançar como marketplace Standoff 2 após autorização escrita da Axlebolt cobrindo comércio, transferência, API, dados e assets.

## 1. Decisão executiva

Midas deve ser construído como um **marketplace transacional de confiança**, não como uma simples loja de cards. O núcleo do produto é a consistência entre cinco coisas: anúncio aprovado, pagamento confirmado, entrega rastreável, disputa resolvível e saldo liberado de forma auditável.

Este relatório especifica o produto-alvo, mas a implementação comercial está condicionada ao gate de autorização do publicador. Enquanto o gate estiver bloqueado, apenas documentação, protótipo clean-room e motor genérico com dados sintéticos são aceitáveis.

O produto terá duas vitrines apoiadas pelo mesmo motor:

1. **Market P2P** — anúncios de vendedores, todos submetidos à revisão manual antes da publicação.
2. **Compre do Midas** — estoque próprio do operador, com preço definido pelo Midas e identificação visual inequívoca.

O desenho recomendado é um **monólito modular orientado a domínios**, acompanhado por gateway de chat e workers assíncronos. Essa forma entrega velocidade de execução sem abrir mão de limites internos claros. Microserviços não são requisito de MVP; integridade financeira e observabilidade são.

## 2. O que foi analisado

### Nesha Store

Auditoria clean-room de navegação, densidade, hierarquia, catálogo e persuasão ética em [neshastore.com](https://neshastore.com/). Foram inspecionadas as superfícies públicas de início, produto, carrinho, login, Prime, venda, FAQ, termos, privacidade e antiscam, além do sitemap público.

O que vale transportar como princípio:

- catálogo escuro e denso;
- categorias acessíveis logo no início;
- preço, desconto e disponibilidade visíveis no card;
- compra e entrega explicadas no contexto da ação;
- confiança tratada como parte da interface;
- produto detalhado com forte hierarquia entre imagem, preço e CTA.

O que **não** será transportado:

- logotipo, textos, banners, ilustrações, CSS ou tokens;
- escassez, contadores ou prova social sem evidência;
- estrutura B2C/C2B tratada como se fosse P2P;
- dependências e integrações particulares da Nesha.

### Standoff 2 Shop de referência

Foi auditada a página [standoff-2.com/shop](https://standoff-2.com/shop/), que oferece seleção de item, atributos, preço atual, mínimo, máximo, média, compra/venda, períodos e gráfico histórico.

**Constatação crítica:** o próprio rodapé do site informa que ele é **não oficial**. Seus endpoints observados são evidência de funcionamento daquela página, não uma API oficial, licenciada ou adequada para produção. O Midas só poderá chamar um feed de mercado se houver documentação pública, permissão contratual ou licença expressa.

A pesquisa em fontes oficiais não localizou portal público, OpenAPI, SLA, chave de parceiro ou licença para preço/histórico. A [central oficial de Marketplace](https://help.standoff2.com/en/collections/3850927-marketplace) descreve o mercado do jogo, não autoriza integração externa. A [FAQ oficial de economia](https://help.standoff2.com/en/articles/10817904-f-a-q) também informa que não há intenção de oferecer troca direta entre amigos devido a golpes e impacto econômico; o fluxo de entrega pedido não pode ser presumido tecnicamente viável.

### Inventário de catálogo observado

Na data-base desta auditoria, a interface expunha:

- 2.256 nomes selecionáveis;
- 1.782 registros de metadados;
- 1.782 referências com extensão `.png`;
- 1.779 URLs de imagem únicas;
- 1.777 nomes únicos;
- 49 coleções preenchidas.

Essas URLs entram no **manifesto de proveniência**, não no produto. O download e a republicação dos binários permanecem bloqueados por licença.

## 3. Resultado proposto

### Superfícies de cliente

- Início e descoberta personalizada;
- Market P2P;
- Compre do Midas;
- item-base e anúncio específico;
- busca, filtros, favoritos e perfil público do vendedor;
- wizard de anúncio com craft estruturado;
- chat e propostas pré-compra;
- checkout;
- sala de entrega pós-pagamento;
- compras, vendas, saldo de vendas administrado pelo PSP, saque e suporte;
- segurança, sessões, passkeys, 2FA e dispositivos.

### Superfícies operacionais

- fila de moderação de anúncios;
- catálogo e ativos;
- estoque Midas;
- confiança, fraude, restrições e recursos;
- pedidos, disputas e evidências;
- financeiro, conciliação, holds e saques;
- suporte e caixa de e-mail unificada;
- usuários e dispositivos;
- Master, RBAC/ABAC, configurações, integrações e auditoria.

## 4. Decisões fechadas

| Tema | Decisão |
|---|---|
| Arquitetura | Monólito modular + gateway de chat + workers; PostgreSQL canônico |
| Venda unitária | Um pedido compra um anúncio no MVP; sem carrinho multivendedor |
| Catálogo | Itens e adesivos administráveis, versionados e com proveniência |
| Craft | Modo `NONE` ou `CRAFT`; craft possui exatamente quatro posições ordenadas |
| Moderação | Todo anúncio P2P exige decisão manual registrada |
| Pagamento | Estado pago nasce de webhook autenticado e reconciliado, nunca do redirect |
| Liquidação tardia | Entra em quarentena; só reassume a unidade atomicamente ou reembolsa; nunca abre entrega automaticamente |
| Dinheiro | PSP regulado movimenta fundos; ledger Midas registra obrigações e saldos |
| Retenção | Sete dias/168 horas após confirmação bilateral, sujeito a disputa e PSP |
| Entrega secreta | Só para publisher/tipo transferível autorizado; credencial em cofre, nunca em chat/e-mail/log; desabilitada para contas Standoff 2 |
| Chat | Política distinta para pré-compra, entrega e suporte |
| PII | 1ª e 2ª tentativas bloqueadas; 3ª restringe e abre revisão/recurso |
| Dispositivo | Chave/passkey + score de risco; fingerprint não prova identidade |
| Preço | Fonte autorizada, `asOf`, origem, qualidade e estado desatualizado |
| Recomendação | Regras explicáveis primeiro; ML apenas após volume e avaliação |
| Design | Clean room “Midas Foundry”; sem clone visual ou ativo de terceiros |

## 5. Gates que impedem produção

O código comercial não deve avançar para produção até que estes pontos tenham resposta documental:

1. Autorização comercial/técnica escrita da Axlebolt para operar marketplace externo por dinheiro real.
2. Fonte licenciada de catálogo, PNGs, preços e histórico.
3. Mecanismo oficial/autorizado de transferência/entrega dos itens.
4. Exclusão de venda de contas do escopo Standoff 2, salvo mudança expressa dos termos e autorização individualizada.
5. PSP com recursos reais de marketplace, split/subcontas, retenção, reembolso, chargeback, KYC e payout.
6. Modelo jurídico do fluxo financeiro; o termo “escrow” não será usado sem suporte contratual.
7. Moeda, taxas, limites, território, idade mínima e política de vendedor.
8. Evidências aceitas, prazos e regra de disputa.
9. Bases legais, transparência, retenção e exercício de direitos sob LGPD/ECA Digital.
10. Política de WhatsApp/Instagram e uso exclusivo de integrações oficiais.
11. Política de strike: janela, expiração, revisão e recurso.
12. Responsáveis e dupla aprovação para operações financeiras sensíveis.

## 6. Métrica que guia o produto

**North Star recomendada:** valor e quantidade de pedidos cujo saldo de vendas chegou a `DISPONIVEL` no fluxo administrado pelo PSP, sem disputa procedente, reembolso ou chargeback.

Não otimizar isoladamente GMV, tempo no site, CTR, mensagens, banimentos ou velocidade de aprovação. O sistema deve premiar transação protegida e concluída, não apenas clique.

## 7. Ordem de construção recomendada

1. Autorização do publicador, direitos, integração e contrato financeiro.
2. Identidade, IAM, sessão, auditoria e configuração.
3. Catálogo, ativos, anúncio, craft e moderação.
4. Busca, Market P2P, canal Midas e preço com fallback manual.
5. Reserva, pedido, oferta e máquina de estado.
6. PSP sandbox, webhook, ledger e reconciliação.
7. Entrega, cofre, confirmação bilateral, disputa, hold e saque.
8. Chat, anti-PII, recurso e confiança de dispositivo.
9. Tickets, e-mail, observabilidade e operação.
10. Recomendação explicável, piloto e endurecimento.

## 8. Mapa dos artefatos

| Arquivo | Conteúdo |
|---|---|
| `01-PRD-MIDAS.md` | visão, personas, escopo, rotas, jornadas, requisitos, aceites e métricas |
| `02-UML-ARQUITETURA.md` | C4, domínios, entidades, APIs, eventos, estados e sequências UML |
| `03-DIRECAO-DE-ARTE.md` | DNA clean-room, tokens, componentes, UX, conteúdo, motion e acessibilidade |
| `04-SEGURANCA-COMPLIANCE-OPERACOES.md` | threat model, auth, device trust, pagamentos, LGPD, suporte e operação |
| `05-BACKLOG-ROADMAP.md` | gates, épicos, releases, dependências, DoR/DoD e estratégia de testes |
| `06-INVENTARIO-REFERENCIAS-E-ASSETS.md` | auditoria das referências, endpoints observados e inventário de ativos |

## 9. Posição final

O Midas pode usar das referências a densidade, a clareza comercial e a leitura de mercado. Sua diferença não será “parecer com uma loja conhecida”; será tornar verificável o que geralmente fica solto: quem pode anunciar, o que foi aprovado, qual preço foi observado, quando o pagamento foi confirmado, o que foi entregue, quem confirmou, por que o saldo está retido e quem alterou uma decisão.

**A interface vende. O sistema de estados sustenta a venda.**
