# OCHPOCH MARKET

OCHPOCH MARKET é a marca pública do marketplace transacional de itens digitais. **MIDAS** permanece como codinome técnico e namespace interno (`@midas/*`, contratos, migrations e documentação), evitando uma renomeação insegura dos identificadores canônicos enquanto a experiência externa usa OCHPOCH MARKET.

> **Estado atual — implementação por cortes verificáveis:** já existem monorepo, frontend, API, worker, gateway realtime, PostgreSQL com migrations, infraestrutura Podman e testes. Estão executáveis identidade/SellerAccount, o núcleo financeiro fail-closed, painéis críticos, policies de progressão/planos e a experiência 3D. O restante do mapa abaixo continua sendo escopo contratado, não disponibilidade operacional.

## O que está implementado agora

| Superfície | Estado do corte atual |
|---|---|
| Landing pública | narrativa por scroll, símbolo GLB carregado sob demanda, um canvas 3D, poster 2D de fallback e `prefers-reduced-motion` |
| Identidade | cadastro único, entrega SMTP de verificação, confirmação de e-mail, login por sessão `HttpOnly`, listagem e revogação de sessões |
| Tenant de venda | criação e listagem de `SellerAccount`, com `SellerMembership` `OWNER` persistida e autorização no servidor |
| Cockpit | visão geral, compras, vendas, carteira e saques; painéis admin de pagamentos/saques e shell master, sempre derivados de API ou indisponibilidade explícita |
| Finance | webhook com raw body, lookup obrigatório, settlement idempotente, journal balanceado, lotes, hold de 168h, resolução manual e payout maker-checker com evidência |
| Progressão comercial | níveis L1–L10, ranking em half-points, contribuições reversíveis, snapshots e planos Básico/VIP/Premium testados como domínio puro |
| Cobertura de rotas | 95/95 contratos resolvíveis; 11 superfícies dedicadas e 84 `CONTRACT_REQUIRED`, sem mascarar rota como função pronta |
| Fundação | contratos versionados, OpenAPI com 26 operações, PostgreSQL/migrations `0001–0006`, outbox/auditoria, worker fail-closed, Podman, lint, tipos e testes |

**Ainda não implementado neste corte:** adapter/credenciais de PSP e banco/Pix, destino de saque, checkout/order/delivery completos, reembolsos, avaliações bilaterais, persistência/publicação de progressão, Growth read models, Studio/pipeline 2D→3D e automações de pós-venda. Registries externos ficam vazios e retornam capability indisponível; nenhuma tela inventa número ou sucesso.

## Cobertura documental

| Artefato | Estado documentado |
|---|---:|
| Requisitos funcionais | `RF-001–300` contínuos |
| Requisitos não funcionais | `RNF-001–050` contínuos |
| Contratos de tela (`SCR-*`) | 95 |
| Shells de interface | 9 |
| Templates reutilizáveis de interface | 41 |
| Decisões arquiteturais | 19 ADRs |
| Diagramas de arquitetura | 34 blocos Mermaid |

## Mapa-alvo do produto

```text
Midas Platform
├── Experiência pública
│   ├── descoberta, busca e catálogo
│   ├── Market P2P e estoque Midas
│   ├── detalhe do item e do anúncio
│   ├── ranking, recompensas e reputação pública
│   └── inspeção 3D individual por item
├── Minha conta
│   ├── carrinho, compras e entregas
│   ├── vendas e dashboard do vendedor
│   ├── saldo, retenções e saques
│   ├── avaliações, nível, insígnias e recompensas
│   ├── suporte, disputas e reembolsos
│   └── segurança, privacidade e preferências
├── Operação do vendedor
│   ├── cadastro e permissões
│   ├── anúncios, propostas e estoque
│   ├── Studio e biblioteca 2D/3D
│   └── clientes, pós-venda, campanhas, cupons, afiliados e Growth
└── Operação da plataforma
    ├── moderação, Studio, catálogo e ativos
    ├── pedidos, payment resolution, financeiro e conciliação
    ├── reputação, progressão, ranking, suporte e auditoria
    └── planos, marketing, SEO/mercados, integrações e acesso
```

O escopo de tenant é único e explícito:

```text
Platform → SellerAccount → SellerMembership + User → objetos canônicos do domínio
```

Growth consulta projeções dessas fontes; não cria outro usuário, tenant, saldo, pedido ou funil paralelo.

## Experiência 3D por item

Cada item selecionado abre sua própria tela em `SCR-PUB-013`, rota `/itens/:slug/3d`. A tela mantém apenas uma peça e um canvas ativos:

1. resolve o item e seu `Model3DArtifact` publicado;
2. mostra poster/fallback enquanto o GLB é validado e carregado;
3. executa uma introdução premium finita;
4. encerra a animação e entrega rotação, zoom, vistas canônicas, reset e tela cheia ao usuário.

