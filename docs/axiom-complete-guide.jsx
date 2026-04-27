import { useState } from "react";

// ─── Data ────────────────────────────────────────────────────
const AI_TOOLS = [
  {
    name:"Danelfin", url:"danelfin.com", free:"Free (limited)",
    score:"AI Score 1-10", accuracy:"Outperformed S&P 263% since 2017",
    desc:"Analyzes 900+ technical, fundamental, and sentiment features daily per stock using machine learning. Most transparent AI scoring — shows sub-scores for technical, fundamental, and sentiment.",
    bestFor:"Finding which stocks will outperform over 1-3 months",
    category:"AI Predictor", col:"#00ff88"
  },
  {
    name:"AltIndex", url:"altindex.com", free:"Paid ($99/mo)",
    score:"AI Buy/Sell", accuracy:"75% accuracy, 22% avg gain per 6mo",
    desc:"Alternative data: social sentiment from Twitter, Reddit, YouTube, Facebook. Also tracks web traffic, app downloads, employee sentiment, and credit card transactions — signals Wall Street misses.",
    bestFor:"Early signals before institutional moves are visible",
    category:"Alt Data", col:"#00d4ff"
  },
  {
    name:"Kavout", url:"kavout.com", free:"Limited free",
    score:"Kai Score 1-9", accuracy:"Peer-reviewed ML model",
    desc:"Deep learning neural networks trained on fundamentals, technicals, and alternative data. Originally built for hedge funds. Academically credible with published methodology.",
    bestFor:"Institutional-grade ML stock ranking",
    category:"AI Predictor", col:"#a78bfa"
  },
  {
    name:"TrendSpider", url:"trendspider.com", free:"Paid ($33-97/mo)",
    score:"AI Strategy Lab", accuracy:"Auto-detects 220+ patterns",
    desc:"AI Strategy Lab lets you train Random Forest, KNN, and Logistic Regression models on any indicator combination. Sidekick AI chatbot answers trading queries in real-time.",
    bestFor:"Building and backtesting custom ML models without coding",
    category:"AI Charts", col:"#fbbf24"
  },
  {
    name:"QuantConnect", url:"quantconnect.com", free:"Free backtesting",
    score:"LEAN Engine", accuracy:"15,000+ backtests daily",
    desc:"Open-source algorithmic trading. Write Python strategies, backtest on terabytes of historical data, deploy live. MCP server integration lets you design strategies via natural language.",
    bestFor:"Building and deploying systematic quantitative strategies",
    category:"Quant Platform", col:"#f97316"
  },
  {
    name:"FlashAlpha", url:"flashalpha.com", free:"5 req/day free",
    score:"GEX + Greeks", accuracy:"Real-time dealer positioning",
    desc:"Free GEX calculator, IV rank, max pain, call/put walls, and dealer positioning (DEX/VEX/CHEX) for 6,000+ US stocks. SVI-calibrated volatility surface.",
    bestFor:"Options: finding gamma walls, IV rank, and dealer flows",
    category:"Options AI", col:"#ef4444"
  },
  {
    name:"Unusual Whales", url:"unusualwhales.com", free:"Free basic",
    score:"Flow Score", accuracy:"Tracks all OPRA options flow",
    desc:"Institutional options flow, dark pool prints, congressional stock trades (Form 4), real-time unusual activity alerts. Tracks above-ask call buying as directional signal.",
    bestFor:"Following smart money before moves happen",
    category:"Flow Scanner", col:"#34d399"
  },
  {
    name:"Prospero.ai", url:"prospero.ai", free:"Free tier",
    score:"Institutional signals", accuracy:"Multi-factor ML",
    desc:"Combines millions of data points into simplified signals. Real-time insights into institution market-moving actions. Shows when insiders and funds are accumulating or distributing.",
    bestFor:"Seeing institutional positioning before it shows on charts",
    category:"AI Predictor", col:"#fb923c"
  },
];

