import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { ResourceError } from "./resource-state";

describe("ResourceError", () => {
  it("oferece login quando a sessão não autoriza a leitura", () => {
    render(<ResourceError error={new ApiError({ title: "Sessão ausente", status: 401, code: "UNAUTHORIZED" })} retry={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar");
  });

  it("expõe capability ausente sem inventar registros", () => {
    render(<ResourceError error={new ApiError({ title: "Não implementado", status: 404, code: "CAPABILITY_NOT_IMPLEMENTED" })} retry={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Capacidade ainda não disponibilizada pela API" })).toBeInTheDocument();
    expect(screen.getByText(/Nenhum registro fictício/)).toBeInTheDocument();
  });
});
