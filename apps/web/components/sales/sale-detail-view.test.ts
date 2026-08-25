import { describe, expect, it } from "vitest";

import { parseSaleOrderDetail } from "./sale-detail-view";

const order = {
  orderId: "6f1c4d0e-2f2b-4d2f-9f0e-77c1b5c39f01",
  publicCode: "ORD/1",
  sellerAccountId: "a2c6e5b4-3d21-4d55-8f1a-6c0f9d1e2b33",
  status: "PAID",
  subtotalMinor: "12000",
  feeMinor: "1200",
  totalMinor: "13200",
  currency: "BRL",
  placedAt: "2026-08-20T12:00:00.000Z",
  paidAt: "2026-08-20T12:04:00.000Z",
  completedAt: null,
};

describe("parseSaleOrderDetail", () => {
  it("lê o envelope real de GET /v1/orders/{orderId}", () => {
    const parsed = parseSaleOrderDetail({
      order,
      items: [],
      timeline: [
        {
          orderEventId: "c0ffee00-0000-4000-8000-000000000001",
          eventType: "order.paid",
          fromStatus: "PENDING_PAYMENT",
          toStatus: "PAID",
          payload: {},
          occurredAt: "2026-08-20T12:04:00.000Z",
        },
      ],
      delivery: { deliveryId: "d1", orderId: order.orderId, status: "AWAITING_SELLER" },
      asOf: "2026-08-24T02:00:00.000Z",
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.publicCode).toBe("ORD/1");
    expect(parsed?.totalMinor).toBe("13200");
    expect(parsed?.deliveryStatus).toBe("AWAITING_SELLER");
    expect(parsed?.events).toHaveLength(1);
    expect(parsed?.events?.[0]?.eventType).toBe("order.paid");
    expect(parsed?.asOf).toBe("2026-08-24T02:00:00.000Z");
  });

  it("distingue timeline ausente de timeline vazia", () => {
    const semTimeline = parseSaleOrderDetail({ order, delivery: null });
    expect(semTimeline?.events).toBeNull();
    expect(semTimeline?.deliveryStatus).toBeNull();

    const timelineVazia = parseSaleOrderDetail({ order, timeline: [], delivery: null });
    expect(timelineVazia?.events).toEqual([]);
  });

  it("aceita a resposta achatada, sem envelope", () => {
    const parsed = parseSaleOrderDetail({
      ...order,
      deliveryStatus: "DELIVERED",
      events: [],
      asOf: "2026-08-24T02:00:00.000Z",
    });

    expect(parsed?.deliveryStatus).toBe("DELIVERED");
    expect(parsed?.events).toEqual([]);
  });

  it("recusa dinheiro fora do contrato em vez de exibir valor errado", () => {
    expect(parseSaleOrderDetail({ order: { ...order, totalMinor: 13200 } })).toBeNull();
    expect(parseSaleOrderDetail({ order: { ...order, currency: "brl" } })).toBeNull();
    expect(parseSaleOrderDetail({ order: { ...order, status: "SHIPPED" } })).toBeNull();
    expect(parseSaleOrderDetail(null)).toBeNull();
  });
});
