import { DatabaseZap } from "lucide-react";
import { Freshness } from "@midas/ui";
import styles from "./account-dashboard.module.css";

export function DataProvenance({
  source,
  scope,
  asOf,
  freshness,
}: {
  source: string;
  scope: string;
  asOf: string;
  freshness?: "READY" | "STALE";
}) {
  return (
    <div className={styles.provenance} role="status">
      <div className={styles.provenanceMain}>
        <DatabaseZap className={styles.provenanceIcon} aria-hidden="true" size={19} />
        <div className={styles.provenanceCopy}>
          <strong>Leitura da fonte canônica</strong>
          <span>{source} · {scope}</span>
        </div>
      </div>
      <Freshness asOf={asOf} state={freshness} />
    </div>
  );
}