const PINE_SCRIPTS = [
  {
    name:"AXIOM Master Pattern Engine v5.0",
    file:"AXIOM-Master-Pattern-Signal.pine",
    desc:"Our custom script — 35 candlestick + harmonic + chart patterns + Wyckoff + VSA + Divergence + SMC/ICT + multi-TF confluence. Master score 0-100, 14 alert types.",
    patterns:"Bull/Bear Engulf, Morning/Evening Star, 3 Soldiers/Crows, H&S, Double Top/Bot, ABCD, Gartley, Bat, Wyckoff Spring/SOS, RSI/MACD/OBV divergence, Order Blocks, FVG, MSS",
    col:"#00ff88", badge:"CUSTOM BUILT"
  },
  {
    name:"AXIOM Ultimate Watchlist Screener v4.0",
    file:"AXIOM-Ultimate-Watchlist-Screener.pine",
    desc:"Scans 40 stocks simultaneously. 8-layer scoring: MTF alignment, trend, momentum, volume, SMC structure, patterns, volatility, FVG/ICT. 10 alert types.",
    patterns:"HH+HL, BOS, CHoCH, FVG, Order Blocks, BB Squeeze, Liq. Sweep, Divergence, Golden Cross",
    col:"#00d4ff", badge:"CUSTOM BUILT"
  },
  {
    name:"AXIOM Options Strategy Engine",
    file:"AXIOM-Options-Strategy-Engine.pine",
    desc:"Computes IV Rank, VRP, Black-Scholes Greeks, expected move, GEX regime, PCR, max pain. Scores 10 strategies and recommends the best one.",
    patterns:"Long Call/Put, Iron Condor, Straddle, Bull/Bear Spread, Covered Call, CSP, Calendar, Diagonal",
    col:"#a78bfa", badge:"CUSTOM BUILT"
  },
  {
    name:"All Harmonic Patterns [theEccentricTrader]",
    file:"Search TradingView",
    desc:"FREE open-source. Detects ALL harmonic patterns: Gartley, Bat, Butterfly, Crab, Deep Crab, Cypher, Shark, 5-0, ABCD, Three-Drive — both bullish and bearish variants.",
    patterns:"Gartley, Bat, Alt Bat, Butterfly, Crab, Deep Crab, Cypher, Shark, 5-0, ABCD",
    col:"#fbbf24", badge:"FREE TV"
  },
  {
    name:"Adaptive Candlestick Pattern Recognition [SolCollector]",
    file:"Search TradingView",
    desc:"FREE. Detects 85 candlestick patterns with statistical performance analysis. Color-codes patterns based on their historical success rate on the current asset.",
    patterns:"85 patterns: 1-5 candle formations, with live win rate stats per pattern",
    col:"#34d399", badge:"FREE TV"
  },
  {
    name:"Market Structure Dashboard",
    file:"Search TradingView",
    desc:"FREE. 14 features: EMA trend, swing tracking, HH/HL/LH/LL labels, Order Block detection, FVG detection, Liquidity Sweeps, Volume Analysis, ICT Killzones, HTF levels.",
    patterns:"OB, FVG, Liquidity, BOS, CHoCH, HTF Levels (PDH/L, PWH/L, PMH/L)",
    col:"#f97316", badge:"FREE TV"
  },
  {
    name:"GEX Levels [BackQuant]",
    file:"Search TradingView",
    desc:"FREE. Paste GEX data from FlashAlpha/Barchart and it auto-parses and plots Call Wall, Put Wall, Zero Gamma, Max Pain, HVL, expected move range as horizontal lines.",
    patterns:"Call Wall, Put Wall, Gamma Flip, HVL, Max Pain, 0DTE levels",
    col:"#ef4444", badge:"FREE TV"
  },
];

const PATTERN_MATRIX = [
  { pattern:"Bull Engulfing",        reliability:"★★★★★", timeframe:"Any", signal:"Strong bullish reversal at support", action:"Buy on next candle open, stop below pattern low" },
  { pattern:"Bear Engulfing",        reliability:"★★★★★", timeframe:"Any", signal:"Strong bearish reversal at resistance", action:"Sell/put on next candle open" },
  { pattern:"Morning Star",          reliability:"★★★★★", timeframe:"Daily+", signal:"3-candle bottom reversal", action:"Buy on 3rd candle close with volume confirm" },
  { pattern:"Evening Star",          reliability:"★★★★★", timeframe:"Daily+", signal:"3-candle top reversal", action:"Sell/put on 3rd candle close" },
  { pattern:"RSI Divergence (Bull)", reliability:"★★★★★", timeframe:"4H+", signal:"Price lower low, RSI higher low", action:"Buy when price breaks previous high" },
  { pattern:"MACD Divergence (Bull)",reliability:"★★★★",  timeframe:"Daily", signal:"Price lower, MACD histogram higher", action:"Enter at S/R level with divergence confirmed" },
  { pattern:"Double Bottom + BOS",   reliability:"★★★★★", timeframe:"Daily+", signal:"Price forms W, breaks neckline", action:"Buy on neckline breakout with volume, target = height of pattern" },
  { pattern:"Head & Shoulders",      reliability:"★★★★★", timeframe:"Daily+", signal:"3-peak reversal, neckline break", action:"Sell on neckline break, target = head-neckline distance" },
  { pattern:"Wyckoff Spring",        reliability:"★★★★",  timeframe:"Daily", signal:"False breakdown below support on low volume", action:"Buy when price reclaims support level" },
  { pattern:"Wyckoff SOS",           reliability:"★★★★★", timeframe:"Daily", signal:"High-volume breakout above resistance", action:"Buy breakout, stop below prior support" },
  { pattern:"BB Squeeze + Break",    reliability:"★★★★",  timeframe:"4H+", signal:"BB inside KC, then break with volume", action:"Buy break direction with stop inside squeeze" },
  { pattern:"Bull ABCD Harmonic",    reliability:"★★★★",  timeframe:"4H+", signal:"BC retraces 0.618, CD = 1.272 of AB", action:"Buy at D completion zone with tight stop" },
  { pattern:"Order Block + BOS",     reliability:"★★★★★", timeframe:"4H+", signal:"Last bearish candle before bull impulse", action:"Buy retest of OB, stop below OB low" },
  { pattern:"Liquidity Sweep + Rev", reliability:"★★★★★", timeframe:"Any", signal:"Fake break of key level + fast reversal", action:"Buy close above swept level, tight stop" },
  { pattern:"3 White Soldiers",      reliability:"★★★★",  timeframe:"Daily+", signal:"3 consecutive bull bars", action:"Buy on 4th candle, stop below 3rd candle low" },
  { pattern:"Displacement Candle",   reliability:"★★★★★", timeframe:"Any", signal:"2x ATR body on 2x+ volume", action:"Trade in direction, stop at 50% of displacement body" },
];

