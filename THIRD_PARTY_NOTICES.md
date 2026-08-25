# Third-party notices — baseline Midas

- **Estado:** `BASELINE_PLANNED / NOT_LOCKFILE_RECONCILED`
- **Data de corte:** 2026-08-23

Este arquivo registra a baseline aprovada para bootstrap. Ele não afirma que as dependências já foram instaladas ou distribuídas. Depois da criação do `pnpm-lock.yaml`, o inventário direto e transitivo, os textos de licença e eventuais arquivos `NOTICE` devem ser reconciliados automaticamente e revisados antes de build distribuível.

## Baseline direta

| Software | Versão | Licença declarada | Uso planejado |
|---|---:|---|---|
| Node.js | `24.19.0` | MIT e notices de terceiros da distribuição | runtime de CI/produção |
| pnpm | `11.15.1` | MIT | package manager |
| Turborepo | `2.10.11` | MIT | grafo/cache de tarefas |
| TypeScript | `6.0.3` | Apache-2.0 | linguagem/toolchain |
| ESLint | `10.9.0` | MIT | lint |
| typescript-eslint | `8.67.0` | MIT | lint TypeScript |
| Next.js | `16.3.2` | MIT | aplicação web |
| React / React DOM | `19.2.8` | MIT | UI runtime |
| Fastify | `5.12.1` | MIT | API HTTP |
| Zod | `4.4.3` | MIT | contratos/validação |
| fastify-type-provider-zod | `7.0.0` | MIT | integração de schemas Fastify/Zod |
| `@fastify/swagger` | `9.8.1` | MIT | OpenAPI |
| `@fastify/swagger-ui` | `6.1.1` | MIT | portal OpenAPI autenticado por ambiente |
| `@fastify/cors` | `11.3.0` | MIT | CORS |
| `@fastify/helmet` | `13.1.1` | MIT | headers de segurança |
| `@fastify/rate-limit` | `11.2.0` | MIT | limites de requisição |
| PostgreSQL | `18.6` | PostgreSQL License | banco canônico |
| Drizzle ORM | `0.45.2` | Apache-2.0 | acesso SQL tipado |
| Drizzle Kit | `0.31.10` | MIT | geração/aplicação de migrations |
| node-postgres (`pg`) | `8.23.0` | MIT | driver PostgreSQL |
| Tailwind CSS | `4.3.3` | MIT | composição CSS |
| PostCSS | `8.5.26` | MIT | pipeline CSS |
| Radix Primitives (`radix-ui`) | `1.6.7` | MIT | primitives acessíveis |
| TanStack React Table | `9.1.2` | MIT | tabelas headless |
| Vitest | `4.1.11` | MIT | testes |
| `@vitest/coverage-v8` | `4.1.11` | MIT | cobertura |
| Playwright Test | `1.62.1` | Apache-2.0 | E2E/browser |

## Obrigações mínimas

- **MIT:** conservar copyright e texto de permissão nas cópias/substanciais quando aplicável.
- **Apache-2.0:** conservar a licença, avisos de copyright/atribuição e arquivos `NOTICE` fornecidos; sinalizar modificações conforme aplicável.
- **PostgreSQL License:** conservar o copyright e os parágrafos de permissão/garantia exigidos.
- Dependências transitivas podem impor obrigações adicionais; este arquivo não substitui a análise do lockfile/SBOM.

Fontes primárias: [Next.js](https://github.com/vercel/next.js/blob/canary/license.md), [Fastify](https://github.com/fastify/fastify/blob/main/LICENSE), [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm/blob/main/LICENSE), [PostgreSQL](https://www.postgresql.org/about/licence/), [Radix](https://github.com/radix-ui/primitives/blob/main/LICENSE), [TanStack Table](https://github.com/TanStack/table/blob/main/LICENSE), [Playwright](https://github.com/microsoft/playwright/blob/main/LICENSE).

## React Bits — não incorporado

React Bits está **fora da baseline instalada** e permanece `BLOCKED_LEGAL_TECHNICAL`.

- Origem: [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits).
- Commit analisado: [`4e0e030193b563be6be33d928f77d0d01cefe237`](https://github.com/DavidHDev/react-bits/tree/4e0e030193b563be6be33d928f77d0d01cefe237).
- Licença observada: [MIT + Commons Clause](https://github.com/DavidHDev/react-bits/blob/4e0e030193b563be6be33d928f77d0d01cefe237/LICENSE.md).
- Restrição material: uso comercial dentro de uma aplicação é descrito como permitido, mas vender, sublicenciar ou redistribuir os componentes em si — isolados, em bundle ou portados — é proibido pelo texto vigente.
- Governança: somente componente, arquivo, variante e commit presentes na [allowlist](docs/coordenacao/REACT-BITS-ALLOWLIST.md) podem ser avaliados; nesta data nenhum está `APPROVED`.

Dependências declaradas pelos candidatos também estão fora da baseline até resolução e análise individual:

| Dependência candidata | Faixa declarada pelo componente | Licença observada | Gate |
|---|---:|---|---|
| GSAP | `^3.13.0` | licença própria “Standard no charge” | revisão jurídica obrigatória antes de resolver/instalar |
| Motion | `^12.23.12` | MIT | fixar versão exata, reconciliar notices e medir bundle |
| OGL | `^1.0.11` | Unlicense | fixar versão exata e reconciliar notices |

Nenhum componente React Bits pode ser incluído neste notice como distribuído antes de existir parecer jurídico versionado, hash do arquivo copiado, versão exata de dependências e evidência técnica exigida pela allowlist.

## Integrações externas

SDKs de PSP, Meta/WhatsApp/Instagram, e-mail, SMS, KYC, publisher/game, feed de mercado, busca, storage remoto, CDN e provider 3D **não estão declarados nesta baseline**. A presença futura de um SDK no lockfile não comprova contrato, autorização, credencial, sandbox validado nem capability pronta.
