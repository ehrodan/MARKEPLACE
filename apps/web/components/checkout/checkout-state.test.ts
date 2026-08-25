import { describe, expect, it } from "vitest";
import {
  addMinorUnits,
  checkOrderTotals,
  describeReservationDeadline,
  findPaymentById,
  formatMinorUnits,
  projectOrderSummary,
  resolveCheckoutState,
  stepIndexOf,
  type CheckoutOrderSummary,
  type CheckoutPayment,
  type CheckoutStateInput,
  type ProviderCapability,
} from "./checkout-state";

const NOW = new Date("2026-08-24T12:00:00.000Z");

const payment: CheckoutPayment = {
  paymentId: "0199aa11-1111-7111-8111-111111111111",
  orderId: "0199aa22-2222-7222-8222-222222222222",
  buyerUserId: "usr_0199aa33",
  sellerAccountId: "sac_0199aa44",
  providerCode: null,
  amountMinor: "125000",
  currency: "BRL",
  paymentStatus: "PENDING",
  reconciliationStatus: "PENDING",
  settledAt: null,
  createdAt: "2026-08-24T11:40:00.000Z",
};

const order: CheckoutOrderSummary = {
  orderId: payment.orderId,
  publicCode: "PED-2026-000042",
  status: "PENDING_PAYMENT",
  subtotalMinor: "118000",
  feeMinor: "7000",
  totalMinor: "125000",
  currency: "BRL",
  reservedUntil: "2026-08-24T14:00:00.000Z",
};

const availableProvider: ProviderCapability = {
  providerCode: "stripe",
  status: "AVAILABLE",
  reasonCode: "AVAILABLE",
};

const contractRequiredProvider: ProviderCapability = {
  providerCode: null,
  status: "CONTRACT_REQUIRED",
  reasonCode: "PROVIDER_CONTRACT_NOT_SELECTED",
};

function input(overrides: Partial<CheckoutStateInput> = {}): CheckoutStateInput {
  return {
    payment,
    capability: contractRequiredProvider,
    order,
    policyAccepted: false,
    returnedFromProvider: false,
    sessionContractPublished: false,
    serverAllowedActions: [],
    now: NOW,
    ...overrides,
  };
}

describe("formatMinorUnits", () => {
  it("formata unidades mínimas sem passar por Number", () => {
    expect(formatMinorUnits("125000", "BRL")).toContain("1.250,00");
  });

  it("preserva magnitude acima do inteiro seguro do JavaScript", () => {
    const beyondSafeInteger = "90071992547409910";
    expect(formatMinorUnits(beyondSafeInteger, "BRL")).toContain("900.719.925.474.099,10");
  });

  it("não inventa valor quando a string não é inteira", () => {
    expect(formatMinorUnits("1250,00", "BRL")).toBe("BRL 1250,00");
  });

  it("soma em unidades mínimas com BigInt e recusa entrada inválida", () => {
    expect(addMinorUnits("118000", "7000")).toBe("125000");
    expect(addMinorUnits("118000", "7.000")).toBeNull();
  });
});

describe("checkOrderTotals", () => {
  it("confirma quando subtotal + taxa fecham com o total e com o pagamento", () => {
    expect(checkOrderTotals(order, payment)).toBe("MATCHES");
  });

  it("aponta divergência quando a soma não fecha", () => {
    expect(checkOrderTotals({ ...order, feeMinor: "6000" }, payment)).toBe("MISMATCH");
  });

  it("aponta divergência quando o total não bate com o valor autorizado", () => {
    expect(checkOrderTotals(order, { ...payment, amountMinor: "124000" })).toBe("MISMATCH");
  });

  it("aponta divergência quando a moeda difere", () => {
    expect(checkOrderTotals({ ...order, currency: "USD" }, payment)).toBe("MISMATCH");
  });

  it("marca como não publicado quando o pedido não veio do servidor", () => {
    expect(checkOrderTotals(null, payment)).toBe("NOT_PUBLISHED");
  });

  it("marca como não verificável quando algum valor não é inteiro em unidades mínimas", () => {
    expect(checkOrderTotals({ ...order, subtotalMinor: "1180.00" }, payment)).toBe("UNVERIFIABLE");
  });
});

