# GDPR gap-analyse — BoligCopilot

Kartlegging av `gdpr-requirements.md` mot faktisk kode, per denne branchen
(`legal-privacy-fixes`, branchet av `dev` — **ikke** `external-data-enrichment`).
Sist oppdatert i denne PR-en. Ikke juridisk rådgivning.

Tre kategorier brukt under:

- ✅ **På plass** — implementert i kode/arkitektur.
- 🛠️ **Fikset i denne branchen** — kodeendring gjort nå.
- 📝 **Utkast levert her** — tekst skrevet, men krever reelt firmainnhold og/eller advokat-gjennomgang før den kan publiseres/gjøres gjeldende.
- ❌ **Åpent, kan ikke gjøres av meg** — krever forretningsbeslutning, signatur eller ekstern part.

---

## Art. 5 — Prinsipper

- ✅ Prosesserer kun det som trengs for analysen (PDF → strukturert JSON, ingen sekundærbruk).
- ✅ Ingen permanent lagring av opplastede dokumenter (`route.ts`: alt lever i `Buffer`/minne under forespørselen).
- 🛠️ **Loggingen brøt minimeringsprinsippet** — `loggKostnad` logget filnavn (ofte navn+adresse i norske eiendomsdokumenter). Fikset: erstattet med tilfeldig forespørsels-ID (`crypto.randomUUID().slice(0,8)`), ingen kobling til dokumentet. Se `lib/kostnad.ts`, `app/api/analyze/route.ts`.
- 🛠️ Zod-valideringsfeil logget tidligere hele feilobjektet (kan i prinsippet inneholde fragmenter av modellsvaret). Trimmet til kun `path`/`code`/`message`.

## Art. 6 — Behandlingsgrunnlag

- 📝 Ikke dokumentert noe sted i appen. Riktig grunnlag er trolig **Art. 6(1)(b)** (nødvendig for å levere tjenesten brukeren selv ber om) — brukt i personvernerklæring-utkastet. Endelig vurdering bør bekreftes av jurist, spesielt om det noen gang blir aktuelt med markedsføring/analytics utover selve analysen (da kreves egen vurdering, mulig samtykke).

## Art. 13/14 — Informasjonsplikt

- ❌➜📝 **Fantes ikke i det hele tatt** — kun én kort disclaimer-setning i `app/page.tsx` om at verktøyet ikke er profesjonell rådgivning, ingenting om databehandling. Utkast til personvernerklæring levert: `docs/legal/personvernerklaering-utkast.md`. **Ikke koblet inn som live side i appen ennå** — bevisst, se "Hva gjenstår" nederst.

## Art. 24 — Ansvarlig (the controller)

- 📝 Ingen intern dokumentasjon fantes. Adressert i `docs/legal/records-of-processing-utkast.md` (arkitektur, dataflyt, prosessorer, sikkerhetstiltak, lagringspolicy — kort og direkte fra faktisk kodebase, ikke gjettet).

## Art. 25 — Innebygd personvern

- ✅ Backend-proxy (frontend snakker aldri direkte med Anthropic), filer prosesseres kun i minne, API-nøkkel kun server-side (`lib/anthropic.ts`), sikre defaults (sikkerhets-headers i `next.config.mjs`).
- ✅ Least privilege et stykke på vei: tilgangskoder + rate-limit + dagskvote (`lib/tilgang.ts`) begrenser hvem som i det hele tatt kan sende dokumenter inn i piloten.

## Art. 28 — Databehandler (Anthropic)

- 🛠️➜✅ **Enklere enn antatt, verifisert direkte hos Anthropic (2026-07-26).** Anthropics standard-DPA er automatisk innlemmet i deres Commercial Terms of Service ved kommersiell API-bruk — **ingen egen signatur eller salgsdialog kreves**. Kilde: anthropic.com/legal/data-processing-addendum ("is incorporated into and forms part of the Anthropic Commercial Terms of Service ... no additional signing needed"). Gjenstår kun: (1) bekreft at kontoen faktisk kjører under Commercial Terms of Service (ikke en konsument-/personlig Claude-plan), (2) lagre kopi av ToS+DPA som dokumentasjon for Art. 24/30. Dialog med Anthropic (kontakt salg) er kun nødvendig hvis dere i tillegg vil ha Zero Data Retention (ZDR) eller en forhandlet/skreddersydd DPA — ikke et krav for grunnleggende GDPR-compliance.

## Art. 30 — Protokoll over behandlingsaktiviteter

