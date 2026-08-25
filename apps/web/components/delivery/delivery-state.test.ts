import { describe, expect, it } from "vitest";
import {
  UNPUBLISHED_CAPABILITIES,
  confirmAvailability,
  confirmedAtOf,
  deliveryEndpoints,
  describeDeliveryState,
  describeViewerTurn,
  formatAbsoluteInstant,
  hasPartyConfirmed,
  isDisputedOrder,
  orderEventLabel,
  otherParty,
  packageDisclosure,
  partyLabel,
  resolveDeliveryState,
  resolveViewerParty,
  type DeliveryPayload,
  type DeliveryState,
  type OrderPayload,
} from "./delivery-state";

function order(overrides: Partial<OrderPayload> = {}): OrderPayload {
  return {
    orderId: "0198f0e0-0000-7000-8000-000000000001",
    publicCode: "OCH-2026-000001",
    buyerUserId: "usr_01",
    sellerAccountId: "sac_01",
    status: "IN_DELIVERY",
    subtotalMinor: "10000",
    feeMinor: "700",
    totalMinor: "10700",
    currency: "BRL",
    reservedUntil: null,
    placedAt: "2026-08-20T10:00:00.000Z",
    paidAt: "2026-08-20T10:05:00.000Z",
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    version: 3,
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-20T10:05:00.000Z",
    ...overrides,
  };
}

function delivery(overrides: Partial<DeliveryPayload> = {}): DeliveryPayload {
  return {
    deliveryId: "0198f0e0-0000-7000-8000-0000000000d1",
    orderId: "0198f0e0-0000-7000-8000-000000000001",
    status: "PENDING",
    buyerConfirmedAt: null,
    sellerConfirmedAt: null,
    instructionRevealedAt: null,
    version: 1,
    createdAt: "2026-08-20T10:05:00.000Z",
    updatedAt: "2026-08-20T10:05:00.000Z",
    ...overrides,
  };
}

const ALL_STATES: readonly DeliveryState[] = [
  "PENDING",
  "BUYER_CONFIRMED",
  "SELLER_CONFIRMED",
  "BOTH_CONFIRMED",
  "DISPUTED",
];

describe("resolveDeliveryState", () => {
  it("devolve PENDING quando nenhum lado confirmou", () => {
    expect(resolveDeliveryState(order(), delivery())).toBe("PENDING");
  });

  it("devolve BUYER_CONFIRMED e SELLER_CONFIRMED de forma independente", () => {
    expect(resolveDeliveryState(order(), delivery({ status: "BUYER_CONFIRMED" }))).toBe(
      "BUYER_CONFIRMED",
    );
    expect(resolveDeliveryState(order(), delivery({ status: "SELLER_CONFIRMED" }))).toBe(
      "SELLER_CONFIRMED",
    );
  });

  it("devolve BOTH_CONFIRMED quando o servidor fecha a dupla confirmação", () => {
    expect(resolveDeliveryState(order(), delivery({ status: "BOTH_CONFIRMED" }))).toBe(
      "BOTH_CONFIRMED",
    );
  });

  it("disputa do pedido vence qualquer confirmação registrada", () => {
    expect(
      resolveDeliveryState(order({ status: "DISPUTED" }), delivery({ status: "BOTH_CONFIRMED" })),
    ).toBe("DISPUTED");
    expect(isDisputedOrder(order({ status: "DISPUTED" }))).toBe(true);
  });

  it("cai nos carimbos quando o status textual não pertence à máquina de estados", () => {
    const unknown = delivery({ status: "SOMETHING_ELSE", buyerConfirmedAt: "2026-08-21T12:00:00.000Z" });
    expect(resolveDeliveryState(order(), unknown)).toBe("BUYER_CONFIRMED");
    expect(confirmedAtOf(unknown, "BUYER")).toBe("2026-08-21T12:00:00.000Z");
    expect(hasPartyConfirmed(unknown, "SELLER")).toBe(false);
  });

  it("sem entrega aberta nenhum lado consta como confirmado", () => {
    expect(resolveDeliveryState(order({ status: "PENDING_PAYMENT" }), null)).toBe("PENDING");
    expect(hasPartyConfirmed(null, "BUYER")).toBe(false);
    expect(hasPartyConfirmed(null, "SELLER")).toBe(false);
  });
});

