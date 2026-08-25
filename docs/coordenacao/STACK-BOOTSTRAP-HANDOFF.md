# Handoff — stack e bootstrap

- **Status:** `READY_FOR_BOOTSTRAP`
- **Decisão canônica:** [ADR-020](../22-ADR-STACK-RUNTIME.md)
- **Licenças:** [THIRD_PARTY_NOTICES](../../THIRD_PARTY_NOTICES.md)
- **React Bits:** [allowlist](REACT-BITS-ALLOWLIST.md)

## O que está liberado

- criar `apps/web`, `apps/api`, `apps/worker` e `packages/*`;
- usar Node `22.17.1` no bootstrap local e Node `24.19.0` como alvo obrigatório de CI/produção;
- fixar o workspace em pnpm `11.15.1` e as dependências nas versões do ADR;
- subir `postgres:18.6` em Podman com volume em `/var/lib/postgresql`;
- implementar domínio, migrations, API, UI e testes clean-room com dados próprios/sintéticos.

## O que continua fechado

- G0: operação/ativos Standoff 2;
- G1: feed ou scraping de mercado;
- G2: PSP, charge, split, hold, refund e payout reais;
- G3: policies comerciais em produção;
- qualquer integração externa sem contrato, credencial, sandbox oficial e gate documentado;
- qualquer componente React Bits até status `APPROVED` individual.

## Contratos de coordenação

1. Não criar adapter que confirme externamente por timeout, ausência de credencial ou payload sintético.
2. Não usar Redis/cache como fonte de saldo, consentimento, schedule ou decisão.
3. Não usar `drizzle-kit push` em produção.
4. Não montar PostgreSQL 18 em `/var/lib/postgresql/data`.
5. Não copiar exemplos TanStack v8 para o pacote v9.
6. Não instalar o repositório React Bits inteiro.
7. Atualizar o notice a partir do lockfile antes de qualquer entrega distribuível.

## Próxima evidência mínima

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

Os comandos acima são critérios esperados para o workspace a ser criado; neste handoff eles não são declarados executados. A promoção de estado exige saída real, health check do Podman/PostgreSQL e teste de negação G0–G3.
