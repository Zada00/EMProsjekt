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
): Promise<{ resultat: unknown; tokens: { inn: number; ut: number } }> {
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
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Tomt svar fra ${modell}.`);

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
