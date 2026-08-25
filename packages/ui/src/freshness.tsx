export interface FreshnessProps {
  asOf: string;
  state?: "READY" | "STALE";
  label?: string;
}

export function Freshness({ asOf, state = "READY", label = "Atualizado" }: FreshnessProps) {
  const date = new Date(asOf);
  const valid = !Number.isNaN(date.getTime());
  const text = valid
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date)
    : asOf;

  return (
    <span className="ui-freshness" data-state={state}>
      <span aria-hidden="true">{state === "STALE" ? "!" : "●"}</span>
      <span>{state === "STALE" ? "Dados desatualizados" : label}: <time dateTime={valid ? date.toISOString() : undefined}>{text}</time></span>
    </span>
  );
}
