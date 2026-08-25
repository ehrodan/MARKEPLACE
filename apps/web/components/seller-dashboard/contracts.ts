export const SELLER_ACCOUNTS_CONTRACT = "GET /v1/me/seller-accounts";
export const SELLER_LISTINGS_CONTRACT =
  "GET /v1/seller-accounts/{sellerAccountId}/listings";
export const SELLER_ORDERS_CONTRACT =
  "GET /v1/seller-accounts/{sellerAccountId}/orders";
export const SELLER_BALANCE_CONTRACT =
  "GET /v1/seller-accounts/{sellerAccountId}/finance/balance";

export const SELLER_DASHBOARD_PAGE_SIZE = 8;

export const sellerDashboardContractGaps = [
  {
    code: "PERFORMANCE_METRICS",
    label: "Conversão e desempenho da vitrine",
    reason:
      "Não existe leitura registrada que una visitas, cliques e pedidos no mesmo período e escopo.",
  },
  {
    code: "SELLER_ALERTS",
    label: "Alertas comerciais consolidados",
    reason:
      "Não existe endpoint registrado de alertas do SellerAccount com severidade, ação e asOf.",
  },
] as const;

export const sellerListingStatuses = [
  "DRAFT",
  "REVIEW",
  "PUBLISHED",
  "PAUSED",
  "SOLD",
  "TOMBSTONE",
] as const;

export const sellerOrderStatuses = [
  "PENDING_PAYMENT",
  "PAID",
  "IN_DELIVERY",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
  "REFUNDED",
] as const;

export type SellerListingStatus = (typeof sellerListingStatuses)[number];
export type SellerOrderStatus = (typeof sellerOrderStatuses)[number];

export interface SellerListingSnapshot {
  listingId: string;
  publicSlug: string;
  sellerAccountId: string;
  listingStatus: SellerListingStatus;
  priceMinor: string;
  currency: string;
  quantityAvailable: number;
  updatedAt: string;
  itemName: string;
}

export interface SellerOrderSnapshot {
  orderId: string;
  publicCode: string;
  status: SellerOrderStatus;
  totalMinor: string;
  currency: string;
  placedAt: string;
}

export interface SellerBalanceSnapshot {
  sellerAccountId: string;
  currency: string;
  heldAmountMinor: string;
  availableAmountMinor: string;
  reservedAmountMinor: string;
  asOf: string;
}

export interface SellerCursorSnapshot<T> {
  rows: T[];
  discarded: number;
  nextCursor: string | null;
  asOf: string;
}

export type ContractRead<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

interface CursorEnvelope {
  data: unknown[];
  nextCursor: string | null;
  asOf: string;
}

const minorUnitsPattern = /^\d+$/u;
const currencyPattern = /^[A-Z]{3}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isMinorUnits(value: unknown): value is string {
  return typeof value === "string" && minorUnitsPattern.test(value);
}

function isCurrency(value: unknown): value is string {
  return typeof value === "string" && currencyPattern.test(value);
}

function readCursorEnvelope(payload: unknown): ContractRead<CursorEnvelope> {
  if (!isRecord(payload)) {
    return { ok: false, reason: "A resposta não é um objeto de página." };
  }

  const { data, nextCursor, asOf } = payload;
  if (!Array.isArray(data)) {
    return { ok: false, reason: "O campo data não é uma lista." };
  }
  if (nextCursor !== null && typeof nextCursor !== "string") {
    return { ok: false, reason: "O campo nextCursor não segue o contrato." };
  }
  if (!isIsoDate(asOf)) {
    return { ok: false, reason: "O campo asOf não contém uma data válida." };
  }

  return { ok: true, value: { data, nextCursor, asOf } };
}

function isListingStatus(value: unknown): value is SellerListingStatus {
  return (
    typeof value === "string" &&
    (sellerListingStatuses as readonly string[]).includes(value)
  );
}

function isOrderStatus(value: unknown): value is SellerOrderStatus {
  return (
    typeof value === "string" &&
    (sellerOrderStatuses as readonly string[]).includes(value)
  );
}

function readListingRow(entry: unknown): SellerListingSnapshot | null {
  if (!isRecord(entry) || !isRecord(entry.catalogItem)) return null;
  const {
    listingId,
    publicSlug,
    sellerAccountId,
    listingStatus,
    priceMinor,
    currency,
    quantityAvailable,
    updatedAt,
  } = entry;
  const itemName = entry.catalogItem.displayName;

  if (
    typeof listingId !== "string" ||
    listingId.length === 0 ||
    typeof publicSlug !== "string" ||
    publicSlug.length === 0 ||
    typeof sellerAccountId !== "string" ||
    sellerAccountId.length === 0 ||
    !isListingStatus(listingStatus) ||
    !isMinorUnits(priceMinor) ||
    !isCurrency(currency) ||
    typeof quantityAvailable !== "number" ||
    !Number.isInteger(quantityAvailable) ||
    quantityAvailable < 0 ||
    !isIsoDate(updatedAt) ||
    typeof itemName !== "string" ||
    itemName.length === 0
  ) {
    return null;
  }

  return {
    listingId,
    publicSlug,
    sellerAccountId,
    listingStatus,
    priceMinor,
    currency,
    quantityAvailable,
    updatedAt,
    itemName,
  };
}

