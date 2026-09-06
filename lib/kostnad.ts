/**
 * Kostnadslogging: leser usage-feltet fra hvert Anthropic-svar og logger
 * faktisk kostnad per analyse + løpende sum per dag. Gir ekte tall til
 * pitch og prising ("en analyse koster oss X").
 *
 * Priser i USD per million tokens. MÅ oppdateres ved modellbytte – ellers
 * lyver loggen, og den brukes til prising og pitch.
 *
 * ⚠️ IKKE VERIFISERT for claude-sonnet-5: verdiene under er arvet fra
 * sonnet-4-6. Slå opp gjeldende priser på anthropic.com/pricing og rett dem,
 * eller overstyr med PRIS_INPUT_USD / PRIS_OUTPUT_USD i .env.local.
 */

import { PROMPT_VERSJON } from "./prompt";

const PRIS_INPUT_USD = Number(process.env.PRIS_INPUT_USD ?? 3);
const PRIS_OUTPUT_USD = Number(process.env.PRIS_OUTPUT_USD ?? 15);
const USD_TIL_NOK = Number(process.env.USD_NOK ?? 10.5);

let dagsSum = { dato: "", nok: 0, antall: 0 };

export function loggKostnad(
  kode: string,
  filnavn: string,
  usage: { input_tokens: number; output_tokens: number } | undefined
) {
  if (!usage) return;
  const usd =
    (usage.input_tokens * PRIS_INPUT_USD + usage.output_tokens * PRIS_OUTPUT_USD) / 1_000_000;
  const nok = usd * USD_TIL_NOK;

  const idag = new Date().toISOString().slice(0, 10);
  if (dagsSum.dato !== idag) dagsSum = { dato: idag, nok: 0, antall: 0 };
  dagsSum.nok += nok;
  dagsSum.antall += 1;

  console.log(
    `[kostnad] kode=${kode} prompt=${PROMPT_VERSJON} fil="${filnavn}" in=${usage.input_tokens} ut=${usage.output_tokens} ≈ ${nok.toFixed(2)} kr | i dag: ${dagsSum.antall} analyser ≈ ${dagsSum.nok.toFixed(2)} kr`
  );
}
