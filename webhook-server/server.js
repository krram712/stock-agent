// ============================================================
// AXIOM Webhook Server — receives TradingView Pine Script alerts
// Node.js + Express — deploy alongside docker-compose or Railway
// ============================================================

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const Groq    = require('groq-sdk');
// ── Yahoo Finance raw fetch (no extra deps, Node 18+ built-in fetch) ────────
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
};

async function fetchYFHistory(ticker, period) {
  const days = { '1mo': 31, '3mo': 93, '6mo': 183, '1y': 366, '2y': 732 }[period] || 183;
  const p2   = Math.floor(Date.now() / 1000);
  const p1   = p2 - days * 86400;
  const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${p1}&period2=${p2}&events=history&includeAdjustedClose=true`;

  const res  = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status} for ${ticker}`);

  const data  = await res.json();
  const chart = data.chart?.result?.[0];
  if (!chart?.timestamp) throw new Error(`No data for ${ticker}`);

  const ts  = chart.timestamp;
  const q   = chart.indicators.quote[0];
  const adj = chart.indicators.adjclose?.[0]?.adjclose;

  return ts.map((t, i) => ({
    date:   new Date(t * 1000).toISOString().split('T')[0],
    open:   q.open?.[i]   != null ? +q.open[i].toFixed(4)   : null,
    high:   q.high?.[i]   != null ? +q.high[i].toFixed(4)   : null,
    low:    q.low?.[i]    != null ? +q.low[i].toFixed(4)    : null,
    close:  (adj?.[i] ?? q.close?.[i]) != null ? +((adj?.[i] ?? q.close?.[i])).toFixed(4) : null,
    volume: q.volume?.[i] ?? null,
  })).filter(r => r.close !== null);
}
const app     = express();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });

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
    id:         Date.now(),
    ticker:     String(body.ticker).toUpperCase(),
    action:     String(body.action).toUpperCase(),  // BUY | SELL
    score:      Number(body.score),                 // 0-100 master score
    verdict:    body.verdict  || body.pattern || body.action,
    pattern:    body.pattern  || '',
    price:      body.price    != null ? Number(body.price)    : null,
    rsi:        body.rsi      != null ? Number(body.rsi)      : null,
    macd_hist:  body.macd_hist!= null ? Number(body.macd_hist): null,
    adx:        body.adx      != null ? Number(body.adx)      : null,
    rvol:       body.rvol     != null ? Number(body.rvol)     : null,
    bull_score: body.bull_score != null ? Number(body.bull_score) : null,
    bear_score: body.bear_score != null ? Number(body.bear_score) : null,
    timeframe:  body.timeframe || body.tf || '',
    timestamp:  new Date().toISOString(),
  };

  signals.unshift(signal);
  if (signals.length > 500) signals.pop();

  console.log(`[AXIOM] ${signal.action} ${signal.ticker} score=${signal.score} pattern="${signal.pattern}" price=${signal.price}`);

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

