import { describe, expect, it } from "vitest";
import { safeInternalHref } from "./internal-href";

describe("safeInternalHref", () => {
  it("aceita apenas destinos da própria aplicação", () => {
    expect(safeInternalHref("/conta/compras?pagina=2#pedido")).toBe("/conta/compras?pagina=2#pedido");
    expect(safeInternalHref("//evil.example")).toBeNull();
    expect(safeInternalHref("/\\evil.example")).toBeNull();
    expect(safeInternalHref("/conta\n/externo")).toBeNull();
    expect(safeInternalHref("https://evil.example", "/conta")).toBe("/conta");
  });
});
