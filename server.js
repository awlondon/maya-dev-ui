import express from 'express';
import cors from 'cors';

const app = express();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const CHAT_SYSTEM_PROMPT = `You are an assistant embedded in a live coding UI.

You MUST respond with valid JSON only. Do not wrap in markdown or code fences.
Return ONLY the following schema with no extra top-level keys:

{
  "assistant": { "text": "string" },
  "ui": {
    "html": "string",
    "css": "string",
    "js": "string"
  }
}

The "ui.html", "ui.css", and "ui.js" fields are optional but MUST be present as
empty strings when not provided. If the user asks a question, respond with
assistant.text. If the user asks to modify or generate UI, include ui.html/css/js.`;

/**
 * 🔴 CORS MUST BE FIRST
 */
app.use(cors({
  origin: [
    'https://maya-dev-ui.pages.dev',
    'https://dev.primarydesignco.com'
  ],
  credentials: true
}));

app.options('*', cors());

app.use(express.json());

/**
 * 🔍 DIAGNOSTIC HEADERS (prove code is live)
 */
app.use((req, res, next) => {
  res.setHeader('X-MAYA-BACKEND', 'alive');
  next();
});

/**
 * HEALTH
 */
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

/**
 * SESSION CHECK
 */
app.get('/api/me', (req, res) => {
  res.json({ user: null });
});

/**
 * ⚠️ CORE PRODUCT FUNCTION
 * REAL LLM CHAT IMPLEMENTATION
 * DO NOT STUB OR MODIFY WITHOUT PRESERVING FULL LLM PATH
 */
app.post('/api/chat', async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Missing messages.' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing OPENAI_API_KEY on the server.' });
    return;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).send(errorText || 'Upstream error.');
      return;
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error.'
    });
  }
});

/**
 * GOOGLE AUTH STUB
 */
app.post('/api/auth/google', (req, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('Maya API listening on', port);
});
