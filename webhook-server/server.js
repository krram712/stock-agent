// ============================================================
// AXIOM Webhook Server — receives TradingView Pine Script alerts
// Node.js + Express — deploy alongside docker-compose or Railway
// ============================================================

const express = require('express');
const cors    = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq    = require('groq-sdk');
const app     = express();

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

app.use(cors());
app.use(express.json());

// In-memory store (replace with Redis in production)
const signals     = [];
const subscribers = new Set(); // SSE clients

// ── POST /webhook — receives TradingView alerts ─────────────
app.post('/webhook', (req, res) => {
  const body = req.body;
  if (!body.ticker || !body.action || body.score === undefined)
    return res.status(400).json({ error: 'Invalid payload' });

  const signal = {
    id:        Date.now(),
    ticker:    body.ticker,
    action:    body.action,       // BUY | SELL
    score:     body.score,        // 0-100
    verdict:   body.verdict,
    price:     body.price,
    rsi:       body.rsi,
    macd_hist: body.macd_hist,
    cmf:       body.cmf,
    adx:       body.adx,
    pattern:   body.pattern,
    timeframe: body.timeframe,
    timestamp: new Date().toISOString(),
  };

  signals.unshift(signal);
  if (signals.length > 500) signals.pop();

  console.log(`[AXIOM] ${signal.action} ${signal.ticker} score=${signal.score} price=${signal.price}`);

  // Broadcast to all SSE subscribers
  const sseData = `data: ${JSON.stringify(signal)}\n\n`;
  for (const client of subscribers) client.write(sseData);

  res.json({ ok: true, signal });
});

// ── GET /signals — last N signals ───────────────────────────
app.get('/signals', (req, res) => {
  const limit  = parseInt(req.query.limit  || '50');
  const ticker = req.query.ticker;
  const action = req.query.action;
  let filtered = signals;
  if (ticker) filtered = filtered.filter(s => s.ticker === ticker.toUpperCase());
  if (action) filtered = filtered.filter(s => s.action === action.toUpperCase());
  res.json(filtered.slice(0, limit));
});

// ── GET /signals/latest/:ticker ──────────────────────────────
app.get('/signals/latest/:ticker', (req, res) => {
  const s = signals.find(s => s.ticker === req.params.ticker.toUpperCase());
  if (!s) return res.status(404).json({ error: 'No signal yet' });
  res.json(s);
});

// ── GET /stream — Server-Sent Events ────────────────────────
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  subscribers.add(res);
  req.on('close', () => subscribers.delete(res));

  // Send last 5 signals on connect
  signals.slice(0, 5).forEach(s => res.write(`data: ${JSON.stringify(s)}\n\n`));
});

// ── POST /ai-search — Gemini (web search) → Groq fallback ────
app.post('/ai-search', async (req, res) => {
  const { ticker, prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const systemMsg = ticker
    ? `You are AXIOM, an expert stock analyst AI. The user is analyzing ${ticker}. Provide up-to-date, precise financial information. Be concise but insightful. Use clear sections.`
    : `You are AXIOM, an expert stock analyst AI. Provide precise financial information. Be concise but insightful.`;
  const userQuery = ticker ? `${ticker} stock: ${prompt}` : prompt;

  // Try Gemini first (has Google Search grounding)
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = genai.getGenerativeModel({
        model: 'gemini-2.0-flash',
        tools: [{ googleSearch: {} }],
        systemInstruction: systemMsg,
      });
      const result = await model.generateContent(userQuery);
      return res.json({ result: result.response.text(), provider: 'gemini', ticker, prompt });
    } catch (err) {
      console.warn('[AI-SEARCH] Gemini failed, falling back to Groq:', err.message);
    }
  }

  // Fallback to Groq (Llama 3.3 70B)
  if (process.env.GROQ_API_KEY) {
    try {
      const chat = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user',   content: userQuery },
        ],
        max_tokens: 1024,
      });
      return res.json({ result: chat.choices[0].message.content, provider: 'groq', ticker, prompt });
    } catch (err) {
      console.error('[AI-SEARCH] Groq failed:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(503).json({ error: 'No AI provider configured. Set GEMINI_API_KEY or GROQ_API_KEY.' });
});

// ── GET /health ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, signals: signals.length }));

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`AXIOM Webhook Server running on port ${PORT}`);
  // Notify PM2 that the process is ready (used with wait_ready: true)
  if (process.send) process.send('ready');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[AXIOM] Port ${PORT} is already in use. Set the PORT env variable to use a different port.`);
    console.error(`[AXIOM] Example: PORT=3002 pm2 start server.js --name axiom-webhook`);
  } else {
    console.error('[AXIOM] Server error:', err);
  }
  process.exit(1);
});

process.on('SIGINT',  () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });

