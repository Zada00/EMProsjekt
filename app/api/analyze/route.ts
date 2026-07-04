import { NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { rapportJsonSchema, rapportSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB. Claudes PDF-grense er ~32 MB / ~100 sider.

/**
 * POST /api/analyze
 * Body: multipart/form-data med feltet "file" (PDF).
 * Svar: validert JSON som matcher rapportSchema (kjøper-forklaring).
 *
 * GDPR: vi skriver ALDRI PDF-en til disk eller database. Den lever bare i minne
 * for varigheten av forespørselen og forsvinner når funksjonen returnerer.
 */
export async function POST(request: Request) {
    let file: File | null = null;
    try {
        const formData = await request.formData();
        file = formData.get("file") as File | null;
    } catch {
        return NextResponse.json(
            { error: "Klarte ikke å lese opplastingen. Send en PDF som multipart/form-data." },
            { status: 400 }
        );
    }

    if (!file) {
        return NextResponse.json({ error: "Ingen fil mottatt." }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
        return NextResponse.json(
            { error: "Kun PDF støttes i denne versjonen." },
            { status: 415 }
        );
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json(
            { error: "Filen er for stor (maks 25 MB). Store/skannede rapporter krever OCR – se README." },
            { status: 413 }
        );
    }

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

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
                        {
                            type: "document",
                            source: { type: "base64", media_type: "application/pdf", data: base64 },
                        },
                        {
                            type: "text",
                            text: "Les dette dokumentet og forklar det for meg som boligkjøper via verktøyet. Husk kilde på alt, oversett fagord til vanlig norsk, og ingen presise kronebeløp.",
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
