import "@testing-library/jest-dom/vitest";
import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScreenContractPage } from "./screen-contract-page";

// SCR-PUB-003 (/midas) é contrato real do lib/screen-contracts.generated.json:
// os asserts abaixo cobrem dados canônicos, não fixtures inventadas.
describe("ScreenContractPage", () => {
  it("apresenta a tela em preparação com título humano, status e honestidade", () => {
    const { container } = render(<ScreenContractPage screenId="SCR-PUB-003" />);
    const scoped = within(container);

    expect(scoped.getByRole("heading", { level: 1, name: /Vendido pelo Midas/ })).toBeInTheDocument();
    expect(scoped.getByText("SCR-PUB-003 · Experiência pública")).toBeInTheDocument();
    expect(scoped.getByText("Em preparação")).toBeInTheDocument();
    expect(scoped.getByText("Esta superfície ainda não opera; nada aqui é simulado.")).toBeInTheDocument();
  });

  it("aponta o visitante para o marketplace e para a central de ajuda", () => {
    const { container } = render(<ScreenContractPage screenId="SCR-PUB-010" />);
    const scoped = within(container);

    expect(scoped.getByRole("link", { name: "Explorar o marketplace" })).toHaveAttribute("href", "/market");
    expect(scoped.getByRole("link", { name: "Central de ajuda" })).toHaveAttribute("href", "/ajuda");
  });

  it("guarda o contrato técnico completo dentro de um details", () => {
    const { container } = render(<ScreenContractPage screenId="SCR-PUB-003" />);
    const details = container.querySelector("details");
    expect(details).not.toBeNull();

    const scoped = within(details as HTMLElement);
    expect(scoped.getByText("Contrato técnico da tela")).toBeInTheDocument();
    expect(scoped.getByText("/midas")).toBeInTheDocument();
    expect(scoped.getByText(/GET \/v1\/channels\/midas\/listings/)).toBeInTheDocument();
    expect(scoped.getByText(/nenhuma mutação foi liberada/)).toBeInTheDocument();
    expect(scoped.getByText(/default deny/)).toBeInTheDocument();
  });

  it("deriva as ações previstas do próprio contrato, sem inventar capacidade", () => {
    const { container } = render(<ScreenContractPage screenId="SCR-PUB-003" />);
    const list = within(container).getByRole("list", { name: "O que esta tela fará" });
    const items = within(list).getAllByRole("listitem");

    expect(items.length).toBeGreaterThan(0);
    expect(items.map((item) => item.textContent)).toContain("Filtrar");
    // Chips são informativos: nenhum deles pode ser link ou botão.
    expect(list.querySelectorAll("a, button")).toHaveLength(0);
  });
});
