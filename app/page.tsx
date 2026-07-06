"use client";

import { useEffect, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { ReportView, type DokRef } from "@/components/ReportView";
import { CompareView, type NavngittRapport } from "@/components/CompareView";
import type { Rapport } from "@/lib/schema";

type Mode = "en" | "duell";

async function analyserFiler(filer: File[]): Promise<Rapport> {
    const body = new FormData();
    filer.forEach((f) => body.append("file", f));
    const res = await fetch("/api/analyze", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Noe gikk galt.");
    return data.rapport as Rapport;
}

function tilDokRefs(filer: File[]): DokRef[] {
    return filer.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
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
            if (mode === "en") {
                const rapport = await analyserFiler(enFiler);
                setEnkelt({ rapport, dokumenter: tilDokRefs(enFiler) });
            } else {
                const resultater = await Promise.all(fylteSlots.map((f) => analyserFiler(f)));
                setDuell(
                    resultater.map((rapport, i) => ({
                        navn: fylteSlots[i][0].name.replace(/\.pdf$/i, ""),
                        rapport,
                        dokumenter: tilDokRefs(fylteSlots[i]),
                    }))
                );
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Noe gikk galt.");
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
    }

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
