import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import aiRouter from './app/api/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');

dotenv.config({ path: envPath });

if (!process.env.OPENAI_API_KEY) {
  console.warn('ADVARSEL: OPENAI_API_KEY er ikke konfigurert. Legg til nøkkelen i', envPath);
}

const app = express();

const basePort = Number(process.env.PORT) || 4000;
const maxPort = basePort + 10;

app.use(cors());
app.use(express.json());
app.use('/api/ai', aiRouter);
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const startServer = (portToTry) => {
  const server = app.listen(portToTry, () => {
    console.log(`BoligCopilot backend running on http://localhost:${portToTry}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && portToTry < maxPort) {
      console.warn(`Port ${portToTry} er opptatt, prøver neste port...`);
      startServer(portToTry + 1);
      return;
    }
    console.error(error);
    process.exit(1);
  });
};

startServer(basePort);
