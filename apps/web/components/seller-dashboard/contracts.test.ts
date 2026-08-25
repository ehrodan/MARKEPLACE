import { describe, expect, it } from "vitest";
import {
  SELLER_DASHBOARD_PAGE_SIZE,
  readSellerBalance,
  readSellerListings,
  readSellerOrders,
  sellerDashboardContractGaps,
  sellerDashboardPaths,
} from "./contracts";

const asOf = "2026-08-25T12:30:00.000Z";

describe("contratos do dashboard do vendedor", () => {
  it("monta somente os três endpoints registrados no escopo informado", () => {
    expect(sellerDashboardPaths("sac_a/b")).toEqual({
      listings: `/v1/seller-accounts/sac_a%2Fb/listings?limit=${String(SELLER_DASHBOARD_PAGE_SIZE)}`,
      orders: `/v1/seller-accounts/sac_a%2Fb/orders?limit=${String(SELLER_DASHBOARD_PAGE_SIZE)}`,
      balance: "/v1/seller-accounts/sac_a%2Fb/finance/balance",
    });
  });

  it("aceita anúncios válidos e conta linhas fora do contrato sem preenchê-las", () => {
    const result = readSellerListings({
      data: [
        {
          listingId: "listing-1",
          publicSlug: "ak-47-redline",
          sellerAccountId: "sac_123",
          listingStatus: "PUBLISHED",
          priceMinor: "12990",
          currency: "BRL",
          quantityAvailable: 1,
          updatedAt: asOf,
          catalogItem: { displayName: "AK-47 | Redline" },
        },
        {
          listingId: "listing-2",
          publicSlug: "invalid-money",
          sellerAccountId: "sac_123",
          listingStatus: "DRAFT",
          priceMinor: 990,
          currency: "BRL",
          quantityAvailable: 1,
          updatedAt: asOf,
          catalogItem: { displayName: "Linha inválida" },
        },
      ],
      nextCursor: "cursor-2",
      asOf,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        rows: [
          {
            listingId: "listing-1",
            publicSlug: "ak-47-redline",
            sellerAccountId: "sac_123",
            listingStatus: "PUBLISHED",
            priceMinor: "12990",
            currency: "BRL",
            quantityAvailable: 1,
            updatedAt: asOf,
            itemName: "AK-47 | Redline",
          },
        ],
        discarded: 1,
        nextCursor: "cursor-2",
        asOf,
      },
    });
  });

  it("recusa envelope paginado sem asOf verificável", () => {
    expect(readSellerListings({ data: [], nextCursor: null, asOf: "agora" })).toEqual({
      ok: false,
      reason: "O campo asOf não contém uma data válida.",
    });
  });

  it("lê pedido real e exige feeMinor mesmo sem exibi-lo como faturamento", () => {
    const result = readSellerOrders({
      data: [
        {
          orderId: "order-1",
          publicCode: "MID-0001",
          sellerAccountId: "00000000-0000-0000-0000-000000000123",
          status: "PAID",
          totalMinor: "45000",
          feeMinor: "4500",
          currency: "BRL",
          placedAt: asOf,
        },
        {
          orderId: "order-2",
          publicCode: "MID-0002",
          sellerAccountId: "00000000-0000-0000-0000-000000000123",
          status: "PAID",
          totalMinor: "45000",
          currency: "BRL",
          placedAt: asOf,
        },
      ],
      nextCursor: null,
      asOf,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(1);
    expect(result.value.discarded).toBe(1);
  });

  it("aceita dinheiro do saldo somente em string de minor units", () => {
    expect(
      readSellerBalance({
        sellerAccountId: "sac_123",
        currency: "BRL",
        heldAmountMinor: "1000",
        availableAmountMinor: "2500",
        reservedAmountMinor: "500",
        asOf,
      }),
    ).toEqual({
      ok: true,
      value: {
        sellerAccountId: "sac_123",
        currency: "BRL",
        heldAmountMinor: "1000",
        availableAmountMinor: "2500",
        reservedAmountMinor: "500",
        asOf,
      },
    });

    expect(
      readSellerBalance({
        sellerAccountId: "sac_123",
        currency: "BRL",
        heldAmountMinor: "1000",
        availableAmountMinor: 2500,
        reservedAmountMinor: "500",
        asOf,
      }),
    ).toEqual({
      ok: false,
      reason: "A API respondeu com campos de saldo fora do contrato publicado.",
    });
  });

  it("mantém explícitos os blocos que continuam sem contrato", () => {
    expect(sellerDashboardContractGaps.map((gap) => gap.code)).toEqual([
      "PERFORMANCE_METRICS",
      "SELLER_ALERTS",
    ]);
  });
});
