"use client";

import { useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { ReportView } from "@/components/ReportView";
import { CompareView, type NavngittRapport } from "@/components/CompareView";
import type { Rapport } from "@/lib/schema";

type Mode = "en" | "duell";

async function analyserFil(file: File): Promise<Rapport> {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/analyze", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Noe gikk galt.");
    return data.rapport as Rapport;
}

export default function Home() {
    const [mode, setMode] = useState<Mode>("en");
    // Duell: dynamisk liste av filplasser (start med to). Bruker kan legge til flere.
    const [files, setFiles] = useState<(File | null)[]>([null, null]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [enkelt, setEnkelt] = useState<Rapport | null>(null);
    const [duell, setDuell] = useState<NavngittRapport[] | null>(null);

    const valgte = files.filter((f): f is File => !!f);
    const klar = mode === "en" ? !!files[0] : valgte.length >= 2;

    function settFil(i: number, f: File | null) {
        setFiles((prev) => prev.map((x, idx) => (idx === i ? f : x)));
    }
    function leggTilPlass() {
        setFiles((prev) => [...prev, null]);
    }
    function fjernPlass(i: number) {
        setFiles((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
    }

    async function analyser() {
        if (!klar) return;
        setLoading(true);
        setError(null);
        setEnkelt(null);
        setDuell(null);
        try {
            if (mode === "en") {
                setEnkelt(await analyserFil(files[0]!));
            } else {
                const resultater = await Promise.all(valgte.map((f) => analyserFil(f)));
                setDuell(resultater.map((rapport, i) => ({ navn: valgte[i].name, rapport })));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Noe gikk galt.");
        } finally {
            setLoading(false);
        }
    }

    function nullstill() {
        setFiles([null, null]);
        setEnkelt(null);
        setDuell(null);
        setError(null);
    }

    const ferdig = !!enkelt || !!duell;

    return (
        <main className="wrap">
            <header className="masthead">
                <div className="wordmark">BoligCopilot</div>
                <h1>Forstå boligen før du byr</h1>
                <p>
                    Last opp salgsoppgaven eller tilstandsrapporten, så forklarer vi den på vanlig
                    norsk: hva du bør være obs på, hva du bør spørre om på visning, og hva som kan
                    koste penger senere — med kildehenvisning så du kan slå opp selv.
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
                        <Dropzone file={files[0]} onPick={(f) => settFil(0, f)} disabled={loading} />
                    ) : (
                        <>
                            <div className="duel-grid" style={{ ["--cols" as string]: files.length }}>
                                {files.map((f, i) => (
                                    <div key={i}>
                                        <div className="duel-label">
                                            Bolig {String.fromCharCode(65 + i)}
                                            {files.length > 2 && (
                                                <button className="lenkeknapp" onClick={() => fjernPlass(i)} disabled={loading}>
                                                    fjern
                                                </button>
                                            )}
                                        </div>
                                        <Dropzone file={f} onPick={(x) => settFil(i, x)} disabled={loading} />
                                    </div>
                                ))}
                            </div>
                            <button className="btn secondary" style={{ marginTop: 14 }} onClick={leggTilPlass} disabled={loading}>
                                + Legg til en bolig til
                            </button>
                            <div className="notfound" style={{ marginTop: 8 }}>
                                Hver bolig analyseres for seg — flere boliger tar litt lenger tid og koster mer.
                            </div>
                        </>
                    )}

                    {klar && !loading && (
                        <div>
                            <button className="btn" onClick={analyser}>
                                {mode === "en" ? "Forklar boligen" : `Sammenlign ${valgte.length} boliger`}
                            </button>
                        </div>
                    )}
                    {loading && (
                        <div className="status">
                            <span className="spinner" />
                            {mode === "en"
                                ? "Leser dokumentet og forklarer …"
                                : `Leser ${valgte.length} dokumenter … (dette tar gjerne litt lenger tid)`}
                        </div>
                    )}
                    {error && <div className="error">{error}</div>}
                </>
            )}

            {enkelt && (
                <>
                    <ReportView rapport={enkelt} />
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
