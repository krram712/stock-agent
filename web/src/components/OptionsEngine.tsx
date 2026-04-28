import { useState, useEffect, useRef, useMemo } from 'react';

// ─── Black-Scholes Engine ─────────────────────────────────────
const BS = {
  normCDF(x: number) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422820 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
    return x >= 0 ? 1 - p : p;
  },
  normPDF(x: number) { return 0.3989422820 * Math.exp(-x * x / 2); },
  d1(S: number, K: number, T: number, r: number, q: number, sigma: number) {
    return (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  },
  d2(d1: number, sigma: number, T: number) { return d1 - sigma * Math.sqrt(T); },
  callPrice(S: number, K: number, T: number, r: number, q: number, sigma: number) {
    if (T <= 0 || sigma <= 0) return Math.max(0, S - K);
    const d1 = this.d1(S, K, T, r, q, sigma), d2 = this.d2(d1, sigma, T);
    return S * Math.exp(-q * T) * this.normCDF(d1) - K * Math.exp(-r * T) * this.normCDF(d2);
  },
  putPrice(S: number, K: number, T: number, r: number, q: number, sigma: number) {
    if (T <= 0 || sigma <= 0) return Math.max(0, K - S);
    const d1 = this.d1(S, K, T, r, q, sigma), d2 = this.d2(d1, sigma, T);
    return K * Math.exp(-r * T) * this.normCDF(-d2) - S * Math.exp(-q * T) * this.normCDF(-d1);
  },
  greeks(S: number, K: number, T: number, r: number, q: number, sigma: number, isCall: boolean) {
    if (T <= 0 || sigma <= 0) return { delta: isCall ? 1 : 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    const d1 = this.d1(S, K, T, r, q, sigma), d2 = this.d2(d1, sigma, T);
    const nd1 = this.normPDF(d1), Nd1 = this.normCDF(d1), Nd1n = this.normCDF(-d1);
    const Nd2 = this.normCDF(d2), Nd2n = this.normCDF(-d2);
    const delta = isCall ? Math.exp(-q * T) * Nd1 : Math.exp(-q * T) * (Nd1 - 1);
    const gamma = Math.exp(-q * T) * nd1 / (S * sigma * Math.sqrt(T));
    const theta = isCall
      ? (-(S * Math.exp(-q * T) * nd1 * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * Nd2 + q * S * Math.exp(-q * T) * Nd1) / 365
      : (-(S * Math.exp(-q * T) * nd1 * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * Nd2n - q * S * Math.exp(-q * T) * Nd1n) / 365;
    const vega = S * Math.exp(-q * T) * nd1 * Math.sqrt(T) / 100;
    const rho = isCall ? K * T * Math.exp(-r * T) * Nd2 / 100 : -K * T * Math.exp(-r * T) * Nd2n / 100;
    return { delta, gamma, theta, vega, rho };
  },
};

// ─── Seeded RNG ───────────────────────────────────────────────
function seededRng(seed: number) {
  let s = Math.abs(seed) || 1;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}
function strSeed(str: string) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

// ─── Strategy selector ────────────────────────────────────────
interface StratParams { ivRank: number; ivProxy: number; vrp: number; trend: string; adx: number; pcr: number; gexPositive: boolean; hasEarnings: boolean; }
function selectStrategy(p: StratParams) {
  const { ivRank, ivProxy, vrp, trend, adx, pcr, gexPositive, hasEarnings } = p;
  const strategies = [
    { id:'long_call',        name:'Long Call',          emoji:'📈', risk:'Defined',
      score:(trend==='bull'?30:0)+(ivRank<30?25:ivRank<40?15:0)+(pcr<0.7?15:0)+(vrp<0?10:0)+(adx>25?10:0),
      when:'Bullish + IV cheap + strong trend', setup:'Buy ATM or slightly OTM call',
      maxRisk:'Premium paid', maxProfit:'Unlimited', bestIV:'Low (<30%ile)', bestFor:'Earnings run-up, breakout' },
    { id:'long_put',         name:'Long Put',           emoji:'📉', risk:'Defined',
      score:(trend==='bear'?30:0)+(ivRank<30?25:ivRank<40?15:0)+(pcr>1.2?15:0)+(vrp<0?10:0)+(adx>25?10:0),
      when:'Bearish + IV cheap + strong downtrend', setup:'Buy ATM or slightly OTM put',
      maxRisk:'Premium paid', maxProfit:'Near unlimited', bestIV:'Low (<30%ile)', bestFor:'Earnings miss, breakdown' },
    { id:'covered_call',     name:'Covered Call',       emoji:'💰', risk:'Covered',
      score:(ivRank>50?30:ivRank>40?15:0)+(vrp>3?20:vrp>0?10:0)+(trend==='bull'||trend==='neutral'?20:0)+(gexPositive?15:0),
      when:'Own stock + IV elevated + neutral-bullish', setup:'Own 100 shares, sell OTM call',
      maxRisk:'Stock ownership', maxProfit:'Strike - cost + premium', bestIV:'High (>50%ile)', bestFor:'Income, plateau stocks' },
    { id:'cash_secured_put', name:'Cash-Secured Put',   emoji:'🏦', risk:'Covered',
      score:(ivRank>50?25:ivRank>40?12:0)+(trend==='bull'?25:trend==='neutral'?15:0)+(vrp>2?20:vrp>0?10:0)+(pcr<1.0?15:0),
      when:'Want stock at lower price + IV high', setup:'Sell OTM put, hold cash for assignment',
      maxRisk:'Strike - premium', maxProfit:'Premium collected', bestIV:'High (>50%ile)', bestFor:'Accumulation, income' },
    { id:'iron_condor',      name:'Iron Condor',        emoji:'🦅', risk:'Defined',
      score:(ivRank>50?30:ivRank>45?15:0)+(trend==='neutral'||gexPositive?25:0)+(vrp>3?20:vrp>1?10:0)+(adx<20?15:adx<25?10:0)+(!hasEarnings?10:-10),
      when:'Range-bound + IV high + low ADX', setup:'Sell OTM call spread + sell OTM put spread',
      maxRisk:'Width - premium', maxProfit:'Premium collected', bestIV:'High (>50%ile)', bestFor:'Sideways, post-earnings' },
    { id:'straddle',         name:'Straddle / Strangle',emoji:'⚡', risk:'Defined',
      score:(ivRank<25?35:ivRank<35?20:0)+(hasEarnings?25:0)+(vrp<-3?20:vrp<0?10:0)+(adx<20?10:0),
      when:'Big move expected + IV cheap + catalyst', setup:'Buy ATM call + ATM put',
      maxRisk:'Total premium', maxProfit:'Unlimited', bestIV:'Very low (<25%ile)', bestFor:'Earnings, FDA, events' },
    { id:'bull_spread',      name:'Bull Call Spread',   emoji:'📊', risk:'Defined',
      score:(trend==='bull'?30:0)+(ivRank>35?20:0)+(pcr<0.7?15:0)+(adx>20?15:0),
      when:'Bullish + IV elevated (reduce cost)', setup:'Buy ATM call, sell OTM call at target',
      maxRisk:'Net debit', maxProfit:'Width - debit', bestIV:'Medium (30-60%ile)', bestFor:'Moderate bull moves' },
    { id:'bear_spread',      name:'Bear Put Spread',    emoji:'📉', risk:'Defined',
      score:(trend==='bear'?30:0)+(ivRank>35?20:0)+(pcr>1.2?15:0)+(adx>20?15:0),
      when:'Bearish + IV elevated (reduce cost)', setup:'Buy ATM put, sell OTM put at target',
      maxRisk:'Net debit', maxProfit:'Width - debit', bestIV:'Medium (30-60%ile)', bestFor:'Moderate bear moves' },
    { id:'calendar',         name:'Calendar Spread',    emoji:'📅', risk:'Defined',
      score:(ivRank<30?30:0)+(trend==='neutral'?25:0)+(!hasEarnings?15:0)+(vrp<-2?10:0),
      when:'Low IV now, expect IV rise, range-bound', setup:'Sell near-term, buy far-term same strike',
      maxRisk:'Net debit', maxProfit:'Near-term decays faster', bestIV:'Low (<30%ile)', bestFor:'Theta play, vol expansion' },
    { id:'ratio_spread',     name:'1x2 Ratio Spread',   emoji:'⚖️', risk:'Unlimited',
      score:(ivRank>60?25:0)+(trend!=='neutral'?20:0)+(vrp>5?20:0)+(adx>30?15:0),
      when:'Strong directional bias + very high IV', setup:'Buy 1 ATM, sell 2 OTM (same expiry)',
      maxRisk:'Unlimited beyond short strikes', maxProfit:'Net credit + move to short', bestIV:'Very high (>60%ile)', bestFor:'High IV + direction' },
  ];
  return strategies.map(s => ({ ...s, score: Math.min(100, Math.max(0, s.score)) })).sort((a, b) => b.score - a.score);
}

// ─── P&L Chart ────────────────────────────────────────────────
function PLChart({ strategy, S, K, T, r, q, sigma, premium }: { strategy: string; S: number; K: number; T: number; r: number; q: number; sigma: number; premium: number; }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr; c.height = rect.height * dpr; ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);
    const prices = Array.from({ length: 60 }, (_, i) => S * 0.7 + (S * 0.6 * i / 59));
    const pnl = prices.map(p => {
      switch (strategy) {
        case 'long_call': return Math.max(0, p - K) * 100 - premium * 100;
        case 'long_put':  return Math.max(0, K - p) * 100 - premium * 100;
        case 'iron_condor': { const w = K * 0.05; return (premium - Math.abs(Math.min(0, Math.max(-w, K + w * 0.5 - p))) - Math.abs(Math.min(0, Math.max(-w, p - (K - w * 0.5))))) * 100; }
        case 'straddle': return (Math.abs(p - K) - premium) * 100;
        case 'bull_spread': { const w = K * 0.05; return (Math.min(w, Math.max(0, p - K)) - premium) * 100; }
        case 'bear_spread': { const w = K * 0.05; return (Math.min(w, Math.max(0, K - p)) - premium) * 100; }
        case 'covered_call': return (Math.min(K, p) - S + premium) * 100;
        default: return (p - S) * 100;
      }
    });
    const maxPnl = Math.max(...pnl), minPnl = Math.min(...pnl);
    const range = maxPnl - minPnl || 1;
    const padT = 16, padB = 24, padL = 52, padR = 8;
    const cW = W - padL - padR, cH = H - padT - padB;
    const toX = (i: number) => padL + (i / (prices.length - 1)) * cW;
    const toY = (v: number) => padT + (1 - (v - minPnl) / range) * cH;
    const zeroY = toY(0);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, zeroY); ctx.lineTo(W - padR, zeroY); ctx.stroke();
    ctx.fillStyle = '#3d5a6e'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
    ctx.fillText('$0', padL - 4, zeroY + 3);
    [maxPnl, minPnl].forEach(v => {
      const y = toY(v);
      ctx.fillStyle = v > 0 ? '#00ff88' : '#ef4444';
      ctx.fillText((v > 0 ? '+' : '') + Math.round(v), padL - 4, y + 3);
    });
    ctx.beginPath();
    prices.forEach((_, i) => i === 0 ? ctx.moveTo(toX(i), toY(pnl[i])) : ctx.lineTo(toX(i), toY(pnl[i])));
    ctx.lineTo(toX(prices.length - 1), toY(0)); ctx.lineTo(toX(0), toY(0)); ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
    if (maxPnl > 0) { grad.addColorStop(0, 'rgba(0,255,136,0.25)'); grad.addColorStop(0.5, 'rgba(0,255,136,0.05)'); }
    grad.addColorStop(1, 'rgba(239,68,68,0.15)');
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    prices.forEach((_, i) => i === 0 ? ctx.moveTo(toX(i), toY(pnl[i])) : ctx.lineTo(toX(i), toY(pnl[i])));
    const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
    lineGrad.addColorStop(0, '#ef4444'); lineGrad.addColorStop(0.5, '#fbbf24'); lineGrad.addColorStop(1, '#00ff88');
    ctx.strokeStyle = lineGrad; ctx.lineWidth = 2; ctx.stroke();
    const curIdx = prices.findIndex(p => p >= S);
    if (curIdx >= 0) {
      const curX = toX(curIdx);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(curX, padT); ctx.lineTo(curX, H - padB); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#c8d6e0'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
      ctx.fillText('NOW', curX, padT - 2);
    }
    ctx.fillStyle = '#3d5a6e'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    [0, 15, 30, 45, 59].forEach(i => ctx.fillText('$' + Math.round(prices[i]), toX(i), H - 6));
  }, [strategy, S, K, T, r, q, sigma, premium]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ─── Greeks Card ─────────────────────────────────────────────
function GreeksCard({ greeks }: { greeks: { delta: number; gamma: number; theta: number; vega: number; rho: number }; }) {
  const items = [
    { l: 'Δ Delta', v: (greeks.delta * 100).toFixed(1) + '%', desc: 'Prob ITM / shares equiv', c: greeks.delta > 0 ? '#00ff88' : '#ef4444' },
    { l: 'Γ Gamma', v: greeks.gamma.toFixed(4), desc: 'Δ change per $1', c: '#00d4ff' },
    { l: 'Θ Theta', v: '$' + Math.abs(greeks.theta).toFixed(3) + '/day', desc: 'Daily time decay', c: '#fb923c' },
    { l: 'ν Vega',  v: '$' + greeks.vega.toFixed(3) + '/1%', desc: 'IV sensitivity', c: '#a78bfa' },
    { l: 'ρ Rho',   v: greeks.rho.toFixed(3), desc: 'Rate sensitivity', c: '#fbbf24' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {items.map(item => (
        <div key={item.l} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '6px 8px' }}>
          <div style={{ fontSize: 9, color: '#3d5a6e', marginBottom: 2 }}>{item.l}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: item.c, fontFamily: 'monospace' }}>{item.v}</div>
          <div style={{ fontSize: 8, color: '#2a4050' }}>{item.desc}</div>
        </div>
      ))}
    </div>
  );
}

// ─── IV Gauge ─────────────────────────────────────────────────
function IVGauge({ ivRank, iv }: { ivRank: number; iv: number; }) {
  const col = ivRank > 50 ? '#ef4444' : ivRank > 30 ? '#fbbf24' : '#00ff88';
  const label = ivRank > 70 ? 'VERY HIGH — SELL' : ivRank > 50 ? 'HIGH — Sell Premium' : ivRank > 30 ? 'MEDIUM' : 'LOW — Buy Options';
  const angle = (ivRank / 100) * 180 - 90;
  const rad = angle * Math.PI / 180;
  const cx = 60, cy = 60, r = 45;
  const x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={120} height={70} viewBox="0 0 120 70">
        <path d="M 15 60 A 45 45 0 0 1 105 60" fill="none" stroke="rgba(0,255,136,0.15)" strokeWidth={8} strokeLinecap="round" />
        <path d={`M 15 60 A 45 45 0 0 1 ${x} ${y}`} fill="none" stroke={col} strokeWidth={8} strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={x} y2={y} stroke={col} strokeWidth={2} />
        <circle cx={cx} cy={cy} r={4} fill={col} />
        <text x={cx} y={cy + 16} textAnchor="middle" fill={col} fontSize={14} fontWeight={700} fontFamily="monospace">{ivRank}%</text>
      </svg>
      <div style={{ fontSize: 8, color: col, letterSpacing: 1, marginTop: -4 }}>{label}</div>
      <div style={{ fontSize: 9, color: '#3d5a6e', marginTop: 2 }}>IV: {iv.toFixed(1)}%</div>
    </div>
  );
}

