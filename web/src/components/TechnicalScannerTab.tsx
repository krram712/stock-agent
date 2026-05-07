import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const C = {
  bg:    '#06101a', panel: 'rgba(255,255,255,0.022)', border: 'rgba(255,255,255,0.07)',
  green: '#00ff88', blue: '#00d4ff', purple: '#a78bfa', yellow: '#fbbf24',
  red:   '#ef4444', orange: '#f97316', txt: '#c8d6e0', sub: '#8ba0b0',
  dim:   '#3d5a6e', ghost: '#2a4050', font: 'JetBrains Mono, Fira Code, monospace',
};

const DEFAULT_TICKERS = ['NVDA','AAPL','MSFT','TSLA','AMZN','META','GOOGL','AMD','AVGO','PLTR'];
const PERIODS = ['1mo','3mo','6mo','1y','2y'];

const ACTION_COLOR: Record<string, string> = {
  'STRONG BUY': '#00ff88', 'BUY': '#3fb950', 'MILD BUY': '#7ee787',
  'HOLD / WAIT': '#f0c040',
  'MILD SELL': '#ffa657', 'SELL': '#ff7b72', 'STRONG SELL': '#ff0000',
};

interface ScanRow {
  ticker: string; price?: number; action: string; color: string;
  score: number; bull_pct?: number; rsi?: number; stoch_k?: number;
  macd_bull?: boolean; sar_trend?: string; stop?: number; t1?: number;
  t2?: number; risk?: number; rr?: number; error?: string;
}

interface Props {
  onAnalyze: (ticker: string) => void;
}

