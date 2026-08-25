import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Money } from "./money";
import { StatusBadge } from "./status-badge";

describe("composição de dados operacionais", () => {
  it("mantém valor e estado legíveis sem depender de cor", () => {
    render(<div><Money amountMinor={1250} currency="BRL" /><StatusBadge tone="warning">Em hold</StatusBadge></div>);
    expect(screen.getByText(/12,50/)).toBeInTheDocument();
    expect(screen.getByText("Em hold")).toBeInTheDocument();
  });
});
