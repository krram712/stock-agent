import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

const FEATURES = [
  { icon: '📡', title: 'Live Market Data', desc: 'Real-time quotes & OHLCV from Yahoo Finance — no API key needed, always free.' },
  { icon: '📐', title: 'Technical Analysis', desc: 'RSI, MACD, Bollinger Bands, ATR, ADX, Stochastic, Williams %R, OBV, CMF and more.' },
  { icon: '🎯', title: 'Entry / Exit Signals', desc: 'ATR-based entry zones, stop loss, 3 profit targets, and real risk/reward ratios.' },
  { icon: '🐂🐻', title: 'Bull/Bear Scorecard', desc: 'Composite 0-100 score across trend, momentum, volume, setup & pattern layers.' },
  { icon: '🏛', title: 'Fundamentals', desc: 'P/E, PEG, P/B, revenue growth, net margin, ROE, debt/equity, analyst targets.' },
  { icon: '📋', title: 'AI Trade Plan', desc: 'GPT-powered narrative with executive summary, risk factors, and horizon-specific plan.' },
];

const TICKERS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'JPM', 'V', 'BRK.B'];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [activeTicker, setActiveTicker] = useState(0);

  // If already logged in, go straight to dashboard
  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user]);

  // Rotate ticker marquee
  useEffect(() => {
    const id = setInterval(() => setActiveTicker(t => (t + 1) % TICKERS.length), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#06101a', fontFamily: 'JetBrains Mono, Fira Code, monospace', color: '#c8d6e0', overflowX: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes scanline { 0%{top:-10%} 100%{top:110%} }
        .axiom-btn-primary { transition: all 0.2s; }
        .axiom-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 24px rgba(0,255,136,0.3) !important; }
        .axiom-btn-secondary:hover { border-color: rgba(0,212,255,0.6) !important; color: #00d4ff !important; }
        .feature-card:hover { transform: translateY(-4px); border-color: rgba(0,255,136,0.3) !important; }
        .feature-card { transition: all 0.25s; }
        @media (max-width:768px) { .hero-grid { grid-template-columns: 1fr !important; } .features-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Grid bg */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(0,255,136,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.022) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />

      {/* NAV */}
      <nav style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', borderBottom: '1px solid rgba(0,255,136,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 10px #00ff88', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 3, background: 'linear-gradient(90deg,#00ff88,#00d4ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AXIOM</span>
          <span style={{ fontSize: 9, color: '#2a4050', letterSpacing: 2, marginLeft: 2 }}>v1.0</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/login')} className="axiom-btn-secondary"
            style={{ padding: '8px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#8ba0b0', fontSize: 11, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', letterSpacing: 1 }}>
            LOG IN
          </button>
          <button onClick={() => navigate('/login?tab=register')} className="axiom-btn-primary"
            style={{ padding: '8px 20px', background: 'linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,212,255,0.15))', border: '1px solid rgba(0,255,136,0.4)', borderRadius: 8, color: '#00ff88', fontSize: 11, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', letterSpacing: 1 }}>
            GET STARTED
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '72px 24px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 99, marginBottom: 28 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 9, letterSpacing: 3, color: '#00ff88' }}>LIVE MARKET DATA · AI-POWERED · FREE FOREVER</span>
          </div>

          <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(32px,6vw,62px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: -2, background: 'linear-gradient(120deg,#00ff88 0%,#00d4ff 50%,#a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AI Stock Analysis<br />You Can Actually Trust
          </h1>
          <p style={{ margin: '0 auto 36px', maxWidth: 520, fontSize: 14, color: '#4a6070', lineHeight: 1.8 }}>
            Real-time technical &amp; fundamental analysis powered by Yahoo Finance + GPT.
            Entry zones, stop loss, 3 profit targets, risk/reward — all in one click.
          </p>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <button onClick={() => navigate('/login?tab=register')} className="axiom-btn-primary"
              style={{ padding: '14px 36px', background: 'linear-gradient(135deg,rgba(0,255,136,0.18),rgba(0,212,255,0.14))', border: '1px solid rgba(0,255,136,0.45)', borderRadius: 10, color: '#00ff88', fontSize: 12, fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer', letterSpacing: 2 }}>
              ⚡ START FREE ANALYSIS
            </button>
            <button onClick={() => navigate('/login')} className="axiom-btn-secondary"
              style={{ padding: '14px 36px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#8ba0b0', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', letterSpacing: 2 }}>
              LOG IN →
            </button>
          </div>

          {/* Live ticker strip */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#2a4050', letterSpacing: 2 }}>SUPPORTED:</span>
            {TICKERS.map((t, i) => (
              <span key={t} style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: 1, background: activeTicker === i ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.03)', border: activeTicker === i ? '1px solid rgba(0,255,136,0.4)' : '1px solid rgba(255,255,255,0.06)', color: activeTicker === i ? '#00ff88' : '#2a4050', transition: 'all 0.3s' }}>
                {t}
              </span>
            ))}
            <span style={{ fontSize: 9, color: '#2a4050' }}>+ ANY US TICKER</span>
          </div>
        </div>

        {/* DASHBOARD PREVIEW */}
        <div style={{ position: 'relative', marginBottom: 80, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(0,255,136,0.12)', boxShadow: '0 0 60px rgba(0,255,136,0.04)' }}>
          <div style={{ background: 'rgba(0,0,0,0.6)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(0,255,136,0.08)' }}>
            {['#ef4444','#fbbf24','#00ff88'].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />)}
            <span style={{ fontSize: 9, color: '#2a4050', letterSpacing: 2, marginLeft: 8 }}>AXIOM TRADING INTELLIGENCE · LIVE</span>
          </div>
          {/* Fake dashboard preview */}
          <div style={{ background: '#080f18', padding: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'ENTRY LOW', value: '$178.20', color: '#00ff88' },
                { label: 'ENTRY HIGH', value: '$181.50', color: '#00ff88' },
                { label: 'STOP LOSS', value: '$174.60', color: '#ef4444' },
                { label: 'TARGET 1', value: '$189.40', color: '#fbbf24' },
                { label: 'TARGET 2', value: '$196.80', color: '#fbbf24' },
                { label: 'RISK/REWARD', value: '1:2.8', color: '#00d4ff' },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 8, letterSpacing: 1, color: '#2a4050', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 8 }}>
              <div style={{ background: 'rgba(0,255,136,0.03)', border: '1px solid rgba(0,255,136,0.1)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 9, color: '#00ff88', letterSpacing: 2, marginBottom: 8 }}>⚡ EXECUTIVE SUMMARY</div>
                <div style={{ fontSize: 11, color: '#3d5a6e', lineHeight: 1.8 }}>AAPL shows strong bullish momentum with EMA20 &gt; EMA50 &gt; EMA200 alignment. RSI at 62 in healthy bull zone. MACD positive crossover confirmed. Volume OBV rising. Bollinger squeeze breakout imminent...</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.25)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#00ff88' }}>74</div>
                  <div style={{ fontSize: 8, color: '#2a4050', letterSpacing: 1 }}>BULL/BEAR SCORE</div>
                  <div style={{ fontSize: 10, color: '#00ff88', fontWeight: 700, marginTop: 4 }}>STRONG BULL 🐂</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: 10 }}>
                  {[['RSI', '62.4'], ['MACD', '+0.85'], ['ADX', '28.2'], ['CMF', '+0.12']].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#2a4050' }}>
                      <span>{k}</span><span style={{ color: '#00ff88' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Overlay CTA */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(6,16,26,0.95) 100%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 28 }}>
            <button onClick={() => navigate('/login?tab=register')} className="axiom-btn-primary"
              style={{ padding: '12px 32px', background: 'linear-gradient(135deg,rgba(0,255,136,0.22),rgba(0,212,255,0.18))', border: '1px solid rgba(0,255,136,0.5)', borderRadius: 10, color: '#00ff88', fontSize: 11, fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer', letterSpacing: 2 }}>
              ⚡ GET FREE ACCESS →
            </button>
          </div>
        </div>

        {/* FEATURES */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 9, letterSpacing: 4, color: '#00ff88', marginBottom: 10 }}>WHAT YOU GET</div>
            <h2 style={{ margin: 0, fontSize: 'clamp(20px,3vw,32px)', fontWeight: 800, color: '#c8d6e0' }}>Everything a Trader Needs</h2>
          </div>
          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card"
                style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '20px 18px' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#c8d6e0', marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 11, color: '#3d5a6e', lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div style={{ marginBottom: 72, textAlign: 'center' }}>
          <div style={{ fontSize: 9, letterSpacing: 4, color: '#00ff88', marginBottom: 10 }}>HOW IT WORKS</div>
          <h2 style={{ margin: '0 0 36px', fontSize: 'clamp(20px,3vw,32px)', fontWeight: 800, color: '#c8d6e0' }}>3 Steps to Any Analysis</h2>
          <div style={{ display: 'flex', gap: 0, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { step: '01', title: 'Enter Ticker', desc: 'Type any US stock ticker — AAPL, NVDA, TSLA...' },
              { step: '02', title: 'Choose Horizon', desc: 'Day Trade, Weekly, Monthly, Quarterly, or Long Term' },
              { step: '03', title: 'Get Full Analysis', desc: 'Instant AI report with entry, exit, score, and trade plan' },
            ].map((s, i) => (
              <div key={s.step} style={{ flex: '1 1 200px', padding: '24px 20px', position: 'relative' }}>
                {i < 2 && <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#1a2a35' }}>→</div>}
                <div style={{ fontSize: 32, fontWeight: 900, color: 'rgba(0,255,136,0.15)', marginBottom: 8, letterSpacing: -1 }}>{s.step}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c8d6e0', marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: '#3d5a6e', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FINAL CTA */}
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'rgba(0,255,136,0.03)', border: '1px solid rgba(0,255,136,0.08)', borderRadius: 16, marginBottom: 48 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 'clamp(20px,3vw,30px)', fontWeight: 800, color: '#c8d6e0' }}>Ready to Trade Smarter?</h2>
          <p style={{ margin: '0 0 28px', color: '#3d5a6e', fontSize: 12 }}>No credit card. No API keys. Just sign up and start analyzing.</p>
          <button onClick={() => navigate('/login?tab=register')} className="axiom-btn-primary"
            style={{ padding: '14px 44px', background: 'linear-gradient(135deg,rgba(0,255,136,0.2),rgba(0,212,255,0.15))', border: '1px solid rgba(0,255,136,0.45)', borderRadius: 10, color: '#00ff88', fontSize: 12, fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer', letterSpacing: 2 }}>
            ⚡ CREATE FREE ACCOUNT
          </button>
          <div style={{ marginTop: 14, fontSize: 10, color: '#1a2a35' }}>Already have an account? <span onClick={() => navigate('/login')} style={{ color: '#00d4ff', cursor: 'pointer' }}>Log in</span></div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 9, color: '#0e1e26', letterSpacing: 1, paddingBottom: 24 }}>
          AXIOM v1.0 · NOT FINANCIAL ADVICE · ALWAYS DYOR · DATA FROM YAHOO FINANCE
        </div>
      </div>
    </div>
  );
}

