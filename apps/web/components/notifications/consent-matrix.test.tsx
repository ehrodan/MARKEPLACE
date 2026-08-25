import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildConsentMutationBody,
  ConsentMatrix,
  type ConsentChannel,
  type ConsentPurpose,
  type ConsentRecord,
} from "./consent-matrix";

// `globals: false` no vitest.config.ts: o auto-cleanup do Testing Library não
// registra sozinho, então cada teste limpa o DOM explicitamente.
afterEach(cleanup);

const purposes: ConsentPurpose[] = ["CART_RECOVERY", "PRICE_WATCH", "STOCK_WATCH", "ORDER_UPDATE"];
const channels: ConsentChannel[] = ["EMAIL", "PUSH", "IN_APP"];

function consent(
  purpose: ConsentPurpose,
  channel: ConsentChannel,
  state: ConsentRecord["state"] = "GRANTED",
): ConsentRecord {
  return {
    purpose,
    channel,
    state,
    granted: state === "GRANTED",
    decidedAt: state === "MISSING" ? null : "2026-08-01T12:00:00.000Z",
    policyVersion: state === "MISSING" ? null : "retention-reminder-policy@1.0.0",
  };
}

const grantedEverywhere = purposes.flatMap((purpose) => (
  channels.map((channel) => consent(purpose, channel))
));

const optionalControlCount = purposes.length * channels.length;

describe("ConsentMatrix", () => {
  it("nunca renderiza um canal ligado quando não existe registro de consentimento", () => {
    render(<ConsentMatrix consents={[]} />);

    const controls = screen.getAllByRole("checkbox");
    expect(controls).toHaveLength(optionalControlCount);
    for (const control of controls) expect(control).not.toBeChecked();

    expect(screen.queryByText("Ligado")).not.toBeInTheDocument();
    expect(screen.getAllByText("Desligado")).toHaveLength(optionalControlCount);
    expect(screen.getAllByText("Sem decisão registrada")).toHaveLength(optionalControlCount);
  });

  it("mantém desligado o canal cujo registro existe com granted false", () => {
    render(
      <ConsentMatrix
        consents={[consent("PRICE_WATCH", "EMAIL", "REVOKED")]}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Vigilância de preço por E-mail" })).not.toBeChecked();
    expect(screen.queryByText("Ligado")).not.toBeInTheDocument();
  });

  it("liga o canal apenas quando o registro autoriza explicitamente", () => {
    render(
      <ConsentMatrix
        consents={[consent("STOCK_WATCH", "PUSH")]}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Volta ao estoque por Push" })).toBeChecked();
    expect(screen.getAllByText("Ligado")).toHaveLength(1);
  });

  it("marca ORDER_UPDATE como transacional e respeita a revogação exposta pela API", () => {
    render(<ConsentMatrix consents={[]} />);

    expect(screen.getByText("Transacional")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Andamento do pedido por E-mail" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Andamento do pedido por Push" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Andamento do pedido por No app" })).toBeInTheDocument();
    expect(screen.getByText(/Se você o revogar, a política bloqueia novos lembretes/i)).toBeInTheDocument();
  });

  it("prepara a revogação de todos os canais", () => {
    render(<ConsentMatrix consents={grantedEverywhere} />);

    expect(screen.getAllByText("Ligado")).toHaveLength(optionalControlCount);

    fireEvent.click(screen.getByRole("button", { name: /Desligar todos os lembretes/ }));

    for (const control of screen.getAllByRole("checkbox")) expect(control).not.toBeChecked();
    expect(screen.queryByText("Ligado")).not.toBeInTheDocument();
    expect(screen.getAllByText("Desligado")).toHaveLength(optionalControlCount);
  });

  it("usa rótulo neutro para desligar, sem confirmshaming", () => {
    render(<ConsentMatrix consents={grantedEverywhere} />);

    const protectiveButton = screen.getByRole("button", { name: /Desligar todos os lembretes/ });
    expect(protectiveButton).toBeEnabled();
    expect(protectiveButton.textContent).toBe("Desligar todos os lembretes");
    expect(screen.queryByText(/prefiro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/perder ofertas/i)).not.toBeInTheDocument();
  });

  it("salva apenas as células alteradas e descreve cada mudança", () => {
    const onSave = vi.fn();
    render(<ConsentMatrix consents={[]} onSave={onSave} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Vigilância de preço por E-mail" }));

    expect(screen.getByText("Vigilância de preço por E-mail: ligado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith([{ purpose: "PRICE_WATCH", channel: "EMAIL", granted: true }]);
  });

  it("bloqueia mutação em modo somente leitura mas mantém a estrutura visível", () => {
    render(<ConsentMatrix consents={[]} disabled />);

    for (const control of screen.getAllByRole("checkbox")) expect(control).toBeDisabled();
    expect(screen.getByRole("button", { name: /Desligar todos os lembretes/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeDisabled();
    expect(screen.getByText(/Um lembrete para retomar um carrinho salvo/)).toBeInTheDocument();
  });

  it("não trata granted inconsistente como autorização sem estado GRANTED", () => {
    render(
      <ConsentMatrix
        consents={[{ ...consent("PRICE_WATCH", "EMAIL", "REVOKED"), granted: true }]}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Vigilância de preço por E-mail" })).not.toBeChecked();
  });

  it("envia reoptIn somente quando a pessoa religa um par revogado", () => {
    const change = { purpose: "PRICE_WATCH", channel: "EMAIL", granted: true } as const;

    expect(buildConsentMutationBody(change, consent("PRICE_WATCH", "EMAIL", "REVOKED"))).toEqual({
      ...change,
      reoptIn: true,
    });
    expect(buildConsentMutationBody(change, consent("PRICE_WATCH", "EMAIL", "MISSING"))).toEqual(change);
    expect(buildConsentMutationBody(
      { ...change, granted: false },
      consent("PRICE_WATCH", "EMAIL", "REVOKED"),
    )).toEqual({ ...change, granted: false });
  });
});
