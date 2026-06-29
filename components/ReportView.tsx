"use client";

import { useState } from "react";
import type { Rapport } from "@/lib/schema";

/**
 * Kjøper-vennlig visning: sammendrag på vanlig norsk, ting å være obs på (sortert
 * etter alvorlighet), spørsmål til visning, og mulige fremtidige kostnader (grov skala).
 * Hvert funn har en kilde-chip så kjøperen kan slå opp i originalen.
 */

const ALVOR: Record<string, { label: string; badge: string; border: string }> = {
  høy: { label: "Høy", badge: "tg3", border: "var(--tg3)" },
  middels: { label: "Middels", badge: "tg2", border: "var(--tg2)" },
  lav: { label: "Lav", badge: "tg1", border: "var(--tg1)" },
};

const NIVA: Record<string, { label: string; badge: string }> = {
  stor: { label: "Stor", badge: "tg3" },
  middels: { label: "Middels", badge: "tg2" },
  liten: { label: "Liten", badge: "tg1" },
  ukjent: { label: "Ukjent", badge: "" },
};

const rank: Record<string, number> = { høy: 3, middels: 2, lav: 1 };

export function ReportView({ rapport }: { rapport: Rapport }) {
  const [copied, setCopied] = useState(false);

  const risikoer = [...rapport.risikoer].sort(
    (a, b) => (rank[b.alvorlighet] ?? 0) - (rank[a.alvorlighet] ?? 0)
  );

  function copy() {
    navigator.clipboard.writeText(tilTekst(rapport)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="report">
      <div className="report-head">
        <h2>Boligen forklart</h2>
        <button className="btn secondary" onClick={copy}>
          {copied ? "Kopiert ✓" : "Kopier oppsummering"}
        </button>
      </div>

      <div className="summary">{rapport.sammendrag}</div>

      <div className="facts">
        <Fact label="Boligtype" value={rapport.boligtype} />
        <Fact label="Byggeår" value={rapport.byggeaar?.toString()} />
        <Fact
          label="BRA"
          value={rapport.bruksareal_bra_m2 ? `${rapport.bruksareal_bra_m2} m²` : null}
        />
      </div>

      <div className="section-title">Ting å være obs på ({risikoer.length})</div>
      {risikoer.length === 0 && (
        <div className="notfound">Ingen tydelige risikoer trukket ut.</div>
      )}
      {risikoer.map((r, i) => {
        const a = ALVOR[r.alvorlighet] ?? ALVOR.lav;
        return (
          <div key={i} className="avvik" style={{ borderLeft: `4px solid ${a.border}` }}>
            <div className="top">
              <span className={`tg-badge ${a.badge}`}>{a.label}</span>
              <span className="del">{r.tittel}</span>
              <span className="kilde">{r.kilde}</span>
            </div>
            <div className="desc">{r.forklaring}</div>
          </div>
        );
      })}

      {rapport.sporsmal_til_visning.length > 0 && (
        <>
          <div className="section-title">Spørsmål å stille på visning</div>
          <div className="qlist">
            {rapport.sporsmal_til_visning.map((q, i) => (
              <div key={i} className="qitem">{q}</div>
            ))}
          </div>
        </>
      )}

      {rapport.mulige_kostnader.length > 0 && (
        <>
          <div className="section-title">Mulige fremtidige kostnader</div>
          {rapport.mulige_kostnader.map((k, i) => {
            const n = NIVA[k.grovt_niva] ?? NIVA.ukjent;
            return (
              <div key={i} className="avvik">
                <div className="top">
                  <span className={`tg-badge ${n.badge}`}>{n.label}</span>
                  <span className="del">{k.hva}</span>
                  {k.kilde && <span className="kilde">{k.kilde}</span>}
                </div>
                <div className="desc">{k.vurdering}</div>
              </div>
            );
          })}
          <div className="notfound">
            Grov skala, ikke priser. Innhent tilbud fra fagfolk for reelle tall.
          </div>
        </>
      )}

      {rapport.ikke_funnet.length > 0 && (
        <div className="notfound">
          Ikke funnet i dokumentet: <code>{rapport.ikke_funnet.join(", ")}</code>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="fact">
      <div className="label">{label}</div>
      {value ? (
        <div className="value">{value}</div>
      ) : (
        <div className="value empty">ikke funnet</div>
      )}
    </div>
  );
}

function tilTekst(r: Rapport): string {
  const lines: string[] = [r.sammendrag, ""];
  if (r.risikoer.length) {
    lines.push("Ting å være obs på:");
    [...r.risikoer]
      .sort((a, b) => (rank[b.alvorlighet] ?? 0) - (rank[a.alvorlighet] ?? 0))
      .forEach((x) =>
        lines.push(`- [${x.alvorlighet}] ${x.tittel}: ${x.forklaring} (${x.kilde})`)
      );
    lines.push("");
  }
  if (r.sporsmal_til_visning.length) {
    lines.push("Spørsmål til visning:");
    r.sporsmal_til_visning.forEach((q) => lines.push(`- ${q}`));
  }
  return lines.join("\n");
}
