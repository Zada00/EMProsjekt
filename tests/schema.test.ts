import { describe, expect, it } from "vitest";
import { normaliserAlvorlighet, rapportSchema } from "../lib/schema";

/**
 * Regresjonsvern for datakontrakten: normaliseringen som reddet oss i første
 * ekte test (If-rapporten) skal aldri stille brekke. Kjør: npm test
 */
describe("skjema-normalisering", () => {
  const gyldigBasis = {
    dokumenttype: "tilstandsrapport",
    dokument_advarsel: null,
    boligtype: "Enebolig",
    byggeaar: 1984,
    bruksareal_bra_m2: 99,
    sammendrag: "Test.",
    risikoer: [],
    sporsmal_til_visning: [],
    mulige_kostnader: [],
    ikke_funnet: [],
  };

  it("godtar byggeår som '2001/2008/2013' og plukker første år", () => {
    const r = rapportSchema.parse({ ...gyldigBasis, byggeaar: "2001/2008/2013" });
    expect(r.byggeaar).toBe(2001);
  });

  it("godtar BRA som '142 m²'", () => {
    const r = rapportSchema.parse({ ...gyldigBasis, bruksareal_bra_m2: "142 m²" });
    expect(r.bruksareal_bra_m2).toBe(142);
  });

  it("normaliserer alvorlighet 'Høy' -> 'høy' og tg 'TG2' -> 2", () => {
    const r = rapportSchema.parse({
      ...gyldigBasis,
      risikoer: [
        { tittel: "x", forklaring: "y", alvorlighet: "Høy", tg: "TG2", kilde: "s. 1" },
      ],
    });
    expect(r.risikoer[0].alvorlighet).toBe("høy");
    expect(r.risikoer[0].tg).toBe(2);
  });

  it("normaliserer dokumenttype 'Salgsoppgave' og faller tilbake til 'annet' ved ukjent", () => {
    expect(rapportSchema.parse({ ...gyldigBasis, dokumenttype: "Salgsoppgave" }).dokumenttype).toBe("salgsoppgave");
    expect(rapportSchema.parse({ ...gyldigBasis, dokumenttype: "tullball" }).dokumenttype).toBe("annet");
  });

  it("avviser svar uten sammendrag", () => {
    const { sammendrag, ...uten } = gyldigBasis;
    expect(() => rapportSchema.parse(uten)).toThrow();
  });

  it("normaliserAlvorlighet: TG3→høy, TG2→middels, TG1→lav, null→urørt", () => {
    // Nemotron-buggen: ekte TG3 satt til 'middels' og TG2 oppgradert til 'høy'.
    const r = rapportSchema.parse({
      ...gyldigBasis,
      risikoer: [
        { tittel: "brann", forklaring: "y", alvorlighet: "middels", tg: 3, kilde: "s. 8" },
        { tittel: "membran", forklaring: "y", alvorlighet: "høy", tg: 2, kilde: "s. 6" },
        { tittel: "overflate", forklaring: "y", alvorlighet: "middels", tg: 1, kilde: "s. 5" },
        { tittel: "tegninger", forklaring: "y", alvorlighet: "lav", tg: null, kilde: "s. 9" },
      ],
    });
    const { rapport, korrigert } = normaliserAlvorlighet(r);
    expect(rapport.risikoer.map((x) => x.alvorlighet)).toEqual(["høy", "middels", "lav", "lav"]);
    expect(korrigert).toBe(3);
    // Originalen skal ikke muteres:
    expect(r.risikoer[0].alvorlighet).toBe("middels");
  });
});
