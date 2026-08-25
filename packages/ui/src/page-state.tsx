import type { ReactNode } from "react";

export type PageStateKind = "empty" | "error" | "forbidden" | "unavailable" | "offline";

export interface PageStateProps {
  kind: PageStateKind;
  title: string;
  description: string;
  actions?: ReactNode;
  reference?: string;
  className?: string;
}

const marks: Record<PageStateKind, string> = {
  empty: "0",
  error: "!",
  forbidden: "×",
  unavailable: "…",
  offline: "↻",
};

export function PageState({ kind, title, description, actions, reference, className = "" }: PageStateProps) {
  return (
    <section className={`ui-page-state ui-page-state--${kind} ${className}`.trim()} aria-live={kind === "error" ? "polite" : undefined}>
      <div className="ui-page-state__content">
        <span className="ui-page-state__mark" aria-hidden="true">{marks[kind]}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        {actions ? <div className="ui-page-state__actions">{actions}</div> : null}
        {reference ? <code className="ui-page-state__reference">Referência: {reference}</code> : null}
      </div>
    </section>
  );
}
