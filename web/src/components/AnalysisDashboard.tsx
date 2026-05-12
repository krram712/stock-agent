import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import TradingViewTickerTape from './TradingViewTickerTape';
import TradingViewChart from './TradingViewChart';
import TechCharts from './TechCharts';
import TradingViewTechnicals from './TradingViewTechnicals';
import TradingViewMiniChart from './TradingViewMiniChart';
import { useTradingViewSignals } from '../hooks/useTradingViewSignals';
import OptionsEngine from './OptionsEngine';
import FinvizPanel from './FinvizPanel';
import ScriptsTab from './ScriptsTab';
import WatchlistTab from './WatchlistTab';

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:      '#06101a',
  sidebar: 'rgba(5,13,22,0.99)',
  panel:   'rgba(255,255,255,0.022)',
  border:  'rgba(255,255,255,0.07)',
  green:   '#00ff88',
  blue:    '#00d4ff',
  purple:  '#a78bfa',
  yellow:  '#fbbf24',
  red:     '#ef4444',
  orange:  '#f97316',
  txt:     '#c8d6e0',
  sub:     '#8ba0b0',
  dim:     '#3d5a6e',
  ghost:   '#2a4050',
  font:    'JetBrains Mono, Fira Code, monospace',
};

// ─── Constants ────────────────────────────────────────────────────────────────
const HORIZONS = [
  { id: 'day',       label: 'Day'   },
  { id: 'weekly',    label: 'Week'  },
  { id: 'monthly',   label: 'Month' },
  { id: 'quarterly', label: 'Qtr'   },
  { id: 'longterm',  label: 'Long'  },
];
const QUICK_TICKERS = ['NVDA','AAPL','MSFT','TSLA','AMZN','META','GOOGL','AMD'];
const INTERVALS = [
  { label: '15m', value: '15' as const },
  { label: '1h',  value: '60' as const },
  { label: '1D',  value: 'D'  as const },
  { label: '1W',  value: 'W'  as const },
];
const TECH_SUB_TABS = [
  { id: 'charts',     label: '📊 Charts'     },
  { id: 'confluence', label: '⚡ Confluence'  },
  { id: 'indicators', label: '📐 Indicators' },
  { id: 'fibonacci',  label: '🌀 Fibonacci'  },
  { id: 'signals',    label: '📡 Signals'    },
  { id: 'research',   label: '🔬 Research'   },
];
function getSignalTrend(history: any[]): { symbol: string; label: string } {
  if (history.length < 2) return { symbol: '→', label: 'Stable' };
  const latest = history[history.length - 1].score;
  const prev   = history[history.length - 2].score;
  if (latest > prev + 1) return { symbol: '↑', label: 'Strengthening' };
  if (latest < prev - 1) return { symbol: '↓', label: 'Weakening' };
  return { symbol: '→', label: 'Stable' };
}
function getGuidance(trend: string, mode: string, score: number): { icon: string; text: string; col: string } {
  const bull = score >= 3;
  if (bull) {
    if (mode === 'watching') {
      if (trend === '↑') return { icon: '🚀', text: 'Signal strengthening — consider entry near current price. Set stop at the Stop level.', col: '#00ff88' };
      if (trend === '→') return { icon: '✅', text: 'Bullish signal holding steady — valid entry, set stop at the Stop level below.', col: '#3fb950' };
      return { icon: '⚠️', text: 'Signal fading — wait for confirmation before entering.', col: '#f0c040' };
    } else {
      if (trend === '↑') return { icon: '💪', text: 'Signal strengthening — consider adding at pullback to SMA20.', col: '#00ff88' };
      if (trend === '→') return { icon: '✅', text: 'Holding position looks valid — monitor for RSI or MACD changes.', col: '#3fb950' };
      return { icon: '⚠️', text: 'Signal weakening — consider partial profit taking or tightening stop.', col: '#ffa657' };
    }
  } else {
    return mode === 'watching'
      ? { icon: '🚫', text: 'Bearish signal — avoid new long positions. Wait for a confirmed reversal.', col: '#ff7b72' }
      : { icon: '🛡️', text: 'Bearish signal with open position — honour your stop loss.', col: '#ff7b72' };
  }
}
const VERDICT_COLORS: Record<string, string> = {
  STRONG_BULL: '#00ff88', MILD_BULL: '#86efac',
  NEUTRAL: '#94a3b8',
  MILD_BEAR: '#fb923c',   STRONG_BEAR: '#ef4444',
};
const SECTION_META: Record<string, { title: string; color: string }> = {
  signalStrength:    { title: '🎯 Signal Strength',       color: C.green  },
  executiveSummary:  { title: '⚡ Executive Summary',     color: C.green  },
  marketPulse:       { title: '📡 Market Pulse',          color: C.blue   },
  technicalAnalysis: { title: '📐 Technical Analysis',    color: C.yellow },
  supportResistance: { title: '🎯 Support & Resistance',  color: C.orange },
  fundamentals:      { title: '🏛 Fundamentals',          color: '#34d399'},
  entryExitSignals:  { title: '🚦 Entry / Exit Signals',  color: '#ff6b6b'},
  bullBearScorecard: { title: '🐂🐻 Bull/Bear Scorecard', color: '#ff9f43'},
  riskFactors:       { title: '⚠️ Risk Factors',          color: C.red   },
  tradePlan:         { title: '📋 Options Strategy',      color: C.purple },
};
const RESEARCH_SECTIONS = [
  { key: 'news',      label: '📰 News',     prompt: 'latest news and headlines today',                           color: C.blue   },
  { key: 'analyst',   label: '⭐ Ratings',  prompt: 'analyst price target buy sell rating recommendations 2026', color: C.yellow },
  { key: 'earnings',  label: '📢 Earnings', prompt: 'upcoming earnings results revenue EPS forecast',            color: C.green  },
  { key: 'sentiment', label: '🐦 Sentiment',prompt: 'market sentiment retail institutional investor opinion',    color: C.purple },
] as const;

type ResearchState = { loading: boolean; result: string | null; provider: string | null; error: string | null; fetchedAt: string | null };
const EMPTY_RS = (): ResearchState => ({ loading: false, result: null, provider: null, error: null, fetchedAt: null });

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionCard({ sectionKey, data }: { sectionKey: string; data: any }) {
  const [open, setOpen] = useState(true);
  const meta = SECTION_META[sectionKey];
  if (!meta || !data) return null;
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <div style={{ background: C.panel, border: `1px solid ${meta.color}18`, borderLeft: `3px solid ${meta.color}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '11px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: meta.color, fontFamily: C.font, textAlign: 'left' }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{meta.title}</span>
        <span style={{ fontSize: 9, opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${meta.color}12` }}>
          <pre style={{ color: C.sub, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: C.font }}>{content}</pre>
        </div>
      )}
    </div>
  );
}

interface NavItemProps { icon: string; label: string; active: boolean; badge?: number; collapsed: boolean; onClick: () => void }
function NavItem({ icon, label, active, badge, collapsed, onClick }: NavItemProps) {
  return (
    <button onClick={onClick} title={collapsed ? label : undefined} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: collapsed ? '12px 0' : '11px 16px',
      justifyContent: collapsed ? 'center' : 'flex-start',
      background: active ? `${C.green}0f` : 'transparent',
      border: 'none', borderLeft: `3px solid ${active ? C.green : 'transparent'}`,
      color: active ? C.green : C.dim,
      cursor: 'pointer', fontFamily: C.font, fontSize: 11,
      fontWeight: active ? 700 : 400, letterSpacing: 1,
      transition: 'all 0.15s', position: 'relative',
    }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>}
      {!collapsed && badge != null && badge > 0 && (
        <span style={{ padding: '1px 6px', background: `${C.green}18`, border: `1px solid ${C.green}30`, borderRadius: 99, fontSize: 9, color: C.green, fontWeight: 700 }}>{badge}</span>
      )}
      {collapsed && badge != null && badge > 0 && (
        <span style={{ position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: '50%', background: C.green }} />
      )}
    </button>
  );
}

