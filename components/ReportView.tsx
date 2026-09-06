"use client";

import { useMemo, useState } from "react";
import { FREMHEVEDE_KATEGORIER, KATEGORIER, SPORSMAL_TEMA, type Rapport, type Risiko } from "@/lib/schema";

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

/**
 * Tilstandsgradene forklart. Definisjonene er standard for norske
 * tilstandsrapporter (NS 3600) og er like i alle rapporter – derfor fast tekst
 * her, ikke noe modellen skal gjenfortelle for hver analyse.
 */
const TG_FORKLARING = [
    { tg: "TG 0", farge: "var(--tg1)", tekst: "Ingen avvik. Bygningsdelen er som ny." },
    { tg: "TG 1", farge: "var(--tg1)", tekst: "Mindre avvik. Normal slitasje for alderen, ingen tiltak nødvendig nå." },
    { tg: "TG 2", farge: "var(--tg2)", tekst: "Vesentlig avvik. Alder, slitasje eller skader gjør at tiltak kan bli nødvendig, gjerne innen få år." },
    { tg: "TG 3", farge: "var(--tg3)", tekst: "Stort eller alvorlig avvik. Takstmannen mener strakstiltak er nødvendig. Dette er det du bør undersøke først." },
];

export function TilstandsgradForklaring() {
    return (
        <details className="acc tg-forklaring">
            <summary>Hva betyr tilstandsgradene?</summary>
            <div className="tg-liste">
                {TG_FORKLARING.map((t) => (
                    <div key={t.tg} className={`tg-rad${t.tg === "TG 3" ? " tg-rad-alvorlig" : ""}`}>
                        <span className="tg-prikk" style={{ background: t.farge }} />
                        <strong>{t.tg}</strong>
                        <span>{t.tekst}</span>
                    </div>
                ))}
            </div>
            <div className="notfound" style={{ marginTop: 10 }}>
                Tilstandsgraden er takstmannens vurdering, ikke vår. Vi gjengir den som den står i
                rapporten.
            </div>
        </details>
    );
}

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
            {!kompakt && <div className="donut-tittel">Hvor alvorlige er funnene?</div>}
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
                    {/* Alvorlighet FØLGER tilstandsgraden (se normaliserAlvorlighet),
                        så vi kan trygt vise koblingen. Da lærer kjøperen hva TG-ene
                        betyr underveis, i stedet for å måtte slå det opp. */}
                    {hoy > 0 && (
                        <span className="legende-hoy">
                            <i style={{ background: "var(--tg3)" }} /> {hoy} høy <em>TG3</em>
                        </span>
                    )}
                    {mid > 0 && (
                        <span>
                            <i style={{ background: "var(--tg2)" }} /> {mid} middels <em>TG2</em>
                        </span>
                    )}
                    {lav > 0 && (
                        <span>
                            <i style={{ background: "var(--tg1)" }} /> {lav} lav <em>TG0–1</em>
                        </span>
                    )}
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

const PARKERING_NAVN: Record<string, string> = {
    "privat": "Privat plass",
    "garasje": "Garasje",
    "carport": "Carport",
    "felles": "Felles anlegg",
    "gateparkering": "Gateparkering",
    "ingen": "Følger ikke med",
};

/** Visningsnavn for arealtypene. Forkortelsene alene sier ingenting til en kjøper. */
const AREAL_NAVN: Record<string, string> = {
    "bra": "Bruksareal (BRA)",
    "bra-i": "Innvendig areal (BRA-i)",
    "bra-e": "Utvendig areal, f.eks. bod (BRA-e)",
    "bra-b": "Innglasset balkong (BRA-b)",
    "tba": "Terrasse og balkong",
    "p-rom": "Primærrom (P-rom)",
    "s-rom": "Sekundærrom (S-rom)",
    "bta": "Bruttoareal (BTA)",
    "tomt": "Tomt",
};

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

const EGENERKLAERING_TYPE: Record<string, string> = {
    "oppdaget": "Selger kjenner til",
    "utbedret": "Selger har utbedret",
    "tidligere hendelse": "Tidligere hendelse",
    "annet": "Opplyst",
};

