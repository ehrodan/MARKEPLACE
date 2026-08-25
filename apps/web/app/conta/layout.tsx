import { Suspense, type ReactNode } from "react";
import { AccountShell } from "@/components/account/account-shell";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="account-shell"><main id="conteudo-principal" className="account-content" aria-busy="true">Preparando sua conta…</main></div>}><AccountShell>{children}</AccountShell></Suspense>;
}