describe("describeDeliveryState", () => {
  it("descreve os cinco estados com rótulo, explicação, quem age e próxima ação", () => {
    for (const state of ALL_STATES) {
      const descriptor = describeDeliveryState(state);
      expect(descriptor.state).toBe(state);
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.explanation.length).toBeGreaterThan(0);
      expect(descriptor.whoCanAct.length).toBeGreaterThan(0);
      expect(descriptor.nextAction.length).toBeGreaterThan(0);
    }
  });

  it("aponta o lado que falta como único ator quando só um confirmou", () => {
    expect(describeDeliveryState("BUYER_CONFIRMED").actors).toEqual(["SELLER"]);
    expect(describeDeliveryState("SELLER_CONFIRMED").actors).toEqual(["BUYER"]);
    expect(describeDeliveryState("BOTH_CONFIRMED").actors).toEqual([]);
  });

  it("não descreve a confirmação de um lado como consequência da do outro", () => {
    expect(describeDeliveryState("BUYER_CONFIRMED").explanation).toContain("independente");
    expect(describeDeliveryState("SELLER_CONFIRMED").explanation).toContain("independente");
  });
});

describe("describeViewerTurn", () => {
  it("diz que é a vez de quem ainda não confirmou", () => {
    expect(describeViewerTurn("PENDING", "BUYER").isYourTurn).toBe(true);
    expect(describeViewerTurn("SELLER_CONFIRMED", "BUYER").isYourTurn).toBe(true);
    expect(describeViewerTurn("BUYER_CONFIRMED", "SELLER").isYourTurn).toBe(true);
  });

  it("diz que não é a vez de quem já confirmou, sem sugerir dependência", () => {
    const turn = describeViewerTurn("BUYER_CONFIRMED", "BUYER");
    expect(turn.isYourTurn).toBe(false);
    expect(turn.detail).toContain("independente");
  });

  it("não cobra ação em disputa nem em dupla confirmação", () => {
    expect(describeViewerTurn("DISPUTED", "SELLER").isYourTurn).toBe(false);
    expect(describeViewerTurn("BOTH_CONFIRMED", "BUYER").isYourTurn).toBe(false);
  });

  it("admite não saber o papel em vez de chutar", () => {
    const turn = describeViewerTurn("PENDING", null);
    expect(turn.isYourTurn).toBe(false);
    expect(turn.headline).toContain("papel");
  });

  it("responde de quem é a vez em todos os estados e para os dois papéis", () => {
    for (const state of ALL_STATES) {
      for (const viewer of ["BUYER", "SELLER"] as const) {
        const turn = describeViewerTurn(state, viewer);
        expect(turn.headline.length).toBeGreaterThan(0);
        expect(turn.detail.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("resolveViewerParty", () => {
  it("reconhece o vendedor pela conta vendedora que ele administra", () => {
    expect(resolveViewerParty(order(), [{ sellerAccountId: "sac_01" }])).toBe("SELLER");
  });

  it("trata como comprador quem leu o pedido sem administrar a conta vendedora", () => {
    // A leitura só chega aqui se o servidor autorizou: quem não participa recebe 404.
    expect(resolveViewerParty(order(), [{ sellerAccountId: "sac_99" }])).toBe("BUYER");
    expect(resolveViewerParty(order(), [])).toBe("BUYER");
  });

  it("devolve null quando a lista de contas vendedoras não pôde ser lida", () => {
    expect(resolveViewerParty(order(), null)).toBeNull();
  });
});

describe("confirmAvailability", () => {
  it("libera a confirmação do lado que ainda não confirmou", () => {
    expect(confirmAvailability({ order: order(), delivery: delivery(), viewer: "BUYER" })).toEqual({
      allowed: true,
      reason: "",
    });
    expect(
      confirmAvailability({ order: order({ status: "PAID" }), delivery: delivery(), viewer: "SELLER" }),
    ).toEqual({ allowed: true, reason: "" });
  });

  it("não repete a confirmação já registrada do próprio lado", () => {
    const result = confirmAvailability({
      order: order(),
      delivery: delivery({ status: "BUYER_CONFIRMED" }),
      viewer: "BUYER",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("já foi registrada");
  });

  it("mantém liberada a confirmação do outro lado quando um já confirmou", () => {
    expect(
      confirmAvailability({
        order: order(),
        delivery: delivery({ status: "BUYER_CONFIRMED" }),
        viewer: "SELLER",
      }).allowed,
    ).toBe(true);
  });

  it("suspende a confirmação em disputa", () => {
    const result = confirmAvailability({
      order: order({ status: "DISPUTED" }),
      delivery: delivery(),
      viewer: "BUYER",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("disputa");
  });

  it("bloqueia quando a entrega ainda não foi aberta", () => {
    const result = confirmAvailability({
      order: order({ status: "PENDING_PAYMENT" }),
      delivery: null,
      viewer: "BUYER",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("pagamento");
  });

  it("bloqueia nos estados que o domínio recusa com 409", () => {
    for (const status of ["PENDING_PAYMENT", "COMPLETED", "CANCELLED", "REFUNDED"]) {
      const result = confirmAvailability({
        order: order({ status }),
        delivery: delivery(),
        viewer: "SELLER",
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(status);
    }
  });

  it("não oferece confirmação quando o papel não foi verificado", () => {
    const result = confirmAvailability({ order: order(), delivery: delivery(), viewer: null });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("papel");
  });
});

describe("packageDisclosure", () => {
  it("distingue entrega não aberta, lacrada e já liberada", () => {
    expect(packageDisclosure(null)).toBe("NOT_OPENED");
    expect(packageDisclosure(delivery())).toBe("SEALED");
    expect(
      packageDisclosure(delivery({ instructionRevealedAt: "2026-08-20T10:05:00.000Z" })),
    ).toBe("RELEASED");
  });

  it("liberação consumida não volta a ser lacrada", () => {
    const released = delivery({
      status: "BOTH_CONFIRMED",
      instructionRevealedAt: "2026-08-20T10:05:00.000Z",
    });
    expect(packageDisclosure(released)).toBe("RELEASED");
  });

  it("nomeia a capacidade de conteúdo do pacote que o contrato não publica", () => {
    expect(UNPUBLISHED_CAPABILITIES.packageContent).toContain("instructionRevealedAt");
    expect(UNPUBLISHED_CAPABILITIES.openDispute.length).toBeGreaterThan(0);
    expect(UNPUBLISHED_CAPABILITIES.reportProblem.length).toBeGreaterThan(0);
  });
});

describe("formatAbsoluteInstant", () => {
  it("formata data e hora absolutas com fuso, sem contagem regressiva", () => {
    const formatted = formatAbsoluteInstant("2026-08-24T12:00:00.000Z");
    expect(formatted).not.toBeNull();
    expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(formatted).not.toMatch(/restante|faltam|\d+\s?h\s?\d+\s?m/i);
  });

  it("devolve null para ausência ou valor inválido em vez de inventar horário", () => {
    expect(formatAbsoluteInstant(null)).toBeNull();
    expect(formatAbsoluteInstant(undefined)).toBeNull();
    expect(formatAbsoluteInstant("")).toBeNull();
    expect(formatAbsoluteInstant("nao-e-data")).toBeNull();
  });
});

describe("rótulos e endpoints", () => {
  it("nomeia as partes em pt-BR", () => {
    expect(partyLabel("BUYER")).toBe("Comprador");
    expect(partyLabel("SELLER")).toBe("Vendedor");
    expect(otherParty("BUYER")).toBe("SELLER");
    expect(otherParty("SELLER")).toBe("BUYER");
  });

  it("traduz eventos conhecidos e preserva o tipo cru dos desconhecidos", () => {
    expect(orderEventLabel("order.completed")).toBe("Pedido concluído pelas duas confirmações");
    expect(orderEventLabel("order.something.new")).toBe("order.something.new");
  });

  it("aponta para os caminhos reais publicados pela API", () => {
    const endpoints = deliveryEndpoints("ORD/1");
    expect(endpoints.orderDetail).toBe("/v1/orders/ORD%2F1");
    expect(endpoints.delivery).toBe("/v1/orders/ORD%2F1/delivery");
    expect(endpoints.confirmations).toBe("/v1/orders/ORD%2F1/delivery/confirmations");
    expect(endpoints.sellerAccounts).toBe("/v1/me/seller-accounts");
  });
});