Qualquer interação interrompe imediatamente a introdução. `prefers-reduced-motion` usa a representação 2D, sem canvas ou movimento automático. Trocar de item descarta geometria, materiais, texturas e listeners do anterior antes de carregar o próximo. O pipeline 2D→3D com proveniência e revisão humana permanece especificado, mas não implementado; inferência visual nunca pode ser apresentada como reconstrução exata.

## Início rápido da fatia executável

Pré-requisitos: Node.js 22 ou 24, pnpm 11 e Podman com `podman compose` disponível. Em PowerShell:

```powershell
Copy-Item -LiteralPath infra/podman/.env.example -Destination infra/podman/.runtime.env
# Preencha infra/podman/.runtime.env com valores locais próprios e fortes.

pnpm install --frozen-lockfile
pnpm infra:up
pnpm infra:wait

# Use aqui os mesmos POSTGRES_USER, POSTGRES_PASSWORD e POSTGRES_DB do runtime local.
$env:DATABASE_URL = "postgresql://<usuario>:<senha>@127.0.0.1:5432/<banco>"
$env:PUBLIC_WEB_URL = "http://127.0.0.1:3000"
$env:CORS_ALLOWED_ORIGINS = "http://127.0.0.1:3000"
$env:MIDAS_API_URL = "http://127.0.0.1:3001"
$env:BRAND_NAME = "OCHPOCH MARKET"
$env:NEXT_PUBLIC_BRAND_NAME = "OCHPOCH MARKET"
$env:NEXT_PUBLIC_TERMS_VERSION = "terms-dev-2026-08"
$env:SMTP_HOST = "127.0.0.1"
$env:SMTP_PORT = "1025"
$env:SMTP_FROM = "dev@ochpoch.local"

pnpm db:migrate
pnpm db:check
pnpm --parallel --filter @midas/api --filter @midas/web run dev
```

A aplicação abre em `http://127.0.0.1:3000`, a API em `http://127.0.0.1:3001` e a caixa SMTP local do Mailpit em `http://127.0.0.1:8025`. MinIO e Mailpit são dependências locais; não homologam provedores de produção. Para encerrar preservando volumes, execute `pnpm infra:stop`.

## Por onde continuar

1. Leia a [visão executiva](docs/00-RELATORIO-MESTRE.md).
2. Confira o [mapa de telas e fluxos](docs/07-MAPA-DE-TELAS-E-FLUXOS.md).
3. Use a [matriz de implementação](docs/12-MATRIZ-DE-IMPLEMENTACAO.md) para escolher o próximo corte vertical sem mocks.
4. Consulte o [PRD](docs/01-PRD-MIDAS.md) e a [arquitetura](docs/02-UML-ARQUITETURA.md) antes de alterar contratos.
5. Implemente seguindo o [backlog e roadmap](docs/05-BACKLOG-ROADMAP.md) e as [ADRs](docs/08-ADRS-DECISOES-ARQUITETURAIS.md).

## Artefatos do projeto

