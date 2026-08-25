import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmationPanel } from "./confirmation-panel";
import {
  resolveDeliveryState,
  type DeliveryParty,
  type DeliveryPayload,
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
    instructionRevealedAt: "2026-08-20T10:05:00.000Z",
    version: 1,
    createdAt: "2026-08-20T10:05:00.000Z",
    updatedAt: "2026-08-20T10:05:00.000Z",
    ...overrides,
  };
}

function renderPanel(input: {
  order?: OrderPayload;
  delivery?: DeliveryPayload | null;
  viewer?: DeliveryParty | null;
  confirming?: boolean;
  actionError?: string | null;
  onConfirm?: () => void;
}) {
  const target = input.order ?? order();
  const pack = input.delivery === undefined ? delivery() : input.delivery;
  return render(
    <ConfirmationPanel
      order={target}
      delivery={pack}
      state={resolveDeliveryState(target, pack)}
      viewer={input.viewer === undefined ? "BUYER" : input.viewer}
      confirming={input.confirming ?? false}
      actionError={input.actionError ?? null}
      onConfirm={input.onConfirm ?? vi.fn()}
      helpHref="/ajuda"
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("ConfirmationPanel — os dois estados de confirmação", () => {
  it("mostra o estado do próprio lado e o do outro lado, separados", () => {
    renderPanel({ viewer: "BUYER", delivery: delivery({ status: "SELLER_CONFIRMED", sellerConfirmedAt: "2026-08-21T09:00:00.000Z" }) });

    expect(screen.getByText("Sua confirmação (comprador)")).toBeInTheDocument();
    expect(screen.getByText("Confirmação do vendedor")).toBeInTheDocument();
    expect(screen.getByText("Não registrada")).toBeInTheDocument();
    expect(screen.getByText("Registrada")).toBeInTheDocument();
  });

  it("não sugere que a confirmação do outro lado depende da sua", () => {
    renderPanel({ viewer: "SELLER", delivery: delivery() });
    expect(
      screen.getByText(/decide sozinha, no tempo dela/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/não dispara, não\s+substitui e não obriga a outra/i)).toBeInTheDocument();
  });

  it("anuncia por aria-live quando os estados de confirmação mudam", () => {
    const view = renderPanel({ viewer: "BUYER", delivery: delivery() });
    const live = screen.getByTestId("delivery-confirmation-live");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live.textContent).toBe("");

    const target = order();
    const updated = delivery({ status: "BUYER_CONFIRMED", buyerConfirmedAt: "2026-08-21T10:00:00.000Z" });
    view.rerender(
      <ConfirmationPanel
        order={target}
        delivery={updated}
        state={resolveDeliveryState(target, updated)}
        viewer="BUYER"
        confirming={false}
        actionError={null}
        onConfirm={vi.fn()}
        helpHref="/ajuda"
      />,
    );

    expect(screen.getByTestId("delivery-confirmation-live").textContent).toContain(
      "Sua confirmação: registrada",
    );
    expect(screen.getByTestId("delivery-confirmation-live").textContent).toContain(
      "Confirmação do vendedor: ainda não registrada",
    );
  });
});

describe("ConfirmationPanel — confirmação deliberada", () => {
  it("exige dois passos e a marcação de ciência antes de confirmar", () => {
    const onConfirm = vi.fn();
    renderPanel({ viewer: "BUYER", onConfirm });

    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar que recebi o pedido OCH-2026-000001/ }),
    );
    expect(onConfirm).not.toHaveBeenCalled();

    const definitive = screen.getByRole("button", {
      name: /Registrar minha confirmação definitiva do pedido OCH-2026-000001/,
    });
    expect(definitive).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Li a consequência e quero registrar minha confirmação/));
    expect(definitive).toBeEnabled();

    fireEvent.click(definitive);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("dá ao vendedor um nome acessível que descreve o ato dele", () => {
    renderPanel({ viewer: "SELLER" });
    expect(
      screen.getByRole("button", { name: /Confirmar que entreguei o pedido OCH-2026-000001/ }),
    ).toBeInTheDocument();
  });

  it("avisa a consequência da dupla confirmação antes do registro", () => {
    renderPanel({ viewer: "BUYER" });
    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar que recebi o pedido OCH-2026-000001/ }),
    );
    expect(screen.getByText(/retenção dos\s+valores do vendedor começa/i)).toBeInTheDocument();
  });

  it("não abre o passo deliberado quando a confirmação já está registrada", () => {
    renderPanel({
      viewer: "BUYER",
      delivery: delivery({ status: "BUYER_CONFIRMED", buyerConfirmedAt: "2026-08-21T10:00:00.000Z" }),
    });
    const trigger = screen.getByRole("button", {
      name: /Confirmar que recebi o pedido OCH-2026-000001/,
    });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(trigger);
    expect(
      screen.queryByRole("button", { name: /Registrar minha confirmação definitiva/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/já foi registrada e não é repetida/)).toBeInTheDocument();
  });

  it("explica o bloqueio em disputa em vez de sumir com o botão", () => {
    renderPanel({ order: order({ status: "DISPUTED" }), viewer: "SELLER" });
    expect(screen.getByText(/suspensa enquanto a disputa está em análise/)).toBeInTheDocument();
  });
});

describe("ConfirmationPanel — saída de conflito", () => {
  it("mantém reportar problema e abrir disputa visíveis junto do confirmar", () => {
    renderPanel({ viewer: "BUYER" });
    expect(
      screen.getByRole("link", { name: /Reportar problema no pedido OCH-2026-000001/ }),
    ).toHaveAttribute("href", "/ajuda");
    expect(
      screen.getByRole("link", { name: /Abrir disputa do pedido OCH-2026-000001/ }),
    ).toHaveAttribute("href", "/ajuda");
  });

  it("mantém a saída de conflito mesmo depois de o usuário já ter confirmado", () => {
    renderPanel({
      viewer: "SELLER",
      delivery: delivery({ status: "SELLER_CONFIRMED", sellerConfirmedAt: "2026-08-21T10:00:00.000Z" }),
    });
    expect(
      screen.getByRole("link", { name: /Abrir disputa do pedido OCH-2026-000001/ }),
    ).toBeInTheDocument();
  });

  it("diz por que a abertura direta não está publicada, sem simular a ação", () => {
    renderPanel({ viewer: "BUYER" });
    expect(screen.getByText(/Não existe rota publicada para abrir disputa/)).toBeInTheDocument();
    expect(screen.getByText(/Não existe rota publicada para registrar problema/)).toBeInTheDocument();
  });
});

describe("ConfirmationPanel — papel não verificado", () => {
  it("mostra os dois estados e recusa confirmar em nome de papel não verificado", () => {
    renderPanel({ viewer: null });
    expect(screen.getByText("Confirmação do comprador")).toBeInTheDocument();
    expect(screen.getByText("Confirmação do vendedor")).toBeInTheDocument();
    expect(screen.getByText(/papel neste pedido não pôde ser verificado/)).toBeInTheDocument();
  });
});
