/**
 * Prisstatistikk fra SSB, tabell 14310 ("Gjennomsnittlig kvadratmeterpris og
 * antall omsetninger, etter region, boligtype, statistikkvariabel og kvartal").
 * Gratis, ingen nøkkel: https://data.ssb.no/api/v0/no/table/14310
 *
 * Ekstern berikelse, ikke kjernefunksjonen – feiler stille (null) i stedet for
 * å kaste. Små kommuner har ofte for få omsetninger til at SSB kan vise tall
 * brutt ned på boligtype (fortrolighet) – da faller vi tilbake til "alle
 * boligtyper" for kommunen før vi gir opp helt.
 */

const SSB_TABELL_URL = "https://data.ssb.no/api/v0/no/table/14310";

export type Prisstatistikk = {
    kommunenavn: string;
    krPerM2: number;
    kvartal: string;
    boligtype: string; // "00" (alle), "01" (enebolig), "02" (småhus), "03" (blokkleilighet) – hva tallet faktisk gjelder
};

/** Grov mapping fra fritekst-boligtype (som Claude trekker ut) til SSB sine koder. */
export function boligtypeKode(boligtype: string | null | undefined): string {
    const b = (boligtype ?? "").toLowerCase();
    if (b.includes("enebolig")) return "01";
    if (b.includes("rekkehus") || b.includes("tomannsbolig") || b.includes("småhus") || b.includes("smahus")) return "02";
    if (b.includes("leilighet") || b.includes("blokk")) return "03";
    return "00"; // alle boligtyper – nøytralt fallback når type er ukjent/uvanlig
}

async function sporSsb(kommunenummer: string, kode: string): Promise<Prisstatistikk | null> {
    const body = {
        query: [
            { code: "Region", selection: { filter: "item", values: [kommunenummer] } },
            { code: "Boligtype", selection: { filter: "item", values: [kode] } },
            { code: "ContentsCode", selection: { filter: "item", values: ["KvPris"] } },
            { code: "Tid", selection: { filter: "top", values: ["1"] } },
        ],
        response: { format: "json-stat2" },
    };

    const res = await fetch(SSB_TABELL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const verdi = data?.value?.[0];
    if (typeof verdi !== "number") return null; // fortrolig/manglende celle hos SSB

    const kommunenavn = Object.values(data?.dimension?.Region?.category?.label ?? {})[0];
    const kvartal = Object.keys(data?.dimension?.Tid?.category?.index ?? {})[0];
    if (typeof kommunenavn !== "string" || typeof kvartal !== "string") return null;

    return { kommunenavn, krPerM2: verdi, kvartal, boligtype: kode };
}

export async function hentPrisstatistikk(
    kommunenummer: string,
    boligtype: string | null | undefined
): Promise<Prisstatistikk | null> {
    try {
        const kode = boligtypeKode(boligtype);
        const treff = await sporSsb(kommunenummer, kode);
        if (treff) return treff;
        if (kode === "00") return null; // allerede prøvd det nøytrale fallbacket

        // For få omsetninger på akkurat denne boligtypen i kommunen – prøv "alle boligtyper".
        return await sporSsb(kommunenummer, "00");
    } catch {
        return null;
    }
}
