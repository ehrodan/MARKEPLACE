import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NotificationItem,
  safeNotificationHref,
  type NotificationItemModel,
} from "./notification-item";

afterEach(cleanup);

const notification: NotificationItemModel = {
  notificationId: "019c8e44-53bd-7afe-bdc7-1cab0c4e27aa",
  kind: "ORDER_UPDATE",
  title: "Pagamento confirmado",
  body: "O pagamento do pedido foi confirmado.",
  deepLink: "/conta/compras/019c8e44-53bd-7afe-bdc7-1cab0c4e27aa",
  relatedRef: "PED-2048",
  readAt: null,
  createdAt: "2026-08-24T03:30:00.000Z",
};

describe("NotificationItem", () => {
  it("renderiza os campos canônicos e o link interno retornado pela API", () => {
    render(
      <NotificationItem
        item={notification}
        read={false}
        saving={false}
        onMarkRead={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Pagamento confirmado" })).toBeInTheDocument();
    expect(screen.getByText("Referência: PED-2048")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir contexto/ })).toHaveAttribute(
      "href",
      notification.deepLink,
    );
  });

  it("não transforma um deep link externo ou protocol-relative em navegação", () => {
    for (const value of ["https://example.invalid/phishing", "//example.invalid/phishing", "javascript:alert(1)"]) {
      expect(safeNotificationHref(value)).toBeNull();
    }

    render(
      <NotificationItem
        item={{ ...notification, deepLink: "https://example.invalid/phishing" }}
        read={false}
        saving={false}
        onMarkRead={vi.fn()}
      />,
    );

    expect(screen.queryByRole("link", { name: /Abrir contexto/ })).not.toBeInTheDocument();
    expect(screen.getByText("Sem link canônico nesta notificação")).toBeInTheDocument();
  });
});
