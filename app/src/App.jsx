import { useState } from 'react';
import './App.css';

const taskOptions = [
  { value: 'overview', label: 'Forklar hele dokumentet' },
  { value: 'risks', label: 'Finn risikoer og avvik' },
  { value: 'viewingQuestions', label: 'Lag spørsmål til visning' },
  { value: 'costs', label: 'Estimer potensielle kostnader' },
];

const taskPlaceholders = {
  overview: 'Spør om nøkkelfunn eller be om generell forklaring.',
  risks: 'Be om hvilke risikoer eller TG-avvik som er viktigst.',
  viewingQuestions: 'Be om spørsmål du kan stille på visning.',
  costs: 'Be om hva som kan koste penger i framtiden.',
};

function App() {
  const [documentText, setDocumentText] = useState('');
  const [taskType, setTaskType] = useState('overview');
  const [question, setQuestion] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setExplanation('');

    try {
      const response = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentText, taskType, question }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Feil ved AI-forespørsel');
      }
      setExplanation(data.explanation);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header>
        <h1>BoligCopilot</h1>
        <p>Les salgsoppgave og tilstandsrapport, og få en forklaring på vanlig norsk.</p>
      </header>

      <main>
        <section className="panel">
          <h2>Dokumenttekst</h2>
          <textarea
            value={documentText}
            onChange={(event) => setDocumentText(event.target.value)}
            placeholder="Lim inn tekst fra salgsoppgave eller tilstandsrapport her..."
          />

          <div className="form-row">
            <label htmlFor="taskType">Velg oppgave</label>
            <select
              id="taskType"
              value={taskType}
              onChange={(event) => setTaskType(event.target.value)}
            >
              {taskOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <label htmlFor="question">Tilpasset spørsmål (valgfritt)</label>
          <input
            id="question"
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={taskPlaceholders[taskType]}
          />

          <button type="submit" onClick={handleSubmit} disabled={loading || !documentText.trim()}>
            {loading ? 'Venter på AI...' : 'Analyse og forklaring'}
          </button>

          {error && <div className="error">{error}</div>}
        </section>

        <section className="panel result-panel">
          <h2>AI-forklaring</h2>
          <div className="result">
            {explanation ? <p>{explanation}</p> : <p>Her vises resultatet fra BoligCopilot.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
