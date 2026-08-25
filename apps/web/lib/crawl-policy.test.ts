import { describe, expect, it } from "vitest";
import { crawlPolicy, publicSiteUrl } from "./crawl-policy";

describe("crawlPolicy", () => {
  it("falha fechado fora de produção ou sem domínio contratado", () => {
    expect(crawlPolicy({ NODE_ENV: "development" }).indexable).toBe(false);
    expect(crawlPolicy({ NODE_ENV: "production" }).indexable).toBe(false);
  });

  it("exige HTTPS em produção e normaliza o domínio público", () => {
    expect(publicSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://example.com" })).toBeNull();
    expect(publicSiteUrl({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://market.example/path?q=1" })?.href)
      .toBe("https://market.example/");
  });

  it("mantém workbenches privados fora do crawl", () => {
    const policy = crawlPolicy({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://market.example" });
    expect(policy.indexable).toBe(true);
    expect(policy.privateRoutePrefixes).toContain("/conta/");
    expect(policy.privateRoutePrefixes).toContain("/admin/");
    expect(policy.privateRoutePrefixes).toContain("/master/");
  });
});
