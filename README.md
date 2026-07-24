# BoligCopilot

Last opp salgsoppgave og/eller tilstandsrapport (PDF) → få den forklart på vanlig norsk for en
**boligkjøper uten fagbakgrunn**: hva du bør være obs på, hva du bør spørre om på visning, og hva
som kan koste penger senere – med **kildehenvisning på hvert funn**, sammenligning av flere
boliger og PDF-eksport.

Stacken er bevisst minimal: **Next.js (App Router) + TypeScript** for både frontend og backend,
**Anthropic SDK** for analysen. Claude leser PDF-en direkte (native PDF-støtte), så vi trenger
ingen egen OCR-tjeneste for hovedmotoren.

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
git-ignorert), og kjør dem gjennom appen. Mål: får dere ut alle TG2/TG3 uten feil?
`npm test` kjører enhetstestene; `scripts/testlab.mts` skårer en hel analyse mot fasit.

---

## Hvem eier hva (roller → filer)

| Rolle | Hovedfiler |
|---|---|
| **Tech Lead / Backend** (Utvikler 1) | `app/api/analyze/route.ts`, `lib/anthropic.ts`, sikkerhet/GDPR |
| **Frontend / UI** (Utvikler 2) | `app/page.tsx`, `components/Dropzone.tsx`, `components/ReportView.tsx`, `app/globals.css` |
| **Fullstack / Testing** (Utvikler 3) | `tests/`, `scripts/testlab.mts`, feilhåndtering i `route.ts` |
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

Ved `ENGINE=openrouter` erstattes Anthropic-steget av tekstuttrekk (`lib/pdftext.ts`) +
OpenRouter med to-kjørings-konsensus – se eget avsnitt under.

**Structured output:** vi definerer rapportformatet som et "tool" og setter
`tool_choice` til å tvinge kallet. Da svarer modellen alltid i riktig struktur, og vi
slipper å parse fritekst. Svaret valideres mot zod før det sendes til frontend.

**Mot hallusinasjon:** prompten forbyr gjetting — felt som ikke finnes blir `null` og havner
i `ikke_funnet`. Hvert funn bærer `kilde` (sidetall/punkt) så kjøperen kan slå opp selv.
Presisjon er produktet, ikke en detalj.

**Alvorlighet følger TG-en, ikke modellens mening.** `normaliserAlvorlighet()` i `lib/schema.ts`
kjøres etter valideringen for begge motorer og setter TG3→høy, TG2→middels, TG0/1→lav. Kun
forhold uten oppgitt TG beholder modellens skjønn. Bakgrunn: testmodeller nedgraderte ekte TG3
til «middels». Kostnadsdimensjonen holdes adskilt i `mulige_kostnader` – en manglende røykvarsler
er høy risiko og liten kostnad, og skal vises som begge deler.

**Kronebeløp:** modellen skal aldri anslå kostnader selv. Beløp som står *ordrett* i dokumentet
(takstmannens sjablonganslag) kan gjengis, merket som rapportens anslag og med kilde. Alt annet
er grov skala (liten/middels/stor/ukjent).

---

## Motorbryter og OpenRouter-testlab (eksperiment-branch)

`ENGINE` i `.env.local` velger motor: `anthropic` (standard, produksjon) eller `openrouter`
(testlab for å måle gratismodeller mot Claude-fasiten).

```bash
ENGINE=openrouter
OPENROUTER_API_KEY=sk-or-...                             # openrouter.ai
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free  # gratislisten roterer
```

⚠️ **Kun testdokumenter gjennom denne motoren.** Gratismodeller kan bruke innsendt data til
trening – aldri ekte kundedata. Kvoten er ca. 50 kall/dag.

Tekstmodeller leser ikke PDF direkte, så `lib/pdftext.ts` trekker ut tekst med `[Side N]`-markører
(kildehenvisningene overlever motorbyttet). Rene bildeskann avvises med tydelig melding.
`lib/prompt.ts` har et eget tillegg, `TEKSTMOTOR_REGLER`, som **kun** sendes til tekstmotorene –
Claude-fasiten holdes uperturbert. Reglene A–G er skrevet mot observerte feil: TG gjengis ordrett,
alvorlighet følger TG, kun kildeverifiserte beløp, riktig kildeformat, norsk uten markdown,
rapportens oppsummeringstabell som fullstendighets-sjekkliste, og beløp koblet kun til sitt eget
kontrollpunkt.

