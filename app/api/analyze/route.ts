import { NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";
import { loggKostnad } from "@/lib/kostnad";
import { analyserMedOpenRouter, OPENROUTER_MODEL } from "@/lib/openrouter";
import { pdfTilTekst } from "@/lib/pdftext";
import { sjekkTilgang } from "@/lib/tilgang";

// Motorvalg: "anthropic" (standard) | "openrouter" (testlab for andre modeller)
const ENGINE = process.env.ENGINE ?? "anthropic";
import { SYSTEM_PROMPT, TEKSTMOTOR_REGLER } from "@/lib/prompt";
import { rapportJsonSchema, rapportSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per fil.
const MAX_TOTAL = 30 * 1024 * 1024; // ~30 MB samlet (API-grensen er ~32 MB per forespørsel).

/**
 * POST /api/analyze
 * Body: multipart/form-data med feltet "file" (PDF).
 * Svar: validert JSON som matcher rapportSchema (kjøper-forklaring).
 *
 * GDPR: vi skriver ALDRI PDF-en til disk eller database. Den lever bare i minne
 * for varigheten av forespørselen og forsvinner når funksjonen returnerer.
 */
export async function POST(request: Request) {
    // Tilgangskontroll (pilot): kode i header, rate-limit og dagskvote per kode.
    const tilgang = sjekkTilgang(request.headers.get("x-tilgangskode"));
    if (!tilgang.ok) {
        return NextResponse.json({ error: tilgang.feil }, { status: tilgang.status });
    }

    let files: File[] = [];
    try {
        const formData = await request.formData();
        files = formData.getAll("file").filter((f): f is File => f instanceof File);
    } catch {
        return NextResponse.json(
            { error: "Klarte ikke å lese opplastingen. Send PDF-er som multipart/form-data." },
            { status: 400 }
        );
    }

    if (files.length === 0) {
        return NextResponse.json({ error: "Ingen filer mottatt." }, { status: 400 });
    }
    for (const f of files) {
        if (f.type !== "application/pdf") {
            return NextResponse.json(
                { error: `"${f.name}" er ikke en PDF. Kun PDF støttes i denne versjonen.` },
                { status: 415 }
            );
        }
        if (f.size > MAX_BYTES) {
            return NextResponse.json(
                { error: `"${f.name}" er for stor (maks 25 MB per fil).` },
                { status: 413 }
            );
        }
    }
    const totalt = files.reduce((sum, f) => sum + f.size, 0);
    if (totalt > MAX_TOTAL) {
        return NextResponse.json(
            { error: "Filene er samlet for store (maks ~30 MB per analyse). Prøv med færre/mindre PDF-er." },
            { status: 413 }
        );
    }

    // ===== OPENROUTER-GRENEN (testlab) =====
    if (ENGINE === "openrouter") {
        try {
            const tekster = await Promise.all(
                files.map(async (f) => pdfTilTekst(Buffer.from(await f.arrayBuffer())))
            );
            const tomme = tekster
                .map((t, i) => ({ t, navn: files[i].name }))
                .filter((x) => x.t.length < 200);
            if (tomme.length) {
                return NextResponse.json(
                    { error: `"${tomme[0].navn}" ser ut til å være et rent bildeskann uten tekstlag. Bruk Claude-motoren (ENGINE=anthropic) for skannede dokumenter.` },
                    { status: 422 }
                );
            }

            const bruker =
                (files.length > 1
                    ? `Du får ${files.length} dokumenter for SAMME bolig, adskilt under. Kilde-format: "Dok N, s. X" der X hentes fra [Side X]-markørene.\n\n` +
                      tekster.map((t, i) => `===== Dok ${i + 1}: ${files[i].name} =====\n${t}`).join("\n\n")
                    : `Sidetall står som [Side N]-markører i teksten – bruk dem i "kilde" (f.eks. "s. 12").\n\n${tekster[0]}`) +
                "\n\nForklar dette for meg som boligkjøper. Husk kilde på alt, oversett fagord, ingen presise kronebeløp.";

            const { resultat, tokens } = await analyserMedOpenRouter(
                SYSTEM_PROMPT + TEKSTMOTOR_REGLER, // skjerpede regler kun for tekstmotorer
                bruker,
                rapportJsonSchema
            );
            console.log(`[openrouter] kode=${tilgang.kode} modell=${OPENROUTER_MODEL} inn=${tokens.inn} ut=${tokens.ut}`);

            const parsed = rapportSchema.safeParse(resultat);
            if (!parsed.success) {
                console.error("[openrouter] validering feilet:", JSON.stringify(parsed.error.issues, null, 2));
                const første = parsed.error.issues[0];
                const hvor = første?.path?.join(".") || "ukjent felt";
                return NextResponse.json(
                    { error: `Resultatet fra ${OPENROUTER_MODEL} besto ikke valideringen (felt: ${hvor}). Detaljer i serverloggen.` },
                    { status: 502 }
                );
            }
            return NextResponse.json({ rapport: parsed.data, modell: `openrouter/${OPENROUTER_MODEL}` });
        } catch (err) {
            console.error("[openrouter] analyse feilet:", err);
            return NextResponse.json(
                { error: err instanceof Error ? err.message : "OpenRouter-analysen feilet." },
                { status: 500 }
            );
        }
    }

    // ===== ANTHROPIC-GRENEN (standard) =====
    const dokumentBlokker = await Promise.all(
        files.map(async (f) => ({
            type: "document" as const,
            source: {
                type: "base64" as const,
                media_type: "application/pdf" as const,
                data: Buffer.from(await f.arrayBuffer()).toString("base64"),
            },
        }))
    );

    try {
        const message = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            tool_choice: { type: "tool", name: "lever_rapport" },
            tools: [
                {
                    name: "lever_rapport",
                    description:
                        "Leverer en kjøper-vennlig forklaring av salgsoppgaven/tilstandsrapporten.",
                    input_schema: rapportJsonSchema,
                },
            ],
            messages: [
                {
                    role: "user",
                    content: [
                        ...dokumentBlokker,
                        {
                            type: "text",
                            text:
                                files.length > 1
                                    ? `Du har fått ${files.length} dokumenter (i rekkefølge: ${files.map((f, i) => `Dok ${i + 1}: ${f.name}`).join(", ")}). De skal gjelde samme bolig – les dem samlet og forklar for meg som boligkjøper via verktøyet. Husk dokumentnummer + side i kilde (f.eks. "Dok 2, s. 7"), oversett fagord, ingen presise kronebeløp.`
                                    : "Les dette dokumentet og forklar det for meg som boligkjøper via verktøyet. Husk kilde på alt, oversett fagord til vanlig norsk, og ingen presise kronebeløp.",
                        },
                    ],
                },
            ],
        });

        // Ble svaret kuttet? (skjer på svært innholdsrike rapporter)
        if (message.stop_reason === "max_tokens") {
            return NextResponse.json(
                { error: "Rapporten har så mange funn at svaret ble avkuttet. Prøv igjen – og si fra til oss, dette skal vi håndtere bedre." },
                { status: 502 }
            );
        }

        loggKostnad(tilgang.kode, files.map((f) => f.name).join(", "), message.usage);

    const toolUse = message.content.find((b) => b.type === "tool_use");
        if (!toolUse || toolUse.type !== "tool_use") {
            return NextResponse.json(
                { error: "Modellen svarte uten strukturert resultat. Prøv igjen." },
                { status: 502 }
            );
        }

        const parsed = rapportSchema.safeParse(toolUse.input);
        if (!parsed.success) {
            // Logg alt server-side så vi kan feilsøke, og gi frontend en konkret første årsak.
            console.error("[boligcopilot] validering feilet:", JSON.stringify(parsed.error.issues, null, 2));
            const første = parsed.error.issues[0];
            const hvor = første?.path?.join(".") || "ukjent felt";
            return NextResponse.json(
                {
                    error: `Resultatet besto ikke valideringen (felt: ${hvor} – ${første?.message ?? "ukjent årsak"}). Detaljer er logget i serverterminalen.`,
                    detaljer: parsed.error.flatten(),
                },
                { status: 502 }
            );
        }

        return NextResponse.json({ rapport: parsed.data, modell: MODEL });
    } catch (err) {
        console.error("[boligcopilot] analyse feilet:", err);
        return NextResponse.json(
            { error: "Analysen feilet. Sjekk API-nøkkel og serverlogg." },
            { status: 500 }
        );
    }
}