describe("projectOrderSummary", () => {
  /**
   * Espelha exatamente o que `serializeOrderDetail` devolve em
   * apps/api/src/order-routes.ts: o resumo mora em `data.order`, não na raiz.
   */
  const envelope = {
    data: {
      order: {
        orderId: payment.orderId,
        publicCode: "PED-2026-000042",
        buyerUserId: "usr_0199aa33",
        sellerAccountId: "sac_0199aa44",
        status: "PENDING_PAYMENT",
        subtotalMinor: "118000",
        feeMinor: "7000",
        totalMinor: "125000",
        currency: "BRL",
        reservedUntil: "2026-08-24T14:00:00.000Z",
        placedAt: "2026-08-24T11:40:00.000Z",
        paidAt: null,
        completedAt: null,
        cancelledAt: null,
        cancelReason: null,
        version: 1,
        createdAt: "2026-08-24T11:40:00.000Z",
        updatedAt: "2026-08-24T11:40:00.000Z",
      },
      items: [],
      timeline: [],
      delivery: null,
    },
    asOf: "2026-08-24T12:00:00.000Z",
  };

  it("extrai o resumo de data.order, e não da raiz do envelope", () => {
    expect(projectOrderSummary(envelope)).toEqual(order);
  });

  it("preserva os valores como string em unidades mínimas", () => {
    const summary = projectOrderSummary(envelope);
    expect(summary?.subtotalMinor).toBe("118000");
    expect(summary?.feeMinor).toBe("7000");
    expect(summary?.totalMinor).toBe("125000");
    expect(checkOrderTotals(summary, payment)).toBe("MATCHES");
  });

  it("recusa o corpo achatado que não passa pelo envelope", () => {
    expect(projectOrderSummary({ data: order, asOf: "2026-08-24T12:00:00.000Z" })).toBeNull();
  });

  it("devolve null em vez de dinheiro indefinido quando falta campo monetário", () => {
    const { totalMinor: _omitted, ...withoutTotal } = envelope.data.order;
    expect(projectOrderSummary({ data: { order: withoutTotal }, asOf: envelope.asOf })).toBeNull();
  });

  it("devolve null quando o corpo não é o envelope esperado", () => {
    expect(projectOrderSummary(null)).toBeNull();
    expect(projectOrderSummary(undefined)).toBeNull();
    expect(projectOrderSummary({})).toBeNull();
    expect(projectOrderSummary({ data: null })).toBeNull();
    expect(projectOrderSummary({ data: [] })).toBeNull();
    expect(projectOrderSummary({ data: { order: "PED-1" } })).toBeNull();
  });

  it("aceita anuláveis ausentes sem inventar código público nem prazo", () => {
    const summary = projectOrderSummary({
      data: { order: { ...envelope.data.order, publicCode: null, reservedUntil: null } },
      asOf: envelope.asOf,
    });
    expect(summary?.publicCode).toBeNull();
    expect(summary?.reservedUntil).toBeNull();
    expect(describeReservationDeadline(summary?.reservedUntil ?? null, NOW)).toBeNull();
  });
});

describe("describeReservationDeadline", () => {
  it("não exibe prazo quando o servidor não envia reservedUntil", () => {
    expect(describeReservationDeadline(null, NOW)).toBeNull();
    expect(describeReservationDeadline(undefined, NOW)).toBeNull();
  });

  it("ignora data inválida em vez de inventar prazo", () => {
    expect(describeReservationDeadline("amanhã", NOW)).toBeNull();
  });

  it("descreve o restante em texto grosseiro, sem segundos", () => {
    const deadline = describeReservationDeadline("2026-08-24T14:00:00.000Z", NOW);
    expect(deadline).not.toBeNull();
    expect(deadline?.expired).toBe(false);
    expect(deadline?.remainingLabel).toBe("Cerca de 2 horas restantes");
    expect(deadline?.remainingLabel).not.toMatch(/\d+\s*s(egundo)?/u);
  });

  it("usa singular quando resta uma unidade", () => {
    expect(describeReservationDeadline("2026-08-24T13:00:00.000Z", NOW)?.remainingLabel)
      .toBe("Cerca de 1 hora restante");
  });

  it("marca o prazo como encerrado quando já passou", () => {
    const deadline = describeReservationDeadline("2026-08-24T11:00:00.000Z", NOW);
    expect(deadline?.expired).toBe(true);
    expect(deadline?.remainingLabel).toBe("Prazo encerrado");
  });
});

