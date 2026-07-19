/**
 * Tekstuttrekk fra PDF – for tekstmodeller (OpenRouter/Ollama) som ikke leser PDF direkte.
 *
 * [Side N]-markørene gjør at modellen fortsatt kan oppgi sidetall i "kilde" –
 * kildehenvisningen er produktets viktigste tillitsfunksjon og skal ikke ofres
 * ved motorbytte. (Verifisert mot ekte rapporter i Ollama-eksperimentet.)
 *
 * Begrensning: rene bildeskann gir (nesten) tom tekst – route.ts avviser da
 * med tydelig melding i stedet for å analysere ingenting.
 */
// @ts-expect-error – pdf-parse mangler typedefinisjoner for denne stien
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function pdfTilTekst(buf: Buffer): Promise<string> {
  let side = 0;
  const res = await pdfParse(buf, {
    pagerender: async (pageData: { getTextContent: () => Promise<{ items: { str: string }[] }> }) => {
      side += 1;
      const tc = await pageData.getTextContent();
      const tekst = tc.items.map((i) => i.str).join(" ");
      return `\n\n[Side ${side}]\n${tekst}`;
    },
  });
  return (res.text as string).trim();
}
