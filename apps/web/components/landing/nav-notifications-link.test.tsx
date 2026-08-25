import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavNotificationsLink } from "./nav-notifications-link";
import { UNREAD_NOTIFICATIONS_ENDPOINT } from "./use-unread-notifications";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function notificationsPage(unreadCount: number): Response {
  return jsonResponse({
    data: [],
    unreadCount,
    nextCursor: null,
    asOf: "2026-08-25T12:00:00.000Z",
  });
}

function stubApi(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Deixa a cadeia fetch→json→setState terminar dentro de act. */
async function flushRequests(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("NavNotificationsLink — contagem real de não lidas", () => {
  it("mostra o número REAL no badge e no aria-label quando a API responde", async () => {
    stubApi(notificationsPage(3));
    render(<NavNotificationsLink />);

    const link = await screen.findByRole("link", { name: "Notificações, 3 não lidas" });
    expect(link).toHaveAttribute("href", "/conta/notificacoes");
    expect(screen.getByTestId("notifications-count")).toHaveTextContent("3");
  });

  it("usa singular quando há exatamente 1 não lida", async () => {
    stubApi(notificationsPage(1));
    render(<NavNotificationsLink />);

    expect(await screen.findByRole("link", { name: "Notificações, 1 não lida" }))
      .toBeInTheDocument();
  });

  it("zero não lidas não mostra badge nem número", async () => {
    stubApi(notificationsPage(0));
    render(<NavNotificationsLink />);
    await flushRequests();

    expect(screen.getByRole("link", { name: "Notificações" }))
      .toHaveAttribute("href", "/conta/notificacoes");
    expect(screen.queryByTestId("notifications-count")).not.toBeInTheDocument();
  });

  it("sem sessão (401) vira link simples, sem contagem inventada", async () => {
    stubApi(jsonResponse(
      { title: "Sessão ausente", status: 401, code: "UNAUTHORIZED" },
      401,
    ));
    render(<NavNotificationsLink />);
    await flushRequests();

    expect(screen.getByRole("link", { name: "Notificações" }))
      .toHaveAttribute("href", "/conta/notificacoes");
    expect(screen.queryByTestId("notifications-count")).not.toBeInTheDocument();
  });

  it("resposta fora do contrato (sem unreadCount numérico) conta como ausência de dado", async () => {
    stubApi(jsonResponse({ data: [] }));
    render(<NavNotificationsLink />);
    await flushRequests();

    expect(screen.getByRole("link", { name: "Notificações" })).toBeInTheDocument();
    expect(screen.queryByTestId("notifications-count")).not.toBeInTheDocument();
  });

  it("consulta o endpoint canônico com limit mínimo", async () => {
    const fetchMock = stubApi(notificationsPage(2));
    render(<NavNotificationsLink />);
    await flushRequests();

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/backend${UNREAD_NOTIFICATIONS_ENDPOINT}`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
