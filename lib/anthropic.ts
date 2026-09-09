import Anthropic from "@anthropic-ai/sdk";

/**
 * Sentral oppsett av Anthropic-klienten.
 *
 * Modellvalg (per nå):
 *  - claude-sonnet-5  -> standard. Arbeidshesten for rapportanalysen.
 *  - claude-opus-5    -> for vanskelige eller utydelige rapporter der Sonnet bommer.
 *
 * Bytt modell via miljøvariabel ANTHROPIC_MODEL uten å endre kode.
 *
 * Priser (USD per million tokens, verifisert 09.09.2026):
 *   sonnet-5: $2 inn / $10 ut  –  opus-5: $5 inn / $25 ut
 * De ligger i en tabell i lib/kostnad.ts og følger modellvalget automatisk.
 * Bytter du til en modell som ikke står i tabellen, sier loggen fra.
 *
 * MERK: en ny modell er en like stor endring som en ny prompt – fasiten må
 * kjøres på nytt.
 *
 * GDPR-merk: legg en databehandleravtale (DPA) i bunn før dere kjører ekte
 * persondata gjennom dette. Anthropic tilbyr zero-retention for API – avklar dette
 * tidlig (det var et av punktene fra strategifasen).
 */

if (!process.env.ANTHROPIC_API_KEY) {
    // Kastes ved oppstart i dev hvis nøkkel mangler – bedre enn en kryptisk 500 senere.
    console.warn(
        "[em-copilot] ANTHROPIC_API_KEY er ikke satt. Kopier .env.example til .env.local og fyll inn nøkkelen."
    );
}

export const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
