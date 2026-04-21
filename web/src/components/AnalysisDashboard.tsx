import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import TradingViewTickerTape from './TradingViewTickerTape';
import TradingViewChart from './TradingViewChart';
import TradingViewTechnicals from './TradingViewTechnicals';
import TradingViewMiniChart from './TradingViewMiniChart';

const HORIZONS = [
  { id: 'day', label: 'Day Trade' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'longterm', label: 'Long Term' },
];

const SECTION_META: Record<string, { title: string; color: string }> = {
  executiveSummary:  { title: '⚡ Executive Summary',     color: '#00ff88' },
  marketPulse:       { title: '📡 Market Pulse',          color: '#00d4ff' },
  technicalAnalysis: { title: '📐 Technical Analysis',    color: '#fbbf24' },
  supportResistance: { title: '🎯 Support & Resistance',  color: '#f97316' },
  fundamentals:      { title: '🏛 Fundamentals',          color: '#34d399' },
  entryExitSignals:  { title: '🚦 Entry / Exit Signals',  color: '#ff6b6b' },
  bullBearScorecard: { title: '🐂🐻 Bull/Bear Scorecard', color: '#ff9f43' },
  riskFactors:       { title: '⚠️ Risk Factors',          color: '#ef4444' },
  tradePlan:         { title: '📋 Trade Plan',            color: '#00ff88' },
};

const VERDICT_COLORS: Record<string, string> = {
  STRONG_BULL: '#00ff88', MILD_BULL: '#fbbf24',
  NEUTRAL: '#94a3b8', MILD_BEAR: '#fb923c', STRONG_BEAR: '#ef4444',
};

