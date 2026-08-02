"use client";

import type { Rapport, Risiko } from "@/lib/schema";

/** Referanse til en opplastet PDF (for klikkbare kilder). */
export type DokRef = { name: string; url: string };

/**
 * Åpner PDF-en kilden peker på, på riktig side, i ny fane.
 * Kildeformat: "s. 24", "Pkt 5.3", eller "Dok 2, s. 7" ved flere dokumenter.
 */
export function aapneKilde(kilde: string, dokumenter: DokRef[]) {
    if (!dokumenter.length) return;
    const dok = kilde.match(/dok\w*\s*(\d+)/i);
    const side = kilde.match(/s\.?\s*(\d+)/i);
    const valgt = dokumenter[dok ? Number(dok[1]) - 1 : 0] ?? dokumenter[0];
    window.open(side ? `${valgt.url}#page=${side[1]}` : valgt.url, "_blank");
}

const NIVAER = [
    { key: "høy", label: "Høy risiko", badge: "tg3", border: "var(--tg3)" },
    { key: "middels", label: "Middels", badge: "tg2", border: "var(--tg2)" },
    { key: "lav", label: "Lav", badge: "tg1", border: "var(--tg1)" },
] as const;

const KOSTNAD_NIVA: Record<string, { label: string; badge: string }> = {
    stor: { label: "Stor", badge: "tg3" },
    middels: { label: "Middels", badge: "tg2" },
    liten: { label: "Liten", badge: "tg1" },
    ukjent: { label: "Ukjent", badge: "" },
};

/** Enkel SVG-donut over risikofordelingen. Ingen biblioteker. */
export function RisikoDonut({ hoy, mid, lav, kompakt }: { hoy: number; mid: number; lav: number; kompakt?: boolean }) {
    const total = hoy + mid + lav;
    if (total === 0) return null;
    const R = 34;
    const C = 2 * Math.PI * R;
    const deler = [
        { n: hoy, farge: "var(--tg3)" },
        { n: mid, farge: "var(--tg2)" },
        { n: lav, farge: "var(--tg1)" },
    ].filter((d) => d.n > 0);
    let offset = 0;
    return (
        <div className={`donutboks${kompakt ? " kompakt" : ""}`} aria-label={`Risikofordeling: ${hoy} høy, ${mid} middels, ${lav} lav`}>
            <svg width="92" height="92" viewBox="0 0 92 92" role="img">
                <circle cx="46" cy="46" r={R} fill="none" stroke="var(--line)" strokeWidth="12" />
                {deler.map((d, i) => {
                    const lengde = (d.n / total) * C;
                    const el = (
                        <circle
                            key={i}
                            cx="46" cy="46" r={R}
                            fill="none"
                            stroke={d.farge}
                            strokeWidth="12"
                            strokeDasharray={`${lengde} ${C - lengde}`}
                            strokeDashoffset={-offset}
                            transform="rotate(-90 46 46)"
                        />
                    );
                    offset += lengde;
                    return el;
                })}
                <text x="46" y="51" textAnchor="middle" fontSize="18" fontWeight="600" fill="var(--ink)">
                    {total}
                </text>
            </svg>
            {!kompakt && (

                <div className="donutlegende">
                    {hoy > 0 && <span><i style={{ background: "var(--tg3)" }} /> {hoy} høy</span>}
                    {mid > 0 && <span><i style={{ background: "var(--tg2)" }} /> {mid} middels</span>}
                    {lav > 0 && <span><i style={{ background: "var(--tg1)" }} /> {lav} lav</span>}
                </div>

            )}
            {kompakt && (
                <div className="donutlegende-mini" aria-hidden="true">
                    {hoy > 0 && <span><i style={{ background: "var(--tg3)" }} /> {hoy}</span>}
                    {mid > 0 && <span><i style={{ background: "var(--tg2)" }} /> {mid}</span>}
                    {lav > 0 && <span><i style={{ background: "var(--tg1)" }} /> {lav}</span>}
                </div>
            )}
        </div>
    );
}

