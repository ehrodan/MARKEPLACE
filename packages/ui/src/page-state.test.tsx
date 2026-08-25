import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageState } from "./page-state";

describe("PageState", () => {
  it("expõe causa, recuperação e correlação sem criar conteúdo fictício", () => {
    render(
      <PageState
        kind="error"
        title="Não foi possível carregar"
        description="Tente novamente."
        reference="corr-123"
        actions={<button type="button">Tentar novamente</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "Não foi possível carregar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.getByText(/corr-123/)).toBeInTheDocument();
  });
});
