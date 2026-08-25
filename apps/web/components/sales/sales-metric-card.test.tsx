import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  SalesMetricCard,
  formatMinorUnits,
  subtractMinorUnits,
  sumMinorUnits,
  type SalesMetric,
} from "./sales-metric-card";

afterEach(() => {
  cleanup();
});

describe("SalesMetricCard", () => {
  it("exige fonte e corte de leitura para exibir um valor", () => {
    const metric: SalesMetric = {
      state: "PUBLISHED",
      code: "GROSS_LOADED",
      label: "Bruto dos pedidos carregados",
      value: { kind: "MONEY", amountMinor: "125000", currency: "BRL" },
      source: {
        kind: "DERIVED_FROM_PAGE",
        endpoint: "GET /v1/seller-accounts/{sellerAccountId}/orders",
        derivation: "Soma de totalMinor",
      },
      asOf: "2026-08-24T12:00:00.000Z",
    };

    render(<SalesMetricCard metric={metric} />);

    expect(screen.getByRole("heading", { name: "Bruto dos pedidos carregados" })).toBeInTheDocument();
    expect(screen.getByText(/1\.250,00/)).toBeInTheDocument();
    expect(screen.getByText("Soma de totalMinor", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("GET /v1/seller-accounts/{sellerAccountId}/orders")).toBeInTheDocument();
    expect(screen.getByText(/Leitura em/)).toBeInTheDocument();
  });

  it("declara a métrica como não publicada em vez de inventar número", () => {
    const metric: SalesMetric = {
      state: "NOT_PUBLISHED",
      code: "CONVERSION_RATE",
      label: "Taxa de conversão",
      contract: "Contrato de métricas de vitrine ainda não definido em docs/07",
      reason: "A série de visitas não está publicada.",
    };

    render(<SalesMetricCard metric={metric} />);

    expect(screen.getByText("Métrica ainda não publicada")).toBeInTheDocument();
    expect(screen.getByText("A série de visitas não está publicada.")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it("degrada para não publicada quando a API responde fora do contrato de unidades mínimas", () => {
    const metric: SalesMetric = {
      state: "PUBLISHED",
      code: "GROSS_LOADED",
      label: "Bruto vendido",
      value: { kind: "MONEY", amountMinor: "24980,90", currency: "BRL" },
      source: {
        kind: "SERVER_FIELD",
        endpoint: "GET /v1/seller-accounts/{sellerAccountId}/orders",
        field: "grossAmountMinor",
      },
      asOf: "2026-08-24T12:00:00.000Z",
    };

    render(<SalesMetricCard metric={metric} />);

    expect(screen.getByText("Métrica ainda não publicada")).toBeInTheDocument();
    expect(screen.queryByText(/24\.980,90/)).not.toBeInTheDocument();
  });

  it("recusa contagem que não seja inteiro não negativo", () => {
    const metric: SalesMetric = {
      state: "PUBLISHED",
      code: "ORDERS_LOADED",
      label: "Pedidos carregados",
      value: { kind: "COUNT", count: -3 },
      source: {
        kind: "DERIVED_FROM_PAGE",
        endpoint: "GET /v1/seller-accounts/{sellerAccountId}/orders",
        derivation: "Contagem de linhas válidas",
      },
      asOf: "2026-08-24T12:00:00.000Z",
    };

    render(<SalesMetricCard metric={metric} />);
    expect(screen.getByText("Métrica ainda não publicada")).toBeInTheDocument();
  });
});

describe("aritmética em unidades mínimas", () => {
  it("formata acima do inteiro seguro sem passar por Number", () => {
    const formatted = formatMinorUnits("90071992547409910", "BRL");
    expect(formatted).not.toBeNull();
    expect(formatted).toContain("900.719.925.474.099,10");
  });

  it("rejeita entrada fora do contrato", () => {
    expect(formatMinorUnits("1.250,00", "BRL")).toBeNull();
    expect(formatMinorUnits("-1", "BRL")).toBeNull();
    expect(formatMinorUnits("1250", "brl")).toBeNull();
  });

  it("soma e subtrai em BigInt", () => {
    expect(sumMinorUnits(["1", "99999999999999999999"])).toBe("100000000000000000000");
    expect(sumMinorUnits(["1", "x"])).toBeNull();
    expect(subtractMinorUnits("1000", "150")).toBe("850");
    expect(subtractMinorUnits("100", "150")).toBeNull();
  });
});

describe("garantia de tipo", () => {
  it("não deixa compilar valor sem fonte nem valor em métrica não publicada", () => {
    // @ts-expect-error PUBLISHED exige source e asOf junto com value.
    const semFonte: SalesMetric = {
      state: "PUBLISHED",
      code: "GROSS",
      label: "Bruto vendido",
      value: { kind: "MONEY", amountMinor: "2498090", currency: "BRL" },
    };

    const comValorProibido: SalesMetric = {
      state: "NOT_PUBLISHED",
      code: "GROSS",
      label: "Bruto vendido",
      contract: "GET /v1/seller-accounts/{sellerAccountId}/orders",
      reason: "Sem leitura de pedidos.",
      // @ts-expect-error NOT_PUBLISHED nao possui a propriedade value.
      value: { kind: "MONEY", amountMinor: "2498090", currency: "BRL" },
    };

    expect(semFonte.state).toBe("PUBLISHED");
    expect(comValorProibido.state).toBe("NOT_PUBLISHED");
  });
});
