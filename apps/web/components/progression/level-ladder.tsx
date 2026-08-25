import { StatusBadge } from "@midas/ui";
import { formatMinorAmount } from "@/components/operations/minor-money";
import styles from "./progression.module.css";

/**
 * Escada de níveis 1–10 do vendedor — peça central de /recompensas.
 *
 * FONTE CANÔNICA DOS VALORES (não digitados a mão):
 *   `modules/progression/src/level-policy.ts` → `INITIAL_ACCOUNT_LEVEL_POLICY`
 *   (version "account-level-brl.v1", currency "BRL").
 *
 * O pacote `@midas/progression` existe no workspace pnpm, mas ainda não é
 * dependência de `@midas/web` (`apps/web/package.json` declara apenas
 * `@midas/ui`, e `apps/web/node_modules/@midas` só resolve `ui`). Declarar
 * dependência nova está fora da propriedade desta entrega e exigiria um
 * `pnpm install`. Por isso o espelho abaixo é literal e fica travado por
 * teste: `components/progression/level-ladder.test.tsx` importa a policy real
 * do domínio e reprova qualquer divergência de faixa, ordem, moeda ou versão.
 *
 * Faixas idênticas em `docs/13-PAGAMENTOS-REPUTACAO-PROGRESSAO.md` seção 12.2:
 * "acima de" é literal — o valor exato do limite ainda pertence ao nível
 * anterior.
 *
 * Dinheiro: sempre minor units inteiras. A formatação usa
 * `formatMinorAmount` (`components/operations/minor-money.tsx`), que converte
 * por BigInt e nunca faz aritmética de ponto flutuante sobre valor monetário.
 */

export type AccountLevelCode =
  | "L1" | "L2" | "L3" | "L4" | "L5"
  | "L6" | "L7" | "L8" | "L9" | "L10";

export interface LadderLevel {
  readonly level: AccountLevelCode;
  readonly ordinal: number;
  readonly minInclusiveMinor: number;
  readonly maxInclusiveMinor: number | null;
}

export const ACCOUNT_LEVEL_POLICY_VERSION = "account-level-brl.v1";
export const ACCOUNT_LEVEL_CURRENCY = "BRL";

const ladderEntries: readonly LadderLevel[] = [
  { level: "L1", ordinal: 1, minInclusiveMinor: 0, maxInclusiveMinor: 10_000 },
  { level: "L2", ordinal: 2, minInclusiveMinor: 10_001, maxInclusiveMinor: 50_000 },
  { level: "L3", ordinal: 3, minInclusiveMinor: 50_001, maxInclusiveMinor: 100_000 },
  { level: "L4", ordinal: 4, minInclusiveMinor: 100_001, maxInclusiveMinor: 300_000 },
  { level: "L5", ordinal: 5, minInclusiveMinor: 300_001, maxInclusiveMinor: 500_000 },
  { level: "L6", ordinal: 6, minInclusiveMinor: 500_001, maxInclusiveMinor: 750_000 },
  { level: "L7", ordinal: 7, minInclusiveMinor: 750_001, maxInclusiveMinor: 1_000_000 },
  { level: "L8", ordinal: 8, minInclusiveMinor: 1_000_001, maxInclusiveMinor: 2_000_000 },
  { level: "L9", ordinal: 9, minInclusiveMinor: 2_000_001, maxInclusiveMinor: 5_000_000 },
  { level: "L10", ordinal: 10, minInclusiveMinor: 5_000_001, maxInclusiveMinor: null },
];

export const ACCOUNT_LEVEL_LADDER: readonly LadderLevel[] = Object.freeze(
  ladderEntries.map((entry) => Object.freeze(entry)),
);

/** Regra de progressão literal de `docs/13` seção 12.1. */
export const QUALIFIED_GMV_FORMULA = [
  "qualifiedLifetimeGmvMinor = soma do valor bruto de mercadoria em BRL",
  "                            de Orders concluídos e Payments liquidados",
  "                            menos refunds e chargebacks canônicos",
].join("\n");

/**
 * Benefício por nível: nenhuma `RewardDefinition` está publicada nesta versão.
 * O slot permanece declarado e vazio — a tela nunca o preenche com promessa.
 * Regra em `docs/13-PAGAMENTOS-REPUTACAO-PROGRESSAO.md` seção 13.1: o painel
 * Master publica nome, termos, vigência, elegibilidade e fulfillment antes de
 * qualquer concessão existir.
 */
export const UNPUBLISHED_REWARD_LABEL = "Premiação ainda não publicada";

