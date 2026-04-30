import { useState, useEffect } from "react";

// ─── Mock data that mirrors real API responses ───────────────
function mockAnalysis(ticker) {
  const seed = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (min, max, dp=1) => +((min + (seed * 7919 % 1000) / 1000 * (max-min)).toFixed(dp));
  const isUp = (seed % 3) !== 0;
  const price = rng(50, 900, 2);
  const score = isUp ? rng(62, 88, 0) : rng(28, 48, 0);
  const verdict = score>=75?"STRONG BUY":score>=62?"BUY":score>=45?"HOLD":score>=32?"SELL":"STRONG SELL";
  return {
    ticker,
    finviz: {
      price, change_pct: isUp?`+${rng(0.5,4.2)}%`:`-${rng(0.5,3.8)}%`,
      sector: ["Technology","Financials","Healthcare","Cons. Disc."][seed%4],
      pe: rng(12,65,1), forward_pe: rng(10,50,1), peg: rng(0.5,3.2,2),
      eps_growth_yoy: isUp?`+${rng(5,80)}%`:`-${rng(2,30)}%`,
      gross_margin: `${rng(25,85)}%`, profit_margin: `${rng(5,45)}%`,
      roe: `${rng(8,80)}%`, debt_equity: rng(0.05,2.5,2),
      rsi: isUp?rng(52,72):rng(28,48), sma50: isUp?"+":"-",
      analyst_recom: isUp?"Buy":"Hold", target_price: +(price*(1.1+rng(0,0.3,2))).toFixed(2),
      short_float: `${rng(1,15)}%`, insider_own: `${rng(2,25)}%`,
      beta: rng(0.5,2.5,2), earnings_date: "Jan 29", optionable: "Yes",
      market_cap: ["$50B","$120B","$380B","$1.2T","$2.8T"][seed%5],
      volatility_w: `${rng(1.5,6)}%`, volatility_m: `${rng(3,12)}%`,
    },
    vader_sentiment: {
      score: isUp?rng(0.05,0.45,3):rng(-0.45,-0.05,3),
      label: isUp?"BULLISH":"BEARISH",
      bull_pct: isUp?rng(55,80):rng(20,40), bear_pct: isUp?rng(15,35):rng(45,70),
      total_headlines: 8
    },
    av_sentiment: {
      avg_score: isUp?rng(0.1,0.5,3):rng(-0.5,-0.1,3),
      label: isUp?"BULLISH":"BEARISH",
      total: 7, bull_articles: isUp?5:2, bear_articles: isUp?2:5
    },
    gemini_analysis: {
      overall_sentiment: isUp?"BULLISH":"BEARISH",
      market_impact: ["HIGH","MEDIUM","LOW"][seed%3],
      key_events: isUp?["Strong earnings beat","Analyst upgrade","New product launch"]:["Margin compression","Sector headwinds","Key exec departure"],
      action_recommended: isUp?"BUY":"SELL",
      earnings_mentioned: true, upgrade_mentioned: isUp,
      summary: isUp?`${ticker} shows strong momentum with institutional accumulation and positive analyst sentiment.`:`${ticker} faces headwinds with mixed fundamental signals and bearish technical setup.`
    },
    ai_signal: {
      signal: isUp?"BUY":"SELL", confidence: rng(55,88,0),
      score, entry_price: +(price*0.987).toFixed(2), stop_loss: +(price*0.935).toFixed(2),
      target_1: +(price*1.06).toFixed(2), target_2: +(price*1.12).toFixed(2),
      risk_reward: rng(1.5,3.5,1), options_strategy: isUp?"Bull Call Spread":"Bear Put Spread",
      time_horizon: ["weekly","monthly"][seed%2],
      trade_plan: isUp?`Buy on pullback to $${(price*0.985).toFixed(2)} with RSI confirmation. Scale in 50% now, 50% on hold above EMA20.`:`Wait for breakdown below $${(price*0.96).toFixed(2)} on volume before shorting. Stop above recent high.`,
      key_catalysts: isUp?["Earnings momentum","Sector rotation","Institutional buying"]:["Margin risk","Rate sensitivity","Competition"],
      key_risks: isUp?["Valuation stretch","Market correction","Earnings miss"]:["Short squeeze risk","Macro reversal","Oversold bounce"],
    },
    options_signal: {
      best_strategy: isUp?"Bull Call Spread":"Bear Put Spread",
      score: rng(60,90,0), iv_assessment: ["CHEAP","FAIR","EXPENSIVE"][seed%3],
      sell_premium: (seed%3)===2, earnings_play: (seed%4)===0,
      suggested_dte: [21,30,45][seed%3], rationale: isUp?`IV is fair relative to historical, with bullish momentum suggesting directional call spread.`:`Elevated IV with bearish catalyst makes put spread attractive risk-defined play.`
    },
    master_signal: {
      score, verdict, confidence: rng(55,88,0),
      breakdown: {"Groq/LLaMA":isUp?rng(62,85):rng(22,42),"VADER":isUp?rng(58,78):rng(25,45),"Alpha Vantage AI":isUp?rng(60,82):rng(24,44),"Gemini":isUp?rng(55,80):rng(20,42),"Finviz Technical":isUp?rng(60,80):rng(22,45)},
      entry_price: +(price*0.987).toFixed(2), stop_loss: +(price*0.935).toFixed(2),
      target_1: +(price*1.06).toFixed(2), target_2: +(price*1.12).toFixed(2),
      risk_reward: rng(1.5,3.5,1), options_strat: isUp?"Bull Call Spread":"Bear Put Spread",
      trade_plan: isUp?`Enter long at $${(price*0.987).toFixed(2)}. Stop at $${(price*0.935).toFixed(2)}. Target $${(price*1.06).toFixed(2)} then $${(price*1.12).toFixed(2)}.`:`Enter short below $${(price*0.96).toFixed(2)}. Cover at $${(price*1.02).toFixed(2)}. Target $${(price*0.91).toFixed(2)}.`,
    }
  };
}