### To-kjørings-konsensus

Målinger (2× `--n=3` mot Sandvika-rapporten) viser at Nemotron 3 Ultra treffer 12/12
sakskomplekser i ca. 2 av 3 kjøringer – men kollapser i den tredje og mister *begge* TG3-funnene.
`lib/konsensus.ts` håndterer det uten å falle tilbake på Claude: hver analyse kjøres 2× parallelt,
og resultatet leveres kun hvis kjøringene er enige om TG3-bildet (sammenslåing tillatt) og
dekningen (maks 60/40-sprik). Ved sprik avgjør en tredje kjøring; er ingen to enige, får brukeren
ærlig beskjed i stedet for en upålitelig analyse. Koster 2–3 kall per analyse (~16–25 analyser/dag).

### Testlab-scriptet

```bash
npx tsx scripts/testlab.mts <sti-til-pdf> [--n=3] [modell1 modell2 ...]
```

Kjører samme flyt som `route.ts` utenom UI-et og skårer mot fasiten: begge TG3-funn med riktig
sidehenvisning, dekning av alle 12 sakskomplekser fra rapportens s. 4-tabell (de tre vannrør-radene
teller som én sak), beløp verifisert mot kildeteksten, og `Dok N`-kilder ved ett dokument.
`--n=3` kjører samme modell flere ganger og rapporterer STABIL/USTABIL. Rå-svar lagres i
`testlab-resultater/` for manuell kvalitetsvurdering. Fasiten ligger øverst i scriptet og må
tilpasses hvis du bytter referanserapport.

**Status:** Claude er produksjonsmotoren. Gratismodellene finner forholdene, men er ustabile på
dekning og upresise på kildekobling – testlab, ikke produksjon.

---

## GDPR / personvern (innebygget)

- PDF-en lagres **aldri** på disk eller i database. Den lever kun i minne i `route.ts` og
  forkastes når forespørselen returnerer (slett-etter-bruk fra veikartet, håndhevet i kode).
- Ansvarsfraskrivelse vises i bunnen av appen.
- **Før ekte persondata:** få på plass en databehandleravtale (DPA) med Anthropic og avklar
  zero-retention. Dette var et eget punkt fra strategifasen — ikke hopp over det.

---

## Kjente begrensninger (og dermed neste steg)

- **Store/skannede PDF-er:** Claudes PDF-grense er ca. 32 MB / ~100 sider. Rapporter over dette,
  eller rene bildeskann, trenger et tekstuttrekks-/OCR-steg foran (f.eks. Azure Document
  Intelligence) som splitter og sender ren tekst i stedet. Bygg dette først når dere faktisk
  treffer grensen — ikke før.
- **Gratismodeller er ustabile:** ca. 1 av 3 kjøringer kollapser (mister TG3-funn). Konsensusen
  fanger det, men koster kvote. Ingen prompt har fjernet lotterikomponenten – det er modelltaket.
- **Feilkoblede beløp:** en modell knyttet bodens sjablonganslag til badet. Beløpsvakten sjekker
  at tallet finnes i kilden, ikke at det tilhører riktig kontrollpunkt – radnivå-attribusjon må
  fortsatt kontrolleres manuelt.
- **Kvalitetsmåling:** testlab-fasiten dekker foreløpig én rapport (Sandvika). Utvid med fasit for
  10 rapporter og mål presisjon/recall på TG2/TG3 hver gang prompten endres.

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
- **Tester**: `npm test` (vitest) – regresjonsvern for skjema-normaliseringen, TG→alvorlighet-
  normaliseringen og konsensus-logikken (scenarioene er hentet fra faktiske testlab-kjøringer).

## Gjenstår før ekte kundedata (IKKE kode)

- **Databehandleravtale (DPA)** med Anthropic + personvernerklæring – kundedokumenter sendes til API-et.
- `npm audit`: 2 kjente sårbarheter i byggekjeden (postcss via Next) – krever kontrollert
  Next-oppgradering; ikke kjør `audit fix --force`.
- HTTPS/domene ved deploy (håndteres av plattformen, f.eks. Vercel).