describe("resolveCheckoutState — estágios", () => {
  it("aguarda sessão quando o pagamento está pendente e sem provedor vinculado", () => {
    const state = resolveCheckoutState(input());
    expect(state.stage).toBe("AWAITING_PAYMENT_SESSION");
    expect(state.label).toBe("Aguardando sessão de pagamento");
    expect(state.step).toBe("POLICY");
  });

  it("reconhece sessão criada quando o pagamento já tem provedor vinculado", () => {
    const state = resolveCheckoutState(input({ payment: { ...payment, providerCode: "stripe" } }));
    expect(state.stage).toBe("PAYMENT_SESSION_OPEN");
    expect(state.explanation).toContain("stripe");
    expect(state.step).toBe("PROVIDER");
  });

  it("NUNCA confirma pagamento pelo retorno do navegador: mostra confirmação em andamento", () => {
    const state = resolveCheckoutState(input({
      returnedFromProvider: true,
      payment: { ...payment, providerCode: "stripe" },
    }));
    expect(state.stage).toBe("CONFIRMING_WITH_PROVIDER");
    expect(state.label).toBe("Confirmando com o provedor");
    expect(state.label).not.toMatch(/pago|aprovado|confirmado pelo provedor/iu);
    expect(state.explanation).toContain("webhook autenticado");
    expect(state.action?.code).toBe("REFRESH_PAYMENT_STATUS");
  });

  it("o retorno do navegador tem prioridade sobre o prazo vencido", () => {
    const state = resolveCheckoutState(input({
      returnedFromProvider: true,
      order: { ...order, reservedUntil: "2026-08-24T11:00:00.000Z" },
    }));
    expect(state.stage).toBe("CONFIRMING_WITH_PROVIDER");
  });

  it("marca prazo encerrado sem cancelar nada por conta própria", () => {
    const state = resolveCheckoutState(input({
      order: { ...order, reservedUntil: "2026-08-24T11:00:00.000Z" },
    }));
    expect(state.stage).toBe("RESERVATION_EXPIRED");
    expect(state.blocks.map((block) => block.code)).toEqual(["RESERVATION_WINDOW_CLOSED"]);
    expect(state.explanation).toContain("continua pendente");
  });

  it("só declara pagamento aprovado quando o servidor grava SETTLED", () => {
    const state = resolveCheckoutState(input({
      payment: {
        ...payment,
        paymentStatus: "SETTLED",
        reconciliationStatus: "RECONCILED_PROVIDER",
        settledAt: "2026-08-24T11:55:00.000Z",
        providerCode: "stripe",
      },
      capability: availableProvider,
      policyAccepted: true,
    }));
    expect(state.stage).toBe("SETTLED_BY_WEBHOOK");
    expect(state.tone).toBe("success");
    expect(state.step).toBe("CONFIRMATION");
    expect(state.action?.code).toBe("OPEN_ORDER");
    expect(state.blocks).toHaveLength(0);
  });

  it("trata falha do provedor como recuperável", () => {
    const state = resolveCheckoutState(input({
      payment: { ...payment, paymentStatus: "FAILED", providerCode: "stripe" },
    }));
    expect(state.stage).toBe("RECOVERABLE_FAILURE");
    expect(state.step).toBe("PROVIDER");
  });

  it("encerra o fluxo quando o servidor registra cancelamento", () => {
    const state = resolveCheckoutState(input({ payment: { ...payment, paymentStatus: "CANCELLED" } }));
    expect(state.stage).toBe("CANCELLED");
    expect(state.action).toBeNull();
    expect(state.blocks.map((block) => block.code)).toEqual(["PAYMENT_TERMINAL"]);
  });

  it("bloqueia a tela quando o pagamento está em quarentena", () => {
    const state = resolveCheckoutState(input({
      payment: { ...payment, paymentStatus: "PAYMENT_QUARANTINED", providerCode: "stripe" },
    }));
    expect(state.stage).toBe("QUARANTINED");
    expect(state.blocks.map((block) => block.code)).toEqual(["PAYMENT_UNDER_REVIEW"]);
    expect(state.action?.code).toBe("REFRESH_PAYMENT_STATUS");
  });
});

