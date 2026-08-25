import { describe, expect, it } from "vitest";

import {
  parseRefundRequestDetail,
  parseRefundRequestPage,
  refundAwaitsBuyer,
  refundRequestStatuses,
  refundStatusLabel,
  refundStatusMeaning,
  refundStatusTone,
} from "./refund-request";

const validRow = {
  refundRequestId: "rr_01H8X",
  orderId: "6f1c4d0e-2f2b-4d2f-9f0e-77c1b5c39f01",
  status: "UNDER_REVIEW",
  requestedAmountMinor: "13200",
  currency: "BRL",
  createdAt: "2026-08-20T12:00:00.000Z",
};

describe("rótulos de estado da solicitação", () => {
  it("tem rótulo, significado e tom para cada estado do PRD", () => {
    for (const status of refundRequestStatuses) {
      expect(refundStatusLabel(status).length).toBeGreaterThan(0);
      expect(refundStatusMeaning(status).length).toBeGreaterThan(0);
      expect(["success", "warning", "danger", "neutral"]).toContain(refundStatusTone(status));
    }
  });

  it("só COMPLETED afirma dinheiro devolvido", () => {
    expect(refundStatusMeaning("COMPLETED")).toContain("dinheiro devolvido");
    expect(refundStatusMeaning("APPROVED")).toContain("não é dinheiro devolvido");
    expect(refundStatusTone("APPROVED")).toBe("success");
    expect(refundStatusTone("FAILED")).toBe("danger");
  });

  it("marca apenas o estado que depende do comprador", () => {
    expect(refundAwaitsBuyer("AWAITING_CUSTOMER_INFORMATION")).toBe(true);
    expect(refundAwaitsBuyer("UNDER_REVIEW")).toBe(false);
  });
});

describe("parseRefundRequestPage", () => {
  it("lê a página e preserva o cursor e o corte de leitura", () => {
    const page = parseRefundRequestPage({
      data: [validRow],
      nextCursor: "cursor-2",
      asOf: "2026-08-24T02:00:00.000Z",
      freshness: "READY",
    });

    expect(page?.items).toHaveLength(1);
    expect(page?.items[0]?.status).toBe("UNDER_REVIEW");
    expect(page?.items[0]?.approvedAmountMinor).toBeNull();
    expect(page?.nextCursor).toBe("cursor-2");
    expect(page?.asOf).toBe("2026-08-24T02:00:00.000Z");
    expect(page?.freshness).toBe("READY");
    expect(page?.discarded).toBe(0);
  });

  it("descarta e conta a linha fora do contrato em vez de exibi-la incompleta", () => {
    const page = parseRefundRequestPage({
      data: [
        validRow,
        { ...validRow, refundRequestId: "rr_2", requestedAmountMinor: 13200 },
        { ...validRow, refundRequestId: "rr_3", currency: "brl" },
        { ...validRow, refundRequestId: "rr_4", status: "REEMBOLSADO" },
      ],
    });

    expect(page?.items).toHaveLength(1);
    expect(page?.discarded).toBe(3);
    expect(page?.nextCursor).toBeNull();
    expect(page?.asOf).toBeNull();
  });

  it("recusa envelope sem lista", () => {
    expect(parseRefundRequestPage({ items: [] })).toBeNull();
    expect(parseRefundRequestPage(null)).toBeNull();
  });
});

describe("parseRefundRequestDetail", () => {
  it("lê o envelope com decisão e tentativas", () => {
    const detail = parseRefundRequestDetail({
      refundRequest: {
        ...validRow,
        status: "PARTIALLY_APPROVED",
        description: "Item veio divergente do anúncio.",
        reasonCode: "ITEM_NOT_AS_DESCRIBED",
        decision: {
          approvedAmountMinor: "6600",
          decidedAt: "2026-08-22T10:00:00.000Z",
          rationale: "Aprovado em parte pelo valor do item divergente.",
        },
        relatedTicketId: "tk_9",
      },
      attempts: [
        {
          refundAttemptId: "ra_1",
          status: "FAILED",
          occurredAt: "2026-08-22T11:00:00.000Z",
          failureCode: "PROVIDER_REJECTED",
        },
      ],
      asOf: "2026-08-24T02:00:00.000Z",
    });

    expect(detail?.status).toBe("PARTIALLY_APPROVED");
    expect(detail?.approvedAmountMinor).toBe("6600");
    expect(detail?.decidedAt).toBe("2026-08-22T10:00:00.000Z");
    expect(detail?.decisionRationale).toContain("Aprovado em parte");
    expect(detail?.attempts).toHaveLength(1);
    expect(detail?.attempts?.[0]?.failureCode).toBe("PROVIDER_REJECTED");
    expect(detail?.attempts?.[0]?.providerReference).toBeNull();
    expect(detail?.relatedTicketId).toBe("tk_9");
    expect(detail?.relatedDisputeId).toBeNull();
  });

  it("mantém aprovação e execução como fatos separados", () => {
    const aprovadoSemExecucao = parseRefundRequestDetail({
      ...validRow,
      status: "APPROVED",
      approvedAmountMinor: "13200",
      decidedAt: "2026-08-22T10:00:00.000Z",
      attempts: [],
    });

    expect(aprovadoSemExecucao?.approvedAmountMinor).toBe("13200");
    expect(aprovadoSemExecucao?.attempts).toEqual([]);
  });

  it("distingue tentativas ausentes de tentativas vazias", () => {
    const semCampo = parseRefundRequestDetail(validRow);
    expect(semCampo?.attempts).toBeNull();

    const vazio = parseRefundRequestDetail({ ...validRow, attempts: [] });
    expect(vazio?.attempts).toEqual([]);
  });

  it("nunca deduz valor aprovado a partir do solicitado", () => {
    const detail = parseRefundRequestDetail({ ...validRow, status: "APPROVED" });
    expect(detail?.approvedAmountMinor).toBeNull();
  });

  it("recusa dinheiro fora do contrato", () => {
    expect(parseRefundRequestDetail({ ...validRow, requestedAmountMinor: "12,00" })).toBeNull();
    expect(parseRefundRequestDetail({ ...validRow, status: "ESTORNADO" })).toBeNull();
    expect(parseRefundRequestDetail({ ...validRow, createdAt: "ontem" })).toBeNull();
    expect(parseRefundRequestDetail(undefined)).toBeNull();
  });
});