const VCOLOR = {"STRONG BUY":"#00ff88","BUY":"#86efac","HOLD":"#fbbf24","SELL":"#fb923c","STRONG SELL":"#ef4444"};
const sentColor = l => l==="BULLISH"?"#00ff88":l==="BEARISH"?"#ef4444":"#94a3b8";

function Row({l,v,c,bold}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
      <span style={{fontSize:10,color:"#4a6070",fontFamily:"monospace"}}>{l}</span>
      <span style={{fontSize:10,color:c||"#94a3b8",fontFamily:"monospace",fontWeight:bold?700:400}}>{v}</span>
    </div>
  );
}
function SCard({title,color="#00ff88",children,open:init=true}) {
  const [open,setOpen] = useState(init);
  return (
    <div style={{background:"rgba(255,255,255,0.018)",border:`1px solid ${color}22`,borderLeft:`3px solid ${color}`,borderRadius:10,marginBottom:8,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"transparent",border:"none",cursor:"pointer",color,fontFamily:"monospace",textAlign:"left"}}>
        <span style={{fontSize:12,fontWeight:700}}>{title}</span>
        <span style={{fontSize:9,opacity:0.4,transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s",display:"inline-block"}}>▼</span>
      </button>
      {open&&<div style={{padding:"0 14px 12px"}}>{children}</div>}
    </div>
  );
}
function SourceBadge({name,score,color,label}) {
  return (
    <div style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${color}25`,borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
      <div style={{fontSize:8,color:"#2a4050",marginBottom:3,letterSpacing:1}}>{name}</div>
      <div style={{fontSize:16,fontWeight:800,color,fontFamily:"monospace"}}>{score}</div>
      <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden",marginTop:4}}>
        <div style={{height:"100%",width:score+"%",background:color,borderRadius:2}}/>
      </div>
      <div style={{fontSize:8,color,marginTop:3}}>{label}</div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("analysis");
  const [ticker, setTicker] = useState("NVDA");
  const [inputTicker, setInputTicker] = useState("NVDA");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [phase, setPhase] = useState("");
  const [watchlist] = useState(["NVDA","AAPL","MSFT","TSLA","META","AMZN","AMD","GOOGL"]);
  const [scanned, setScanned] = useState(false);
  const [rankings, setRankings] = useState([]);

  const PHASES = [
    "Fetching Finviz 90+ metrics...","Running VADER sentiment on news...",
    "Calling Alpha Vantage AI sentiment...","Sending to Gemini 1.5 Flash...",
    "Running Groq LLaMA 70B analysis...","Computing master consensus..."
  ];

  async function analyze() {
    setLoading(true); setAnalysis(null);
    for (const p of PHASES) {
      setPhase(p);
      await new Promise(r => setTimeout(r, 420 + Math.random()*280));
    }
    setPhase("");
    setAnalysis(mockAnalysis(inputTicker.toUpperCase()));
    setTicker(inputTicker.toUpperCase());
    setLoading(false);
  }

  async function scanAll() {
    setScanned(false); setRankings([]);
    const res = [];
    for (const t of watchlist) {
      await new Promise(r => setTimeout(r, 200));
      const a = mockAnalysis(t);
      res.push({ ticker:t, score:a.master_signal.score, verdict:a.master_signal.verdict, confidence:a.master_signal.confidence, price:a.finviz.price, options:a.master_signal.options_strat, signal:a.ai_signal.signal });
    }
    res.sort((a,b)=>b.score-a.score);
    setRankings(res); setScanned(true);
  }

  const a = analysis;
  const ms = a?.master_signal;
  const vc = ms ? (VCOLOR[ms.verdict]||"#94a3b8") : "#64748b";

  return (
    <div style={{minHeight:"100vh",background:"#06101a",fontFamily:"JetBrains Mono,Fira Code,monospace",color:"#c8d6e0"}}>
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(0,255,136,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.018) 1px,transparent 1px)",backgroundSize:"44px 44px"}}/>
      <div style={{position:"relative",zIndex:1,maxWidth:1040,margin:"0 auto",padding:"18px 12px 48px"}}>

        {/* Header */}
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#00ff88",boxShadow:"0 0 8px #00ff88",display:"inline-block",animation:"blink 2s infinite"}}/>
            <span style={{fontSize:9,letterSpacing:4,color:"#00ff88"}}>AXIOM · FINVIZ + AI INTEGRATION ENGINE</span>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#00ff88",boxShadow:"0 0 8px #00ff88",display:"inline-block"}}/>
          </div>
          <h1 style={{margin:"0 0 4px",fontSize:"clamp(18px,4vw,30px)",fontWeight:800,letterSpacing:-1,background:"linear-gradient(120deg,#00ff88 0%,#00d4ff 45%,#a78bfa 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            Finviz + Groq + Gemini + Alpha Vantage
          </h1>
          <p style={{margin:0,fontSize:10,color:"#1e3040",letterSpacing:2}}>90+ FINVIZ METRICS · FREE AI ANALYSIS · NEWS SENTIMENT · OPTIONS SIGNALS</p>
        </div>

        {/* Free AI Sources banner */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:6,marginBottom:14}}>
          {[
            {name:"Finviz",desc:"90+ metrics, news, insiders, analysts",key:"pip install finviz",col:"#00ff88",free:"FREE"},
            {name:"Groq LLaMA 70B",desc:"14,400 req/day free, 750 tok/sec",key:"console.groq.com",col:"#f97316",free:"FREE"},
            {name:"Gemini 1.5 Flash",desc:"100 req/day, multimodal",key:"ai.google.dev",col:"#fbbf24",free:"FREE"},
            {name:"Alpha Vantage",desc:"AI news sentiment, 25 req/day",key:"alphavantage.co",col:"#a78bfa",free:"FREE"},
            {name:"VADER Sentiment",desc:"Local NLP, no API needed",key:"pip install vaderSentiment",col:"#00d4ff",free:"FREE"},
          ].map(s=>(
            <div key={s.name} style={{background:`${s.col}08`,border:`1px solid ${s.col}25`,borderRadius:8,padding:"8px 10px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <div style={{fontSize:10,fontWeight:700,color:s.col}}>{s.name}</div>
                <span style={{fontSize:7,padding:"1px 5px",borderRadius:2,background:"rgba(0,255,136,0.15)",color:"#00ff88"}}>FREE</span>
              </div>
              <div style={{fontSize:8,color:"#3d5a6e",lineHeight:1.5}}>{s.desc}</div>
              <div style={{fontSize:7,color:"#2a4050",marginTop:3,fontFamily:"Courier New,monospace"}}>{s.key}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
          {[["analysis","🔍 Stock Analysis"],["watchlist","📋 Watchlist Scan"],["setup","⚙️ Setup Guide"],["api","📝 API Reference"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:"6px 12px",borderRadius:6,fontSize:10,fontFamily:"inherit",fontWeight:600,cursor:"pointer",letterSpacing:1,background:tab===id?"rgba(0,255,136,0.12)":"rgba(255,255,255,0.02)",border:tab===id?"1px solid rgba(0,255,136,0.5)":"1px solid rgba(255,255,255,0.06)",color:tab===id?"#00ff88":"#3d5a6e"}}>
              {label}
            </button>
          ))}
        </div>

        {/* ── ANALYSIS TAB ── */}
        {tab==="analysis" && (
          <>
            {/* Input */}
            <div style={{background:"rgba(255,255,255,0.022)",border:"1px solid rgba(0,255,136,0.1)",borderRadius:14,padding:16,marginBottom:14}}>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
                <div>
                  <div style={{fontSize:8,letterSpacing:2,color:"#2a4050",marginBottom:5}}>TICKER</div>
                  <input value={inputTicker} onChange={e=>setInputTicker(e.target.value.toUpperCase().replace(/[^A-Z.]/g,""))} onKeyDown={e=>e.key==="Enter"&&analyze()} placeholder="NVDA" maxLength={8}
                    style={{width:100,background:"rgba(0,0,0,0.5)",border:"1px solid rgba(0,255,136,0.3)",borderRadius:7,padding:"9px 10px",color:"#00ff88",fontSize:20,fontWeight:800,fontFamily:"inherit",letterSpacing:3,outline:"none",display:"block"}}/>
                </div>
                <div>
                  <div style={{fontSize:8,letterSpacing:2,color:"#2a4050",marginBottom:5}}>QUICK PICKS</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {["NVDA","AAPL","TSLA","META","AMD"].map(t=>(
                      <button key={t} onClick={()=>{setInputTicker(t);}} style={{padding:"7px 10px",borderRadius:6,fontSize:10,fontFamily:"inherit",fontWeight:600,cursor:"pointer",background:inputTicker===t?"rgba(0,255,136,0.12)":"rgba(255,255,255,0.03)",border:inputTicker===t?"1px solid rgba(0,255,136,0.5)":"1px solid rgba(255,255,255,0.06)",color:inputTicker===t?"#00ff88":"#3d5a6e"}}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={analyze} disabled={loading||!inputTicker.trim()} style={{padding:"9px 20px",background:loading?"rgba(0,255,136,0.04)":"linear-gradient(135deg,rgba(0,255,136,0.16),rgba(0,212,255,0.12))",border:`1px solid ${loading?"rgba(0,255,136,0.08)":"rgba(0,255,136,0.35)"}`,borderRadius:8,color:loading?"#1e3040":"#00ff88",fontSize:11,letterSpacing:2,fontWeight:700,fontFamily:"inherit",cursor:loading?"not-allowed":"pointer"}}>
                  {loading?"ANALYZING...":"⚡ ANALYZE"}
                </button>
              </div>
              {loading&&phase&&(
                <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(0,255,136,0.04)",border:"1px solid rgba(0,255,136,0.12)",borderRadius:6,fontSize:10,color:"#3a7058"}}>
                  <span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span> {phase}
                </div>
              )}
            </div>

            {/* Results */}
            {a && ms && (
              <>
                {/* Master signal banner */}
                <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                  <div style={{background:`${vc}10`,border:`1px solid ${vc}30`,borderRadius:10,padding:"12px 18px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:36,fontWeight:800,color:vc,fontFamily:"monospace",lineHeight:1}}>{ms.score}</div>
                      <div style={{fontSize:8,color:"#2a4050"}}>MASTER SCORE</div>
                    </div>
                  </div>
                  <div style={{flex:1,minWidth:200,background:"rgba(255,255,255,0.015)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                    <div>
                      <div style={{fontSize:8,letterSpacing:2,color:"#2a4050",marginBottom:2}}>CONSENSUS VERDICT</div>
                      <div style={{fontSize:16,fontWeight:800,color:vc}}>{ms.verdict}</div>
                      <div style={{fontSize:9,color:"#2a4050"}}>{ms.confidence}% confidence · {ms.options_strat}</div>
                    </div>
                    <div style={{marginLeft:"auto",textAlign:"right"}}>
                      <div style={{fontSize:18,fontWeight:800,color:"#00ff88",letterSpacing:1}}>{ticker}</div>
                      <div style={{fontSize:12,color:"#3d5a6e"}}>${a.finviz.price}</div>
                      <div style={{fontSize:10,color:a.finviz.change_pct.startsWith("+")??"#00ff88":"#ef4444"}}>{a.finviz.change_pct}</div>
                    </div>
                  </div>
                </div>

                {/* AI Source Breakdown */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:6,marginBottom:12}}>
                  {Object.entries(ms.breakdown||{}).map(([name,score])=>{
                    const s = Math.round(score);
                    const c = s>=65?"#00ff88":s>=50?"#fbbf24":"#ef4444";
                    return <SourceBadge key={name} name={name.replace(" AI","").replace("/","\n")} score={s} color={c} label={s>=65?"BULL":s>=50?"NEUT":"BEAR"}/>;
                  })}
                </div>

                {/* Signal grid */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:5,marginBottom:12}}>
                  {[
                    {l:"ENTRY",v:`$${ms.entry_price}`,c:"#00ff88"},{l:"STOP",v:`$${ms.stop_loss}`,c:"#ef4444"},
                    {l:"TARGET 1",v:`$${ms.target_1}`,c:"#fbbf24"},{l:"TARGET 2",v:`$${ms.target_2}`,c:"#fbbf24"},
                    {l:"R/R",v:`1:${ms.risk_reward}`,c:"#00d4ff"},{l:"OPTIONS",v:ms.options_strat?.split(" ").slice(-1)[0]||"N/A",c:"#a78bfa"},
                    {l:"HORIZON",v:(a.ai_signal.time_horizon||"weekly").toUpperCase(),c:"#94a3b8"},
                    {l:"CONF",v:`${ms.confidence}%`,c:vc},
                  ].map(item=>(
                    <div key={item.l} style={{background:"rgba(255,255,255,0.018)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:6,padding:"7px 8px",textAlign:"center"}}>
                      <div style={{fontSize:7,letterSpacing:1,color:"#2a4050",marginBottom:2}}>{item.l}</div>
                      <div style={{fontSize:10,fontWeight:700,color:item.c,wordBreak:"break-all"}}>{item.v}</div>
                    </div>
                  ))}
                </div>

                {/* Multi-source analysis sections */}
                <SCard title="📊 Finviz Data (90+ Metrics)" color="#00ff88">
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
                    <div>
                      <div style={{fontSize:8,color:"#2a4050",marginBottom:4,letterSpacing:1}}>VALUATION</div>
                      <Row l="P/E TTM" v={a.finviz.pe+"x"} c={a.finviz.pe<25?"#00ff88":"#94a3b8"}/>
                      <Row l="Forward P/E" v={a.finviz.forward_pe+"x"}/>
                      <Row l="PEG" v={a.finviz.peg} c={a.finviz.peg<1?"#00ff88":a.finviz.peg<2?"#fbbf24":"#ef4444"}/>
                      <Row l="EPS Growth YoY" v={a.finviz.eps_growth_yoy} c={a.finviz.eps_growth_yoy.startsWith("+")??"#00ff88":"#ef4444"}/>
                      <Row l="Gross Margin" v={a.finviz.gross_margin}/>
                      <Row l="ROE" v={a.finviz.roe} c="#00ff88"/>
                      <Row l="Debt/Equity" v={a.finviz.debt_equity} c={a.finviz.debt_equity<1?"#00ff88":"#fbbf24"}/>
                    </div>
                    <div>
                      <div style={{fontSize:8,color:"#2a4050",marginBottom:4,letterSpacing:1}}>TECHNICAL</div>
                      <Row l="RSI (14)" v={a.finviz.rsi} c={a.finviz.rsi>70?"#ef4444":a.finviz.rsi<30?"#00ff88":"#fbbf24"}/>
                      <Row l="vs SMA50" v={a.finviz.sma50} c={a.finviz.sma50==="+"?"#00ff88":"#ef4444"}/>
                      <Row l="Analyst Rating" v={a.finviz.analyst_recom} c={a.finviz.analyst_recom==="Buy"?"#00ff88":"#fbbf24"}/>
                      <Row l="Price Target" v={`$${a.finviz.target_price}`} c="#00ff88"/>
                      <Row l="Short Float" v={a.finviz.short_float}/>
                      <Row l="Beta" v={a.finviz.beta}/>
                      <Row l="Earnings" v={a.finviz.earnings_date} c="#a78bfa"/>
                    </div>
                  </div>
                </SCard>

                <SCard title="📰 News Sentiment — 3 Sources" color="#00d4ff">
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                    {[
                      {name:"VADER (Local NLP)",sent:a.vader_sentiment,col:"#00ff88"},
                      {name:"Alpha Vantage AI",sent:a.av_sentiment,col:"#a78bfa"},
                      {name:"Gemini Analysis",sent:{label:a.gemini_analysis.overall_sentiment,score:a.gemini_analysis.sentiment_score||0.2},col:"#fbbf24"},
                    ].map(({name,sent,col})=>(
                      <div key={name} style={{background:"rgba(0,0,0,0.2)",borderRadius:6,padding:"8px",textAlign:"center"}}>
                        <div style={{fontSize:8,color:"#2a4050",marginBottom:3}}>{name}</div>
                        <div style={{fontSize:12,fontWeight:700,color:sentColor(sent.label)}}>{sent.label}</div>
                        <div style={{fontSize:9,color:col,marginTop:2}}>{sent.bull_pct||sent.bull_articles?"↑ "+( sent.bull_pct||sent.bull_articles)+(sent.bull_pct?"%":" articles"):""}</div>
                      </div>
                    ))}
                  </div>
                  {a.gemini_analysis.key_events && (
                    <div>
                      <div style={{fontSize:9,color:"#2a4050",marginBottom:4}}>KEY EVENTS (Gemini)</div>
                      {a.gemini_analysis.key_events.slice(0,3).map(e=>(
                        <div key={e} style={{fontSize:9,color:"#8ba0b0",padding:"2px 0"}}>• {e}</div>
                      ))}
                    </div>
                  )}
                </SCard>

                <SCard title="🤖 Groq LLaMA 70B Signal" color="#f97316">
                  <Row l="AI Signal" v={a.ai_signal.signal} c={VCOLOR[a.ai_signal.signal.replace("_"," ")]||"#94a3b8"} bold/>
                  <Row l="Confidence" v={`${a.ai_signal.confidence}%`} c="#fbbf24"/>
                  <Row l="Key Catalysts" v={a.ai_signal.key_catalysts?.slice(0,2).join(", ")||"N/A"}/>
                  <Row l="Key Risks" v={a.ai_signal.key_risks?.slice(0,2).join(", ")||"N/A"} c="#ef4444"/>
                  <Row l="Options Strategy" v={a.ai_signal.options_strategy||"N/A"} c="#a78bfa"/>
                  <div style={{marginTop:8,padding:"8px 10px",background:"rgba(0,0,0,0.3)",borderRadius:5,fontSize:10,color:"#8ba0b0",lineHeight:1.7}}>
                    {a.ai_signal.trade_plan}
                  </div>
                </SCard>

                <SCard title="📈 Options Analysis" color="#a78bfa" open={false}>
                  {a.options_signal && (
                    <>
                      <Row l="Best Strategy" v={a.options_signal.best_strategy} c="#a78bfa" bold/>
                      <Row l="Score" v={`${a.options_signal.score}/100`} c={a.options_signal.score>=70?"#00ff88":"#fbbf24"}/>
                      <Row l="IV Assessment" v={a.options_signal.iv_assessment} c={a.options_signal.iv_assessment==="CHEAP"?"#00ff88":a.options_signal.iv_assessment==="EXPENSIVE"?"#ef4444":"#fbbf24"}/>
                      <Row l="Sell Premium" v={a.options_signal.sell_premium?"YES":"NO"} c={a.options_signal.sell_premium?"#00ff88":"#94a3b8"}/>
                      <Row l="Earnings Play" v={a.options_signal.earnings_play?"YES — Binary event":"NO"} c={a.options_signal.earnings_play?"#fbbf24":"#94a3b8"}/>
                      <Row l="Suggested DTE" v={`${a.options_signal.suggested_dte} days`}/>
                      <div style={{marginTop:8,padding:"6px 8px",background:"rgba(167,139,250,0.06)",borderRadius:5,fontSize:9,color:"#8ba0b0"}}>{a.options_signal.rationale}</div>
                    </>
                  )}
                </SCard>

                <SCard title="📋 Trade Plan" color="#00ff88" open={false}>
                  <div style={{background:"rgba(0,0,0,0.3)",borderRadius:6,padding:12,fontFamily:"monospace",fontSize:11,color:"#8ba0b0",lineHeight:1.9}}>
                    <div><span style={{color:"#fbbf24"}}>ENTRY:</span> <strong style={{color:"#e2e8f0"}}>${ms.entry_price}</strong></div>
                    <div><span style={{color:"#ef4444"}}>STOP:</span>  <strong style={{color:"#e2e8f0"}}>${ms.stop_loss}</strong></div>
                    <div><span style={{color:"#fbbf24"}}>T1:</span>    <strong style={{color:"#e2e8f0"}}>${ms.target_1}</strong></div>
                    <div><span style={{color:"#fbbf24"}}>T2:</span>    <strong style={{color:"#e2e8f0"}}>${ms.target_2}</strong></div>
                    <div><span style={{color:"#00d4ff"}}>R/R:</span>   <strong style={{color:"#e2e8f0"}}>1:{ms.risk_reward}</strong></div>
                    <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.06)",color:"#8ba0b0"}}>{ms.trade_plan}</div>
                  </div>
                </SCard>
              </>
            )}

            {!a&&!loading&&(
              <div style={{textAlign:"center",padding:"40px 20px",color:"#1a2a35",fontSize:12}}>
                <div style={{fontSize:32,marginBottom:12,opacity:0.2}}>🔍</div>
                Enter a ticker and click ANALYZE to run full Finviz + AI pipeline
              </div>
            )}
          </>
        )}

        {/* ── WATCHLIST TAB ── */}
        {tab==="watchlist" && (
          <>
            <button onClick={scanAll} style={{width:"100%",padding:13,marginBottom:12,background:"linear-gradient(135deg,rgba(0,255,136,0.16),rgba(0,212,255,0.12))",border:"1px solid rgba(0,255,136,0.35)",borderRadius:9,color:"#00ff88",fontSize:11,letterSpacing:3,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              ⚡ SCAN ALL {watchlist.length} STOCKS (Finviz + Groq + Gemini + AV)
            </button>
            {scanned && rankings.length > 0 && (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                      {["RANK","TICKER","SCORE","VERDICT","SIGNAL","CONFIDENCE","PRICE","OPTIONS STRATEGY"].map(h=>(
                        <th key={h} style={{padding:"6px 8px",textAlign:"left",fontSize:8,letterSpacing:1.5,color:"#2a4050",fontWeight:700}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((r,i)=>{
                      const vc2 = VCOLOR[r.verdict]||"#94a3b8";
                      return (
                        <tr key={r.ticker} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:i<3?"rgba(0,255,136,0.02)":"transparent"}}>
                          <td style={{padding:"7px 8px",color:i<3?"#fbbf24":"#3d5a6e",fontWeight:700,fontFamily:"monospace"}}>#{i+1}</td>
                          <td style={{padding:"7px 8px",fontWeight:800,color:"#00ff88",fontFamily:"monospace",cursor:"pointer"}} onClick={()=>{setInputTicker(r.ticker);setTab("analysis");}}>{r.ticker}</td>
                          <td style={{padding:"7px 8px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <div style={{width:35,height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
                                <div style={{height:"100%",width:r.score+"%",background:vc2,borderRadius:2}}/>
                              </div>
                              <span style={{color:vc2,fontFamily:"monospace",fontWeight:700,fontSize:11}}>{r.score}</span>
                            </div>
                          </td>
                          <td style={{padding:"7px 8px",color:vc2,fontWeight:700,whiteSpace:"nowrap"}}>{r.verdict}</td>
                          <td style={{padding:"7px 8px",color:VCOLOR[r.signal.replace("_"," ")]||"#94a3b8"}}>{r.signal}</td>
                          <td style={{padding:"7px 8px",color:"#fbbf24",fontFamily:"monospace"}}>{r.confidence}%</td>
                          <td style={{padding:"7px 8px",color:"#c8d6e0",fontFamily:"monospace"}}>${r.price.toFixed(2)}</td>
                          <td style={{padding:"7px 8px",color:"#a78bfa",fontSize:9}}>{r.options}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── SETUP TAB ── */}
        {tab==="setup" && (
          <SCard title="⚙️ Complete Setup Guide" color="#fbbf24" open>
            <div style={{fontSize:11,color:"#8ba0b0",lineHeight:1.9}}>
              <div style={{color:"#fbbf24",fontWeight:700,marginBottom:8}}>Step 1 — Install Python packages</div>
              <div style={{background:"rgba(0,0,0,0.5)",borderRadius:6,padding:10,fontFamily:"Courier New,monospace",fontSize:10,color:"#d4d4d4",marginBottom:12}}>
                pip install finviz groq vaderSentiment requests pandas --break-system-packages
              </div>
              <div style={{color:"#fbbf24",fontWeight:700,marginBottom:8}}>Step 2 — Get Free API Keys (all 100% free, no credit card)</div>
              {[
                {name:"Groq (LLaMA 70B)",url:"console.groq.com",var:"GROQ_API_KEY",limit:"14,400 req/day, 30 RPM free"},
                {name:"Gemini 1.5 Flash",url:"ai.google.dev",var:"GEMINI_API_KEY",limit:"100 req/day, 15 RPM free"},
                {name:"Alpha Vantage",url:"alphavantage.co/support/#api-key",var:"ALPHA_VANTAGE_KEY",limit:"25 req/day free"},
                {name:"Finnhub (optional)",url:"finnhub.io/register",var:"FINNHUB_API_KEY",limit:"60 req/min free"},
              ].map(k=>(
                <div key={k.name} style={{display:"flex",gap:10,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{minWidth:140,fontWeight:700,color:"#c8d6e0",fontSize:10}}>{k.name}</div>
                  <div>
                    <div style={{fontSize:9,color:"#00ff88"}}>{k.url}</div>
                    <div style={{fontSize:8,color:"#2a4050"}}>env var: {k.var} | {k.limit}</div>
                  </div>
                </div>
              ))}
              <div style={{color:"#fbbf24",fontWeight:700,marginBottom:8,marginTop:12}}>Step 3 — Set environment variables</div>
              <div style={{background:"rgba(0,0,0,0.5)",borderRadius:6,padding:10,fontFamily:"Courier New,monospace",fontSize:10,color:"#d4d4d4",marginBottom:12}}>
                {"export GROQ_API_KEY=gsk_your_key_here\nexport GEMINI_API_KEY=AIza_your_key_here\nexport ALPHA_VANTAGE_KEY=your_key_here\nexport FINNHUB_API_KEY=your_key_here"}
              </div>
              <div style={{color:"#fbbf24",fontWeight:700,marginBottom:8}}>Step 4 — Run the AXIOM engine</div>
              <div style={{background:"rgba(0,0,0,0.5)",borderRadius:6,padding:10,fontFamily:"Courier New,monospace",fontSize:10,color:"#d4d4d4"}}>
                {"python AXIOM-Finviz-AI-Integration.py\n\n# Or import and use in your code:\nfrom AXIOM_engine import AXIOMSignalEngine\nengine = AXIOMSignalEngine()\nresult = engine.full_analysis('NVDA')\nprint(result['master_signal'])"}
              </div>
              <div style={{marginTop:12,padding:"8px 10px",background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:6,fontSize:9,color:"#fbbf24"}}>
                ⚠️ Finviz data is delayed 15-20 min. NOT suitable for live trading execution. Use for analysis, research, and signal generation only.
              </div>
            </div>
          </SCard>
        )}

        {/* ── API REFERENCE TAB ── */}
        {tab==="api" && (
          <>
            {[
              {title:"Finviz — 90+ Metrics",col:"#00ff88",code:`import finviz\n# Get 90+ metrics per stock\nstock = finviz.get_stock('NVDA')\nprint(stock['P/E'], stock['RSI (14)'], stock['Target Price'])\n\n# Get news headlines\nnews = finviz.get_news('NVDA')\nfor time, headline, url, source in news[:5]:\n    print(f"{time} - {headline}")\n\n# Get analyst price targets\ntargets = finviz.get_analyst_price_targets('NVDA', last_ratings=10)\nfor t in targets:\n    print(t['analyst'], t['rating'], t['target_to'])\n\n# Screen for bullish setups\nfrom finviz.screener import Screener\nscreener = Screener(\n    filters=['ta_sma50_pa','ta_rsi_om50','ta_rsi_nob70','cap_largeover'],\n    table='Technical', order='-volume'\n)\nfor stock in screener[:10]:\n    print(stock['Ticker'], stock['RSI (14)'], stock['Pattern'])`},
              {title:"Groq / LLaMA 70B — Free AI Analysis",col:"#f97316",code:`from groq import Groq\nclient = Groq(api_key="YOUR_GROQ_KEY")  # console.groq.com\n\n# Analyze stock with all Finviz data\nresponse = client.chat.completions.create(\n    model="llama-3.3-70b-versatile",  # 750 tokens/sec FREE\n    messages=[{"role":"user","content": f\"\"\"\n        Analyze NVDA. Data: P/E 68x, RSI 62, above SMA50,\n        EPS growth +288%, gross margin 74.6%.\n        News: 3 bullish, 1 bearish headlines.\n        Return JSON: signal, confidence, entry, stop, target1, target2\n    \"\"\"}],\n    response_format={"type":"json_object"},\n    temperature=0.1\n)\nprint(response.choices[0].message.content)  # JSON signal`},
              {title:"Alpha Vantage — Official AI News Sentiment",col:"#a78bfa",code:`import requests\n\n# AI-scored news sentiment (official free API)\nresp = requests.get('https://www.alphavantage.co/query', params={\n    'function': 'NEWS_SENTIMENT',\n    'tickers': 'NVDA',\n    'apikey': 'YOUR_KEY',  # alphavantage.co — FREE 25/day\n    'limit': 10,\n    'sort': 'LATEST'\n})\ndata = resp.json()\n\n# Each article has AI sentiment scores per ticker\nfor article in data['feed'][:3]:\n    ticker_sentiment = next(\n        ts for ts in article['ticker_sentiment']\n        if ts['ticker'] == 'NVDA'\n    )\n    print(article['title'][:50])\n    print(f"  Score: {ticker_sentiment['ticker_sentiment_score']}")\n    print(f"  Label: {ticker_sentiment['ticker_sentiment_label']}")`},
              {title:"VADER — Free Local Sentiment (No API needed)",col:"#00d4ff",code:`from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer\n# pip install vaderSentiment — runs 100% locally, no API\n\nanalyzer = SentimentIntensityAnalyzer()\n\nheadlines = [\n    "NVIDIA crushes Q4 earnings, raises guidance significantly",\n    "AI chip demand expected to surge through 2026",\n    "Analysts upgrade NVDA to Strong Buy with $1200 target"\n]\n\nfor headline in headlines:\n    score = analyzer.polarity_scores(headline)\n    compound = score['compound']  # -1 to +1\n    label = 'BULL' if compound > 0.05 else 'BEAR' if compound < -0.05 else 'NEUT'\n    print(f"{compound:+.3f} [{label}] {headline[:50]}")\n\n# Output:\n# +0.620 [BULL] NVIDIA crushes Q4 earnings, raises guidance\n# +0.450 [BULL] AI chip demand expected to surge\n# +0.680 [BULL] Analysts upgrade NVDA to Strong Buy`},
            ].map(({title,col,code})=>(
              <SCard key={title} title={title} color={col} open={false}>
                <div style={{background:"rgba(0,0,0,0.5)",borderRadius:6,padding:12,fontFamily:"Courier New,monospace",fontSize:9,color:"#d4d4d4",lineHeight:1.7,overflowX:"auto",whiteSpace:"pre"}}>
                  {code}
                </div>
              </SCard>
            ))}
          </>
        )}

        <div style={{textAlign:"center",marginTop:24,fontSize:9,color:"#0e1e26",letterSpacing:1}}>
          AXIOM FINVIZ+AI ENGINE · DEMO MODE (LIVE: needs API keys) · NOT FINANCIAL ADVICE
        </div>
      </div>
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        input:focus{border-color:rgba(0,255,136,0.5)!important;box-shadow:0 0 0 2px rgba(0,255,136,0.07)!important}
        input::placeholder{color:#1a2e38}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(0,255,136,0.15);border-radius:3px}
      `}</style>
    </div>
  );
}
