import { describe, expect, it } from "vitest";
import { loadApiConfig } from "../src/config.js";

describe("configuração HTTP", () => {
  it("usa PORT antes de API_PORT e mantém a marca externa configurável", () => {
    const config = loadApiConfig({
      DATABASE_URL: "postgresql://user:password@localhost:5432/midas",
      PORT: "3010",
      API_PORT: "3011",
      NEXT_PUBLIC_BRAND_NAME: "OCHPOCH MARKET TEST",
    });
    expect(config.port).toBe(3010);
    expect(config.brandName).toBe("OCHPOCH MARKET TEST");
  });

  it("aceita API_PORT quando PORT não foi definido", () => {
    const config = loadApiConfig({
      DATABASE_URL: "postgresql://user:password@localhost:5432/midas",
      API_PORT: "3011",
    });
    expect(config.port).toBe(3011);
  });

  it("usa WEB_ORIGIN no link público e no CORS quando aliases específicos faltam", () => {
    const config = loadApiConfig({
      DATABASE_URL: "postgresql://user:password@localhost:5432/midas",
      WEB_ORIGIN: "http://127.0.0.1:3000",
    });
    expect(config.publicWebUrl).toBe("http://127.0.0.1:3000");
    expect(config.corsAllowedOrigins.has("http://127.0.0.1:3000")).toBe(true);
  });
});
