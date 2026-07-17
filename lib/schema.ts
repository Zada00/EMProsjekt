import { z } from "zod";

/**
 * Toleranse-hjelpere: modellen kan levere "2001/2008/2013", "142 m²" eller "Høy".
 * Vi normaliserer i stedet for å avvise hele svaret. Lærdom fra første ekte test
 * (If-Boligsjekk): et strengt skjema gjør ett avvikende felt til total feil.
 */
const tallFraTekst = (v: unknown) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
        const m = v.match(/\d+(?:[.,]\d+)?/);
        if (m) return Number(m[0].replace(",", "."));
    }
    return v === undefined ? null : v;
};
const heltallFraTekst = (v: unknown) => {
    const t = tallFraTekst(v);
    return typeof t === "number" ? Math.round(t) : t;
};
const smaaBokstaver = (v: unknown) =>
    typeof v === "string" ? v.toLowerCase().trim() : v;


/**
 * Datakontrakten for BoligCopilot (B2C – for boligkjøpere).
 *
 * Vi trekker fortsatt ut det samme fra dokumentet, men vrir det fra "felt til
 * salgsoppgaven" til "forklart for en kjøper": hva betyr dette for MEG, hva bør
 * jeg spørre om på visning, og hva kan koste penger senere.
 *
 *  1. `rapportSchema`     – zod-validering som kjører på svaret fra Claude.
 *  2. `rapportJsonSchema` – JSON Schema som sendes til Claude som "tool" (tvungen struktur).
 *
 * Prinsipp mot hallusinasjon: hvert funn bærer `kilde` (sidetall/seksjon). Felt som
 * ikke finnes settes til null/utelates og legges i `ikke_funnet`. Vi gjetter aldri –
 * og vi finner ALDRI på presise kronebeløp (se prompt.ts).
 */

export const risikoSchema = z.object({
    tittel: z.string(), // kort, på vanlig norsk, f.eks. "Drenering kan svikte"
    forklaring: z.string(), // hva det betyr for kjøper, uten fagsjargong
    alvorlighet: z.preprocess(smaaBokstaver, z.enum(["høy", "middels", "lav"])),
    tg: z.preprocess(heltallFraTekst, z.number().int().min(0).max(3).nullable()).catch(null), // original tilstandsgrad hvis oppgitt
    kilde: z.string(), // f.eks. "s. 24" eller "Pkt 5.3 Bad"
});

export const kostnadSchema = z.object({
    hva: z.string(), // f.eks. "Nytt bad", "Drenering"
    grovt_niva: z.preprocess(smaaBokstaver, z.enum(["liten", "middels", "stor", "ukjent"])), // grov skala, IKKE presise tall
    vurdering: z.string(), // kort forklaring med forbehold
    kilde: z.string().nullable(),
});

export const rapportSchema = z.object({
    dokumenttype: z.preprocess(smaaBokstaver,
        z.enum(["tilstandsrapport", "salgsoppgave", "kombinasjon", "annet"])
    ).catch("annet"), // hva vurderingen bygger på – avgjør hvor "komplett" analysen kan være
    boligtype: z.string().nullable(),
    byggeaar: z.preprocess(heltallFraTekst, z.number().int().nullable()),
    bruksareal_bra_m2: z.preprocess(tallFraTekst, z.number().nullable()),
    sammendrag: z.string(), // 2-4 setninger på vanlig norsk, til en kjøper
    dokument_advarsel: z.string().nullable().catch(null), // f.eks. "dokumentene ser ut til å gjelde ulike boliger"
    risikoer: z.array(risikoSchema),
    sporsmal_til_visning: z.array(z.string()),
    mulige_kostnader: z.array(kostnadSchema),
    ikke_funnet: z.array(z.string()),
});

export type Rapport = z.infer<typeof rapportSchema>;
export type Risiko = z.infer<typeof risikoSchema>;

