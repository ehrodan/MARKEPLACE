import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PolicyAcceptance, type PolicySnapshot } from "./policy-acceptance";

// A configuração do vitest não usa `globals`, então a limpeza automática do
// testing-library não é registrada. Sem isto os renders se acumulam no mesmo DOM.
afterEach(cleanup);

const policy: PolicySnapshot = {
  policyId: "pol_checkout",
  title: "Política de compra",
  version: "2026.03",
  effectiveFrom: "2026-03-01T00:00:00.000Z",
  documentHref: "/politicas/politica-de-compra",
};

const CONTRACT = "GET /v1/policies/{policySlug}";

describe("PolicyAcceptance", () => {
  it("nunca renderiza a caixa pré-marcada", () => {
    render(
      <PolicyAcceptance
        policy={policy}
        accepted={false}
        onAcceptedChange={vi.fn()}
        contractPath={CONTRACT}
      />,
    );
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("declara qual política e qual versão está sendo aceita", () => {
    render(
      <PolicyAcceptance
        policy={policy}
        accepted={false}
        onAcceptedChange={vi.fn()}
        contractPath={CONTRACT}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /Política de compra, versão 2026\.03/u })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /versão 2026\.03/u })).toHaveAttribute(
      "href",
      "/politicas/politica-de-compra",
    );
  });

  it("mostra o motivo do bloqueio em texto e o associa ao campo", () => {
    render(
      <PolicyAcceptance
        policy={policy}
        accepted={false}
        onAcceptedChange={vi.fn()}
        contractPath={CONTRACT}
      />,
    );
    const blockMessage = screen.getByText(/o checkout não avança para o provedor de pagamento/u);
    expect(blockMessage).toBeVisible();
    const describedBy = screen.getByRole("checkbox").getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(" ")).toContain(blockMessage.id);
  });

  it("retira o motivo do bloqueio depois do aceite", () => {
    render(
      <PolicyAcceptance
        policy={policy}
        accepted
        onAcceptedChange={vi.fn()}
        contractPath={CONTRACT}
      />,
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.queryByText(/o checkout não avança para o provedor de pagamento/u)).toBeNull();
    expect(screen.getByText("ACEITE REGISTRADO NESTA SESSÃO")).toBeVisible();
  });

  it("propaga a marcação para quem controla o estado", () => {
    const onAcceptedChange = vi.fn();
    render(
      <PolicyAcceptance
        policy={policy}
        accepted={false}
        onAcceptedChange={onAcceptedChange}
        contractPath={CONTRACT}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onAcceptedChange).toHaveBeenCalledWith(true);
  });

  it("não oferece aceite quando o servidor não publica a versão da política", () => {
    render(
      <PolicyAcceptance
        policy={null}
        accepted={false}
        onAcceptedChange={vi.fn()}
        contractPath={CONTRACT}
      />,
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("CONTRACT_REQUIRED")).toBeVisible();
    expect(screen.getByText(CONTRACT)).toBeVisible();
    expect(screen.getByText(/não tem valor probatório/u)).toBeVisible();
  });

  it("respeita o estado desabilitado sem esconder o rótulo", () => {
    render(
      <PolicyAcceptance
        policy={policy}
        accepted={false}
        onAcceptedChange={vi.fn()}
        contractPath={CONTRACT}
        disabled
      />,
    );
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Política de compra/u })).toBeInTheDocument();
  });
});
