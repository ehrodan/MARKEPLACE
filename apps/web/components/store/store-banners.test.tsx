import { describe, expect, it } from "vitest";
import { buildDoors } from "./store-banners";
import type { PublicListing } from "@/components/marketplace/types";

function oferta(itemType: string | null, priceMinor: string, id: string): PublicListing {
  return {
    listingId: id,
    publicSlug: `slug-${id}`,
    priceMinor,
    currency: "BRL",
    quantityAvailable: 3,
    catalogItem: itemType === null ? null : ({ itemType } as PublicListing["catalogItem"]),
  } as unknown as PublicListing;
}

describe("buildDoors", () => {
  it("não abre porta para categoria com uma oferta só", () => {
    // Uma porta larga que leva a um item só é uma promessa que a página
    // seguinte não cumpre.
    const doors = buildDoors([oferta("WEAPON", "1000", "a")]);
    expect(doors).toHaveLength(0);
  });

  it("agrupa por categoria e conta o que existe", () => {
    const doors = buildDoors([
      oferta("WEAPON", "1000", "a"),
      oferta("WEAPON", "5000", "b"),
      oferta("SKIN", "300", "c"),
      oferta("SKIN", "900", "d"),
      oferta("SKIN", "700", "e"),
    ]);
    expect(doors.map((d) => [d.itemType, d.count])).toEqual([
      ["SKIN", 3],
      ["WEAPON", 2],
    ]);
  });

  it("a faixa de preço é o mínimo e o máximo REAIS da categoria", () => {
    const doors = buildDoors([
      oferta("SKIN", "300", "a"),
      oferta("SKIN", "45900", "b"),
      oferta("SKIN", "1200", "c"),
    ]);
    expect(doors[0]?.minPriceMinor).toBe(300n);
    expect(doors[0]?.maxPriceMinor).toBe(45_900n);
  });

  it("usa BigInt, então preço acima do limite seguro de Number não corrompe", () => {
    const enorme = "9007199254740993";
    const doors = buildDoors([oferta("CASE", "100", "a"), oferta("CASE", enorme, "b")]);
    expect(doors[0]?.maxPriceMinor).toBe(BigInt(enorme));
    expect(doors[0]?.maxPriceMinor.toString()).toBe(enorme);
  });

  it("ignora anúncio sem categoria em vez de inventar uma", () => {
    const doors = buildDoors([
      oferta(null, "100", "a"),
      oferta(null, "200", "b"),
      oferta("KEY", "300", "c"),
      oferta("KEY", "400", "d"),
    ]);
    expect(doors).toHaveLength(1);
    expect(doors[0]?.itemType).toBe("KEY");
  });

  it("mostra no máximo três portas, as de maior liquidez", () => {
    const listagem = ["WEAPON", "SKIN", "CASE", "KEY", "STICKER"].flatMap((tipo, i) =>
      Array.from({ length: 10 - i }, (_, n) => oferta(tipo, "100", `${tipo}-${String(n)}`)),
    );
    const doors = buildDoors(listagem);
    expect(doors).toHaveLength(3);
    expect(doors.map((d) => d.itemType)).toEqual(["WEAPON", "SKIN", "CASE"]);
  });

  it("categoria com preço único devolve mínimo igual ao máximo", () => {
    // A tela usa esta igualdade para mostrar um preço só, em vez de um
    // intervalo com o mesmo número dos dois lados.
    const doors = buildDoors([oferta("CASE", "7800", "a"), oferta("CASE", "7800", "b")]);
    expect(doors[0]?.minPriceMinor).toBe(doors[0]?.maxPriceMinor);
  });
});