function ConfluenceChecklist({ checklist }: { checklist: any[] }) {
  const [open, setOpen] = useState(false);
  if (!checklist?.length) return null;
  return (
    <div style={{ borderTop: `1px solid rgba(255,255,255,0.06)` }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '9px 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#3d5a6e', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>17-FACTOR CHECKLIST ({checklist.length} factors)</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {checklist.map((item: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 6px', borderRadius: 5, background: item.status === 'bull' ? 'rgba(0,255,136,0.04)' : item.status === 'bear' ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
              <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1 }}>{item.status === 'bull' ? '🟢' : item.status === 'bear' ? '🔴' : '⚪'}</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: item.status === 'bull' ? '#00ff88' : item.status === 'bear' ? '#ef4444' : '#8ba0b0' }}>{item.label} <span style={{ fontSize: 9, color: item.points > 0 ? '#00ff88' : item.points < 0 ? '#ef4444' : '#3d5a6e' }}>({item.points > 0 ? '+' : ''}{item.points})</span></div>
                <div style={{ fontSize: 9, color: '#3d5a6e', lineHeight: 1.4 }}>{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AnalysisDashboard() {
  const {
    runAnalysis, isAnalyzing, analysisError, currentAnalysis, clearAnalysisError,
    logout, user, loadHistory, analysisHistory, loadWatchlists, watchlists,
  } = useStore();
  const navigate = useNavigate();

  const [ticker,        setTicker]        = useState('');
  const [horizon,       setHorizon]       = useState('weekly');
  const [chartTicker,   setChartTicker]   = useState('AAPL');
  const [chartInterval, setChartInterval] = useState<'D'|'60'|'15'|'W'>('D');
  const [activeTab,     setActiveTab]     = useState('analysis');
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [mobileDrawer,  setMobileDrawer]  = useState(false);
  const [researchTab,   setResearchTab]   = useState('news');
  const [webResearch,   setWebResearch]   = useState<Record<string, ResearchState>>({});
  const [adminUsers,    setAdminUsers]    = useState<any[]>([]);
  const [adminLoading,  setAdminLoading]  = useState(false);
  const [techData,      setTechData]      = useState<any>(null);
  const [techLoading,   setTechLoading]   = useState(false);
  const [techError,     setTechError]     = useState<string | null>(null);
  const [chartMode,     setChartMode]     = useState<'custom' | 'tradingview'>('custom');
  const [techSubTab,    setTechSubTab]    = useState('charts');
  const [positionMode,  setPositionMode]  = useState<'watching' | 'in_position'>('watching');
  const [signalHistory, setSignalHistory] = useState<Record<string, any[]>>(() => {
    try { return JSON.parse(localStorage.getItem('signal_history_v1') || '{}'); } catch { return {}; }
  });

  const { signals: tvSignals, latestSignal, isConnected: tvConnected } = useTradingViewSignals(chartTicker);

  useEffect(() => { loadHistory().catch(() => {}); }, []);
  useEffect(() => { loadWatchlists().catch(() => {}); }, []);

  useEffect(() => {
    if (!techData) return;
    const key = `${techData.ticker}_${techData.period}`;
    const entry = { score: techData.score, bull_pct: techData.confluence.bull_pct, action: techData.action, timestamp: Date.now() };
    setSignalHistory(prev => {
      const hist = prev[key] || [];
      const last = hist[hist.length - 1];
      if (last && last.score === entry.score && (Date.now() - last.timestamp) < 4 * 3600000) return prev;
      const next = { ...prev, [key]: [...hist, entry].slice(-7) };
      try { localStorage.setItem('signal_history_v1', JSON.stringify(next)); } catch {}
      return next;
    });
  }, [techData]);

  const fetchTech = useCallback((t: string) => {
    setTechLoading(true);
    setTechError(null);
    setChartMode('custom');
    api.technical.analyze(t)
      .then(r => setTechData(r.data))
      .catch(e => setTechError(e.response?.data?.detail || e.message || 'Technical service unavailable'))
      .finally(() => setTechLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'scanner' && !techData && !techLoading) {
      const t = (ticker || chartTicker).trim().toUpperCase();
      if (t) fetchTech(t);
    }
  }, [activeTab]);

  const loadAdminUsers = useCallback(async () => {
    setAdminLoading(true);
    try { const r = await api.admin.listUsers(); setAdminUsers(r.data); } catch {}
    setAdminLoading(false);
  }, []);

  const handleApprove = async (id: string) => { await api.admin.approveUser(id); loadAdminUsers(); };
  const handleReject  = async (id: string) => { await api.admin.rejectUser(id);  loadAdminUsers(); };

  const handleAnalyze = useCallback(async (overrideTicker?: string, overrideHorizon?: string) => {
    const t  = (overrideTicker  || ticker).trim().toUpperCase();
    const hz = overrideHorizon  || horizon;
    if (!t) return;
    setTicker(t); setHorizon(hz); setChartTicker(t);
    clearAnalysisError();
    setActiveTab('analysis');
    setTechData(null);
    setTechError(null);
    fetchTech(t);

    const init: Record<string, ResearchState> = {};
    RESEARCH_SECTIONS.forEach(s => { init[s.key] = { loading: true, result: null, provider: null, error: null, fetchedAt: null }; });
    setWebResearch(init);

    RESEARCH_SECTIONS.forEach(section => {
      fetch('/ai-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticker: t, prompt: section.prompt }) })
        .then(r => r.json())
        .then(d => setWebResearch(prev => ({ ...prev, [section.key]: { loading: false, result: d.result || d.error || null, provider: d.provider || null, error: null, fetchedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) } })))
        .catch(() => setWebResearch(prev => ({ ...prev, [section.key]: { ...EMPTY_RS(), error: 'Failed to load' } })));
    });

    await runAnalysis(t, hz, undefined);
  }, [ticker, horizon, clearAnalysisError, runAnalysis]);

  const a = currentAnalysis;
  const verdictColor = a ? (VERDICT_COLORS[a.verdict] || '#64748b') : '#64748b';

  const NAV = [
    { id: 'analysis',  icon: '⚡', label: 'Analysis'                              },
    { id: 'scanner',   icon: '📐', label: 'Technical'                             },
    { id: 'signals',   icon: '📡', label: 'Live Signals', badge: tvSignals.length },
    { id: 'history',   icon: '📋', label: 'History',      badge: analysisHistory.length },
    { id: 'watchlist', icon: '👁',  label: 'Watchlist'                             },
    { id: 'options',   icon: '⚙️', label: 'Options Engine'                        },
    { id: 'scripts',   icon: '📜', label: 'Scripts'                               },
    ...(user?.role === 'ADMIN' ? [{ id: 'admin', icon: '👑', label: 'Admin' }] : []),
  ];

  const CSS = `
    @keyframes pulse     { 0%,100%{opacity:1}50%{opacity:.35} }
    @keyframes fadeIn    { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none} }
    @keyframes slideInL  { from{transform:translateX(-100%)}to{transform:translateX(0)} }
    *{box-sizing:border-box}
    ::-webkit-scrollbar{width:4px;height:4px}
    ::-webkit-scrollbar-thumb{background:rgba(0,255,136,0.12);border-radius:3px}
    input:focus{outline:none;border-color:${C.green}80!important;box-shadow:0 0 0 3px ${C.green}0c!important}
    input::placeholder{color:${C.ghost}}
    .ax-fade{animation:fadeIn 0.22s ease both}
    .ax-bottom-nav{display:none}
    .ax-mobile-drawer{display:none}
    .ax-hide-mobile{display:flex}
    @media(max-width:768px){
      .ax-sidebar{display:none!important}
      .ax-main{margin-left:0!important;width:100vw!important;max-width:100vw!important}
      .ax-2col{grid-template-columns:1fr!important}
      .ax-tv{order:-1}
      .ax-metrics{grid-template-columns:repeat(2,1fr)!important}
      .ax-bottom-nav{display:flex!important}
      .ax-content-pad{padding:10px 10px 100px!important}
      .ax-mobile-drawer{display:block!important}
      .ax-hide-mobile{display:none!important}
      .ax-topbar{flex-wrap:nowrap!important;gap:6px!important;overflow:hidden}
      .ax-topbar-input{flex-shrink:0}
      .ax-run-btn{padding:9px 14px!important;margin-left:auto!important}
    }
  `;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: C.font, color: C.txt, display: 'flex', flexDirection: 'column' }}>
      <style>{CSS}</style>

      {/* Grid background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(${C.green}07 1px,transparent 1px),linear-gradient(90deg,${C.green}07 1px,transparent 1px)`, backgroundSize: '48px 48px' }} />

      {/* Ticker tape */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <TradingViewTickerTape />
      </div>

      {/* Body: sidebar + main */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 1 }}>

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <aside className="ax-sidebar" style={{
          width: sidebarOpen ? 220 : 60, flexShrink: 0,
          transition: 'width 0.22s ease',
          position: 'sticky', top: 0, height: '100vh',
          overflowY: 'auto', overflowX: 'hidden',
          background: C.sidebar, borderRight: `1px solid ${C.green}10`,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Logo */}
          <div style={{ padding: sidebarOpen ? '18px 16px 14px' : '18px 0 14px', display: 'flex', alignItems: 'center', gap: 9, justifyContent: sidebarOpen ? 'flex-start' : 'center', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 10px ${C.green}`, flexShrink: 0, animation: 'pulse 2s infinite' }} />
            {sidebarOpen && (
              <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: 3, background: `linear-gradient(90deg,${C.green},${C.blue})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AXIOM</span>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, paddingTop: 8 }}>
            {NAV.map(item => (
              <NavItem key={item.id} icon={item.icon} label={item.label} badge={item.badge}
                active={activeTab === item.id} collapsed={!sidebarOpen}
                onClick={() => { setActiveTab(item.id); if (item.id === 'admin') loadAdminUsers(); }} />
            ))}
          </nav>

          {/* User info (expanded only) */}
          {sidebarOpen && user && (
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${C.green}15`, border: `1px solid ${C.green}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: C.green, fontWeight: 700, flexShrink: 0 }}>
                  {(user.firstName?.[0] || user.username?.[0] || user.email?.[0] || '?').toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: C.txt, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.firstName || user.username || user.email?.split('@')[0]}
                    {user.role === 'ADMIN' && <span style={{ marginLeft: 5, fontSize: 9, color: C.purple }}>ADMIN</span>}
                  </div>
                  <div style={{ fontSize: 9, color: C.dim }}>{user.subscriptionTier || 'FREE'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Logout */}
          <div style={{ padding: sidebarOpen ? '8px 12px 14px' : '8px 0 14px', display: 'flex', justifyContent: 'center' }}>
            <button onClick={async () => { await logout(); navigate('/'); }} title="Log out"
              style={{ padding: sidebarOpen ? '7px 14px' : '7px 10px', width: sidebarOpen ? '100%' : 38, borderRadius: 7, background: 'transparent', border: `1px solid ${C.border}`, color: C.dim, fontSize: sidebarOpen ? 10 : 13, fontFamily: C.font, cursor: 'pointer', letterSpacing: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {sidebarOpen ? '⏻ LOG OUT' : '⏻'}
            </button>
          </div>
        </aside>

        {/* ── Main ──────────────────────────────────────────────────────────── */}
        <main className="ax-main" style={{ flex: 1, minWidth: 0 }}>

          {/* Sticky top bar */}
          <div className="ax-topbar" style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(6,16,26,0.97)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${C.border}`, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

            {/* Hamburger — desktop: toggle sidebar width; mobile: open drawer */}
            <button onClick={() => { setSidebarOpen(o => !o); setMobileDrawer(o => !o); }} title="Toggle sidebar"
              style={{ padding: '6px 8px', background: 'transparent', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 16, fontFamily: C.font, flexShrink: 0, borderRadius: 5 }}>
              ☰
            </button>

            {/* Ticker input */}
            <div className="ax-topbar-input" style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', border: `1px solid ${C.green}40`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
              <span style={{ padding: '0 6px 0 10px', fontSize: 12, color: C.ghost, fontWeight: 700 }}>$</span>
              <input value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase().replace(/[^A-Z.]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                placeholder="AAPL" maxLength={8}
                style={{ width: 80, background: 'transparent', border: 'none', padding: '9px 10px 9px 0', color: C.green, fontSize: 15, fontWeight: 800, fontFamily: C.font, letterSpacing: 2 }} />
            </div>

            {/* Quick chips — hidden on mobile */}
            <div className="ax-hide-mobile" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {QUICK_TICKERS.map(t => (
                <button key={t} onClick={() => { setTicker(t); setChartTicker(t); }}
                  style={{ padding: '5px 9px', borderRadius: 5, fontSize: 10, fontFamily: C.font, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5, background: ticker === t ? `${C.green}18` : 'transparent', border: `1px solid ${ticker === t ? C.green + '55' : C.border}`, color: ticker === t ? C.green : C.dim, transition: 'all 0.12s' }}>
                  {t}
                </button>
              ))}
            </div>

            {/* Horizon pills — hidden on mobile */}
            <div className="ax-hide-mobile" style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              {HORIZONS.map(h => (
                <button key={h.id} onClick={() => setHorizon(h.id)}
                  style={{ padding: '5px 10px', borderRadius: 5, fontSize: 10, fontFamily: C.font, fontWeight: 600, cursor: 'pointer', background: horizon === h.id ? `${C.blue}18` : 'transparent', border: `1px solid ${horizon === h.id ? C.blue + '50' : C.border}`, color: horizon === h.id ? C.blue : C.dim }}>
                  {h.label}
                </button>
              ))}
            </div>

            {/* Run button */}
            <button className="ax-run-btn" onClick={() => handleAnalyze()} disabled={isAnalyzing || !ticker.trim()}
              style={{ padding: '9px 18px', borderRadius: 8, fontSize: 11, fontFamily: C.font, fontWeight: 700, letterSpacing: 1, flexShrink: 0, marginLeft: 'auto', cursor: isAnalyzing || !ticker.trim() ? 'not-allowed' : 'pointer', background: isAnalyzing || !ticker.trim() ? `${C.green}06` : `linear-gradient(135deg,${C.green}22,${C.blue}18)`, border: `1px solid ${isAnalyzing || !ticker.trim() ? C.green + '18' : C.green + '40'}`, color: isAnalyzing || !ticker.trim() ? C.ghost : C.green }}>
              {isAnalyzing ? '⟳' : '⚡ RUN'}
            </button>
          </div>

          {/* Chart — hidden on Technical tab (shown inline there instead) */}
          {activeTab !== 'scanner' && (
            <div style={{ padding: '12px 16px 0' }}>
              <div style={{ display: 'flex', gap: 5, marginBottom: 7, justifyContent: 'flex-end', alignItems: 'center' }}>
                <span style={{ fontSize: 8, color: C.ghost, letterSpacing: 1, marginRight: 2 }}>INTERVAL</span>
                {INTERVALS.map(iv => (
                  <button key={iv.value} onClick={() => setChartInterval(iv.value)}
                    style={{ padding: '4px 9px', borderRadius: 5, fontSize: 10, fontFamily: C.font, fontWeight: 600, cursor: 'pointer', background: chartInterval === iv.value ? `${C.green}15` : 'transparent', border: `1px solid ${chartInterval === iv.value ? C.green + '50' : C.border}`, color: chartInterval === iv.value ? C.green : C.dim }}>
                    {iv.label}
                  </button>
                ))}
              </div>
              <TradingViewChart ticker={chartTicker} interval={chartInterval} height={460} />
            </div>
          )}

          {/* Tab content */}
          <div style={{ padding: '14px 14px 80px' }} className="ax-fade ax-content-pad">

            {/* ── ANALYSIS ──────────────────────────────────────────────────── */}
            {activeTab === 'analysis' && (<>
              {isAnalyzing && (
                <div style={{ textAlign: 'center', padding: '56px 20px' }}>
                  <div style={{ fontSize: 32, color: C.green, animation: 'pulse 1.1s infinite', marginBottom: 14 }}>⚡</div>
                  <div style={{ fontSize: 13, color: C.green, fontWeight: 700, letterSpacing: 3, marginBottom: 6 }}>RUNNING LIVE ANALYSIS</div>
                  <div style={{ fontSize: 10, color: C.ghost }}>Fetching live market data · AI scoring · entry/exit calculation...</div>
                </div>
              )}

              {!isAnalyzing && analysisError && (
                <div style={{ background: `${C.red}08`, border: `1px solid ${C.red}25`, borderLeft: `3px solid ${C.red}`, borderRadius: 10, padding: '18px 22px', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: C.red, fontWeight: 700, marginBottom: 6 }}>⚠️ Analysis Failed</div>
                  <div style={{ fontSize: 11, color: C.sub, marginBottom: 14, fontFamily: C.font }}>{analysisError}</div>
                  <button onClick={() => { clearAnalysisError(); if (ticker.trim()) handleAnalyze(); }}
                    style={{ padding: '7px 16px', background: `${C.green}10`, border: `1px solid ${C.green}40`, borderRadius: 7, color: C.green, fontSize: 11, fontWeight: 700, fontFamily: C.font, cursor: 'pointer', letterSpacing: 1 }}>
                    ↻ RETRY
                  </button>
                </div>
              )}

              {a && !isAnalyzing && (<>
                {/* Verdict row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: `${verdictColor}0e`, border: `1px solid ${verdictColor}28`, borderRadius: 12, padding: '16px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: 42, fontWeight: 900, color: verdictColor, lineHeight: 1 }}>{a.overallScore}</div>
                    <div style={{ fontSize: 8, color: C.ghost, letterSpacing: 2, marginTop: 2 }}>/100</div>
                    <div style={{ width: '100%', height: 3, background: `${verdictColor}18`, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${a.overallScore}%`, background: verdictColor, borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 28 }}>{a.verdict?.includes('BULL') ? '🐂' : a.verdict?.includes('BEAR') ? '🐻' : '⚖️'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 8, letterSpacing: 2, color: C.ghost, marginBottom: 4 }}>{horizon.toUpperCase()} VERDICT</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: verdictColor, letterSpacing: 1 }}>{a.verdict?.replace(/_/g, ' ')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: C.green, letterSpacing: 2 }}>{a.ticker}</div>
                      {a.entryLow && <div style={{ fontSize: 10, color: C.dim }}>entry from ${a.entryLow?.toFixed(2)}</div>}
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="ax-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'ENTRY LOW',   value: `$${a.entryLow?.toFixed(2)}`,    color: C.green  },
                    { label: 'ENTRY HIGH',  value: `$${a.entryHigh?.toFixed(2)}`,   color: C.green  },
                    { label: 'STOP LOSS',   value: `$${a.stopLoss?.toFixed(2)}`,    color: C.red    },
                    { label: 'RISK/REWARD', value: `1:${a.riskReward?.toFixed(1)}`, color: C.blue   },
                    { label: 'TARGET 1',    value: `$${a.target1?.toFixed(2)}`,     color: C.yellow },
                    { label: 'TARGET 2',    value: `$${a.target2?.toFixed(2)}`,     color: C.yellow },
                    { label: 'TARGET 3',    value: `$${a.target3?.toFixed(2)}`,     color: C.yellow },
                    { label: 'HORIZON',     value: horizon.toUpperCase(),           color: C.purple },
                  ].map(item => (
                    <div key={item.label} style={{ background: C.panel, border: `1px solid ${item.color}15`, borderTop: `2px solid ${item.color}40`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 8, letterSpacing: 1, color: C.ghost, marginBottom: 5 }}>{item.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Technical confluence panel */}
                {(techData || techLoading) && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: C.ghost, letterSpacing: 2, marginBottom: 8 }}>17-FACTOR CONFLUENCE ENGINE</div>
                    {techLoading && !techData && (
                      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px', fontSize: 10, color: C.ghost }}>
                        ⟳ Computing technical indicators...
                      </div>
                    )}
                    {techData && (<>
                      {/* Score + checklist */}
                      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                        {/* Score bar */}
                        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 22, fontWeight: 900, color: techData.action_color }}>{techData.score > 0 ? `+${techData.score}` : techData.score}</span>
                            <div>
                              <div style={{ fontSize: 8, color: C.ghost, letterSpacing: 1 }}>TECHNICAL</div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: techData.action_color }}>{techData.action}</div>
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <div style={{ fontSize: 8, color: C.ghost, marginBottom: 4 }}>BULL/BEAR CONFLUENCE  {techData.confluence.bull_count}B · {techData.confluence.bear_count}R</div>
                            <div style={{ height: 6, background: `${C.red}20`, borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${techData.confluence.bull_pct}%`, background: techData.confluence.bull_pct >= 55 ? C.green : C.red, borderRadius: 3 }} />
                            </div>
                            <div style={{ fontSize: 8, color: C.ghost, marginTop: 2 }}>{techData.confluence.bull_pct}% Bull</div>
                          </div>
                          {/* Fibonacci quick levels */}
                          {techData.fibonacci && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {Object.entries(techData.fibonacci).map(([k, v]: any) => (
                                <div key={k} style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 7, color: C.ghost }}>{k}</div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: C.blue }}>${v}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Indicators grid */}
                        {techData.indicators && (
                          <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 6 }}>
                            {[
                              { k: 'RSI',      v: techData.indicators.rsi,      col: techData.indicators.rsi < 30 ? C.green : techData.indicators.rsi > 70 ? C.red : C.sub },
                              { k: 'MACD',     v: techData.indicators.macd,     col: techData.indicators.macd > techData.indicators.signal ? C.green : C.red },
                              { k: 'Stoch %K', v: techData.indicators.stoch_k,  col: techData.indicators.stoch_k < 20 ? C.green : techData.indicators.stoch_k > 80 ? C.red : C.sub },
                              { k: 'ATR',      v: techData.indicators.atr,      col: C.yellow },
                              { k: 'VWAP',     v: `$${techData.indicators.vwap}`, col: C.blue  },
                              { k: 'SMA20',    v: `$${techData.indicators.sma20}`, col: C.yellow },
                              { k: 'SMA50',    v: `$${techData.indicators.sma50}`, col: C.orange },
                              { k: 'SMA200',   v: `$${techData.indicators.sma200}`, col: C.green },
                              { k: 'SAR',      v: techData.indicators.sar_trend === 'uptrend' ? '↑ Up' : '↓ Down', col: techData.indicators.sar_trend === 'uptrend' ? C.green : C.red },
                              { k: 'BB Upper', v: `$${techData.indicators.bb_upper}`, col: C.dim },
                              { k: 'BB Lower', v: `$${techData.indicators.bb_lower}`, col: C.dim },
                              { k: 'Stoch %D', v: techData.indicators.stoch_d,  col: C.sub },
                            ].map(ind => (
                              <div key={ind.k} style={{ background: 'rgba(255,255,255,0.015)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px', textAlign: 'center' }}>
                                <div style={{ fontSize: 7, color: C.ghost, marginBottom: 3, letterSpacing: 0.5 }}>{ind.k}</div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: ind.col }}>{ind.v}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Checklist (collapsed by default) */}
                        <ConfluenceChecklist checklist={techData.confluence.checklist} />
                      </div>
                    </>)}
                  </div>
                )}

                {/* Two-column */}
                <div className="ax-2col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 14, alignItems: 'start' }}>
                  <div>
                    {/* Research sub-tabs */}
                    {Object.keys(webResearch).length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}` }}>
                          {RESEARCH_SECTIONS.map(s => {
                            const rs = webResearch[s.key];
                            const active = researchTab === s.key;
                            return (
                              <button key={s.key} onClick={() => setResearchTab(s.key)} style={{ padding: '7px 12px', background: 'transparent', border: 'none', borderBottom: `2px solid ${active ? s.color : 'transparent'}`, color: active ? s.color : C.dim, fontSize: 10, fontFamily: C.font, fontWeight: active ? 700 : 400, cursor: 'pointer', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 5 }}>
                                {s.label}
                                {rs?.loading && <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, animation: 'pulse 1s infinite', flexShrink: 0 }} />}
                              </button>
                            );
                          })}
                        </div>
                        {RESEARCH_SECTIONS.map(s => {
                          if (researchTab !== s.key) return null;
                          const rs = webResearch[s.key];
                          if (!rs) return null;
                          return (
                            <div key={s.key} style={{ background: C.panel, border: `1px solid ${s.color}18`, borderTop: `2px solid ${s.color}35`, borderRadius: '0 8px 8px 8px', padding: '14px 16px' }}>
                              {rs.loading && (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  {[0,1,2,3].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, opacity: 0.55, animation: `pulse 1.2s ${i * 0.2}s infinite` }} />)}
                                  <span style={{ fontSize: 10, color: C.dim, marginLeft: 4 }}>Searching live sources...</span>
                                </div>
                              )}
                              {rs.error && <div style={{ color: C.red, fontSize: 11 }}>⚠️ {rs.error}</div>}
                              {rs.result && (<>
                                {rs.fetchedAt && <div style={{ fontSize: 9, color: C.ghost, marginBottom: 8 }}>{rs.provider?.includes('tavily') ? '🌐 live web' : '⚡ ai generated'} · {rs.fetchedAt}</div>}
                                <pre style={{ color: C.sub, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: C.font }}>{rs.result}</pre>
                              </>)}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <FinvizPanel ticker={a.ticker} />
                    {Object.entries(SECTION_META).map(([key]) => <SectionCard key={key} sectionKey={key} data={(a as any)[key]} />)}
                  </div>

                  <div className="ax-tv">
                    <TradingViewMiniChart ticker={a.ticker} />
                    <TradingViewTechnicals ticker={a.ticker} />
                  </div>
                </div>
              </>)}

              {!a && !isAnalyzing && !analysisError && (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: 44, opacity: 0.08, marginBottom: 14 }}>📊</div>
                  <div style={{ fontSize: 12, color: C.ghost, marginBottom: 16 }}>Enter a ticker and press RUN to start live analysis</div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {QUICK_TICKERS.map(t => (
                      <button key={t} onClick={() => { setTicker(t); setChartTicker(t); }}
                        style={{ padding: '6px 13px', borderRadius: 6, fontSize: 11, fontFamily: C.font, fontWeight: 700, cursor: 'pointer', background: `${C.green}08`, border: `1px solid ${C.green}20`, color: C.dim }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>)}

            {/* ── TECHNICAL ─────────────────────────────────────────────────── */}
            {activeTab === 'scanner' && (
              <div>
                {/* No data — TV chart + ticker chips */}
                {!techLoading && !techData && !techError && (<>
                  <TradingViewChart ticker={chartTicker || 'AAPL'} interval={chartInterval} height={420} />
                  <div style={{ textAlign: 'center', padding: '16px 20px 24px' }}>
                    <div style={{ fontSize: 11, color: C.ghost, marginBottom: 10 }}>Select a ticker to load 17-factor analysis</div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {QUICK_TICKERS.map(t => (
                        <button key={t} onClick={() => { setTicker(t); setChartTicker(t); fetchTech(t); }}
                          style={{ padding: '6px 13px', borderRadius: 6, fontSize: 11, fontFamily: C.font, fontWeight: 700, cursor: 'pointer', background: `${C.green}08`, border: `1px solid ${C.green}20`, color: C.dim }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </>)}

                {/* Loading */}
                {techLoading && (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: 28, color: C.green, animation: 'pulse 1.1s infinite', marginBottom: 10 }}>⚡</div>
                    <div style={{ fontSize: 12, color: C.green, fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>COMPUTING 17 FACTORS</div>
                    <div style={{ fontSize: 10, color: C.ghost }}>{(ticker || chartTicker).toUpperCase()} · Twelve Data</div>
                  </div>
                )}

                {/* Error */}
                {techError && !techLoading && (
                  <div style={{ background: `${C.red}08`, border: `1px solid ${C.red}25`, borderLeft: `3px solid ${C.red}`, borderRadius: 10, padding: '14px 18px', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 4 }}>⚠️ Technical service error</div>
                    <div style={{ fontSize: 10, color: C.sub, marginBottom: 10, fontFamily: C.font }}>{techError}</div>
                    <button onClick={() => { const t = (ticker || chartTicker).trim().toUpperCase(); if (t) fetchTech(t); }}
                      style={{ padding: '6px 14px', background: `${C.green}10`, border: `1px solid ${C.green}40`, borderRadius: 6, color: C.green, fontSize: 10, fontWeight: 700, fontFamily: C.font, cursor: 'pointer' }}>
                      ↻ RETRY
                    </button>
                  </div>
                )}

                {techData && !techLoading && (() => {
                  const histKey = `${techData.ticker}_${techData.period}`;
                  const hist = signalHistory[histKey] || [];
                  const trend = getSignalTrend(hist);
                  const guidance = getGuidance(trend.symbol, positionMode, techData.score);
                  return (<>

                    {/* ── Score header ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, marginBottom: 10 }}>
                      <div style={{ background: `${techData.action_color}0e`, border: `1px solid ${techData.action_color}28`, borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 80 }}>
                        <div style={{ fontSize: 38, fontWeight: 900, color: techData.action_color, lineHeight: 1 }}>{techData.score > 0 ? `+${techData.score}` : techData.score}</div>
                        <div style={{ fontSize: 8, color: C.ghost, letterSpacing: 2, marginTop: 2 }}>SCORE</div>
                        <div style={{ width: '100%', height: 3, background: `${techData.action_color}18`, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, (techData.score + 25) / 50 * 100))}%`, background: techData.action_color, borderRadius: 2 }} />
                        </div>
                      </div>
                      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: C.green, letterSpacing: 2 }}>{techData.ticker}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: techData.action_color }}>{techData.action}</div>
                          </div>
                          <div style={{ fontSize: 17, fontWeight: 700, color: C.txt }}>${techData.price?.toFixed(2)}</div>
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <div style={{ fontSize: 8, color: C.ghost, marginBottom: 3 }}>⚡ BULL / BEAR  ·  {techData.confluence.bull_count}B · {techData.confluence.bear_count}R</div>
                            <div style={{ height: 7, background: `${C.red}20`, borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${techData.confluence.bull_pct}%`, background: techData.confluence.bull_pct >= 55 ? C.green : C.red, borderRadius: 4 }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: C.ghost, marginTop: 2 }}>
                              <span>{techData.confluence.bull_pct}% Bull</span>
                              <span>{100 - techData.confluence.bull_pct}% Bear</span>
                            </div>
                          </div>
                        </div>
                        {techData.reasons?.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {techData.reasons.slice(0, 8).map((r: string, i: number) => (
                              <span key={i} style={{ padding: '2px 7px', background: `${C.green}10`, border: `1px solid ${C.green}20`, borderRadius: 99, fontSize: 9, color: C.green }}>{r}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Level cards ── */}
                    {techData.levels && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(75px,1fr))', gap: 6, marginBottom: 10 }}>
                        {[
                          { label: 'Entry',    value: `$${techData.price?.toFixed(2)}`,                                         sub: null,                                                    col: C.green  },
                          { label: 'Stop',     value: `$${techData.levels.stop}`,                                               sub: `-$${techData.levels.risk}`,                             col: C.red    },
                          { label: 'Target 1', value: `$${techData.levels.t1}`,                                                 sub: `+$${(techData.levels.t1 - techData.price).toFixed(2)}`, col: C.yellow },
                          { label: 'Target 2', value: `$${techData.levels.t2}`,                                                 sub: null,                                                    col: C.yellow },
                          { label: 'Target 3', value: `$${techData.levels.t3}`,                                                 sub: null,                                                    col: C.yellow },
                          { label: 'R:R',      value: `1:${techData.levels.rr}`,                                                sub: `Risk $${techData.levels.risk}`,                         col: C.blue   },
                        ].map(l => (
                          <div key={l.label} style={{ background: C.panel, border: `1px solid ${C.border}`, borderTop: `2px solid ${l.col}60`, borderRadius: 9, padding: '9px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 8, color: C.ghost, letterSpacing: 1, marginBottom: 3, textTransform: 'uppercase' as const }}>{l.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: l.col, fontFamily: C.font }}>{l.value}</div>
                            {l.sub && <div style={{ fontSize: 9, color: C.dim, marginTop: 1 }}>{l.sub}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Position guide ── */}
                    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        <span style={{ fontSize: 9, color: C.ghost, marginRight: 4, lineHeight: '26px' }}>I am:</span>
                        {(['watching', 'in_position'] as const).map(m => (
                          <button key={m} onClick={() => setPositionMode(m)}
                            style={{ padding: '5px 12px', borderRadius: 6, fontSize: 10, fontFamily: C.font, fontWeight: 600, cursor: 'pointer', background: positionMode === m ? `${C.blue}20` : 'transparent', border: `1px solid ${positionMode === m ? C.blue + '60' : C.border}`, color: positionMode === m ? C.blue : C.dim }}>
                            {m === 'watching' ? 'Watching (not in trade)' : 'In position (already bought)'}
                          </button>
                        ))}
                      </div>
                      {hist.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 9, color: C.ghost }}>History:</span>
                          {hist.map((h: any, i: number) => {
                            const isLast = i === hist.length - 1;
                            const delta = i > 0 ? h.score - hist[i - 1].score : null;
                            return (
                              <span key={i} style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, fontFamily: C.font, background: isLast ? `${techData.action_color}15` : `${C.border}40`, color: isLast ? techData.action_color : C.dim, border: `1px solid ${isLast ? techData.action_color + '40' : 'transparent'}` }}>
                                {h.score > 0 ? `+${h.score}` : h.score}
                                {isLast && delta !== null && <span style={{ fontSize: 8, opacity: 0.7 }}> ({delta > 0 ? `+${delta}` : delta})</span>}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div style={{ background: `${guidance.col}08`, border: `1px solid ${guidance.col}25`, borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, marginRight: 8 }}>{guidance.icon}</span>
                        <span style={{ fontSize: 11, color: guidance.col }}>{guidance.text}</span>
                      </div>
                      <div style={{ fontSize: 9, color: C.ghost }}>
                        Signal trend: <span style={{ color: trend.symbol === '↑' ? C.green : trend.symbol === '↓' ? C.red : C.sub, fontWeight: 700 }}>{trend.symbol} {trend.label}</span>
                        {hist.length >= 2 && <span style={{ marginLeft: 8 }}>· previous: {hist[hist.length - 2]?.action} ({hist[hist.length - 2]?.score > 0 ? '+' : ''}{hist[hist.length - 2]?.score})</span>}
                      </div>
                    </div>

                    {/* ── Sub-tabs ── */}
                    <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 12, overflowX: 'auto' as const, gap: 0 }}>
                      {TECH_SUB_TABS.map(tab => (
                        <button key={tab.id} onClick={() => setTechSubTab(tab.id)}
                          style={{ padding: '8px 13px', background: 'transparent', border: 'none', borderBottom: `2px solid ${techSubTab === tab.id ? C.green : 'transparent'}`, color: techSubTab === tab.id ? C.green : C.dim, fontSize: 10, fontFamily: C.font, fontWeight: techSubTab === tab.id ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' as const, marginBottom: -1 }}>
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Charts sub-tab */}
                    {techSubTab === 'charts' && (<>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center' }}>
                        {(['custom', 'tradingview'] as const).map(mode => (
                          <button key={mode} onClick={() => setChartMode(mode)}
                            style={{ padding: '4px 10px', borderRadius: 5, fontSize: 10, fontFamily: C.font, fontWeight: 600, cursor: 'pointer', background: chartMode === mode ? `${C.blue}15` : 'transparent', border: `1px solid ${chartMode === mode ? C.blue + '50' : C.border}`, color: chartMode === mode ? C.blue : C.dim }}>
                            {mode === 'custom' ? '📊 Indicators' : '📈 TradingView'}
                          </button>
                        ))}
                        <span style={{ width: 1, height: 14, background: C.border, margin: '0 4px' }} />
                        {INTERVALS.map(iv => (
                          <button key={iv.value} onClick={() => setChartInterval(iv.value)}
                            style={{ padding: '4px 9px', borderRadius: 5, fontSize: 10, fontFamily: C.font, fontWeight: 600, cursor: 'pointer', background: chartInterval === iv.value ? `${C.green}15` : 'transparent', border: `1px solid ${chartInterval === iv.value ? C.green + '50' : C.border}`, color: chartInterval === iv.value ? C.green : C.dim }}>
                            {iv.label}
                          </button>
                        ))}
                      </div>
                      {techData.chart_data && chartMode === 'custom'
                        ? <TechCharts data={techData.chart_data} levels={techData.levels} />
                        : <TradingViewChart ticker={techData.ticker} interval={chartInterval} height={440} />}
                      <div style={{ marginTop: 10 }}>
                        <TradingViewTechnicals ticker={techData.ticker} />
                      </div>
                    </>)}

                    {/* Confluence sub-tab */}
                    {techSubTab === 'confluence' && techData.confluence?.checklist && (
                      <div>
                        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 12, textAlign: 'center' }}>
                          <div style={{ fontSize: 48, fontWeight: 900, color: techData.confluence.bull_pct >= 55 ? C.green : C.red, lineHeight: 1 }}>{techData.confluence.bull_pct}%</div>
                          <div style={{ fontSize: 10, color: C.ghost, letterSpacing: 2, margin: '6px 0 10px' }}>BULLISH CONFLUENCE</div>
                          <div style={{ height: 12, background: `${C.red}30`, borderRadius: 6, overflow: 'hidden', margin: '0 20px' }}>
                            <div style={{ height: '100%', width: `${techData.confluence.bull_pct}%`, background: `linear-gradient(90deg, ${C.red}, ${C.yellow} 50%, ${C.green})`, borderRadius: 6, transition: 'width 0.5s' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.ghost, margin: '4px 20px 0', fontFamily: C.font }}>
                            <span>0% Bear</span><span>50% Neutral</span><span>100% Bull</span>
                          </div>
                        </div>
                        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 9, color: C.ghost, letterSpacing: 2 }}>17-FACTOR CONFLUENCE CHECKLIST</div>
                          <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {techData.confluence.checklist.map((item: any, i: number) => (
                              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 6px', borderRadius: 5, background: item.status === 'bull' ? `${C.green}06` : item.status === 'bear' ? `${C.red}06` : 'transparent' }}>
                                <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1 }}>{item.status === 'bull' ? '🟢' : item.status === 'bear' ? '🔴' : '⚪'}</span>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: item.status === 'bull' ? C.green : item.status === 'bear' ? C.red : C.sub }}>{item.label}</span>
                                  <span style={{ fontSize: 9, color: item.points > 0 ? C.green : item.points < 0 ? C.red : C.dim, marginLeft: 6 }}>({item.points > 0 ? '+' : ''}{item.points})</span>
                                  <div style={{ fontSize: 9, color: C.dim, marginTop: 1 }}>{item.detail}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Indicators sub-tab */}
                    {techSubTab === 'indicators' && techData.indicators && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 7 }}>
                        {[
                          { k: 'RSI (14)',   v: techData.indicators.rsi?.toFixed(1),    col: techData.indicators.rsi < 30 ? C.green : techData.indicators.rsi > 70 ? C.red : C.sub },
                          { k: 'MACD',      v: techData.indicators.macd?.toFixed(3),    col: techData.indicators.macd > techData.indicators.signal ? C.green : C.red },
                          { k: 'Signal',    v: techData.indicators.signal?.toFixed(3),  col: C.sub },
                          { k: 'Histogram', v: techData.indicators.hist?.toFixed(3),    col: (techData.indicators.hist ?? 0) > 0 ? C.green : C.red },
                          { k: 'Stoch %K',  v: techData.indicators.stoch_k?.toFixed(1), col: techData.indicators.stoch_k < 20 ? C.green : techData.indicators.stoch_k > 80 ? C.red : C.sub },
                          { k: 'Stoch %D',  v: techData.indicators.stoch_d?.toFixed(1), col: C.sub },
                          { k: 'ATR',       v: `$${techData.indicators.atr}`,           col: C.yellow },
                          { k: 'VWAP',      v: `$${techData.indicators.vwap}`,          col: C.blue   },
                          { k: 'SMA 20',    v: `$${techData.indicators.sma20}`,         col: C.yellow },
                          { k: 'SMA 50',    v: `$${techData.indicators.sma50}`,         col: C.orange },
                          { k: 'SMA 200',   v: `$${techData.indicators.sma200}`,        col: C.green  },
                          { k: 'BB Upper',  v: `$${techData.indicators.bb_upper}`,      col: C.dim    },
                          { k: 'BB Lower',  v: `$${techData.indicators.bb_lower}`,      col: C.dim    },
                          { k: 'SAR Trend', v: techData.indicators.sar_trend === 'uptrend' ? '↑ Uptrend' : '↓ Downtrend', col: techData.indicators.sar_trend === 'uptrend' ? C.green : C.red },
                        ].map(ind => (
                          <div key={ind.k} style={{ background: C.panel, border: `1px solid ${C.border}`, borderTop: `2px solid ${ind.col}40`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                            <div style={{ fontSize: 8, color: C.ghost, marginBottom: 4, letterSpacing: 0.5 }}>{ind.k}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: ind.col }}>{ind.v ?? '—'}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fibonacci sub-tab */}
                    {techSubTab === 'fibonacci' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {techData.fibonacci && (
                          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
                            <div style={{ fontSize: 9, color: C.ghost, letterSpacing: 2, marginBottom: 10 }}>FIBONACCI (60-DAY)</div>
                            {Object.entries(techData.fibonacci).map(([k, v]: any) => (
                              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                                <span style={{ fontSize: 10, color: C.dim }}>{k}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: Math.abs(v - techData.price) < techData.indicators?.atr ? C.green : C.blue, fontFamily: C.font }}>${v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {techData.levels && (
                          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
                            <div style={{ fontSize: 9, color: C.ghost, letterSpacing: 2, marginBottom: 10 }}>ATR-BASED LEVELS</div>
                            {[
                              { k: 'Entry',       v: `$${techData.price?.toFixed(2)}`,          col: C.green  },
                              { k: 'Stop Loss',   v: `$${techData.levels.stop}`,                 col: C.red    },
                              { k: 'Target 1',    v: `$${techData.levels.t1}`,                   col: C.yellow },
                              { k: 'Target 2',    v: `$${techData.levels.t2}`,                   col: C.yellow },
                              { k: 'Target 3',    v: `$${techData.levels.t3}`,                   col: C.yellow },
                              { k: 'Risk/Reward', v: `1:${techData.levels.rr}`,                  col: C.blue   },
                              { k: 'Support',     v: `$${techData.levels.support}`,              col: C.green  },
                              { k: 'Resistance',  v: `$${techData.levels.resistance}`,           col: C.red    },
                            ].map(l => (
                              <div key={l.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                                <span style={{ fontSize: 10, color: C.dim }}>{l.k}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: l.col, fontFamily: C.font }}>{l.v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Signals sub-tab */}
                    {techSubTab === 'signals' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ background: C.panel, border: `1px solid ${C.green}20`, borderTop: `2px solid ${C.green}50`, borderRadius: 10, padding: '12px 16px' }}>
                          <div style={{ fontSize: 9, color: C.green, letterSpacing: 2, marginBottom: 10, fontWeight: 700 }}>↑ BUY CROSSOVERS</div>
                          {(techData.buy_signals || []).slice(-10).reverse().map((s: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid rgba(255,255,255,0.04)`, fontSize: 10 }}>
                              <span style={{ color: C.dim }}>{s.date}</span>
                              <span style={{ color: C.green, fontWeight: 700, fontFamily: C.font }}>${s.price}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: C.panel, border: `1px solid ${C.red}20`, borderTop: `2px solid ${C.red}50`, borderRadius: 10, padding: '12px 16px' }}>
                          <div style={{ fontSize: 9, color: C.red, letterSpacing: 2, marginBottom: 10, fontWeight: 700 }}>↓ SELL CROSSOVERS</div>
                          {(techData.sell_signals || []).slice(-10).reverse().map((s: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid rgba(255,255,255,0.04)`, fontSize: 10 }}>
                              <span style={{ color: C.dim }}>{s.date}</span>
                              <span style={{ color: C.red, fontWeight: 700, fontFamily: C.font }}>${s.price}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Research sub-tab */}
                    {techSubTab === 'research' && (
                      Object.keys(webResearch).length > 0 ? (
                        <div>
                          <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 0 }}>
                            {RESEARCH_SECTIONS.map(s => {
                              const rs = webResearch[s.key];
                              const active = researchTab === s.key;
                              return (
                                <button key={s.key} onClick={() => setResearchTab(s.key)} style={{ padding: '7px 12px', background: 'transparent', border: 'none', borderBottom: `2px solid ${active ? s.color : 'transparent'}`, color: active ? s.color : C.dim, fontSize: 10, fontFamily: C.font, fontWeight: active ? 700 : 400, cursor: 'pointer', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' as const }}>
                                  {s.label}
                                  {rs?.loading && <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, animation: 'pulse 1s infinite', flexShrink: 0 }} />}
                                </button>
                              );
                            })}
                          </div>
                          {RESEARCH_SECTIONS.map(s => {
                            if (researchTab !== s.key) return null;
                            const rs = webResearch[s.key];
                            if (!rs) return null;
                            return (
                              <div key={s.key} style={{ background: C.panel, border: `1px solid ${s.color}18`, borderTop: `2px solid ${s.color}35`, borderRadius: '0 8px 8px 8px', padding: '14px 16px' }}>
                                {rs.loading && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{[0,1,2,3].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, opacity: 0.55, animation: `pulse 1.2s ${i * 0.2}s infinite` }} />)}<span style={{ fontSize: 10, color: C.dim, marginLeft: 4 }}>Searching...</span></div>}
                                {rs.error && <div style={{ color: C.red, fontSize: 11 }}>⚠️ {rs.error}</div>}
                                {rs.result && (<>
                                  {rs.fetchedAt && <div style={{ fontSize: 9, color: C.ghost, marginBottom: 8 }}>{rs.provider?.includes('tavily') ? '🌐 live web' : '⚡ ai'} · {rs.fetchedAt}</div>}
                                  <pre style={{ color: C.sub, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: C.font }}>{rs.result}</pre>
                                </>)}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px 20px', color: C.ghost, fontSize: 11 }}>
                          Run an AI Analysis first to populate research sections.
                        </div>
                      )
                    )}

                  </>);
                })()}
              </div>
            )}

            {/* ── LIVE SIGNALS ──────────────────────────────────────────────── */}
            {activeTab === 'signals' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 11, color: tvConnected ? C.green : C.dim, fontWeight: 700 }}>{tvConnected ? '● LIVE CONNECTED' : '○ DISCONNECTED'}</span>
                  <span style={{ fontSize: 9, color: C.ghost }}>Pine Script webhook receiver</span>
                  {tvSignals.length > 0 && <span style={{ marginLeft: 'auto', padding: '3px 10px', background: `${C.green}12`, border: `1px solid ${C.green}28`, borderRadius: 99, fontSize: 10, color: C.green, fontWeight: 700 }}>{tvSignals.length} signals</span>}
                </div>

                {latestSignal && (
                  <div style={{ background: latestSignal.action === 'BUY' ? `${C.green}08` : `${C.red}08`, border: `1px solid ${latestSignal.action === 'BUY' ? C.green : C.red}40`, borderRadius: 10, padding: '14px 18px', marginBottom: 12 }}>
                    <div style={{ fontSize: 8, letterSpacing: 2, color: C.ghost, marginBottom: 6 }}>LATEST SIGNAL</div>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: latestSignal.action === 'BUY' ? C.green : C.red }}>{latestSignal.action}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: C.txt }}>{latestSignal.ticker}</span>
                      <span style={{ fontSize: 14, color: C.yellow }}>${latestSignal.price?.toFixed(2)}</span>
                      <span style={{ fontSize: 12, color: C.blue }}>Score: {latestSignal.score}</span>
                      <span style={{ fontSize: 10, color: C.dim }}>{latestSignal.pattern}</span>
                      <button onClick={() => handleAnalyze(latestSignal.ticker)} style={{ marginLeft: 'auto', padding: '5px 12px', background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 6, color: C.green, fontSize: 10, fontFamily: C.font, cursor: 'pointer', fontWeight: 700 }}>⚡ ANALYZE</button>
                    </div>
                  </div>
                )}

                {tvSignals.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <div style={{ fontSize: 34, opacity: 0.1, marginBottom: 14 }}>📡</div>
                    <div style={{ fontSize: 12, color: C.ghost, marginBottom: 14 }}>No signals received yet</div>
                    <div style={{ fontSize: 10, color: C.ghost, lineHeight: 2.2, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 22px', display: 'inline-block', textAlign: 'left' }}>
                      1. Add <code style={{ color: C.blue }}>AXIOM-Master-Pattern-Signal.pine</code> to TradingView<br/>
                      2. Create alert → Webhook URL: <code style={{ color: C.blue }}>https://stockagentify.com/webhook</code><br/>
                      3. Enable all 22 alert conditions for maximum coverage
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {tvSignals.map(s => {
                      const isBuy = s.action === 'BUY';
                      const col   = isBuy ? C.green : C.red;
                      const rvol  = (s as any).rvol;
                      return (
                        <div key={s.id} style={{ background: C.panel, border: `1px solid ${col}20`, borderLeft: `3px solid ${col}`, borderRadius: 8, padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: col, minWidth: 36 }}>{s.action}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.txt }}>{s.ticker}</span>
                            {s.price != null && <span style={{ fontSize: 12, color: C.yellow }}>${Number(s.price).toFixed(2)}</span>}
                            <span style={{ padding: '2px 8px', background: `${col}15`, border: `1px solid ${col}35`, borderRadius: 99, fontSize: 10, color: col, fontWeight: 700 }}>Score {s.score}</span>
                            {s.rsi   != null && <span style={{ fontSize: 10, color: C.sub }}>RSI {Number(s.rsi).toFixed(0)}</span>}
                            {s.adx   != null && <span style={{ fontSize: 10, color: C.sub }}>ADX {Number(s.adx).toFixed(0)}</span>}
                            {rvol    != null && <span style={{ fontSize: 10, color: rvol > 2 ? C.purple : rvol > 1.5 ? C.yellow : C.dim }}>Vol {Number(rvol).toFixed(1)}x</span>}
                            <span style={{ fontSize: 9, color: C.ghost, marginLeft: 'auto' }}>{s.timeframe && <>{s.timeframe} · </>}{new Date(s.timestamp).toLocaleTimeString()}</span>
                            <button onClick={() => handleAnalyze(s.ticker)} style={{ padding: '4px 10px', background: `${C.green}08`, border: `1px solid ${C.green}25`, borderRadius: 5, color: C.green, fontSize: 9, fontFamily: C.font, cursor: 'pointer', fontWeight: 700 }}>⚡</button>
                          </div>
                          {s.pattern && <div style={{ fontSize: 10, color: C.blue, paddingLeft: 48, marginTop: 4 }}>▸ {s.pattern}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── HISTORY ───────────────────────────────────────────────────── */}
            {activeTab === 'history' && (
              <div>
                <div style={{ fontSize: 9, color: C.ghost, letterSpacing: 1, marginBottom: 12 }}>PAST ANALYSES — RE-ANALYZE runs fresh live data</div>
                {analysisHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <div style={{ fontSize: 34, opacity: 0.1, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 12, color: C.ghost }}>No history yet — run your first analysis</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {analysisHistory.map((h: any) => (
                      <div key={h.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${VERDICT_COLORS[h.verdict] || '#64748b'}`, borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: C.green, minWidth: 50 }}>{h.ticker}</span>
                        <span style={{ fontSize: 11, color: VERDICT_COLORS[h.verdict] || '#64748b' }}>{h.verdict?.replace(/_/g, ' ')}</span>
                        <span style={{ padding: '2px 8px', background: `${VERDICT_COLORS[h.verdict] || '#64748b'}15`, borderRadius: 99, fontSize: 10, color: VERDICT_COLORS[h.verdict] || '#64748b', fontWeight: 700 }}>Score {h.overallScore}</span>
                        <span style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase' }}>{h.horizon}</span>
                        <span style={{ fontSize: 9, color: C.ghost }}>{new Date(h.createdAt || h.timestamp || Date.now()).toLocaleDateString()}</span>
                        <button onClick={() => handleAnalyze(h.ticker, h.horizon || 'weekly')}
                          style={{ marginLeft: 'auto', padding: '5px 12px', background: `${C.green}08`, border: `1px solid ${C.green}28`, borderRadius: 5, color: C.green, fontSize: 10, fontWeight: 700, fontFamily: C.font, cursor: 'pointer' }}>
                          ↻ RE-ANALYZE
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── WATCHLIST ─────────────────────────────────────────────────── */}
            {activeTab === 'watchlist' && (
              <WatchlistTab
                watchlists={watchlists}
                onTickerSelect={(t) => { setTicker(t); setChartTicker(t); setActiveTab('analysis'); }}
                onRefresh={() => loadWatchlists().catch(() => {})}
              />
            )}

            {/* ── OPTIONS ENGINE ────────────────────────────────────────────── */}
            {activeTab === 'options' && (
              <OptionsEngine ticker={chartTicker} price={a?.entryHigh ? Number(a.entryHigh) : undefined} overallScore={a?.overallScore} />
            )}

            {/* ── SCRIPTS ───────────────────────────────────────────────────── */}
            {activeTab === 'scripts' && (
              <ScriptsTab isAdmin={user?.role === 'ADMIN'} />
            )}

            {/* ── ADMIN ─────────────────────────────────────────────────────── */}
            {activeTab === 'admin' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: C.purple, fontWeight: 700, letterSpacing: 2 }}>👑 USER MANAGEMENT</div>
                  <button onClick={loadAdminUsers} style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${C.purple}30`, borderRadius: 6, color: C.purple, fontSize: 10, fontFamily: C.font, cursor: 'pointer' }}>
                    {adminLoading ? '⟳ Loading...' : '↻ Refresh'}
                  </button>
                </div>
                {adminUsers.length === 0 && !adminLoading && (
                  <div style={{ textAlign: 'center', padding: '30px', color: C.ghost, fontSize: 12 }}>No users found</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {adminUsers.map((u: any) => {
                    const sc = u.status === 'APPROVED' ? C.green : u.status === 'REJECTED' ? C.red : C.yellow;
                    return (
                      <div key={u.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${sc}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.txt }}>{u.firstName} {u.lastName}</div>
                          <div style={{ fontSize: 10, color: C.dim }}>{u.email}</div>
                          <div style={{ fontSize: 9, color: C.ghost, marginTop: 2 }}>{u.role} · joined {new Date(u.createdAt).toLocaleDateString()}</div>
                        </div>
                        <span style={{ padding: '3px 10px', borderRadius: 99, background: `${sc}15`, border: `1px solid ${sc}35`, fontSize: 9, color: sc, fontWeight: 700 }}>{u.status}</span>
                        {u.status !== 'APPROVED' && (
                          <button onClick={() => handleApprove(u.id)} style={{ padding: '5px 12px', background: `${C.green}10`, border: `1px solid ${C.green}40`, borderRadius: 6, color: C.green, fontSize: 10, fontFamily: C.font, cursor: 'pointer', fontWeight: 700 }}>✓ Approve</button>
                        )}
                        {u.status !== 'REJECTED' && u.role !== 'ADMIN' && (
                          <button onClick={() => handleReject(u.id)} style={{ padding: '5px 12px', background: `${C.red}08`, border: `1px solid ${C.red}30`, borderRadius: 6, color: C.red, fontSize: 10, fontFamily: C.font, cursor: 'pointer', fontWeight: 700 }}>✗ Reject</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 44, fontSize: 8, color: C.ghost, letterSpacing: 2 }}>
              AXIOM v1.1 · NOT FINANCIAL ADVICE · ALWAYS DYOR
            </div>
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────── */}
      {/* ── Mobile drawer overlay ───────────────────────────────────────── */}
      {mobileDrawer && (
        <div className="ax-mobile-drawer" style={{ position: 'fixed', inset: 0, zIndex: 100 }}
          onClick={() => setMobileDrawer(false)}>
          {/* Backdrop */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          {/* Drawer panel */}
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 240, background: C.sidebar, borderRight: `1px solid ${C.green}18`, animation: 'slideInL 0.22s ease', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '18px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: 3, background: `linear-gradient(90deg,${C.green},${C.blue})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AXIOM</span>
              <button onClick={() => setMobileDrawer(false)} style={{ background: 'transparent', border: 'none', color: C.dim, fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>
            </div>
            {/* Nav items */}
            <nav style={{ flex: 1, paddingTop: 8, overflowY: 'auto' }}>
              {NAV.map(item => (
                <button key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileDrawer(false); if (item.id === 'admin') loadAdminUsers(); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: activeTab === item.id ? `${C.green}10` : 'transparent', border: 'none', borderLeft: `3px solid ${activeTab === item.id ? C.green : 'transparent'}`, color: activeTab === item.id ? C.green : C.dim, fontFamily: C.font, fontSize: 12, fontWeight: activeTab === item.id ? 700 : 400, cursor: 'pointer', textAlign: 'left' as const, position: 'relative' as const }}>
                  <span style={{ fontSize: 17, width: 24, textAlign: 'center' as const }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span style={{ marginLeft: 'auto', background: C.green, color: C.bg, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 99 }}>{item.badge}</span>
                  )}
                </button>
              ))}
            </nav>
            {/* User info */}
            {user && (
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${C.green}15`, border: `1px solid ${C.green}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: C.green, fontWeight: 700, flexShrink: 0 }}>
                    {(user.firstName?.[0] || user.username?.[0] || user.email?.[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.txt, fontWeight: 600 }}>{user.firstName || user.username || user.email?.split('@')[0]}</div>
                    <div style={{ fontSize: 9, color: C.dim }}>{user.subscriptionTier || 'FREE'}</div>
                  </div>
                </div>
                <button onClick={async () => { setMobileDrawer(false); await logout(); navigate('/'); }}
                  style={{ width: '100%', padding: '8px', borderRadius: 7, background: 'transparent', border: `1px solid ${C.border}`, color: C.dim, fontSize: 10, fontFamily: C.font, cursor: 'pointer', letterSpacing: 1 }}>
                  ⏻ LOG OUT
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="ax-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(5,13,22,0.97)', backdropFilter: 'blur(14px)',
        borderTop: `1px solid ${C.border}`,
        justifyContent: 'space-around', alignItems: 'stretch',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {NAV.slice(0, 7).map(item => (
          <button key={item.id} onClick={() => { setActiveTab(item.id); if (item.id === 'admin') loadAdminUsers(); }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 4px', background: 'transparent', border: 'none', borderTop: `2px solid ${activeTab === item.id ? C.green : 'transparent'}`, cursor: 'pointer', color: activeTab === item.id ? C.green : C.dim, fontFamily: C.font, position: 'relative' }}>
            <span style={{ fontSize: 17 }}>{item.icon}</span>
            <span style={{ fontSize: 8, fontWeight: activeTab === item.id ? 700 : 400, letterSpacing: 0.3 }}>{item.label.split(' ')[0]}</span>
            {item.badge != null && item.badge > 0 && (
              <span style={{ position: 'absolute', top: 5, right: '25%', width: 7, height: 7, borderRadius: '50%', background: C.green }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}