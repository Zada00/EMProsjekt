import { describe, expect, it } from "vitest";
import { vurderDekning } from "../lib/dekningsvakt";
import { erEnige, velgBeste } from "../lib/konsensus";
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

describe("to-kjørings-konsensus", () => {
  // Scenarioene er hentet fra den faktiske --n=3-kjøringen mot Sandvika-rapporten.
  const risiko = (tittel: string, tg: number | null, alvorlighet = "middels") =>
    ({ tittel, forklaring: tittel, alvorlighet, tg, kilde: "s. 1" });
  const rapport = (risikoer: object[]) =>
    rapportSchema.parse({
      dokumenttype: "tilstandsrapport", dokument_advarsel: null, boligtype: null,
      byggeaar: null, bruksareal_bra_m2: null, sammendrag: "Test.",
      risikoer, sporsmal_til_visning: [], mulige_kostnader: [], ikke_funnet: [],
    });

  const fulle = [
    risiko("Fukt og svertesopp i bod", 3, "høy"),
    risiko("Manglende røykvarslere", 3, "høy"),
    risiko("Manglende brannslokkingsutstyr", 3, "høy"),
    risiko("Vannrør fra byggeåret", 2), risiko("Membran og tettesjikt bad", 2),
    risiko("Komfyrvakt mangler", 2), risiko("Skjevheter i gulv", 2),
    risiko("Elektrisk anlegg ikke undersøkt", 2), risiko("Balkongrekkverk for lavt", 2),
  ];

  it("enige: samme TG3-bilde selv når brann er slått sammen til ett funn", () => {
    const a = rapport(fulle);
    const b = rapport([
      risiko("Fukt i indre bod", 3, "høy"),
      risiko("Mangler røykvarslere og brannslokkingsutstyr", 3, "høy"), // sammenslått
      risiko("Vannrør", 2), risiko("Membran bad", 2), risiko("Komfyrvakt", 2),
      risiko("Skjevheter", 2), risiko("Sikringsskap ikke besiktiget", 2),
    ]);
    expect(erEnige(a, b)).toBe(true);
    expect(velgBeste(a, b)).toBe(a); // flest funn vinner
  });

  it("uenige: kollaps-kjøringen som mistet begge TG3-funnene", () => {
    const kollaps = rapport([
      risiko("Vannrør fra byggeåret", 2), risiko("Membran bad", 2),
      risiko("Vinduer fra byggeåret", 2), risiko("Balkongrekkverk", 2),
    ]);
    expect(erEnige(rapport(fulle), kollaps)).toBe(false);
  });

  it("dekningsvakt: forkaster analyse som har mistet midtsidene", () => {
    // Kildetekst som ligner Sandvika-rapporten: TG-omtale på s. 6, 7, 8 og 9.
    const kilde = [6, 7, 8, 9].map((n) => `[Side ${n}]\nTG 2\nVurdering av bygningsdel på side ${n}.`).join("\n");

    // Korrekt analyse siterer hele spennet.
    const hel = rapport([
      risiko("Bad", 2, "middels"), risiko("Bod", 3, "høy"),
      risiko("Brann", 3, "høy"), risiko("Balkong", 2, "middels"),
    ]);
    hel.risikoer[0].kilde = "s. 6"; hel.risikoer[1].kilde = "s. 7";
    hel.risikoer[2].kilde = "s. 8"; hel.risikoer[3].kilde = "s. 9";
    expect(vurderDekning(hel, kilde).ufullstendig).toBe(false);

    // Kollaps: modellen mistet midten og siterer bare de siste sidene.
    const amputert = rapport([risiko("Brann", 3, "høy"), risiko("Balkong", 2, "middels")]);
    amputert.risikoer[0].kilde = "s. 8"; amputert.risikoer[1].kilde = "s. 9";
    const dom = vurderDekning(amputert, kilde);
    expect(dom.ufullstendig).toBe(true);
    expect(dom.dekket).toBe(2);
    expect(dom.totalt).toBe(4);
  });

  it("dekningsvakt: avstår når dokumentet har for få TG-bærende sider", () => {
    const tynn = `[Side 1]\nSalgsoppgave med TG 2 nevnt én gang.`;
    const r = rapport([risiko("Noe", 2, "middels")]);
    const dom = vurderDekning(r, tynn);
    expect(dom.ufullstendig).toBe(false);
    expect(dom.usikker).toContain("ikke anvendelig");
  });

  it("uenige: dekningskollaps selv om TG3-funnene matcher", () => {
    const tynn = rapport([
      risiko("Fukt i bod", 3, "høy"),
      risiko("Røykvarslere og brannslokkingsutstyr mangler", 3, "høy"),
      risiko("Vannrør", 2),
    ]);
    expect(erEnige(rapport(fulle), tynn)).toBe(false); // 3 av 9 funn er under 60 %
  });
});
