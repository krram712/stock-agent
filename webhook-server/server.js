// ============================================================
// AXIOM Webhook Server — receives TradingView Pine Script alerts
// Node.js + Express — deploy alongside docker-compose or Railway
// ============================================================

const express   = require('express');
const cors      = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const app       = express();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

// ── POST /ai-search — Claude AI with web search ──────────────
app.post('/ai-search', async (req, res) => {
  const { ticker, prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const systemPrompt = ticker
      ? `You are AXIOM, an expert stock analyst AI. The user is analyzing ${ticker}. Answer their question with up-to-date, precise financial information. Be concise but insightful. Format with clear sections using markdown.`
      : `You are AXIOM, an expert stock analyst AI. Answer with precise financial information. Be concise but insightful. Format with clear sections using markdown.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: systemPrompt,
      messages: [{ role: 'user', content: ticker ? `${ticker}: ${prompt}` : prompt }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    res.json({ result: text, ticker, prompt });
  } catch (err) {
    console.error('[AI-SEARCH]', err.message);
    res.status(500).json({ error: err.message });
  }
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

