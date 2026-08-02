/**
 * Testlab: mål OpenRouter-modeller mot Sandvika-fasiten uten å gå via appen.
 *
 * Kjør fra prosjektroten (leser .env.local selv):
 *   npx tsx scripts/testlab.mts <sti-til-pdf> [modell1 modell2 ...]
 *
 * Eksempel:
 *   npx tsx scripts/testlab.mts "C:\Users\drago\Downloads\boligsalgsrapport-1108.pdf" ^
 *     nvidia/nemotron-3-ultra-550b-a55b:free openai/gpt-oss-120b:free
 *
 * Uten modellargumenter brukes OPENROUTER_MODEL fra .env.local.
 * Rå-svar lagres i testlab-resultater/ for manuell etterkontroll.
 *
 * Fasit (Sandvika-rapporten, kan justeres i FASIT under):
 *   2× TG3 – fukt i bod (s. 7) og brannsikkerhet (s. 8) – pluss flere TG2.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";

// ---- .env.local (dotenv er ikke installert – enkel parser holder) ----
try {
  for (const linje of readFileSync(resolve(".env.local"), "utf8").split(/\r?\n/)) {
    const m = linje.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {
  console.error("Fant ikke .env.local – kjør scriptet fra prosjektroten.");
  process.exit(1);
}

// Importeres FØRST NÅ, etter at env er lastet (modulene leser env ved import).
const { analyserMedOpenRouter, OPENROUTER_MODEL } = await import("../lib/openrouter");
const { pdfTilTekst } = await import("../lib/pdftext");
const { SYSTEM_PROMPT, TEKSTMOTOR_REGLER, PROMPT_VERSJON } = await import("../lib/prompt");
const { normaliserAlvorlighet, rapportJsonSchema, rapportSchema } = await import("../lib/schema");
const { vurderDekning } = await import("../lib/dekningsvakt");
type Rapport = import("../lib/schema").Rapport;

// ---- Fasit for referansetesten ----
// Bygger på rapportens egen oppsummeringstabell (s. 4): 14 kontrollpunkter med
// TG-status – 3× TG3 + 11× TG2. Gruppert i 12 sakskomplekser fordi modeller
// legitimt slår sammen (vannrør bad/kjøkken/toalett) eller splitter (brann i to).
// Detaljsidene har i tillegg småting utenfor tabellen (hull i veggplate s. 7,
// stakeluke TGIU) – de kreves ikke, men gir plusspoeng manuelt.
const FASIT = {
  tg3: [
    { navn: "Fukt i bod", ord: /fukt|vann|kondens/i, sted: /bod/i, side: 7 },
    { navn: "Brannsikkerhet", ord: /brann|røyk|slukk/i, sted: /./, side: 8 },
  ],
  maxTg3Funn: 3, // bod + røykvarslere + brannslokkingsutstyr (de to siste slås ofte sammen)
  dekning: [
    { navn: "Vannrør (bad/kjøkken/toalett)", ord: /vannrør|kobberrør/i },
    { navn: "Membran/tettesjikt bad", ord: /membran|tettesjikt/i },
    { navn: "Fukt i tilliggende konstruksjoner", ord: /fukt(skad|.*konstruksjon)/i },
    { navn: "Avløpsrør/sluk ikke byttet", ord: /sluk/i },
    { navn: "Komfyrvakt", ord: /komfyrvakt/i },
    { navn: "Fukt/svertesopp i bod", ord: /bod/i },
    { navn: "Skjevheter i gulv", ord: /skjev/i },
    { navn: "Elektrisk anlegg/sikringsskap", ord: /sikringsskap|elektrisk/i },
    { navn: "Røykvarslere", ord: /røykvarsl/i },
    { navn: "Brannslokkingsutstyr", ord: /brannslokk|brannslukk|slukkeutstyr/i },
    { navn: "Vinduer (alder/fastsittende)", ord: /vindu/i },
    { navn: "Balkongrekkverk", ord: /rekkverk|balkong/i },
  ],

  /**
   * KJENTE BLINDSONER – måles og rapporteres, men senker ikke status.
   * Dette er feil vi har observert reproduserbart, også hos Claude (fasiten).
   * De står her for at en fremtidig promptendring skal kunne VISE at den
   * fikset dem – eller at den ikke gjorde det.
   */
  blindsoner: [
    {
      navn: "Hull i veggplate skal ha TG2",
      // Rapporten s. 7: Toalettrom → TG 2 → "Overflater vegger: Hull i veggplate mot stue."
      // Claude leste den som "informasjonspunkt uten TG" i 3 av 3 kjøringer (v3, 25.07)
      // – TG 2-overskriften dekker to kontrollpunkter, og graden knyttes til vannrørene.
      test: (r: Rapport) => {
        const funn = r.risikoer.find((x) => /hull i vegg/i.test(x.tittel + " " + x.forklaring));
        if (!funn) return null; // ikke nevnt i det hele tatt – ikke en blindsone-treff
        return funn.tg === 2 ? null : `hull i veggplate har tg=${funn.tg} (rapporten sier TG2)`;
      },
    },
    {
      navn: "TGIU hører kun i ikke_funnet",
      // Skjemabeskrivelsen sier TGIU → ikke_funnet. Claude analyse 3 (v3, 25.07) la
      // stakeluke BÅDE i risikoer og ikke_funnet. 2 av 3 kjøringer var korrekte.
      test: (r: Rapport) => {
        const feil = r.risikoer.filter((x) =>
          /stakeluke|tgiu|ikke besiktiget|ikke undersøkt/i.test(x.tittel + " " + x.forklaring) &&
          x.tg === null
        );
        return feil.length ? `TGIU-forhold i risikoer: ${feil.map((f) => f.tittel).join(", ")}` : null;
      },
    },
  ],
};

