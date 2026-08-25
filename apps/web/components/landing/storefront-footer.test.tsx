import "@testing-library/jest-dom/vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StorefrontFooter } from "./storefront-footer";

// Sem `globals: true` no vitest, o auto-cleanup do Testing Library não roda.
afterEach(() => {
  cleanup();
});

describe("StorefrontFooter", () => {
  it("organiza os links em quatro grupos nomeados", () => {
    render(<StorefrontFooter />);
    const nav = screen.getByRole("navigation", { name: "Links do rodapé" });
    for (const title of ["Marketplace", "Conta", "Segurança e políticas", "Comunidade"]) {
      expect(within(nav).getByText(title)).toBeInTheDocument();
    }
  });

  it("todo link do rodapé aponta para uma rota que existe em app/", () => {
    // Honestidade também vale para navegação: link para página fantasma é
    // promessa quebrada. Cada href estático precisa ter page.tsx correspondente.
    render(<StorefrontFooter />);
    const nav = screen.getByRole("navigation", { name: "Links do rodapé" });
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href): href is string => href !== null);
    expect(hrefs.length).toBeGreaterThanOrEqual(12);
    for (const href of hrefs) {
      expect(href).toMatch(/^\//u);
      const pagePath = resolve(process.cwd(), "app", `.${href}`, "page.tsx");
      expect(existsSync(pagePath), `rota sem página: ${href}`).toBe(true);
    }
  });

  it("carrega o bloco de marca com missão honesta, sem superlativo inventado", () => {
    render(<StorefrontFooter />);
    // Regex ancorada na frase da missão para não colidir com a tagline
    // "VALOR QUE CONVERGE." do bloco legal.
    const mission = screen.getByText(/o valor converge para quem compra/iu);
    expect(mission).toBeInTheDocument();
    expect(mission.textContent).not.toMatch(/líder|milhões|nº\s*1|maior d[oa]/iu);
  });
});
