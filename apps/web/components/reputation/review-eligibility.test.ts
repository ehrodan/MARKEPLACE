import { describe, expect, it } from "vitest";
import type { PurchaseListItem } from "@/lib/api-types";
import {
  MAX_SCORE,
  MIN_SCORE,
  isValidScore,
  reviewEligibility,
  reviewableOrders,
} from "./review-eligibility";

const NOW = new Date("2026-08-24T03:00:00.000Z");
const RECENTE = "2026-08-20T12:00:00.000Z";
const ANTIGO = "2026-06-01T12:00:00.000Z";

function order(overrides: Partial<PurchaseListItem> & { orderId: string }): PurchaseListItem {
  return {
    publicCode: `OM-${overrides.orderId}`,
    sellerAccountId: "seller-1",
    status: "COMPLETED",
    subtotalMinor: "10000",
    feeMinor: "750",
    totalMinor: "10000",
    currency: "BRL",
    reservedUntil: null,
    placedAt: RECENTE,
    paidAt: RECENTE,
    completedAt: RECENTE,
    cancelledAt: null,
    cancelReason: null,
    createdAt: RECENTE,
    updatedAt: RECENTE,
    ...overrides,
  };
}

describe("reviewEligibility", () => {
  it("libera pedido concluído dentro da janela", () => {
    const result = reviewEligibility({
      status: "COMPLETED",
      completedAt: RECENTE,
      alreadyReviewed: false,
      now: NOW,
    });
    expect(result.eligible).toBe(true);
  });

  it("bloqueia enquanto o pedido não está concluído", () => {
    for (const status of ["PENDING_PAYMENT", "PAID", "IN_DELIVERY", "DISPUTED", "CANCELLED"]) {
      const result = reviewEligibility({
        status,
        completedAt: RECENTE,
        alreadyReviewed: false,
        now: NOW,
      });
      expect(result.eligible, status).toBe(false);
      if (!result.eligible) expect(result.reason).toBe("ORDER_NOT_COMPLETED");
    }
  });

  it("bloqueia segunda avaliação do mesmo papel", () => {
    const result = reviewEligibility({
      status: "COMPLETED",
      completedAt: RECENTE,
      alreadyReviewed: true,
      now: NOW,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toBe("ALREADY_REVIEWED");
  });

  it("bloqueia depois da janela de 30 dias", () => {
    const result = reviewEligibility({
      status: "COMPLETED",
      completedAt: ANTIGO,
      alreadyReviewed: false,
      now: NOW,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toBe("REVIEW_WINDOW_CLOSED");
  });

  it("não presume data quando o servidor não informa", () => {
    for (const completedAt of [null, "", "ontem", "2026-99-99"]) {
      const result = reviewEligibility({
        status: "COMPLETED",
        completedAt,
        alreadyReviewed: false,
        now: NOW,
      });
      expect(result.eligible, String(completedAt)).toBe(false);
      if (!result.eligible) expect(result.reason).toBe("ORDER_DATE_UNKNOWN");
    }
  });

  it("todo bloqueio traz motivo nomeado e mensagem em pt-BR", () => {
    const result = reviewEligibility({
      status: "PAID",
      completedAt: RECENTE,
      alreadyReviewed: false,
      now: NOW,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toBeTruthy();
      expect(result.message.length).toBeGreaterThan(20);
    }
  });
});

describe("isValidScore — nota ZERO é válida", () => {
  it("aceita zero como avaliação legítima", () => {
    expect(isValidScore(MIN_SCORE)).toBe(true);
    expect(isValidScore(0)).toBe(true);
  });

  it("aceita a escala inteira de 0 a 5", () => {
    for (let score = MIN_SCORE; score <= MAX_SCORE; score += 1) {
      expect(isValidScore(score), String(score)).toBe(true);
    }
  });

  it("trata null como AUSÊNCIA de nota, não como nota baixa", () => {
    expect(isValidScore(null)).toBe(false);
  });

  it("recusa fora da escala e não inteiro", () => {
    for (const score of [-1, 6, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isValidScore(score), String(score)).toBe(false);
    }
  });
});

describe("reviewableOrders", () => {
  it("põe o que pode ser avaliado na frente, sem esconder o resto", () => {
    const result = reviewableOrders(
      [
        order({ orderId: "b", status: "PAID" }),
        order({ orderId: "a" }),
        order({ orderId: "c", completedAt: ANTIGO }),
      ],
      NOW,
    );
    expect(result).toHaveLength(3);
    expect(result[0]?.order.orderId).toBe("a");
    expect(result[0]?.eligibility.eligible).toBe(true);
    // Os inelegíveis continuam na lista, com motivo — não desaparecem.
    expect(result.filter((entry) => !entry.eligibility.eligible)).toHaveLength(2);
  });

  it("respeita a lista de já avaliados", () => {
    const result = reviewableOrders([order({ orderId: "a" })], NOW, new Set(["a"]));
    expect(result[0]?.eligibility.eligible).toBe(false);
  });
});
