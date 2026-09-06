import { describe, expect, it } from "vitest";
import { vurderDekning } from "../lib/dekningsvakt";
import { erEnige, velgBeste } from "../lib/konsensus";
import { normaliserAlvorlighet, rapportSchema, sorterKostnader } from "../lib/schema";

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

describe("økonomi etter boligtype", () => {
  const med = (felt: object) =>
    rapportSchema.parse({
      dokumenttype: "salgsoppgave", dokument_advarsel: null, boligtype: null,
      byggeaar: null, bruksareal_bra_m2: null, sammendrag: "Test.",
      risikoer: [], sporsmal_til_visning: [], mulige_kostnader: [], ikke_funnet: [],
      ...felt,
    });

  it("holder enebolig fri for felleskostnader", () => {
    const r = med({
      okonomi: {
        eierform: "selveier", felleskostnader_mnd: null, fellesgjeld: null,
        kommunale_avgifter_aar: 14500, eiendomsskatt_aar: 3200,
        planlagte_fellesprosjekter: null, kilde: "s. 2",
      },
    });
    expect(r.okonomi.felleskostnader_mnd).toBeNull();
    expect(r.okonomi.kommunale_avgifter_aar).toBe(14500);
  });

  it("skiller sameie fra borettslag", () => {
    expect(med({ okonomi: { eierform: "Sameie", felleskostnader_mnd: 3500, fellesgjeld: null, kommunale_avgifter_aar: null, eiendomsskatt_aar: null, planlagte_fellesprosjekter: null, kilde: null } }).okonomi.eierform).toBe("sameie");
    expect(med({ okonomi: { eierform: "borettslag", felleskostnader_mnd: 4200, fellesgjeld: 850000, kommunale_avgifter_aar: null, eiendomsskatt_aar: null, planlagte_fellesprosjekter: null, kilde: null } }).okonomi.eierform).toBe("borettslag");
  });

  it("faller tilbake til 'ikke opplyst' for eldre svar", () => {
    expect(med({}).okonomi.eierform).toBe("ikke opplyst");
  });
});

describe("parkering", () => {
  const med = (felt: object) =>
    rapportSchema.parse({
      dokumenttype: "salgsoppgave", dokument_advarsel: null, boligtype: null,
      byggeaar: null, bruksareal_bra_m2: null, sammendrag: "Test.",
      risikoer: [], sporsmal_til_visning: [], mulige_kostnader: [], ikke_funnet: [],
      ...felt,
    });

  it("skiller 'ingen' fra 'ikke opplyst'", () => {
    // "det følger ikke parkering med" er en opplysning; taushet er det ikke.
    expect(med({ parkering: { type: "ingen", beskrivelse: null, vilkar: null, kilde: "s. 2" } }).parkering.type).toBe("ingen");
    expect(med({}).parkering.type).toBe("ikke opplyst");
  });

  it("beholder vilkår, som er det viktigste feltet", () => {
    const r = med({
      parkering: { type: "felles", beskrivelse: "Én plass i garasjekjeller", vilkar: "Plassen leies av sameiet og følger ikke boligen ved salg", kilde: "s. 4" },
    });
    expect(r.parkering.vilkar).toContain("leies av sameiet");
  });
});

describe("selgers egenerklæring", () => {
  const med = (felt: object) =>
    rapportSchema.parse({
      dokumenttype: "salgsoppgave", dokument_advarsel: null, boligtype: null,
      byggeaar: null, bruksareal_bra_m2: null, sammendrag: "Test.",
      risikoer: [], sporsmal_til_visning: [], mulige_kostnader: [], ikke_funnet: [],
      ...felt,
    });

  it("skiller 'ingen opplysninger' fra 'ikke vedlagt'", () => {
    expect(med({ egenerklaering_status: "ingen opplysninger" }).egenerklaering_status).toBe("ingen opplysninger");
    expect(med({ egenerklaering_status: "ikke vedlagt" }).egenerklaering_status).toBe("ikke vedlagt");
  });

  it("faller tilbake til 'ikke vedlagt', aldri til 'ingen opplysninger'", () => {
    expect(med({}).egenerklaering_status).toBe("ikke vedlagt");
    expect(med({ egenerklaering_status: "vet ikke" }).egenerklaering_status).toBe("ikke vedlagt");
  });

  it("bruker samme kategorier som avvikene", () => {
    const r = med({
      egenerklaering_status: "opplysninger funnet",
      egenerklaering: [{ kategori: "Bad og våtrom", type: "Utbedret", hva: "Nytt bad i 2021", kilde: "s. 3" }],
    });
    expect(r.egenerklaering[0].kategori).toBe("bad og våtrom");
    expect(r.egenerklaering[0].type).toBe("utbedret");
  });
});

describe("areal og romfordeling", () => {
  const med = (felt: object) =>
    rapportSchema.parse({
      dokumenttype: "tilstandsrapport", dokument_advarsel: null, boligtype: null,
      byggeaar: null, bruksareal_bra_m2: null, sammendrag: "Test.",
      risikoer: [], sporsmal_til_visning: [], mulige_kostnader: [], ikke_funnet: [],
      ...felt,
    });

  it("normaliserer arealtype og tall fra tekst", () => {
    const r = med({ areal_detaljer: [{ type: "BRA-i", m2: "99 m²", kilde: "s. 2" }] });
    expect(r.areal_detaljer[0].type).toBe("bra-i");
    expect(r.areal_detaljer[0].m2).toBe(99);
  });

  it("forkaster ukjent arealtype i stedet for å oppfinne en", () => {
    // catch([]) på hele listen: hellere ingen arealoppdeling enn en gal en.
    expect(med({ areal_detaljer: [{ type: "loftsareal", m2: 12, kilde: null }] }).areal_detaljer).toEqual([]);
  });

  it("leser etasjer med rom", () => {
    const r = med({ etasjer: [{ navn: "1. etasje", rom: ["entré", "bod"] }] });
    expect(r.etasjer[0].rom).toEqual(["entré", "bod"]);
  });

  it("tåler eldre svar uten areal, rom og etasjer", () => {
    const r = med({});
    expect(r.areal_detaljer).toEqual([]);
    expect(r.etasjer).toEqual([]);
    expect(r.antall_rom).toBeNull();
    expect(r.antall_soverom).toBeNull();
  });
});