// ---- Argumenter ----
// --n=3 kjører hver modell 3 ganger og rapporterer stabilitet (LLM-er er ikke
// deterministiske – konklusjonene skal likevel være stabile fra kjøring til kjøring).
const alleArgs = process.argv.slice(2);
const nArg = alleArgs.find((a) => a.startsWith("--n="));
const antKjoringer = Math.max(1, Number(nArg?.split("=")[1] ?? 1) || 1);
const [pdfSti, ...modellArgs] = alleArgs.filter((a) => !a.startsWith("--"));
if (!pdfSti) {
  console.error("Bruk: npx tsx scripts/testlab.mts <sti-til-pdf> [--n=3] [modell1 modell2 ...]");
  process.exit(1);
}
const modeller = modellArgs.length ? modellArgs : [OPENROUTER_MODEL];

// ---- Tekstuttrekk (én gang) + samme brukermelding som route.ts ----
const tekst = await pdfTilTekst(readFileSync(resolve(pdfSti)));
if (tekst.length < 200) {
  console.error("PDF-en ser ut til å mangle tekstlag (bildeskann) – testlab krever tekst.");
  process.exit(1);
}
const bruker =
  `Sidetall står som [Side N]-markører i teksten – bruk dem i "kilde" (f.eks. "s. 12").\n\n${tekst}` +
  "\n\nForklar dette for meg som boligkjøper. Husk kilde på alt, oversett fagord, ingen presise kronebeløp.";
console.log(
  `PDF: ${pdfSti} (${tekst.length} tegn tekst)\nPrompt: ${PROMPT_VERSJON}\nModeller: ${modeller.join(", ")}\n`
);

mkdirSync("testlab-resultater", { recursive: true });

// ---- Skåring ----
function siderAv(kilde: string): number[] {
  // "s. 4, s. 7" er to gyldige henvisninger – godta treff på HVILKEN SOM HELST av dem.
  return (kilde.match(/\d+/g) ?? []).map(Number);
}
/**
 * Kronebeløp-vakt v2 (etter policyendring): rapportens egne sjablonganslag er
 * LOV å gjengi – oppdiktede tall er ikke. Vi plukker alle beløp i svaret og
 * sjekker at sifrene finnes i kildeteksten (normalisert uten mellomrom/punktum).
 */
