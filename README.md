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

Hent API-nøkkel på https://console.anthropic.com. Standardmodell er `claude-sonnet-5`.
Bytt til `claude-opus-5` via `ANTHROPIC_MODEL` i `.env.local` hvis en rapport er
vanskelig eller utydelig.

Prisene ligger i en tabell per modell i `lib/kostnad.ts` og følger modellvalget automatisk
(sonnet-5: $2/$10 per million tokens, opus-5: $5/$25, verifisert 09.09.2026). Bytter du til
en modell som ikke står i tabellen, sier loggen fra i stedet for å gjette.

En ny modell er en like stor endring som en ny prompt — kjør fasiten på nytt.

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

**Prompt-injection:** opplastede PDF-er er upålitelig input – en selger eller megler har direkte
økonomisk motiv for å skjule avvik. `SYSTEM_PROMPT` slår derfor fast at dokumentinnhold er data
og aldri instruksjoner, og at forsøk på å styre analysen skal rapporteres i `dokument_advarsel`.

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
Claude-fasiten holdes uperturbert. Reglene A–I er skrevet mot observerte feil: TG gjengis ordrett,
alvorlighet følger TG, kun kildeverifiserte beløp, riktig kildeformat, norsk uten markdown,
rapportens oppsummeringstabell som fullstendighets-sjekkliste, beløp koblet kun til sitt eget
kontrollpunkt, TGIU-forhold til `ikke_funnet`, og faktaopplysninger gjengitt ordrett.

**Merk om tabellen:** statuskolonnen i oppsummeringstabellen er fargede ikoner, ikke tekst. Den
følger *ikke* med i `pdfTilTekst`-uttrekket, så tekstmotorene må hente hver TG fra detaljsidene.
Claude ser ikonene via native PDF-lesing. Dette er dokumentert i arbeidsrekkefølgen i prompten,
og er verdt å huske hvis noen senere vurderer å parse tabellen maskinelt.

**Prompt-versjonering:** `PROMPT_VERSJON` i `lib/prompt.ts` stemples på hver kostnadslogg og hvert
testlab-resultat. Bump den ved enhver endring i prompt-tekstene – ellers blir gamle målinger
sammenlignet med nye uten at noen oppdager det.

### Målt feilmodus: modellen mister midten av dokumentet

58 kjøringer mot samme referanserapport (Sandvika, ~12k tokens) avdekket én dominerende
feilmodus: modellen analyserer kun de første og siste sidene, og påstår i sammendraget at
midtsidene «mangler i dokumentet». De gjør ikke det – input-tokens er identisk i gode og
dårlige kjøringer, leverandøren er den samme, og `pdfTilTekst` leverer alle sider. Dette er
klassisk *lost in the middle*, og resultatet ser komplett og selvsikkert ut.

Feilraten er **ikke stabil**:

| Måleserie | Kollaps | Rate |
|---|---|---|
| 25.07, kl. 01–04 UTC | 12 av 29 | 41 % |
| 26.07, kl. 11–13 UTC | 2 av 29 | 7 % |

Identisk prompt (`v3-2026-07-25`), modell, leverandør og dokument. Forskjellen er statistisk
signifikant (p ≈ 0,002) og skyldes trolig last på gratisendepunktet. Praktisk betydning: kvaliteten
på gratismotoren varierer med tidspunkt, og du kan ikke love en bruker hva de får.

Ingen promptendring har påvirket dette. Reglene A–I fikset formatfeil (kilder, beløp,
faktaopplysninger) – de fikset ikke dette, fordi det ikke er et instruksjonsproblem.

### To forsvarslinjer

**Dekningsvakt** (`lib/dekningsvakt.ts`) – deterministisk, koster ingenting. En tilstandsrapport
nevner «TG 2»/«TG 3» som tekst på de sidene som faktisk vurderer bygningsdeler. Har modellen
ikke sitert dem, har den ikke lest dem. Analyser som dekker under 60 % av de TG-bærende sidene
forkastes. Validert på 29 kjøringer: begge kollapsene fanget, null falske positive (kollaps 33–50 %
dekning, korrekte analyser 67–100 %). Avstår når dokumentet har færre enn tre TG-bærende sider,
siden signalet da er for svakt – typisk rene salgsoppgaver.

**To-kjørings-konsensus** (`lib/konsensus.ts`) – fanger det vakten ikke ser. Hver analyse kjøres
2× parallelt, og resultatet leveres kun hvis kjøringene er enige om TG3-bildet (sammenslåing
tillatt) og dekningen (maks 60/40-sprik). Ved sprik avgjør en tredje kjøring; er ingen to enige,
får brukeren ærlig beskjed i stedet for en upålitelig analyse. Ingen Claude-fallback.
Koster 2–3 kall per analyse (~16–25 analyser/dag på gratiskvoten).

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

**Status:** Claude er produksjonsmotoren – 3 av 3 kjøringer med full dekning, korrekte TG-er og
kildeverifiserte beløp, til rundt én krone per analyse. Nemotron 3 Ultra kan levere jevngodt
arbeid (26 av 29 rene på en god dag), men kvaliteten svinger med forhold vi ikke kontrollerer.
Med dekningsvakt og konsensus er den forsvarlig – uten dem er den ikke det.

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
- **Gratismodellenes kvalitet svinger med tidspunkt:** 41 % kollaps om natten, 7 % på formiddagen,
  med identisk oppsett. Dekningsvakt og konsensus håndterer det, men du kan ikke forutsi hvilket
  regime en bruker treffer.
- **Dekningsvakten er kalibrert på NS 3600-rapporter** der TG-ene står som tekst. Terskelen (60 %)
  er validert på én rapport – utvid valideringen når fasit for flere rapporter er på plass.
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
