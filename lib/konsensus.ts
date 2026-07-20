import type { Rapport } from "./schema";

/**
 * To-kjørings-konsensus for OpenRouter-motoren (uten Claude-fallback).
 *
 * Bakgrunn (Nemotron mot Sandvika-fasiten, --n=3): 2 av 3 kjøringer traff
 * 12/12 sakskomplekser, men 1 av 3 kollapset og mistet BEGGE TG3-funnene.
 * Én enkeltkjøring kan derfor ikke stoles på – men to uavhengige kjøringer
 * som er enige om det viktigste, kan. Spriker de, avgjør en tredje kjøring.
 *
 * "Enige" betyr: samme TG3-bilde (sammenslåing tillatt, f.eks. røykvarslere
 * + slokkeutstyr som ett funn) og sammenlignbar dekning (fanger kollaps i
 * antall funn). Ordlyd forventes å variere – det er konklusjonene som teller.
 */

const ord = (s: string) => new Set(s.toLowerCase().match(/[a-zæøåéü]{4,}/g) ?? []);

function delerOrd(a: string, b: string): boolean {
  const B = ord(b);
  for (const w of ord(a)) if (B.has(w)) return true;
  return false;
}

function harMotpart(x: Rapport["risikoer"][number], andre: Rapport["risikoer"]): boolean {
  return andre.some(
    (y) => delerOrd(x.tittel, y.tittel) || delerOrd(x.tittel + " " + x.forklaring, y.tittel + " " + y.forklaring)
  );
}

/** Er to analyser enige om det viktigste? */
export function erEnige(a: Rapport, b: Rapport): boolean {
  const tg3A = a.risikoer.filter((r) => r.tg === 3);
  const tg3B = b.risikoer.filter((r) => r.tg === 3);
  // Hvert TG3-funn må ha en motpart i den andre analysen – begge veier.
  if (!tg3A.every((x) => harMotpart(x, tg3B))) return false;
  if (!tg3B.every((y) => harMotpart(y, tg3A))) return false;
  // Dekningen skal være sammenlignbar (fanger kollaps fra f.eks. 14 til 5 funn).
  const [minst, mest] = [a.risikoer.length, b.risikoer.length].sort((x, y) => x - y);
  return mest === 0 || minst / mest >= 0.6;
}

/** Ved enighet: lever analysen med best dekning. */
export function velgBeste(a: Rapport, b: Rapport): Rapport {
  return b.risikoer.length > a.risikoer.length ? b : a;
}
