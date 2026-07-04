"use client";

import { useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { ReportView } from "@/components/ReportView";
import { CompareView } from "@/components/CompareView";
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
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rapportA, setRapportA] = useState<Rapport | null>(null);
  const [rapportB, setRapportB] = useState<Rapport | null>(null);

  const klar = mode === "en" ? !!fileA : !!fileA && !!fileB;

  async function analyser() {
    if (!klar) return;
    setLoading(true);
    setError(null);
    setRapportA(null);
    setRapportB(null);
    try {
      if (mode === "en") {
        setRapportA(await analyserFil(fileA!));
      } else {
        // To analyser parallelt – to separate API-kall, dobbel kostnad.
        const [ra, rb] = await Promise.all([analyserFil(fileA!), analyserFil(fileB!)]);
        setRapportA(ra);
        setRapportB(rb);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt.");
    } finally {
      setLoading(false);
    }
  }

  function nullstill() {
    setFileA(null);
    setFileB(null);
    setRapportA(null);
    setRapportB(null);
    setError(null);
  }

  const ferdig = mode === "en" ? !!rapportA : !!rapportA && !!rapportB;

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
          <div className="mode-toggle" role="tablist" aria-label="Modus">
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
              Sammenlign to
            </button>
          </div>

          {mode === "en" ? (
            <Dropzone file={fileA} onPick={setFileA} disabled={loading} />
          ) : (
            <div className="duel-grid">
              <div>
                <div className="duel-label">Bolig A</div>
                <Dropzone file={fileA} onPick={setFileA} disabled={loading} />
              </div>
              <div>
                <div className="duel-label">Bolig B</div>
                <Dropzone file={fileB} onPick={setFileB} disabled={loading} />
              </div>
            </div>
          )}

          {klar && !loading && (
            <button className="btn" onClick={analyser}>
              {mode === "en" ? "Forklar boligen" : "Sammenlign boligene"}
            </button>
          )}
          {loading && (
            <div className="status">
              <span className="spinner" />
              {mode === "en"
                ? "Leser dokumentet og forklarer …"
                : "Leser begge dokumentene … (dette tar gjerne litt lenger tid)"}
            </div>
          )}
          {error && <div className="error">{error}</div>}
        </>
      )}

      {ferdig && mode === "en" && rapportA && (
        <>
          <ReportView rapport={rapportA} />
          <button className="btn secondary" style={{ marginTop: 28 }} onClick={nullstill}>
            Sjekk en ny bolig
          </button>
        </>
      )}

      {ferdig && mode === "duell" && rapportA && rapportB && (
        <>
          <CompareView
            a={rapportA}
            b={rapportB}
            navnA={fileA?.name ?? "Bolig A"}
            navnB={fileB?.name ?? "Bolig B"}
          />
          <button className="btn secondary" style={{ marginTop: 28 }} onClick={nullstill}>
            Ny sammenligning
          </button>
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
