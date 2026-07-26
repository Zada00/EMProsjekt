# Tilstandsrapport-copilot (PoC)

Last opp en tilstandsrapport (PDF) → få ut strukturert nøkkelinfo (TG2/TG3-avvik, byggeår,
areal, ferdigattest, kommunale avgifter, tinglyste servitutter) med **kildehenvisning på hvert
funn**. Dette er Steg 1 + frontend-skjelettet fra Steg 3 i veikartet, i én kjørbar app.

Stacken er bevisst minimal: **Next.js (App Router) + TypeScript** for både frontend og backend,
**Anthropic SDK** for analysen. Claude leser PDF-en direkte (native PDF-støtte), så vi trenger
ingen egen OCR-tjeneste i denne første versjonen.

---

## Kom i gang

```bash
npm install
cp .env.example .env.local      # og lim inn ANTHROPIC_API_KEY
npm run dev                      # http://localhost:3000
```

Hent API-nøkkel på https://console.anthropic.com. Standardmodell er `claude-sonnet-4-6`
(billig, Opus-nær). Bytt til `claude-opus-4-8` via `ANTHROPIC_MODEL` i `.env.local` hvis en
rapport er vanskelig/utydelig.

### Test med ekte data
Last ned 5–10 tilstandsrapporter fra FINN.no, legg dem i en mappe `testdata/` (allerede
git-ignorert), og kjør dem gjennom appen. Mål fra veikartet: får dere ut alle TG2/TG3 uten feil?

---

## Hvem eier hva (roller → filer)

| Rolle | Hovedfiler |
|---|---|
| **Tech Lead / Backend** (Utvikler 1) | `app/api/analyze/route.ts`, `lib/anthropic.ts`, sikkerhet/GDPR |
| **Frontend / UI** (Utvikler 2) | `app/page.tsx`, `components/Dropzone.tsx`, `components/ReportView.tsx`, `app/globals.css` |
| **Fullstack / Testing** (Utvikler 3) | tester (mangler – se under), feilhåndtering i `route.ts` |
| **Prompt Engineer / Data** (Utvikler 4) | `lib/prompt.ts`, `lib/schema.ts` ← **kjernen i produktet** |

`lib/prompt.ts` og `lib/schema.ts` er der verdien ligger. Endrer dere prompten, endrer dere
kvaliteten på alt. Versjoner endringer og test mot de samme rapportene hver gang.

---

## Hvordan det henger sammen

```
Bruker drar inn PDF
      │
      ▼
app/page.tsx ──POST /api/analyze (FormData)──► app/api/analyze/route.ts
                                                     │  base64 av PDF
                                                     ▼
                                          Anthropic Messages API
                                          - system: lib/prompt.ts
                                          - tool: lib/schema.ts (tvinger struktur)
                                                     │  tool_use-svar
                                                     ▼
                                          zod-validering (lib/schema.ts)
                                                     │
      ◄───────────── JSON: { rapport } ─────────────┘
      ▼
components/ReportView.tsx  (sortert TG3→TG2, kilde-chips, kopier-knapp)
```

**Structured output:** vi definerer rapportformatet som et "tool" og setter
`tool_choice` til å tvinge kallet. Da svarer modellen alltid i riktig struktur, og vi
slipper å parse fritekst. Svaret valideres mot zod før det sendes til frontend.

**Mot hallusinasjon:** prompten forbyr gjetting — felt som ikke finnes blir `null` og havner
i `ikke_funnet`. Hvert funn bærer `kilde` (sidetall/punkt) så megler verifiserer på sekunder.
Presisjon er produktet, ikke en detalj.

---

## GDPR / personvern (innebygget)

- PDF-en lagres **aldri** på disk eller i database. Den lever kun i minne i `route.ts` og
  forkastes når forespørselen returnerer (slett-etter-bruk fra veikartet, håndhevet i kode).
- Ansvarsfraskrivelse vises i bunnen av appen.
- **Før ekte persondata:** få på plass en databehandleravtale (DPA) med Anthropic og avklar
  zero-retention. Dette var et eget punkt fra strategifasen — ikke hopp over det.

---

## Ekstern databerikelse: prisvurdering (denne branchen)

Verktøyet leste tidligere kun det opplastede dokumentet, isolert. Denne branchen
legger til én ekstern kilde: hvis salgsoppgaven oppgir **adresse** og
**prisantydning** (nye felt Claude nå trekker ut, se `lib/schema.ts`), henter
backend faktisk offentlig prisstatistikk og sammenligner boligens kr/m² mot
kommunesnittet.

