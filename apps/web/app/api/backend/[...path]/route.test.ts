import { describe, expect, it } from "vitest";
import { GET, PUT } from "./route";

describe("BFF backend route", () => {
  it("expõe PUT com o mesmo proxy protegido usado por GET", () => {
    expect(PUT).toBe(GET);
  });
});
