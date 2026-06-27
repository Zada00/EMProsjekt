import { NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { rapportJsonSchema, rapportSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 120; // sekunder. Store rapporter kan ta tid.

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB. Claudes PDF-grense er ~32 MB / ~100 sider.

/**
 * POST /api/analyze
 * Body: multipart/form-data med feltet "file" (PDF).
 * Svar: validert JSON som matcher rapportSchema.
 *
 * GDPR: vi skriver ALDRI PDF-en til disk eller database her. Den lever bare i minne
 * for varigheten av forespørselen, og forsvinner når funksjonen returnerer. Dette er
 * "slett-etter-bruk"-regelen fra veikartet, håndhevet i koden.
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
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      // Tving modellen til å svare via verktøyet -> garantert struktur.
      tool_choice: { type: "tool", name: "lever_rapport" },
      tools: [
        {
          name: "lever_rapport",
          description:
            "Leverer strukturert nøkkelinfo trukket ut fra tilstandsrapporten.",
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
              text: "Les denne tilstandsrapporten og lever nøkkelinfoen via verktøyet. Husk kilde (sidetall/punkt) på alle funn, og ALLE TG2/TG3-avvik.",
            },
          ],
        },
      ],
    });

    // Finn verktøykallet i svaret (ikke anta rekkefølge).
    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json(
        { error: "Modellen svarte uten strukturert resultat. Prøv igjen." },
        { status: 502 }
      );
    }

    // Valider mot zod – fanger opp hvis modellen leverer noe utenfor kontrakten.
    const parsed = rapportSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Resultatet besto ikke valideringen.",
          detaljer: parsed.error.flatten(),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ rapport: parsed.data, modell: MODEL });
  } catch (err) {
    console.error("[em-copilot] analyse feilet:", err);
    return NextResponse.json(
      { error: "Analysen feilet. Sjekk API-nøkkel og serverlogg." },
      { status: 500 }
    );
  }
  // base64 og file faller ut av scope her -> ingenting lagres.
}