// ── POST /ai-search — Tavily live search + Groq/OpenRouter AI ─
app.post('/ai-search', async (req, res) => {
  const { ticker, prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const userQuery = ticker ? `${ticker} stock ${prompt}` : prompt;
  let liveContext = '';
  let searchProvider = '';

  // Step 1: Tavily live web search
  if (process.env.TAVILY_API_KEY) {
    try {
      const tr = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: userQuery,
          search_depth: 'basic',
          max_results: 5,
          include_answer: true,
        }),
      });
      const td = await tr.json();
      if (td.results?.length) {
        const snippets = td.results.map(r => `[${r.title}]\n${r.content.slice(0, 200)}`).join('\n\n');
        liveContext = `LIVE WEB SEARCH (${new Date().toUTCString()}):\n\n${snippets.slice(0, 1200)}`;
        searchProvider = 'tavily';
        console.log(`[AI-SEARCH] Tavily returned ${td.results.length} results`);
      }
    } catch (err) {
      console.warn('[AI-SEARCH] Tavily failed:', err.message);
    }
  }

  // Step 2: Build prompt with live context
  const systemMsg = `You are AXIOM, an expert stock analyst AI.${ticker ? ` The user is analyzing ${ticker}.` : ''}
${liveContext ? 'Use ONLY the live search results below to answer — do NOT use your training knowledge for facts/prices/news.' : 'Answer based on your knowledge.'}
Be concise, insightful, and use clear sections. Today's date: ${new Date().toDateString()}.`;

  const userMsg = liveContext
    ? `${userQuery}\n\n${liveContext}`
    : userQuery;

  const messages = [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }];

  // Step 3: Groq AI summarizes live results
  if (process.env.GROQ_API_KEY) {
    try {
      const chat = await groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 600 });
      return res.json({
        result: chat.choices[0].message.content,
        provider: searchProvider ? `tavily+groq` : 'groq',
        ticker, prompt,
      });
    } catch (err) {
      console.warn('[AI-SEARCH] Groq failed:', err.message);
    }
  }

  // Step 4: OpenRouter fallback
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://stockagentify.com',
        },
        body: JSON.stringify({ model: 'meta-llama/llama-3.3-70b-instruct:free', messages, max_tokens: 1024 }),
      });
      const data = await r.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return res.json({ result: text, provider: searchProvider ? 'tavily+openrouter' : 'openrouter', ticker, prompt });
    } catch (err) {
      console.warn('[AI-SEARCH] OpenRouter failed:', err.message);
    }
  }

  res.status(503).json({ error: 'All AI providers failed or not configured' });
});