function SectionCard({ sectionKey, data }: { sectionKey: string; data: any }) {
  const [open, setOpen] = useState(true);
  const meta = SECTION_META[sectionKey];
  if (!meta || !data) return null;
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <div style={{ background: 'rgba(255,255,255,0.018)', border: `1px solid ${meta.color}20`, borderLeft: `3px solid ${meta.color}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: meta.color, fontFamily: 'monospace', textAlign: 'left' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{meta.title}</span>
        <span style={{ fontSize: 9, opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${meta.color}15` }}>
          <pre style={{ color: '#8ba0b0', fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'monospace' }}>
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AnalysisDashboard() {
  const { runAnalysis, isAnalyzing, analysisError, currentAnalysis, clearAnalysisError, logout, user } = useStore();
  const navigate = useNavigate();
  const [ticker, setTicker] = useState('');
  const [horizon, setHorizon] = useState('weekly');
  const [customPrompt, setCustomPrompt] = useState('');
  const [chartInterval, setChartInterval] = useState<'D' | '60' | '15' | 'W'>('D');

  // The ticker shown in TradingView (committed on Enter / Run Analysis)
  const [chartTicker, setChartTicker] = useState('AAPL');

  const handleAnalyze = async () => {
    if (!ticker.trim()) return;
    const t = ticker.trim().toUpperCase();
    setChartTicker(t);
    clearAnalysisError();
    await runAnalysis(t, horizon, customPrompt || undefined);
  };

  const a = currentAnalysis;
  const verdictColor = a ? (VERDICT_COLORS[a.verdict] || '#64748b') : '#64748b';

  const INTERVALS: { label: string; value: 'D' | '60' | '15' | 'W' }[] = [
    { label: '15m', value: '15' },
    { label: '1h',  value: '60' },
    { label: '1D',  value: 'D'  },
    { label: '1W',  value: 'W'  },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#06101a', fontFamily: 'JetBrains Mono, Fira Code, monospace', color: '#c8d6e0' }}>
      <style>{`
        @media (max-width: 768px) {
          .axiom-two-col { grid-template-columns: 1fr !important; }
          .axiom-verdict-row { flex-direction: column !important; }
          .axiom-verdict-row > div { min-width: 0 !important; }
          .axiom-ticker-input { width: 100% !important; font-size: 16px !important; }
          .axiom-signals-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      {/* Grid bg */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(0,255,136,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.022) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />

      {/* ── TradingView Ticker Tape ── */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <TradingViewTickerTape />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '28px 16px 48px' }}>

        {/* Top bar with user info + logout */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 3, background: 'linear-gradient(90deg,#00ff88,#00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AXIOM</span>
            {user && <span style={{ fontSize: 9, color: '#2a4050', letterSpacing: 1 }}>· {user.username || user.email || 'Trader'}</span>}
            {user?.role === 'ADMIN' && (
              <span style={{ padding: '2px 8px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 99, fontSize: 8, color: '#a78bfa', fontWeight: 700, letterSpacing: 1 }}>
                👑 ADMIN
              </span>
            )}
          </div>
          <button onClick={async () => { await logout(); navigate('/'); }}
            style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, color: '#2a4050', fontSize: 9, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: 1 }}>
            LOG OUT
          </button>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88', display: 'inline-block' }} />
            <span style={{ fontSize: 9, letterSpacing: 4, color: '#00ff88' }}>AXIOM TRADING INTELLIGENCE</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88', display: 'inline-block' }} />
          </div>          <h1 style={{ margin: '0 0 6px', fontSize: 'clamp(22px,4vw,36px)', fontWeight: 800, letterSpacing: -1, background: 'linear-gradient(120deg,#00ff88 0%,#00d4ff 45%,#a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AI Stock Analysis Agent
          </h1>
          <p style={{ margin: 0, fontSize: 10, color: '#2a4050', letterSpacing: 2 }}>TECHNICAL · FUNDAMENTAL · ENTRY/EXIT · TRADE PLAN</p>
        </div>

        {/* Input */}
        <div style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 8, letterSpacing: 2, color: '#2a4050', marginBottom: 6 }}>TICKER</div>
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase().replace(/[^A-Z.]/g, ''))} onKeyDown={e => e.key === 'Enter' && handleAnalyze()} placeholder="AAPL" maxLength={8}
                style={{ width: 110, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,136,0.35)', borderRadius: 8, padding: '10px 12px', color: '#00ff88', fontSize: 20, fontWeight: 800, fontFamily: 'inherit', letterSpacing: 3, outline: 'none' }} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: '#2a4050', marginBottom: 6 }}>HORIZON</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {HORIZONS.map(h => (
                  <button key={h.id} onClick={() => setHorizon(h.id)}
                    style={{ padding: '8px 12px', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', background: horizon === h.id ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.03)', border: horizon === h.id ? '1px solid rgba(0,255,136,0.6)' : '1px solid rgba(255,255,255,0.07)', color: horizon === h.id ? '#00ff88' : '#3d5a6e' }}>
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: '#2a4050', marginBottom: 6 }}>CUSTOM PROMPT (OPTIONAL)</div>
            <input value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="e.g. Compare with MSFT, check earnings date..."
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 14px', color: '#c8d6e0', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
          </div>

          {analysisError && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>⚠️ {analysisError}</div>}

          <button onClick={handleAnalyze} disabled={isAnalyzing || !ticker.trim()}
            style={{ width: '100%', padding: 13, background: isAnalyzing || !ticker.trim() ? 'rgba(0,255,136,0.03)' : 'linear-gradient(135deg,rgba(0,255,136,0.16),rgba(0,212,255,0.12))', border: `1px solid ${isAnalyzing || !ticker.trim() ? 'rgba(0,255,136,0.1)' : 'rgba(0,255,136,0.35)'}`, borderRadius: 9, color: isAnalyzing || !ticker.trim() ? '#1e3040' : '#00ff88', fontSize: 11, letterSpacing: 3, fontWeight: 700, fontFamily: 'inherit', cursor: isAnalyzing || !ticker.trim() ? 'not-allowed' : 'pointer' }}>
            {isAnalyzing ? '⟳ ANALYZING...' : '⚡ RUN FULL ANALYSIS'}
          </button>
        </div>

        {/* ── TradingView Advanced Chart (always visible, updates on analyze) ── */}
        <div>
          {/* Chart interval switcher */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, justifyContent: 'flex-end' }}>
            {INTERVALS.map(iv => (
              <button key={iv.value} onClick={() => setChartInterval(iv.value)}
                style={{ padding: '5px 10px', borderRadius: 5, fontSize: 10, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', background: chartInterval === iv.value ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.03)', border: chartInterval === iv.value ? '1px solid rgba(0,255,136,0.5)' : '1px solid rgba(255,255,255,0.07)', color: chartInterval === iv.value ? '#00ff88' : '#3d5a6e' }}>
                {iv.label}
              </button>
            ))}
          </div>
          <TradingViewChart ticker={chartTicker} interval={chartInterval} height={520} />
        </div>

        {/* ── Analysis result + TradingView widgets side by side ── */}
        {a && (
          <>
            <div className="axiom-verdict-row" style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ flexShrink: 0, background: verdictColor + '12', border: `1px solid ${verdictColor}30`, borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: verdictColor, lineHeight: 1 }}>{a.overallScore}</div>
                <div>
                  <div style={{ fontSize: 8, letterSpacing: 2, color: '#2a4050' }}>SCORE</div>
                  <div style={{ fontSize: 10, color: verdictColor, fontWeight: 700 }}>/100</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 22 }}>{a.verdict?.includes('BULL') ? '🐂' : a.verdict?.includes('BEAR') ? '🐻' : '⚖️'}</span>
                <div>
                  <div style={{ fontSize: 8, letterSpacing: 2, color: '#2a4050', marginBottom: 2 }}>{horizon.toUpperCase()} VERDICT</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: verdictColor }}>{a.verdict?.replace('_', ' ')}</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#00ff88', letterSpacing: 2 }}>{a.ticker}</div>
                  <div style={{ fontSize: 10, color: '#3d5a6e' }}>${a.entryLow?.toFixed(2)} entry</div>
                </div>
              </div>
            </div>

            {/* Trade signals grid */}
            <div className="axiom-signals-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'ENTRY LOW',   value: `$${a.entryLow?.toFixed(2)}`,    color: '#00ff88' },
                { label: 'ENTRY HIGH',  value: `$${a.entryHigh?.toFixed(2)}`,   color: '#00ff88' },
                { label: 'STOP LOSS',   value: `$${a.stopLoss?.toFixed(2)}`,    color: '#ef4444' },
                { label: 'TARGET 1',    value: `$${a.target1?.toFixed(2)}`,     color: '#fbbf24' },
                { label: 'TARGET 2',    value: `$${a.target2?.toFixed(2)}`,     color: '#fbbf24' },
                { label: 'TARGET 3',    value: `$${a.target3?.toFixed(2)}`,     color: '#fbbf24' },
                { label: 'RISK/REWARD', value: `1:${a.riskReward?.toFixed(1)}`, color: '#00d4ff' },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 8, letterSpacing: 1, color: '#2a4050', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Two-column layout: AI sections left, TradingView widgets right */}
            <div className="axiom-two-col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 14, alignItems: 'start' }}>
              <div>
                {Object.entries(SECTION_META).map(([key]) => (
                  <SectionCard key={key} sectionKey={key} data={(a as any)[key]} />
                ))}
              </div>
              <div>
                <TradingViewMiniChart ticker={a.ticker} />
                <TradingViewTechnicals ticker={a.ticker} />
              </div>
            </div>
          </>
        )}

        {!a && !isAnalyzing && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#1a2a35', fontSize: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>📊</div>
            Enter a ticker symbol and press RUN FULL ANALYSIS
            <div style={{ marginTop: 8, fontSize: 10, color: '#0e1e26' }}>
              Try: AAPL · NVDA · TSLA · MSFT · AMZN · META · GOOGL
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 9, color: '#0e1e26', letterSpacing: 1 }}>
          AXIOM v1.0 · NOT FINANCIAL ADVICE · ALWAYS DYOR
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        input:focus { border-color: rgba(0,255,136,0.5) !important; box-shadow: 0 0 0 2px rgba(0,255,136,0.07) !important; }
        input::placeholder { color: #1a2e38; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.15); border-radius: 3px; }
        @media (max-width: 768px) {
          .tv-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

