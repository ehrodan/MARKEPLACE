# ADR-020 — Stack de runtime e bootstrap

- **Estado da decisão:** ACEITA
- **Estado operacional:** `READY_FOR_BOOTSTRAP`
- **Data de corte:** 2026-08-23
- **Escopo:** workspace, runtime local/CI, aplicação web, API, persistência, design system e testes.

## 1. Significado do estado

`READY_FOR_BOOTSTRAP` autoriza criar o monorepo, instalar as versões fechadas abaixo, subir PostgreSQL real em Podman, aplicar migrations e implementar/testar módulos clean-room com dados próprios ou sintéticos.

Este estado **não** significa `PRODUCTION_READY`, lançamento comercial, autorização para negociar ativos de terceiros, acesso a feed externo, PSP contratado ou policies aprovadas. Integrações externas continuam indisponíveis por padrão e não podem responder sucesso simulado.

## 2. Decisão

O Midas será implementado como monorepo TypeScript com processos separados para web, API e workers:

```text
apps/web       Next.js App Router; SSR/RSC para superfície pública e shells autenticados
apps/api       Fastify; única fronteira HTTP de regras e comandos canônicos
apps/worker    consumidores de outbox e trabalhos duráveis, sem estado financeiro próprio
packages/*     domínio, contratos, banco, configuração, telemetria e design system
```

- **Web:** Next.js e React. Server Components podem ler somente contratos permitidos; comandos financeiros e administrativos atravessam a API.
- **API:** Fastify com Zod e `fastify-type-provider-zod`; schema de entrada e saída é obrigatório. Erro externo desconhecido nunca é convertido em sucesso.
- **Dados:** PostgreSQL é a fonte canônica. Drizzle oferece schema/query tipados e migrations SQL versionadas. `drizzle-kit push` é proibido em produção; o fluxo é `generate` + revisão SQL + `migrate`.
- **UI:** Tailwind fornece composição visual; Radix fornece primitives comportamentais; TanStack Table fornece estado headless das tabelas. Tokens e componentes Midas continuam sendo a API visual.
- **Motion:** React Bits não é dependência global nem design system. Apenas código de componente explicitamente aprovado pode entrar por wrapper e feature flag, conforme a [allowlist](coordenacao/REACT-BITS-ALLOWLIST.md).
- **Testes:** Vitest cobre unidade/contratos; Playwright cobre browser/E2E. Invariantes de persistência usam PostgreSQL real em Podman; sandbox oficial é obrigatório antes de declarar qualquer adapter externo pronto.
- **Orquestração:** pnpm workspaces e Turborepo coordenam tarefas e cache de build. O lockfile é único.

## 3. Baseline fechado

Versões só mudam por pull request com build, testes, migração quando aplicável e atualização deste ADR ou registro que o substitua.

| Camada | Pacote/runtime | Versão fechada | Observação de compatibilidade |
|---|---|---:|---|
| produção/CI | Node.js | `24.19.0` LTS | baseline de deploy |
| bootstrap local existente | Node.js | `22.17.1` | compatível; não altera o baseline de produção |
| workspace | pnpm | `11.15.1` | versão já comprovada no ambiente local; requer Node `>=22.13` |
| tarefas | Turborepo | `2.10.11` | somente build/test/lint/dev; não entra no runtime da aplicação |
| linguagem | TypeScript | `6.0.3` | escolhido porque `typescript-eslint@8.67.0` aceita TypeScript `<6.1`; `7.x` fica bloqueado |
| lint | ESLint / typescript-eslint | `10.9.0` / `8.67.0` | configuração flat e zero erro no CI |
| web | Next.js | `16.3.2` | Node `>=20.9`; App Router |
| UI runtime | React / React DOM | `19.2.8` / `19.2.8` | pares devem permanecer na mesma versão |
| API | Fastify | `5.12.1` | suporta linhas LTS/atuais usadas no projeto |
| contratos API | Zod / provider Zod | `4.4.3` / `7.0.0` | provider exige Fastify `^5.5` e Zod `>=4.1.5` |
| documentação API | `@fastify/swagger` / `@fastify/swagger-ui` | `9.8.1` / `6.1.1` | OpenAPI deriva dos schemas reais |
| proteção HTTP | CORS / Helmet / rate limit | `11.3.0` / `13.1.1` / `11.2.0` | configuração é deny-by-default por ambiente |
| banco | PostgreSQL | `18.6` | versão minor corrente da linha 18 na data de corte |
| acesso SQL | Drizzle ORM / Kit / `pg` | `0.45.2` / `0.31.10` / `8.23.0` | migrations SQL versionadas e pool explícito |
| CSS | Tailwind / PostCSS | `4.3.3` / `8.5.26` | browsers modernos; tokens Midas continuam canônicos |
| primitives | `radix-ui` | `1.6.7` | adoção incremental e wrappers próprios |
| tabelas | `@tanstack/react-table` | `9.1.2` | v9, ESM-only; exemplos v8 não são contrato |
| testes | Vitest / coverage V8 | `4.1.11` / `4.1.11` | mesma versão entre runner e provider |
| E2E | `@playwright/test` | `1.62.1` | browser instalado pela CLI da mesma versão |

### 3.1 Suporte de browser

O piso é Chrome/Edge 111+, Safari 16.4+ e Firefox 128+, determinado pelo Tailwind 4. Conteúdo essencial, preço, ações, formulários e fallback 2D não dependem de motion nem WebGL.

### 3.2 PostgreSQL 18 em Podman

