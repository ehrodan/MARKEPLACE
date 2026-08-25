import type { HTMLAttributes, ReactNode } from "react";

export type StatusTone = "neutral" | "success" | "danger" | "warning" | "info";

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  children: ReactNode;
}

export function StatusBadge({ tone = "neutral", className = "", children, ...props }: StatusBadgeProps) {
  return (
    <span className={`ui-status ui-status--${tone} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
