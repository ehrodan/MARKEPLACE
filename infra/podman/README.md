# Infraestrutura local com Podman

Os serviços usam imagens versionadas, bind apenas em `127.0.0.1`, volumes nomeados e health checks. PostgreSQL é fonte canônica; Valkey é somente acelerador; NATS transporta eventos publicados da outbox; MinIO fornece API S3 local; Mailpit comprova SMTP no ambiente de desenvolvimento.

1. Copie `.env.example` para `.runtime.env` e gere valores locais fortes.
2. Execute `pnpm infra:up`.
3. Execute `pnpm infra:wait` e só então migrations/API/workers.
4. `pnpm infra:stop` preserva volumes. `pnpm infra:down` remove containers/rede, mas não usa `-v` e portanto preserva os volumes.

Mailpit e MinIO local não homologam provedor de produção. Capabilities externas permanecem desabilitadas até credenciais, contrato e sandbox oficiais.

