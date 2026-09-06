"use client";

import { useMemo, useState } from "react";
import { FREMHEVEDE_KATEGORIER, KATEGORIER, type Rapport, type Risiko } from "@/lib/schema";

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
                {/* Området vises alltid, også når funnene er gruppert etter
                    alvorlighet – da ser kjøperen med én gang hva det gjelder. */}
                {r.kategori !== "annet" && <span className="omrade-chip">{storForbokstav(r.kategori)}</span>}
            </div>
            <div className="desc">{r.forklaring}</div>
            {/* Rapportens eget prisanslag, der det finnes. Megler-tilbakemelding:
                kjøperen skal se alvorlighet og prislapp i samme blikk. */}
            {r.kostnadsanslag && (
                <div className="anslag">
                    <span className="anslag-merke">Rapportens anslag</span>
                    {r.kostnadsanslag}
                </div>
            )}
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

const storForbokstav = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Generelle konsekvenser av at planløsningen avviker fra godkjente tegninger.
 *
 * Fast tekst med vilje: dette er allmenne forhold i norsk byggesak, ikke noe
 * som følger av det enkelte dokumentet. Ved å holde dem utenfor modellen får vi
 * en ordlyd som kan kvalitetssikres én gang – og som ikke kan hallusineres.
 * Alt er formulert som "kan", fordi det er det som er sant: utfallet avhenger
 * av kommunen og det konkrete forholdet.
 */
const PLANLOSNING_KONSEKVENSER = [
    "Kommunen kan kreve at forholdet søkes godkjent i ettertid.",
    "En slik søknad koster penger, og det er ikke sikkert den blir innvilget.",
    "I noen tilfeller kan kommunen kreve at rommet tilbakeføres til den godkjente løsningen.",
    "Rom som ikke er godkjent for varig opphold, kan ikke regnes som primærrom (P-rom). Det påvirker både arealet du betaler for og hva banken vil låne deg.",
    "Samlet kan dette bli en betydelig kostnad, og den bærer du som kjøper.",
];

function PlanlosningSeksjon({
    status,
    avvik,
    dokumenter,
}: {
    status: Rapport["planlosning_status"];
    avvik: Rapport["planlosning_avvik"];
    dokumenter: DokRef[];
}) {
    if (status === "ingen avvik") return null; // ingenting å advare om

    const harAvvik = status === "avvik" && avvik.length > 0;

    return (
        <>
            <div className="section-title">Planløsning og godkjenning</div>
            <div className={`planlosning${harAvvik ? " har-avvik" : ""}`}>
                {harAvvik ? (
                    <>
                        <div className="planlosning-topp">
                            Dokumentet beskriver at boligen avviker fra godkjente byggetegninger.
                        </div>
                        {avvik.map((a, i) => (
                            <div key={i} className="planlosning-punkt">
                                <div>
                                    {a.rom && <strong>{a.rom}: </strong>}
                                    {a.hva}
                                </div>
                                <button className="kilde kildeknapp" onClick={() => aapneKilde(a.kilde, dokumenter)}>
                                    {a.kilde} ↗
                                </button>
                            </div>
                        ))}
                    </>
                ) : (
                    <div className="planlosning-topp">
                        Det er ikke mulig å kontrollere om planløsningen er godkjent. Byggetegninger
                        er ikke fremlagt, eller forholdet er ikke omtalt i dokumentet. Det betyr
                        ikke at noe er galt — men det er ikke undersøkt.
                    </div>
                )}

                <details className="acc planlosning-mer">
                    <summary>Hva kan dette bety for deg?</summary>
                    <ul>
                        {PLANLOSNING_KONSEKVENSER.map((k, i) => (
                            <li key={i}>{k}</li>
                        ))}
                    </ul>
                    <div className="notfound" style={{ marginTop: 8 }}>
                        Dette er generell informasjon om norske byggesaksregler, ikke juridisk
                        rådgivning. Be megler om godkjente tegninger, og kontakt kommunen hvis noe
                        er uklart før du legger inn bud.
                    </div>
                </details>
            </div>
        </>
    );
}