function RisikoKort({ r, badge, border, dokumenter }: { r: Risiko; badge: string; border: string; dokumenter: DokRef[] }) {
    return (
        <div className="avvik" style={{ borderLeft: `4px solid ${border}` }}>
            <div className="top">
                <span className={`tg-badge ${badge}`}>{r.alvorlighet[0].toUpperCase() + r.alvorlighet.slice(1)}</span>
                <span className="del">{r.tittel}</span>
            </div>
            <div className="desc">{r.forklaring}</div>
            <div className="kildelinje">
                {/* Uten dokumenter (gjenopprettet analyse etter refresh) er blob-URL-ene
                    borte. Da viser vi kilden som tekst i stedet for en knapp som
                    ikke gjør noe – en død knapp er verre enn ingen knapp. */}
                {dokumenter.length > 0 ? (
                    <button
                        className="kilde kildeknapp"
                        onClick={() => aapneKilde(r.kilde, dokumenter)}
                        title="Åpne PDF-en på denne siden"
                    >
                        {r.kilde} ↗
                    </button>
                ) : (
                    <span className="kilde" title="Last opp PDF-en på nytt for å åpne kilden">
                        {r.kilde}
                    </span>
                )}
            </div>
        </div>
    );
}

const DOKTYPE_NAVN: Record<string, string> = {
    tilstandsrapport: "Tilstandsrapport",
    salgsoppgave: "Kun salgsoppgave",
    kombinasjon: "Salgsoppgave + tilstandsrapport",
    annet: "Annet dokument",
};

export function ReportView({ rapport, dokumenter }: { rapport: Rapport; dokumenter: DokRef[] }) {
    const teller = (niva: string) => rapport.risikoer.filter((x) => x.alvorlighet === niva).length;
    const hoy = teller("høy");
    const mid = teller("middels");
    const lav = teller("lav");

    return (
        <div className="report">
            <div className="report-head">
                <h2>Boligen forklart</h2>
                <span className="grunnlag-chip">{DOKTYPE_NAVN[rapport.dokumenttype] ?? "Ukjent grunnlag"}</span>
            </div>

            {rapport.dokument_advarsel && (
                <div className="error" style={{ marginBottom: 16 }}>
                    ⚠ {rapport.dokument_advarsel}
                </div>
            )}

            <div className="summary">{rapport.sammendrag}</div>

            <div className="oversikt">
                <div className="facts" style={{ flex: 1 }}>
                    <Fact label="Boligtype" value={rapport.boligtype} />
                    <Fact label="Byggeår" value={rapport.byggeaar?.toString()} />
                    <Fact
                        label="BRA"
                        value={rapport.bruksareal_bra_m2 ? `${rapport.bruksareal_bra_m2} m²` : null}
                    />
                </div>
                <RisikoDonut hoy={hoy} mid={mid} lav={lav} />
            </div>

            <div className="section-title">Ting å være obs på ({rapport.risikoer.length})</div>
            {rapport.risikoer.length === 0 && (
                <div className="notfound">Ingen tydelige risikoer trukket ut.</div>
            )}
            {NIVAER.map((n) => {
                const gruppe = rapport.risikoer.filter((r) => r.alvorlighet === n.key);
                if (gruppe.length === 0) return null;
                return (
                    <details key={n.key} className="acc">
                        <summary>
                            <span className={`tg-badge ${n.badge}`}>{n.label}</span>
                            <span className="acc-antall">{gruppe.length} funn</span>
                        </summary>
                        {gruppe.map((r, i) => (
                            <RisikoKort key={i} r={r} badge={n.badge} border={n.border} dokumenter={dokumenter} />
                        ))}
                    </details>
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
                        const n = KOSTNAD_NIVA[k.grovt_niva] ?? KOSTNAD_NIVA.ukjent;
                        return (
                            <div key={i} className="avvik">
                                <div className="top">
                                    <span className={`tg-badge ${n.badge}`}>{n.label}</span>
                                    <span className="del">{k.hva}</span>
                                </div>
                                <div className="desc">{k.vurdering}</div>
                                {k.kilde && (
                                    <div className="kildelinje">
                                        <button className="kilde kildeknapp" onClick={() => aapneKilde(k.kilde!, dokumenter)}>
                                            {k.kilde} ↗
                                        </button>
                                    </div>
                                )}
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
