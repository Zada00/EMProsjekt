import express from 'express';
import axios from 'axios';

const router = express.Router();

const taskDescriptions = {
  overview: 'Gi en lettforståelig forklaring av dokumentet på vanlig norsk, og oppsummer de viktigste funnene for boligkjøperen.',
  risks: 'Finn og forklar risikoer, TG-avvik, servitutter, ferdigattester og andre tekniske problemer som kan gi utfordringer.',
  viewingQuestions: 'Lag en konkret liste over spørsmål boligkjøperen bør stille på visning basert på dokumentet.',
  costs: 'Estimer potensielle fremtidige kostnader og nødvendige oppgraderinger som boligkjøperen bør være forberedt på.',
};

const buildPrompt = (documentText, taskType, question) => {
  const taskText = taskDescriptions[taskType] || taskDescriptions.overview;
  const extraQuestion = question?.trim() ? question : 'Ingen ekstra spørsmål.';

  return `Du er BoligCopilot, en hjelpsom norsk AI-rådgiver for boligkjøpere. Les salgsoppgaver og tilstandsrapporter, og svar på oppgaven nedenfor.

Dokument:
${documentText}

Oppgave:
${taskText}

Tilleggsoppgave:
${extraQuestion}

Svar i korte punkter, bruk enkelt språk og forklar hva boligkjøperen bør vite.
`;
};

const fallbackExplanation = (text, taskType) => {
  const lower = text.toLowerCase();
  const lines = [];

  if (taskType === 'overview') {
    lines.push('Dette ser ut som en selveid, arkitekttegnet enebolig fra 2007.');
    if (lower.includes('utleie')) {
      lines.push('Boligen har utleiedel, noe som kan gi ekstra inntekt.');
    }
    if (/200[0-9]/.test(lower)) {
      lines.push('Byggeår er rundt 2000-tallet, noe som ofte betyr moderne standard fra den perioden.');
    }
    if (lower.includes('vannbåren gulvvarme')) {
      lines.push('Gulvvarme er vannbåren, som gir jevn varme og høy komfort.');
    }
    if (lower.includes('dobbelgarasje')) {
      lines.push('Det finnes dobbelgarasje, som gir god parkeringsplass og lagringsmuligheter.');
    }
    if (lower.includes('uteplasser')) {
      lines.push('Det er fine, solrike uteplasser som gir godt uterom.');
    }
  }

  if (taskType === 'risks') {
    lines.push('Sjekk kvalitet og vedlikehold av vannbåren varme, especially older systems.');
    if (lower.includes('utleie')) {
      lines.push('Utleie gir inntekt, men husk å kontrollere at det er godkjent og tilfredsstillende etasjeadskillelse.');
    }
  }

  if (taskType === 'viewingQuestions') {
    lines.push('Spør om hvor utleiedelen er, og om den er godkjent av kommunen.');
    lines.push('Spør om alder og vedlikehold på vannbåren gulvvarme.');
    lines.push('Spør om vedlikehold av garasje og uteplasser.');
  }

  if (taskType === 'costs') {
    lines.push('Vannbåren varme kan ha vedlikeholdskostnader; sjekk pumpe og rør.');
    if (lower.includes('utleie')) {
      lines.push('Utleie kan gi ekstra inntekt, men også ekstra vedlikehold.');
    }
  }

  if (!lines.length) {
    lines.push('Teksten inneholder lite informasjon, men husk å spørre om tilstand, alder og vedlikehold.');
  }

  return lines.join(' ');
};

router.post('/explain', async (req, res) => {
  const { documentText, taskType = 'overview', question = '' } = req.body;

  if (!documentText || !documentText.trim()) {
    return res.status(400).json({ error: 'documentText er påkrevd.' });
  }

  const prompt = buildPrompt(documentText, taskType, question);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const explanation = fallbackExplanation(documentText, taskType);
    return res.json({
      explanation: `MERK: OpenAI API-nøkkel er ikke konfigurert. Her er en enkel forklaring basert på dokumentteksten:\n\n${explanation}`,
    });
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Du er en nyttig assistent som forklarer norske eiendomsdokumenter.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const explanation = response.data.choices?.[0]?.message?.content || 'Ingen respons fra AI.';
    res.json({ explanation });
  } catch (error) {
    const apiError = error?.response?.data?.error;
    console.error(apiError || error.message || error);

    if (apiError?.code === 'insufficient_quota') {
      const explanation = fallbackExplanation(documentText, taskType);
      return res.json({
        explanation: `AI-kvota er brukt opp. Her er en enkel forklaring uten OpenAI:\n\n${explanation}`,
      });
    }

    const message = apiError?.message || error.message || 'Kunne ikke hente forklaring fra AI.';
    res.status(500).json({ error: message });
  }
});

export default router;
