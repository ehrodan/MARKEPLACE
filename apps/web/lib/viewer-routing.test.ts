import { describe, expect, it } from "vitest";
import {
  allowlistedViewerOrigin,
  isSupportedBrandViewerSlug,
  viewer3dHref,
} from "./viewer-routing";

describe("roteamento seguro do viewer 3D", () => {
  it("aceita somente os slugs ligados ao GLB da marca", () => {
    expect(isSupportedBrandViewerSlug("ochpoch-market")).toBe(true);
    expect(isSupportedBrandViewerSlug("ochpoch-market-emblem")).toBe(true);
    expect(isSupportedBrandViewerSlug("outro-item")).toBe(false);
  });

  it("preserva apenas origens internas conhecidas", () => {
    expect(allowlistedViewerOrigin("/")).toBe("/");
    expect(allowlistedViewerOrigin("/anuncios/ochpoch-market-emblem-founder")).toBe(
      "/anuncios/ochpoch-market-emblem-founder",
    );
    expect(allowlistedViewerOrigin("//evil.example")).toBeNull();
    expect(allowlistedViewerOrigin("https://evil.example")).toBeNull();
    expect(allowlistedViewerOrigin(["/market"])).toBeNull();
  });

  it("codifica slug e origem ao montar a ponte", () => {
    expect(viewer3dHref("ochpoch-market-emblem", "/anuncios/founder")).toBe(
      "/itens/ochpoch-market-emblem/3d?from=%2Fanuncios%2Ffounder",
    );
    expect(viewer3dHref("item com espaço", "https://evil.example")).toBe(
      "/itens/item%20com%20espa%C3%A7o/3d",
    );
  });
});
