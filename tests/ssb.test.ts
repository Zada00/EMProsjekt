import { describe, expect, it } from "vitest";
import { boligtypeKode } from "../lib/ssb";

describe("boligtypeKode", () => {
  it("kjenner igjen enebolig", () => {
    expect(boligtypeKode("Enebolig")).toBe("01");
    expect(boligtypeKode("enebolig med hybel")).toBe("01");
  });

  it("kjenner igjen rekkehus/tomannsbolig/småhus", () => {
    expect(boligtypeKode("Rekkehus")).toBe("02");
    expect(boligtypeKode("Tomannsbolig")).toBe("02");
    expect(boligtypeKode("Småhus")).toBe("02");
  });

  it("kjenner igjen leilighet/blokk", () => {
    expect(boligtypeKode("Leilighet")).toBe("03");
    expect(boligtypeKode("Blokkleilighet")).toBe("03");
  });

  it("faller tilbake til 'alle boligtyper' ved ukjent eller manglende type", () => {
    expect(boligtypeKode("Gårdsbruk")).toBe("00");
    expect(boligtypeKode(null)).toBe("00");
    expect(boligtypeKode(undefined)).toBe("00");
  });
});
