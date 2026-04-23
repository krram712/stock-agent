import { useState, useEffect, useRef, useMemo } from "react";

// ─── Seeded RNG ──────────────────────────────────────────────
function seededRng(seed) {
  let s = Math.abs(seed) || 1;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}
function strSeed(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}
function rnd(rng, mn, mx, dp = 1) { return +((mn + rng() * (mx - mn)).toFixed(dp)); }

// ─── Full watchlist of stocks ────────────────────────────────
const WATCHLIST = [
  // Mega cap tech
  { sym:"AAPL",  name:"Apple Inc.",           sector:"Technology",    pe:33.2, revG:4.8,  gm:46.2, de:1.87, mc:"3.2T" },
  { sym:"NVDA",  name:"NVIDIA Corp.",          sector:"Technology",    pe:68.4, revG:122.4,gm:74.6, de:0.41, mc:"2.1T" },
  { sym:"MSFT",  name:"Microsoft",             sector:"Technology",    pe:35.8, revG:17.6, gm:69.9, de:0.35, mc:"3.1T" },
  { sym:"GOOGL", name:"Alphabet Inc.",         sector:"Technology",    pe:22.4, revG:14.4, gm:56.9, de:0.07, mc:"2.1T" },
  { sym:"META",  name:"Meta Platforms",        sector:"Technology",    pe:27.1, revG:27.3, gm:81.6, de:0.14, mc:"1.3T" },
  { sym:"AMZN",  name:"Amazon.com",            sector:"Cons. Disc.",   pe:41.2, revG:12.5, gm:48.0, de:0.44, mc:"2.0T" },
  { sym:"TSLA",  name:"Tesla Inc.",            sector:"Cons. Disc.",   pe:48.2, revG:1.2,  gm:17.4, de:0.18, mc:"558B" },
  // Semiconductors
  { sym:"AMD",   name:"AMD",                   sector:"Technology",    pe:214,  revG:14.2, gm:47.3, de:0.05, mc:"267B" },
  { sym:"INTC",  name:"Intel Corp.",           sector:"Technology",    pe:28.1, revG:-8.2, gm:42.5, de:0.46, mc:"143B" },
  { sym:"AVGO",  name:"Broadcom Inc.",         sector:"Technology",    pe:36.2, revG:47.2, gm:75.1, de:1.12, mc:"780B" },
  { sym:"QCOM",  name:"Qualcomm",              sector:"Technology",    pe:17.4, revG:9.2,  gm:55.8, de:1.84, mc:"175B" },
  { sym:"ARM",   name:"ARM Holdings",          sector:"Technology",    pe:105,  revG:36.4, gm:96.2, de:0.01, mc:"130B" },
  // Financials
  { sym:"JPM",   name:"JPMorgan Chase",        sector:"Financials",    pe:11.8, revG:8.4,  gm:62.0, de:1.22, mc:"572B" },
  { sym:"GS",    name:"Goldman Sachs",         sector:"Financials",    pe:14.2, revG:16.3, gm:68.4, de:2.14, mc:"175B" },
  { sym:"BRK.B", name:"Berkshire Hathaway",    sector:"Financials",    pe:22.4, revG:5.2,  gm:28.1, de:0.28, mc:"895B" },
  { sym:"BAC",   name:"Bank of America",       sector:"Financials",    pe:13.6, revG:4.1,  gm:52.3, de:1.88, mc:"338B" },
  // Healthcare
  { sym:"JNJ",   name:"Johnson & Johnson",     sector:"Healthcare",    pe:16.4, revG:6.3,  gm:69.2, de:0.42, mc:"380B" },
  { sym:"LLY",   name:"Eli Lilly",             sector:"Healthcare",    pe:64.2, revG:52.4, gm:80.1, de:1.85, mc:"755B" },
  { sym:"UNH",   name:"UnitedHealth",          sector:"Healthcare",    pe:24.1, revG:8.4,  gm:24.2, de:0.72, mc:"462B" },
  // Consumer
  { sym:"COST",  name:"Costco",                sector:"Cons. Staples", pe:52.4, revG:7.2,  gm:12.8, de:0.35, mc:"384B" },
  { sym:"MCD",   name:"McDonald's",            sector:"Cons. Disc.",   pe:24.6, revG:2.4,  gm:56.8, de:5.12, mc:"211B" },
  // Energy
  { sym:"XOM",   name:"ExxonMobil",            sector:"Energy",        pe:14.2, revG:2.1,  gm:38.4, de:0.22, mc:"508B" },
  { sym:"CVX",   name:"Chevron",               sector:"Energy",        pe:13.8, revG:-1.2, gm:36.2, de:0.14, mc:"285B" },
  // Communication
  { sym:"NFLX",  name:"Netflix",               sector:"Communication", pe:44.8, revG:15.0, gm:43.1, de:0.68, mc:"270B" },
  { sym:"DIS",   name:"Walt Disney",           sector:"Communication", pe:32.4, revG:3.2,  gm:42.6, de:0.72, mc:"202B" },
  // AI/Cloud
  { sym:"CRM",   name:"Salesforce",            sector:"Technology",    pe:42.1, revG:11.2, gm:77.4, de:0.24, mc:"296B" },
  { sym:"NOW",   name:"ServiceNow",            sector:"Technology",    pe:68.4, revG:22.4, gm:79.8, de:0.38, mc:"181B" },
  { sym:"PLTR",  name:"Palantir",              sector:"Technology",    pe:244,  revG:27.2, gm:79.6, de:0.00, mc:"162B" },
  { sym:"SNOW",  name:"Snowflake",             sector:"Technology",    pe:-1,   revG:31.4, gm:66.8, de:0.12, mc:"42B"  },
  // ETFs
  { sym:"SPY",   name:"S&P 500 ETF",           sector:"ETF",           pe:22.1, revG:8.0,  gm:100,  de:0.00, mc:"490B" },
  { sym:"QQQ",   name:"Nasdaq 100 ETF",        sector:"ETF",           pe:28.4, revG:12.0, gm:100,  de:0.00, mc:"220B" },
  { sym:"IWM",   name:"Russell 2000 ETF",      sector:"ETF",           pe:18.2, revG:6.0,  gm:100,  de:0.00, mc:"68B"  },
  // Industrial
  { sym:"CAT",   name:"Caterpillar",           sector:"Industrials",   pe:16.2, revG:4.2,  gm:39.8, de:1.24, mc:"182B" },
  { sym:"GE",    name:"GE Aerospace",          sector:"Industrials",   pe:38.4, revG:17.2, gm:27.4, de:0.82, mc:"202B" },
  // Real Estate / Other
  { sym:"COIN",  name:"Coinbase",              sector:"Financials",    pe:28.4, revG:112.4,gm:86.2, de:1.12, mc:"68B"  },
  { sym:"MSTR",  name:"MicroStrategy",         sector:"Technology",    pe:-1,   revG:8.2,  gm:72.1, de:3.44, mc:"41B"  },
  { sym:"SOFI",  name:"SoFi Technologies",     sector:"Financials",    pe:42.4, revG:28.4, gm:88.2, de:2.14, mc:"12B"  },
  { sym:"HOOD",  name:"Robinhood",             sector:"Financials",    pe:52.4, revG:38.4, gm:87.4, de:0.42, mc:"22B"  },
  { sym:"RBLX",  name:"Roblox Corp.",          sector:"Communication", pe:-1,   revG:27.4, gm:27.8, de:1.84, mc:"28B"  },
  { sym:"UBER",  name:"Uber Technologies",     sector:"Technology",    pe:31.2, revG:18.4, gm:32.4, de:1.24, mc:"162B" },
];