function beloepIkkeIKilden(r: Rapport, kildetekst: string): string[] {
  // Slå kun sammen tusenskille (mellomrom/punktum MELLOM sifre) i kilden,
  // og krev ordgrense – ellers gir sammenlimte tallsekvenser falske frikjennelser.
  const kilde = kildetekst.replace(/(?<=\d)[\s.](?=\d)/g, "");
  const treff =
    JSON.stringify(r).match(/(?:kr|NOK)\s*\d[\d\s.,–\-+]*|\d[\d\s.,–\-+]*\d\+?\s*(?:kr|kroner|NOK|,-)/gi) ?? [];
  const ukjente = new Set<string>();
  for (const t of treff) {
    for (const num of t.match(/\d[\d\s.]*\d|\d+/g) ?? []) {
      const n = num.replace(/[\s.]/g, "");
      if (n.length >= 3 && !new RegExp(`\\b${n}\\b`).test(kilde)) ukjente.add(n);
    }
  }
  return [...ukjente];
}

function skaar(r: Rapport, kildetekst: string) {
  const tg3 = r.risikoer.filter((x) => x.tg === 3 || x.alvorlighet === "høy");
  const tg2 = r.risikoer.filter((x) => x.tg === 2);
  const funn = FASIT.tg3.map((f) => {
    const treff = tg3.find(
      (x) => f.ord.test(x.tittel + " " + x.forklaring) && f.sted.test(x.tittel + " " + x.forklaring)
    );
    return {
      navn: f.navn,
      funnet: !!treff,
      riktigSide: !!treff && siderAv(treff.kilde).includes(f.side),
      kilde: treff?.kilde ?? "-",
    };
  });
  const ukjenteBeloep = beloepIkkeIKilden(r, kildetekst); // beløp som IKKE står i rapporten = regelbrudd

  // Feilklassene fra Nemotron-testen:
  // 1) Hallusinert TG3: flere tg=3-funn enn fasit-rapporten faktisk har.
  //    (Feil TG-verdi kan koden IKKE reparere – kun modellen vet hva den leste.)
  const hallusinertTg3 = r.risikoer.filter((x) => x.tg === 3).length > FASIT.maxTg3Funn;
  // 2) "Dok 1"-kilder ved ett dokument.
  const dokKilde = r.risikoer.some((x) => /dok\s*\d/i.test(x.kilde));

  const fordeling = {
    høy: r.risikoer.filter((x) => x.alvorlighet === "høy").length,
    middels: r.risikoer.filter((x) => x.alvorlighet === "middels").length,
    lav: r.risikoer.filter((x) => x.alvorlighet === "lav").length,
  };

  // Dekning mot s. 4-tabellen: er alle 12 sakskompleksene representert?
  const altTekst = r.risikoer.map((x) => `${x.tittel} ${x.forklaring}`).join("\n");
  const mangler = FASIT.dekning.filter((d) => !d.ord.test(altTekst)).map((d) => d.navn);

  // Kjente blindsoner: rapporteres, men påvirker ikke status.
  const blindsoner = FASIT.blindsoner
    .map((b) => b.test(r))
    .filter((x): x is string => x !== null);

  return {
    funn, antTg3: tg3.length, antTg2: tg2.length, antRisiko: r.risikoer.length,
    ukjenteBeloep, hallusinertTg3, dokKilde, fordeling, mangler, blindsoner,
  };
}

// ---- Kjør sekvensielt (gratiskvote: ~20 kall/min, 50/dag) ----
type Rad = { modell: string; status: string; detaljer: string; tokens?: string; sek?: number };
const rader: Rad[] = [];

