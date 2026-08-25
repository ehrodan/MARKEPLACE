import type { ReactNode } from "react";
import { OperationsShell } from "@/components/operations/operations-shell";

export default function MasterLayout({ children }: { children: ReactNode }) {
  return <OperationsShell mode="master">{children}</OperationsShell>;
}