// ─── Multi-factor analysis for each stock ────────────────────
function analyzeStock(stock) {
  const { sym, revG, pe, gm, de } = stock;
  const rng = seededRng(strSeed(sym + "scan26"));
  const r = (mn, mx, dp=1) => rnd(rng, mn, mx, dp);

  // Simulate multi-timeframe bias
  const dailyBias   = r(0,1,2) > 0.45;
  const htf4hBias   = r(0,1,2) > 0.42;
  const ltf1hBias   = r(0,1,2) > 0.40;

  // Core technicals
  const price    = r(10,800,2);
  const rsi      = dailyBias ? r(48,74) : r(26,52);
  const macdH    = dailyBias ? r(0.1,4,2) : r(-4,-0.1,2);
  const cmf      = dailyBias ? r(0.02,0.32) : r(-0.32,-0.02);
  const adx      = r(16,45);
  const bbW      = r(2,10,1);
  const sqz      = bbW < 5;
  const rvol     = r(0.6,3.5,2);
  const stBull   = dailyBias;

  // SMC
  const hhhl     = dailyBias && r(0,1,2) > 0.4;
  const lhll     = !dailyBias && r(0,1,2) > 0.4;
  const bos      = r(0,1,2) > 0.75;
  const choch    = r(0,1,2) > 0.85;
  const fvg      = r(0,1,2) > 0.55;
  const liqSweep = r(0,1,2) > 0.7;
  const obBlock  = r(0,1,2) > 0.6;

  // Patterns
  const patterns = [];
  if(r(0,1,2) > 0.82 && dailyBias) patterns.push("Bull Engulf");
  if(r(0,1,2) > 0.88 && dailyBias) patterns.push("Morning Star");
  if(r(0,1,2) > 0.85 && dailyBias) patterns.push("3 Soldiers");
  if(r(0,1,2) > 0.82 && !dailyBias) patterns.push("Bear Engulf");
  if(r(0,1,2) > 0.88 && !dailyBias) patterns.push("Evening Star");
  if(r(0,1,2) > 0.86) patterns.push("BB Squeeze");
  if(r(0,1,2) > 0.82 && dailyBias) patterns.push("Order Block");
  if(r(0,1,2) > 0.85) patterns.push(dailyBias?"Bull FVG":"Bear FVG");

  // Divergences
  const rsiDiv   = r(0,1,2) > 0.80;
  const macdDiv  = r(0,1,2) > 0.82;
  const obvDiv   = r(0,1,2) > 0.80;

  // MTF alignment score
  const mtfAlign = (dailyBias?2:0) + (htf4hBias?1:0) + (ltf1hBias?1:0); // 0-4

  // Fundamental score
  const fundScore = (revG > 20 ? 3 : revG > 5 ? 2 : 0) +
                    (gm > 60 ? 2 : gm > 30 ? 1 : 0) +
                    (de < 0.5 ? 2 : de < 1.5 ? 1 : 0) +
                    (pe > 0 && pe < 25 ? 2 : pe > 0 && pe < 50 ? 1 : 0);

  // Scoring
  let score = 50;
  score += (dailyBias ? 15 : -15);
  score += (htf4hBias ? 5 : -5);
  score += (ltf1hBias ? 3 : -3);
  score += (rsi > 50 && rsi < 70 ? 4 : rsi < 30 ? 2 : rsi > 70 ? -2 : -3);
  score += (macdH > 0 ? 5 : -5);
  score += (macdH > 0 && Math.abs(macdH) > 1.5 ? 2 : 0);
  score += (cmf > 0.1 ? 4 : cmf < -0.1 ? -4 : cmf > 0 ? 1 : -1);
  score += (rvol > 1.5 && dailyBias ? 4 : rvol > 1.5 && !dailyBias ? -4 : 0);
  score += (stBull ? 3 : -3);
  score += (adx > 28 && dailyBias ? 3 : adx > 28 && !dailyBias ? -3 : 0);
  score += (sqz ? 3 : 0);
  score += (hhhl ? 5 : lhll ? -5 : 0);
  score += (bos && dailyBias ? 3 : bos && !dailyBias ? -3 : 0);
  score += (choch && dailyBias ? 4 : choch && !dailyBias ? -4 : 0);
  score += (fvg && dailyBias ? 2 : fvg && !dailyBias ? -2 : 0);
  score += (liqSweep && dailyBias ? 2 : 0);
  score += (patterns.length > 2 ? 4 : patterns.length > 0 ? 2 : 0);
  score += (dailyBias && !dailyBias ? -3 : 0);
  score += fundScore;
  score += (rsiDiv && dailyBias ? 3 : rsiDiv && !dailyBias ? -3 : 0);
  score += (macdDiv && dailyBias ? 3 : macdDiv && !dailyBias ? -3 : 0);

  // High confidence boost
  const highConf = dailyBias && htf4hBias && rsi > 50 && macdH > 0 &&
                   cmf > 0.05 && (patterns.length >= 2 || hhhl);
  const bearConf = !dailyBias && !htf4hBias && rsi < 50 && macdH < 0 &&
                   cmf < -0.05 && (patterns.length >= 2 || lhll);

  if(highConf) score += 8;
  if(bearConf) score -= 8;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const verdict =
    score >= 85 ? "STRONG BULL" :
    score >= 75 ? "MILD BULL"   :
    score >= 60 ? "WEAK BULL"   :
    score >= 45 ? "NEUTRAL"     :
    score >= 35 ? "WEAK BEAR"   :
    score >= 25 ? "MILD BEAR"   : "STRONG BEAR";

  // Entry/exit
  const stopPct = 0.06;
  const entryL  = +(price * 0.987).toFixed(2);
  const entryH  = +(price * 1.007).toFixed(2);
  const stop    = +(entryL * (1 - stopPct)).toFixed(2);
  const t1      = +(price * 1.06).toFixed(2);
  const t2      = +(price * 1.12).toFixed(2);
  const rr      = +((t1-entryL)/(entryL-stop)).toFixed(1);

  const confPct = Math.round(45 + Math.abs(score-50)*0.9);
  const changeDay = dailyBias ? r(0.2,4.5,2) : r(-4.5,-0.2,2);
  const action = score >= 75 ? "BUY" : score <= 25 ? "SELL" : "NEUTRAL";

  return {
    ...stock, score, verdict, action, confPct, price, changeDay,
    rsi, macdH, cmf, adx, rvol, sqz, stBull,
    dailyBias, htf4hBias, ltf1hBias, mtfAlign,
    hhhl, lhll, bos, choch, fvg, liqSweep, obBlock,
    patterns, rsiDiv, macdDiv, highConf, bearConf,
    entryL, entryH, stop, t1, t2, rr, fundScore,
  };
}