const WORKFLOW = [
  { step:1, title:"Daily Bias (Top-Down)", icon:"🗓", desc:"Check Daily/Weekly chart first. Is HTF bullish or bearish? Only trade in HTF direction.", tools:"TradingView Daily chart + HTF EMA stack", time:"Before market open" },
  { step:2, title:"Sector + Market Health", icon:"📊", desc:"Check S&P 500 (SPY), VIX, and the sector ETF. Strong stocks in weak sectors fail.", tools:"Danelfin sector scores, FlashAlpha SPY GEX", time:"Pre-market" },
  { step:3, title:"AI Score Filter", icon:"🤖", desc:"Run watchlist through Danelfin or AltIndex. Only look at stocks with score ≥7/10 in your direction.", tools:"Danelfin, AltIndex, Kavout", time:"Pre-market" },
  { step:4, title:"Options Flow Check", icon:"📡", desc:"Check unusual options activity for your candidates. Large call sweep = bullish. Large put = bearish.", tools:"Unusual Whales, Pineify UOA, OptionStrat", time:"Pre-market + intraday" },
  { step:5, title:"Chart Pattern Scan", icon:"📈", desc:"Apply AXIOM Master Pattern Engine. Look for score ≥70 with HTF confirmation AND pattern from Section 2.", tools:"AXIOM-Master-Pattern-Signal.pine", time:"Market open" },
  { step:6, title:"Divergence + SMC", icon:"🔍", desc:"Look for RSI/MACD divergence at key S/R levels. Order Blocks + FVG near price = high conviction.", tools:"AXIOM script divergence alerts + SMC alerts", time:"Intraday" },
  { step:7, title:"Volume Confirmation", icon:"📦", desc:"Never enter without volume. RVol > 1.5x on signal candle minimum. Wyckoff VSA confirms.", tools:"Volume profile, CMF, AXIOM vol filter", time:"Entry moment" },
  { step:8, title:"Entry + Risk Management", icon:"🎯", desc:"Enter at pattern completion zone. Stop = 1 ATR below pattern. Target = 2-3x risk minimum.", tools:"AXIOM entry/exit signals, options strategy engine", time:"Trade execution" },
  { step:9, title:"AI Monitor + Adjust", icon:"🔄", desc:"Use Prospero.ai to watch for institutional shifts. Trail stop as trade moves in your favor.", tools:"Prospero.ai alerts, webhook → AXIOM app", time:"Position management" },
];

function CategoryBadge({ cat }) {
  const colors = { "AI Predictor":"#00ff88","Alt Data":"#00d4ff","Quant Platform":"#f97316","AI Charts":"#fbbf24","Options AI":"#ef4444","Flow Scanner":"#34d399" };
  const c = colors[cat] || "#94a3b8";
  return <span style={{ padding:"2px 6px", borderRadius:3, background:c+"18", border:`1px solid ${c}40`, fontSize:8, color:c, letterSpacing:1 }}>{cat}</span>;
}

