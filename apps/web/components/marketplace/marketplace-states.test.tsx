import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketplaceLoading } from "./marketplace-states";

describe("MarketplaceLoading", () => {
  // O esqueleto do catálogo tem o FORMATO do card (visual + linhas do corpo),
  // não um retângulo genérico — a página não pula quando os dados chegam.
  it("carrega o catálogo com uma grade de esqueletos no formato do card", () => {
    const { container } = render(<MarketplaceLoading />);

    const region = screen.getByLabelText("Carregando anúncios");
    expect(region).toHaveAttribute("aria-busy", "true");
    // 1 esqueleto para a barra de filtros + 8 cards × 5 peças cada.
    expect(container.querySelectorAll(".ui-skeleton").length).toBeGreaterThanOrEqual(9);
  });

  it("mantém o esqueleto dedicado do detalhe", () => {
    render(<MarketplaceLoading detail />);
    expect(screen.getByLabelText("Carregando anúncio")).toHaveAttribute("aria-busy", "true");
  });
});
