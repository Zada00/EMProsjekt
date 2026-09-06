/**
 * OpenRouter-motoren: testlab for å måle andre modeller mot Claude-fasiten.
 *
 * Konfig i .env.local:
 *   ENGINE=openrouter
 *   OPENROUTER_API_KEY=sk-or-...          (fra openrouter.ai)
 *   OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
 *
 * Bytt kandidat ved å endre OPENROUTER_MODEL – f.eks.
 *   openai/gpt-oss-120b:free, meta-llama/llama-4-maverick:free
 *
 * VIKTIG: gratismodeller kan bruke data til trening – KUN testdokumenter
 * (FINN-nedlastinger), aldri ekte kundedata gjennom denne motoren.
 */

export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b:free";
const API_KEY = process.env.OPENROUTER_API_KEY;
const URL = "https://openrouter.ai/api/v1/chat/completions";

export async function analyserMedOpenRouter(
  system: string,
  bruker: string,
  schema: object,
  modell: string = OPENROUTER_MODEL // overstyres av testlab-scriptet; route.ts bruker env
): Promise<{ resultat: unknown; leverandor: string; tokens: { inn: number; ut: number } }> {
  if (!API_KEY) {
    throw new Error("OPENROUTER_API_KEY mangler i .env.local (hent på openrouter.ai).");
  }

  // Forsøk 1: structured output (json_schema). Ikke alle gratismodeller
  // støtter det – da faller vi tilbake til instruert JSON + rensing.
  let res = await kall(system, bruker, {
    type: "json_schema",
    json_schema: { name: "lever_rapport", schema },
  }, modell);

  if (!res.ok) {
    const feiltekst = await res.text().catch(() => "");
    if (res.status === 400 && /response_format|json_schema|structured/i.test(feiltekst)) {
      res = await kall(
        system +
          "\n\nSVAR KUN med ett gyldig JSON-objekt som følger dette skjemaet, uten annen tekst:\n" +
          JSON.stringify(schema),
        bruker,
        undefined,
        modell
      );
      if (!res.ok) throw await tilFeil(res, undefined, modell);
    } else {
      throw await tilFeil(res, feiltekst, modell);
    }
  }

  const data = await res.json();
  const valg = data?.choices?.[0];
  const content: string | undefined = valg?.message?.content;

  if (!content) {
    /**
     * Tomt svar med HTTP 200. Uten detaljer er dette umulig å feilsøke, så vi
     * graver ut det leverandøren faktisk sier.
     *
     * De vanligste årsakene, i erfart rekkefølge:
     *  – finish_reason "length": modellen brukte hele budsjettet på resonnering
     *    og rakk aldri å skrive svaret. Typisk for reasoning-modeller på store
     *    skjemaer. Løses med høyere max_tokens.
     *  – innholdet ligger i "reasoning" i stedet for "content".
     *  – leverandøren avviste structured output uten å si fra med en feilkode.
     */
    const detaljer = {
      finish_reason: valg?.finish_reason ?? null,
      native_finish_reason: valg?.native_finish_reason ?? null,
      melding_nokler: valg?.message ? Object.keys(valg.message) : [],
      reasoning_lengde: typeof valg?.message?.reasoning === "string" ? valg.message.reasoning.length : 0,
      usage: data?.usage ?? null,
      leverandor: data?.provider ?? "ukjent",
      feil: data?.error ?? null,
    };
    console.error(`[openrouter] tomt svar fra ${modell}:`, JSON.stringify(detaljer, null, 2));

    const hint =
      detaljer.finish_reason === "length"
        ? " Modellen brukte hele token-budsjettet uten å levere svar – prøv høyere OPENROUTER_MAX_TOKENS."
        : detaljer.reasoning_lengde > 0
          ? ` Modellen produserte ${detaljer.reasoning_lengde} tegn resonnering, men ingen svartekst.`
          : "";
    throw new Error(
      `Tomt svar fra ${modell} (finish_reason: ${detaljer.finish_reason ?? "ukjent"}).${hint}`
    );
  }

  // Rens (samme lærdom som fra Ollama): gjerder og løstekst utenfor klammene
  let renset = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = renset.indexOf("{");
  const slutt = renset.lastIndexOf("}");
  if (start >= 0 && slutt > start) renset = renset.slice(start, slutt + 1);

  let resultat: unknown;
  try {
    resultat = JSON.parse(renset);
  } catch {
    console.error(
      "[openrouter] ugyldig JSON fra", modell,
      "| starter med:", JSON.stringify(content.slice(0, 200))
    );
    throw new Error(`${modell} leverte ikke gyldig JSON (detaljer i serverloggen).`);
  }

  return {
    resultat,
    // Leverandøren varierer mellom kall for samme modell – og det er nettopp
    // ruting til småkontekst-endepunkter som forårsaket de amputerte analysene.
    // Logg den, så er neste rutingproblem synlig med én gang.
    leverandor: data?.provider ?? "ukjent",
    tokens: {
      inn: data?.usage?.prompt_tokens ?? 0,
      ut: data?.usage?.completion_tokens ?? 0,
    },
  };
}

