import { z } from "zod";

/**
 * Datakontrakten for hva vi trekker ut av en tilstandsrapport.
 *
 * To ting lever her, og de MÅ holdes i sync:
 *  1. `rapportSchema`     – zod-validering som kjører på svaret fra Claude (runtime-sikkerhet).
 *  2. `rapportJsonSchema` – JSON Schema som sendes til Claude som "tool", slik at modellen
 *                            tvinges til å svare i akkurat dette formatet (structured output).
 *
 * Prinsipp mot hallusinasjon: hvert sentralt funn bærer en `kilde` (sidetall/seksjon),
 * og felt som ikke finnes settes til null + legges i `ikke_funnet`. Vi gjetter aldri.
 *
 * Eier: Prompt Engineer (Utvikler 4), i samarbeid med Tech Lead.
 */

export const avvikSchema = z.object({
  tg: z.number().int().min(0).max(3), // Tilstandsgrad. Vi bryr oss mest om 2 og 3.
  bygningsdel: z.string(), // f.eks. "Våtrom/bad", "Tak", "Drenering"
  beskrivelse: z.string(),
  anbefalt_tiltak: z.string().nullable(),
  kilde: z.string(), // f.eks. "s. 24" eller "Pkt 5.3 Bad"
});

export const servituttSchema = z.object({
  type: z.string(), // f.eks. "Veirett", "Ledningsrett"
  beskrivelse: z.string(),
  kilde: z.string(),
});

export const ferdigattestSchema = z.object({
  status: z.enum([
    "ferdigattest",
    "midlertidig_brukstillatelse",
    "mangler",
    "ukjent",
  ]),
  kommentar: z.string().nullable(),
  kilde: z.string().nullable(),
});

export const rapportSchema = z.object({
  boligtype: z.string().nullable(),
  byggeaar: z.number().int().nullable(),
  bruksareal_bra_m2: z.number().nullable(),
  primaerrom_prom_m2: z.number().nullable(),
  ferdigattest: ferdigattestSchema,
  kommunale_avgifter_per_aar_nok: z.number().nullable(),
  avvik: z.array(avvikSchema),
  tinglyste_servitutter: z.array(servituttSchema),
  sammendrag: z.string(), // 2-4 nøytrale setninger. Ingen salgsspråk.
  ikke_funnet: z.array(z.string()), // felt modellen IKKE klarte å finne i dokumentet
});

export type Rapport = z.infer<typeof rapportSchema>;
export type Avvik = z.infer<typeof avvikSchema>;

/**
 * JSON Schema-speilet av zod-skjemaet over. Sendes til Claude som verktøy-definisjon.
 * Holdes manuelt i sync med rapportSchema (lite nok til at det er greit i en PoC).
 */
export const rapportJsonSchema = {
  type: "object" as const,
  properties: {
    boligtype: {
      type: ["string", "null"],
      description: "Type bolig, f.eks. 'Enebolig', 'Leilighet', 'Rekkehus'.",
    },
    byggeaar: { type: ["integer", "null"], description: "Byggeår som tall." },
    bruksareal_bra_m2: {
      type: ["number", "null"],
      description: "Bruksareal (BRA) i kvadratmeter.",
    },
    primaerrom_prom_m2: {
      type: ["number", "null"],
      description: "Primærrom (P-rom) i kvadratmeter.",
    },
    ferdigattest: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [
            "ferdigattest",
            "midlertidig_brukstillatelse",
            "mangler",
            "ukjent",
          ],
        },
        kommentar: { type: ["string", "null"] },
        kilde: {
          type: ["string", "null"],
          description: "Sidetall eller seksjon der dette står.",
        },
      },
      required: ["status", "kommentar", "kilde"],
    },
    kommunale_avgifter_per_aar_nok: {
      type: ["number", "null"],
      description: "Kommunale avgifter per år i NOK, hvis oppgitt.",
    },
    avvik: {
      type: "array",
      description:
        "Alle registrerte avvik. Ta med TG2 og TG3 alltid. TG0/TG1 kan utelates hvis de ikke er relevante.",
      items: {
        type: "object",
        properties: {
          tg: {
            type: "integer",
            minimum: 0,
            maximum: 3,
            description: "Tilstandsgrad slik den står i rapporten.",
          },
          bygningsdel: { type: "string" },
          beskrivelse: { type: "string" },
          anbefalt_tiltak: { type: ["string", "null"] },
          kilde: {
            type: "string",
            description: "Sidetall eller punkt, f.eks. 's. 24' eller 'Pkt 5.3'.",
          },
        },
        required: ["tg", "bygningsdel", "beskrivelse", "anbefalt_tiltak", "kilde"],
      },
    },
    tinglyste_servitutter: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          beskrivelse: { type: "string" },
          kilde: { type: "string" },
        },
        required: ["type", "beskrivelse", "kilde"],
      },
    },
    sammendrag: {
      type: "string",
      description: "2-4 nøytrale setninger. Ikke bruk salgsspråk.",
    },
    ikke_funnet: {
      type: "array",
      items: { type: "string" },
      description:
        "Navn på felt du IKKE klarte å finne i dokumentet. Tomt array hvis alt ble funnet.",
    },
  },
  required: [
    "boligtype",
    "byggeaar",
    "bruksareal_bra_m2",
    "primaerrom_prom_m2",
    "ferdigattest",
    "kommunale_avgifter_per_aar_nok",
    "avvik",
    "tinglyste_servitutter",
    "sammendrag",
    "ikke_funnet",
  ],
} as const;
