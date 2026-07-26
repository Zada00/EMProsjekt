# Protokoll over behandlingsaktiviteter (Art. 30) — UTKAST

> Internt dokument, ikke offentlig. Beskriver faktisk arkitektur i denne
> branchen (`legal-privacy-fixes`, av `dev`). Vurder selv om dere kvalifiserer
> for unntaket i Art. 30(5) — anbefalingen er å føre denne uansett.

## Behandlingsansvarlig

`[SETT INN: firmanavn, org.nr., kontakt]`

## Formål med behandlingen

Analysere boligkjøpers opplastede PDF-dokumenter (tilstandsrapport og/eller
salgsoppgave) og levere en strukturert, kjøpervennlig forklaring med
kildehenvisninger.

## Kategorier av registrerte

Brukere av tjenesten (boligkjøpere) og eventuelt tredjepersoner nevnt i
dokumentene de laster opp (f.eks. selger/eier, hvis navngitt i dokumentet).

## Kategorier av personopplysninger

- Adresse til boligen (hvis oppgitt i dokumentet)
- Prisantydning og øvrige boligopplysninger
- Eventuelt navn på selger/eier hvis dette fremgår av dokumentet
- Tilgangskode brukt i pilotfasen (ikke personopplysning i seg selv, men
  knyttes til bruksmønster: antall analyser, tidspunkt)

**Ingen** navn, e-post eller kontaktinfo samles inn om brukeren selv for å
bruke tjenesten.

## Mottakere

| Mottaker | Rolle | Formål | Data som deles |
|---|---|---|---|
| Anthropic (Claude API) | Databehandler | Selve dokumentanalysen | Fullt PDF-innhold (base64), sendt direkte til Anthropics Messages API |

*(Ved fremtidig merge av `external-data-enrichment`: legg til Kartverkets
adresse-API og SSB PxWebApi som mottakere av kun adresse/kommunenummer —
ikke resten av dokumentet.)*

## Overføring til tredjeland

Anthropic behandler forespørsler med infrastruktur i USA. Dekket av Anthropics
standard-DPA, som inkorporerer EUs standardkontraktsklausuler (SCC Module Two)
og er automatisk gjeldende ved kommersiell API-bruk (verifisert 2026-07-26,
anthropic.com/legal/data-processing-addendum) — ingen separat avtale å inngå.

## Lagringstid

- **Hos oss:** ingen lagring av opplastede dokumenter. Prosesseres i minne for
  varigheten av HTTP-forespørselen (`app/api/analyze/route.ts`), forsvinner
  ved respons.
- **Driftslogger:** kostnad/bruk logges til serverkonsoll med tilgangskode,
  en tilfeldig forespørsels-ID, token-antall og estimert kostnad — aldri
  filnavn, dokumentinnhold eller modellsvar (se `lib/kostnad.ts`).
  Loggene er kun i prosessminne/stdout, ingen persistent logglagring er satt
  opp i denne branchen.
- **Hos Anthropic:** standard API-retention, for tiden inntil 30 dager per
  Anthropics offentlige dokumentasjon (uavhengig bekreftet, ikke garantert av
  denne appen — se personvernerklæring-utkastet).

## Tekniske og organisatoriske sikkerhetstiltak

- API-nøkkel kun server-side, aldri eksponert til klient (`lib/anthropic.ts`)
- MIME-type- og størrelsesvalidering av opplastede filer (`route.ts`)
- Tilgangskoder + rate-limit (6/min) + dagskvote (40/dag) per kode
  (`lib/tilgang.ts`)
- Sikkerhets-HTTP-headers: `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` (`next.config.mjs`)
- Feildetaljer med potensielt sensitivt innhold sendes kun til klient utenfor
  produksjonsmiljø (`NODE_ENV !== "production"`-sjekk i `route.ts`)
- HTTPS håndteres av hostingplattform ved deploy (ikke del av
  applikasjonskoden)

## Åpne punkter

Se `gdpr-gap-analysis.md` for full liste — kort oppsummert: bekreft at
Anthropic-kontoen kjører under Commercial Terms of Service (DPA-en er allerede
automatisk gjeldende, ikke noe å signere), reelt firmainnhold mangler i alle
utkast, ingen jurist-gjennomgang gjort ennå.
