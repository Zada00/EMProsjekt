"use client";

import type { Rapport } from "@/lib/schema";

/**
 * Boligduell: N analyserte rapporter side om side (2, 3, 5 – så mange brukeren vil).
 * Fortsatt deterministisk – ingen AI-kåret "vinner", bare fakta ved siden av hverandre.
 * Ved mange boliger scroller kolonnene horisontalt.
 */

const rank: Record<string, number> = { høy: 3, middels: 2, lav: 1 };

export type NavngittRapport = { navn: string; rapport: Rapport };

function tell(r: Rapport, niva: string) {
  return r.risikoer.filter((x) => x.alvorlighet === niva).length;
}

export function CompareView({ rapporter }: { rapporter: NavngittRapport[] }) {
  return (
    <div className="report">
      <div className="report-head">
        <h2>Boligduell ({rapporter.length} boliger)</h2>
      </div>

      <div className="duel-scroll">
        <div className="duel-grid" style={{ ["--cols" as string]: rapporter.length }}>
          {rapporter.map((x, i) => (
            <DuelKolonne key={i} navn={x.navn} rapport={x.rapport} />
          ))}
        </div>
      </div>

      <div className="notfound" style={{ marginTop: 16 }}>
        Verktøyet kårer ingen vinner — tallene er telling fra rapportene, og alvorlighet
        varierer. Bruk kildene og les selv der det teller.
      </div>
    </div>
  );
}

function DuelKolonne({ rapport, navn }: { rapport: Rapport; navn: string }) {
  const hoy = tell(rapport, "høy");
  const mid = tell(rapport, "middels");
  const risikoer = [...rapport.risikoer].sort(
    (x, y) => (rank[y.alvorlighet] ?? 0) - (rank[x.alvorlighet] ?? 0)
  );

  return (
    <div className="duel-col">
      <div className="duel-name" title={navn}>{navn}</div>
      <div className="summary" style={{ fontSize: 14 }}>{rapport.sammendrag}</div>

      <div className="facts" style={{ margin: "14px 0" }}>
        <div className="fact">
          <div className="label">Byggeår</div>
          <div className={rapport.byggeaar ? "value" : "value empty"}>
            {rapport.byggeaar ?? "ikke funnet"}
          </div>
        </div>
        <div className="fact">
          <div className="label">BRA</div>
          <div className={rapport.bruksareal_bra_m2 ? "value" : "value empty"}>
            {rapport.bruksareal_bra_m2 ? `${rapport.bruksareal_bra_m2} m²` : "ikke funnet"}
          </div>
        </div>
        <div className="fact">
          <div className="label">Høy risiko</div>
          <div className="value" style={{ color: hoy > 0 ? "var(--tg3)" : undefined }}>{hoy}</div>
        </div>
        <div className="fact">
          <div className="label">Middels</div>
          <div className="value" style={{ color: mid > 0 ? "var(--tg2)" : undefined }}>{mid}</div>
        </div>
      </div>

      {risikoer.map((r, i) => {
        const border =
          r.alvorlighet === "høy" ? "var(--tg3)" : r.alvorlighet === "middels" ? "var(--tg2)" : "var(--tg1)";
        const badge =
          r.alvorlighet === "høy" ? "tg3" : r.alvorlighet === "middels" ? "tg2" : "tg1";
        return (
          <div key={i} className="avvik" style={{ borderLeft: `4px solid ${border}` }}>
            <div className="top">
              <span className={`tg-badge ${badge}`}>
                {r.alvorlighet[0].toUpperCase() + r.alvorlighet.slice(1)}
              </span>
              <span className="del">{r.tittel}</span>
              <span className="kilde">{r.kilde}</span>
            </div>
            <div className="desc">{r.forklaring}</div>
          </div>
        );
      })}
    </div>
  );
}
