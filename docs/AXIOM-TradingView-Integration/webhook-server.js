// ============================================================
// AXIOM Webhook Server — receives TradingView Pine Script alerts
// Node.js + Express — deploy to Railway/Render/Heroku FREE tier
// ============================================================

const express = require('express');
const app = express();
app.use(express.json());

// In-memory store (replace with Redis/DB in production)
const signals = [];
const subscribers = new Set(); // SSE clients

// ── POST /webhook — receives TradingView alerts ─────────────
app.post('/webhook', (req, res) => {
  const body = req.body;

  // Validate
  if (!body.ticker || !body.action || body.score === undefined) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const signal = {
    id: Date.now(),
    ticker:    body.ticker,
    action:    body.action,       // BUY or SELL
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

  // Broadcast to all SSE subscribers (real-time push to frontend)
  const sseData = `data: ${JSON.stringify(signal)}\n\n`;
  for (const client of subscribers) {
    client.write(sseData);
  }

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

// ── GET /signals/latest/:ticker — most recent for ticker ────
app.get('/signals/latest/:ticker', (req, res) => {
  const s = signals.find(s => s.ticker === req.params.ticker.toUpperCase());
  if (!s) return res.status(404).json({ error: 'No signal yet' });
  res.json(s);
});

// ── GET /stream — Server-Sent Events for real-time updates ──
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  subscribers.add(res);
  req.on('close', () => subscribers.delete(res));

  // Send last 5 signals on connect
  signals.slice(0, 5).forEach(s => {
    res.write(`data: ${JSON.stringify(s)}\n\n`);
  });
});

// ── GET /health ──────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, signals: signals.length }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`AXIOM Webhook Server running on port ${PORT}`));
