"use client";

/**
 * Aceite versionado de política no checkout (SCR-BUY-003).
 *
 * Regras que este componente aplica, sem exceção:
 * 1. a caixa NUNCA nasce marcada (docs/03 §10 — consentimento pré-marcado é proibido);
 * 2. o rótulo diz QUAL política e QUAL versão, com vigência e link para o documento;
 * 3. sem aceite, o motivo do bloqueio fica visível em texto, associado ao campo por
 *    `aria-describedby` — não existe botão cinza mudo;
 * 4. sem snapshot de política vindo do servidor não há aceite: a tela declara o
 *    contrato ausente em vez de carimbar uma versão inventada.
 */

import { FileText } from "lucide-react";
import { StatusBadge } from "@midas/ui";
import { formatDateTime } from "@/lib/date-format";
import styles from "./checkout.module.css";

/** Snapshot versionado de política, como publicado pelo servidor. */
export interface PolicySnapshot {
  policyId: string;
  title: string;
  version: string;
  /** ISO-8601 de início de vigência. */
  effectiveFrom: string;
  documentHref: string;
}

export interface PolicyAcceptanceProps {
  /** `null` quando o servidor ainda não publica o snapshot versionado. */
  policy: PolicySnapshot | null;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  /** Rota canônica consultada, citada quando o snapshot não existe. */
  contractPath: string;
  disabled?: boolean;
}

const FIELD_ID = "checkout-policy-acceptance";
const HELP_ID = "checkout-policy-acceptance-help";
const BLOCK_ID = "checkout-policy-acceptance-block";

export function PolicyAcceptance({
  policy,
  accepted,
  onAcceptedChange,
  contractPath,
  disabled = false,
}: PolicyAcceptanceProps) {
  if (!policy) {
    return (
      <section className={styles.policyCard} aria-labelledby="checkout-policy-title">
        <div className={styles.policyHeading}>
          <FileText aria-hidden="true" size={18} />
          <h2 id="checkout-policy-title">Aceite da política</h2>
          <StatusBadge tone="warning">CONTRACT_REQUIRED</StatusBadge>
        </div>
        <p className={styles.policyBlocked} role="note">
          O servidor não publicou o snapshot versionado da política deste checkout, então não existe
          versão para aceitar. Registrar um aceite sem versão vinculada não tem valor probatório e não
          será feito aqui.
        </p>
        <p className={styles.contractNote}>
          Contrato consultado: <code>{contractPath}</code>
        </p>
      </section>
    );
  }

  return (
    <section className={styles.policyCard} aria-labelledby="checkout-policy-title">
      <div className={styles.policyHeading}>
        <FileText aria-hidden="true" size={18} />
        <h2 id="checkout-policy-title">Aceite da política</h2>
        <StatusBadge tone={accepted ? "success" : "neutral"}>
          {accepted ? "ACEITE REGISTRADO NESTA SESSÃO" : "ACEITE PENDENTE"}
        </StatusBadge>
      </div>

      <div className={styles.policyField}>
        <input
          type="checkbox"
          id={FIELD_ID}
          name="policyAcceptance"
          checked={accepted}
          disabled={disabled}
          aria-describedby={accepted ? HELP_ID : `${HELP_ID} ${BLOCK_ID}`}
          onChange={(event) => { onAcceptedChange(event.target.checked); }}
        />
        <label htmlFor={FIELD_ID}>
          Li e aceito a <strong>{policy.title}</strong>, versão <strong>{policy.version}</strong>,
          vigente desde {formatDateTime(policy.effectiveFrom)}.
        </label>
      </div>

      <p id={HELP_ID} className={styles.policyHelp}>
        O aceite vale para esta versão exata do documento.{" "}
        <a className="text-link" href={policy.documentHref}>
          Ler a {policy.title} (versão {policy.version})
        </a>
        .
      </p>

      {!accepted ? (
        <p id={BLOCK_ID} className={styles.policyBlocked}>
          Enquanto o aceite desta versão não for marcado, o checkout não avança para o provedor de
          pagamento.
        </p>
      ) : null}

      <p className={styles.contractNote}>
        Referência da política: <code>{policy.policyId}</code>
      </p>
    </section>
  );
}