/** JSON Schema-speilet. Holdes manuelt i sync med rapportSchema over. */
export const rapportJsonSchema = {
    type: "object" as const,
    properties: {
        dokumenttype: {
            type: "string",
            enum: ["tilstandsrapport", "salgsoppgave", "kombinasjon", "annet"],
            description:
                "Hva slags dokument(er) analysen bygger på. 'kombinasjon' = både salgsoppgave og tilstandsrapport. Viktig: en salgsoppgave inneholder ofte en innebygget TG-oppsummering – da er den fortsatt 'salgsoppgave', men bruk TG-infoen.",
        },
        boligtype: {
            type: ["string", "null"],
            description: "Type bolig, f.eks. 'Enebolig', 'Leilighet', 'Rekkehus'.",
        },
        byggeaar: { type: ["integer", "null"], description: "Byggeår som tall." },
        bruksareal_bra_m2: {
            type: ["number", "null"],
            description: "Bruksareal (BRA) i kvadratmeter.",
        },
        sammendrag: {
            type: "string",
            description:
                "2-4 setninger på vanlig norsk, henvendt til en boligkjøper uten fagbakgrunn. Nøytralt, ikke salgsspråk. Nevn de viktigste tingene å være obs på.",
        },
        dokument_advarsel: {
            type: ["string", "null"],
            description:
                "Sett KUN hvis noe er galt med dokumentene: de ser ut til å gjelde forskjellige boliger, er uleselige, eller er ikke boligdokumenter. Ellers null.",
        },
        risikoer: {
            type: "array",
            description:
                "Ting kjøperen bør være obs på, forklart på vanlig norsk. Ta med alle TG2/TG3-forhold, men oversett dem til hva det betyr for kjøper.",
            items: {
                type: "object",
                properties: {
                    tittel: { type: "string", description: "Kort overskrift på vanlig norsk." },
                    forklaring: {
                        type: "string",
                        description: "Hva dette betyr for kjøperen. Unngå fagsjargong, eller forklar den.",
                    },
                    alvorlighet: {
                        type: "string",
                        enum: ["høy", "middels", "lav"],
                        description:
                            "Din vurdering av hvor alvorlig dette er for kjøper. TG3 er typisk 'høy', TG2 'middels'.",
                    },
                    tg: {
                        type: ["integer", "null"],
                        minimum: 0,
                        maximum: 3,
                        description: "Original tilstandsgrad fra rapporten hvis oppgitt, ellers null.",
                    },
                    kilde: {
                        type: "string",
                        description: "Sidetall eller punkt, f.eks. 's. 24' eller 'Pkt 5.3'.",
                    },
                },
                required: ["tittel", "forklaring", "alvorlighet", "tg", "kilde"],
            },
        },
        sporsmal_til_visning: {
            type: "array",
            description:
                "Konkrete spørsmål kjøperen bør stille megler eller selger på visning, basert på det som er uklart eller bekymringsverdig i dokumentet.",
            items: { type: "string" },
        },
        mulige_kostnader: {
            type: "array",
            description:
                "Mulige fremtidige kostnader kjøperen bør regne med. ALDRI oppgi presise kronebeløp – bruk kun grov skala og forklaring med forbehold.",
            items: {
                type: "object",
                properties: {
                    hva: { type: "string" },
                    grovt_niva: {
                        type: "string",
                        enum: ["liten", "middels", "stor", "ukjent"],
                        description: "Grov skala på mulig kostnad. Bruk 'ukjent' hvis du ikke kan vurdere.",
                    },
                    vurdering: {
                        type: "string",
                        description: "Kort forklaring med tydelig forbehold. Ingen presise tall.",
                    },
                    kilde: { type: ["string", "null"] },
                },
                required: ["hva", "grovt_niva", "vurdering", "kilde"],
            },
        },
        ikke_funnet: {
            type: "array",
            items: { type: "string" },
            description: "Navn på sentrale forhold du IKKE klarte å finne i dokumentet.",
        },
    },
    required: [
        "dokumenttype",
        "dokument_advarsel",
        "boligtype",
        "byggeaar",
        "bruksareal_bra_m2",
        "sammendrag",
        "risikoer",
        "sporsmal_til_visning",
        "mulige_kostnader",
        "ikke_funnet",
    ],
} as const;


/**
 * SYNC-VAKT: zod-skjemaet (validering) og JSON-skjemaet (sendes til modellen)
 * vedlikeholdes for hånd og MÅ ha samme felter. Denne sjekken feiler høyt ved
 * oppstart/bygg hvis noen legger til/fjerner et felt bare ett sted – som er
 * den mest sannsynlige fremtidige buggen i kodebasen.
 */
{
    const zodFelter = Object.keys(rapportSchema.shape).sort();
    const jsonFelter = Object.keys(rapportJsonSchema.properties).sort();
    const bareIZod = zodFelter.filter((f) => !jsonFelter.includes(f));
    const bareIJson = jsonFelter.filter((f) => !zodFelter.includes(f));
    if (bareIZod.length || bareIJson.length) {
        throw new Error(
            `schema.ts er ute av sync! Kun i zod: [${bareIZod.join(", ")}] – kun i JSON-skjema: [${bareIJson.join(", ")}]. Oppdater begge.`
        );
    }
}