async function kall(
  system: string,
  bruker: string,
  response_format: object | undefined,
  modell: string
) {
  return fetch(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "BoligCopilot testlab",
    },
    body: JSON.stringify({
      model: modell,
      temperature: 0,
      seed: 42, // reduserer kjøring-til-kjøring-variasjon der leverandøren støtter det
      /**
       * Eksplisitt takhøyde. Uten dette gjelder leverandørens standard, som kan
       * være langt lavere enn skjemaet vårt trenger – og en reasoning-modell kan
       * bruke opp hele budsjettet på tenking før den rekker å skrive svaret.
       * Skjemaet vokste fra 10 til 18 felter i v4; 16000 speiler Claude-grenen.
       */
      max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS ?? 16000),
      /**
       * Skru AV context compression. OpenRouter bruker den som standard på
       * endepunkter med ≤8k kontekst, og den fjerner innhold FRA MIDTEN av
       * prompten. Vi vil aldri ha stille komprimering av en tilstandsrapport –
       * heller en tydelig feil enn en amputert analyse av boligen noen kjøper.
       *
       * NB: dette var IKKE årsaken til de ufullstendige analysene (se under).
       * Innstillingen står fordi den er riktig i seg selv, ikke som en fiks.
       *
       * MÅLT – "lost in the middle", ikke transport:
       * Noen kjøringer analyserer kun s. 1–2 og 8–11 og påstår i sammendraget
       * at s. 3–7 "mangler i dokumentet". Men:
       *   – input-tokens er identisk (12 364) i gode og dårlige kjøringer
       *   – leverandøren er Nvidia i samtlige, ingen ruting-variasjon
       *   – pdfTilTekst leverer alle 11 sider (s. 3: 2076 tegn, s. 6: 3459 tegn)
       * Modellen FÅR hele dokumentet, mister midten under lesing, og
       * konfabulerer så en forklaring på hvorfor analysen ble kort.
       *
       * Feilraten er IKKE en stabil egenskap ved modellen:
       *   25.07 kl. 01–04 UTC: 12 av 29 kjøringer kollapset (41 %)
       *   26.07 kl. 11–13 UTC:  2 av 29 kjøringer kollapset (7 %)
       * Identisk prompt, modell, leverandør og dokument. Forskjellen er
       * signifikant (p ≈ 0,002) og skyldes trolig last på gratisendepunktet.
       * Konsekvens: du kan ikke love en bruker noe om hvilken dag de treffer.
       * Derfor forkaster dekningsvakten (lib/dekningsvakt.ts) slike analyser
       * per kjøring, og konsensusen fanger resten.
       */
      plugins: [{ id: "context-compression", enabled: false }],

      ...(response_format ? { response_format } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: bruker },
      ],
    }),
  });
}

async function tilFeil(
  res: Response,
  forlest?: string,
  modell: string = OPENROUTER_MODEL
): Promise<Error> {
  const detalj = forlest ?? (await res.text().catch(() => ""));
  if (res.status === 429) {
    return new Error("OpenRouter: rate-limit truffet (gratiskvoten er 50 kall/dag, ~20/min). Vent litt.");
  }
  if (res.status === 404) {
    return new Error(`Modellen "${modell}" finnes ikke (gratislisten roterer – sjekk openrouter.ai/models).`);
  }
  return new Error(`OpenRouter svarte ${res.status}: ${detalj.slice(0, 300)}`);
}
