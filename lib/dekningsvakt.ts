import type { Rapport } from "./schema";

/**
 * Dekningsvakt: fanger analyser der modellen har "mistet" deler av dokumentet.
 *
 * BAKGRUNN (målt 25.–26.07.2026, 58 kjøringer mot samme rapport):
 * Nemotron 3 Ultra leverer av og til en analyse som kun dekker de første og
 * siste sidene. Modellen får HELE dokumentet – input-tokens er identisk i gode
 * og dårlige kjøringer – men mister midtpartiet under lesing ("lost in the
 * middle") og konfabulerer så at "side 3–7 mangler i dokumentet". Resultatet
 * ser komplett og selvsikkert ut. Feilraten varierte fra 41 % (natt) til 7 %
 * (formiddag) med identisk prompt, modell og leverandør – altså noe vi ikke
 * kontrollerer, og ikke kan prompte oss bort fra.
 *
 * IDÉEN: en tilstandsrapport nevner "TG 2"/"TG 3" som tekst på de sidene som
 * faktisk vurderer bygningsdeler. Har modellen ikke sitert noen av dem, har den
 * heller ikke lest dem. Vi trenger verken fasit eller tabellparsing – bare
 * kildeteksten vi allerede har.
 *
 * VALIDERT på 29 kjøringer: kollapsede analyser dekket 33–50 % av de
 * TG-bærende sidene, korrekte analyser 67–100 %. Terskelen på 60 % skilte
 * alle 29 riktig, uten falske positive.
 *
 * BEGRENSNING: heuristikk, kalibrert på NS 3600-rapporter der TG-ene står som
 * tekst. Rene salgsoppgaver kan ha all TG-omtale på én side – da er signalet
 * svakt, og vakten sier fra om at grunnlaget er for tynt i stedet for å gjette.
 */

/** Sider i kildeteksten som faktisk vurderer bygningsdeler (nevner TG2/TG3). */
export function tgBaerendeSider(kildetekst: string): Set<number> {
    const sider = new Set<number>();
    // pdfTilTekst legger inn "[Side N]" foran hver side.
    const deler = kildetekst.split(/\[Side (\d+)\]/);
    for (let i = 1; i < deler.length; i += 2) {
        const nr = Number(deler[i]);
        const innhold = deler[i + 1] ?? "";
        if (/\bTG ?[23]\b/.test(innhold)) sider.add(nr);
    }
    return sider;
}

/** Sidetall modellen faktisk har sitert i "kilde"-feltene. */
export function siterteSider(rapport: Rapport): Set<number> {
    const sider = new Set<number>();
    for (const r of rapport.risikoer) {
        for (const m of r.kilde.match(/\d+/g) ?? []) sider.add(Number(m));
    }
    return sider;
}

export type Dekningsdom = {
    ufullstendig: boolean;
    andel: number;
    dekket: number;
    totalt: number;
    /** Kun satt når kildeteksten ikke gir nok signal til å dømme. */
    usikker?: string;
};

/**
 * Har modellen sitert nok av de TG-bærende sidene til at analysen er troverdig?
 * Terskelen er bevisst lav – vi vil fange amputerte analyser, ikke straffe
 * modeller som slår sammen funn og dermed siterer færre sider.
 */
export function vurderDekning(
    rapport: Rapport,
    kildetekst: string,
    terskel = 0.6
): Dekningsdom {
    const kilde = tgBaerendeSider(kildetekst);
    const totalt = kilde.size;

    // Færre enn tre TG-bærende sider: signalet er for svakt til å dømme på.
    // (Typisk rene salgsoppgaver med én oppsummeringsside.)
    if (totalt < 3) {
        return {
            ufullstendig: false, totalt, dekket: 0, andel: 1,
            usikker: `bare ${totalt} TG-bærende side(r) i dokumentet – dekningsvakten er ikke anvendelig`,
        };
    }

    const sitert = siterteSider(rapport);
    const dekket = [...kilde].filter((s) => sitert.has(s)).length;
    const andel = dekket / totalt;
    return { ufullstendig: andel < terskel, andel, dekket, totalt };
}
