"use client";

import { useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { ReportView } from "@/components/ReportView";
import type { Rapport } from "@/lib/schema";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rapport, setRapport] = useState<Rapport | null>(null);

  async function analyser() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setRapport(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Noe gikk galt.");
      } else {
        setRapport(data.rapport);
      }
    } catch {
      setError("Klarte ikke å nå serveren.");
    } finally {
      setLoading(false);
    }
  }

  function nullstill() {
    setFile(null);
    setRapport(null);
    setError(null);
  }

  return (
    <main className="wrap">
      <header className="masthead">
        <div className="wordmark">Tilstandsrapport-copilot</div>
        <h1>Fra 80 siders PDF til nøkkelinfo på sekunder</h1>
        <p>
          Last opp en tilstandsrapport. Verktøyet trekker ut alle TG2- og TG3-avvik,
          byggeår, areal, ferdigattest og servitutter — med kildehenvisning på hvert funn,
          så du kan verifisere raskt.
        </p>
      </header>

      {!rapport && (
        <>
          <Dropzone file={file} onPick={setFile} disabled={loading} />
          {file && !loading && (
            <button className="btn" onClick={analyser}>
              Analyser rapport
            </button>
          )}
          {loading && (
            <div className="status">
              <span className="spinner" /> Leser dokumentet og henter ut avvik …
            </div>
          )}
          {error && <div className="error">{error}</div>}
        </>
      )}

      {rapport && (
        <>
          <ReportView rapport={rapport} />
          <button className="btn secondary" style={{ marginTop: 28 }} onClick={nullstill}>
            Analyser en ny rapport
          </button>
        </>
      )}

      <div className="disclaimer">
        Dette er et KI-verktøy for effektivisering. Det endelige juridiske ansvaret for
        innholdet i salgsoppgaven ligger hos ansvarlig megler. Opplastede dokumenter
        lagres ikke — de behandles i minne og forkastes når analysen er ferdig.
      </div>
    </main>
  );
}