// ─── Strategy color map ───────────────────────────────────────
const STRAT_COLOR: Record<string, string> = {
  long_call: '#00ff88', long_put: '#ef4444', covered_call: '#fbbf24',
  cash_secured_put: '#a3e635', iron_condor: '#00d4ff', straddle: '#a78bfa',
  bull_spread: '#86efac', bear_spread: '#fca5a5', calendar: '#fb923c',
  ratio_spread: '#e879f9',
};

// ─── Fallback IV/HV data per known ticker ─────────────────────
const TICKER_DATA: Record<string, { hv20: number; hv60: number; ivRank: number; beta: number; earnings: string }> = {
  AAPL: { hv20: 22.4, hv60: 24.1, ivRank: 42, beta: 1.24, earnings: 'N/A' },
  NVDA: { hv20: 48.2, hv60: 52.1, ivRank: 38, beta: 1.68, earnings: 'N/A' },
  TSLA: { hv20: 58.4, hv60: 62.3, ivRank: 55, beta: 2.31, earnings: 'N/A' },
  MSFT: { hv20: 18.2, hv60: 20.4, ivRank: 28, beta: 0.91, earnings: 'N/A' },
  META: { hv20: 32.4, hv60: 35.2, ivRank: 45, beta: 1.22, earnings: 'N/A' },
  AMZN: { hv20: 28.4, hv60: 30.2, ivRank: 35, beta: 1.15, earnings: 'N/A' },
  SPY:  { hv20: 14.2, hv60: 16.1, ivRank: 32, beta: 1.00, earnings: 'N/A' },
  QQQ:  { hv20: 18.4, hv60: 20.2, ivRank: 36, beta: 1.10, earnings: 'N/A' },
  GOOGL:{ hv20: 24.2, hv60: 26.4, ivRank: 30, beta: 1.06, earnings: 'N/A' },
  AMD:  { hv20: 52.4, hv60: 56.2, ivRank: 62, beta: 1.72, earnings: 'N/A' },
};
const DEFAULT_TICKER_DATA = { hv20: 30.0, hv60: 32.0, ivRank: 40, beta: 1.2, earnings: 'N/A' };

