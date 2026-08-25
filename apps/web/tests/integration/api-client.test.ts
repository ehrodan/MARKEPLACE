import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api-client";

afterEach(() => vi.unstubAllGlobals());

describe("integração do cliente com o BFF", () => {
  it("envia cookie same-origin e o header CSRF canônico em mutações", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await apiRequest<unknown>("/v1/auth/login", { method: "POST", body: JSON.stringify({ email: "a@example.com", password: "senha" }) });
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls.at(0);
    expect(call).toBeDefined();
    if (!call) throw new Error("A integração não chamou fetch");
    const [url, options] = call;
    expect(url).toBe("/api/backend/v1/auth/login");
    expect(options?.credentials).toBe("same-origin");
    expect(new Headers(options?.headers).get("x-midas-csrf")).toBe("1");
  });

  it("preserva problem details sem substituir por dados de demonstração", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ title: "Sem capability", status: 404, code: "CAPABILITY_NOT_IMPLEMENTED", correlationId: "corr-1" }), { status: 404, headers: { "content-type": "application/problem+json" } })));
    await expect(apiRequest("/v1/me/overview")).rejects.toMatchObject({ problem: { code: "CAPABILITY_NOT_IMPLEMENTED", correlationId: "corr-1" } });
  });
});