- 📝 Utkast levert: `docs/legal/records-of-processing-utkast.md`. Dere må selv vurdere om dere kvalifiserer for unntaket i Art. 30(5) (typisk små virksomheter uten risikofylt/storskala behandling) — men anbefalingen (også i kildedokumentet) er å føre den uansett, siden det gjør resten av compliance-arbeidet enklere.

## Art. 32 — Sikkerhet

- ✅ Sikkerhets-headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`), MIME-validering, størrelsesgrenser, tilgangskontroll, API-nøkkel kun backend.
- 🛠️ Zod-feildetaljer (`detaljer: parsed.error.flatten()`) sendtes til klient **uansett miljø** — README hevdet allerede at dette var gatet bak produksjon, men koden gjorde det ikke. Fikset nå: kun sendt når `NODE_ENV !== "production"`.
- 🛠️ `console.error` ved uventet feil logget hele feilobjektet (kan inneholde interne detaljer) — nå kun `err.message`.
- ❌ HTTPS — avhenger av hosting-plattform (Vercel el.l.), ikke noe å fikse i denne koden. Allerede notert i README som gjenstående ved deploy.
- Ikke gjort her, vurder separat: Content-Security-Policy-header (går utover det som er eksplisitt krevd av kildedokumentet, men styrker Art. 32 ytterligere).

## Art. 44–49 — Overføring utenfor EØS

- ✅ **Verifisert.** Anthropics DPA inkorporerer EUs standardkontraktsklausuler (SCC Module Two, controller-til-prosessor) for overføring til USA. Dekket automatisk av samme DPA som Art. 28 over — ingen egen avtale å inngå. Personvernerklæring-utkastet er oppdatert med dette konkret i stedet for placeholder.

## Anthropic-spesifikt

- ✅ Ingen overclaiming i kode-kommentarer (`lib/anthropic.ts` sier allerede riktig at Anthropic tilbyr zero-retention som noe å avklare, ikke noe som er aktivert).
- ❌ DPA-signering — se Art. 28 over.

## Loggpolicy (anbefalt praksis)

- 🛠️ Filnavn ikke lenger logget (var det konkrete bruddet).
- ✅ Øvrig logging var allerede trygg: kode, tokens, kostnad, dato — nå supplert med forespørsels-ID for korrelasjon uten å røpe innhold.

## Brukertransparens / Personvernerklæring

- 📝 Se Art. 13/14 over — samme utkast dekker dette.

## Datominimering

- Vurdert og bevisst **ikke** implementert: å fjerne telefonnummer/e-post/signaturer fra PDF-en før den sendes til Claude ville krevd en egen PDF-parsing/redigerings-pipeline (ikke-trivielt, og radioen sier selv «kun hvis det ikke reduserer analysekvaliteten» — å redigere en PDF før native lesing er høy kompleksitet for usikker gevinst siden Claude uansett må lese hele dokumentet for å gjøre jobben sin). Vurdert som ute av scope for denne branchen. Merk også: `adresse`-feltet i `external-data-enrichment`-branchen er et bevisst *unntak* fra minimering — adressen trengs aktivt til prisberikelsen, og hentes uansett fra dokumentet av Claude, ikke fra en ny kilde.

## Påstander appen ikke skal gjøre

- ✅ Ingen "vi er GDPR-compliant"-påstand noe sted i kode eller UI-tekst i dag.
- ✅ Disclaimeren i `app/page.tsx` er forsiktig formulert allerede ("ikke profesjonell rådgivning").
- 📝 Personvernerklæring-utkastet følger samme prinsipp eksplisitt.

---

## Oppsummert: hva gjenstår (kan ikke løses i denne branchen)

1. **Bekrefte at Anthropic-kontoen kjører under Commercial Terms of Service** (ikke konsument-/personlig plan) + lagre kopi av ToS+DPA som dokumentasjon. Ikke lenger en signeringsjobb — kun en bekreftelse. Se Art. 28 over.
2. **Fylle inn reelt firmainnhold** i utkastene (org.nr, adresse, kontakt-e-post, ev. databehandleransvarlig) — markert med `[SETT INN: ...]` i utkastene.
3. **Advokat-/personvernfaglig gjennomgang** av personvernerklæring, vilkår og hele databehandlingsmodellen før kommersiell lansering — eksplisitt krevd av kildedokumentet selv, ikke noe jeg kan erstatte.
4. **Koble personvernerklæring/vilkår inn som faktiske sider i appen** — bevisst utsatt til punkt 2–3 er avklart, for å unngå å publisere noe som ser "ferdig" ut før det faktisk er det.
5. **Oppdatere personvernerklæringen med Kartverket/SSB som tredjeparter** når/hvis `external-data-enrichment` merges inn — den branchen er ikke inkludert her.
