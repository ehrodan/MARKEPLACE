import { Panel } from "@midas/ui";
import { CircleSlash, Sigma, Server } from "lucide-react";
import styles from "./sales.module.css";

/**
 * Métrica do painel do vendedor.
 *
 * Regra de projeto (docs/03 §10 e guardrail de dado real): é IMPOSSÍVEL, POR TIPO,
 * renderizar um número sem declarar de onde ele veio e em que corte foi lido.
 *
 * - A variante `PUBLISHED` exige `value` + `source` + `asOf` juntos. Faltando qualquer
 *   um dos três, o objeto não é atribuível a `SalesMetric` e o build falha.
 * - A variante `NOT_PUBLISHED` não possui a propriedade `value`. Um literal
 *   `{ state: "NOT_PUBLISHED", value: ... }` é rejeitado pelo excess property check.
 *
 * Ou seja: não existe caminho de código que pinte "R$ 24.980,90" sem fonte.
 */
export type MetricValue =
  | { readonly kind: "MONEY"; readonly amountMinor: string; readonly currency: string }
  | { readonly kind: "COUNT"; readonly count: number };

/**
 * Procedência obrigatória. `SERVER_FIELD` é leitura direta de um campo do contrato.
 * `DERIVED_FROM_PAGE` é agregação feita no cliente sobre as linhas que a API devolveu —
 * nunca uma projeção estimada, e a derivação precisa ser descrita em português.
 */
export type MetricSource =
  | { readonly kind: "SERVER_FIELD"; readonly endpoint: string; readonly field: string }
  | { readonly kind: "DERIVED_FROM_PAGE"; readonly endpoint: string; readonly derivation: string };

export type SalesMetric =
  | {
      readonly state: "PUBLISHED";
      readonly code: string;
      readonly label: string;
      readonly value: MetricValue;
      readonly source: MetricSource;
      readonly asOf: string;
    }
  | {
      readonly state: "NOT_PUBLISHED";
      readonly code: string;
      readonly label: string;
      /** Contrato canônico que precisa existir para esta métrica ser publicada. */
      readonly contract: string;
      readonly reason: string;
    };

/** Formata unidades mínimas sem passar por Number quando o valor excede o inteiro seguro. */
export function formatMinorUnits(
  amountMinor: string,
  currency: string,
  locale = "pt-BR",
): string | null {
  if (!/^\d+$/u.test(amountMinor)) return null;
  if (!/^[A-Z]{3}$/u.test(currency)) return null;

  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    });
  } catch {
    return null;
  }

  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const magnitude = BigInt(amountMinor);
  const divisor = 10n ** BigInt(fractionDigits);

  if (magnitude <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return formatter.format(Number(magnitude) / 10 ** fractionDigits);
  }

  const groupedMajor = new Intl.NumberFormat(locale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(magnitude / divisor);
  const fraction = (magnitude % divisor).toString().padStart(fractionDigits, "0");
  let integerWritten = false;

  return formatter
    .formatToParts(0)
    .map((part) => {
      if (part.type === "integer" && !integerWritten) {
        integerWritten = true;
        return groupedMajor;
      }
      if (part.type === "fraction") return fraction;
      return part.value;
    })
    .join("");
}

/** Soma unidades mínimas em BigInt. Devolve null se qualquer parcela sair do contrato. */
export function sumMinorUnits(values: readonly string[]): string | null {
  let total = 0n;
  for (const value of values) {
    if (!/^\d+$/u.test(value)) return null;
    total += BigInt(value);
  }
  return total.toString();
}

/** Subtrai unidades mínimas em BigInt, sem permitir resultado negativo silencioso. */
export function subtractMinorUnits(minuend: string, subtrahend: string): string | null {
  if (!/^\d+$/u.test(minuend) || !/^\d+$/u.test(subtrahend)) return null;
  const result = BigInt(minuend) - BigInt(subtrahend);
  return result < 0n ? null : result.toString();
}

const readAtFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function readAt(asOf: string): string | null {
  const parsed = new Date(asOf);
  return Number.isNaN(parsed.getTime()) ? null : readAtFormatter.format(parsed);
}

function renderValue(value: MetricValue): string | null {
  if (value.kind === "MONEY") return formatMinorUnits(value.amountMinor, value.currency);
  if (!Number.isInteger(value.count) || value.count < 0) return null;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value.count);
}

function UnpublishedMetric({ label, contract, reason }: {
  label: string;
  contract: string;
  reason: string;
}) {
  return (
    <Panel as="article" className={`${styles.metricCard} ${styles.metricCardEmpty}`}>
      <h3 className={styles.metricLabel}>{label}</h3>
      <p className={styles.metricUnpublished}>
        <CircleSlash aria-hidden="true" size={17} />
        <span>Métrica ainda não publicada</span>
      </p>
      <p className={styles.metricReason}>{reason}</p>
      <p className={styles.metricSource}>
        Contrato necessário: <code>{contract}</code>
      </p>
    </Panel>
  );
}

export function SalesMetricCard({ metric }: { metric: SalesMetric }) {
  if (metric.state === "NOT_PUBLISHED") {
    return <UnpublishedMetric label={metric.label} contract={metric.contract} reason={metric.reason} />;
  }

  const formatted = renderValue(metric.value);
  if (formatted === null) {
    return (
      <UnpublishedMetric
        label={metric.label}
        contract={metric.source.endpoint}
        reason="A API respondeu com um valor fora do contrato de unidades mínimas. Nada foi arredondado nem substituído."
      />
    );
  }

  const capturedAt = readAt(metric.asOf);

  return (
    <Panel as="article" className={styles.metricCard}>
      <h3 className={styles.metricLabel}>{metric.label}</h3>
      <strong className={styles.metricValue}>{formatted}</strong>
      <p className={styles.metricSource}>
        {metric.source.kind === "SERVER_FIELD" ? (
          <>
            <Server aria-hidden="true" size={14} />
            <span>
              Campo <code>{metric.source.field}</code> de <code>{metric.source.endpoint}</code>
            </span>
          </>
        ) : (
          <>
            <Sigma aria-hidden="true" size={14} />
            <span>
              {metric.source.derivation} — sobre as linhas devolvidas por{" "}
              <code>{metric.source.endpoint}</code>
            </span>
          </>
        )}
      </p>
      {capturedAt ? (
        <p className={styles.metricAsOf}>
          Leitura em <time dateTime={metric.asOf}>{capturedAt}</time>
        </p>
      ) : null}
    </Panel>
  );
}