export function ReportView({ rapport, dokumenter }: { rapport: Rapport; dokumenter: DokRef[] }) {
    const teller = (niva: string) => rapport.risikoer.filter((x) => x.alvorlighet === niva).length;
    const hoy = teller("høy");
    const mid = teller("middels");
    const lav = teller("lav");
    const [gruppering, setGruppering] = useState<"alvorlighet" | "omrade">("alvorlighet");

    // Grupper funnene per område. Bad og kjøkken først – de er erfaringsmessig
    // de dyreste postene, og megleren ba om at de fremheves. Resten følger
    // rekkefølgen i KATEGORIER, som speiler oppbygningen av en tilstandsrapport.
    const omraadeGrupper = useMemo(() => {
        const rekkefølge = [
            ...FREMHEVEDE_KATEGORIER,
            ...KATEGORIER.filter((k) => !FREMHEVEDE_KATEGORIER.includes(k)),
        ];
        return rekkefølge
            .map((kategori) => ({
                kategori,
                funn: rapport.risikoer.filter((r) => r.kategori === kategori),
                fremhevet: FREMHEVEDE_KATEGORIER.includes(kategori),
            }))
            .filter((g) => g.funn.length > 0);
    }, [rapport.risikoer]);

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

            <div className="section-head">
                <div className="section-title">Ting å være obs på ({rapport.risikoer.length})</div>
                {/* To måter å lese de samme funnene på: alvorlighet svarer på
                    "hva haster?", område svarer på "hva gjelder det?". Megleren
                    ba om det siste; det første er fortsatt standardvisningen. */}
                {rapport.risikoer.length > 1 && (
                    <div className="grupperingsvalg no-print" role="group" aria-label="Gruppering">
                        <button
                            className={gruppering === "alvorlighet" ? "aktiv" : ""}
                            onClick={() => setGruppering("alvorlighet")}
                        >
                            Etter alvorlighet
                        </button>
                        <button
                            className={gruppering === "omrade" ? "aktiv" : ""}
                            onClick={() => setGruppering("omrade")}
                        >
                            Etter område
                        </button>
                    </div>
                )}
            </div>
            {rapport.risikoer.length === 0 && (
                <div className="notfound">Ingen tydelige risikoer trukket ut.</div>
            )}

            {gruppering === "alvorlighet"
                ? NIVAER.map((n) => {
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
                  })
                : omraadeGrupper.map(({ kategori, funn, fremhevet }) => {
                      // Alvorligste funn i gruppen bestemmer fargen på kanten,
                      // så et bad med TG3 ikke ser like uskyldig ut som et med TG2.
                      const verst = NIVAER.find((n) => funn.some((f) => f.alvorlighet === n.key)) ?? NIVAER[2];
                      return (
                          <details key={kategori} className={`acc${fremhevet ? " fremhevet" : ""}`}>
                              <summary>
                                  <span className={`tg-badge ${verst.badge}`}>{storForbokstav(kategori)}</span>
                                  <span className="acc-antall">
                                      {funn.length} funn
                                      {fremhevet && <em className="fremhev-merke">ofte størst kostnad</em>}
                                  </span>
                              </summary>
                              {funn.map((r, i) => {
                                  const n = NIVAER.find((x) => x.key === r.alvorlighet) ?? NIVAER[2];
                                  return <RisikoKort key={i} r={r} badge={n.badge} border={n.border} dokumenter={dokumenter} />;
                              })}
                          </details>
                      );
                  })}

            <PlanlosningSeksjon
                status={rapport.planlosning_status}
                avvik={rapport.planlosning_avvik}
                dokumenter={dokumenter}
            />

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
                                {k.konsekvens && (
                                    <div className="konsekvens">
                                        <span className="konsekvens-merke">Hvis du ikke gjør noe</span>
                                        {k.konsekvens}
                                    </div>
                                )}
                                {k.sporsmal.length > 0 && (
                                    <details className="acc kostnad-sporsmal">
                                        <summary>
                                            Spør megler om dette ({k.sporsmal.length})
                                        </summary>
                                        <ul>
                                            {k.sporsmal.map((s, j) => (
                                                <li key={j}>{s}</li>
                                            ))}
                                        </ul>
                                    </details>
                                )}
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
