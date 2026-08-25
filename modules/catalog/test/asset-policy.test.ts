import { describe, expect, it } from "vitest";
import { isSafeCatalogAssetUri } from "../src/asset-policy.js";

describe("isSafeCatalogAssetUri", () => {
  it.each([
    "/catalog/items/poster.webp",
    "s3://catalog-assets/items/poster.webp",
    "https://cdn.example.test/items/poster.webp",
    "http://minio.example.test/catalog/items/poster.webp",
  ])("aceita origem de asset suportada: %s", (uri) => {
    expect(isSafeCatalogAssetUri(uri)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://user:password@cdn.example.test/poster.webp",
    "//cdn.example.test/poster.webp",
    "/catalog/../private/secret",
    "/catalog/%2e%2e/private/secret",
    "/catalog/%252e%252e/private/secret",
    "/catalog/%5c..%5cprivate/secret",
  ])("rejeita URI ambígua ou perigosa: %s", (uri) => {
    expect(isSafeCatalogAssetUri(uri)).toBe(false);
  });
});
