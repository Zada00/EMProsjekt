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
      if (!res.ok) setError(data.error ?? "Noe gikk galt.");
      else setRapport(data.rapport);
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
        <div className="wordmark">BoligCopilot</div>
        <h1>Forstå boligen før du byr</h1>
        <p>
          Last opp salgsoppgaven eller tilstandsrapporten, så forklarer vi den på vanlig
          norsk: hva du bør være obs på, hva du bør spørre om på visning, og hva som kan
          koste penger senere — med kildehenvisning så du kan slå opp selv.
        </p>
      </header>

      {!rapport && (
        <>
          <Dropzone file={file} onPick={setFile} disabled={loading} />
          {file && !loading && (
            <button className="btn" onClick={analyser}>
              Forklar boligen
            </button>
          )}
          {loading && (
            <div className="status">
              <span className="spinner" /> Leser dokumentet og forklarer …
            </div>
          )}
          {error && <div className="error">{error}</div>}
        </>
      )}

      {rapport && (
        <>
          <ReportView rapport={rapport} />
          <button className="btn secondary" style={{ marginTop: 28 }} onClick={nullstill}>
            Sjekk en ny bolig
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