A imagem OCI de produção/desenvolvimento deve ser fixada em `docker.io/library/postgres:18.6`. No PostgreSQL 18 o volume persistente é montado em `/var/lib/postgresql`; o `PGDATA` padrão passou a `/var/lib/postgresql/18/docker`. Usar o antigo mount `/var/lib/postgresql/data` viola este ADR por risco de persistência incorreta.

## 4. Gates G0–G3: fail-closed

| Gate | Estado no bootstrap | Comportamento obrigatório |
|---|---|---|
| G0 — direito de operar/ativos | `NO_GO` | nenhuma publicação ou negociação de Standoff 2/ativos protegidos; catálogo dessa vertical permanece desabilitado até autorização escrita e versionada |
| G1 — dados de mercado/feed | `CLOSED` | nenhum scraping/feed/API não autorizado; telas exibem estado de capability indisponível, não preço inventado |
| G2 — PSP, split, hold e payout | `CLOSED` | nenhum charge/capture/refund/payout real; adapter sem contrato/credencial oficial retorna erro tipado e auditável, jamais sucesso mockado |
| G3 — políticas comerciais | `CLOSED` | disputa, reembolso, strike, taxa, prazo e saque não são ativados comercialmente sem policy aprovada e snapshot versionado |

Regras de implementação enquanto um gate estiver fechado:

1. a capability nasce `disabled` e precisa de configuração explícita por ambiente e tenant;
2. ausência de configuração, contrato, consentimento ou policy resulta em negação determinística;
3. testes podem usar domínio puro, dados sintéticos e sandboxes oficiais; funções falsas de confirmação externa não são evidência;
4. UI não oferece CTA operacional para capability fechada e explica o bloqueio sem sugerir indisponibilidade temporária enganosa;
5. abertura exige owner, evidência, data, escopo territorial/comercial, rollback e teste de negação.

## 5. React Bits: adoção condicional

O repositório React Bits observado em 2026-08-23 usa React 19 e Tailwind 4, mas o pacote raiz é privado e não deve ser instalado como dependência. A distribuição escolhida é cópia seletiva da variante **TypeScript + Tailwind**, sempre presa a componente e commit.

O commit de referência é `4e0e030193b563be6be33d928f77d0d01cefe237`. Isso não equivale a aprovação. A licença vigente é **MIT + Commons Clause** e impede vender, sublicenciar ou redistribuir os componentes em si, isolados, em bundle ou portados. Dependências de cada componente possuem licenças próprias e passam pelo mesmo gate.

Condições cumulativas antes de importar um componente:

- status `APPROVED` na [allowlist](coordenacao/REACT-BITS-ALLOWLIST.md), com caminho, variante e commit exatos;
- parecer jurídico versionado permitindo o uso concreto no produto e confirmando que não há redistribuição proibida;
- licença/copyright preservados no [registro de terceiros](../THIRD_PARTY_NOTICES.md);
- wrapper Midas, feature flag desligada por padrão e fallback estático equivalente;
- testes de SSR/hydration, teclado, foco, leitor de tela, zoom 200%, `prefers-reduced-motion`, desmontagem e budget móvel;
- nenhuma propriedade de preço, saldo, elegibilidade, risco ou estado canônico calculada ou mantida pelo componente.

Até essas condições serem atendidas, a allowlist efetiva é vazia e React Bits permanece `BLOCKED_LEGAL_TECHNICAL`.

## 6. Fora desta decisão

Não foram declarados prontos ou selecionados por este ADR: PSP, KYC, WhatsApp/Meta, Instagram, e-mail, SMS, publisher/game API, feed de mercado, provider 3D externo, object storage remoto, CDN, busca externa, broker e cache distribuído. Seus adapters devem permanecer ausentes ou fail-closed até ADR e evidência próprios.

## 7. Critérios para sair de `READY_FOR_BOOTSTRAP`

O próximo estado só pode ser atribuído com evidência executada:

- install reproduzível a partir do lockfile;
- lint, typecheck, testes e builds de web/API/worker verdes;
- PostgreSQL real saudável em Podman, migrations aplicadas e rollback ensaiado;
- teste de isolamento tenant e de negação G0–G3;
- SBOM/licenças reconciliados com o lockfile;
- nenhum adapter externo marcado como pronto sem sandbox oficial e gate aplicável.

## 8. Fontes primárias

- [Node.js — releases](https://nodejs.org/en/about/previous-releases)
- [Next.js — instalação e requisitos](https://nextjs.org/docs/pages/getting-started/installation)
- [React — versões](https://react.dev/versions)
- [Fastify — política LTS](https://fastify.dev/docs/latest/Reference/LTS/)
- [PostgreSQL — versionamento](https://www.postgresql.org/support/versioning/)
- [Drizzle — PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [Drizzle — migrations](https://orm.drizzle.team/docs/migrations)
- [pnpm — instalação e compatibilidade](https://pnpm.io/installation)
- [Vitest — migração para v4](https://vitest.dev/guide/migration.html)
- [Playwright — instalação](https://playwright.dev/docs/intro)
- [Tailwind — instalação com Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [Radix Primitives — introdução](https://www.radix-ui.com/primitives/docs/overview/introduction)
- [TanStack Table v9 — instalação](https://tanstack.com/table/v9/docs/installation)
- [React Bits — licença](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md)
- [Imagem oficial PostgreSQL — mudança de PGDATA no 18](https://github.com/docker-library/docs/blob/master/postgres/content.md#pgdata)
