import type { CSSProperties, HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}

export function Skeleton({ width = "100%", height = "1rem", style, className = "", ...props }: SkeletonProps) {
  return <div className={`ui-skeleton ${className}`.trim()} style={{ width, height, ...style }} aria-hidden="true" {...props} />;
}
