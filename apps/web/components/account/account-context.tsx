"use client";

import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApiResource } from "@/hooks/use-api-resource";
import type { ApiError } from "@/lib/api-client";
import type { SellerAccountListResponse, SellerAccountSummary } from "@/lib/api-types";

interface AccountContextValue {
  sellerAccounts: SellerAccountSummary[];
  selectedSeller?: SellerAccountSummary;
  sellerAccountsStatus: "idle" | "loading" | "ready" | "error";
  sellerAccountsError?: ApiError | Error;
  retrySellerAccounts: () => void;
  selectSeller: (sellerAccountId: string) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const resource = useApiResource<SellerAccountListResponse>("/v1/me/seller-accounts");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sellerAccounts = resource.status === "ready" ? resource.data.data : [];
  const requestedId = searchParams.get("sellerAccountId");
  const selectedSeller: SellerAccountSummary | undefined = sellerAccounts.find((seller) => seller.sellerAccountId === requestedId) ?? sellerAccounts.at(0);

  const replaceScope = useCallback((sellerAccountId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sellerAccountId", sellerAccountId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (selectedSeller && requestedId !== selectedSeller.sellerAccountId) replaceScope(selectedSeller.sellerAccountId);
  }, [requestedId, replaceScope, selectedSeller]);

  const value: AccountContextValue = {
    sellerAccounts,
    selectedSeller,
    sellerAccountsStatus: resource.status,
    sellerAccountsError: resource.status === "error" ? resource.error : undefined,
    retrySellerAccounts: resource.retry,
    selectSeller: replaceScope,
  };

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccountContext(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccountContext deve ser usado dentro de AccountProvider");
  return context;
}
