// ============================================================
// AXIOM Webhook + AI Search Server v2.0
// Handles: TradingView alerts, SSE signals, AI research
// ============================================================

const express = require('express');
const https   = require('https');
const app = express();
app.use(express.json({ limit: '1mb' }));

const GROQ_API_KEY      = process.env.GROQ_API_KEY      || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// In-memory signal store
const signals     = [];
const subscribers = new Set();

// ── POST /webhook — TradingView Pine Script alerts ───────────
app.post('/webhook', (req, res) => {
  const body = req.body;
  if (!body.ticker || !body.action || body.score === undefined) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const signal = {
    id:        Date.now(),
    ticker:    body.ticker,
    action:    body.action,
    score:     body.score,
    verdict:   body.verdict,
    price:     body.price,
    rsi:       body.rsi,
    macd_hist: body.macd_hist,
    cmf:       body.cmf,
    adx:       body.adx,
    rvol:      body.rvol,
    bull_score: body.bull_score,
    bear_score: body.bear_score,
    pattern:   body.pattern,
    timeframe: body.timeframe,
    timestamp: new Date().toISOString(),
  };
  signals.unshift(signal);
  if (signals.length > 500) signals.pop();
  console.log(`[AXIOM] ${signal.action} ${signal.ticker} score=${signal.score} price=${signal.price}`);
  const sseData = `data: ${JSON.stringify(signal)}\n\n`;
  for (const client of subscribers) client.write(sseData);
  res.json({ ok: true, signal });
});

// ── GET /signals ─────────────────────────────────────────────
app.get('/signals', (req, res) => {
  const limit  = parseInt(req.query.limit  || '50');
  const ticker = req.query.ticker;
  const action = req.query.action;
  let filtered = signals;
  if (ticker) filtered = filtered.filter(s => s.ticker === ticker.toUpperCase());
  if (action) filtered = filtered.filter(s => s.action === action.toUpperCase());
  res.json(filtered.slice(0, limit));
});

app.get('/signals/latest/:ticker', (req, res) => {
  const s = signals.find(s => s.ticker === req.params.ticker.toUpperCase());
  if (!s) return res.status(404).json({ error: 'No signal yet' });
  res.json(s);
});

// ── GET /stream — SSE real-time push ─────────────────────────
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  subscribers.add(res);
  req.on('close', () => subscribers.delete(res));
  signals.slice(0, 5).forEach(s => res.write(`data: ${JSON.stringify(s)}\n\n`));
});

// ── POST /ai-search — AI research for dashboard tabs ─────────
app.post('/ai-search', async (req, res) => {
  const { ticker, prompt } = req.body;
  if (!ticker || !prompt) return res.status(400).json({ error: 'ticker and prompt required' });

  const systemPrompt = `You are a financial analyst providing concise, factual research for ${ticker}.
Be specific with numbers, dates, and sources when available. Keep responses under 300 words.
Format clearly with key points. Today's date: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}.`;

  const userMessage = `Research for ${ticker}: ${prompt}. Provide current, specific information with key metrics and actionable insights.`;

  // Try Groq first (fastest, free)
  if (GROQ_API_KEY) {
    try {
      const result = await callGroq(systemPrompt, userMessage);
      return res.json({ result, provider: 'groq-llama' });
    } catch (e) {
      console.warn('[ai-search] Groq failed:', e.message);
    }
  }

  // Try Anthropic (Claude)
  if (ANTHROPIC_API_KEY) {
    try {
      const result = await callAnthropic(systemPrompt, userMessage);
      return res.json({ result, provider: 'claude' });
    } catch (e) {
      console.warn('[ai-search] Anthropic failed:', e.message);
    }
  }

  // Fallback: static research template
  return res.json({
    result: generateFallback(ticker, prompt),
    provider: 'static',
  });
});

function callGroq(system, user) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system',    content: system },
        { role: 'user',      content: user   },
      ],
      max_tokens:  400,
      temperature: 0.3,
    });
    const req = https.request({
      hostname: 'api.groq.com',
      path:     '/openai/v1/chat/completions',
      method:   'POST',
      headers:  {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          resolve(json.choices[0].message.content.trim());
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function callAnthropic(system, user) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(body),
      },
    }, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          resolve(json.content[0].text.trim());
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function generateFallback(ticker, prompt) {
  const t = ticker.toUpperCase();
  if (prompt.includes('news'))     return `${t} — No AI key configured. Add GROQ_API_KEY or ANTHROPIC_API_KEY to /opt/axiom/.env and restart the server to enable live AI research.`;
  if (prompt.includes('analyst'))  return `${t} — Analyst data requires AI integration. Configure API key to fetch live analyst ratings and price targets.`;
  if (prompt.includes('earnings')) return `${t} — Earnings data requires AI integration. Configure API key to fetch upcoming earnings and EPS estimates.`;
  if (prompt.includes('sentiment'))return `${t} — Sentiment analysis requires AI integration. Configure API key to fetch retail and institutional sentiment.`;
  return `${t} — Configure GROQ_API_KEY in /opt/axiom/.env to enable AI research (free at console.groq.com).`;
}

// ── GET /health ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  ok: true,
  signals:    signals.length,
  groq:       !!GROQ_API_KEY,
  anthropic:  !!ANTHROPIC_API_KEY,
  subscribers: subscribers.size,
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`AXIOM Server v2.0 on port ${PORT} | groq=${!!GROQ_API_KEY} claude=${!!ANTHROPIC_API_KEY}`));