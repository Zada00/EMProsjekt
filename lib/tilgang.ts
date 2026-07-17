/**
 * Tilgangskontroll for pilot: invitasjonskoder + rate-limit + dagskvote.
 *
 * Konfig i .env.local:
 *   ACCESS_CODES=pilot-kunde1,pilot-kunde2   (kommaseparert; én kode per kunde)
 *   RATE_PER_MIN=6                            (analyser per minutt per kode)
 *   QUOTA_PER_DAY=40                          (analyser per dag per kode)
 *
 * Er ACCESS_CODES tom/usatt, er appen åpen (lokal utvikling).
 *
 * Merk: telleren lever i minne – den nullstilles ved restart og deles ikke
 * mellom flere serverinstanser. Helt greit for pilot med én instans; byttes
 * mot Redis e.l. hvis dere skalerer.
 */

const KODER = (process.env.ACCESS_CODES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const RATE = Number(process.env.RATE_PER_MIN ?? 6);
const KVOTE = Number(process.env.QUOTA_PER_DAY ?? 40);

type Spor = { minutt: number[]; dag: { dato: string; antall: number } };
const bruk = new Map<string, Spor>();

export function sjekkTilgang(
  kode: string | null
): { ok: true; kode: string } | { ok: false; status: number; feil: string } {
  if (KODER.length === 0) return { ok: true, kode: "åpen" }; // dev-modus

  if (!kode || !KODER.includes(kode)) {
    return { ok: false, status: 401, feil: "Ugyldig eller manglende tilgangskode." };
  }

  const naa = Date.now();
  const idag = new Date().toISOString().slice(0, 10);
  const s = bruk.get(kode) ?? { minutt: [], dag: { dato: idag, antall: 0 } };

  s.minutt = s.minutt.filter((t) => naa - t < 60_000);
  if (s.minutt.length >= RATE) {
    return { ok: false, status: 429, feil: "For mange analyser på kort tid – vent et minutt." };
  }
  if (s.dag.dato !== idag) s.dag = { dato: idag, antall: 0 };
  if (s.dag.antall >= KVOTE) {
    return { ok: false, status: 429, feil: "Dagskvoten for denne koden er brukt opp. Prøv igjen i morgen." };
  }

  s.minutt.push(naa);
  s.dag.antall += 1;
  bruk.set(kode, s);
  return { ok: true, kode };
}
