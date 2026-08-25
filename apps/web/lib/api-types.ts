export interface ProblemFieldError {
  field: string;
  message: string;
  code?: string;
}

export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  code?: string;
  detail?: string;
  correlationId?: string;
  fieldErrors?: ProblemFieldError[] | Record<string, string[]>;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor?: string | null;
  asOf: string;
  freshness?: "READY" | "STALE";
  allowedActions?: string[];
}

export interface SellerAccountSummary {
  sellerAccountId: string;
  displayName: string;
  accountType: "INDIVIDUAL" | "ORGANIZATION";
  sellerAccountStatus: string;
  membershipRole?: "OWNER" | "MANAGER" | "OPERATOR" | "FINANCE_VIEWER";
  version: number;
}

export interface SellerAccountListResponse {
  data: SellerAccountSummary[];
  asOf: string;
}

export interface OverviewAlert {
  id: string;
  tone: "INFO" | "WARNING" | "DANGER";
  title: string;
  description: string;
  href?: string;
}

export interface OverviewActionItem {
  id: string;
  kind: "PURCHASE" | "SALE" | "TICKET" | "REFUND" | "DISPUTE" | "PAYOUT";
  title: string;
  description?: string;
  status: string;
  href: string;
  occurredAt?: string;
}

export interface BalanceBucket {
  code: "PENDING" | "HELD" | "AVAILABLE" | "FROZEN" | "PAYOUT_PROCESSING" | "PAID";
  amountMinor: number;
  currency: string;
  label: string;
}

export interface AccountOverview {
  asOf: string;
  freshness?: "READY" | "STALE";
  displayName?: string;
  alerts?: OverviewAlert[];
  actionItems?: OverviewActionItem[];
  recentActivity?: OverviewActionItem[];
  balanceBuckets?: BalanceBucket[];
  allowedActions?: string[];
}

/**
 * Envelope real de `GET /v1/me/purchases` (apps/api/src/order-routes.ts,
 * `serializeOrder`). Dinheiro em minor units como STRING — o total de um
 * pedido pode passar de Number.MAX_SAFE_INTEGER em centavos e `Money`, que
 * exige inteiro seguro, lançaria. Use `MinorMoney` para renderizar.
 *
 * A lista devolve somente colunas do pedido. Título do item e vendedor vivem
 * em `order_items`/`listingSnapshot` e aparecem no detalhe — a lista não os
 * inventa.
 */
export interface PurchaseListItem {
  orderId: string;
  publicCode: string;
  sellerAccountId: string;
  status: string;
  subtotalMinor: string;
  feeMinor: string;
  totalMinor: string;
  currency: string;
  reservedUntil: string | null;
  placedAt: string;
  paidAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Envelope de `GET /v1/orders/:orderId` (`serializeOrderDetail`). */
export interface OrderDetailResponse {
  order: PurchaseListItem;
  items: {
    orderItemId: string;
    listingId: string;
    catalogItemId: string;
    quantity: number;
    unitPriceMinor: string;
    totalMinor: string;
    currency: string;
    listingSnapshot: Record<string, unknown>;
  }[];
  /** Somente fatos gravados pelo servidor. Evento futuro não entra aqui. */
  timeline: {
    orderEventId: string;
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    payload: Record<string, unknown>;
    occurredAt: string;
  }[];
  delivery: {
    deliveryId: string;
    orderId: string;
    status: string;
    buyerConfirmedAt: string | null;
    sellerConfirmedAt: string | null;
    instructionRevealedAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  asOf: string;
}

export interface SaleListItem {
  orderId: string;
  itemTitle: string;
  amountMinor: number;
  netAmountMinor?: number;
  currency: string;
  status: string;
  createdAt: string;
  requiresAction?: boolean;
  nextActionHref?: string;
}

export interface SalesReadModel extends CursorPage<SaleListItem> {
  period?: { from: string; to: string; timezone: string };
  metrics?: Array<{ code: string; label: string; value: number; unit: string }>;
}

export interface HoldScheduleItem {
  balanceLotId: string;
  orderId?: string;
  amountMinor: number;
  currency: string;
  startsAt: string;
  eligibleAt: string;
  status: string;
  reasonLabel?: string;
}

export interface SalesBalanceReadModel {
  sellerAccountId: string;
  asOf: string;
  freshness?: "READY" | "STALE";
  buckets: BalanceBucket[];
  holds?: HoldScheduleItem[];
  destinations?: Array<{ destinationId: string; maskedLabel: string; status: string }>;
  allowedActions?: string[];
}

export interface PayoutListItem {
  payoutId: string;
  amountMinor: number;
  feeAmountMinor?: number;
  netAmountMinor?: number;
  currency: string;
  destinationMasked: string;
  status: string;
  requestedAt: string;
  updatedAt?: string;
}

export interface RegistrationResponse {
  registrationStatus: "PENDING_VERIFICATION";
}

export interface SessionSummary {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export interface SessionListResponse {
  data: SessionSummary[];
  asOf: string;
}
