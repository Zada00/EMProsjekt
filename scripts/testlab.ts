/**
 * Testlab: mål OpenRouter-modeller mot Sandvika-fasiten uten å gå via appen.
 *
 * Kjør fra prosjektroten (leser .env.local selv):
 *   npx tsx scripts/testlab.ts <sti-til-pdf> [modell1 modell2 ...]
 *
 * Eksempel:
 *   npx tsx scripts/testlab.ts "C:\Users\drago\Downloads\boligsalgsrapport-1108.pdf" ^
 *     nvidia/nemotron-3-ultra-550b-a55b:free openai/gpt-oss-120b:free
 *
 * Uten modellargumenter brukes OPENROUTER_MODEL fra .env.local.
 * Rå-svar lagres i testlab-resultater/ for manuell etterkontroll.
 *
 * Fasit (Sandvika-rapporten, kan justeres i FASIT under):
 *   2× TG3 – fukt i bod (s. 7) og brannsikkerhet (s. 8) – pluss flere TG2.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
const { SYSTEM_PROMPT } = await import("../lib/prompt");
const { rapportJsonSchema, rapportSchema } = await import("../lib/schema");
type Rapport = import("../lib/schema").Rapport;

// ---- Fasit for referansetesten ----
const FASIT = {
  tg3: [
    { navn: "Fukt i bod", ord: /fukt|vann|kondens/i, sted: /bod/i, side: 7 },
    { navn: "Brannsikkerhet", ord: /brann|røyk|slukk/i, sted: /./, side: 8 },
  ],
  minTg2: 3, // "flere TG2" – juster ved behov
};

// ---- Argumenter ----
const [pdfSti, ...modellArgs] = process.argv.slice(2);
if (!pdfSti) {
  console.error("Bruk: npx tsx scripts/testlab.ts <sti-til-pdf> [modell1 modell2 ...]");
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
console.log(`PDF: ${pdfSti} (${tekst.length} tegn tekst)\nModeller: ${modeller.join(", ")}\n`);

mkdirSync("testlab-resultater", { recursive: true });

// ---- Skåring ----
function sideAv(kilde: string): number | null {
  const m = kilde.match(/\d+/);
  return m ? Number(m[0]) : null;
}
function skaar(r: Rapport) {
  const tg3 = r.risikoer.filter((x) => x.tg === 3 || x.alvorlighet === "høy");
  const tg2 = r.risikoer.filter((x) => x.tg === 2);
  const funn = FASIT.tg3.map((f) => {
    const treff = tg3.find(
      (x) => f.ord.test(x.tittel + " " + x.forklaring) && f.sted.test(x.tittel + " " + x.forklaring)
    );
    return {
      navn: f.navn,
      funnet: !!treff,
      riktigSide: !!treff && sideAv(treff.kilde) === f.side,
      kilde: treff?.kilde ?? "-",
    };
  });
  const kroner = JSON.stringify(r).match(/\d[\d\s.]{3,}\s*(?:kr|kroner|NOK)/i); // presise beløp = regelbrudd
  return { funn, antTg3: tg3.length, antTg2: tg2.length, antRisiko: r.risikoer.length, kroner: !!kroner };
}

// ---- Kjør sekvensielt (gratiskvote: ~20 kall/min, 50/dag) ----
type Rad = { modell: string; status: string; detaljer: string; tokens?: string; sek?: number };
const rader: Rad[] = [];

for (const [i, modell] of modeller.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, 8000)); // pust mellom modeller
  process.stdout.write(`▶ ${modell} ... `);
  const t0 = Date.now();
  try {
    const { resultat, tokens } = await analyserMedOpenRouter(SYSTEM_PROMPT, bruker, rapportJsonSchema, modell);
    const sek = Math.round((Date.now() - t0) / 1000);
    const fil = join("testlab-resultater", modell.replace(/[^a-z0-9.-]+/gi, "_") + ".json");
    writeFileSync(fil, JSON.stringify(resultat, null, 2));

    const parsed = rapportSchema.safeParse(resultat);
    if (!parsed.success) {
      const p = parsed.error.issues[0];
      rader.push({ modell, status: "UGYLDIG SKJEMA", detaljer: `${p?.path?.join(".")}: ${p?.message} (rå-svar: ${fil})`, sek });
      console.log(`skjemafeil etter ${sek}s`);
      continue;
    }
    const s = skaar(parsed.data);
    const tg3ok = s.funn.every((f) => f.funnet);
    const sideok = s.funn.every((f) => f.riktigSide);
    const status =
      tg3ok && sideok && s.antTg2 >= FASIT.minTg2 && !s.kroner ? "BESTÅTT"
      : tg3ok ? "DELVIS" : "STRØK";
    rader.push({
      modell, status, sek,
      tokens: `${tokens.inn}/${tokens.ut}`,
      detaljer:
        s.funn.map((f) => `${f.navn}: ${f.funnet ? (f.riktigSide ? "✓" : `funnet, feil kilde (${f.kilde})`) : "IKKE FUNNET"}`).join(" | ") +
        ` | TG2: ${s.antTg2} (krav ≥${FASIT.minTg2}) | risikoer totalt: ${s.antRisiko}` +
        (s.kroner ? " | ⚠ oppga kronebeløp (regelbrudd!)" : ""),
    });
    console.log(`${status} etter ${sek}s`);
  } catch (err) {
    const sek = Math.round((Date.now() - t0) / 1000);
    rader.push({ modell, status: "FEILET", detaljer: err instanceof Error ? err.message : String(err), sek });
    console.log(`feilet etter ${sek}s`);
  }
}

// ---- Oppsummering ----
console.log("\n══════ RESULTAT (fasit: 2× TG3 – fukt i bod s.7, brann s.8 – + TG2-er) ══════");
for (const r of rader) {
  console.log(`\n${r.status.padEnd(14)} ${r.modell}  ${r.sek ?? "?"}s  tokens inn/ut: ${r.tokens ?? "-"}`);
  console.log(`  ${r.detaljer}`);
}
console.log("\nRå-svar ligger i testlab-resultater/ – sjekk gjerne forklaringskvaliteten manuelt.");
