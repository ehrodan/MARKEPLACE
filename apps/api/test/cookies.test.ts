import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  createSessionCookie,
  parseCookie,
} from "../src/http/cookies.js";

describe("session cookie", () => {
  it("gera cookie opaco HttpOnly sem localStorage", () => {
    const cookie = createSessionCookie("token/seguro", 3600, true);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(parseCookie(cookie, "midas_session")).toBe("token/seguro");
  });

  it("limpa a sessão com Max-Age zero", () => {
    expect(clearSessionCookie(false)).toContain("Max-Age=0");
  });
});
