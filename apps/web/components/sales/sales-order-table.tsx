"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge, type StatusTone } from "@midas/ui";
import { formatMinorUnits, subtractMinorUnits } from "./sales-metric-card";
import styles from "./sales.module.css";

/**
 * Contrato canônico dos pedidos de venda.
 * Vocabulário de estado espelhado de modules/orders/src/order-state.ts;
 * campos monetários espelhados de modules/orders/src/schema.ts (bigint serializado em string).
 */
export const SELLER_ORDERS_CONTRACT = "GET /v1/seller-accounts/{sellerAccountId}/orders";

export const SELLER_ORDER_PAGE_SIZE = 25;

export function sellerOrdersPath(sellerAccountId: string, cursor: string | null): string {
  const query = new URLSearchParams({ limit: String(SELLER_ORDER_PAGE_SIZE) });
  if (cursor) query.set("cursor", cursor);
  return `/v1/seller-accounts/${encodeURIComponent(sellerAccountId)}/orders?${query.toString()}`;
}

export const sellerOrderStatuses = [
  "PENDING_PAYMENT",
  "PAID",
  "IN_DELIVERY",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
  "REFUNDED",
] as const;

export type SellerOrderStatus = (typeof sellerOrderStatuses)[number];

export interface SellerOrderListItem {
  orderId: string;
  publicCode: string;
  status: SellerOrderStatus;
  totalMinor: string;
  feeMinor: string;
  currency: string;
  placedAt: string;
  paidAt: string | null;
  completedAt: string | null;
  itemSummary: string | null;
}

export interface SellerOrderPage {
  data: unknown;
  nextCursor?: string | null;
  asOf: string;
}

const statusLabels: Record<SellerOrderStatus, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  IN_DELIVERY: "Em entrega",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  DISPUTED: "Em disputa",
  REFUNDED: "Reembolsado",
};

const statusTones: Record<SellerOrderStatus, StatusTone> = {
  PENDING_PAYMENT: "warning",
  PAID: "info",
  IN_DELIVERY: "info",
  COMPLETED: "success",
  CANCELLED: "neutral",
  DISPUTED: "danger",
  REFUNDED: "neutral",
};

export function sellerOrderStatusLabel(status: SellerOrderStatus): string {
  return statusLabels[status];
}

export function sellerOrderStatusTone(status: SellerOrderStatus): StatusTone {
  return statusTones[status];
}