- **Kartverkets adresse-API** (`ws.geonorge.no`) – geokoder adresse → kommunenummer.
  `lib/geokoding.ts`
- **SSB PxWebApi**, tabell 14310 – kommunesnitt kr/m² per boligtype, siste kvartal.
  `lib/ssb.ts`
- **`lib/prisvurdering.ts`** – ren beregningslogikk (kr/m² + avvik%), enhetstestet
  uten nettverk (`tests/prisvurdering.test.ts`, `tests/ssb.test.ts`).

Begge kilder er gratis og krever **ingen API-nøkkel eller registrering**. Ingen nye
miljøvariabler trengs. Berikelsen feiler alltid stille (returnerer `null`) hvis
adresse mangler, kommunen er for liten til å ha data, eller et av API-ene er nede –
den kan aldri velte selve dokumentanalysen. Vises i både enkeltbolig- og
duell-modus.

Vurdert og forkastet for nå (se full research i prosjekthistorikken): Kartverket
matrikkel/heftelser (krever bedriftssøknad), FINN.no prishistorikk (ingen
tredjeparts-API finnes), reguleringsplan-oppslag (ingen samlet nasjonalt API ennå).
Aktuelle neste kandidater: NVE (flom/skredfare), NGU (radon), støy- og
kulturminnedata – samme gratis WMS-mønster som over.

**Merk for personvernerklæring:** Kartverket og SSB blir nye tredjeparter som mottar
boligens adresse (ikke resten av dokumentet) – må inn i personvernerklæringen når
denne branchen merges (se `legal-privacy-fixes`-branchen).

---

## Kjente begrensninger (og dermed neste steg)

- **Store/skannede PDF-er:** Claudes PDF-grense er ca. 32 MB / ~100 sider. Rapporter over dette,
  eller rene bildeskann, trenger et tekstuttrekks-/OCR-steg foran (f.eks. Azure Document
  Intelligence) som splitter og sender ren tekst i stedet. Bygg dette først når dere faktisk
  treffer grensen — ikke før.
- **Tester finnes** (`npm test`, vitest) for skjema-normalisering, SSB-boligtype-mapping og
  prisvurdering-beregning – men fortsatt ingen ende-til-ende-måling av TG2/TG3-presisjon mot
  fasit på ekte rapporter.
- **Kvalitetsmåling:** lag et regneark med fasit (manuelt lest) for 10 rapporter, og mål
  presisjon/recall på TG2/TG3 hver gang prompten endres.

---

## Push til repoet

```bash
git init
git add .
git commit -m "PoC: tilstandsrapport-copilot (Steg 1 + frontend-skjelett)"
git branch -M main
git remote add origin https://github.com/Panawandi/EMProsjekt.git
git push -u origin main
```

(Bytt til en feature-branch hvis `main` alt har innhold.)


---

## Pilot-herding (utført)

- **Tilgangskoder**: sett `ACCESS_CODES=kode1,kode2` i `.env.local` – én kode per kunde.
  Tom = åpen (lokal utvikling). Frontend spør om kode ved 401 og husker den i økten.
- **Rate-limit/kvote**: `RATE_PER_MIN` (std 6) og `QUOTA_PER_DAY` (std 40) per kode. I minne –
  holder for én instans; bytt til Redis ved skalering.
- **Kostnadslogging**: hver analyse logges i serverterminalen med tokens og ≈ kr, pluss dagssum.
- **Sikkerhets-headers**: X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.
- **Feilrespons**: zod-detaljer sendes ikke til klient i produksjon.
- **Sync-vakt**: bygget feiler høyt hvis zod- og JSON-skjema i `lib/schema.ts` glir fra hverandre.
- **Tester**: `npm test` (vitest) – regresjonsvern for skjema-normaliseringen.

## Gjenstår før ekte kundedata (IKKE kode)

- **Databehandleravtale (DPA)** med Anthropic + personvernerklæring – kundedokumenter sendes til API-et.
- `npm audit`: 2 kjente sårbarheter i byggekjeden (postcss via Next) – krever kontrollert
  Next-oppgradering; ikke kjør `audit fix --force`.
- HTTPS/domene ved deploy (håndteres av plattformen, f.eks. Vercel).