function brl(amountMinor: number): string {
  return formatMinorAmount(amountMinor, ACCOUNT_LEVEL_CURRENCY);
}

/** Critério de entrada no nível, derivado da faixa da policy. */
export function levelCriterion(entry: LadderLevel): string {
  if (entry.maxInclusiveMinor === null) {
    return `Acima de ${brl(entry.minInclusiveMinor - 1)}`;
  }
  if (entry.minInclusiveMinor === 0) {
    return `De ${brl(0)} até ${brl(entry.maxInclusiveMinor)}`;
  }
  return `Acima de ${brl(entry.minInclusiveMinor - 1)} até ${brl(entry.maxInclusiveMinor)}`;
}

/** Intervalo exato em centavos, como o domínio guarda. */
export function levelIntervalMinor(entry: LadderLevel): string {
  const min = String(entry.minInclusiveMinor);
  return entry.maxInclusiveMinor === null
    ? `${min}..`
    : `${min}..${String(entry.maxInclusiveMinor)}`;
}

export function LevelLadder() {
  return (
    <section className={styles.section} aria-labelledby="escada-de-niveis">
      <header className={styles.sectionHead}>
        <span className={styles.eyebrow}>ESCADA DE NÍVEIS</span>
        <h2 id="escada-de-niveis">Dez faixas, um critério.</h2>
        <p className={styles.lede}>
          O nível corrente é a faixa em que o valor vendido qualificado da conta cai.
          Nenhum nível é comprado, atribuído à mão ou acelerado.
        </p>
      </header>

      <p className={styles.notice}>
        <strong>Benefício por nível:</strong> nenhuma recompensa foi publicada nesta versão.
        Cada faixa mantém o slot declarado e vazio até existir definição versionada com termos,
        vigência e elegibilidade. Esta tela não preenche o espaço com insígnia inventada.
      </p>

      <ol className={styles.ladder} role="list">
        {ACCOUNT_LEVEL_LADDER.map((entry) => (
          <li className={styles.ladderItem} key={entry.level}>
            <span className={styles.ladderOrdinal} aria-hidden="true">{entry.ordinal}</span>
            <div className={styles.ladderBody}>
              <h3 className={styles.ladderTitle}>
                Nível {entry.ordinal}{" "}
                <code className={styles.ladderCode}>{entry.level}</code>
              </h3>

              <p className={styles.ladderCriterion}>
                <span className={styles.fieldLabel}>Critério</span>
                <strong>{levelCriterion(entry)}</strong>
                <span className={styles.ladderUnit}>em valor vendido qualificado (BRL)</span>
              </p>

              <p className={styles.ladderBenefit}>
                <span className={styles.fieldLabel}>Benefício</span>
                <StatusBadge tone="neutral">{UNPUBLISHED_REWARD_LABEL}</StatusBadge>
              </p>

              <details className={styles.rule}>
                <summary>Abrir regra do nível {entry.ordinal}</summary>
                <dl className={styles.ruleList}>
                  <div>
                    <dt>Intervalo em centavos</dt>
                    <dd><code>{levelIntervalMinor(entry)}</code></dd>
                  </div>
                  <div>
                    <dt>Piso</dt>
                    <dd>
                      {entry.minInclusiveMinor === 0
                        ? "Faixa inicial: começa em zero centavo, sem venda registrada."
                        : `"Acima de" é literal: ${brl(entry.minInclusiveMinor - 1)} ainda pertence ao nível ${String(entry.ordinal - 1)}.`}
                    </dd>
                  </div>
                  <div>
                    <dt>Teto</dt>
                    <dd>
                      {entry.maxInclusiveMinor === null
                        ? "Faixa final: sem limite superior."
                        : `${brl(entry.maxInclusiveMinor)} ainda pertence a este nível.`}
                    </dd>
                  </div>
                  <div>
                    <dt>Versão da política</dt>
                    <dd><code>{ACCOUNT_LEVEL_POLICY_VERSION}</code></dd>
                  </div>
                </dl>
              </details>
            </div>
          </li>
        ))}
      </ol>

      <p className={styles.sourceNote}>
        Faixas conforme <code>{ACCOUNT_LEVEL_POLICY_VERSION}</code>, moeda{" "}
        <code>{ACCOUNT_LEVEL_CURRENCY}</code>. Origem no domínio:{" "}
        <code>modules/progression/src/level-policy.ts</code>. Trocar faixa não reescreve
        histórico: publica-se novo conjunto versionado.
      </p>
    </section>
  );
}
