import { StatusBadge, type StatusTone } from "@midas/ui";

const success = new Set(["ACTIVE", "READY", "AVAILABLE", "PAID", "COMPLETED", "DELIVERED"]);
const danger = new Set(["FAILED", "REJECTED", "RETURNED", "REVERSED", "CANCELED", "CANCELLED"]);
const warning = new Set(["PENDING", "HELD", "UNDER_REVIEW", "REQUESTED", "PROCESSING", "STALE", "FROZEN"]);

export function readableStatus(status: string) {
  return status.trim().replaceAll("_", " ").toLocaleLowerCase("pt-BR").replace(/^./, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

export function StatusLabel({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const tone: StatusTone = success.has(normalized) ? "success" : danger.has(normalized) ? "danger" : warning.has(normalized) ? "warning" : "neutral";
  return <StatusBadge tone={tone}>{readableStatus(status)}</StatusBadge>;
}
