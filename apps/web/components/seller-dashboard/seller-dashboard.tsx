"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  CircleSlash2,
  ClipboardList,
  LayoutDashboard,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
  Users,
  WalletCards,
} from "lucide-react";
import { StatusBadge, type StatusTone } from "@midas/ui";
import {
  AccountProvider,
  useAccountContext,
} from "@/components/account/account-context";
import { SellerScopeGate } from "@/components/account/seller-scope-gate";
import { BrandWordmark } from "@/components/brand-wordmark";
import { MinorMoney } from "@/components/operations/minor-money";
import { useApiResource } from "@/hooks/use-api-resource";
import { isApiError } from "@/lib/api-client";
import type { SellerAccountSummary } from "@/lib/api-types";
import {
  SELLER_ACCOUNTS_CONTRACT,
  SELLER_BALANCE_CONTRACT,
  SELLER_LISTINGS_CONTRACT,
  SELLER_ORDERS_CONTRACT,
  readSellerBalance,
  readSellerListings,
  readSellerOrders,
  sellerDashboardContractGaps,
  sellerDashboardPaths,
  sellerListingStatusLabel,
  sellerOrderStatusLabel,
  type SellerListingStatus,
  type SellerOrderStatus,
} from "./contracts";
import styles from "./seller-dashboard.module.css";

const readDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const sellerStatusCopy: Record<string, string> = {
  ACTIVE: "Ativa",
  ONBOARDING_REQUIRED: "Configuração pendente",
  SUSPENDED: "Suspensa",
};

const roleCopy: Record<string, string> = {
  OWNER: "Proprietário",
  MANAGER: "Gestor",
  OPERATOR: "Operador",
  FINANCE_VIEWER: "Consulta financeira",
};

function formatReadDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "data fora do contrato"
    : readDateFormatter.format(parsed);
}

function sellerStatusTone(status: string): StatusTone {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED") return "danger";
  return "warning";
}

function listingStatusTone(status: SellerListingStatus): StatusTone {
  if (status === "PUBLISHED") return "success";
  if (status === "REVIEW" || status === "PAUSED") return "warning";
  return "neutral";
}

function orderStatusTone(status: SellerOrderStatus): StatusTone {
  if (status === "COMPLETED") return "success";
  if (status === "DISPUTED") return "danger";
  if (status === "PENDING_PAYMENT") return "warning";
  if (status === "PAID" || status === "IN_DELIVERY") return "info";
  return "neutral";
}

function scopeQuery(sellerAccountId: string): string {
  return `?sellerAccountId=${encodeURIComponent(sellerAccountId)}`;
}

function PanelLoading({ label }: { label: string }) {
  return (
    <div className={styles.panelLoading} aria-busy="true" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  );
}

