"use client";

import { useState } from "react";
import type { Rapport } from "@/lib/schema";

/**
 * Viser det strukturerte resultatet. Sorterer avvik etter alvorsgrad (TG3 først),
 * og gir hver linje en kilde-chip så megler kan slå opp i originalen.
 * "Kopier"-knappen limer et ferdig tekstutdrag rett inn i salgsoppgaven.
 */
export function ReportView({ rapport }: { rapport: Rapport }) {
  const [copied, setCopied] = useState(false);

  const avvik = [...rapport.avvik].sort((a, b) => b.tg - a.tg);
  const tg3 = avvik.filter((a) => a.tg === 3).length;
  const tg2 = avvik.filter((a) => a.tg === 2).length;

  function copy() {
    navigator.clipboard.writeText(tilTekst(rapport)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="report">
      <div className="report-head">
        <div>
          <h2>Nøkkelinfo</h2>
          <div className="status" style={{ marginTop: 6 }}>
            {tg3} × TG3 · {tg2} × TG2 funnet
          </div>
        </div>
        <button className="btn secondary" onClick={copy}>
          {copied ? "Kopiert ✓" : "Kopier til salgsoppgave"}
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
        <Fact
          label="P-rom"
          value={rapport.primaerrom_prom_m2 ? `${rapport.primaerrom_prom_m2} m²` : null}
        />
        <Fact label="Ferdigattest" value={ferdigattestTekst(rapport)} />
        <Fact
          label="Kom. avgifter/år"
          value={
            rapport.kommunale_avgifter_per_aar_nok
              ? `${rapport.kommunale_avgifter_per_aar_nok.toLocaleString("nb-NO")} kr`
              : null
          }
        />
      </div>

      <div className="section-title">Avvik ({avvik.length})</div>
      {avvik.length === 0 && <div className="notfound">Ingen avvik trukket ut.</div>}
      {avvik.map((a, i) => (
        <div key={i} className={`avvik${a.tg === 3 ? " tg3" : a.tg === 2 ? " tg2" : ""}`}>
          <div className="top">
            <span className={`tg-badge tg${a.tg}`}>TG{a.tg}</span>
            <span className="del">{a.bygningsdel}</span>
            <span className="kilde">{a.kilde}</span>
          </div>
          <div className="desc">{a.beskrivelse}</div>
          {a.anbefalt_tiltak && <div className="tiltak">Tiltak: {a.anbefalt_tiltak}</div>}
        </div>
      ))}

      {rapport.tinglyste_servitutter.length > 0 && (
        <>
          <div className="section-title">Tinglyste servitutter</div>
          {rapport.tinglyste_servitutter.map((s, i) => (
            <div key={i} className="avvik">
              <div className="top">
                <span className="del">{s.type}</span>
                <span className="kilde">{s.kilde}</span>
              </div>
              <div className="desc">{s.beskrivelse}</div>
            </div>
          ))}
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

function ferdigattestTekst(r: Rapport): string | null {
  switch (r.ferdigattest.status) {
    case "ferdigattest":
      return "Ja";
    case "midlertidig_brukstillatelse":
      return "Midlertidig";
    case "mangler":
      return "Mangler";
    default:
      return null;
  }
}

function tilTekst(r: Rapport): string {
  const lines: string[] = [];
  lines.push(r.sammendrag, "");
  if (r.byggeaar) lines.push(`Byggeår: ${r.byggeaar}`);
  if (r.bruksareal_bra_m2) lines.push(`BRA: ${r.bruksareal_bra_m2} m²`);
  lines.push("", "Avvik:");
  [...r.avvik]
    .sort((a, b) => b.tg - a.tg)
    .forEach((a) =>
      lines.push(`- TG${a.tg} ${a.bygningsdel}: ${a.beskrivelse} (${a.kilde})`)
    );
  return lines.join("\n");
}