/**
 * Selgers egenerklæring, gruppert per område og utvidbar per gruppe.
 *
 * Megleren kaller dette et av de viktigste dokumentene for å forstå boligens
 * historikk, og det stemmer: det er her lekkasjer og utbedringer selger kjenner
 * til faktisk står. Men det er selgers EGNE ord, ikke en fagvurdering – og det
 * sier vi rett ut, så kjøperen vekter det deretter.
 */
function EgenerklaeringSeksjon({
    status,
    punkter,
    dokumenter,
}: {
    status: Rapport["egenerklaering_status"];
    punkter: Rapport["egenerklaering"];
    dokumenter: DokRef[];
}) {
    const grupper = useMemo(() => {
        return KATEGORIER.map((kategori) => ({
            kategori,
            funn: punkter.filter((p) => p.kategori === kategori),
        })).filter((g) => g.funn.length > 0);
    }, [punkter]);

    return (
        <>
            <div className="section-title">Sammendrag av selgers egenerklæring</div>
            <div className="egenerklaering-intro">
                Egenerklæringen er selgers egne opplysninger om boligen — ofte det viktigste
                dokumentet for å forstå hva som faktisk har skjedd med den. Merk at dette er
                selgers ord, ikke en fagperson sin vurdering.
            </div>

            {status === "ikke vedlagt" && (
                <div className="notfound">
                    Egenerklæringsskjemaet er ikke vedlagt dokumentene. Be megler om det — det er
                    et av de mest opplysende dokumentene i en bolighandel.
                </div>
            )}
            {status === "ingen opplysninger" && (
                <div className="notfound">
                    Skjemaet er vedlagt, men selger har ikke opplyst om forhold av betydning.
                </div>
            )}

            {grupper.map(({ kategori, funn }) => (
                <details key={kategori} className="acc">
                    <summary>
                        <span className="tg-badge">{storForbokstav(kategori)}</span>
                        <span className="acc-antall">{funn.length} opplysning{funn.length === 1 ? "" : "er"}</span>
                    </summary>
                    {funn.map((p, i) => (
                        <div key={i} className="avvik">
                            <div className="top">
                                <span className="egen-type">{EGENERKLAERING_TYPE[p.type] ?? "Opplyst"}</span>
                            </div>
                            <div className="desc">{p.hva}</div>
                            {p.kilde && (
                                <div className="kildelinje">
                                    <button className="kilde kildeknapp" onClick={() => aapneKilde(p.kilde!, dokumenter)}>
                                        {p.kilde} ↗
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </details>
            ))}
        </>
    );
}

const EIERFORM_NAVN: Record<string, string> = {
    "selveier": "Selveier",
    "sameie": "Eierseksjon i sameie",
    "borettslag": "Andel i borettslag",
    "aksjeleilighet": "Aksjeleilighet",
};

/** Kroner med mellomrom som tusenskille – 3500 → "3 500 kr". */
const kr = (n: number) => `${n.toLocaleString("nb-NO")} kr`;

/**
 * Økonomi. Vi viser kun feltene som faktisk har verdi, i stedet for å styre
 * visningen på boligtype: modellen setter null på det som ikke gjelder, og da
 * slipper vi å vedlikeholde de samme reglene både i prompten og i UI-et.
 */
function OkonomiSeksjon({ okonomi, dokumenter }: { okonomi: Rapport["okonomi"]; dokumenter: DokRef[] }) {
    const harNoe =
        okonomi.felleskostnader_mnd !== null ||
        okonomi.fellesgjeld !== null ||
        okonomi.kommunale_avgifter_aar !== null ||
        okonomi.eiendomsskatt_aar !== null ||
        okonomi.planlagte_fellesprosjekter !== null ||
        okonomi.eierform !== "ikke opplyst";
    if (!harNoe) return null;

    return (
        <>
            <div className="section-title">Økonomi</div>
            <div className="facts">
                <Fact label="Eierform" value={EIERFORM_NAVN[okonomi.eierform] ?? null} />
                <Fact
                    label="Felleskostnader"
                    value={okonomi.felleskostnader_mnd !== null ? `${kr(okonomi.felleskostnader_mnd)}/mnd` : null}
                />
                <Fact label="Fellesgjeld" value={okonomi.fellesgjeld !== null ? kr(okonomi.fellesgjeld) : null} />
                <Fact
                    label="Kommunale avgifter"
                    value={okonomi.kommunale_avgifter_aar !== null ? `${kr(okonomi.kommunale_avgifter_aar)}/år` : null}
                />
                <Fact
                    label="Eiendomsskatt"
                    value={okonomi.eiendomsskatt_aar !== null ? `${kr(okonomi.eiendomsskatt_aar)}/år` : null}
                />
            </div>

            {/* Vedtatte prosjekter er fremtidige felleskostnader som ikke synes
                i månedsbeløpet i dag – derfor markert, ikke bare listet. */}
            {okonomi.planlagte_fellesprosjekter && (
                <div className="parkering-vilkar">
                    <span className="anslag-merke">Planlagt i sameiet</span>
                    {okonomi.planlagte_fellesprosjekter}
                </div>
            )}
            {okonomi.kilde && (
                <div className="kildelinje">
                    <button className="kilde kildeknapp" onClick={() => aapneKilde(okonomi.kilde!, dokumenter)}>
                        {okonomi.kilde} ↗
                    </button>
                </div>
            )}
        </>
    );
}

const OPPVARMING_NAVN: Record<string, string> = {
    "elektrisk": "Elektrisk",
    "varmepumpe": "Varmepumpe",
    "vedovn eller peis": "Vedovn eller peis",
    "fjernvarme": "Fjernvarme",
    "vannbåren varme": "Vannbåren varme",
    "gulvvarme": "Gulvvarme",
    "solenergi": "Solenergi",
    "annet": "Annet",
};

/** Energi og oppvarming. Vises kun når dokumentet faktisk sier noe. */
function EnergiSeksjon({ energi, dokumenter }: { energi: Rapport["energi"]; dokumenter: DokRef[] }) {
    const harNoe =
        energi.energimerke || energi.oppvarming.length > 0 || energi.aarlig_stromforbruk_kwh || energi.stromavtale;
    if (!harNoe) return null;

    return (
        <>
            <div className="section-title">Energi og oppvarming</div>
            <div className="facts">
                <Fact label="Energimerke" value={energi.energimerke} />
                <Fact
                    label="Oppvarming"
                    value={
                        energi.oppvarming.length > 0
                            ? energi.oppvarming.map((o) => OPPVARMING_NAVN[o] ?? o).join(", ")
                            : null
                    }
                />
                <Fact
                    label="Strømforbruk"
                    value={energi.aarlig_stromforbruk_kwh ? `${energi.aarlig_stromforbruk_kwh} kWh/år` : null}
                />
            </div>

            {energi.stromavtale && (
                <div className="parkering-vilkar">
                    <span className="anslag-merke">Strømavtale</span>
                    {energi.stromavtale}
                </div>
            )}
            {energi.betydning && <div className="konsekvens">{energi.betydning}</div>}
            {energi.kilde && (
                <div className="kildelinje">
                    <button className="kilde kildeknapp" onClick={() => aapneKilde(energi.kilde!, dokumenter)}>
                        {energi.kilde} ↗
                    </button>
                </div>
            )}
        </>
    );
}

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

    // Sjekklisten grupperes etter tema, i den rekkefølgen temaene er definert –
    // tilstand og kostnader først, småting til slutt.
    const sporsmalGrupper = useMemo(
        () =>
            SPORSMAL_TEMA.map((tema) => ({
                tema,
                sporsmal: rapport.sporsmal_til_visning.filter((q) => q.tema === tema),
            })).filter((g) => g.sporsmal.length > 0),
        [rapport.sporsmal_til_visning]
    );

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

            {/* Nøkkelinformasjonen først: megleren var tydelig på at dette er
                det brukeren skal se øverst, før den forklarende teksten. */}
            <div className="section-title">Nøkkelinformasjon</div>
            <div className="facts">
                <Fact label="Boligtype" value={rapport.boligtype} />
                <Fact label="Byggeår" value={rapport.byggeaar?.toString()} />
                <Fact
                    label="Bruksareal"
                    value={rapport.bruksareal_bra_m2 ? `${rapport.bruksareal_bra_m2} m²` : null}
                />
                <Fact label="Rom" value={rapport.antall_rom?.toString()} />
                <Fact label="Soverom" value={rapport.antall_soverom?.toString()} />
                <Fact
                    label="Parkering"
                    value={
                        rapport.parkering.type === "ikke opplyst"
                            ? null
                            : PARKERING_NAVN[rapport.parkering.type] ?? rapport.parkering.type
                    }
                />
            </div>

            {/* Vilkårene er poenget: en plass som leies eller ikke følger boligen
                er noe helt annet enn en man eier. Derfor egen, markert linje. */}
            {rapport.parkering.vilkar && (
                <div className="parkering-vilkar">
                    <span className="anslag-merke">Merk om parkering</span>
                    {rapport.parkering.vilkar}
                    {rapport.parkering.kilde && (
                        <button
                            className="kilde kildeknapp"
                            onClick={() => aapneKilde(rapport.parkering.kilde!, dokumenter)}
                        >
                            {rapport.parkering.kilde} ↗
                        </button>
                    )}
                </div>
            )}
            {rapport.parkering.beskrivelse && !rapport.parkering.vilkar && (
                <div className="notfound">{rapport.parkering.beskrivelse}</div>
            )}

            {rapport.areal_detaljer.length > 0 && (
                <details className="acc arealboks">
                    <summary>Alle arealer ({rapport.areal_detaljer.length})</summary>
                    <div className="areal-liste">
                        {rapport.areal_detaljer.map((a, i) => (
                            <div key={i} className="areal-rad">
                                <span className="areal-navn">{AREAL_NAVN[a.type] ?? a.type}</span>
                                <span className="areal-tall">{a.m2} m²</span>
                                {a.kilde && (
                                    <button className="kilde kildeknapp" onClick={() => aapneKilde(a.kilde!, dokumenter)}>
                                        {a.kilde} ↗
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </details>
            )}

            {rapport.etasjer.length > 0 && (
                <details className="acc arealboks">
                    <summary>Slik er boligen bygget opp</summary>
                    <div className="etasje-liste">
                        {rapport.etasjer.map((e, i) => (
                            <div key={i} className="etasje-rad">
                                <strong>{e.navn}</strong>
                                <span>{e.rom.length > 0 ? e.rom.join(", ") : "ikke spesifisert"}</span>
                            </div>
                        ))}
                    </div>
                </details>
            )}

            {/* Het "Boligen forklart" som overskriften øverst – to like titler
                på samme side gjør det uklart hva som er hva. */}
            <div className="section-title">Kort oppsummert</div>
            <div className="summary">{rapport.sammendrag}</div>

            <div className="oversikt">
                <RisikoDonut hoy={hoy} mid={mid} lav={lav} />
            </div>

            {rapport.risikoer.length > 0 && <TilstandsgradForklaring />}

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

            <OkonomiSeksjon okonomi={rapport.okonomi} dokumenter={dokumenter} />

            <EnergiSeksjon energi={rapport.energi} dokumenter={dokumenter} />

            <EgenerklaeringSeksjon
                status={rapport.egenerklaering_status}
                punkter={rapport.egenerklaering}
                dokumenter={dokumenter}
            />

            <PlanlosningSeksjon
                status={rapport.planlosning_status}
                avvik={rapport.planlosning_avvik}
                dokumenter={dokumenter}
            />

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

            {/* Spørsmålene sist: de bygger på alt over – funn, kostnader,
                planløsning og økonomi. Da leser siden som en fortelling som
                ender i noe kjøperen kan ta med seg på visning. */}
            {rapport.sporsmal_til_visning.length > 0 && (
                <>
                    <div className="section-title">
                        Spørsmål å stille på visning ({rapport.sporsmal_til_visning.length})
                    </div>
                    <div className="qintro">
                        Ta med denne listen på visning. Spørsmålene er hentet fra det som faktisk
                        står i dokumentene for nettopp denne boligen.
                    </div>
                    {sporsmalGrupper.map(({ tema, sporsmal }) => (
                        <div key={tema} className="qgruppe">
                            <div className="qtema">{storForbokstav(tema)}</div>
                            <div className="qlist">
                                {sporsmal.map((q, i) => (
                                    <div key={i} className="qitem">{q.sporsmal}</div>
                                ))}
                            </div>
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
