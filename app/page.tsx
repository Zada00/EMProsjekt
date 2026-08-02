"use client";

import { useEffect, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { ReportView, type DokRef } from "@/components/ReportView";
import { CompareView, type NavngittRapport } from "@/components/CompareView";
import type { Rapport } from "@/lib/schema";

type Mode = "en" | "duell";

class TilgangFeil extends Error { }

async function analyserFiler(filer: File[]): Promise<Rapport> {
    const body = new FormData();
    filer.forEach((f) => body.append("file", f));
    const kode = typeof window !== "undefined" ? sessionStorage.getItem("tilgangskode") : null;
    const res = await fetch("/api/analyze", {
        method: "POST",
        body,
        headers: kode ? { "x-tilgangskode": kode } : {},
    });
    const data = await res.json();
    if (res.status === 401) throw new TilgangFeil(data.error ?? "Tilgangskode kreves.");
    if (!res.ok) throw new Error(data.error ?? "Noe gikk galt.");
    return data.rapport as Rapport;
}

function tilDokRefs(filer: File[]): DokRef[] {
    return filer.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
}

/**
 * Øktlagring av analyseresultatet.
 *
 * Hvorfor: en analyse tar opptil to minutter og koster et API-kall. Mister
 * brukeren den på en utilsiktet refresh, må alt gjøres om igjen.
 *
 * GDPR: kun i brukerens egen nettleser (sessionStorage), aldri sendt noe sted,
 * og borte når fanen lukkes. Selve PDF-en lagres fortsatt ingen steder – løftet
 * i README står urokket.
 *
 * Begrensning: blob-URL-ene til PDF-ene overlever ikke en sidelasting, så
 * kildeknappene blir til ren tekst i en gjenopprettet analyse. Vi sier fra om
 * det i stedet for å vise knapper som ikke virker.
 */
const LAGER_NOKKEL = "boligcopilot:siste-analyse";

type Lagret = {
    mode: Mode;
    enkelt?: { rapport: Rapport };
    duell?: { navn: string; rapport: Rapport }[];
};

function lagreOkt(data: Lagret) {
    try {
        sessionStorage.setItem(LAGER_NOKKEL, JSON.stringify(data));
    } catch {
        // Full eller blokkert lagring skal aldri velte en vellykket analyse.
    }
}

function lesOkt(): Lagret | null {
    try {
        const rå = sessionStorage.getItem(LAGER_NOKKEL);
        return rå ? (JSON.parse(rå) as Lagret) : null;
    } catch {
        return null;
    }
}

function tømOkt() {
    try {
        sessionStorage.removeItem(LAGER_NOKKEL);
    } catch {
        /* ignorer */
    }
}

export default function Home() {
    const [mode, setMode] = useState<Mode>("en");
    // Hver "plass" er én bolig og kan inneholde FLERE PDF-er (tilstandsrapport + salgsoppgave).
    const [enFiler, setEnFiler] = useState<File[]>([]);
    const [slots, setSlots] = useState<File[][]>([[], []]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [enkelt, setEnkelt] = useState<{ rapport: Rapport; dokumenter: DokRef[] } | null>(null);
    const [duell, setDuell] = useState<NavngittRapport[] | null>(null);
    const [trengerKode, setTrengerKode] = useState(false);
    const [kodeInput, setKodeInput] = useState("");
    // Satt når analysen er hentet fra øktlageret etter en sidelasting – da
    // mangler PDF-ene, og kildehenvisningene kan ikke åpnes.
    const [gjenopprettet, setGjenopprettet] = useState(false);

    const fylteSlots = slots.filter((s) => s.length > 0);
    const klar = mode === "en" ? enFiler.length > 0 : fylteSlots.length >= 2;

    function settSlot(i: number, filer: File[]) {
        setSlots((prev) => prev.map((x, idx) => (idx === i ? filer : x)));
    }
    function leggTilSlot() {
        setSlots((prev) => [...prev, []]);
    }
    function fjernSlot(i: number) {
        setSlots((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
    }

    function ryddOpp() {
        // Frigjør blob-URL-er fra forrige runde
        enkelt?.dokumenter.forEach((d) => URL.revokeObjectURL(d.url));
        duell?.forEach((b) => b.dokumenter.forEach((d) => URL.revokeObjectURL(d.url)));
    }

    async function analyser() {
        if (!klar) return;
        setLoading(true);
        setError(null);
        ryddOpp();
        setEnkelt(null);
        setDuell(null);
        try {
            setGjenopprettet(false);
            if (mode === "en") {
                const rapport = await analyserFiler(enFiler);
                setEnkelt({ rapport, dokumenter: tilDokRefs(enFiler) });
                lagreOkt({ mode: "en", enkelt: { rapport } });
            } else {
                const resultater = await Promise.all(fylteSlots.map((f) => analyserFiler(f)));
                const navngitte = resultater.map((rapport, i) => ({
                    navn: fylteSlots[i][0].name.replace(/\.pdf$/i, ""),
                    rapport,
                    dokumenter: tilDokRefs(fylteSlots[i]),
                }));
                setDuell(navngitte);
                lagreOkt({ mode: "duell", duell: navngitte.map(({ navn, rapport }) => ({ navn, rapport })) });
            }
        } catch (e) {
            if (e instanceof TilgangFeil) {
                setTrengerKode(true);
                setError(e.message);
            } else {
                setError(e instanceof Error ? e.message : "Noe gikk galt.");
            }
        } finally {
            setLoading(false);
        }
    }

    function nullstill() {
        ryddOpp();
        setEnFiler([]);
        setSlots([[], []]);
        setEnkelt(null);
        setDuell(null);
        setError(null);
        setGjenopprettet(false);
        tømOkt(); // bevisst nullstilling – da skal heller ingenting gjenopprettes
    }

    // Gjenopprett forrige analyse ved sidelasting. Kjører kun én gang, og bare
    // hvis brukeren ikke allerede har et resultat på skjermen.
    useEffect(() => {
        const lagret = lesOkt();
        if (!lagret) return;
        if (lagret.mode === "en" && lagret.enkelt) {
            setMode("en");
            setEnkelt({ rapport: lagret.enkelt.rapport, dokumenter: [] });
            setGjenopprettet(true);
        } else if (lagret.mode === "duell" && lagret.duell?.length) {
            setMode("duell");
            setDuell(lagret.duell.map((b) => ({ ...b, dokumenter: [] })));
            setGjenopprettet(true);
        }
    }, []);

    // Advar før siden forlates mens et resultat er på skjermen. Nettleseren
    // viser sin egen standardtekst – egen tekst har ikke vært tillatt siden 2016.
    // Vises ikke ved gjenopprettet analyse: den ligger allerede trygt i øktlageret.
    const harUlagretResultat = (enkelt !== null || duell !== null) && !gjenopprettet;
    useEffect(() => {
        if (!harUlagretResultat && !loading) return;
        const advar = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", advar);
        return () => window.removeEventListener("beforeunload", advar);
    }, [harUlagretResultat, loading]);

    // PDF-eksport: lukkede accordioner ville gitt en nesten tom utskrift.
    // Åpner alle før utskrift og gjenoppretter tilstanden etterpå.
    useEffect(() => {
        let varLukket: HTMLDetailsElement[] = [];
        const foer = () => {
            varLukket = Array.from(document.querySelectorAll<HTMLDetailsElement>("details.acc:not([open])"));
            varLukket.forEach((d) => (d.open = true));
        };
        const etter = () => {
            varLukket.forEach((d) => (d.open = false));
            varLukket = [];
        };
        window.addEventListener("beforeprint", foer);
        window.addEventListener("afterprint", etter);
        return () => {
            window.removeEventListener("beforeprint", foer);
            window.removeEventListener("afterprint", etter);
        };
    }, []);

    const ferdig = !!enkelt || !!duell;

    return (
        <main className="wrap">
            <header className="masthead">
                <div className="wordmark">BoligCopilot</div>
                <h1>Forstå boligen før du byr</h1>
                <p>
                    Last opp salgsoppgaven og/eller tilstandsrapporten, så forklarer vi dem på vanlig
                    norsk: hva du bør være obs på, hva du bør spørre om på visning, og hva som kan
                    koste penger senere — med klikkbare kildehenvisninger rett inn i PDF-en.
                </p>
            </header>

            {!ferdig && (
                <>
                    <div className="mode-toggle no-print" role="tablist" aria-label="Modus">
                        <button
                            role="tab"
                            aria-selected={mode === "en"}
                            className={mode === "en" ? "active" : ""}
                            onClick={() => { setMode("en"); nullstill(); }}
                        >
                            Én bolig
                        </button>
                        <button
                            role="tab"
                            aria-selected={mode === "duell"}
                            className={mode === "duell" ? "active" : ""}
                            onClick={() => { setMode("duell"); nullstill(); }}
                        >
                            Sammenlign flere
                        </button>
                    </div>

                    {mode === "en" ? (
                        <Dropzone files={enFiler} onChange={setEnFiler} disabled={loading} />
                    ) : (
                        <>
                            <div className="duel-grid" style={{ ["--cols" as string]: slots.length }}>
                                {slots.map((filer, i) => (
                                    <div key={i}>
                                        <div className="duel-label">
                                            Bolig {String.fromCharCode(65 + i)}
                                            {slots.length > 2 && (
                                                <button className="lenkeknapp" onClick={() => fjernSlot(i)} disabled={loading}>
                                                    fjern
                                                </button>
                                            )}
                                        </div>
                                        <Dropzone files={filer} onChange={(f) => settSlot(i, f)} disabled={loading} />
                                    </div>
                                ))}
                            </div>
                            <button className="btn secondary" style={{ marginTop: 14 }} onClick={leggTilSlot} disabled={loading}>
                                + Legg til en bolig til
                            </button>
                            <div className="notfound" style={{ marginTop: 8 }}>
                                Hver bolig kan ha flere PDF-er (f.eks. salgsoppgave + tilstandsrapport) — de
                                analyseres samlet. Flere boliger tar litt lenger tid og koster mer.
                            </div>
                        </>
                    )}

                    {klar && !loading && (
                        <div>
                            <button className="btn" onClick={analyser}>
                                {mode === "en" ? "Forklar boligen" : `Sammenlign ${fylteSlots.length} boliger`}
                            </button>
                        </div>
                    )}
                    {loading && (
                        <div className="status">
                            <span className="spinner" />
                            {mode === "en"
                                ? "Leser dokumentene og forklarer …"
                                : `Leser ${fylteSlots.length} boliger … (dette tar gjerne litt lenger tid)`}
                        </div>
                    )}
                    {error && <div className="error">{error}</div>}
                    {gjenopprettet && (
                        <div className="gjenopprettet no-print">
                            Analysen er hentet fram igjen etter at siden ble lastet på nytt.
                            Kildehenvisningene vises som tekst — last opp PDF-en på nytt hvis du
                            vil kunne klikke deg rett til riktig side.
                        </div>
                    )}
                    {trengerKode && (
                        <div className="kodeboks no-print">
                            <div className="kodetekst">
                                Denne piloten krever en tilgangskode. Skriv inn koden du har
                                fått, så husker vi den i denne økten.
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    type="password"
                                    value={kodeInput}
                                    placeholder="Tilgangskode"
                                    onChange={(e) => setKodeInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && kodeInput.trim()) {
                                            sessionStorage.setItem("tilgangskode", kodeInput.trim());
                                            setTrengerKode(false);
                                            setError(null);
                                            analyser();
                                        }
                                    }}
                                />
                                <button
                                    className="btn"
                                    disabled={!kodeInput.trim()}
                                    onClick={() => {
                                        sessionStorage.setItem("tilgangskode", kodeInput.trim());
                                        setTrengerKode(false);
                                        setError(null);
                                        analyser();
                                    }}
                                >
                                    Bruk kode
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {enkelt && (
                <>
                    <ReportView rapport={enkelt.rapport} dokumenter={enkelt.dokumenter} />
                    <div className="no-print" style={{ marginTop: 28, display: "flex", gap: 10 }}>
                        <button className="btn" onClick={() => window.print()}>
                            Lagre som PDF / skriv ut
                        </button>
                        <button className="btn secondary" onClick={nullstill}>
                            Sjekk en ny bolig
                        </button>
                    </div>
                </>
            )}

            {duell && (
                <>
                    <CompareView rapporter={duell} />
                    <div className="no-print" style={{ marginTop: 28, display: "flex", gap: 10 }}>
                        <button className="btn" onClick={() => window.print()}>
                            Lagre som PDF / skriv ut
                        </button>
                        <button className="btn secondary" onClick={nullstill}>
                            Ny sammenligning
                        </button>
                    </div>
                </>
            )}

            <div className="disclaimer">
                BoligCopilot hjelper deg å forstå dokumentene — det er ikke profesjonell råd­givning.
                Vurderinger og kostnadsanslag kan inneholde feil. Sjekk viktige forhold med takstmann,
                megler eller annen fagperson før du legger inn bud. Opplastede dokumenter lagres ikke.
            </div>
        </main>
    );
}