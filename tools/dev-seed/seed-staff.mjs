#!/usr/bin/env node
/**
 * Cria a conta de STAFF de desenvolvimento local, com papel e permissões IAM.
 *
 * Por que existe: `ADM` está em 1/18 superfícies dedicadas e `MST` em 1/8 — 25
 * telas — e nenhuma delas pode sequer ser aberta, porque a autorização é
 * `default deny` e **não havia nenhuma conta com papel administrativo**. Sem
 * isso, todo trabalho em administração é escrito às cegas e verificado por
 * ninguém.
 *
 * O que ele NÃO faz, de propósito:
 *
 * - **não inventa permissão**. O papel recebe exatamente as permissões que já
 *   existem em `iam.permissions`, criadas pelas migrations. Se uma permissão
 *   nova aparecer amanhã, rode de novo e ela entra; nada é adivinhado aqui;
 *   - **não cria a conta por SQL**. A conta nasce pelo fluxo real
 *   (`POST /v1/auth/register` + verificação por e-mail no Mailpit), igual às
 *   outras contas de teste. Só o GRANT é aplicado por SQL, porque não existe
 *   rota para conceder papel — e criar essa rota sem gate de segurança seria
 *   pior que o problema;
 * - **não vale fora daqui**. Tudo tem prefixo `dev-` ou domínio `teste.local`,
 *   e `--undo` remove.
 *
 * Uso:
 *   node tools/dev-seed/seed-staff.mjs          # cria e concede
 *   node tools/dev-seed/seed-staff.mjs --undo   # remove papel e atribuição
 */

import { execFileSync } from "node:child_process";

const CONTAINER = "midas-local-postgres-1";
const DB_USER = "midas_local";
const DB_NAME = "midas_local";
const API = "http://127.0.0.1:3001";
const MAILPIT = "http://localhost:8025";

const EMAIL = "admin@teste.local";
const SENHA = "SenhaDeTeste2026!";
const ROLE_CODE = "DEV_PLATFORM_STAFF";

function psql(sql, extraArgs = []) {
  return execFileSync(
    "podman",
    ["exec", "-i", CONTAINER, "psql", "-U", DB_USER, "-d", DB_NAME, "-v", "ON_ERROR_STOP=1", ...extraArgs, "-f", "-"],
    { input: sql, encoding: "utf8" },
  );
}

function value(sql) {
  return psql(sql, ["-t", "-A"]).trim();
}

function uuidv7() {
  const ms = BigInt(Date.now()).toString(16).padStart(12, "0");
  const rand = [...crypto.getRandomValues(new Uint8Array(10))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hex = ms + "7" + rand.slice(0, 3)
    + (0x8 | (Number.parseInt(rand[3], 16) & 0x3)).toString(16) + rand.slice(4, 19);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

if (process.argv.includes("--undo")) {
  psql(`
BEGIN;
DELETE FROM iam.user_role_assignments WHERE role_id IN (SELECT role_id FROM iam.roles WHERE role_code = '${ROLE_CODE}');
DELETE FROM iam.role_permissions WHERE role_id IN (SELECT role_id FROM iam.roles WHERE role_code = '${ROLE_CODE}');
DELETE FROM iam.roles WHERE role_code = '${ROLE_CODE}';
COMMIT;
`);
  console.log(`Papel ${ROLE_CODE} e suas atribuições removidos. A conta ${EMAIL} continua existindo, sem permissão.`);
  process.exit(0);
}

// ---------------------------------------------------------------- 1. a conta

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-midas-csrf": "1" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text.slice(0, 200); }
  return { status: res.status, payload };
}

let userId = value(`SELECT user_id FROM identity.users WHERE email_normalized = '${EMAIL}';`);

if (!userId) {
  const registro = await post("/v1/auth/register", {
    email: EMAIL,
    password: SENHA,
    displayName: "Staff Teste",
    acceptedTermsVersion: "v1",
  });
  if (registro.status !== 202 && registro.status !== 201) {
    console.error(`Registro recusado (HTTP ${String(registro.status)}):`, JSON.stringify(registro.payload));
    process.exit(1);
  }

  // O token de verificação chega no Mailpit — mesmo caminho de qualquer conta.
  const caixa = await (await fetch(`${MAILPIT}/api/v1/messages?limit=20`)).json();
  const mensagem = (caixa.messages ?? []).find((m) =>
    (m.To ?? []).some((destinatario) => destinatario.Address === EMAIL));
  if (!mensagem) {
    console.error(`Conta criada, mas o e-mail de verificação não chegou ao Mailpit (${MAILPIT}).`);
    process.exit(1);
  }
  const corpo = await (await fetch(`${MAILPIT}/api/v1/message/${mensagem.ID}`)).json();
  const token = /token=([A-Za-z0-9._-]+)/.exec(`${corpo.Text ?? ""} ${corpo.HTML ?? ""}`)?.[1];
  if (!token) {
    console.error("E-mail encontrado, mas sem token de verificação reconhecível.");
    process.exit(1);
  }
  const verificacao = await post("/v1/auth/email-verifications", { token });
  if (verificacao.status >= 400) {
    console.error(`Verificação recusada (HTTP ${String(verificacao.status)}):`, JSON.stringify(verificacao.payload));
    process.exit(1);
  }
  userId = value(`SELECT user_id FROM identity.users WHERE email_normalized = '${EMAIL}';`);
  console.log(`Conta ${EMAIL} criada e verificada pelo fluxo real.`);
} else {
  console.log(`Conta ${EMAIL} já existia.`);
}

if (!userId) {
  console.error("A conta não apareceu no banco depois do registro.");
  process.exit(1);
}

// -------------------------------------------------- 2. o papel e o que ele dá

const roleId = value(`SELECT role_id FROM iam.roles WHERE role_code = '${ROLE_CODE}';`) || uuidv7();
const assignmentId = uuidv7();

psql(`
BEGIN;

INSERT INTO iam.roles (role_id, role_code, role_scope, version)
VALUES ('${roleId}', '${ROLE_CODE}', 'PLATFORM', '1')
ON CONFLICT (role_id) DO NOTHING;

-- Exatamente as permissões que as migrations criaram. Nenhuma inventada:
-- um papel com permissão que o código não conhece é falsa sensação de acesso.
INSERT INTO iam.role_permissions (role_id, permission_code)
SELECT '${roleId}', permission_code FROM iam.permissions
ON CONFLICT DO NOTHING;

INSERT INTO iam.user_role_assignments (assignment_id, user_id, role_id, assignment_status, valid_from, valid_until)
VALUES ('${assignmentId}', '${userId}', '${roleId}', 'ACTIVE', clock_timestamp(), NULL)
ON CONFLICT DO NOTHING;

COMMIT;
`);

const concedidas = value(`SELECT count(*) FROM iam.role_permissions WHERE role_id = '${roleId}';`);
const ativas = value(`
SELECT count(*) FROM iam.user_role_assignments a
JOIN iam.roles r ON r.role_id = a.role_id
WHERE a.user_id = '${userId}' AND r.role_code = '${ROLE_CODE}' AND a.assignment_status = 'ACTIVE';`);

console.log(`Papel ${ROLE_CODE}: ${concedidas} permissões · atribuições ativas para a conta: ${ativas}`);
console.log(`Entre com ${EMAIL} / ${SENHA}`);
console.log("Para remover o acesso: node tools/dev-seed/seed-staff.mjs --undo");