function isSellerOrderStatus(value: unknown): value is SellerOrderStatus {
  return typeof value === "string" && (sellerOrderStatuses as readonly string[]).includes(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || value === undefined || typeof value === "string";
}

/**
 * Guarda de contrato. Esta superfície fala com um endpoint de domínio recém-publicado,
 * então uma linha fora do formato é DESCARTADA e contada — nunca renderizada como
 * traço silencioso nem preenchida com valor provável.
 */
export function parseSellerOrderRows(payload: unknown): {
  rows: SellerOrderListItem[];
  discarded: number;
} {
  if (!Array.isArray(payload)) return { rows: [], discarded: 0 };
  const rows: SellerOrderListItem[] = [];
  let discarded = 0;

  for (const entry of payload) {
    if (typeof entry !== "object" || entry === null) {
      discarded += 1;
      continue;
    }
    const row = entry as Record<string, unknown>;
    const { orderId, publicCode, status, totalMinor, feeMinor, currency, placedAt } = row;

    if (
      typeof orderId !== "string" ||
      typeof publicCode !== "string" ||
      !isSellerOrderStatus(status) ||
      typeof totalMinor !== "string" ||
      !/^\d+$/u.test(totalMinor) ||
      typeof feeMinor !== "string" ||
      !/^\d+$/u.test(feeMinor) ||
      typeof currency !== "string" ||
      !/^[A-Z]{3}$/u.test(currency) ||
      typeof placedAt !== "string" ||
      Number.isNaN(Date.parse(placedAt)) ||
      !isNullableString(row.paidAt) ||
      !isNullableString(row.completedAt)
    ) {
      discarded += 1;
      continue;
    }

    rows.push({
      orderId,
      publicCode,
      status,
      totalMinor,
      feeMinor,
      currency,
      placedAt,
      paidAt: typeof row.paidAt === "string" ? row.paidAt : null,
      completedAt: typeof row.completedAt === "string" ? row.completedAt : null,
      itemSummary: typeof row.itemSummary === "string" ? row.itemSummary : null,
    });
  }

  return { rows, discarded };
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function formatOrderDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Data fora do contrato" : dateFormatter.format(parsed);
}

type SortColumn = "placedAt" | "totalMinor" | "status";
type SortDirection = "asc" | "desc";

const sortColumnLabels: Record<SortColumn, string> = {
  placedAt: "Data do pedido",
  totalMinor: "Valor bruto",
  status: "Estado",
};

function compareMinor(first: string, second: string): number {
  const left = BigInt(first);
  const right = BigInt(second);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareRows(
  first: SellerOrderListItem,
  second: SellerOrderListItem,
  column: SortColumn,
): number {
  if (column === "totalMinor") return compareMinor(first.totalMinor, second.totalMinor);
  if (column === "status") {
    return statusLabels[first.status].localeCompare(statusLabels[second.status], "pt-BR");
  }
  return Date.parse(first.placedAt) - Date.parse(second.placedAt);
}

export function SalesOrderTable({
  rows,
  caption,
  detailBasePath = "/conta/vendas",
}: {
  rows: readonly SellerOrderListItem[];
  caption: string;
  detailBasePath?: string;
}) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("placedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((first, second) => {
      const result = compareRows(first, second, sortColumn);
      return sortDirection === "asc" ? result : -result;
    });
    return copy;
  }, [rows, sortColumn, sortDirection]);

  function toggleSort(column: SortColumn) {
    if (column === sortColumn) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection(column === "status" ? "asc" : "desc");
  }

  function ariaSortFor(column: SortColumn): "ascending" | "descending" | "none" {
    if (sortColumn !== column) return "none";
    return sortDirection === "asc" ? "ascending" : "descending";
  }

  function SortButton({ column }: { column: SortColumn }) {
    const active = sortColumn === column;
    const nextDirection = active && sortDirection === "asc" ? "decrescente" : "crescente";
    return (
      <button
        type="button"
        className={styles.sortButton}
        data-active={active ? "true" : undefined}
        onClick={() => {
          toggleSort(column);
        }}
      >
        <span>{sortColumnLabels[column]}</span>
        <span aria-hidden="true" className={styles.sortMark}>
          {active ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
        </span>
        <span className={styles.visuallyHidden}>
          {active
            ? `Ordenado por ${sortColumnLabels[column]}, ordem ${sortDirection === "asc" ? "crescente" : "decrescente"}. Ativar para ordem ${nextDirection}.`
            : `Ordenar por ${sortColumnLabels[column]}, ordem ${nextDirection}.`}
        </span>
      </button>
    );
  }

  return (
    <>
      <p aria-live="polite" className={styles.visuallyHidden}>
        Tabela ordenada por {sortColumnLabels[sortColumn]}, ordem{" "}
        {sortDirection === "asc" ? "crescente" : "decrescente"}. {sorted.length}{" "}
        {sorted.length === 1 ? "pedido listado" : "pedidos listados"}.
      </p>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.tableCaption}>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col" className={styles.numericHead} aria-sort={ariaSortFor("totalMinor")}>
                <SortButton column="totalMinor" />
              </th>
              <th scope="col" className={styles.numericHead}>
                Taxa da plataforma
              </th>
              <th scope="col" className={styles.numericHead}>
                Líquido previsto
              </th>
              <th scope="col" aria-sort={ariaSortFor("status")}>
                <SortButton column="status" />
              </th>
              <th scope="col" aria-sort={ariaSortFor("placedAt")}>
                <SortButton column="placedAt" />
              </th>
              <th scope="col">
                <span className={styles.visuallyHidden}>Abrir venda</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const total = formatMinorUnits(row.totalMinor, row.currency);
              const fee = formatMinorUnits(row.feeMinor, row.currency);
              const net = subtractMinorUnits(row.totalMinor, row.feeMinor);
              const netLabel = net === null ? null : formatMinorUnits(net, row.currency);
              return (
                <tr key={row.orderId}>
                  <th scope="row" className={styles.primaryCell}>
                    <strong>{row.publicCode}</strong>
                    {row.itemSummary ? <small>{row.itemSummary}</small> : null}
                  </th>
                  <td className={styles.numeric}>{total ?? "Valor fora do contrato"}</td>
                  <td className={styles.numeric}>{fee ?? "Valor fora do contrato"}</td>
                  <td className={styles.numeric}>{netLabel ?? "Não calculável"}</td>
                  <td>
                    <StatusBadge tone={statusTones[row.status]}>
                      {statusLabels[row.status]}
                    </StatusBadge>
                  </td>
                  <td className={styles.dateCell}>
                    <time dateTime={row.placedAt}>{formatOrderDate(row.placedAt)}</time>
                  </td>
                  <td className={styles.actionCell}>
                    <Link
                      className="text-link"
                      href={`${detailBasePath}/${encodeURIComponent(row.orderId)}`}
                    >
                      Abrir venda
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.tableFootnote}>
        Líquido previsto é o total do pedido menos a taxa registrada no próprio pedido. É aritmética
        sobre os valores devolvidos pela API, não estimativa de repasse.
      </p>
    </>
  );
}