let førsteKall = true;
for (const modell of modeller) {
  const statuser: string[] = [];
  for (let k = 1; k <= antKjoringer; k++) {
  const navn = antKjoringer > 1 ? `${modell} (kjøring ${k}/${antKjoringer})` : modell;
  if (!førsteKall) await new Promise((r) => setTimeout(r, 8000)); // pust mellom kall
  førsteKall = false;
  process.stdout.write(`▶ ${navn} ... `);
  const t0 = Date.now();

  // Slett et eventuelt gammelt resultat for dette løpenummeret FØR kallet.
  // Ellers overlever filen fra forrige batch en feilet kjøring, og blir
  // talt som om den var ny (skjedde 25.07: kjøring 5 var 36 minutter gammel).
  const filnavn = join(
    "testlab-resultater",
    modell.replace(/[^a-z0-9.-]+/gi, "_") + (antKjoringer > 1 ? `_${k}` : "") + ".json"
  );
  rmSync(filnavn, { force: true });
  try {
    const { resultat, tokens, leverandor } = await analyserMedOpenRouter(
      SYSTEM_PROMPT + TEKSTMOTOR_REGLER, // samme prompt som route.ts sin OpenRouter-gren
      bruker, rapportJsonSchema, modell
    );
    const sek = Math.round((Date.now() - t0) / 1000);
    const fil = filnavn;
    // Versjonsstempel i selve resultatfilen – ellers er gamle kjøringer
    // ikke sammenlignbare med nye etter en promptendring.
    writeFileSync(
      fil,
      JSON.stringify(
        { _prompt: PROMPT_VERSJON, _modell: modell, _leverandor: leverandor, _tokens: tokens, _tid: new Date().toISOString(), resultat },
        null, 2
      )
    );

    const parsed = rapportSchema.safeParse(resultat);
    if (!parsed.success) {
      const p = parsed.error.issues[0];
      statuser.push("UGYLDIG SKJEMA");
      rader.push({ modell: navn, status: "UGYLDIG SKJEMA", detaljer: `${p?.path?.join(".")}: ${p?.message} (rå-svar: ${fil})`, sek });
      console.log(`skjemafeil etter ${sek}s`);
      continue;
    }
    // Samme normalisering som produksjon (TG→alvorlighet). `korrigert` er
    // kvalitetssignalet: hvor ofte modellen satte alvorlighet i strid med TG selv.
    const { rapport, korrigert } = normaliserAlvorlighet(parsed.data);
    const s = skaar(rapport, tekst);
    const tg3ok = s.funn.every((f) => f.funnet);
    const sideok = s.funn.every((f) => f.riktigSide);
    const rene = s.ukjenteBeloep.length === 0 && !s.hallusinertTg3 && !s.dokKilde;
    const status =
      tg3ok && sideok && s.mangler.length === 0 && rene ? "BESTÅTT"
      : tg3ok ? "DELVIS" : "STRØK";
    statuser.push(status);
    rader.push({
      modell: navn, status, sek,
      tokens: `${tokens.inn}/${tokens.ut} (${leverandor})`,
      detaljer:
        s.funn.map((f) => `${f.navn}: ${f.funnet ? (f.riktigSide ? "✓" : `funnet, feil kilde (${f.kilde})`) : "IKKE FUNNET"}`).join(" | ") +
        ` | dekning: ${FASIT.dekning.length - s.mangler.length}/${FASIT.dekning.length} sakskomplekser fra s. 4-tabellen` +
        (s.mangler.length ? ` (mangler: ${s.mangler.join(", ")})` : "") +
        ` | fordeling h/m/l: ${s.fordeling.høy}/${s.fordeling.middels}/${s.fordeling.lav} av ${s.antRisiko}` +
        (korrigert ? ` | ℹ ${korrigert} alvorlighet(er) korrigert av TG-normaliseringen` : "") +
        (s.ukjenteBeloep.length ? ` | ⚠ oppdiktede beløp ikke i rapporten: ${s.ukjenteBeloep.join(", ")}` : "") +
        (s.hallusinertTg3 ? " | ⚠ flere TG3 enn fasit (hallusinert TG?)" : "") +
        (s.dokKilde ? " | ⚠ 'Dok N'-kilde ved ett dokument" : "") +
        (() => {
          // Dekningsvakten slik den kjører i produksjon – ville denne blitt forkastet?
          const d = vurderDekning(rapport, tekst);
          return d.usikker
            ? `\n  ℹ dekningsvakt: ikke anvendelig (${d.usikker})`
            : `\n  ${d.ufullstendig ? "⛔" : "ℹ"} dekningsvakt: ${d.dekket}/${d.totalt} TG-bærende sider sitert (${Math.round(d.andel * 100)} %)` +
              (d.ufullstendig ? " – VILLE BLITT FORKASTET i produksjon" : "");
        })() +
        (s.blindsoner.length ? `\n  ℹ kjente blindsoner: ${s.blindsoner.join(" | ")}` : "\n  ℹ ingen kjente blindsoner truffet"),
    });
    console.log(`${status} etter ${sek}s`);
  } catch (err) {
    const sek = Math.round((Date.now() - t0) / 1000);
    const melding = err instanceof Error ? err.message : String(err);
    statuser.push("FEILET");
    rader.push({ modell: navn, status: "FEILET", detaljer: melding, sek });
    // Skriv årsaken MED EN GANG. Ved lange batcher er det ubrukelig å vente
    // til sluttoppsummeringen for å oppdage at kvoten tok slutt på kall 3.
    console.log(`feilet etter ${sek}s – ${melding}`);

    // Tre feil på rad = noe systemisk (kvote, nøkkel, modell borte).
    // Ikke brenn gjennom resten av batchen; avbryt og rapporter det vi har.
    if (statuser.slice(-3).every((s) => s === "FEILET") && statuser.length >= 3) {
      console.log(`\n⛔ Tre feil på rad – avbryter batchen for ${modell}. Fullførte ${statuser.filter((s) => s !== "FEILET").length} av ${antKjoringer} kjøringer.`);
      break;
    }
  }
  } // kjøringer

  // Stabilitet på tvers av kjøringene: konklusjonen skal ikke flakke.
  if (antKjoringer > 1) {
    const stabil = new Set(statuser).size === 1;
    const tell = (s: string) => statuser.filter((x) => x === s).length;
    const n = statuser.length;
    const bestatt = tell("BESTÅTT");
    const strok = tell("STRØK");
    const feilet = tell("FEILET") + tell("UGYLDIG SKJEMA");
    // Wilson-intervall for strykraten – ved store n er dette tallet som betyr noe.
    const p = n ? strok / n : 0;
    const z = 1.96, senter = (p + z * z / (2 * n)) / (1 + z * z / n);
    const margin = (z / (1 + z * z / n)) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    const pst = (x: number) => `${Math.round(x * 100)} %`;
    rader.push({
      modell: `${modell} – OPPSUMMERING (n=${n})`,
      status: stabil ? "STABIL" : "USTABIL",
      detaljer:
        `BESTÅTT ${bestatt} | DELVIS ${tell("DELVIS")} | STRØK ${strok} | FEILET/UGYLDIG ${feilet}\n` +
        `  strykrate ${pst(p)} (95 % KI: ${pst(Math.max(0, senter - margin))}–${pst(Math.min(1, senter + margin))})\n` +
        `  statuser: [${statuser.join(", ")}]`,
    });
  }
}

// ---- Oppsummering ----
console.log(`\n══════ RESULTAT (prompt ${PROMPT_VERSJON} | fasit: 2× TG3 – fukt i bod s.7, brann s.8 – + TG2-er) ══════`);
for (const r of rader) {
  console.log(`\n${r.status.padEnd(14)} ${r.modell}  ${r.sek ?? "?"}s  tokens inn/ut: ${r.tokens ?? "-"}`);
  console.log(`  ${r.detaljer}`);
}
console.log("\nRå-svar ligger i testlab-resultater/ – sjekk gjerne forklaringskvaliteten manuelt.");