export default function TechnicalScannerTab({ onAnalyze }: Props) {
  const [rows,     setRows]     = useState<ScanRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [period,   setPeriod]   = useState('6mo');
  const [sortBy,   setSortBy]   = useState<'score' | 'rsi' | 'bull_pct'>('score');
  const [custom,   setCustom]   = useState('');
  const [tickers,  setTickers]  = useState<string[]>(DEFAULT_TICKERS);

  const runScan = async (tkrs = tickers, p = period) => {
    setLoading(true); setError(null);
    try {
      const res = await api.technical.scan(tkrs, p);
      setRows(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Scan failed');
    }
    setLoading(false);
  };

  useEffect(() => { runScan(); }, []);

  const addCustom = () => {
    const t = custom.trim().toUpperCase().replace(/[^A-Z.]/g, '');
    if (!t || tickers.includes(t)) return;
    const next = [...tickers, t];
    setTickers(next); setCustom('');
    runScan(next);
  };

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === 'rsi')     return (b.rsi     ?? 50) - (a.rsi     ?? 50);
    if (sortBy === 'bull_pct') return (b.bull_pct ?? 50) - (a.bull_pct ?? 50);
    return b.score - a.score;
  });

  const buys  = rows.filter(r => r.action?.includes('BUY')).length;
  const sells = rows.filter(r => r.action?.includes('SELL')).length;
  const holds = rows.filter(r => r.action === 'HOLD / WAIT').length;

  return (
    <div style={{ fontFamily: C.font }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        {/* Summary pills */}
        <span style={{ padding: '4px 12px', background: `${C.green}15`, border: `1px solid ${C.green}30`, borderRadius: 99, fontSize: 10, color: C.green, fontWeight: 700 }}>▲ {buys} BUY</span>
        <span style={{ padding: '4px 12px', background: `${C.red}12`, border: `1px solid ${C.red}25`, borderRadius: 99, fontSize: 10, color: C.red, fontWeight: 700 }}>▼ {sells} SELL</span>
        <span style={{ padding: '4px 12px', background: `${C.yellow}12`, border: `1px solid ${C.yellow}25`, borderRadius: 99, fontSize: 10, color: C.yellow, fontWeight: 700 }}>— {holds} HOLD</span>

        {/* Period */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {PERIODS.map(p => (
            <button key={p} onClick={() => { setPeriod(p); runScan(tickers, p); }}
              style={{ padding: '4px 9px', borderRadius: 5, fontSize: 10, fontFamily: C.font, fontWeight: 600, cursor: 'pointer', background: period === p ? `${C.blue}18` : 'transparent', border: `1px solid ${period === p ? C.blue + '50' : C.border}`, color: period === p ? C.blue : C.dim }}>
              {p}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          style={{ padding: '5px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.sub, fontSize: 10, fontFamily: C.font, cursor: 'pointer' }}>
          <option value="score">Sort: Score</option>
          <option value="bull_pct">Sort: Bull%</option>
          <option value="rsi">Sort: RSI</option>
        </select>

        {/* Refresh */}
        <button onClick={() => runScan()} disabled={loading}
          style={{ padding: '6px 14px', background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 6, color: C.green, fontSize: 10, fontFamily: C.font, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? '⟳ Scanning...' : '↻ Refresh'}
        </button>

        {/* Add ticker */}
        <div style={{ display: 'flex', gap: 0, marginLeft: 'auto' }}>
          <input value={custom} onChange={e => setCustom(e.target.value.toUpperCase().replace(/[^A-Z.]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
            placeholder="Add ticker..." maxLength={8}
            style={{ width: 110, padding: '6px 10px', background: 'rgba(0,0,0,0.4)', border: `1px solid ${C.border}`, borderRight: 'none', borderRadius: '6px 0 0 6px', color: C.green, fontSize: 11, fontFamily: C.font, outline: 'none' }} />
          <button onClick={addCustom}
            style={{ padding: '6px 12px', background: `${C.green}12`, border: `1px solid ${C.border}`, borderRadius: '0 6px 6px 0', color: C.green, fontSize: 11, fontFamily: C.font, cursor: 'pointer', fontWeight: 700 }}>
            +
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: `rgba(239,68,68,0.08)`, border: `1px solid ${C.red}25`, borderRadius: 8, padding: '12px 16px', marginBottom: 12, fontSize: 11, color: C.red }}>
          ⚠️ {error}
        </div>
      )}

      {loading && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 20px' }}>
          <div style={{ fontSize: 28, color: C.green, animation: 'pulse 1.2s infinite', marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 12, color: C.green, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>SCANNING {tickers.length} TICKERS</div>
          <div style={{ fontSize: 10, color: C.ghost }}>Fetching live data and computing 17-factor confluence scores...</div>
        </div>
      )}

      {sorted.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '72px 120px 70px 80px 60px 60px 60px 60px 80px 80px 50px 90px', gap: 0, padding: '6px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 8, color: C.ghost, letterSpacing: 1 }}>
            {['TICKER','SIGNAL','SCORE','BULL%','RSI','STOCH','MACD','SAR','STOP','TARGET 1','R:R',''].map(h => (
              <div key={h} style={{ padding: '0 4px' }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {sorted.map(row => {
            const acol = row.color || C.dim;
            const rsiBg = row.rsi != null
              ? row.rsi < 30 ? `${C.green}15` : row.rsi > 70 ? `${C.red}12` : 'transparent'
              : 'transparent';

            return (
              <div key={row.ticker} onClick={() => onAnalyze(row.ticker)}
                style={{ display: 'grid', gridTemplateColumns: '72px 120px 70px 80px 60px 60px 60px 60px 80px 80px 50px 90px', gap: 0, padding: '8px 12px', borderBottom: `1px solid rgba(255,255,255,0.04)`, cursor: 'pointer', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                {/* Ticker */}
                <div style={{ padding: '0 4px', fontSize: 12, fontWeight: 800, color: C.green }}>{row.ticker}</div>

                {/* Signal */}
                <div style={{ padding: '0 4px' }}>
                  {row.error ? (
                    <span style={{ fontSize: 9, color: C.red }}>ERROR</span>
                  ) : (
                    <span style={{ padding: '3px 7px', background: `${acol}18`, border: `1px solid ${acol}35`, borderRadius: 4, fontSize: 9, color: acol, fontWeight: 700, whiteSpace: 'nowrap' }}>{row.action}</span>
                  )}
                </div>

                {/* Score */}
                <div style={{ padding: '0 4px', fontSize: 12, fontWeight: 700, color: row.score >= 0 ? C.green : C.red }}>{row.score > 0 ? `+${row.score}` : row.score}</div>

                {/* Bull% bar */}
                <div style={{ padding: '0 4px' }}>
                  <div style={{ fontSize: 9, color: C.sub, marginBottom: 2 }}>{row.bull_pct}%</div>
                  <div style={{ width: '100%', height: 4, background: `${C.red}20`, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${row.bull_pct ?? 50}%`, background: row.bull_pct != null && row.bull_pct >= 55 ? C.green : C.red, borderRadius: 2 }} />
                  </div>
                </div>

                {/* RSI */}
                <div style={{ padding: '2px 6px', background: rsiBg, borderRadius: 4, fontSize: 11, fontWeight: 600, color: row.rsi != null && row.rsi < 30 ? C.green : row.rsi != null && row.rsi > 70 ? C.red : C.sub }}>
                  {row.rsi?.toFixed(0) ?? '—'}
                </div>

                {/* Stoch%K */}
                <div style={{ padding: '0 4px', fontSize: 11, color: row.stoch_k != null && row.stoch_k < 20 ? C.green : row.stoch_k != null && row.stoch_k > 80 ? C.red : C.sub }}>
                  {row.stoch_k?.toFixed(0) ?? '—'}
                </div>

                {/* MACD direction */}
                <div style={{ padding: '0 4px', fontSize: 11 }}>
                  {row.macd_bull === undefined ? '—' : row.macd_bull
                    ? <span style={{ color: C.green }}>▲ Bull</span>
                    : <span style={{ color: C.red }}>▼ Bear</span>}
                </div>

                {/* SAR */}
                <div style={{ padding: '0 4px', fontSize: 10 }}>
                  {row.sar_trend === 'uptrend'
                    ? <span style={{ color: C.green }}>↑ Up</span>
                    : <span style={{ color: C.red }}>↓ Down</span>}
                </div>

                {/* Stop */}
                <div style={{ padding: '0 4px', fontSize: 10, color: C.red }}>{row.stop != null ? `$${row.stop}` : '—'}</div>

                {/* T1 */}
                <div style={{ padding: '0 4px', fontSize: 10, color: C.yellow }}>{row.t1 != null ? `$${row.t1}` : '—'}</div>

                {/* R:R */}
                <div style={{ padding: '0 4px', fontSize: 10, color: C.blue }}>{row.rr != null ? `1:${row.rr}` : '—'}</div>

                {/* Analyze button */}
                <div style={{ padding: '0 4px' }}>
                  <button onClick={e => { e.stopPropagation(); onAnalyze(row.ticker); }}
                    style={{ padding: '4px 9px', background: `${C.green}0c`, border: `1px solid ${C.green}28`, borderRadius: 5, color: C.green, fontSize: 9, fontFamily: C.font, cursor: 'pointer', fontWeight: 700 }}>
                    ⚡ AI
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 8, color: C.ghost, marginTop: 14, letterSpacing: 1 }}>
        17-FACTOR CONFLUENCE ENGINE · DATA VIA YAHOO FINANCE · NOT FINANCIAL ADVICE
      </div>
    </div>
  );
}