| Documento | Uso principal |
|---|---|
| [00 — Relatório mestre](docs/00-RELATORIO-MESTRE.md) | visão executiva, hierarquia do produto e decisões fechadas |
| [01 — PRD](docs/01-PRD-MIDAS.md) | jornadas, regras, `RF-001–300` e `RNF-001–050` |
| [02 — UML e arquitetura](docs/02-UML-ARQUITETURA.md) | C4, domínios, estados, APIs, eventos e 34 diagramas Mermaid |
| [03 — Direção de arte](docs/03-DIRECAO-DE-ARTE.md) | Midas Foundry, componentes, motion e acessibilidade |
| [04 — Segurança e operações](docs/04-SEGURANCA-COMPLIANCE-OPERACOES.md) | auth, ameaças, pagamentos, privacidade e runbooks |
| [05 — Backlog e roadmap](docs/05-BACKLOG-ROADMAP.md) | épicos, dependências, ondas e critérios de entrega |
| [06 — Referências e assets](docs/06-INVENTARIO-REFERENCIAS-E-ASSETS.md) | proveniência, referências observadas e política de ativos |
| [07 — Mapa de telas](docs/07-MAPA-DE-TELAS-E-FLUXOS.md) | inventário hierárquico dos 95 contratos de tela e fluxos de navegação |
| [08 — ADRs](docs/08-ADRS-DECISOES-ARQUITETURAIS.md) | 19 decisões e consequências arquiteturais |
| [09 — Growth multi-tenant](docs/09-PAINEL-GROWTH-MULTITENANT.md) | painel do tenant, métricas, permissões e drill-down |
| [10 — React Bits](docs/10-PLANO-REACT-BITS.md) | uso seletivo de motion e componentes, com budgets |
| [11 — Pipeline 3D](docs/11-PIPELINE-3D-ARMAS.md) | ingestão 2D, geração, validação, publicação e viewer Three.js |
| [12 — Matriz de implementação](docs/12-MATRIZ-DE-IMPLEMENTACAO.md) | rastreabilidade requisito → domínio → tela → teste |
| [13 — Pagamentos, reputação e progressão](docs/13-PAGAMENTOS-REPUTACAO-PROGRESSAO.md) | settlement, hold, payout manual, reviews, níveis, rewards, ranking e planos |
| [14 — Marketing pós-venda](docs/14-MARKETING-POS-VENDA-OMNICANAL.md) | carrinho, lifecycle, consentimento, campanhas, Meta, cupom, afiliado e atribuição |
| [15 — Studio 2D/3D](docs/15-STUDIO-CATALOGO-3D-2D.md) | biblioteca, submissions, catálogo, prefill, assets e publicação |
| [16 — SEO e conteúdo](docs/16-SEO-CONTEUDO-ATRIBUICAO.md) | URLs, SSR, robots, sitemaps, schema, mercados e analytics |
| [17 — Nomenclatura](docs/17-NOMENCLATURA-HIERARQUIA-FUNCIONAL.md) | vocabulário canônico de domínio, tela, botão, código, evento e cache |
| [18 — Brand kit](docs/18-BRAND-KIT-DESIGN-SYSTEM.md) | marca, tokens, voz, componentes e governança visual |
| [19 — Radar open source](docs/19-RADAR-OPEN-SOURCE-E-DECISOES-BUILD-VS-BUY.md) | alternativas, licenças, POCs e decisões build vs. buy |
| [20 — Benchmark de concorrentes e layouts](docs/20-BENCHMARK-COMPETIDORES-E-LAYOUTS.md) | pesquisa clean-room das superfícies públicas e operacionais do mercado |
| [21 — Sistema de layouts e templates](docs/21-SISTEMA-DE-LAYOUTS-E-TEMPLATES-UI.md) | 9 shells, 41 templates reutilizáveis e cobertura exata das 95 telas |
| [SDD — Requirements](specs/midas-marketplace/requirements.md) | critérios EARS agrupados e rastreáveis aos requisitos canônicos |
| [SDD — Design](specs/midas-marketplace/design.md) | arquitetura, dados, interfaces, segurança e taxonomia visual |
| [SDD — Tasks](specs/midas-marketplace/tasks.md) | execução por gates e cortes verticais, sem mocks |
| [Atlas visual de layouts](reports/MIDAS-ATLAS-DE-LAYOUTS.html) | mapa navegável dos 9 shells, 41 templates e hierarquia de composição |
| [Relatório visual de arquitetura](reports/MIDAS-ARQUITETURA-EXECUTAVEL.html) | leitura navegável dos fluxos e limites atuais |

Os arquivos [HTML mestre](reports/MIDAS-RELATORIO-MESTRE.html) e [PDF mestre](reports/MIDAS-RELATORIO-MESTRE.pdf) são snapshots legados e não devem ser usados como fonte da revisão corrente. A fonte de verdade é o conjunto Markdown acima.

## Princípios de implementação

- construir cortes verticais reais, com persistência e contratos verificáveis;
- não criar endpoints, serviços ou estados duplicados para algo já canônico;
- reconhecer pagamento somente por webhook autenticado e reconciliado;
- manter ledger, saldo, hold, reembolso e payout separados das projeções de dashboard;
- usar `PaymentResolutionCase` e `PayoutAttempt`/`PayoutEvidence`; nunca editar status/saldo manualmente;
- aplicar o escopo `SellerAccount` no servidor, com `SellerMembership` e `User` autorizados;
- proteger contato e consentimento na Platform; seller opera segmentos, não listas de PII;
- fazer Studio reutilizar `CatalogItem`/`Listing`; `CatalogSubmission` nunca vira catálogo paralelo;
- derivar SEO, sitemap, robots e market availability do estado publicado e de policies versionadas;
- usar React Bits somente na camada visual; regras e estado ficam no domínio;
- validar GLB, origem dos assets, acessibilidade, budgets e descarte de recursos no viewer 3D;
- não substituir integração real por mock em uma entrega declarada pronta.

## Referências centrais

- [React Bits — repositório](https://github.com/DavidHDev/react-bits) e [documentação](https://reactbits.dev/)
- [Three.js — GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- [glTF 2.0 — especificação Khronos](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [Regras oficiais do Standoff 2](https://help.standoff2.com/pt-BR/articles/8446575-regras-do-jogo)
- [EULA do Standoff 2](https://standoff2.com/en/eula.html)
- [Código de Conduta](https://help.standoff2.com/en/articles/15253027-code-of-conduct)
- [Central oficial do Marketplace](https://help.standoff2.com/en/collections/3850927-marketplace)
- [Licença oficial de assets](https://standoff2.com/assets/AXLEBOLT_Assets_license_EN.pages)

O uso comercial de marca, catálogo, imagens, preços ou transferência de itens de terceiros continua condicionado a autorização e fonte licenciada. Essa restrição não impede a implementação clean-room do motor genérico com ativos próprios ou autorizados.
