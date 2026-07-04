"use client";

import type { Rapport } from "@/lib/schema";

/**
 * Boligduell: to analyserte rapporter side om side.
 *
 * Bevisst valg: sammenligningen er DETERMINISTISK (telling og fakta), ikke en
 * AI-generert dom over hvilken bolig som er "best". Vi viser tallene side om side
 * og lar kjøperen konkludere selv. Det er billigere, kan ikke hallusinere, og
 * unngår at verktøyet gir noe som ligner en kjøpsanbefaling.
 */

const rank: Record<string, number> = { høy: 3, middels: 2, lav: 1 };

function tell(r: Rapport, niva: string) {
  return r.risikoer.filter((x) => x.alvorlighet === niva).length;
}

export function CompareView({
  a,
  b,
  navnA,
  navnB,
}: {
  a: Rapport;
  b: Rapport;
  navnA: string;
  navnB: string;
}) {
  return (
    <div className="report">
      <div className="report-head">
        <h2>Boligduell</h2>
      </div>

      {/* Nøkkeltall side om side */}
      <div className="duel-grid">
        <DuelKort rapport={a} navn={navnA} />
        <DuelKort rapport={b} navn={navnB} />
      </div>

      {/* Risikoer side om side */}
      <div className="section-title">Ting å være obs på</div>
      <div className="duel-grid">
        <RisikoListe rapport={a} />
        <RisikoListe rapport={b} />
      </div>

      <div className="notfound" style={{ marginTop: 16 }}>
        Verktøyet kårer ingen vinner — tallene over er telling fra rapportene, og
        alvorlighet varierer. Bruk kildene og les selv der det teller.
      </div>
    </div>
  );
}

function DuelKort({ rapport, navn }: { rapport: Rapport; navn: string }) {
  const hoy = tell(rapport, "høy");
  const mid = tell(rapport, "middels");
  return (
    <div className="duel-col">
      <div className="duel-name" title={navn}>{navn}</div>
      <div className="summary" style={{ fontSize: 14 }}>{rapport.sammendrag}</div>
      <div className="facts" style={{ margin: "14px 0 0" }}>
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
          <div className="value" style={{ color: hoy > 0 ? "var(--tg3)" : undefined }}>
            {hoy}
          </div>
        </div>
        <div className="fact">
          <div className="label">Middels</div>
          <div className="value" style={{ color: mid > 0 ? "var(--tg2)" : undefined }}>
            {mid}
          </div>
        </div>
      </div>
    </div>
  );
}

function RisikoListe({ rapport }: { rapport: Rapport }) {
  const risikoer = [...rapport.risikoer].sort(
    (x, y) => (rank[y.alvorlighet] ?? 0) - (rank[x.alvorlighet] ?? 0)
  );
  return (
    <div className="duel-col">
      {risikoer.length === 0 && (
        <div className="notfound">Ingen tydelige risikoer trukket ut.</div>
      )}
      {risikoer.map((r, i) => {
        const border =
          r.alvorlighet === "høy"
            ? "var(--tg3)"
            : r.alvorlighet === "middels"
              ? "var(--tg2)"
              : "var(--tg1)";
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
