/**
 * Geokoding av adresse til kommunenummer via Kartverkets adresse-API
 * (ws.geonorge.no) – gratis, ingen nøkkel, ingen registrering.
 *
 * Dette er ekstern berikelse, ikke kjernefunksjonen: feiler stille (null)
 * ved treningsfeil/timeout/nettverksfeil i stedet for å kaste – analysen av
 * selve dokumentet skal aldri stoppes av at et tredjeparts-API er nede.
 */

export type Kommune = { kommunenummer: string; kommunenavn: string };

export async function finnKommune(adresse: string): Promise<Kommune | null> {
    const adr = adresse.trim();
    if (!adr) return null;

    try {
        const url = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(adr)}&treffPerSide=1`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;

        const data = await res.json();
        const treff = data?.adresser?.[0];
        if (!treff?.kommunenummer || !treff?.kommunenavn) return null;

        return { kommunenummer: treff.kommunenummer, kommunenavn: treff.kommunenavn };
    } catch {
        return null;
    }
}
