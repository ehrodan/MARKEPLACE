import type { HTMLAttributes, ReactNode } from "react";

type PanelElement = "div" | "section" | "article" | "aside";

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: PanelElement;
  /**
   * Interactive = card clicável. Permite elevação/hover (doc 18 §8);
   * card estático permanece plano — affordance sem ornamento.
   */
  interactive?: boolean;
  children: ReactNode;
}

export function Panel({
  as: Element = "section",
  interactive = false,
  className = "",
  children,
  ...props
}: PanelProps) {
  const classes = ["ui-panel", interactive && "ui-panel--interactive", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Element className={classes} {...props}>
      {children}
    </Element>
  );
}

export function PanelKicker({ children }: { children: ReactNode }) {
  return <span className="ui-panel__kicker">{children}</span>;
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return <h3 className="ui-panel__title">{children}</h3>;
}

export function PanelActions({ children }: { children: ReactNode }) {
  return <div className="ui-panel__actions">{children}</div>;
}