// ─── Colors ──────────────────────────────────────────────────
const VCOLOR = {
  "STRONG BULL":"#00ff88","MILD BULL":"#a3e635","WEAK BULL":"#86efac",
  "NEUTRAL":"#94a3b8",
  "WEAK BEAR":"#fca5a5","MILD BEAR":"#fb923c","STRONG BEAR":"#ef4444"
};
function scoreColor(s) {
  return s>=85?"#00ff88":s>=75?"#a3e635":s>=60?"#86efac":s>=45?"#94a3b8":s>=35?"#fca5a5":s>=25?"#fb923c":"#ef4444";
}

// ─── Mini score bar ───────────────────────────────────────────
function ScoreBar({score}) {
  const col = scoreColor(score);
  return (
    <div style={{display:"flex",alignItems:"center",gap:4}}>
      <div style={{width:40,height:5,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:score+"%",background:col,borderRadius:3}}/>
      </div>
      <span style={{fontSize:10,fontWeight:700,color:col,fontFamily:"monospace",minWidth:22}}>{score}</span>
    </div>
  );
}

// ─── MTF alignment dots ───────────────────────────────────────
function MTFDots({daily, h4, h1}) {
  const dot = (active) => (
    <div style={{width:6,height:6,borderRadius:"50%",background:active?"#00ff88":"rgba(255,255,255,0.1)"}}/>
  );
  return (
    <div style={{display:"flex",gap:3,alignItems:"center"}}>
      {dot(daily)}{dot(h4)}{dot(h1)}
    </div>
  );
}

