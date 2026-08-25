import { describe, expect, it } from "vitest";
import { AppProblem } from "@midas/kernel";
import {
  allowedTransitionsFrom,
  applyDeliveryConfirmation,
  assertTransition,
  canTransition,
  deliveryStatuses,
  hasRoleConfirmed,
  isDeliveryComplete,
  isDeliveryStatus,
  isOrderStatus,
  isTerminalOrderStatus,
  orderStatuses,
  parseDeliveryStatus,
  parseOrderStatus,
  type DeliveryRole,
  type DeliveryStatus,
  type OrderStatus,
} from "./order-state.js";

const validTransitions: ReadonlyArray<[OrderStatus, OrderStatus]> = [
  ["PENDING_PAYMENT", "PAID"],
  ["PENDING_PAYMENT", "CANCELLED"],
  ["PAID", "IN_DELIVERY"],
  ["PAID", "DISPUTED"],
  ["IN_DELIVERY", "COMPLETED"],
  ["IN_DELIVERY", "DISPUTED"],
  ["DISPUTED", "COMPLETED"],
  ["DISPUTED", "REFUNDED"],
];

const validTransitionKeys = new Set(validTransitions.map(([from, to]) => `${from}->${to}`));

describe("máquina de estados do pedido", () => {
  it("aceita exatamente as transições do contrato canônico", () => {
    for (const [from, to] of validTransitions) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it("recusa toda transição fora do contrato, inclusive auto-transição", () => {
    const rejected: string[] = [];
    for (const from of orderStatuses) {
      for (const to of orderStatuses) {
        const key = `${from}->${to}`;
        if (validTransitionKeys.has(key)) continue;
        if (canTransition(from, to)) rejected.push(key);
      }
    }
    expect(rejected).toEqual([]);
  });

  it("cobre a matriz inteira de 7x7 estados", () => {
    const total = orderStatuses.length * orderStatuses.length;
    let allowed = 0;
    for (const from of orderStatuses) {
      for (const to of orderStatuses) {
        if (canTransition(from, to)) allowed += 1;
      }
    }
    expect(total).toBe(49);
    expect(allowed).toBe(validTransitions.length);
  });

  it("trata COMPLETED, CANCELLED e REFUNDED como terminais sem saída", () => {
    for (const terminal of ["COMPLETED", "CANCELLED", "REFUNDED"] as const) {
      expect(isTerminalOrderStatus(terminal)).toBe(true);
      expect(allowedTransitionsFrom(terminal)).toEqual([]);
    }
    for (const live of ["PENDING_PAYMENT", "PAID", "IN_DELIVERY", "DISPUTED"] as const) {
      expect(isTerminalOrderStatus(live)).toBe(false);
      expect(allowedTransitionsFrom(live).length).toBeGreaterThan(0);
    }
  });

  it("não permite pular o pagamento nem ressuscitar pedido cancelado", () => {
    expect(canTransition("PENDING_PAYMENT", "IN_DELIVERY")).toBe(false);
    expect(canTransition("PENDING_PAYMENT", "COMPLETED")).toBe(false);
    expect(canTransition("CANCELLED", "PAID")).toBe(false);
    expect(canTransition("COMPLETED", "REFUNDED")).toBe(false);
    expect(canTransition("REFUNDED", "COMPLETED")).toBe(false);
  });

  it("assertTransition passa no caminho válido e falha com 409 no inválido", () => {
    expect(() => {
      assertTransition("PAID", "IN_DELIVERY");
    }).not.toThrow();

    let captured: unknown;
    try {
      assertTransition("PENDING_PAYMENT", "COMPLETED");
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(AppProblem);
    const problem = captured as AppProblem;
    expect(problem.status).toBe(409);
    expect(problem.code).toBe("ORDER_TRANSITION_NOT_ALLOWED");
    expect(problem.message).toContain("PENDING_PAYMENT");
    expect(problem.message).toContain("COMPLETED");
  });

  it("valida e converte status vindos do banco", () => {
    expect(isOrderStatus("PAID")).toBe(true);
    expect(isOrderStatus("paid")).toBe(false);
    expect(parseOrderStatus("DISPUTED")).toBe("DISPUTED");
    expect(() => parseOrderStatus("SHIPPED")).toThrow(AppProblem);
  });
});

describe("máquina de estados da entrega", () => {
  it("confirma um papel de cada vez a partir de PENDING", () => {
    expect(applyDeliveryConfirmation("PENDING", "BUYER")).toBe("BUYER_CONFIRMED");
    expect(applyDeliveryConfirmation("PENDING", "SELLER")).toBe("SELLER_CONFIRMED");
  });

  it("fecha em BOTH_CONFIRMED quando o papel que faltava confirma", () => {
    expect(applyDeliveryConfirmation("BUYER_CONFIRMED", "SELLER")).toBe("BOTH_CONFIRMED");
    expect(applyDeliveryConfirmation("SELLER_CONFIRMED", "BUYER")).toBe("BOTH_CONFIRMED");
  });

  it("é idempotente por papel", () => {
    expect(applyDeliveryConfirmation("BUYER_CONFIRMED", "BUYER")).toBe("BUYER_CONFIRMED");
    expect(applyDeliveryConfirmation("SELLER_CONFIRMED", "SELLER")).toBe("SELLER_CONFIRMED");
    for (const role of ["BUYER", "SELLER"] as const) {
      expect(applyDeliveryConfirmation("BOTH_CONFIRMED", role)).toBe("BOTH_CONFIRMED");
    }
  });

  it("qualquer ordem de confirmação chega ao mesmo estado final", () => {
    const roles: ReadonlyArray<readonly DeliveryRole[]> = [
      ["BUYER", "SELLER"],
      ["SELLER", "BUYER"],
      ["BUYER", "BUYER", "SELLER"],
      ["SELLER", "SELLER", "BUYER", "BUYER"],
    ];
    for (const sequence of roles) {
      const final = sequence.reduce<DeliveryStatus>(applyDeliveryConfirmation, "PENDING");
      expect(final).toBe("BOTH_CONFIRMED");
      expect(isDeliveryComplete(final)).toBe(true);
    }
  });

  it("hasRoleConfirmed reflete cada estado da entrega", () => {
    const expected: Record<string, [boolean, boolean]> = {
      PENDING: [false, false],
      BUYER_CONFIRMED: [true, false],
      SELLER_CONFIRMED: [false, true],
      BOTH_CONFIRMED: [true, true],
    };
    for (const status of deliveryStatuses) {
      const [buyer, seller] = expected[status] ?? [false, false];
      expect(hasRoleConfirmed(status, "BUYER")).toBe(buyer);
      expect(hasRoleConfirmed(status, "SELLER")).toBe(seller);
    }
  });

  it("só considera a entrega concluída em BOTH_CONFIRMED", () => {
    expect(isDeliveryComplete("PENDING")).toBe(false);
    expect(isDeliveryComplete("BUYER_CONFIRMED")).toBe(false);
    expect(isDeliveryComplete("SELLER_CONFIRMED")).toBe(false);
    expect(isDeliveryComplete("BOTH_CONFIRMED")).toBe(true);
  });

  it("valida status de entrega vindos do banco", () => {
    expect(isDeliveryStatus("BOTH_CONFIRMED")).toBe(true);
    expect(isDeliveryStatus("DELIVERED")).toBe(false);
    expect(parseDeliveryStatus("PENDING")).toBe("PENDING");
    expect(() => parseDeliveryStatus("DELIVERED")).toThrow(AppProblem);
  });
});
