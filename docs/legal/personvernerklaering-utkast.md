# Personvernerklæring for BoligCopilot — UTKAST

> **Dette er et arbeidsutkast, ikke en ferdig personvernerklæring.**
> Felt merket `[SETT INN: ...]` mangler reelt innhold dere selv må fylle inn.
> Dette må gjennomgås av en jurist/personvernrådgiver før det publiseres eller
> gjøres gjeldende. Se `gdpr-gap-analysis.md` for full status.

---

## 1. Hvem er ansvarlig for behandlingen?

**Behandlingsansvarlig:** `[SETT INN: firmanavn, org.nr., forretningsadresse]`

Kontakt for personvernspørsmål: `[SETT INN: e-postadresse]`

## 2. Hva er BoligCopilot?

BoligCopilot er et verktøy som hjelper boligkjøpere å forstå salgsoppgaver og
tilstandsrapporter. Du laster opp én eller flere PDF-er, og verktøyet forklarer
innholdet på vanlig norsk: risikoer, spørsmål å stille på visning, og mulige
fremtidige kostnader.

## 3. Hvilke personopplysninger behandles?

De opplastede dokumentene kan inneholde personopplysninger, for eksempel:

- adresse til boligen
- navn på selger/eier hvis dette fremgår av dokumentet
- prisantydning og andre boligopplysninger

Vi ber deg ikke om navn, e-post eller andre personopplysninger for å bruke
tjenesten selv (utover en eventuell tilgangskode i pilotfasen).

## 4. Hvorfor behandler vi opplysningene? (behandlingsgrunnlag)

Behandlingen skjer for å levere tjenesten du selv aktivt ber om — å analysere
dokumentet du laster opp. Rettslig grunnlag er **personvernforordningen
artikkel 6 nr. 1 bokstav b** (behandlingen er nødvendig for å oppfylle en
avtale/levere en tjeneste du har bedt om).

## 5. Hvordan behandles dokumentene dine?

1. Du laster opp PDF-en(e) i nettleseren.
2. Filen sendes til vår server og videre til Anthropic (leverandøren av
   KI-modellen Claude) for analyse.
3. Svaret struktureres og vises tilbake til deg i nettleseren.
4. Dokumentet lagres **ikke** på disk eller i database av oss — det
   eksisterer kun i serverens minne for varigheten av forespørselen, og
   forsvinner når svaret er sendt.

## 6. Hvem får tilgang til opplysningene? (mottakere/tredjeparter)

- **Anthropic** (leverandør av Claude, KI-modellen som analyserer dokumentet).
  Anthropic opptrer som databehandler for denne behandlingen. Anthropics
  standard databehandleravtale (DPA) er automatisk innlemmet i deres
  Commercial Terms of Service ved bruk av API-et kommersielt – ingen egen
  signatur kreves. `[BEKREFT: at kontoen som brukes faktisk kjører under
  Anthropic Commercial Terms of Service, og ikke en konsument-/personlig
  Claude-plan – sjekkes i Console-innstillinger]`

Vi selger ikke, og deler ikke, opplastede dokumenter med andre tredjeparter
utover det som er nødvendig for å levere analysen.

## 7. Overføres data ut av EØS?

Ja. Anthropic behandler forespørsler som del av sin infrastruktur i USA.
Overføringen er dekket av EUs standardkontraktsklausuler (SCC, Module Two:
controller-til-prosessor), som er del av Anthropics databehandleravtale
(kilde: anthropic.com/legal/data-processing-addendum, avsnitt om
internasjonal overføring, verifisert `[SETT INN: dato]`).

## 8. Hvor lenge lagres opplysningene?

- **Hos oss:** dokumentet lagres ikke — det behandles kun i minne under selve
  analysen og forsvinner når svaret er levert.
- **Hos Anthropic:** ifølge Anthropics offentlige dokumentasjon beholdes
  standard API-forespørsler normalt i inntil 30 dager, med mindre annet er
  avtalt. Vi bruker ikke Anthropics API på en måte som trener modeller på
  dine data (dette er Anthropics standardinnstilling for API-bruk).
  Kilde: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention

## 9. Dine rettigheter

Du har, i den grad det er relevant for denne behandlingen, rett til:

- innsyn i hvilke opplysninger som behandles om deg
- retting av uriktige opplysninger
- sletting
- begrensning av behandlingen
- å klage til Datatilsynet (datatilsynet.no)

Siden vi ikke lagrer opplastede dokumenter, vil det normalt ikke finnes noe å
gi innsyn i eller slette hos oss etter at en analyse er fullført.

## 10. Kontakt

`[SETT INN: e-postadresse for personvernhenvendelser]`

---

*Dette dokumentet er teknisk forarbeid, ikke juridisk rådgivning. Endelig
personvernerklæring må kvalitetssikres av en jurist eller personvernrådgiver
før kommersiell lansering.*