function PanelError({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  let title = "Não foi possível consultar a API";
  let detail =
    "Nenhum valor foi presumido. Tente novamente quando a conexão estiver disponível.";
  let reference: string | undefined;
  let requiresLogin = false;

  if (isApiError(error)) {
    reference = error.problem.correlationId;
    if (error.problem.status === 401) {
      title = "Sessão expirada";
      detail = "Entre novamente para consultar os dados protegidos desta conta de venda.";
      requiresLogin = true;
    } else if (error.problem.status === 404) {
      title = "Conta ou leitura não encontrada";
      detail =
        "A API não encontrou este recurso no escopo selecionado. Nenhuma conta alternativa foi usada.";
    } else {
      title = error.problem.title || title;
      detail = error.problem.detail || detail;
    }
  }

  return (
    <div className={styles.panelError} role="alert">
      <AlertCircle aria-hidden="true" size={20} />
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
        {reference ? <small>Referência: {reference}</small> : null}
        {requiresLogin ? (
          <Link href="/entrar" className={styles.inlineAction}>
            Entrar novamente <ArrowUpRight aria-hidden="true" size={14} />
          </Link>
        ) : (
          <button type="button" className={styles.retryButton} onClick={retry}>
            <RefreshCw aria-hidden="true" size={14} /> Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}

function ContractViolation({ reason }: { reason: string }) {
  return (
    <div className={styles.contractViolation} role="alert">
      <ShieldCheck aria-hidden="true" size={19} />
      <div>
        <strong>Resposta fora do contrato</strong>
        <p>{reason} O painel não substituiu o conteúdo por zero ou dado demonstrativo.</p>
      </div>
    </div>
  );
}

function Provenance({ contract, asOf }: { contract: string; asOf: string }) {
  return (
    <footer className={styles.provenance}>
      <code>{contract}</code>
      <span>
        Corte em <time dateTime={asOf}>{formatReadDate(asOf)}</time>
      </span>
    </footer>
  );
}

function PartialReadNote({
  discarded,
  hasNextPage,
}: {
  discarded: number;
  hasNextPage: boolean;
}) {
  if (discarded === 0 && !hasNextPage) return null;
  return (
    <p className={styles.partialNote} role="status">
      {hasNextPage
        ? "Este é apenas o primeiro retorno da API; existem mais registros. "
        : ""}
      {discarded > 0
        ? `${String(discarded)} ${discarded === 1 ? "linha foi descartada" : "linhas foram descartadas"} por divergência de contrato.`
        : ""}
    </p>
  );
}

function BalancePanel({ sellerAccountId }: { sellerAccountId: string }) {
  const endpoint = sellerDashboardPaths(sellerAccountId).balance;
  const resource = useApiResource<unknown>(endpoint);

  let content;
  if (resource.status === "error") {
    content = <PanelError error={resource.error} retry={resource.retry} />;
  } else if (resource.status !== "ready") {
    content = <PanelLoading label="Carregando saldo real" />;
  } else {
    const parsed = readSellerBalance(resource.data);
    if (!parsed.ok) {
      content = <ContractViolation reason={parsed.reason} />;
    } else if (parsed.value.sellerAccountId !== sellerAccountId) {
      content = (
        <ContractViolation reason="O sellerAccountId da resposta não corresponde ao contexto selecionado." />
      );
    } else {
      const balance = parsed.value;
      content = (
        <>
          <div className={styles.balanceGrid}>
            <article className={styles.balanceItem}>
              <span>Disponível</span>
              <strong>
                <MinorMoney
                  amountMinor={balance.availableAmountMinor}
                  currency={balance.currency}
                />
              </strong>
              <small>Campo availableAmountMinor</small>
            </article>
            <article className={styles.balanceItem}>
              <span>Em retenção</span>
              <strong>
                <MinorMoney
                  amountMinor={balance.heldAmountMinor}
                  currency={balance.currency}
                />
              </strong>
              <small>Campo heldAmountMinor</small>
            </article>
            <article className={styles.balanceItem}>
              <span>Reservado</span>
              <strong>
                <MinorMoney
                  amountMinor={balance.reservedAmountMinor}
                  currency={balance.currency}
                />
              </strong>
              <small>Campo reservedAmountMinor</small>
            </article>
          </div>
          <Provenance contract={SELLER_BALANCE_CONTRACT} asOf={balance.asOf} />
        </>
      );
    }
  }

  return (
    <section className={`${styles.panel} ${styles.balancePanel}`} aria-labelledby="seller-balance-title">
      <header className={styles.panelHeader}>
        <span className={styles.panelIcon} aria-hidden="true">
          <CircleDollarSign size={19} />
        </span>
        <div>
          <p>FINANCEIRO</p>
          <h2 id="seller-balance-title">Saldo por estado</h2>
        </div>
        <Link href={`/conta/carteira${scopeQuery(sellerAccountId)}`}>
          Abrir saldo <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      </header>
      <p className={styles.panelIntro}>
        Os buckets permanecem separados. Disponível não inclui retenção nem valor já reservado.
      </p>
      {content}
    </section>
  );
}

function ListingsPanel({ sellerAccountId }: { sellerAccountId: string }) {
  const endpoint = sellerDashboardPaths(sellerAccountId).listings;
  const resource = useApiResource<unknown>(endpoint);

  let content;
  if (resource.status === "error") {
    content = <PanelError error={resource.error} retry={resource.retry} />;
  } else if (resource.status !== "ready") {
    content = <PanelLoading label="Carregando anúncios reais" />;
  } else {
    const parsed = readSellerListings(resource.data);
    if (!parsed.ok) {
      content = <ContractViolation reason={parsed.reason} />;
    } else {
      const page = parsed.value;
      const scopedRows = page.rows.filter(
        (row) => row.sellerAccountId === sellerAccountId,
      );
      const scopeDiscarded = page.rows.length - scopedRows.length;
      content = (
        <>
          <div className={styles.panelCount}>
            <strong>{scopedRows.length}</strong>
            <span>
              {scopedRows.length === 1
                ? "anúncio válido neste retorno"
                : "anúncios válidos neste retorno"}
            </span>
          </div>
          {scopedRows.length === 0 ? (
            <div className={styles.emptyPanel}>
              <Boxes aria-hidden="true" size={24} />
              <strong>Nenhum anúncio neste retorno</strong>
              <p>A API respondeu sem linha válida para esta conta. Nenhum item de exemplo foi inserido.</p>
              <Link href={`/vender/novo${scopeQuery(sellerAccountId)}`}>Criar anúncio</Link>
            </div>
          ) : (
            <ul className={styles.dataList}>
              {scopedRows.map((listing) => (
                <li key={listing.listingId}>
                  <div className={styles.rowIdentity}>
                    <strong>{listing.itemName}</strong>
                    <span>Estoque retornado: {listing.quantityAvailable}</span>
                  </div>
                  <MinorMoney
                    className={styles.rowMoney}
                    amountMinor={listing.priceMinor}
                    currency={listing.currency}
                  />
                  <StatusBadge tone={listingStatusTone(listing.listingStatus)}>
                    {sellerListingStatusLabel(listing.listingStatus)}
                  </StatusBadge>
                  <Link
                    aria-label={`Abrir anúncio ${listing.itemName}`}
                    href={`/vender/anuncios/${encodeURIComponent(listing.listingId)}${scopeQuery(sellerAccountId)}`}
                  >
                    <ArrowUpRight aria-hidden="true" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <PartialReadNote
            discarded={page.discarded + scopeDiscarded}
            hasNextPage={page.nextCursor !== null}
          />
          <Provenance contract={SELLER_LISTINGS_CONTRACT} asOf={page.asOf} />
        </>
      );
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="seller-listings-title">
      <header className={styles.panelHeader}>
        <span className={styles.panelIcon} aria-hidden="true">
          <ClipboardList size={19} />
        </span>
        <div>
          <p>CATÁLOGO</p>
          <h2 id="seller-listings-title">Anúncios recentes</h2>
        </div>
        <Link href={`/vender/anuncios${scopeQuery(sellerAccountId)}`}>
          Ver anúncios <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      </header>
      {content}
    </section>
  );
}

function OrdersPanel({ sellerAccountId }: { sellerAccountId: string }) {
  const endpoint = sellerDashboardPaths(sellerAccountId).orders;
  const resource = useApiResource<unknown>(endpoint);

  let content;
  if (resource.status === "error") {
    content = <PanelError error={resource.error} retry={resource.retry} />;
  } else if (resource.status !== "ready") {
    content = <PanelLoading label="Carregando pedidos de venda reais" />;
  } else {
    const parsed = readSellerOrders(resource.data);
    if (!parsed.ok) {
      content = <ContractViolation reason={parsed.reason} />;
    } else {
      const page = parsed.value;
      content = (
        <>
          <div className={styles.panelCount}>
            <strong>{page.rows.length}</strong>
            <span>
              {page.rows.length === 1
                ? "pedido válido neste retorno"
                : "pedidos válidos neste retorno"}
            </span>
          </div>
          {page.rows.length === 0 ? (
            <div className={styles.emptyPanel}>
              <Store aria-hidden="true" size={24} />
              <strong>Nenhum pedido neste retorno</strong>
              <p>A API respondeu sem pedidos. A tela não simulou vendas nem faturamento.</p>
              <Link href={`/vender/anuncios${scopeQuery(sellerAccountId)}`}>Revisar anúncios</Link>
            </div>
          ) : (
            <ul className={styles.dataList}>
              {page.rows.map((order) => (
                <li key={order.orderId}>
                  <div className={styles.rowIdentity}>
                    <strong>{order.publicCode}</strong>
                    <span>
                      <time dateTime={order.placedAt}>{formatReadDate(order.placedAt)}</time>
                    </span>
                  </div>
                  <MinorMoney
                    className={styles.rowMoney}
                    amountMinor={order.totalMinor}
                    currency={order.currency}
                  />
                  <StatusBadge tone={orderStatusTone(order.status)}>
                    {sellerOrderStatusLabel(order.status)}
                  </StatusBadge>
                  <Link
                    aria-label={`Abrir pedido ${order.publicCode}`}
                    href={`/conta/vendas/${encodeURIComponent(order.orderId)}${scopeQuery(sellerAccountId)}`}
                  >
                    <ArrowUpRight aria-hidden="true" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <PartialReadNote
            discarded={page.discarded}
            hasNextPage={page.nextCursor !== null}
          />
          <Provenance contract={SELLER_ORDERS_CONTRACT} asOf={page.asOf} />
        </>
      );
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="seller-orders-title">
      <header className={styles.panelHeader}>
        <span className={styles.panelIcon} aria-hidden="true">
          <Store size={19} />
        </span>
        <div>
          <p>VENDAS</p>
          <h2 id="seller-orders-title">Pedidos recentes</h2>
        </div>
        <Link href={`/conta/vendas${scopeQuery(sellerAccountId)}`}>
          Abrir vendas <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      </header>
      {content}
    </section>
  );
}

function ContractGaps() {
  return (
    <section className={styles.gaps} aria-labelledby="seller-gaps-title">
      <header>
        <div>
          <span>LIMITES DESTE CORTE</span>
          <h2 id="seller-gaps-title">Sem dado, sem número decorativo</h2>
        </div>
        <CircleSlash2 aria-hidden="true" size={30} />
      </header>
      <div className={styles.gapGrid}>
        {sellerDashboardContractGaps.map((gap) => (
          <article key={gap.code}>
            <code>CONTRACT_REQUIRED · {gap.code}</code>
            <h3>{gap.label}</h3>
            <p>{gap.reason}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SellerIdentity({ seller }: { seller: SellerAccountSummary }) {
  return (
    <section className={styles.identity} aria-labelledby="seller-identity-title">
      <div className={styles.identityMark} aria-hidden="true">
        {seller.displayName.slice(0, 2).toUpperCase()}
      </div>
      <div className={styles.identityCopy}>
        <span>SELLERACCOUNT SELECIONADO</span>
        <h1 id="seller-identity-title">{seller.displayName}</h1>
        <p>
          <code>{seller.sellerAccountId}</code> · versão {seller.version}
        </p>
      </div>
      <div className={styles.identityFacts}>
        <div>
          <small>Estado registrado</small>
          <StatusBadge tone={sellerStatusTone(seller.sellerAccountStatus)}>
            {sellerStatusCopy[seller.sellerAccountStatus] ?? seller.sellerAccountStatus}
          </StatusBadge>
        </div>
        <div>
          <small>Seu papel</small>
          <strong>
            {seller.membershipRole
              ? roleCopy[seller.membershipRole] ?? seller.membershipRole
              : "Não informado"}
          </strong>
        </div>
      </div>
      <p className={styles.identityNote}>
        Estado e papel vêm de <code>{SELLER_ACCOUNTS_CONTRACT}</code>. Eles não viram
        permissão presumida no cliente; cada ação continua sendo validada pela API.
      </p>
    </section>
  );
}

function QuickActions({ sellerAccountId }: { sellerAccountId: string }) {
  const query = scopeQuery(sellerAccountId);
  const actions = [
    { href: `/vender/novo${query}`, label: "Novo anúncio", icon: Plus },
    { href: `/vender/anuncios${query}`, label: "Gerir anúncios", icon: Boxes },
    { href: `/conta/vendas${query}`, label: "Ver vendas", icon: Store },
    { href: `/conta/carteira${query}`, label: "Abrir saldo", icon: WalletCards },
    { href: `/vender/equipe${query}`, label: "Equipe", icon: Users },
  ] as const;

  return (
    <nav className={styles.quickActions} aria-label="Ações do vendedor">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link href={action.href} key={action.href}>
            <Icon aria-hidden="true" size={17} />
            <span>{action.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ScopedDashboard({ seller }: { seller: SellerAccountSummary }) {
  return (
    <div className={styles.dashboardStack} key={seller.sellerAccountId}>
      <SellerIdentity seller={seller} />
      <QuickActions sellerAccountId={seller.sellerAccountId} />
      <div className={styles.panelGrid}>
        <BalancePanel sellerAccountId={seller.sellerAccountId} />
        <ListingsPanel sellerAccountId={seller.sellerAccountId} />
        <OrdersPanel sellerAccountId={seller.sellerAccountId} />
      </div>
      <ContractGaps />
    </div>
  );
}

function SellerDashboardFrame() {
  const {
    sellerAccounts,
    selectedSeller,
    sellerAccountsStatus,
    selectSeller,
  } = useAccountContext();
  const query = selectedSeller ? scopeQuery(selectedSeller.sellerAccountId) : "";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <BrandWordmark href="/" />
        <div className={styles.workspaceName}>
          <span>WORKSPACE</span>
          <strong>Central do vendedor</strong>
        </div>
        <nav className={styles.sideNav} aria-label="Central do vendedor">
          <Link href={`/vender${query}`} aria-current="page">
            <LayoutDashboard aria-hidden="true" size={18} /> Visão geral
          </Link>
          <Link href={`/vender/anuncios${query}`}>
            <Boxes aria-hidden="true" size={18} /> Anúncios
          </Link>
          <Link href={`/conta/vendas${query}`}>
            <Store aria-hidden="true" size={18} /> Vendas
          </Link>
          <Link href={`/conta/carteira${query}`}>
            <WalletCards aria-hidden="true" size={18} /> Saldo
          </Link>
          <Link href={`/vender/equipe${query}`}>
            <Users aria-hidden="true" size={18} /> Equipe
          </Link>
        </nav>
        <div className={styles.sidebarTruth}>
          <ShieldCheck aria-hidden="true" size={18} />
          <p>Somente leituras registradas. Sem faturamento, gráfico ou alerta inventado.</p>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <span>SCR-SEL-002</span>
            <strong>Painel operacional</strong>
          </div>
          <div className={styles.scopeControl}>
            <label htmlFor="seller-dashboard-scope">Conta de venda</label>
            <select
              id="seller-dashboard-scope"
              value={selectedSeller?.sellerAccountId ?? ""}
              disabled={sellerAccountsStatus !== "ready" || sellerAccounts.length === 0}
              onChange={(event) => {
                selectSeller(event.target.value);
              }}
            >
              {sellerAccounts.length === 0 ? (
                <option value="">
                  {sellerAccountsStatus === "loading" ? "Carregando…" : "Nenhuma conta"}
                </option>
              ) : (
                sellerAccounts.map((seller) => (
                  <option value={seller.sellerAccountId} key={seller.sellerAccountId}>
                    {seller.displayName}
                  </option>
                ))
              )}
            </select>
          </div>
        </header>

        <main id="conteudo-principal" className={styles.main}>
          <header className={styles.intro}>
            <div>
              <span>OPERAÇÃO REAL · PRIMEIRO RETORNO</span>
              <h2>O que exige atenção agora</h2>
              <p>
                Anúncios, pedidos e saldo da conta selecionada. Contagens representam apenas as
                linhas carregadas nesta leitura, nunca o total histórico.
              </p>
            </div>
            <BarChart3 aria-hidden="true" size={42} />
          </header>
          <SellerScopeGate>
            {selectedSeller ? (
              <ScopedDashboard
                seller={selectedSeller}
                key={selectedSeller.sellerAccountId}
              />
            ) : null}
          </SellerScopeGate>
        </main>
      </div>
    </div>
  );
}

export function SellerDashboard() {
  return (
    <AccountProvider>
      <SellerDashboardFrame />
    </AccountProvider>
  );
}

export function SellerDashboardFallback() {
  return (
    <main className={styles.fallback} aria-busy="true" aria-label="Preparando painel do vendedor">
      <BrandWordmark href="/" />
      <div>
        <span />
        <span />
        <span />
      </div>
      <p>Preparando contexto de venda…</p>
    </main>
  );
}