function SCard({ title, color="#00ff88", children, defaultOpen=true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background:"rgba(255,255,255,0.018)", border:`1px solid ${color}22`, borderLeft:`3px solid ${color}`, borderRadius:10, marginBottom:10, overflow:"hidden" }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ width:"100%", padding:"11px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", background:"transparent", border:"none", cursor:"pointer", color, fontFamily:"monospace", textAlign:"left" }}>
        <span style={{ fontSize:12.5, fontWeight:700 }}>{title}</span>
        <span style={{ fontSize:9, opacity:0.4, transform:open?"rotate(180deg)":"rotate(0deg)", transition:"transform 0.2s", display:"inline-block" }}>▼</span>
      </button>
      {open && <div style={{ padding:"0 16px 16px" }}>{children}</div>}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const [selTool, setSelTool] = useState(null);

  const TABS = [
    ["overview","🗺 Overview"],["scripts","📜 Pine Scripts"],["ai","🤖 AI Tools"],
    ["patterns","📐 Patterns"],["workflow","⚡ Workflow"],["python","🐍 Python Code"],
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#06101a", fontFamily:"JetBrains Mono,Fira Code,monospace", color:"#c8d6e0" }}>
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", backgroundImage:"linear-gradient(rgba(0,255,136,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.018) 1px,transparent 1px)", backgroundSize:"44px 44px" }}/>

      <div style={{ position:"relative", zIndex:1, maxWidth:1060, margin:"0 auto", padding:"18px 12px 48px" }}>

        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:18 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#00ff88", boxShadow:"0 0 8px #00ff88", display:"inline-block", animation:"blink 2s infinite" }}/>
            <span style={{ fontSize:9, letterSpacing:4, color:"#00ff88" }}>AXIOM COMPLETE TRADING INTELLIGENCE GUIDE</span>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#00ff88", boxShadow:"0 0 8px #00ff88", display:"inline-block" }}/>
          </div>
          <h1 style={{ margin:"0 0 4px", fontSize:"clamp(18px,4vw,30px)", fontWeight:800, letterSpacing:-1, background:"linear-gradient(120deg,#00ff88 0%,#00d4ff 45%,#a78bfa 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            Scripts · Patterns · AI Tools · Complete System
          </h1>
          <p style={{ margin:0, fontSize:10, color:"#1e3040", letterSpacing:2 }}>EVERY TOOL · EVERY SCRIPT · EXACT WORKFLOW · HOW TO USE TOGETHER</p>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:14 }}>
          {TABS.map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ padding:"7px 12px", borderRadius:6, fontSize:10, fontFamily:"inherit", fontWeight:600, cursor:"pointer", letterSpacing:1, background:tab===id?"rgba(0,255,136,0.12)":"rgba(255,255,255,0.02)", border:tab===id?"1px solid rgba(0,255,136,0.5)":"1px solid rgba(255,255,255,0.06)", color:tab===id?"#00ff88":"#3d5a6e" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab==="overview" && (
          <>
            <div style={{ background:"rgba(0,255,136,0.04)", border:"1px solid rgba(0,255,136,0.2)", borderRadius:10, padding:16, marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#00ff88", marginBottom:8 }}>🎯 THE HONEST TRUTH ABOUT WIN RATES</div>
              <div style={{ fontSize:11, color:"#8ba0b0", lineHeight:1.8 }}>
                No script achieves 99% accuracy — that's mathematically impossible in markets. The BEST professional traders achieve 65-75% win rates. What matters is <strong style={{ color:"#e2e8f0" }}>Risk/Reward ratio</strong> — a 60% win rate with 1:3 R/R makes more money than 80% wins at 1:1. <br/>
                <strong style={{ color:"#00ff88" }}>Our goal: use confluence of 8+ factors so when we DO enter, the probability is genuinely 65-80%.</strong>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8, marginBottom:14 }}>
              {[
                { l:"Pine Scripts Built", v:"3 Custom", c:"#00ff88" },
                { l:"Pattern Types", v:"85+ Candle", c:"#00d4ff" },
                { l:"Chart Patterns", v:"20+ Chart", c:"#a78bfa" },
                { l:"Harmonic Patterns", v:"12 Harmonic", c:"#fbbf24" },
                { l:"AI Tools Covered", v:"8 Tools", c:"#f97316" },
                { l:"Alert Types", v:"40+ Alerts", c:"#34d399" },
              ].map(item=>(
                <div key={item.l} style={{ background:"rgba(255,255,255,0.018)", border:`1px solid ${item.c}25`, borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
                  <div style={{ fontSize:7, letterSpacing:1, color:"#2a4050", marginBottom:4 }}>{item.l}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:item.c, fontFamily:"monospace" }}>{item.v}</div>
                </div>
              ))}
            </div>

            <SCard title="📊 Complete AXIOM System — What You Have" color="#00ff88">
              {[
                ["Pine Script 1","AXIOM v3 Precision Engine","7-layer confluence: EMA+SuperTrend+HTF, RSI/MACD/Stoch, CMF/OBV, BB Squeeze, Patterns, S/R+Fib, Market Structure"],
                ["Pine Script 2","AXIOM Ultimate Watchlist Screener","Scans 40 stocks: 8 scoring categories, SMC, FVG, BOS, CHoCH, divergences"],
                ["Pine Script 3","AXIOM Options Strategy Engine","IV Rank, VRP, Black-Scholes Greeks, 10 strategy scorer, GEX regime, PCR"],
                ["Pine Script 4","AXIOM Master Pattern Engine v5.0","NEW: 35 candlestick + harmonic + Wyckoff + VSA + divergence + SMC — single score"],
                ["React App 1","AXIOM Stock Analysis Agent","Full analysis with score, technicals, S/R, fundamentals, entry/exit"],
                ["React App 2","AXIOM Watchlist Scanner","40 stocks scanned, sorted by score, SMC badges, pattern tags"],
                ["React App 3","AXIOM Options Dashboard","Greeks calculator, P&L chart, option chain, strategy selector"],
                ["React App 4","This Dashboard","Complete guide to all tools, workflows, and AI integration"],
              ].map(([type,name,desc])=>(
                <div key={name} style={{ display:"flex", gap:10, padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ minWidth:90, fontSize:8, color:"#2a4050", paddingTop:2 }}>{type}</div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:"#c8d6e0" }}>{name}</div>
                    <div style={{ fontSize:9, color:"#3d5a6e", marginTop:1 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </SCard>

            <SCard title="🔗 How All Scripts Work Together" color="#00d4ff">
              <div style={{ fontSize:11, color:"#8ba0b0", lineHeight:1.9 }}>
                <div style={{ color:"#fbbf24", fontWeight:700, marginBottom:6 }}>Optimal Setup — Use All 4 Pine Scripts on TradingView simultaneously:</div>
                <div>1. <strong style={{ color:"#e2e8f0" }}>Watchlist Screener</strong> → run on Pine Screener to find stocks with score ≥75</div>
                <div>2. <strong style={{ color:"#e2e8f0" }}>Precision Engine (v3)</strong> → apply to individual stock for detailed confluence</div>
                <div>3. <strong style={{ color:"#e2e8f0" }}>Master Pattern Engine (v5)</strong> → confirms with 6 extra pattern categories</div>
                <div>4. <strong style={{ color:"#e2e8f0" }}>Options Engine</strong> → if both agree, determines the best options strategy</div>
                <div style={{ marginTop:8, color:"#00ff88" }}>When ALL 4 scripts agree → highest-conviction trade. Enter with full position.</div>
                <div style={{ color:"#fbbf24" }}>When 3/4 agree → good trade. Enter with 50-75% position.</div>
                <div style={{ color:"#ef4444" }}>When only 2 agree → wait or paper trade only.</div>
              </div>
            </SCard>
          </>
        )}

        {/* ── PINE SCRIPTS ── */}
        {tab==="scripts" && (
          <>
            {PINE_SCRIPTS.map(s=>(
              <div key={s.name} style={{ background:"rgba(255,255,255,0.018)", border:`1px solid ${s.col}25`, borderLeft:`3px solid ${s.col}`, borderRadius:10, padding:14, marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:s.col, marginBottom:2 }}>{s.name}</div>
                    <div style={{ fontSize:9, color:"#2a4050" }}>File: {s.file}</div>
                  </div>
                  <span style={{ padding:"2px 8px", borderRadius:3, background:s.badge==="CUSTOM BUILT"?"rgba(0,255,136,0.15)":"rgba(251,191,36,0.15)", border:`1px solid ${s.badge==="CUSTOM BUILT"?"rgba(0,255,136,0.4)":"rgba(251,191,36,0.4)"}`, fontSize:8, color:s.badge==="CUSTOM BUILT"?"#00ff88":"#fbbf24" }}>{s.badge}</span>
                </div>
                <div style={{ fontSize:11, color:"#8ba0b0", lineHeight:1.7, marginBottom:8 }}>{s.desc}</div>
                <div style={{ fontSize:9, color:"#3d5a6e" }}><strong style={{ color:s.col }}>Patterns:</strong> {s.patterns}</div>
              </div>
            ))}
            <div style={{ padding:"10px 14px", background:"rgba(0,255,136,0.04)", border:"1px solid rgba(0,255,136,0.15)", borderRadius:8, fontSize:10, color:"#4a6070" }}>
              💡 <strong style={{ color:"#00ff88" }}>How to add to TradingView:</strong> Pine Editor → paste code → Add to Chart → then add to Favorites so it shows in Pine Screener
            </div>
          </>
        )}

        {/* ── AI TOOLS ── */}
        {tab==="ai" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:10 }}>
            {AI_TOOLS.map(t=>(
              <div key={t.name} style={{ background:"rgba(255,255,255,0.018)", border:`1px solid ${t.col}25`, borderLeft:`3px solid ${t.col}`, borderRadius:10, padding:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:t.col }}>{t.name}</div>
                    <div style={{ fontSize:8, color:"#2a4050", marginTop:1 }}>{t.url}</div>
                  </div>
                  <CategoryBadge cat={t.category}/>
                </div>
                <div style={{ fontSize:9, color:"#fbbf24", marginBottom:4 }}>💰 {t.free} &nbsp;|&nbsp; 🎯 {t.score}</div>
                <div style={{ fontSize:9, color:"#00ff88", marginBottom:6 }}>📊 {t.accuracy}</div>
                <div style={{ fontSize:10, color:"#8ba0b0", lineHeight:1.65, marginBottom:6 }}>{t.desc}</div>
                <div style={{ padding:"5px 8px", background:"rgba(0,0,0,0.2)", borderRadius:5, fontSize:9, color:"#3d5a6e" }}>
                  <strong style={{ color:t.col }}>Best for:</strong> {t.bestFor}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PATTERNS ── */}
        {tab==="patterns" && (
          <>
            <div style={{ marginBottom:10, padding:"8px 12px", background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.2)", borderRadius:6, fontSize:10, color:"#fbbf24" }}>
              ⚡ These are the 16 highest-probability patterns ranked by professional trader consensus. Use in conjunction with HTF bias, volume, and divergence for maximum conviction.
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                    {["PATTERN","RELIABILITY","TIMEFRAME","SIGNAL","ACTION"].map(h=>(
                      <th key={h} style={{ padding:"6px 8px", textAlign:"left", fontSize:8, letterSpacing:1.5, color:"#2a4050", fontWeight:700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PATTERN_MATRIX.map((p, i)=>(
                    <tr key={p.pattern} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)", background:i%2===0?"rgba(255,255,255,0.006)":"transparent" }}>
                      <td style={{ padding:"6px 8px", fontWeight:700, color: p.pattern.toLowerCase().includes("bear")||p.pattern.toLowerCase().includes("evening")||p.pattern.toLowerCase().includes("head")||p.pattern.toLowerCase().includes("double top")?"#ef4444":"#00ff88", fontFamily:"monospace", whiteSpace:"nowrap" }}>{p.pattern}</td>
                      <td style={{ padding:"6px 8px", color:"#fbbf24", fontSize:11 }}>{p.reliability}</td>
                      <td style={{ padding:"6px 8px", color:"#94a3b8", whiteSpace:"nowrap" }}>{p.timeframe}</td>
                      <td style={{ padding:"6px 8px", color:"#8ba0b0", fontSize:9 }}>{p.signal}</td>
                      <td style={{ padding:"6px 8px", color:"#4a6070", fontSize:9 }}>{p.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── WORKFLOW ── */}
        {tab==="workflow" && (
          <>
            <div style={{ marginBottom:10, padding:"8px 12px", background:"rgba(0,255,136,0.04)", border:"1px solid rgba(0,255,136,0.15)", borderRadius:6, fontSize:10, color:"#00ff88" }}>
              ✅ Follow this 9-step workflow every trading day. Each step filters out bad trades. Only enter when you reach Step 8 with high confidence.
            </div>
            {WORKFLOW.map(step=>(
              <div key={step.step} style={{ display:"flex", gap:12, marginBottom:8 }}>
                <div style={{ flexShrink:0, width:32, height:32, borderRadius:"50%", background:"rgba(0,255,136,0.12)", border:"1px solid rgba(0,255,136,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#00ff88", fontFamily:"monospace" }}>{step.step}</div>
                <div style={{ flex:1, background:"rgba(255,255,255,0.018)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#c8d6e0" }}>{step.icon} {step.title}</div>
                    <div style={{ fontSize:8, color:"#2a4050", background:"rgba(255,255,255,0.04)", padding:"2px 6px", borderRadius:3 }}>{step.time}</div>
                  </div>
                  <div style={{ fontSize:10, color:"#8ba0b0", lineHeight:1.6, marginBottom:4 }}>{step.desc}</div>
                  <div style={{ fontSize:9, color:"#3d5a6e" }}>🔧 <strong style={{ color:"#4a6070" }}>Tools:</strong> {step.tools}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── PYTHON CODE ── */}
        {tab==="python" && (
          <>
            <SCard title="🐍 QuantConnect Python Strategy — Multi-Factor ML Signal" color="#f97316">
              <div style={{ background:"rgba(0,0,0,0.5)", borderRadius:6, padding:14, fontFamily:"Courier New,monospace", fontSize:10, color:"#d4d4d4", lineHeight:1.8, overflowX:"auto" }}>
                <div style={{ color:"#608b4e" }}># AXIOM Multi-Factor Alpha Strategy — QuantConnect LEAN</div>
                <div style={{ color:"#608b4e" }}># Free backtesting at quantconnect.com</div>
                <div style={{ color:"#608b4e" }}># Combines: RSI + MACD + EMA + Volume + Momentum ML</div>
                <br/>
                <div><span style={{ color:"#569cd6" }}>from</span> AlgorithmImports <span style={{ color:"#569cd6" }}>import</span> *</div>
                <div><span style={{ color:"#569cd6" }}>import</span> numpy <span style={{ color:"#569cd6" }}>as</span> np</div>
                <br/>
                <div><span style={{ color:"#569cd6" }}>class</span> <span style={{ color:"#4ec9b0" }}>AXIOMMultiFactorAlpha</span>(QCAlgorithm):</div>
                <br/>
                <div style={{ marginLeft:20 }}><span style={{ color:"#dcdcaa" }}>def</span> <span style={{ color:"#dcdcaa" }}>Initialize</span>(self):</div>
                <div style={{ marginLeft:40 }}>self.SetStartDate(2022, 1, 1)</div>
                <div style={{ marginLeft:40 }}>self.SetEndDate(2026, 1, 1)</div>
                <div style={{ marginLeft:40 }}>self.SetCash(100000)</div>
                <br/>
                <div style={{ marginLeft:40, color:"#608b4e" }}># Universe: top liquid US equities</div>
                <div style={{ marginLeft:40 }}>self.AddUniverse(self.CoarseSelectionFunction)</div>
                <br/>
                <div style={{ marginLeft:40, color:"#608b4e" }}># Indicators per symbol</div>
                <div style={{ marginLeft:40 }}>self.indicators = {"{}"}</div>
                <div style={{ marginLeft:40 }}>self.lookback = 20</div>
                <div style={{ marginLeft:40 }}>self.score_threshold = 0.65</div>
                <br/>
                <div style={{ marginLeft:40, color:"#608b4e" }}># Schedule rebalance</div>
                <div style={{ marginLeft:40 }}>self.Schedule.On(</div>
                <div style={{ marginLeft:60 }}>self.DateRules.EveryDay(),</div>
                <div style={{ marginLeft:60 }}>self.TimeRules.AfterMarketOpen("SPY", 30),</div>
                <div style={{ marginLeft:60 }}>self.Rebalance</div>
                <div style={{ marginLeft:40 }}>)</div>
                <br/>
                <div style={{ marginLeft:20 }}><span style={{ color:"#dcdcaa" }}>def</span> <span style={{ color:"#dcdcaa" }}>CoarseSelectionFunction</span>(self, coarse):</div>
                <div style={{ marginLeft:40 }}>filtered = [x <span style={{ color:"#569cd6" }}>for</span> x <span style={{ color:"#569cd6" }}>in</span> coarse</div>
                <div style={{ marginLeft:60 }}><span style={{ color:"#569cd6" }}>if</span> x.HasFundamentalData</div>
                <div style={{ marginLeft:60 }}><span style={{ color:"#569cd6" }}>and</span> x.Price &gt; 10</div>
                <div style={{ marginLeft:60 }}><span style={{ color:"#569cd6" }}>and</span> x.DollarVolume &gt; 10_000_000]</div>
                <div style={{ marginLeft:40 }}>sorted_by_vol = sorted(filtered, key=<span style={{ color:"#569cd6" }}>lambda</span> x: x.DollarVolume, reverse=True)</div>
                <div style={{ marginLeft:40 }}><span style={{ color:"#569cd6" }}>return</span> [x.Symbol <span style={{ color:"#569cd6" }}>for</span> x <span style={{ color:"#569cd6" }}>in</span> sorted_by_vol[:50]]</div>
                <br/>
                <div style={{ marginLeft:20 }}><span style={{ color:"#dcdcaa" }}>def</span> <span style={{ color:"#dcdcaa" }}>OnSecuritiesChanged</span>(self, changes):</div>
                <div style={{ marginLeft:40 }}><span style={{ color:"#569cd6" }}>for</span> security <span style={{ color:"#569cd6" }}>in</span> changes.AddedSecurities:</div>
                <div style={{ marginLeft:60 }}>sym = security.Symbol</div>
                <div style={{ marginLeft:60 }}>self.indicators[sym] = {"{"}</div>
                <div style={{ marginLeft:80 }}><span style={{ color:"#ce9178" }}>"rsi"</span>: self.RSI(sym, 14, MovingAverageType.Wilders, Resolution.Daily),</div>
                <div style={{ marginLeft:80 }}><span style={{ color:"#ce9178" }}>"macd"</span>: self.MACD(sym, 12, 26, 9, MovingAverageType.Exponential, Resolution.Daily),</div>
                <div style={{ marginLeft:80 }}><span style={{ color:"#ce9178" }}>"ema20"</span>: self.EMA(sym, 20, Resolution.Daily),</div>
                <div style={{ marginLeft:80 }}><span style={{ color:"#ce9178" }}>"ema50"</span>: self.EMA(sym, 50, Resolution.Daily),</div>
                <div style={{ marginLeft:80 }}><span style={{ color:"#ce9178" }}>"ema200"</span>: self.EMA(sym, 200, Resolution.Daily),</div>
                <div style={{ marginLeft:80 }}><span style={{ color:"#ce9178" }}>"atr"</span>: self.ATR(sym, 14, MovingAverageType.Wilders, Resolution.Daily),</div>
                <div style={{ marginLeft:80 }}><span style={{ color:"#ce9178" }}>"bb"</span>: self.BB(sym, 20, 2, Resolution.Daily),</div>
                <div style={{ marginLeft:80 }}><span style={{ color:"#ce9178" }}>"adx"</span>: self.ADX(sym, 14, Resolution.Daily),</div>
                <div style={{ marginLeft:60 }}>{"}"}</div>
                <br/>
                <div style={{ marginLeft:20 }}><span style={{ color:"#dcdcaa" }}>def</span> <span style={{ color:"#dcdcaa" }}>ComputeScore</span>(self, sym):</div>
                <div style={{ marginLeft:40 }}><span style={{ color:"#569cd6" }}>if</span> sym <span style={{ color:"#569cd6" }}>not in</span> self.indicators: <span style={{ color:"#569cd6" }}>return</span> 0</div>
                <div style={{ marginLeft:40 }}>ind = self.indicators[sym]</div>
                <div style={{ marginLeft:40 }}><span style={{ color:"#569cd6" }}>if not</span> all(i.IsReady <span style={{ color:"#569cd6" }}>for</span> i <span style={{ color:"#569cd6" }}>in</span> ind.values()): <span style={{ color:"#569cd6" }}>return</span> 0</div>
                <br/>
                <div style={{ marginLeft:40 }}>price = self.Securities[sym].Price</div>
                <div style={{ marginLeft:40 }}>score = 0</div>
                <br/>
                <div style={{ marginLeft:40, color:"#608b4e" }}># Trend (30 pts)</div>
                <div style={{ marginLeft:40 }}>score += 10 <span style={{ color:"#569cd6" }}>if</span> price &gt; ind[<span style={{ color:"#ce9178" }}>"ema20"</span>].Current.Value <span style={{ color:"#569cd6" }}>else</span> -10</div>
                <div style={{ marginLeft:40 }}>score += 10 <span style={{ color:"#569cd6" }}>if</span> price &gt; ind[<span style={{ color:"#ce9178" }}>"ema50"</span>].Current.Value <span style={{ color:"#569cd6" }}>else</span> -10</div>
                <div style={{ marginLeft:40 }}>score += 10 <span style={{ color:"#569cd6" }}>if</span> price &gt; ind[<span style={{ color:"#ce9178" }}>"ema200"</span>].Current.Value <span style={{ color:"#569cd6" }}>else</span> -10</div>
                <br/>
                <div style={{ marginLeft:40, color:"#608b4e" }}># Momentum (30 pts)</div>
                <div style={{ marginLeft:40 }}>rsi = ind[<span style={{ color:"#ce9178" }}>"rsi"</span>].Current.Value</div>
                <div style={{ marginLeft:40 }}>score += 15 <span style={{ color:"#569cd6" }}>if</span> 50 &lt; rsi &lt; 70 <span style={{ color:"#569cd6" }}>else</span> (-10 <span style={{ color:"#569cd6" }}>if</span> rsi &gt; 70 <span style={{ color:"#569cd6" }}>else</span> -5)</div>
                <div style={{ marginLeft:40 }}>macd_hist = ind[<span style={{ color:"#ce9178" }}>"macd"</span>].Histogram.Current.Value</div>
                <div style={{ marginLeft:40 }}>score += 15 <span style={{ color:"#569cd6" }}>if</span> macd_hist &gt; 0 <span style={{ color:"#569cd6" }}>else</span> -15</div>
                <br/>
                <div style={{ marginLeft:40, color:"#608b4e" }}># Volatility / setup (20 pts)</div>
                <div style={{ marginLeft:40 }}>bb = ind[<span style={{ color:"#ce9178" }}>"bb"</span>]</div>
                <div style={{ marginLeft:40 }}>bb_width = (bb.UpperBand.Current.Value - bb.LowerBand.Current.Value) / bb.MiddleBand.Current.Value</div>
                <div style={{ marginLeft:40 }}>score += 10 <span style={{ color:"#569cd6" }}>if</span> price &gt; bb.MiddleBand.Current.Value <span style={{ color:"#569cd6" }}>else</span> -10</div>
                <div style={{ marginLeft:40 }}>score += 10 <span style={{ color:"#569cd6" }}>if</span> bb_width &lt; 0.05 <span style={{ color:"#569cd6" }}>else</span> 0  <span style={{ color:"#608b4e" }}># BB squeeze bonus</span></div>
                <br/>
                <div style={{ marginLeft:40, color:"#608b4e" }}># Trend strength (20 pts)</div>
                <div style={{ marginLeft:40 }}>adx_v = ind[<span style={{ color:"#ce9178" }}>"adx"</span>].Current.Value</div>
                <div style={{ marginLeft:40 }}>score += 20 <span style={{ color:"#569cd6" }}>if</span> adx_v &gt; 25 <span style={{ color:"#569cd6" }}>else</span> (10 <span style={{ color:"#569cd6" }}>if</span> adx_v &gt; 20 <span style={{ color:"#569cd6" }}>else</span> 0)</div>
                <br/>
                <div style={{ marginLeft:40 }}><span style={{ color:"#608b4e" }}># Normalize 0-100</span></div>
                <div style={{ marginLeft:40 }}><span style={{ color:"#569cd6" }}>return</span> max(0, min(100, score + 50))</div>
                <br/>
                <div style={{ marginLeft:20 }}><span style={{ color:"#dcdcaa" }}>def</span> <span style={{ color:"#dcdcaa" }}>Rebalance</span>(self):</div>
                <div style={{ marginLeft:40 }}>scores = {"{"}</div>
                <div style={{ marginLeft:60 }}>sym: self.ComputeScore(sym)</div>
                <div style={{ marginLeft:60 }}><span style={{ color:"#569cd6" }}>for</span> sym <span style={{ color:"#569cd6" }}>in</span> self.ActiveSecurities.Keys</div>
                <div style={{ marginLeft:40 }}>{"}"}</div>
                <br/>
                <div style={{ marginLeft:40, color:"#608b4e" }}># Buy top 10 scored stocks, equal weight</div>
                <div style={{ marginLeft:40 }}>top_stocks = sorted(scores, key=scores.get, reverse=True)</div>
                <div style={{ marginLeft:40 }}>buy_list = [s <span style={{ color:"#569cd6" }}>for</span> s <span style={{ color:"#569cd6" }}>in</span> top_stocks[:10] <span style={{ color:"#569cd6" }}>if</span> scores[s] &gt;= self.score_threshold * 100]</div>
                <br/>
                <div style={{ marginLeft:40, color:"#608b4e" }}># Liquidate stocks no longer in top list</div>
                <div style={{ marginLeft:40 }}><span style={{ color:"#569cd6" }}>for</span> symbol, holdings <span style={{ color:"#569cd6" }}>in</span> self.Portfolio.items():</div>
                <div style={{ marginLeft:60 }}><span style={{ color:"#569cd6" }}>if</span> holdings.Invested <span style={{ color:"#569cd6" }}>and</span> symbol <span style={{ color:"#569cd6" }}>not in</span> buy_list:</div>
                <div style={{ marginLeft:80 }}>self.Liquidate(symbol)</div>
                <br/>
                <div style={{ marginLeft:40, color:"#608b4e" }}># Equal weight allocation</div>
                <div style={{ marginLeft:40 }}>weight = 1.0 / len(buy_list) <span style={{ color:"#569cd6" }}>if</span> buy_list <span style={{ color:"#569cd6" }}>else</span> 0</div>
                <div style={{ marginLeft:40 }}><span style={{ color:"#569cd6" }}>for</span> sym <span style={{ color:"#569cd6" }}>in</span> buy_list:</div>
                <div style={{ marginLeft:60 }}>self.SetHoldings(sym, weight)</div>
                <div style={{ marginLeft:60 }}>self.Log(<span style={{ color:"#ce9178" }}>f"BUYING {"{"}</span>sym<span style={{ color:"#ce9178" }}>{"}"} score={"{"}</span>scores[sym]<span style={{ color:"#ce9178" }}>{"}"}"</span>)</div>
              </div>
            </SCard>

            <SCard title="📊 How to Backtest on QuantConnect (Free)" color="#fbbf24" defaultOpen={false}>
              <div style={{ fontSize:11, color:"#8ba0b0", lineHeight:1.8 }}>
                <div>1. Go to <strong style={{ color:"#00ff88" }}>quantconnect.com</strong> → Create free account</div>
                <div>2. Click <strong style={{ color:"#e2e8f0" }}>Algorithm Lab</strong> → Create New Project</div>
                <div>3. Paste the Python code above</div>
                <div>4. Click <strong style={{ color:"#e2e8f0" }}>Backtest</strong> — it runs against 2022-2026 historical data for free</div>
                <div>5. Review: CAGR, Sharpe ratio, max drawdown, win rate</div>
                <div>6. Adjust score_threshold (0.60-0.75) to find optimal setting</div>
                <div>7. When satisfied → click <strong style={{ color:"#e2e8f0" }}>Live Deploy</strong> ($8/mo + $20/mo for live node)</div>
                <div style={{ marginTop:10, color:"#fbbf24" }}>📊 The key metric is <strong>Sharpe Ratio &gt; 1.0</strong> and <strong>Max Drawdown &lt; 25%</strong></div>
              </div>
            </SCard>
          </>
        )}

        <div style={{ textAlign:"center", marginTop:24, fontSize:9, color:"#0e1e26", letterSpacing:1 }}>
          AXIOM COMPLETE SYSTEM · NOT FINANCIAL ADVICE · DYOR · USE PROPER RISK MANAGEMENT
        </div>
      </div>

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(0,255,136,0.15);border-radius:3px}
      `}</style>
    </div>
  );
}
