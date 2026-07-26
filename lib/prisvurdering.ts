import type { Prisstatistikk } from "@/lib/ssb";

/**
 * Ren beregningslogikk (ingen nettverk) – skilt ut fra route.ts for å kunne
 * enhetstestes uten å mocke fetch. Sammenligner boligens kr/m² (prisantydning
 * delt på BRA) mot kommunesnittet fra SSB.
 */
export type PrisVurdering = Prisstatistikk & {
    egenKrPerM2: number | null;
    avvikProsent: number | null;
};

export function beregnPrisvurdering(
    stat: Prisstatistikk,
    prisantydning: number | null | undefined,
    bruksarealM2: number | null | undefined
): PrisVurdering {
    if (!prisantydning || !bruksarealM2 || bruksarealM2 <= 0) {
        return { ...stat, egenKrPerM2: null, avvikProsent: null };
    }
    const egenKrPerM2 = Math.round(prisantydning / bruksarealM2);
    const avvikProsent = Math.round(((egenKrPerM2 - stat.krPerM2) / stat.krPerM2) * 100);
    return { ...stat, egenKrPerM2, avvikProsent };
}