// ─── Main OptionsEngine component ─────────────────────────────
interface Props { ticker: string; price?: number; overallScore?: number; }

interface LiveData {
  price: number;
  hv20: number;
  ivRank: number;
  beta: number;
  atr: number;
  bollingerWidth: number;
  loading: boolean;
  error: boolean;
}

import { api } from '../services/api';

export default function OptionsEngine({ ticker, price: propPrice, overallScore }: Props) {
  const [dte, setDte] = useState(30);
  const [selStrat, setSelStrat] = useState<string | null>(null);
  const [analysisTab, setAnalysisTab] = useState<'strategy' | 'greeks' | 'pnl' | 'chain'>('strategy');
  const [optionType, setOptionType] = useState<'call' | 'put'>('call');
  const [customStrike, setCustomStrike] = useState('');
  const [live, setLive] = useState<LiveData>({ price: 0, hv20: 0, ivRank: 0, beta: 1.2, atr: 0, bollingerWidth: 0, loading: true, error: false });

  // Fetch live quote + technicals on ticker change
  useEffect(() => {
    if (!ticker) return;
    setSelStrat(null);
    setCustomStrike('');
    setLive(prev => ({ ...prev, loading: true, error: false }));

    Promise.all([
      api.stocks.quote(ticker).catch(() => null),
      api.stocks.technicals(ticker).catch(() => null),
    ]).then(([quoteRes, techRes]) => {
      const q = quoteRes?.data;
      const t = techRes?.data;
      const livePrice = q?.price ? Number(q.price) : 0;
      const atr       = t?.atr14  ? Number(t.atr14)  : 0;
      const bw        = t?.bollingerWidth ? Number(t.bollingerWidth) : 0;

      // HV20 proxy: ATR annualized — ATR/price * sqrt(252)
      const fallback  = TICKER_DATA[ticker] || DEFAULT_TICKER_DATA;
      const hv20      = livePrice > 0 && atr > 0
        ? Math.round(atr / livePrice * Math.sqrt(252) * 100 * 10) / 10
        : fallback.hv20;

      // IV rank proxy from Bollinger Width percentile (wider BB = higher realized vol)
      // Use Bollinger Width / price as a normalised measure, map 0-15% → 0-100 ivRank
      const ivRank = livePrice > 0 && bw > 0
        ? Math.min(100, Math.round(bw / livePrice * 100 / 0.15 * 100))
        : fallback.ivRank;

      setLive({
        price:         livePrice,
        hv20,
        ivRank,
        beta:          fallback.beta,
        atr,
        bollingerWidth: bw,
        loading:       false,
        error:         !livePrice && !atr,
      });
    });
  }, [ticker]);

  const fallback = TICKER_DATA[ticker] || DEFAULT_TICKER_DATA;
  // Use live price if available, then prop price, then fallback
  const S = (live.price > 0 ? live.price : propPrice && propPrice > 0 ? propPrice : fallback.hv20 > 0 ? 100 : 100);
  const hv20    = live.hv20    > 0 ? live.hv20    : fallback.hv20;
  const ivRank  = live.ivRank  > 0 ? live.ivRank  : fallback.ivRank;

  const T = dte / 365;
  const r = 0.0525;
  const q = 0.005;

  const rng = useMemo(() => seededRng(strSeed(ticker)), [ticker]);

  // IV proxy = HV20 * typical IV/HV premium (1.10–1.35)
  const ivProxy = useMemo(() => {
    const rng2 = seededRng(strSeed(ticker + 'iv'));
    return hv20 * (1.10 + rng2() * 0.25);
  }, [ticker, hv20]);

  const sigma = ivProxy / 100;
  const K = customStrike ? parseFloat(customStrike) : Math.round(S / 5) * 5 || S;

  const callGreeks = useMemo(() => BS.greeks(S, K, T, r, q, sigma, true),  [S, K, T, r, q, sigma]);
  const putGreeks  = useMemo(() => BS.greeks(S, K, T, r, q, sigma, false), [S, K, T, r, q, sigma]);
  const callPrice  = useMemo(() => BS.callPrice(S, K, T, r, q, sigma), [S, K, T, r, q, sigma]);
  const putPrice   = useMemo(() => BS.putPrice(S, K, T, r, q, sigma),  [S, K, T, r, q, sigma]);

  const expMove    = S * sigma * Math.sqrt(T);
  const expMovePct = sigma * Math.sqrt(T) * 100;
  const upper1sd   = (S + expMove).toFixed(2);
  const lower1sd   = (S - expMove).toFixed(2);

  const vrp        = ivProxy - hv20;
  const pcr        = ivRank > 50 ? 1.3 - (ivRank - 50) * 0.01 : 0.7 + (50 - ivRank) * 0.01;
  const hasEarnings = fallback.earnings !== 'N/A';

  // Derive trend from score if available, else from IV rank
  const trend = overallScore != null
    ? (overallScore >= 58 ? 'bull' : overallScore <= 42 ? 'bear' : 'neutral')
    : (ivRank < 35 ? 'bull' : ivRank > 60 ? 'bear' : 'neutral');

  const strategies = useMemo(() => selectStrategy({
    ivRank, ivProxy, vrp, trend,
    adx: 20 + rng() * 15,
    pcr, gexPositive: ivProxy < hv20 * 1.1, hasEarnings,
  }), [ticker, dte, trend, ivRank, ivProxy, hv20]);

  const best = strategies[0];
  const activeStrat = selStrat || best?.id;
  const strat = strategies.find(s => s.id === activeStrat) || strategies[0];
  const sc = STRAT_COLOR[strat?.id] || '#94a3b8';

  const stratPremium = ({
    long_call: callPrice, long_put: putPrice,
    iron_condor: (callPrice + putPrice) * 0.45,
    straddle: callPrice + putPrice,
    bull_spread: callPrice * 0.55, bear_spread: putPrice * 0.55,
    covered_call: callPrice, cash_secured_put: putPrice,
    calendar: callPrice * 0.35,
  } as Record<string, number>)[activeStrat] ?? callPrice;

  return (
    <div style={{ fontFamily: 'JetBrains Mono, Fira Code, monospace' }}>
      {/* Stock snapshot */}
      <div style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#00ff88', letterSpacing: 2 }}>{ticker}</div>
          <div style={{ fontSize: 16, color: '#c8d6e0', fontWeight: 700 }}>${S.toFixed(2)}</div>
          {live.loading && <div style={{ fontSize: 9, color: '#2a4050' }}>⟳ loading live data…</div>}
          {!live.loading && live.price > 0 && <div style={{ fontSize: 9, color: '#00ff88' }}>● LIVE</div>}
          {!live.loading && live.error && <div style={{ fontSize: 9, color: '#fbbf24' }}>⚠ using estimates</div>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: '#2a4050', alignSelf: 'center' }}>DTE:</div>
            {[7, 14, 21, 30, 45, 60, 90].map(d => (
              <button key={d} onClick={() => setDte(d)} style={{ padding: '5px 9px', borderRadius: 5, fontSize: 10, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', background: dte === d ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.03)', border: dte === d ? '1px solid rgba(0,255,136,0.55)' : '1px solid rgba(255,255,255,0.06)', color: dte === d ? '#00ff88' : '#3d5a6e' }}>
                {d}d
              </button>
            ))}
          </div>
          <div>
            <input value={customStrike} onChange={e => setCustomStrike(e.target.value)} placeholder={`Strike $${Math.round(S / 5) * 5}`}
              style={{ width: 110, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '6px 10px', color: '#c8d6e0', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 6 }}>
          {[
            { l: 'IV (PROXY)',  v: `${ivProxy.toFixed(1)}%`, c: ivProxy > hv20 * 1.2 ? '#ef4444' : '#00ff88' },
            { l: 'HV20',       v: `${hv20.toFixed(1)}%`,    c: '#94a3b8' },
            { l: 'VRP',        v: `${vrp > 0 ? '+' : ''}${vrp.toFixed(1)}%`, c: vrp > 0 ? '#ef4444' : '#00ff88' },
            { l: 'IV RANK',    v: `${ivRank}%ile`,           c: ivRank > 50 ? '#ef4444' : '#00ff88' },
            { l: 'EXP MOVE',   v: `±${expMovePct.toFixed(1)}%`, c: '#00d4ff' },
            { l: 'TREND',      v: trend.toUpperCase(),        c: trend === 'bull' ? '#00ff88' : trend === 'bear' ? '#ef4444' : '#94a3b8' },
            { l: 'BETA',       v: live.beta.toFixed(2),       c: '#94a3b8' },
          ].map(item => (
            <div key={item.l} style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 7, letterSpacing: 1, color: '#2a4050', marginBottom: 2 }}>{item.l}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: item.c }}>{item.v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 6 }}>
          <div style={{ fontSize: 8, color: '#2a4050', marginBottom: 4 }}>EXPECTED MOVE ({dte}d) — ±1 STD DEV</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'monospace' }}>
            <span style={{ color: '#ef4444' }}>↓ ${lower1sd}</span>
            <span style={{ color: '#c8d6e0' }}>${S.toFixed(2)} ±{expMovePct.toFixed(1)}%</span>
            <span style={{ color: '#00ff88' }}>↑ ${upper1sd}</span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>

        {/* LEFT: IV gauge + strategy ranking */}
        <div>
          <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: '#2a4050', marginBottom: 10 }}>IV RANK GAUGE</div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <IVGauge ivRank={ivRank} iv={ivProxy} />
              <div style={{ flex: 1, fontSize: 10, color: '#4a6070', lineHeight: 1.8 }}>
                <div>IV Rank: <strong style={{ color: ivRank > 50 ? '#ef4444' : '#00ff88' }}>{ivRank}%</strong></div>
                <div>VRP: <strong style={{ color: vrp > 0 ? '#ef4444' : '#00ff88' }}>{vrp > 0 ? '+' : ''}{vrp.toFixed(1)}%</strong></div>
                <div>GEX: <strong style={{ color: ivProxy < hv20 * 1.1 ? '#00ff88' : '#ef4444' }}>{ivProxy < hv20 * 1.1 ? 'POSITIVE (Range)' : 'NEGATIVE (Trending)'}</strong></div>
                <div>ATR: <strong style={{ color: '#94a3b8' }}>${live.atr > 0 ? live.atr.toFixed(2) : '—'}</strong></div>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: '#2a4050', marginBottom: 10 }}>STRATEGY RANKING</div>
            {strategies.map((s, i) => {
              const active = activeStrat === s.id;
              const color = STRAT_COLOR[s.id] || '#94a3b8';
              return (
                <div key={s.id} onClick={() => setSelStrat(s.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 8px', marginBottom: 4, borderRadius: 6, cursor: 'pointer', background: active ? `${color}12` : 'rgba(255,255,255,0.01)', border: `1px solid ${active ? color + '40' : 'rgba(255,255,255,0.04)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{s.emoji}</span>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: active ? color : '#c8d6e0' }}>{s.name}</div>
                      <div style={{ fontSize: 8, color: '#3d5a6e' }}>{s.risk} risk</div>
                    </div>
                    {i === 0 && <span style={{ fontSize: 7, padding: '1px 5px', borderRadius: 3, background: 'rgba(251,191,36,0.2)', color: '#fbbf24', marginLeft: 4 }}>BEST</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: s.score >= 70 ? color : '#94a3b8', fontFamily: 'monospace' }}>{s.score}</div>
                    <div style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: s.score + '%', background: s.score >= 70 ? color : '#3d5a6e', borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: strategy detail */}
        <div>
          <div style={{ background: `${sc}08`, border: `1px solid ${sc}30`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 20, marginBottom: 2 }}>{strat?.emoji}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: sc }}>{strat?.name}</div>
                <div style={{ fontSize: 9, color: '#3d5a6e', marginTop: 2 }}>{strat?.when}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: sc, fontFamily: 'monospace', lineHeight: 1 }}>{strat?.score}</div>
                <div style={{ fontSize: 9, color: '#3d5a6e' }}>SCORE/100</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              {[
                { l: 'Setup',       v: strat?.setup },
                { l: 'Best IV',     v: strat?.bestIV },
                { l: 'Max Risk',    v: strat?.maxRisk },
                { l: 'Max Profit',  v: strat?.maxProfit },
                { l: 'Premium',     v: `$${(stratPremium * 100).toFixed(0)} / contract` },
                { l: 'Best For',    v: strat?.bestFor },
              ].map(item => (
                <div key={item.l} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 5, padding: '5px 7px' }}>
                  <div style={{ fontSize: 7, color: '#3d5a6e', marginBottom: 1 }}>{item.l}</div>
                  <div style={{ fontSize: 9, color: '#c8d6e0', lineHeight: 1.4 }}>{item.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
            {(['strategy', 'greeks', 'pnl', 'chain'] as const).map(id => (
              <button key={id} onClick={() => setAnalysisTab(id)}
                style={{ padding: '5px 10px', borderRadius: 5, fontSize: 9, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', letterSpacing: 1, background: analysisTab === id ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.02)', border: analysisTab === id ? '1px solid rgba(0,255,136,0.45)' : '1px solid rgba(255,255,255,0.06)', color: analysisTab === id ? '#00ff88' : '#3d5a6e' }}>
                {id === 'strategy' ? 'Strategy' : id === 'greeks' ? 'Greeks' : id === 'pnl' ? 'P&L Chart' : 'Option Chain'}
              </button>
            ))}
          </div>

          {/* Strategy tab */}
          {analysisTab === 'strategy' && (
            <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#2a4050', marginBottom: 10 }}>STRATEGY CHECKLIST</div>
              {[
                { label: 'IV Rank favorable', ok: strat?.id?.includes('condor') || strat?.id?.includes('covered') || strat?.id?.includes('put') ? ivRank > 40 : ivRank < 45, desc: strat?.bestIV },
                { label: 'Trend alignment',   ok: strat?.id === 'long_call' ? trend === 'bull' : strat?.id === 'long_put' ? trend === 'bear' : true, desc: 'Directional bias check' },
                { label: 'VRP edge',          ok: vrp > 2 ? (!!strat?.id?.includes('condor') || !!strat?.id?.includes('covered')) : vrp < 0, desc: `VRP: ${vrp.toFixed(1)}%` },
                { label: 'Earnings timing',   ok: strat?.id === 'straddle' ? hasEarnings : !hasEarnings, desc: fallback.earnings !== 'N/A' ? `Earnings: ${fallback.earnings}` : 'No near-term earnings' },
                { label: 'Premium value',     ok: stratPremium > 0.5, desc: `$${(stratPremium * 100).toFixed(0)}/contract` },
                { label: 'GEX regime',        ok: !!strat?.id?.includes('condor') ? ivProxy < hv20 * 1.05 : true, desc: ivProxy < hv20 * 1.05 ? 'Positive (range)' : 'Negative (trending)' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12 }}>{item.ok ? '✅' : '⚠️'}</span>
                    <span style={{ fontSize: 10, color: item.ok ? '#c8d6e0' : '#94a3b8' }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 9, color: '#3d5a6e' }}>{item.desc}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, padding: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 6, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.9, color: '#8ba0b0' }}>
                <div><span style={{ color: '#fbbf24' }}>TICKER:</span>   <strong style={{ color: '#e2e8f0' }}>{ticker}</strong> @ ${S.toFixed(2)}</div>
                <div><span style={{ color: '#fbbf24' }}>STRATEGY:</span> <strong style={{ color: sc }}>{strat?.name}</strong></div>
                <div><span style={{ color: '#fbbf24' }}>EXPIRY:</span>   <strong style={{ color: '#e2e8f0' }}>{dte} DTE</strong></div>
                <div><span style={{ color: '#fbbf24' }}>STRIKE:</span>   <strong style={{ color: '#e2e8f0' }}>${K}</strong></div>
                <div><span style={{ color: '#fbbf24' }}>PREMIUM:</span>  <strong style={{ color: '#00ff88' }}>${stratPremium.toFixed(2)} (${(stratPremium * 100).toFixed(0)}/contract)</strong></div>
                <div><span style={{ color: '#fbbf24' }}>BREAKEVEN:</span><strong style={{ color: '#e2e8f0' }}> ${(strat?.id?.includes('call') || strat?.id?.includes('bull') ? K + stratPremium : K - stratPremium).toFixed(2)}</strong></div>
                <div><span style={{ color: '#fbbf24' }}>MAX RISK:</span> <strong style={{ color: '#e2e8f0' }}>{strat?.maxRisk}</strong></div>
                <div><span style={{ color: '#fbbf24' }}>MAX PROFIT:</span><strong style={{ color: '#e2e8f0' }}>{strat?.maxProfit}</strong></div>
              </div>
              <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, fontSize: 9, color: '#94a3b8' }}>
                ⚠️ Options involve substantial risk. No strategy guarantees profit. NOT FINANCIAL ADVICE.
              </div>
            </div>
          )}

          {/* Greeks tab */}
          {analysisTab === 'greeks' && (
            <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['call', 'put'] as const).map(t => (
                  <button key={t} onClick={() => setOptionType(t)}
                    style={{ padding: '5px 12px', borderRadius: 5, fontSize: 10, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', background: optionType === t ? (t === 'call' ? 'rgba(0,255,136,0.12)' : 'rgba(239,68,68,0.12)') : 'rgba(255,255,255,0.02)', border: optionType === t ? (t === 'call' ? '1px solid rgba(0,255,136,0.5)' : '1px solid rgba(239,68,68,0.5)') : '1px solid rgba(255,255,255,0.06)', color: optionType === t ? (t === 'call' ? '#00ff88' : '#ef4444') : '#3d5a6e' }}>
                    {t.toUpperCase()} ${(t === 'call' ? callPrice : putPrice).toFixed(2)}
                  </button>
                ))}
              </div>
              <GreeksCard greeks={optionType === 'call' ? callGreeks : putGreeks} />
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 6, fontSize: 10, color: '#4a6070' }}>
                Strike: ${K} | DTE: {dte}d | IV: {ivProxy.toFixed(1)}% | RFR: 5.25%
              </div>
            </div>
          )}

          {/* P&L Chart tab */}
          {analysisTab === 'pnl' && (
            <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#2a4050', marginBottom: 6 }}>P&L AT EXPIRATION — {strat?.name?.toUpperCase()}</div>
              <div style={{ height: 180, width: '100%' }}>
                <PLChart strategy={activeStrat} S={S} K={K} T={T} r={r} q={q} sigma={sigma} premium={stratPremium} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 9, color: '#3d5a6e', justifyContent: 'center' }}>
                <span style={{ color: '#00ff88' }}>█ Profit</span>
                <span style={{ color: '#ef4444' }}>█ Loss</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>│ Now</span>
              </div>
            </div>
          )}

          {/* Option chain tab */}
          {analysisTab === 'chain' && (
            <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, overflowX: 'auto' }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#2a4050', marginBottom: 8 }}>OPTION CHAIN — {dte}DTE</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['CALL', 'DELTA', 'THETA', 'VEGA', 'STRIKE', 'VEGA', 'THETA', 'DELTA', 'PUT'].map((h, i) => (
                      <th key={i} style={{ padding: '4px 6px', color: i < 4 ? '#00ff88' : i > 4 ? '#ef4444' : '#c8d6e0', fontSize: 7, letterSpacing: 1, textAlign: 'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[-8, -6, -4, -2, 0, 2, 4, 6, 8].map((offset, i) => {
                    const strike = Math.round((S + offset * S * 0.01) / 5) * 5;
                    const isATM = Math.abs(strike - Math.round(S / 5) * 5) < 3;
                    const cG = BS.greeks(S, strike, T, r, q, sigma, true);
                    const pG = BS.greeks(S, strike, T, r, q, sigma, false);
                    const cP = BS.callPrice(S, strike, T, r, q, sigma);
                    const pP = BS.putPrice(S, strike, T, r, q, sigma);
                    return (
                      <tr key={strike} style={{ background: isATM ? 'rgba(0,255,136,0.05)' : i % 2 === 0 ? 'rgba(255,255,255,0.006)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '4px 6px', color: '#00ff88', textAlign: 'center' }}>${cP.toFixed(2)}</td>
                        <td style={{ padding: '4px 6px', color: '#86efac', textAlign: 'center' }}>{(cG.delta * 100).toFixed(0)}%</td>
                        <td style={{ padding: '4px 6px', color: '#fb923c', textAlign: 'center' }}>{cG.theta.toFixed(3)}</td>
                        <td style={{ padding: '4px 6px', color: '#a78bfa', textAlign: 'center' }}>{cG.vega.toFixed(3)}</td>
                        <td style={{ padding: '4px 6px', color: isATM ? '#fbbf24' : '#c8d6e0', textAlign: 'center', fontWeight: isATM ? 700 : 400 }}>${strike}{isATM ? ' ★' : ''}</td>
                        <td style={{ padding: '4px 6px', color: '#a78bfa', textAlign: 'center' }}>{pG.vega.toFixed(3)}</td>
                        <td style={{ padding: '4px 6px', color: '#fb923c', textAlign: 'center' }}>{pG.theta.toFixed(3)}</td>
                        <td style={{ padding: '4px 6px', color: '#fca5a5', textAlign: 'center' }}>{(Math.abs(pG.delta) * 100).toFixed(0)}%</td>
                        <td style={{ padding: '4px 6px', color: '#ef4444', textAlign: 'center' }}>${pP.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: 6, fontSize: 8, color: '#2a4050', textAlign: 'center' }}>★ ATM | IV={ivProxy.toFixed(1)}% | Strike rounding ±$5</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 9, color: '#0e1e26', textAlign: 'center', letterSpacing: 1 }}>
        BLACK-SCHOLES ENGINE · GREEKS · IV RANK · GEX · NOT FINANCIAL ADVICE
      </div>
    </div>
  );
}