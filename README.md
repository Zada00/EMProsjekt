# BoligCopilot (MVP)

BoligCopilot er en enkel fullstack webapplikasjon for boligkjøpere. Den hjelper brukere med å forstå salgsoppgaver og tilstandsrapporter på enkelt norsk.

## Funksjoner

- Last opp salgsoppgave eller tilstandsrapport som tekst
- Få en kort forklaring fra AI-rådgiveren
- Spør om TG-avvik, servitutter, ferdigattest, tekniske risikoer og fremtidige kostnader

## Teknologi

- Frontend: React + Vite
- Backend: Express
- AI-API: Enkel wrapper for OpenAI/liknende

## Komme i gang

1. Naviger til prosjektmappen:
   ```bash
   cd c:\EMProsjekt
   ```
2. Installer avhengigheter:
   ```bash
   npm install
   ```
3. Start utviklingsmiljøet:
   ```bash
   npm run dev
   ```

Dette starter både frontend og backend. Nettleseren åpner Vite på en port som vises i terminalen, vanligvis `http://localhost:5173` eller `http://localhost:5174` hvis `5173` er opptatt.

### Kjøre produksjon

For å bygge og starte produksjonsserveren:

```bash
npm start
```

Dette bygger frontend og starter `server.js` på `http://localhost:4000`.

## Miljøvariabler

Kopier `./.env.example` til `./.env` og fyll inn din OpenAI API-nøkkel:

```env
OPENAI_API_KEY=din_api_nøkkel
```

Uten denne variabelen vil backend returnere feilen `OPENAI_API_KEY er ikke konfigurert.`

## MVP-funksjonalitet

BoligCopilot kan nå:

- Forklare salgsoppgave og tilstandsrapport på vanlig norsk
- Finne tekniske risikoer og avvik
- Lage spørsmål til visning
- Estimere potensielle fremtidige kostnader