describe("resolveCheckoutState — bloqueios", () => {
  it("lista provedor sem contrato, sessão não publicada e aceite pendente ao mesmo tempo", () => {
    const state = resolveCheckoutState(input());
    expect(state.blocks.map((block) => block.code)).toEqual([
      "PROVIDER_CONTRACT_NOT_SELECTED",
      "PAYMENT_SESSION_CONTRACT_REQUIRED",
      "POLICY_ACCEPTANCE_REQUIRED",
    ]);
    expect(state.action).toBeNull();
  });

  it("nomeia credencial ausente quando o provedor está selecionado mas não habilitado", () => {
    const state = resolveCheckoutState(input({
      capability: { providerCode: "stripe", status: "CONTRACT_REQUIRED", reasonCode: "PROVIDER_CREDENTIALS_REQUIRED" },
      policyAccepted: true,
      sessionContractPublished: true,
    }));
    expect(state.blocks.map((block) => block.code)).toEqual(["PROVIDER_CREDENTIALS_REQUIRED"]);
    expect(state.action).toBeNull();
  });

  it("nomeia adaptador ausente quando o provedor não é suportado pela API", () => {
    const state = resolveCheckoutState(input({
      capability: { providerCode: "outro", status: "UNSUPPORTED", reasonCode: "PROVIDER_ADAPTER_NOT_INSTALLED" },
      policyAccepted: true,
      sessionContractPublished: true,
    }));
    expect(state.blocks.map((block) => block.code)).toEqual(["PROVIDER_ADAPTER_NOT_INSTALLED"]);
  });

  it("mantém o bloqueio de aceite mesmo com provedor e sessão disponíveis", () => {
    const state = resolveCheckoutState(input({
      capability: availableProvider,
      sessionContractPublished: true,
    }));
    expect(state.blocks.map((block) => block.code)).toEqual(["POLICY_ACCEPTANCE_REQUIRED"]);
    expect(state.action).toBeNull();
    expect(state.step).toBe("POLICY");
  });

  it("libera a ação apenas com provedor, sessão publicada, aceite e valores fechando", () => {
    const state = resolveCheckoutState(input({
      capability: availableProvider,
      sessionContractPublished: true,
      policyAccepted: true,
    }));
    expect(state.blocks).toHaveLength(0);
    expect(state.action?.code).toBe("CREATE_PROVIDER_SESSION");
    expect(state.step).toBe("PROVIDER");
  });

  it("bloqueia quando o total do pedido diverge do valor autorizado", () => {
    const state = resolveCheckoutState(input({
      capability: availableProvider,
      sessionContractPublished: true,
      policyAccepted: true,
      order: { ...order, totalMinor: "124000", feeMinor: "6000" },
    }));
    expect(state.blocks.map((block) => block.code)).toEqual(["ORDER_TOTAL_MISMATCH"]);
    expect(state.action).toBeNull();
  });

  it("não bloqueia por decomposição ausente: só deixa de exibi-la", () => {
    const state = resolveCheckoutState(input({
      capability: availableProvider,
      sessionContractPublished: true,
      policyAccepted: true,
      order: null,
    }));
    expect(state.blocks).toHaveLength(0);
    expect(state.action?.code).toBe("CREATE_PROVIDER_SESSION");
  });
});

describe("resolveCheckoutState — cancelamento e regra de liquidação", () => {
  it("não oferece cancelamento sem permissão explícita do servidor", () => {
    const state = resolveCheckoutState(input());
    expect(state.allowsCancellation).toBe(false);
    expect(state.cancellationNote).toContain("não publicou ação de cancelamento");
  });

  it("aceita o cancelamento quando o servidor autoriza em allowedActions", () => {
    const state = resolveCheckoutState(input({ serverAllowedActions: ["PAYMENT_CANCEL"] }));
    expect(state.allowsCancellation).toBe(true);
  });

  it("repete a regra do webhook em todos os estágios", () => {
    const stages: CheckoutPayment["paymentStatus"][] = [
      "PENDING",
      "SETTLED",
      "FAILED",
      "CANCELLED",
      "PAYMENT_QUARANTINED",
    ];
    for (const paymentStatus of stages) {
      const state = resolveCheckoutState(input({ payment: { ...payment, paymentStatus } }));
      expect(state.settlementNote).toContain("Somente o webhook autenticado");
    }
  });
});

describe("seleção de pagamento e passos", () => {
  it("encontra o pagamento da pessoa autenticada pelo identificador", () => {
    const list = { data: [payment], asOf: "2026-08-24T12:00:00.000Z" };
    expect(findPaymentById(list, payment.paymentId)).toEqual(payment);
    expect(findPaymentById(list, "0199aa99-9999-7999-8999-999999999999")).toBeNull();
  });

  it("resolve o índice de cada passo do stepper", () => {
    expect(stepIndexOf("REVIEW")).toBe(0);
    expect(stepIndexOf("POLICY")).toBe(1);
    expect(stepIndexOf("PROVIDER")).toBe(2);
    expect(stepIndexOf("CONFIRMATION")).toBe(3);
  });
});
