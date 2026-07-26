import { describe, expect, it } from "vitest";
import { beregnPrisvurdering } from "../lib/prisvurdering";
import type { Prisstatistikk } from "../lib/ssb";

describe("beregnPrisvurdering", () => {
  const stat: Prisstatistikk = {
    kommunenavn: "Halden",
    krPerM2: 30_000,
    kvartal: "2026K2",
    boligtype: "01",
  };

  it("regner ut kr/m² og avvik når prisantydning og areal finnes", () => {
    const r = beregnPrisvurdering(stat, 3_600_000, 120);
    expect(r.egenKrPerM2).toBe(30_000);
    expect(r.avvikProsent).toBe(0);
  });

  it("gir positivt avvik når boligen er dyrere enn snittet", () => {
    const r = beregnPrisvurdering(stat, 4_500_000, 100); // 45 000 kr/m²
    expect(r.egenKrPerM2).toBe(45_000);
    expect(r.avvikProsent).toBe(50);
  });

  it("returnerer null på egen-verdiene når prisantydning mangler", () => {
    const r = beregnPrisvurdering(stat, null, 120);
    expect(r.egenKrPerM2).toBeNull();
    expect(r.avvikProsent).toBeNull();
  });

  it("returnerer null på egen-verdiene når areal mangler eller er 0", () => {
    expect(beregnPrisvurdering(stat, 3_000_000, null).egenKrPerM2).toBeNull();
    expect(beregnPrisvurdering(stat, 3_000_000, 0).egenKrPerM2).toBeNull();
  });

  it("beholder kommunestatistikken uendret uansett", () => {
    const r = beregnPrisvurdering(stat, null, null);
    expect(r.kommunenavn).toBe("Halden");
    expect(r.krPerM2).toBe(30_000);
    expect(r.kvartal).toBe("2026K2");
  });
});
