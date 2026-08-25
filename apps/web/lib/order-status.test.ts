import { describe, expect, it } from "vitest";
import { deliveryStatusView, orderStatusView } from "./order-status";

const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "IN_DELIVERY",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
  "REFUNDED",
] as const;

describe("orderStatusView", () => {
  it("cobre todos os status do domínio @midas/orders", () => {
    for (const status of ORDER_STATUSES) {
      const view = orderStatusView(status);
      expect(view.label, status).not.toBe("Estado não reconhecido");
      expect(view.explanation.length, status).toBeGreaterThan(10);
    }
  });

  it("degrada com honestidade em status desconhecido em vez de presumir", () => {
    const view = orderStatusView("QUALQUER_COISA_NOVA");
    expect(view.label).toBe("Estado não reconhecido");
    expect(view.tone).toBe("warning");
    expect(view.nextAction).toBeNull();
    expect(view.waitingOn).toBeNull();
  });

  it("dá ação ao comprador exatamente quando a bola é dele", () => {
    expect(orderStatusView("PENDING_PAYMENT").waitingOn).toBe("BUYER");
    expect(orderStatusView("PENDING_PAYMENT").nextAction).not.toBeNull();
    expect(orderStatusView("IN_DELIVERY").waitingOn).toBe("BUYER");
    expect(orderStatusView("IN_DELIVERY").nextAction).not.toBeNull();
  });

  it("não pede ação do comprador quando ele não pode fazer nada", () => {
    for (const status of ["PAID", "CANCELLED", "REFUNDED"] as const) {
      expect(orderStatusView(status).nextAction, status).toBeNull();
    }
  });

  it("marca estado terminal sem espera", () => {
    for (const status of ["COMPLETED", "CANCELLED", "REFUNDED"] as const) {
      expect(orderStatusView(status).waitingOn, status).toBeNull();
    }
  });
});

describe("deliveryStatusView", () => {
  it("mantém as duas confirmações independentes e coerentes", () => {
    expect(deliveryStatusView("PENDING")).toMatchObject({
      buyerConfirmed: false,
      sellerConfirmed: false,
    });
    expect(deliveryStatusView("BUYER_CONFIRMED")).toMatchObject({
      buyerConfirmed: true,
      sellerConfirmed: false,
    });
    expect(deliveryStatusView("SELLER_CONFIRMED")).toMatchObject({
      buyerConfirmed: false,
      sellerConfirmed: true,
    });
    expect(deliveryStatusView("BOTH_CONFIRMED")).toMatchObject({
      buyerConfirmed: true,
      sellerConfirmed: true,
    });
  });

  it("degrada com honestidade e nunca marca confirmação que não existe", () => {
    const view = deliveryStatusView("ESTADO_FUTURO");
    expect(view.buyerConfirmed).toBe(false);
    expect(view.sellerConfirmed).toBe(false);
  });
});