describe("planløsning og godkjenning", () => {
  const med = (felt: object) =>
    rapportSchema.parse({
      dokumenttype: "tilstandsrapport", dokument_advarsel: null, boligtype: null,
      byggeaar: null, bruksareal_bra_m2: null, sammendrag: "Test.",
      risikoer: [], sporsmal_til_visning: [], mulige_kostnader: [], ikke_funnet: [],
      ...felt,
    });

  it("godtar de tre statusene", () => {
    expect(med({ planlosning_status: "avvik" }).planlosning_status).toBe("avvik");
    expect(med({ planlosning_status: "Ingen avvik" }).planlosning_status).toBe("ingen avvik");
    expect(med({ planlosning_status: "ikke vurdert" }).planlosning_status).toBe("ikke vurdert");
  });

  it("faller tilbake til 'ikke vurdert' – aldri til 'ingen avvik'", () => {
    // Det forsiktige valget: at ingen har sett etter er ikke det samme
    // som at alt er i orden.
    expect(med({}).planlosning_status).toBe("ikke vurdert");
    expect(med({ planlosning_status: "tullball" }).planlosning_status).toBe("ikke vurdert");
  });

  it("leser avvik med rom og kilde", () => {
    const r = med({
      planlosning_status: "avvik",
      planlosning_avvik: [{ hva: "Ikke godkjent for varig opphold", rom: "Kjellerstue", kilde: "s. 12" }],
    });
    expect(r.planlosning_avvik).toHaveLength(1);
    expect(r.planlosning_avvik[0].rom).toBe("Kjellerstue");
  });
});

describe("kategorisering av avvik", () => {
  const medRisiko = (r: object) =>
    rapportSchema.parse({
      dokumenttype: "tilstandsrapport", dokument_advarsel: null, boligtype: null,
      byggeaar: null, bruksareal_bra_m2: null, sammendrag: "Test.",
      risikoer: [r], sporsmal_til_visning: [], mulige_kostnader: [], ikke_funnet: [],
    });
  const basis = { tittel: "x", forklaring: "y", alvorlighet: "middels", tg: 2, kilde: "s. 6" };

  it("normaliserer store bokstaver i kategori", () => {
    expect(medRisiko({ ...basis, kategori: "Bad og Våtrom" }).risikoer[0].kategori).toBe("bad og våtrom");
  });

  it("faller tilbake til 'annet' ved ukjent kategori", () => {
    expect(medRisiko({ ...basis, kategori: "kjellerstue" }).risikoer[0].kategori).toBe("annet");
  });

  it("faller tilbake til 'annet' når kategori mangler (eldre svar)", () => {
    expect(medRisiko(basis).risikoer[0].kategori).toBe("annet");
  });
});

describe("sortering av kostnader", () => {
  const kost = (hva: string, grovt_niva: string) => ({
    hva, grovt_niva, vurdering: hva, konsekvens: null, sporsmal: [], kilde: null,
  });
  const medKostnader = (k: object[]) =>
    rapportSchema.parse({
      dokumenttype: "tilstandsrapport", dokument_advarsel: null, boligtype: null,
      byggeaar: null, bruksareal_bra_m2: null, sammendrag: "Test.",
      risikoer: [], sporsmal_til_visning: [], mulige_kostnader: k, ikke_funnet: [],
    });

  it("sorterer stor → ukjent → middels → liten", () => {
    const r = medKostnader([
      kost("komfyrvakt", "liten"), kost("rør", "stor"),
      kost("rekkverk", "middels"), kost("fukt i bod", "ukjent"),
    ]);
    expect(sorterKostnader(r).mulige_kostnader.map((k) => k.hva)).toEqual([
      "rør", "fukt i bod", "rekkverk", "komfyrvakt",
    ]);
  });

  it("beholder modellens rekkefølge innenfor samme nivå", () => {
    const r = medKostnader([kost("bad", "stor"), kost("vinduer", "stor"), kost("tak", "stor")]);
    expect(sorterKostnader(r).mulige_kostnader.map((k) => k.hva)).toEqual(["bad", "vinduer", "tak"]);
  });

  it("muterer ikke originalen", () => {
    const r = medKostnader([kost("liten sak", "liten"), kost("stor sak", "stor")]);
    sorterKostnader(r);
    expect(r.mulige_kostnader[0].hva).toBe("liten sak");
  });

  it("tåler at eldre svar mangler konsekvens og spørsmål", () => {
    const r = rapportSchema.parse({
      dokumenttype: "tilstandsrapport", dokument_advarsel: null, boligtype: null,
      byggeaar: null, bruksareal_bra_m2: null, sammendrag: "Test.",
      risikoer: [{ tittel: "x", forklaring: "y", alvorlighet: "høy", tg: 3, kilde: "s. 1" }],
      sporsmal_til_visning: [],
      mulige_kostnader: [{ hva: "rør", grovt_niva: "stor", vurdering: "z", kilde: null }],
      ikke_funnet: [],
    });
    expect(r.risikoer[0].kostnadsanslag).toBeNull();
    expect(r.mulige_kostnader[0].konsekvens).toBeNull();
    expect(r.mulige_kostnader[0].sporsmal).toEqual([]);
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