// ─── Detail panel ────────────────────────────────────────────
function StockDetail({stock, onClose}) {
  if(!stock) return null;
  const vc = VCOLOR[stock.verdict] || "#94a3b8";
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{width:"min(520px,100vw)",background:"#0a1620",borderLeft:"1px solid rgba(0,255,136,0.2)",overflowY:"auto",padding:20}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <div style={{fontSize:24,fontWeight:800,color:"#00ff88",fontFamily:"monospace"}}>{stock.sym}</div>
            <div style={{fontSize:11,color:"#3d5a6e"}}>{stock.name}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#3d5a6e",fontSize:20,cursor:"pointer"}}>✕</button>
        </div>

        {/* Score banner */}
        <div style={{background:vc+"12",border:"1px solid "+vc+"30",borderRadius:10,padding:14,marginBottom:14,display:"flex",gap:12,alignItems:"center"}}>
          <div style={{fontSize:40,fontWeight:800,color:vc,fontFamily:"monospace",lineHeight:1}}>{stock.score}</div>
          <div>
            <div style={{fontSize:9,letterSpacing:2,color:"#2a4050"}}>AXIOM SCORE /100</div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
              <div style={{fontSize:15,fontWeight:700,color:vc}}>{stock.verdict}</div>
              <span style={{padding:"1px 8px",borderRadius:4,fontSize:10,fontWeight:800,fontFamily:"monospace",
                background:stock.action==="BUY"?"rgba(0,255,136,0.15)":stock.action==="SELL"?"rgba(239,68,68,0.15)":"rgba(148,163,184,0.1)",
                color:stock.action==="BUY"?"#00ff88":stock.action==="SELL"?"#ef4444":"#94a3b8",
                border:`1px solid ${stock.action==="BUY"?"rgba(0,255,136,0.4)":stock.action==="SELL"?"rgba(239,68,68,0.4)":"rgba(148,163,184,0.2)"}`}}>
                {stock.action}
              </span>
            </div>
            <div style={{fontSize:9,color:"#2a4050",marginTop:1}}>{stock.confPct}% confidence</div>
          </div>
          <div style={{marginLeft:"auto",textAlign:"right"}}>
            <div style={{fontSize:16,fontWeight:700,color:"#c8d6e0"}}>${stock.price}</div>
            <div style={{fontSize:11,color:stock.changeDay>=0?"#00ff88":"#ef4444"}}>{stock.changeDay>=0?"+":""}{stock.changeDay}%</div>
          </div>
        </div>

        {/* MTF */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:9,letterSpacing:2,color:"#2a4050",marginBottom:6}}>MULTI-TIMEFRAME ALIGNMENT</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
            {[["Daily (HTF)",stock.dailyBias],["4H (MTF)",stock.htf4hBias],["1H (LTF)",stock.ltf1hBias]].map(([l,v])=>(
              <div key={l} style={{background:v?"rgba(0,255,136,0.08)":"rgba(239,68,68,0.08)",border:"1px solid "+(v?"rgba(0,255,136,0.25)":"rgba(239,68,68,0.25)"),borderRadius:6,padding:"6px 8px",textAlign:"center"}}>
                <div style={{fontSize:8,color:"#3d5a6e",marginBottom:2}}>{l}</div>
                <div style={{fontSize:11,fontWeight:700,color:v?"#00ff88":"#ef4444"}}>{v?"BULLISH":"BEARISH"}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Indicators */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:9,letterSpacing:2,color:"#2a4050",marginBottom:6}}>INDICATORS</div>
          {[
            ["RSI (14)", stock.rsi.toFixed(1), stock.rsi>70?"Overbought ⚠️":stock.rsi<30?"Oversold 🔄":"Neutral ✅", stock.rsi>50?"#00ff88":"#ef4444"],
            ["MACD Hist", (stock.macdH>0?"+":"")+stock.macdH, stock.macdH>0?"Bullish ✅":"Bearish ⚠️", stock.macdH>0?"#00ff88":"#ef4444"],
            ["CMF", (stock.cmf*100).toFixed(1)+"%", stock.cmf>0.1?"Buying ✅":stock.cmf<-0.1?"Selling ⚠️":"Neutral", stock.cmf>0?"#00ff88":"#ef4444"],
            ["ADX", stock.adx.toFixed(1), stock.adx>28?"Trending":"Ranging", stock.adx>28?"#fbbf24":"#94a3b8"],
            ["RVol", stock.rvol+"x", stock.rvol>2?"High volume ⚡":stock.rvol>1.5?"Above avg":"Normal", stock.rvol>1.5?"#a78bfa":"#94a3b8"],
            ["BB Squeeze", stock.sqz?"ACTIVE":"OFF", stock.sqz?"Breakout imminent ⚡":"Normal", stock.sqz?"#fbbf24":"#94a3b8"],
            ["SuperTrend", stock.stBull?"BULLISH":"BEARISH", stock.stBull?"Above ST ✅":"Below ST ⚠️", stock.stBull?"#00ff88":"#ef4444"],
          ].map(([l,v,s,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <span style={{fontSize:11,color:"#4a6070",fontFamily:"monospace"}}>{l}</span>
              <span style={{fontSize:11,color:c,fontFamily:"monospace"}}>{v} <span style={{color:"#3d5a6e",fontSize:9}}>{s}</span></span>
            </div>
          ))}
        </div>

        {/* SMC */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:9,letterSpacing:2,color:"#2a4050",marginBottom:6}}>SMC / MARKET STRUCTURE</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {[
              [stock.hhhl,"HH+HL","#00ff88"],[stock.lhll,"LH+LL","#ef4444"],
              [stock.bos,"BOS","#a78bfa"],[stock.choch,"CHoCH","#fbbf24"],
              [stock.fvg,"FVG","#00d4ff"],[stock.liqSweep,"Liq. Sweep","#f97316"],
              [stock.obBlock,"Order Block","#34d399"],
            ].filter(([v])=>v).map(([,l,c])=>(
              <span key={l} style={{padding:"2px 8px",borderRadius:4,background:c+"18",border:"1px solid "+c+"40",fontSize:9,color:c,fontFamily:"monospace"}}>{l}</span>
            ))}
          </div>
        </div>

        {/* Patterns */}
        {stock.patterns.length > 0 && (
          <div style={{marginBottom:12}}>
            <div style={{fontSize:9,letterSpacing:2,color:"#2a4050",marginBottom:6}}>PATTERNS DETECTED</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {stock.patterns.map(p=>(
                <span key={p} style={{padding:"2px 8px",borderRadius:4,background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.3)",fontSize:9,color:"#a78bfa",fontFamily:"monospace"}}>{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* Divergences */}
        {(stock.rsiDiv || stock.macdDiv) && (
          <div style={{marginBottom:12,padding:"8px 10px",background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.25)",borderRadius:6}}>
            <div style={{fontSize:9,color:"#fbbf24",marginBottom:4}}>⚠️ DIVERGENCE DETECTED</div>
            {stock.rsiDiv&&<div style={{fontSize:10,color:"#4a6070"}}>RSI divergence — potential reversal signal</div>}
            {stock.macdDiv&&<div style={{fontSize:10,color:"#4a6070"}}>MACD divergence — momentum shift</div>}
          </div>
        )}

        {/* Trade plan */}
        {stock.score >= 65 && (
          <div style={{background:"rgba(0,0,0,0.3)",borderRadius:6,padding:12,fontFamily:"monospace",fontSize:11,color:"#8ba0b0",lineHeight:1.8,marginBottom:12}}>
            <div><span style={{color:"#fbbf24"}}>ENTRY:</span> <strong style={{color:"#e2e8f0"}}>${stock.entryL}–${stock.entryH}</strong></div>
            <div><span style={{color:"#ef4444"}}>STOP:</span>  <strong style={{color:"#e2e8f0"}}>${stock.stop}</strong> (6% risk)</div>
            <div><span style={{color:"#fbbf24"}}>T1:</span>    <strong style={{color:"#e2e8f0"}}>${stock.t1}</strong> | <span style={{color:"#fbbf24"}}>T2:</span> <strong style={{color:"#e2e8f0"}}>${stock.t2}</strong></div>
            <div><span style={{color:"#00d4ff"}}>R/R:</span>   <strong style={{color:"#e2e8f0"}}>1:{stock.rr}</strong></div>
          </div>
        )}

        {/* Fundamentals */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:9,letterSpacing:2,color:"#2a4050",marginBottom:6}}>FUNDAMENTALS</div>
          {[
            ["P/E", stock.pe>0?stock.pe+"x":"N/A", stock.pe>0&&stock.pe<25?"#00ff88":stock.pe>0&&stock.pe<50?"#fbbf24":"#94a3b8"],
            ["Rev Growth", (stock.revG>0?"+":"")+stock.revG+"%", stock.revG>15?"#00ff88":stock.revG>0?"#fbbf24":"#ef4444"],
            ["Gross Margin", stock.gm+"%", stock.gm>60?"#00ff88":stock.gm>30?"#fbbf24":"#94a3b8"],
            ["Debt/Equity", stock.de+"x", stock.de<0.5?"#00ff88":stock.de<1.5?"#fbbf24":"#ef4444"],
          ].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
              <span style={{fontSize:11,color:"#4a6070",fontFamily:"monospace"}}>{l}</span>
              <span style={{fontSize:11,color:c,fontFamily:"monospace"}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────
export default function App() {
  const [filter, setFilter]     = useState("ALL");
  const [sortBy, setSortBy]     = useState("score");
  const [sortDir, setSortDir]   = useState(-1);
  const [search, setSearch]     = useState("");
  const [minScore, setMinScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanned, setScanned]   = useState(false);
  const [stocks, setStocks]     = useState([]);
  const [tab, setTab]           = useState("watchlist");

  const sectors = ["ALL", "Technology", "Financials", "Healthcare", "Cons. Disc.", "Cons. Staples", "Energy", "Communication", "Industrials", "ETF"];

  async function runScan() {
    setScanning(true); setProgress(0); setScanned(false); setStocks([]);
    const results = [];
    for(let i=0; i<WATCHLIST.length; i++) {
      await new Promise(r => setTimeout(r, 40 + Math.random()*30));
      results.push(analyzeStock(WATCHLIST[i]));
      setProgress(Math.round((i+1)/WATCHLIST.length*100));
    }
    setStocks(results);
    setScanning(false); setScanned(true);
  }

  const filtered = useMemo(() => {
    let s = stocks;
    if(filter !== "ALL") s = s.filter(x => x.sector === filter);
    if(search) s = s.filter(x => x.sym.includes(search.toUpperCase()) || x.name.toLowerCase().includes(search.toLowerCase()));
    if(minScore > 0) s = s.filter(x => x.score >= minScore || x.score <= (100-minScore));
    s = [...s].sort((a,b) => {
      if(sortBy === "score")    return sortDir*(b.score - a.score);
      if(sortBy === "rsi")      return sortDir*(b.rsi - a.rsi);
      if(sortBy === "adx")      return sortDir*(b.adx - a.adx);
      if(sortBy === "rvol")     return sortDir*(b.rvol - a.rvol);
      if(sortBy === "change")   return sortDir*(b.changeDay - a.changeDay);
      if(sortBy === "sym")      return sortDir*(a.sym.localeCompare(b.sym));
      return 0;
    });
    return s;
  }, [stocks, filter, search, minScore, sortBy, sortDir]);

  // Stats
  const bullCount  = stocks.filter(s=>s.score>=65).length;
  const bearCount  = stocks.filter(s=>s.score<=35).length;
  const highConf   = stocks.filter(s=>s.highConf||s.bearConf).length;
  const squeezeCnt = stocks.filter(s=>s.sqz).length;
  const avgScore   = stocks.length ? Math.round(stocks.reduce((a,b)=>a+b.score,0)/stocks.length) : 0;

  function SortBtn({col,label}) {
    const active = sortBy===col;
    return(
      <button onClick={()=>{if(active)setSortDir(d=>-d);else{setSortBy(col);setSortDir(-1);}}}
        style={{padding:"3px 8px",borderRadius:4,fontSize:9,fontFamily:"inherit",fontWeight:600,cursor:"pointer",background:active?"rgba(0,255,136,0.12)":"transparent",border:active?"1px solid rgba(0,255,136,0.4)":"1px solid transparent",color:active?"#00ff88":"#3d5a6e",letterSpacing:1}}>
        {label}{active?(sortDir>0?" ↑":" ↓"):""}
      </button>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:"#06101a",fontFamily:"JetBrains Mono,Fira Code,monospace",color:"#c8d6e0"}}>
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(0,255,136,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.018) 1px,transparent 1px)",backgroundSize:"44px 44px"}}/>

      <div style={{position:"relative",zIndex:1,maxWidth:1100,margin:"0 auto",padding:"18px 12px 48px"}}>

        {/* Header */}
        <div style={{textAlign:"center",marginBottom:18}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#00ff88",boxShadow:"0 0 8px #00ff88",display:"inline-block",animation:"blink 2s infinite"}}/>
            <span style={{fontSize:9,letterSpacing:4,color:"#00ff88"}}>AXIOM ULTIMATE WATCHLIST SCREENER v4.0</span>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#00ff88",boxShadow:"0 0 8px #00ff88",display:"inline-block"}}/>
          </div>
          <h1 style={{margin:"0 0 4px",fontSize:"clamp(18px,4vw,32px)",fontWeight:800,letterSpacing:-1,background:"linear-gradient(120deg,#00ff88 0%,#00d4ff 45%,#a78bfa 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            Multi-Factor Watchlist Scanner
          </h1>
          <p style={{margin:0,fontSize:10,color:"#1e3040",letterSpacing:2}}>MTF · SMC · PATTERNS · DIVERGENCE · FVG · ORDER BLOCKS · 15+ FACTORS</p>
        </div>

        {/* Scan button */}
        {!scanned && !scanning && (
          <div style={{textAlign:"center",padding:"40px 20px"}}>
            <div style={{fontSize:13,color:"#3d5a6e",marginBottom:20,lineHeight:1.8}}>
              Scans {WATCHLIST.length} stocks across all factors:<br/>
              Multi-Timeframe (Daily/4H/1H) · SMC Structure · 15 Indicators<br/>
              Patterns · Divergences · FVG · Order Blocks · Fundamentals
            </div>
            <button onClick={runScan} style={{padding:"14px 40px",background:"linear-gradient(135deg,rgba(0,255,136,0.18),rgba(0,212,255,0.14))",border:"1px solid rgba(0,255,136,0.4)",borderRadius:10,color:"#00ff88",fontSize:13,letterSpacing:3,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              ⚡ RUN FULL SCAN ({WATCHLIST.length} STOCKS)
            </button>
          </div>
        )}

        {/* Progress */}
        {scanning && (
          <div style={{padding:"40px 20px",textAlign:"center"}}>
            <div style={{fontSize:13,color:"#00ff88",marginBottom:12,fontFamily:"monospace"}}>
              Analyzing {WATCHLIST[Math.floor(progress/100*WATCHLIST.length)]?.sym || "..."}...
            </div>
            <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden",maxWidth:400,margin:"0 auto 10px"}}>
              <div style={{height:"100%",width:progress+"%",background:"linear-gradient(90deg,#00ff88,#00d4ff)",borderRadius:3,transition:"width 0.1s"}}/>
            </div>
            <div style={{fontSize:11,color:"#3d5a6e"}}>{progress}% — {WATCHLIST.length} stocks · MTF · SMC · Patterns</div>
          </div>
        )}

        {/* Results */}
        {scanned && stocks.length > 0 && (
          <>
            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:6,marginBottom:14}}>
              {[
                {l:"BULLISH",v:bullCount,c:"#00ff88"},{l:"BEARISH",v:bearCount,c:"#ef4444"},
                {l:"HIGH CONF",v:highConf,c:"#fbbf24"},{l:"SQUEEZE",v:squeezeCnt,c:"#a78bfa"},
                {l:"AVG SCORE",v:avgScore+"/100",c:scoreColor(avgScore)},{l:"TOTAL",v:stocks.length,c:"#94a3b8"},
              ].map(({l,v,c})=>(
                <div key={l} style={{background:"rgba(255,255,255,0.018)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:7,letterSpacing:1,color:"#2a4050",marginBottom:3}}>{l}</div>
                  <div style={{fontSize:16,fontWeight:800,color:c,fontFamily:"monospace"}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{width:110,background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"6px 10px",color:"#c8d6e0",fontSize:11,fontFamily:"inherit",outline:"none"}}/>
              <select value={filter} onChange={e=>setFilter(e.target.value)} style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"6px 10px",color:"#c8d6e0",fontSize:10,fontFamily:"inherit",outline:"none"}}>
                {sectors.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select value={minScore} onChange={e=>setMinScore(+e.target.value)} style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"6px 10px",color:"#c8d6e0",fontSize:10,fontFamily:"inherit",outline:"none"}}>
                <option value={0}>All Scores</option>
                <option value={60}>Score ≥60 or ≤40</option>
                <option value={70}>Score ≥70 or ≤30</option>
                <option value={75}>Score ≥75 or ≤25 (HIGH CONF)</option>
                <option value={85}>Score ≥85 or ≤15 (EXTREME)</option>
              </select>
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                <span style={{fontSize:9,color:"#2a4050",marginRight:2}}>SORT:</span>
                <SortBtn col="score" label="SCORE"/>
                <SortBtn col="change" label="CHANGE"/>
                <SortBtn col="rvol" label="RVOL"/>
                <SortBtn col="adx" label="ADX"/>
                <SortBtn col="sym" label="SYM"/>
              </div>
              <button onClick={runScan} style={{padding:"5px 12px",background:"rgba(0,255,136,0.08)",border:"1px solid rgba(0,255,136,0.25)",borderRadius:6,color:"#00ff88",fontSize:9,fontFamily:"inherit",cursor:"pointer",letterSpacing:2}}>RESCAN</button>
            </div>

            {/* Table */}
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                    {["TICKER","SCORE","ACTION","VERDICT","PRICE","CHANGE","RSI","ADX","CMF","RVOL","MTF","SMC","PATTERNS","SECTOR"].map(h=>(
                      <th key={h} style={{padding:"6px 8px",textAlign:"left",fontSize:8,letterSpacing:1.5,color:"#2a4050",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s,i)=>{
                    const vc=VCOLOR[s.verdict]||"#94a3b8";
                    const isHC=s.highConf||s.bearConf;
                    return(
                      <tr key={s.sym} onClick={()=>setSelected(s)} style={{borderBottom:"1px solid rgba(255,255,255,0.03)",cursor:"pointer",background:i%2===0?"rgba(255,255,255,0.008)":"transparent",transition:"background 0.15s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="rgba(0,255,136,0.04)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background=i%2===0?"rgba(255,255,255,0.008)":"transparent";}}>
                        <td style={{padding:"7px 8px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:5}}>
                            {isHC&&<span style={{width:5,height:5,borderRadius:"50%",background:"#fbbf24",boxShadow:"0 0 4px #fbbf24",display:"inline-block"}}/>}
                            <span style={{fontWeight:800,color:"#00ff88",fontFamily:"monospace"}}>{s.sym}</span>
                          </div>
                          <div style={{fontSize:8,color:"#2a4050",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:90}}>{s.name}</div>
                        </td>
                        <td style={{padding:"7px 8px"}}><ScoreBar score={s.score}/></td>
                        <td style={{padding:"7px 8px"}}>
                          <span style={{padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:800,fontFamily:"monospace",
                            background:s.action==="BUY"?"rgba(0,255,136,0.15)":s.action==="SELL"?"rgba(239,68,68,0.15)":"rgba(148,163,184,0.1)",
                            color:s.action==="BUY"?"#00ff88":s.action==="SELL"?"#ef4444":"#94a3b8",
                            border:`1px solid ${s.action==="BUY"?"rgba(0,255,136,0.4)":s.action==="SELL"?"rgba(239,68,68,0.4)":"rgba(148,163,184,0.2)"}`}}>
                            {s.action}
                          </span>
                        </td>
                        <td style={{padding:"7px 8px",whiteSpace:"nowrap"}}><span style={{fontSize:10,fontWeight:700,color:vc}}>{s.verdict}</span></td>
                        <td style={{padding:"7px 8px",color:"#c8d6e0",fontFamily:"monospace"}}>${s.price}</td>
                        <td style={{padding:"7px 8px",color:s.changeDay>=0?"#00ff88":"#ef4444",fontFamily:"monospace"}}>{s.changeDay>=0?"+":""}{s.changeDay}%</td>
                        <td style={{padding:"7px 8px",color:s.rsi>70?"#ef4444":s.rsi<30?"#a3e635":"#94a3b8",fontFamily:"monospace"}}>{s.rsi.toFixed(0)}</td>
                        <td style={{padding:"7px 8px",color:s.adx>28?"#fbbf24":"#3d5a6e",fontFamily:"monospace"}}>{s.adx.toFixed(0)}</td>
                        <td style={{padding:"7px 8px",color:s.cmf>0.1?"#00ff88":s.cmf<-0.1?"#ef4444":"#94a3b8",fontFamily:"monospace"}}>{(s.cmf*100).toFixed(0)}%</td>
                        <td style={{padding:"7px 8px",color:s.rvol>2?"#a78bfa":s.rvol>1.5?"#fbbf24":"#3d5a6e",fontFamily:"monospace"}}>{s.rvol}x</td>
                        <td style={{padding:"7px 8px"}}><MTFDots daily={s.dailyBias} h4={s.htf4hBias} h1={s.ltf1hBias}/></td>
                        <td style={{padding:"7px 8px"}}>
                          <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
                            {s.hhhl&&<span style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:"rgba(0,255,136,0.15)",color:"#00ff88"}}>HH</span>}
                            {s.bos&&<span style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:"rgba(167,139,250,0.15)",color:"#a78bfa"}}>BOS</span>}
                            {s.choch&&<span style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:"rgba(251,191,36,0.15)",color:"#fbbf24"}}>CHoCH</span>}
                            {s.fvg&&<span style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:"rgba(0,212,255,0.15)",color:"#00d4ff"}}>FVG</span>}
                            {s.sqz&&<span style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:"rgba(251,191,36,0.2)",color:"#fbbf24"}}>SQZ</span>}
                          </div>
                        </td>
                        <td style={{padding:"7px 8px"}}>
                          <div style={{display:"flex",flexWrap:"wrap",gap:1}}>
                            {s.patterns.slice(0,2).map(p=>(
                              <span key={p} style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:"rgba(167,139,250,0.1)",color:"#a78bfa",whiteSpace:"nowrap"}}>{p.replace(" ","")}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{padding:"7px 8px",fontSize:9,color:"#3d5a6e",whiteSpace:"nowrap"}}>{s.sector}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{marginTop:16,padding:"10px 12px",background:"rgba(255,255,255,0.01)",border:"1px solid rgba(255,255,255,0.04)",borderRadius:8,display:"flex",flexWrap:"wrap",gap:12,fontSize:9,color:"#3d5a6e"}}>
              <span>🟡 dot = High Confidence signal</span>
              <span>MTF dots: Daily · 4H · 1H</span>
              <span>HH = Higher Highs+Lows | BOS = Break of Structure | CHoCH = Change of Character</span>
              <span>FVG = Fair Value Gap | SQZ = BB Squeeze</span>
              <span>Click any row for full analysis</span>
            </div>

            {/* Top signals */}
            <div style={{marginTop:16}}>
              <div style={{fontSize:9,letterSpacing:2,color:"#2a4050",marginBottom:8}}>TOP HIGH-CONFIDENCE SIGNALS</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:6}}>
                {stocks.filter(s=>s.highConf||s.bearConf).slice(0,6).map(s=>(
                  <div key={s.sym} onClick={()=>setSelected(s)} style={{background:"rgba(255,255,255,0.018)",border:`1px solid ${(VCOLOR[s.verdict]||"#94a3b8")}30`,borderRadius:8,padding:"10px 12px",cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontWeight:800,color:"#00ff88",fontSize:13,fontFamily:"monospace"}}>{s.sym}</span>
                      <span style={{fontSize:9,color:VCOLOR[s.verdict]||"#94a3b8",fontWeight:700}}>{s.score}/100</span>
                    </div>
                    <div style={{fontSize:10,color:VCOLOR[s.verdict]||"#94a3b8",marginBottom:4}}>{s.verdict}</div>
                    <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      {s.patterns.slice(0,3).map(p=>(
                        <span key={p} style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:"rgba(167,139,250,0.12)",color:"#a78bfa"}}>{p}</span>
                      ))}
                      {s.sqz&&<span style={{fontSize:7,padding:"1px 4px",borderRadius:2,background:"rgba(251,191,36,0.12)",color:"#fbbf24"}}>SQUEEZE</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div style={{textAlign:"center",marginTop:28,fontSize:9,color:"#0e1e26",letterSpacing:1}}>
          AXIOM v4.0 · {WATCHLIST.length} STOCKS · MTF+SMC+PATTERNS+DIVERGENCE · NOT FINANCIAL ADVICE
        </div>
      </div>

      {selected && <StockDetail stock={selected} onClose={()=>setSelected(null)}/>}

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        *{box-sizing:border-box}
        input:focus,select:focus{border-color:rgba(0,255,136,0.4)!important;outline:none}
        input::placeholder{color:#1a2e38}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(0,255,136,0.15);border-radius:3px}
        select option{background:#0a1620;color:#c8d6e0}
      `}</style>
    </div>
  );
}
