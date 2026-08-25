import { DatabaseZap } from "lucide-react";
import { Freshness } from "@midas/ui";
import styles from "./operations-dashboard.module.css";

export function OperationsSourceBar({ source, scope, asOf }: {
  source: string;
  scope: string;
  asOf: string;
}) {
  return (
    <div className={styles.sourceBar} role="status">
      <div className={styles.sourceMain}>
        <DatabaseZap aria-hidden="true" size={19} />
        <div className={styles.sourceCopy}>
          <strong>Fonte operacional canônica</strong>
          <span>{source} · {scope}</span>
        </div>
      </div>
      <Freshness asOf={asOf} />
    </div>
  );
}