// ── POST /watchlist-analyze — batch ticker analysis via Claude ─
app.post('/watchlist-analyze', async (req, res) => {
  const { tickers, realData } = req.body;
  if (!Array.isArray(tickers) || !tickers.length)
    return res.status(400).json({ error: 'tickers array required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured on server' });

  const dataLines = tickers.map(ticker => {
    const d = (realData && realData[ticker]) || {};
    const parts = [];
    if (d.price)          parts.push(`price=${Number(d.price).toFixed(2)}`);
    if (d.changePercent)  parts.push(`changePct=${Number(d.changePercent).toFixed(2)}`);
    if (d.change)         parts.push(`change=${Number(d.change).toFixed(2)}`);
    if (d.rsi14)          parts.push(`rsi=${Number(d.rsi14).toFixed(1)}`);
    if (d.sma20)          parts.push(`sma20=${Number(d.sma20).toFixed(2)}`);
    if (d.adx14)          parts.push(`adx=${Number(d.adx14).toFixed(1)}`);
    if (d.overallTrend)   parts.push(`trend=${d.overallTrend}`);
    if (d.bollingerUpper) parts.push(`boll_upper=${Number(d.bollingerUpper).toFixed(2)}`);
    if (d.bollingerLower) parts.push(`boll_lower=${Number(d.bollingerLower).toFixed(2)}`);
    if (d.macdHistogram)  parts.push(`macd_hist=${Number(d.macdHistogram).toFixed(3)}`);
    if (d.week52High)     parts.push(`52wk_high=${Number(d.week52High).toFixed(2)}`);
    if (d.week52Low)      parts.push(`52wk_low=${Number(d.week52Low).toFixed(2)}`);
    if (d.volume)         parts.push(`volume=${d.volume}`);
    return `[${ticker}] ${parts.length ? parts.join(', ') : 'no live data'}`;
  }).join('\n');

  // Sub-batch into groups of 5 to avoid token limit truncation
  const subBatches = [];
  for (let i = 0; i < tickers.length; i += 5) subBatches.push(tickers.slice(i, i + 5));

  const allResults = [];
  for (const batch of subBatches) {
    const batchLines = batch.map(ticker => {
      const d = (realData && realData[ticker]) || {};
      const parts = [];
      if (d.price)          parts.push(`price=${Number(d.price).toFixed(2)}`);
      if (d.changePercent)  parts.push(`chg%=${Number(d.changePercent).toFixed(2)}`);
      if (d.change)         parts.push(`chg=${Number(d.change).toFixed(2)}`);
      if (d.rsi14)          parts.push(`rsi=${Number(d.rsi14).toFixed(1)}`);
      if (d.sma20)          parts.push(`sma20=${Number(d.sma20).toFixed(2)}`);
      if (d.adx14)          parts.push(`adx=${Number(d.adx14).toFixed(1)}`);
      if (d.overallTrend)   parts.push(`trend=${d.overallTrend}`);
      if (d.bollingerUpper) parts.push(`bb_hi=${Number(d.bollingerUpper).toFixed(2)}`);
      if (d.bollingerLower) parts.push(`bb_lo=${Number(d.bollingerLower).toFixed(2)}`);
      if (d.week52High)     parts.push(`52h=${Number(d.week52High).toFixed(2)}`);
      if (d.week52Low)      parts.push(`52l=${Number(d.week52Low).toFixed(2)}`);
      return `${ticker}: ${parts.length ? parts.join(' ') : 'no live data'}`;
    }).join('\n');

    const prompt = `Stock analyst. Today: ${new Date().toDateString()}.
LIVE DATA (use these prices exactly):
${batchLines}

Return JSON array for ${batch.join(',')}. Keep newsHeadline ≤15 words, weekStrategy ≤20 words, monthStrategy ≤20 words.
Fields: ticker,price,change,changePct,rsi,iv,trend(BULL/BEAR/SIDEWAYS),signal(BUY/SELL/WAIT/HOLD),ma20,support,resistance,sector,earningsDate,entryScore(0-100),riskLevel(LOW/MEDIUM/HIGH),optionType,strikes,expiry,newsHeadline,weekStrategy,monthStrategy,catalysts(3 strings),risks(3 strings).
ONLY JSON array. No markdown.`;

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: 'Return ONLY a valid JSON array. No markdown. No explanation. Start with [ end with ].',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!r.ok) {
        const errText = await r.text();
        console.error('[WATCHLIST] Claude error:', errText.slice(0, 200));
        batch.forEach(t => allResults.push({ ticker: t, error: true }));
        continue;
      }

      const data = await r.json();
      if (data.error) { batch.forEach(t => allResults.push({ ticker: t, error: true })); continue; }

      const raw = data.content?.find(b => b.type === 'text')?.text || '';
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) { batch.forEach(t => allResults.push({ ticker: t, error: true })); continue; }

      const parsed = JSON.parse(match[0]);
      allResults.push(...parsed);
    } catch (err) {
      console.error('[WATCHLIST] Batch error:', err.message);
      batch.forEach(t => allResults.push({ ticker: t, error: true }));
    }
  }

  // Overlay real prices so Claude never overrides actual market data
  const enriched = allResults.map(s => {
    const d = (realData && realData[s.ticker]) || {};
    return {
      ...s,
      price:     d.price         ? Number(d.price)         : s.price,
      change:    d.change        ? Number(d.change)        : s.change,
      changePct: d.changePercent ? Number(d.changePercent) : s.changePct,
      rsi:       d.rsi14         ? Number(d.rsi14)         : s.rsi,
      ma20:      d.sma20         ? Number(d.sma20)         : s.ma20,
    };
  });

  console.log(`[WATCHLIST] Analyzed ${enriched.length} tickers`);
  res.json(enriched);
});

// ── GET /yf-history/:ticker — OHLCV proxy for Python technical-service ──
app.get('/yf-history/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const period = req.query.period || '6mo';
  try {
    const rows = await fetchYFHistory(ticker, period);
    console.log(`[YF-HISTORY] ${ticker} ${rows.length} rows`);
    res.json(rows);
  } catch (e) {
    console.error(`[YF-HISTORY] ${ticker}: ${e.message}`);
    res.status(500).json({ error: e.message });
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