function readOrderRow(entry: unknown): SellerOrderSnapshot | null {
  if (!isRecord(entry)) return null;
  const {
    orderId,
    publicCode,
    sellerAccountId,
    status,
    totalMinor,
    feeMinor,
    currency,
    placedAt,
  } = entry;

  if (
    typeof orderId !== "string" ||
    orderId.length === 0 ||
    typeof publicCode !== "string" ||
    publicCode.length === 0 ||
    typeof sellerAccountId !== "string" ||
    sellerAccountId.length === 0 ||
    !isOrderStatus(status) ||
    !isMinorUnits(totalMinor) ||
    !isMinorUnits(feeMinor) ||
    !isCurrency(currency) ||
    !isIsoDate(placedAt)
  ) {
    return null;
  }

  return { orderId, publicCode, status, totalMinor, currency, placedAt };
}

function readCursorRows<T>(
  payload: unknown,
  readRow: (entry: unknown) => T | null,
): ContractRead<SellerCursorSnapshot<T>> {
  const envelope = readCursorEnvelope(payload);
  if (!envelope.ok) return envelope;

  const rows: T[] = [];
  let discarded = 0;
  for (const entry of envelope.value.data) {
    const row = readRow(entry);
    if (row) rows.push(row);
    else discarded += 1;
  }

  return {
    ok: true,
    value: {
      rows,
      discarded,
      nextCursor: envelope.value.nextCursor,
      asOf: envelope.value.asOf,
    },
  };
}

export function readSellerListings(
  payload: unknown,
): ContractRead<SellerCursorSnapshot<SellerListingSnapshot>> {
  return readCursorRows(payload, readListingRow);
}

export function readSellerOrders(
  payload: unknown,
): ContractRead<SellerCursorSnapshot<SellerOrderSnapshot>> {
  return readCursorRows(payload, readOrderRow);
}

export function readSellerBalance(payload: unknown): ContractRead<SellerBalanceSnapshot> {
  if (!isRecord(payload)) {
    return { ok: false, reason: "A resposta de saldo não é um objeto." };
  }

  const {
    sellerAccountId,
    currency,
    heldAmountMinor,
    availableAmountMinor,
    reservedAmountMinor,
    asOf,
  } = payload;

  if (
    typeof sellerAccountId !== "string" ||
    sellerAccountId.length === 0 ||
    !isCurrency(currency) ||
    !isMinorUnits(heldAmountMinor) ||
    !isMinorUnits(availableAmountMinor) ||
    !isMinorUnits(reservedAmountMinor) ||
    !isIsoDate(asOf)
  ) {
    return {
      ok: false,
      reason: "A API respondeu com campos de saldo fora do contrato publicado.",
    };
  }

  return {
    ok: true,
    value: {
      sellerAccountId,
      currency,
      heldAmountMinor,
      availableAmountMinor,
      reservedAmountMinor,
      asOf,
    },
  };
}

export function sellerDashboardPaths(sellerAccountId: string) {
  const encoded = encodeURIComponent(sellerAccountId);
  const limit = String(SELLER_DASHBOARD_PAGE_SIZE);
  return {
    listings: `/v1/seller-accounts/${encoded}/listings?limit=${limit}`,
    orders: `/v1/seller-accounts/${encoded}/orders?limit=${limit}`,
    balance: `/v1/seller-accounts/${encoded}/finance/balance`,
  } as const;
}

const listingStatusLabels: Record<SellerListingStatus, string> = {
  DRAFT: "Rascunho",
  REVIEW: "Em revisão",
  PUBLISHED: "Publicado",
  PAUSED: "Pausado",
  SOLD: "Vendido",
  TOMBSTONE: "Encerrado",
};

const orderStatusLabels: Record<SellerOrderStatus, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  IN_DELIVERY: "Em entrega",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  DISPUTED: "Em disputa",
  REFUNDED: "Reembolsado",
};

export function sellerListingStatusLabel(status: SellerListingStatus): string {
  return listingStatusLabels[status];
}

export function sellerOrderStatusLabel(status: SellerOrderStatus): string {
  return orderStatusLabels[status];
}
