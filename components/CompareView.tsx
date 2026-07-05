"use client";

import { useEffect, useRef, useState } from "react";
import type { Rapport } from "@/lib/schema";
import { aapneKilde, type DokRef } from "@/components/ReportView";

/**
 * Boligduell: N analyserte rapporter side om side (2, 3, 5 – så mange brukeren vil).
 * Fortsatt deterministisk – ingen AI-kåret "vinner", bare fakta ved siden av hverandre.
 * Ved mange boliger scroller kolonnene horisontalt.
 */

const rank: Record<string, number> = { høy: 3, middels: 2, lav: 1 };

const NIVAER = [
    { key: "høy", label: "Høy risiko", badge: "tg3", border: "var(--tg3)" },
    { key: "middels", label: "Middels", badge: "tg2", border: "var(--tg2)" },
    { key: "lav", label: "Lav", badge: "tg1", border: "var(--tg1)" },
] as const;

const DOKTYPE_NAVN: Record<string, string> = {
    tilstandsrapport: "Tilstandsrapport",
    salgsoppgave: "Kun salgsoppgave",
    kombinasjon: "Salgsoppgave + tilstandsrapport",
    annet: "Annet dokument",
};

export type NavngittRapport = { navn: string; rapport: Rapport; dokumenter: DokRef[] };

function tell(r: Rapport, niva: string) {
    return r.risikoer.filter((x) => x.alvorlighet === niva).length;
}

export function CompareView({ rapporter }: { rapporter: NavngittRapport[] }) {
    /**
     * Sticky horisontal scrollbar: den native scrollbaren ligger i bunnen av en
     * (potensielt svært høy) container, så vi speiler den i en tynn "proxy" som
     * er position:sticky mot bunnen av skjermen. De to holdes i sync begge veier.
     */
    const scrollRef = useRef<HTMLDivElement>(null);
    const proxyRef = useRef<HTMLDivElement>(null);
    const [innerWidth, setInnerWidth] = useState(0);
    const [trengerScroll, setTrengerScroll] = useState(false);
    const syncing = useRef(false);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const oppdater = () => {
            setInnerWidth(el.scrollWidth);
            setTrengerScroll(el.scrollWidth > el.clientWidth + 1);
        };
        oppdater();
        const ro = new ResizeObserver(oppdater);
        ro.observe(el);
        if (el.firstElementChild) ro.observe(el.firstElementChild);
        window.addEventListener("resize", oppdater);
        return () => {
            ro.disconnect();
            window.removeEventListener("resize", oppdater);
        };
    }, [rapporter.length]);

    function synk(fra: HTMLDivElement | null, til: HTMLDivElement | null) {
        if (syncing.current || !fra || !til) return;
        syncing.current = true;
        til.scrollLeft = fra.scrollLeft;
        syncing.current = false;
    }

    // Skjevt grunnlag? (f.eks. én bolig vurdert fra tilstandsrapport, en annen kun fra salgsoppgave)
    const typer = new Set(rapporter.map((x) => x.rapport.dokumenttype));
    const skjevt = typer.size > 1 || typer.has("salgsoppgave") || typer.has("annet");

    return (
        <div className="report">
            <div className="report-head">
                <h2>Boligduell ({rapporter.length} boliger)</h2>
            </div>

            {skjevt && rapporter.length > 1 && (
                <div className="grunnlagsvarsel">
                    ⚖ Boligene er vurdert på ulikt dokumentgrunnlag (se merkingen i hver kolonne).
                    En bolig med færre funn kan ha tynnere dokumentasjon — ikke nødvendigvis bedre
                    stand. Be om fullstendig tilstandsrapport der den mangler før du sammenligner
                    teknisk tilstand direkte.
                </div>
            )}

            <div
                className="duel-scroll"
                ref={scrollRef}
                onScroll={() => synk(scrollRef.current, proxyRef.current)}
            >
                <div className="duel-grid" style={{ ["--cols" as string]: rapporter.length }}>
                    {rapporter.map((x, i) => (
                        <DuelKolonne key={i} navn={x.navn} rapport={x.rapport} dokumenter={x.dokumenter} />
                    ))}
                </div>
            </div>

            {trengerScroll && (
                <div
                    className="hscroll-proxy no-print"
                    ref={proxyRef}
                    onScroll={() => synk(proxyRef.current, scrollRef.current)}
                    aria-hidden="true"
                >
                    <div style={{ width: innerWidth, height: 1 }} />
                </div>
            )}

            <div className="notfound" style={{ marginTop: 16 }}>
                Verktøyet kårer ingen vinner — tallene er telling fra rapportene, og alvorlighet
                varierer. Bruk kildene og les selv der det teller.
            </div>
        </div>
    );
}

function DuelKolonne({ rapport, navn, dokumenter }: { rapport: Rapport; navn: string; dokumenter: DokRef[] }) {
    const hoy = tell(rapport, "høy");
    const mid = tell(rapport, "middels");
    const lav = tell(rapport, "lav");
    const risikoer = [...rapport.risikoer].sort(
        (x, y) => (rank[y.alvorlighet] ?? 0) - (rank[x.alvorlighet] ?? 0)
    );

    return (
        <div className="duel-col">
            <div className="duel-name" title={navn}>{navn}</div>
            <div className="grunnlag-chip">{DOKTYPE_NAVN[rapport.dokumenttype] ?? "Ukjent grunnlag"}</div>
            {rapport.dokument_advarsel && (
                <div className="error" style={{ marginBottom: 10, fontSize: 13 }}>⚠ {rapport.dokument_advarsel}</div>
            )}
            <div className="summary" style={{ fontSize: 14 }}>{rapport.sammendrag}</div>

            <div className="facts" style={{ margin: "14px 0 8px" }}>
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
            </div>
            <div className="facts facts-3" style={{ margin: "0 0 14px" }}>
                <div className="fact">
                    <div className="label">Høy risiko</div>
                    <div className="value" style={{ color: hoy > 0 ? "var(--tg3)" : undefined }}>{hoy}</div>
                </div>
                <div className="fact">
                    <div className="label">Middels</div>
                    <div className="value" style={{ color: mid > 0 ? "var(--tg2)" : undefined }}>{mid}</div>
                </div>
                <div className="fact">
                    <div className="label">Lav</div>
                    <div className="value" style={{ color: lav > 0 ? "var(--tg1)" : undefined }}>{lav}</div>
                </div>
            </div>

            {NIVAER.map((n) => {
                const gruppe = risikoer.filter((r) => r.alvorlighet === n.key);
                if (gruppe.length === 0) return null;
                return (
                    <details key={n.key} className="acc" open>
                        <summary>
                            <span className={`tg-badge ${n.badge}`}>{n.label}</span>
                            <span className="acc-antall">{gruppe.length} funn</span>
                        </summary>
                        {gruppe.map((r, i) => (
                            <div key={i} className="avvik" style={{ borderLeft: `4px solid ${n.border}` }}>
                                <div className="top">
                                    <span className={`tg-badge ${n.badge}`}>
                                        {r.alvorlighet[0].toUpperCase() + r.alvorlighet.slice(1)}
                                    </span>
                                    <span className="del">{r.tittel}</span>
                                </div>
                                <div className="desc">{r.forklaring}</div>
                                <div className="kildelinje">
                                    <button className="kilde kildeknapp" onClick={() => aapneKilde(r.kilde, dokumenter)} title="Åpne PDF-en på denne siden">
                                        {r.kilde} ↗
                                    </button>
                                </div>
                            </div>
                        ))}
                    </details>
                );
            })}
        </div>
    );
}
