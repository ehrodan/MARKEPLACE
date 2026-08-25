import type { ReactNode } from "react";
import { OperationsShell } from "@/components/operations/operations-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <OperationsShell mode="admin">{children}</OperationsShell>;
}
