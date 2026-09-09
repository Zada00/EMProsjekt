/**
 * Kostnadslogging: leser usage-feltet fra hvert Anthropic-svar og logger
 * faktisk kostnad per analyse + løpende sum per dag. Gir ekte tall til
 * pitch og prising ("en analyse koster oss X").
 *
 * Prisene ligger i en tabell per modell, ikke som to konstanter. Grunnen er at
 * konstanter må huskes oppdatert ved hvert modellbytte – og glemmer man det,
 * lyver loggen uten å si fra. Med en tabell følger prisen modellen automatisk.
 *
 * USD per million tokens, hentet fra platform.claude.com/docs/en/about-claude/pricing
 * (verifisert 09.09.2026). Ukjent modell logges med en tydelig advarsel i stedet
 * for å bruke et gjettet tall.
 */

import { MODEL } from "./anthropic";
import { PROMPT_VERSJON } from "./prompt";

const PRISER: Record<string, { inn: number; ut: number }> = {
  "claude-sonnet-5": { inn: 2, ut: 10 },
  "claude-opus-5": { inn: 5, ut: 25 },
  "claude-haiku-4-5-20251001": { inn: 1, ut: 5 },
  // Eldre modeller, for sammenligning hvis noen ruller tilbake:
  "claude-sonnet-4-6": { inn: 3, ut: 15 },
  "claude-opus-4-8": { inn: 5, ut: 25 },
};

const USD_TIL_NOK = Number(process.env.USD_NOK ?? 10.5);

let dagsSum = { dato: "", nok: 0, antall: 0 };

export function loggKostnad(
  kode: string,
  filnavn: string,
  usage: { input_tokens: number; output_tokens: number } | undefined
) {
  if (!usage) return;

  const pris = PRISER[MODEL];
  if (!pris) {
    // Heller ingen kroneverdi enn en gal én – tallet brukes til prising.
    console.warn(
      `[kostnad] ukjent pris for modell "${MODEL}". Legg den inn i PRISER i lib/kostnad.ts. ` +
        `in=${usage.input_tokens} ut=${usage.output_tokens}`
    );
    return;
  }

  const usd = (usage.input_tokens * pris.inn + usage.output_tokens * pris.ut) / 1_000_000;
  const nok = usd * USD_TIL_NOK;

  const idag = new Date().toISOString().slice(0, 10);
  if (dagsSum.dato !== idag) dagsSum = { dato: idag, nok: 0, antall: 0 };
  dagsSum.nok += nok;
  dagsSum.antall += 1;

  console.log(
    `[kostnad] kode=${kode} modell=${MODEL} prompt=${PROMPT_VERSJON} fil="${filnavn}" ` +
      `in=${usage.input_tokens} ut=${usage.output_tokens} ≈ ${nok.toFixed(2)} kr | ` +
      `i dag: ${dagsSum.antall} analyser ≈ ${dagsSum.nok.toFixed(2)} kr`
  );
}
