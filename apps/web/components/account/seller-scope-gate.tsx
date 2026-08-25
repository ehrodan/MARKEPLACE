"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { PageState } from "@midas/ui";
import { ResourceError, ResourceLoading } from "@/components/resource-state";
import { useAccountContext } from "./account-context";

export function SellerScopeGate({ children }: { children: ReactNode }) {
  const { selectedSeller, sellerAccountsStatus, sellerAccountsError, retrySellerAccounts } = useAccountContext();
  if (sellerAccountsStatus === "loading" || sellerAccountsStatus === "idle") return <ResourceLoading label="Carregando contexto de venda" />;
  if (sellerAccountsStatus === "error" && sellerAccountsError) return <ResourceError error={sellerAccountsError} retry={retrySellerAccounts} />;
  if (!selectedSeller) return <PageState kind="empty" title="Você ainda não tem um contexto de venda" description="Crie sua SellerAccount para separar a operação comercial da sua identidade pessoal, sem duplicar cadastro ou senha." actions={<Link className="button-link" href="/vender/cadastro">Começar a vender</Link>} />;
  return children;
}
