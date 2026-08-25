import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAVORITES_STORAGE_KEY } from "./favorites-storage";
import { FavoriteButton, type FavoriteButtonListing } from "./favorite-button";

const listing: FavoriteButtonListing = {
  listingId: "listing-1",
  publicSlug: "caixa-fundicao",
  title: "Caixa Fundição",
  priceMinor: "24900",
  currency: "BRL",
};

function storedIds(): string[] {
  const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
  if (raw === null) return [];
  return (JSON.parse(raw) as Array<{ listingId: string }>).map((entry) => entry.listingId);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("FavoriteButton", () => {
  it("nasce desligado e salva o anúncio no dispositivo ao clicar", () => {
    render(<FavoriteButton listing={listing} />);
    const button = screen.getByRole("button", { name: "Favoritar" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);

    expect(screen.getByRole("button", { name: "Salvo" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(storedIds()).toEqual(["listing-1"]);
  });

  it("remove do dispositivo ao clicar de novo", () => {
    render(<FavoriteButton listing={listing} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(storedIds()).toEqual([]);
  });

  it("reconhece um favorito já salvo no dispositivo ao montar", () => {
    render(<FavoriteButton listing={listing} />);
    fireEvent.click(screen.getByRole("button"));
    cleanup();

    render(<FavoriteButton listing={listing} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("favoritar nunca liga aviso por efeito colateral", () => {
    render(<FavoriteButton listing={listing} />);
    fireEvent.click(screen.getByRole("button"));

    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const entries = JSON.parse(raw ?? "[]") as Array<{ watch: unknown[] }>;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.watch).toEqual([]);
  });
});
