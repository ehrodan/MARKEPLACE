# WIRING — `/conta/seguranca` (SCR-ACC-006), `/conta/seguranca/sessoes` (SCR-ACC-007) e `/conta/seguranca/dispositivos` (SCR-ACC-008)

**Sessão:** retomada do handoff `HANDOFF-ONDA-COMPRA-RETENCAO.md`, branch `codex/rf181-202-conta-reembolsos`.

**Arquivos de propriedade exclusiva deste trabalho:**

```
apps/web/components/security/session-facts.ts
apps/web/components/security/session-facts.test.ts
apps/web/components/security/security-view.tsx
apps/web/components/security/sessions-view.tsx
apps/web/components/security/devices-view.tsx
apps/web/app/conta/seguranca/page.tsx
apps/web/app/conta/seguranca/sessoes/page.tsx
apps/web/app/conta/seguranca/dispositivos/page.tsx
docs/coordenacao/WIRING-seguranca-conta.md
```

Nenhuma rota de API foi criada. Nada a colar em `apps/api/src/app.ts` nem em `apps/api/package.json`.

---

## 1. O que já é real

`GET /v1/me/sessions` **existe** (`apps/api/src/app.ts`, `listCurrentUserSessions`) e responde no
schema `sessionListResponseSchema` de `packages/contracts/src/account.ts`:

```ts
{ data: Array<{ sessionId, createdAt, expiresAt, current }>, asOf }
```

`/conta/seguranca/sessoes` consome esse contrato de verdade: lista, ordena para revisão (sessão atual
primeiro, depois ativas mais recentes, expiradas no fim) e conta ativas versus expiradas.
`/conta/seguranca` reusa a mesma leitura para os dois números do topo, sem segunda chamada de
agregação.

**Estado derivado, não persistido:** `EXPIRED` quando `expiresAt <= agora`, `CURRENT` quando
`current === true`, `ACTIVE` no resto. Prazo vencido vence a flag `current` — sessão com prazo
passado é exibida como expirada mesmo que o servidor a marque como atual, porque o servidor vai
recusá-la.

---

## 2. O limite que a tela declara em voz alta

O contrato **não** devolve endereço de origem, dispositivo/navegador, local aproximado nem último
uso. O doc 07 pede para `SCR-ACC-007` “listar sessões ativas com sinais suficientes para revogação”, e
esses sinais **não existem hoje**.

A tela então:

- diz por extenso, num painel próprio, quais sinais faltam;
- não escreve “de onde” a sessão veio nem quem a está usando;
- não oferece botão de revogar, porque **não existe** `DELETE /v1/me/sessions/{sessionId}` nem
  “encerrar as outras”. Botão que não executa nada é pior numa tela de segurança que ausência
  declarada: o usuário acredita ter protegido a conta.

Para tornar `SCR-ACC-007` completo, a API precisa publicar:

| Método | Path | Efeito |
|---|---|---|
| `DELETE` | `/v1/me/sessions/{sessionId}` | Revoga uma sessão. Idempotente. |
| `POST` | `/v1/me/sessions/revoke-others` | Revoga todas menos a atual. Idempotente, com step-up. |

E, para cumprir “sinais suficientes”, acrescentar ao `sessionSchema` os campos que o servidor já
conhece na criação da sessão: `lastSeenAt`, `createdIp` (mascarado), `userAgentFamily` e
`approximateLocation`. Enquanto não vierem, a tela continua honesta em vez de inventar.

---

## 3. `/conta/seguranca` — o que está sem comando publicado

O hub lista, item por item, o comando que o servidor ainda não expõe, com o path esperado:

| Capacidade | Contrato esperado |
|---|---|
| Senha e recuperação | `POST /v1/auth/password-reset` |
| Passkey (WebAuthn) | `POST /v1/me/webauthn/credentials` |
| Segundo fator (TOTP) | `POST /v1/me/mfa/totp` |
| Dispositivos confiáveis | `GET /v1/me/devices` |

Nenhum botão é renderizado antes do contrato existir.

---

## 4. `/conta/seguranca/dispositivos`

`GET /v1/me/devices` não existe. A tela entra em `PageState kind="unavailable"` citando o contrato, e
mantém um painel que explica o que confiança de dispositivo significa e o que ela **não** significa:
não substitui senha, passkey ou segundo fator, e não garante identidade da pessoa. Se a rota passar a
responder com corpo ainda não fixado em contrato, a tela **não interpreta** o corpo — diz que o
formato não está definido nesta versão.

---

## 5. Evidência

```
cd apps/web
npx vitest run components/security      7 testes, 7 passando
npx tsc -p tsconfig.json --noEmit       exit 0
npx eslint components/security app/conta/seguranca     exit 0

# raiz
pnpm build      18/18 successful
  ○ /conta/seguranca
  ○ /conta/seguranca/dispositivos
  ○ /conta/seguranca/sessoes
```

Placar objetivo:

```
node tools/traceability/report-screen-routes.mjs --functional
SUPERFÍCIES: 39/95 dedicadas; 56 em CONTRACT_REQUIRED
```

---

## 6. Pendências nomeadas

- **BLOQUEIO:** revogação de sessão não existe. — **DESTRAVA COM:** `DELETE /v1/me/sessions/{id}` e
  `POST /v1/me/sessions/revoke-others`, ambos idempotentes e com step-up.
- **BLOQUEIO:** `sessionSchema` sem sinais de origem/uso. — **DESTRAVA COM:** acrescentar
  `lastSeenAt`, `createdIp` mascarado, `userAgentFamily` e `approximateLocation`.
- **BLOQUEIO:** passkey, TOTP, troca de senha e `GET /v1/me/devices` não publicados. — **DESTRAVA
  COM:** os quatro contratos da seção 3.
