import { describe, expect, it } from "vitest";
import { validateProxyRequest } from "./proxy-policy";

describe("validateProxyRequest", () => {
  it("permite apenas a API e health conhecidos", () => {
    expect(validateProxyRequest("GET", ["v1", "me", "overview"]).allowed).toBe(true);
    expect(validateProxyRequest("GET", ["internal", "secrets"]).allowed).toBe(false);
  });

  it("bloqueia travessia de caminho e métodos não previstos", () => {
    expect(validateProxyRequest("GET", ["v1", "..", "health"]).allowed).toBe(false);
    expect(validateProxyRequest("OPTIONS", ["v1", "me"]).allowed).toBe(false);
  });

  it("permite PUT na API para contratos canônicos de substituição", () => {
    const result = validateProxyRequest("PUT", ["v1", "me", "reminder-consents"]);
    expect(result).toEqual({
      allowed: true,
      method: "PUT",
      path: "v1/me/reminder-consents",
    });
  });
});
