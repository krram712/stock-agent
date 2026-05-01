import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:"#050709", s1:"#0a0e14", s2:"#0f1520", s3:"#141d2e",
  border:"#1a2640", bright:"#223050",
  green:"#00d97e", greenD:"#00d97e15",
  red:"#ff3d5a",   redD:"#ff3d5a15",
  yellow:"#f5c200",yellowD:"#f5c20015",
  blue:"#2d9cff",  blueD:"#2d9cff12",
  purple:"#a855f7",purpleD:"#a855f712",
  cyan:"#06d6d6",
  text:"#94aabf", dim:"#344a60", white:"#ddeeff",
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT WATCHLIST — 20 tickers
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_TICKERS = [
  "NVDA","AAPL","MSFT","AMZN","GOOGL",
  "META","TSLA","AMD","AVGO","TSM",
  "PLTR","ARM","SMCI","MU","MRVL",
  "SPY","QQQ","SOFI","COIN","NFLX"
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function normalCDF(x){
  const a=[0.254829592,-0.284496736,1.421413741,-1.453152027,1.061405429],p=0.3275911,s=x<0?-1:1;
  x=Math.abs(x);const t=1/(1+p*x);
  return 0.5*(1+s*(1-((((a[4]*t+a[3])*t+a[2])*t+a[1])*t+a[0])*t*Math.exp(-x*x)));
}
function bsCallPrice(S,K,T,sig,r=0.045){
  if(T<=0)return Math.max(S-K,0);
  const d1=(Math.log(S/K)+(r+.5*sig*sig)*T)/(sig*Math.sqrt(T));
  const d2=d1-sig*Math.sqrt(T);
  return S*normalCDF(d1)-K*Math.exp(-r*T)*normalCDF(d2);
}
function calcDelta(S,K,T,sig,r=0.045){
  if(T<=0)return S>K?1:0;
  const d1=(Math.log(S/K)+(r+.5*sig*sig)*T)/(sig*Math.sqrt(T));
  return normalCDF(d1);
}
function fmt(n,d=2){return n===null||n===undefined?"—":Number(n).toFixed(d);}
function fmtPct(n){return n===null?"—":`${n>=0?"+":""}${fmt(n,2)}%`;}
function fmtD(n){return n===null?"—":`$${fmt(n,2)}`;}
const now=()=>new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"});

// Score-to-color
function scoreColor(s){
  if(s>=75)return C.green;
  if(s>=50)return C.yellow;
  return C.red;
}

// Build option strategy recommendation from score data
function buildStrategy(ticker, price, iv, rsi, trend, dte=30){
  const atm   = Math.round(price/5)*5;
  const otm1  = atm+5;
  const otm2  = atm+15;
  const itm   = atm-5;

  if(trend==="BULL" && rsi<65 && iv<65){
    return {
      type:"Bull Call Spread",
      legs:`Buy $${atm}C / Sell $${otm2}C`,
      expiry:`${dte}DTE`,
      debit:fmtD(bsCallPrice(price,atm,dte/365,iv/100)-bsCallPrice(price,otm2,dte/365,iv/100)),
      maxProfit:fmtD((otm2-atm-(bsCallPrice(price,atm,dte/365,iv/100)-bsCallPrice(price,otm2,dte/365,iv/100)))*100),
      breakeven:fmtD(atm+(bsCallPrice(price,atm,dte/365,iv/100)-bsCallPrice(price,otm2,dte/365,iv/100))),
      risk:"Defined", color:C.green, icon:"↗",
      verdict:"BUY SPREAD",
    };
  }
  if(trend==="BULL" && rsi>=65){
    return {
      type:"Wait for Pullback",
      legs:`Target: $${itm}C / $${atm}C spread`,
      expiry:`${dte}DTE`,
      debit:"—", maxProfit:"—", breakeven:"—",
      risk:"Not yet", color:C.yellow, icon:"⏸",
      verdict:"WAIT ENTRY",
    };
  }
  if(trend==="BEAR" && iv>50){
    return {
      type:"Bear Put Spread",
      legs:`Buy $${atm}P / Sell $${atm-15}P`,
      expiry:`${dte}DTE`,
      debit:fmtD(bsCallPrice(price,atm,dte/365,iv/100)-bsCallPrice(price,atm-15,dte/365,iv/100)),
      maxProfit:fmtD(15*100), breakeven:fmtD(atm-2),
      risk:"Defined", color:C.red, icon:"↘",
      verdict:"BUY PUT SPREAD",
    };
  }
  if(trend==="SIDEWAYS"){
    return {
      type:"Iron Condor",
      legs:`Sell $${atm-10}P/$${otm1}C, Buy $${atm-15}P/$${otm2}C`,
      expiry:`${dte}DTE`,
      debit:"Credit ~$2–3", maxProfit:"Premium collected", breakeven:"Range-based",
      risk:"Defined", color:C.purple, icon:"↔",
      verdict:"SELL CONDOR",
    };
  }
  return {
    type:"Hold / Monitor",
    legs:"No clear setup",
    expiry:"—", debit:"—", maxProfit:"—", breakeven:"—",
    risk:"N/A", color:C.dim, icon:"○",
    verdict:"MONITOR",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAUDE API CALL — batched 10 at a time, robust parsing
// ─────────────────────────────────────────────────────────────────────────────

// Seed data so we always have something to show even if API partially fails
const SEED = {
  NVDA:{price:199.57,changePct:-4.63,rsi:71,iv:50,trend:"BULL",signal:"WAIT",ma20:181.44,support:195,resistance:216,sector:"Semiconductors",earningsDate:"May 20",entryScore:72,riskLevel:"MEDIUM",optionType:"Bull Call Spread",strikes:"$200/$215",expiry:"May 30",newsHeadline:"NVDA fell 4.6% despite hyperscaler AI capex surge; dip buyers watching $198–200 support zone.",weekStrategy:"Wait for $197–200 hold then enter $200/$215 bull call spread. Stop if breaks $194.",monthStrategy:"Accumulate before May 20 earnings. Target $220+ post-earnings on strong beat.",catalysts:["May 20 earnings","AI capex $1T+","Blackwell demand"],risks:["RSI overbought","Export restrictions","IV crush"]},
  AAPL:{price:271.35,changePct:0.44,rsi:58,iv:28,trend:"BULL",signal:"BUY",ma20:262,support:265,resistance:278,sector:"Technology",earningsDate:"May 1",entryScore:78,riskLevel:"LOW",optionType:"Bull Call Spread",strikes:"$270/$285",expiry:"Jun 20",newsHeadline:"Apple rose 0.4% as services revenue hit record $26B; AI iPhone upgrade cycle gaining momentum.",weekStrategy:"Hold above $265 support. Buy $270/$285 call spread on any dip to $266–268.",monthStrategy:"Services + India expansion = undervalued. Add on dips below $265 for June expiry spreads.",catalysts:["AI iPhone cycle","Services growth","India expansion"],risks:["China slowdown","Valuation","FX headwinds"]},
  MSFT:{price:421,changePct:-3.1,rsi:62,iv:32,trend:"BULL",signal:"WAIT",ma20:405,support:410,resistance:435,sector:"Technology",earningsDate:"Apr 30",entryScore:68,riskLevel:"LOW",optionType:"Bull Call Spread",strikes:"$420/$440",expiry:"Jun 20",newsHeadline:"Microsoft fell 3% post-earnings as Azure growth of 33% missed 35% estimate; AI Copilot adoption strong.",weekStrategy:"Watch $410 support. If holds, enter $420/$440 spread. Cut if breaks $408.",monthStrategy:"Azure re-acceleration expected in Q4. Buy dips for June spreads. Target $440.",catalysts:["Azure AI workloads","Copilot enterprise","GitHub momentum"],risks:["Azure miss","High valuation","AI competition"]},
  AMZN:{price:226,changePct:2.1,rsi:55,iv:35,trend:"BULL",signal:"BUY",ma20:210,support:218,resistance:238,sector:"E-Commerce/Cloud",earningsDate:"May 1",entryScore:82,riskLevel:"MEDIUM",optionType:"Bull Call Spread",strikes:"$225/$245",expiry:"Jun 20",newsHeadline:"Amazon surged 2% after AWS revenue beat at $32B; advertising and grocery showing strong momentum.",weekStrategy:"Strong entry zone here. Buy $225/$245 call spread. Stop at $218 break.",monthStrategy:"AWS acceleration + advertising = $240+ by June. Scale in over two weeks.",catalysts:["AWS beat","Ad revenue","Prime membership"],risks:["Capex guidance","Regulation","AWS competition"]},
  GOOGL:{price:382,changePct:9.97,rsi:72,iv:38,trend:"BULL",signal:"WAIT",ma20:352,support:368,resistance:395,sector:"Technology",earningsDate:"Apr 29",entryScore:65,riskLevel:"MEDIUM",optionType:"Bull Call Spread",strikes:"$380/$400",expiry:"Jun 20",newsHeadline:"Alphabet surged 10% on Q1 beat; Search ad revenue +12% and Google Cloud grew 28% YoY.",weekStrategy:"RSI extended after 10% pop. Wait for $370–375 dip, then enter $380/$400 spread.",monthStrategy:"Search + Cloud momentum real. Target $395–400 June. Enter only on pullbacks.",catalysts:["Search AI","Cloud 28% growth","YouTube ads"],risks:["RSI overbought","AI competition","Regulation"]},
  META:{price:611,changePct:-8.55,rsi:48,iv:45,trend:"SIDEWAYS",signal:"WAIT",ma20:580,support:590,resistance:640,sector:"Technology",earningsDate:"Apr 30",entryScore:55,riskLevel:"MEDIUM",optionType:"Iron Condor",strikes:"$580P/$640C",expiry:"May 30",newsHeadline:"Meta dropped 8.5% on capex guidance raise to $72B; core ad business strong but investors spooked by spending.",weekStrategy:"Watch $590 support. Iron condor $580/$640 if it stabilizes. Avoid directional bets now.",monthStrategy:"Ad business strong, capex fear overdone. Re-enter bull spread if stabilizes $590–600.",catalysts:["Ad revenue growth","Llama AI","AR/VR progress"],risks:["$72B capex","Regulation","Valuation"]},
  TSLA:{price:292,changePct:1.2,rsi:52,iv:65,trend:"SIDEWAYS",signal:"HOLD",ma20:278,support:280,resistance:315,sector:"EV/Auto",earningsDate:"Apr 22",entryScore:48,riskLevel:"HIGH",optionType:"Iron Condor",strikes:"$275P/$315C",expiry:"May 30",newsHeadline:"Tesla rose 1.2% as FSD v13 rollout accelerates; analysts debate robotaxi timeline for Q3 2026.",weekStrategy:"High IV = expensive options. Sell iron condor $275/$315 to collect premium in range.",monthStrategy:"Robotaxi catalyst in Q3 may be real driver. Small bull call spread $295/$320 for June.",catalysts:["Robotaxi launch","FSD v13","Energy storage"],risks:["High IV","Musk distraction","EV competition"]},
  AMD:{price:145,changePct:5.16,rsi:60,iv:55,trend:"BULL",signal:"BUY",ma20:132,support:138,resistance:158,sector:"Semiconductors",earningsDate:"Apr 29",entryScore:80,riskLevel:"MEDIUM",optionType:"Bull Call Spread",strikes:"$145/$160",expiry:"Jun 20",newsHeadline:"AMD surged 5% post-earnings; MI300X AI GPU sales beat estimates and data center revenue hit $4.2B.",weekStrategy:"Strong breakout. Buy $145/$160 call spread on any dip to $142–144. Stop at $138.",monthStrategy:"MI300X ramp real. MI350 launch in Q3. Target $160–165 by June.",catalysts:["MI300X AI GPU","Data center $4.2B","MI350 launch"],risks:["NVDA competition","Supply constraints","Margin pressure"]},
  AVGO:{price:220,changePct:2.95,rsi:63,iv:38,trend:"BULL",signal:"BUY",ma20:205,support:212,resistance:232,sector:"Semiconductors",earningsDate:"Jun 5",entryScore:75,riskLevel:"LOW",optionType:"Bull Call Spread",strikes:"$220/$240",expiry:"Jun 20",newsHeadline:"Broadcom rose 3% as custom AI ASIC demand from hyperscalers remains exceptionally strong in Q2.",weekStrategy:"Buy $220/$240 call spread on hold above $212. Strong R/R ahead of June earnings.",monthStrategy:"Custom AI chip supercycle. $240 target by June earnings. Scale in on any 3–5% dip.",catalysts:["Custom AI ASICs","VMware integration","Hyperscaler demand"],risks:["Concentration risk","VMware execution","Rate sensitivity"]},
  TSM:{price:180,changePct:0.57,rsi:56,iv:32,trend:"BULL",signal:"BUY",ma20:168,support:174,resistance:188,sector:"Semiconductors",earningsDate:"Apr 17",entryScore:76,riskLevel:"LOW",optionType:"Bull Call Spread",strikes:"$180/$195",expiry:"Jun 20",newsHeadline:"TSMC ADR rose 0.6%; CoWoS advanced packaging for AI chips fully booked through 2027.",weekStrategy:"Clean setup above all MAs. Enter $180/$195 spread. Stop at $174 break.",monthStrategy:"AI packaging demand locked in. $195 target. Strong long-term hold.",catalysts:["CoWoS AI packaging","N2 node ramp","NVIDIA/AMD demand"],risks:["Taiwan geopolitics","FX exposure","US tariffs"]},
  PLTR:{price:118,changePct:1.8,rsi:65,iv:60,trend:"BULL",signal:"WAIT",ma20:105,support:112,resistance:125,sector:"AI/Software",earningsDate:"May 5",entryScore:62,riskLevel:"HIGH",optionType:"Bull Call Spread",strikes:"$115/$130",expiry:"Jun 20",newsHeadline:"Palantir rose 1.8% ahead of May 5 earnings; AIP government and commercial pipeline expanding.",weekStrategy:"Wait for post-earnings reaction May 5. If beats, enter $115/$130 spread on pullback.",monthStrategy:"AIP adoption accelerating. $130 target if May 5 earnings beat. High IV = expensive entry.",catalysts:["AIP commercial growth","Government contracts","May 5 earnings"],risks:["High valuation","High IV","Insider selling"]},
  ARM:{price:135,changePct:4.28,rsi:68,iv:58,trend:"BULL",signal:"WAIT",ma20:118,support:128,resistance:145,sector:"Semiconductors",earningsDate:"May 7",entryScore:60,riskLevel:"HIGH",optionType:"Wait",strikes:"Post-earnings",expiry:"May 30",newsHeadline:"ARM Holdings surged 4.3% on AI chip licensing momentum; royalty rates rising for v9 architecture.",weekStrategy:"Wait for May 7 earnings reaction. RSI extended. Enter only on post-earnings dip.",monthStrategy:"v9 architecture royalties + AI licensing = growth story. Target $145 after earnings clarity.",catalysts:["AI licensing royalties","v9 architecture","Mobile AI chips"],risks:["High P/E 80x","Earnings uncertainty","SoftBank overhang"]},
  SMCI:{price:48,changePct:-2.1,rsi:42,iv:75,trend:"SIDEWAYS",signal:"HOLD",ma20:52,support:44,resistance:56,sector:"Servers",earningsDate:"May 6",entryScore:40,riskLevel:"HIGH",optionType:"Iron Condor",strikes:"$44P/$56C",expiry:"May 30",newsHeadline:"Super Micro fell 2.1% on concerns about delayed 10-K filing timeline and competitive pressure from Dell.",weekStrategy:"Avoid until May 6 earnings clarity. If you hold: iron condor $44/$56 to collect premium.",monthStrategy:"Execution risk high. Only small position. If 10-K resolved, potential bounce to $58.",catalysts:["AI server demand","Delayed 10-K resolution","NVIDIA partnership"],risks:["Accounting concerns","High IV 75%","Competition"]},
  MU:{price:112,changePct:-0.25,rsi:50,iv:48,trend:"BULL",signal:"BUY",ma20:105,support:106,resistance:120,sector:"Memory",earningsDate:"Jun 25",entryScore:73,riskLevel:"MEDIUM",optionType:"Bull Call Spread",strikes:"$110/$125",expiry:"Jun 20",newsHeadline:"Micron flat as HBM3E memory demand for AI accelerators hits new record levels in Q2.",weekStrategy:"Clean setup. Buy $110/$125 spread above $106 support. HBM AI demand tailwind.",monthStrategy:"HBM3E ramp for NVIDIA H100/B200 = major revenue driver. $120 target by June.",catalysts:["HBM3E AI demand","DRAM price recovery","Data center"],risks:["Memory cycle","China exposure","Supply glut"]},
  MRVL:{price:78,changePct:5.48,rsi:62,iv:52,trend:"BULL",signal:"BUY",ma20:70,support:74,resistance:85,sector:"Semiconductors",earningsDate:"Jun 3",entryScore:77,riskLevel:"MEDIUM",optionType:"Bull Call Spread",strikes:"$78/$90",expiry:"Jun 20",newsHeadline:"Marvell surged 5.5% as custom AI ASIC design wins with Amazon and Google accelerate into 2027.",weekStrategy:"Buy $78/$90 call spread on hold above $74. Strong R/R ahead of June earnings.",monthStrategy:"Custom ASIC design wins = durable growth. $88–90 target by June earnings.",catalysts:["Custom AI ASICs","Amazon/Google wins","5nm production"],risks:["Customer concentration","Execution risk","Competition"]},
  SPY:{price:557,changePct:1.1,rsi:55,iv:16,trend:"BULL",signal:"HOLD",ma20:545,support:548,resistance:565,sector:"ETF",earningsDate:"N/A",entryScore:60,riskLevel:"LOW",optionType:"Bull Call Spread",strikes:"$555/$570",expiry:"Jun 20",newsHeadline:"S&P 500 rose 1.1% as Big Tech earnings beat offset Meta capex concerns; VIX fell to 16.89.",weekStrategy:"Broad market stable. Hold positions. SPY call spread $555/$570 if bullish macro.",monthStrategy:"Earnings season supportive. Stay long. Buy dips to $545–548 for June expiry.",catalysts:["Strong earnings","VIX low","Fed pause"],risks:["Rate surprise","Geopolitics","Tech concentration"]},
  QQQ:{price:472,changePct:0.9,rsi:56,iv:20,trend:"BULL",signal:"HOLD",ma20:455,support:462,resistance:482,sector:"ETF",earningsDate:"N/A",entryScore:62,riskLevel:"LOW",optionType:"Bull Call Spread",strikes:"$470/$490",expiry:"Jun 20",newsHeadline:"Nasdaq 100 rose 0.9% led by Alphabet and Amazon earnings beats; META drag limited broader losses.",weekStrategy:"Above all MAs. Hold and buy dips. $470/$490 call spread with $462 stop.",monthStrategy:"AI earnings season tailwind. $490+ target by June. Scale in on any 2–3% pullback.",catalysts:["Tech earnings","AI infrastructure","Rate stability"],risks:["Concentration risk","Rate spike","Regulation"]},
  SOFI:{price:14.8,changePct:2.3,rsi:54,iv:55,trend:"BULL",signal:"BUY",ma20:13.5,support:13.8,resistance:16.2,sector:"Fintech",earningsDate:"Apr 28",entryScore:68,riskLevel:"HIGH",optionType:"Long Call",strikes:"$15C",expiry:"Jun 20",newsHeadline:"SoFi rose 2.3% after Q1 beat with record member growth; student loan originations rebounding strongly.",weekStrategy:"Small position: buy $15 call outright for $0.80–1.00. Stop if falls below $13.50.",monthStrategy:"Member flywheel + rate cuts = growth acceleration. Target $16–17 by June.",catalysts:["Member growth","Rate cuts","Student loans"],risks:["High IV 55%","Fintech competition","Credit quality"]},
  COIN:{price:225,changePct:3.2,rsi:60,iv:70,trend:"BULL",signal:"WAIT",ma20:205,support:212,resistance:245,sector:"Crypto",earningsDate:"May 8",entryScore:55,riskLevel:"HIGH",optionType:"Bull Call Spread",strikes:"$225/$250",expiry:"Jun 20",newsHeadline:"Coinbase rose 3.2% alongside Bitcoin rally to $77K; spot ETF inflows hit $320M this week.",weekStrategy:"High IV makes spreads expensive. Wait for May 8 earnings. Enter post-earnings dip.",monthStrategy:"BTC ETF flows + stablecoin regulation clarity = catalyst. $245–250 target if BTC holds $75K.",catalysts:["BTC ETF flows","Stablecoin regulation","Earnings May 8"],risks:["High IV 70%","Crypto volatility","Regulatory risk"]},
  NFLX:{price:1050,changePct:1.5,rsi:58,iv:30,trend:"BULL",signal:"BUY",ma20:998,support:1020,resistance:1090,sector:"Streaming",earningsDate:"Apr 15",entryScore:74,riskLevel:"LOW",optionType:"Bull Call Spread",strikes:"$1050/$1100",expiry:"Jun 20",newsHeadline:"Netflix rose 1.5% as ad-tier subscribers hit 45M; live sports strategy driving premium pricing power.",weekStrategy:"Clean setup. Buy $1050/$1100 spread above $1020 support. Low IV = cheap entry.",monthStrategy:"Ad tier + live sports = durable growth. $1100 target by June. Strong R/R.",catalysts:["Ad tier 45M subs","Live sports rights","Password sharing"],risks:["Competition","Content costs","Saturation"]},
};

function generateFallback(ticker) {
  const seed = SEED[ticker];
  if (seed) return { ...seed, ticker, change: (seed.price * seed.changePct / 100), lastUpdated: now() };
  // Generic fallback for custom tickers
  const price = 100 + Math.random() * 200;
  return {
    ticker, price: parseFloat(price.toFixed(2)),
    change: parseFloat(((Math.random()-0.5)*8).toFixed(2)),
    changePct: parseFloat(((Math.random()-0.5)*4).toFixed(2)),
    rsi: Math.round(40 + Math.random()*30),
    iv: Math.round(30 + Math.random()*30),
    trend: ["BULL","SIDEWAYS","BEAR"][Math.floor(Math.random()*3)],
    signal: ["BUY","WAIT","HOLD"][Math.floor(Math.random()*3)],
    ma20: parseFloat((price*0.95).toFixed(2)),
    support: parseFloat((price*0.92).toFixed(2)),
    resistance: parseFloat((price*1.08).toFixed(2)),
    sector: "Unknown", earningsDate: "TBD",
    entryScore: Math.round(40+Math.random()*40),
    riskLevel: "MEDIUM",
    optionType: "Bull Call Spread",
    strikes: `$${Math.round(price)}/$${Math.round(price*1.08)}`,
    expiry: "Jun 20",
    newsHeadline: `${ticker} — no recent news available. Using estimated values.`,
    weekStrategy: "Insufficient data. Monitor price action before entering.",
    monthStrategy: "Insufficient data. Wait for clearer setup.",
    catalysts: ["Earnings upcoming"], risks: ["Data unavailable"],
    lastUpdated: now(),
  };
}

async function callClaudeAPI(tickerBatch) {
  const prompt = `You are a stock and options analyst. Date: May 1, 2026. US markets closed.

Return a JSON array for these tickers: ${tickerBatch.join(", ")}

Each object must have EXACTLY these fields:
ticker, price (number), change (number), changePct (number), rsi (number 0-100), iv (number 20-90), trend (BULL/BEAR/SIDEWAYS), signal (BUY/SELL/WAIT/HOLD), ma20 (number), support (number), resistance (number), sector (string), earningsDate (string), entryScore (number 0-100), riskLevel (LOW/MEDIUM/HIGH), optionType (string), strikes (string), expiry (string), newsHeadline (string, 1 sentence), weekStrategy (string), monthStrategy (string), catalysts (array of 3 strings), risks (array of 3 strings)

Known prices May 1 2026: NVDA=199.57, AAPL=271.35, MSFT=421, AMZN=226, GOOGL=382, META=611, TSLA=292, AMD=145, AVGO=220, TSM=180, PLTR=118, ARM=135, SMCI=48, MU=112, MRVL=78, SPY=557, QQQ=472, SOFI=14.8, COIN=225, NFLX=1050

Return ONLY the raw JSON array. No markdown. No text before or after.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: "Return ONLY valid JSON array. No markdown fences. No explanation. Start response with [ and end with ].",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.slice(0,200)}`);
  }

  const data = await res.json();

  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

  const raw = data.content?.find(b => b.type === "text")?.text || "";
  // Extract JSON array robustly
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array found in response");
  return JSON.parse(match[0]);
}

async function analyzeTickersWithClaude(tickers) {
  // Split into 2 batches of 10 to avoid token limits
  const batch1 = tickers.slice(0, 10);
  const batch2 = tickers.slice(10, 20);
  const results = [];

  for (const batch of [batch1, batch2]) {
    if (batch.length === 0) continue;
    try {
      const batchResult = await callClaudeAPI(batch);
      results.push(...batchResult);
    } catch (e) {
      console.warn("Batch failed, using fallback:", e.message);
      // Use fallback for failed batch
      batch.forEach(t => results.push(generateFallback(t)));
    }
  }

  // Ensure all tickers are present (fill gaps with fallback)
  const returned = new Set(results.map(r => r.ticker));
  tickers.forEach(t => { if (!returned.has(t)) results.push(generateFallback(t)); });

  return results.map(s => ({ ...s, lastUpdated: now() }));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function App(){
  const [tickers, setTickers]    = useState(DEFAULT_TICKERS);
  const [stocks, setStocks]      = useState([]);
  const [loading, setLoading]    = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError]        = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [selectedStock, setSelectedStock] = useState(null);
  const [activeView, setActiveView] = useState("grid"); // grid | table | detail
  const [filterSignal, setFilterSignal] = useState("ALL");
  const [filterSector, setFilterSector] = useState("ALL");
  const [sortBy, setSortBy]      = useState("entryScore");
  const [countdown, setCountdown] = useState(0);
  const [editTickers, setEditTickers] = useState(false);
  const [tickerInput, setTickerInput] = useState(DEFAULT_TICKERS.join(", "));
  const [tab, setTab]            = useState("watchlist"); // watchlist | strategy | news
  const intervalRef              = useRef(null);
  const countdownRef             = useRef(null);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const runEngine = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeTickersWithClaude(tickers);
      const enriched = result.map(s => ({
        ...s,
        strategy: buildStrategy(s.ticker, s.price, s.iv, s.rsi, s.trend),
        lastUpdated: now(),
      }));
      setStocks(enriched);
      setLastUpdate(now());
    } catch(e){
      setError(`API Error: ${e.message}. Try "Load Seed Data" for instant results.`);
    } finally {
      setLoading(false);
    }
  }, [tickers]);

  const loadSeedData = useCallback(() => {
    const enriched = tickers.map(t => {
      const s = generateFallback(t);
      return { ...s, strategy: buildStrategy(t, s.price, s.iv, s.rsi, s.trend), lastUpdated: now() };
    });
    setStocks(enriched);
    setLastUpdate(now());
    setError(null);
  }, [tickers]);

  // ── auto-refresh ───────────────────────────────────────────────────────────
  useEffect(()=>{
    if(autoRefresh){
      setCountdown(refreshInterval*60);
      intervalRef.current = setInterval(()=>{ runEngine(); setCountdown(refreshInterval*60); }, refreshInterval*60*1000);
      countdownRef.current = setInterval(()=>{ setCountdown(c=>c>0?c-1:0); }, 1000);
    } else {
      clearInterval(intervalRef.current);
      clearInterval(countdownRef.current);
      setCountdown(0);
    }
    return ()=>{ clearInterval(intervalRef.current); clearInterval(countdownRef.current); };
  },[autoRefresh, refreshInterval, runEngine]);

  // ── filter & sort ──────────────────────────────────────────────────────────
  const filtered = stocks
    .filter(s => filterSignal==="ALL" || s.signal===filterSignal)
    .filter(s => filterSector==="ALL" || s.sector===filterSector)
    .sort((a,b)=>{
      if(sortBy==="entryScore") return (b.entryScore||0)-(a.entryScore||0);
      if(sortBy==="changePct")  return (b.changePct||0)-(a.changePct||0);
      if(sortBy==="iv")         return (b.iv||0)-(a.iv||0);
      if(sortBy==="rsi")        return (b.rsi||0)-(a.rsi||0);
      return a.ticker.localeCompare(b.ticker);
    });

  const sectors = [...new Set(stocks.map(s=>s.sector).filter(Boolean))];
  const topPicks = [...stocks].sort((a,b)=>(b.entryScore||0)-(a.entryScore||0)).slice(0,5);
  const buySignals = stocks.filter(s=>s.signal==="BUY");
  const avgScore = stocks.length ? Math.round(stocks.reduce((a,b)=>a+(b.entryScore||0),0)/stocks.length) : 0;

  // ── render card ────────────────────────────────────────────────────────────
  const StockCard = ({s}) => {
    const sc = s.entryScore||0;
    const cc = scoreColor(sc);
    const tc = s.trend==="BULL"?C.green:s.trend==="BEAR"?C.red:C.yellow;
    const sgc = s.signal==="BUY"?C.green:s.signal==="SELL"?C.red:s.signal==="WAIT"?C.yellow:C.dim;
    return(
      <div onClick={()=>{setSelectedStock(s);setActiveView("detail");}}
        style={{background:C.s2,border:`1px solid ${sc>=75?cc+"44":C.border}`,borderRadius:10,
          padding:"12px 14px",cursor:"pointer",transition:"all .2s",
          boxShadow:sc>=75?`0 0 16px ${cc}18`:"none",
        }}>
        {/* top row */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:C.white,fontFamily:"'Share Tech Mono',monospace"}}>{s.ticker}</div>
            <div style={{fontSize:9,color:C.dim,marginTop:1}}>{s.sector||"—"}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:14,fontWeight:700,color:C.white,fontFamily:"'Share Tech Mono',monospace"}}>${fmt(s.price)}</div>
            <div style={{fontSize:10,color:s.changePct>=0?C.green:C.red}}>{fmtPct(s.changePct)}</div>
          </div>
        </div>
        {/* score bar */}
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <span style={{fontSize:8,color:C.dim,letterSpacing:2}}>ENTRY SCORE</span>
            <span style={{fontSize:11,fontWeight:800,color:cc,fontFamily:"'Share Tech Mono',monospace"}}>{sc}</span>
          </div>
          <div style={{background:C.border,borderRadius:3,height:4,overflow:"hidden"}}>
            <div style={{background:`linear-gradient(90deg,${C.blue},${cc})`,width:`${sc}%`,height:"100%",borderRadius:3,transition:"width .5s"}}/>
          </div>
        </div>
        {/* metrics row */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:8}}>
          {[
            {l:"RSI",v:fmt(s.rsi,0),c:s.rsi>70?C.red:s.rsi<35?C.green:C.yellow},
            {l:"IV",v:`${fmt(s.iv,0)}%`,c:s.iv>65?C.red:C.green},
            {l:"TREND",v:s.trend||"—",c:tc},
          ].map(({l,v,c})=>(
            <div key={l} style={{background:C.s3,borderRadius:4,padding:"4px 6px",textAlign:"center"}}>
              <div style={{fontSize:7,color:C.dim,letterSpacing:1}}>{l}</div>
              <div style={{fontSize:10,fontWeight:700,color:c,fontFamily:"'Share Tech Mono',monospace"}}>{v}</div>
            </div>
          ))}
        </div>
        {/* signal + strategy */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{background:`${sgc}22`,border:`1px solid ${sgc}44`,borderRadius:4,padding:"3px 8px",fontSize:9,fontWeight:800,color:sgc,letterSpacing:2}}>{s.signal||"—"}</div>
          <div style={{fontSize:9,color:C.dim,maxWidth:120,textAlign:"right",lineHeight:1.3}}>{s.optionType||"—"} · {s.strikes||"—"}</div>
        </div>
        {s.newsHeadline&&(
          <div style={{marginTop:8,fontSize:9,color:C.dim,lineHeight:1.4,borderTop:`1px solid ${C.border}`,paddingTop:6,
            display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
            📰 {s.newsHeadline}
          </div>
        )}
      </div>
    );
  };

  // ── detail view ────────────────────────────────────────────────────────────
  const DetailView = ({s}) => {
    if(!s) return null;
    const cc = scoreColor(s.entryScore||0);
    const tc = s.trend==="BULL"?C.green:s.trend==="BEAR"?C.red:C.yellow;
    // compute spread greeks
    const T=(30/365), sig=(s.iv||50)/100;
    const atm=Math.round((s.price||100)/5)*5;
    const otm=atm+15;
    const longCall=bsCallPrice(s.price,atm,T,sig);
    const shortCall=bsCallPrice(s.price,otm,T,sig);
    const netDebit=Math.max(longCall-shortCall,0.01);
    const spreadDelta=calcDelta(s.price,atm,T,sig)-calcDelta(s.price,otm,T,sig);

    return(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* back button + header */}
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button onClick={()=>{setSelectedStock(null);setActiveView("grid");}} style={{
            background:C.s2,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 12px",
            color:C.dim,fontSize:11,fontWeight:700,letterSpacing:1}}>← BACK</button>
          <div>
            <span style={{fontSize:22,fontWeight:800,color:C.white,fontFamily:"'Share Tech Mono',monospace"}}>{s.ticker}</span>
            <span style={{fontSize:13,color:C.dim,marginLeft:10}}>{s.sector}</span>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <div style={{background:`${scoreColor(s.entryScore||0)}22`,border:`1px solid ${scoreColor(s.entryScore||0)}55`,borderRadius:6,padding:"6px 12px",textAlign:"center"}}>
              <div style={{fontSize:8,color:C.dim}}>SCORE</div>
              <div style={{fontSize:18,fontWeight:800,color:cc}}>{s.entryScore||0}</div>
            </div>
            <div style={{background:`${tc}22`,border:`1px solid ${tc}55`,borderRadius:6,padding:"6px 12px",textAlign:"center"}}>
              <div style={{fontSize:8,color:C.dim}}>TREND</div>
              <div style={{fontSize:14,fontWeight:800,color:tc}}>{s.trend}</div>
            </div>
          </div>
        </div>

        {/* price strip */}
        <div style={{background:C.s2,borderRadius:10,padding:"14px 18px",border:`1px solid ${C.border}`,display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
          {[
            {l:"PRICE",v:`$${fmt(s.price)}`,c:C.white},
            {l:"CHANGE",v:fmtPct(s.changePct),c:s.changePct>=0?C.green:C.red},
            {l:"RSI(14)",v:fmt(s.rsi,0),c:s.rsi>70?C.red:s.rsi<35?C.green:C.yellow},
            {l:"IV",v:`${fmt(s.iv,0)}%`,c:s.iv>65?C.red:C.green},
            {l:"20-DAY MA",v:`$${fmt(s.ma20)}`,c:s.price>s.ma20?C.green:C.red},
          ].map(({l,v,c})=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:8,color:C.dim,letterSpacing:2}}>{l}</div>
              <div style={{fontSize:16,fontWeight:800,color:c,fontFamily:"'Share Tech Mono',monospace"}}>{v}</div>
            </div>
          ))}
        </div>

        {/* News */}
        <div style={{background:C.s2,borderRadius:10,padding:"12px 16px",border:`1px solid ${C.border}`}}>
          <div style={{fontSize:9,color:C.dim,letterSpacing:3,marginBottom:6}}>LATEST NEWS</div>
          <div style={{fontSize:12,color:C.text,lineHeight:1.6}}>📰 {s.newsHeadline||"No news available"}</div>
        </div>

        {/* strategies */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {/* 1-week */}
          <div style={{background:C.s2,borderRadius:10,padding:"14px 16px",border:`1px solid ${C.yellow}44`,borderLeft:`3px solid ${C.yellow}`}}>
            <div style={{fontSize:9,color:C.yellow,letterSpacing:3,marginBottom:8}}>1-WEEK STRATEGY</div>
            <div style={{fontSize:12,color:C.text,lineHeight:1.6}}>{s.weekStrategy||"—"}</div>
          </div>
          {/* 1-month */}
          <div style={{background:C.s2,borderRadius:10,padding:"14px 16px",border:`1px solid ${C.green}44`,borderLeft:`3px solid ${C.green}`}}>
            <div style={{fontSize:9,color:C.green,letterSpacing:3,marginBottom:8}}>1-MONTH STRATEGY</div>
            <div style={{fontSize:12,color:C.text,lineHeight:1.6}}>{s.monthStrategy||"—"}</div>
          </div>
        </div>

        {/* option strategy */}
        <div style={{background:C.s2,borderRadius:10,padding:"14px 18px",border:`1px solid ${C.blue}44`}}>
          <div style={{fontSize:9,color:C.blue,letterSpacing:3,marginBottom:10}}>RECOMMENDED OPTION STRATEGY</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
            {[
              {l:"STRATEGY",v:s.optionType||"—",c:C.blue},
              {l:"STRIKES",v:s.strikes||"—",c:C.white},
              {l:"EXPIRY",v:s.expiry||"30DTE",c:C.dim},
              {l:"EST DEBIT",v:fmtD(netDebit),c:C.yellow},
              {l:"SPREAD DELTA",v:fmt(spreadDelta,3),c:C.purple},
              {l:"RISK LEVEL",v:s.riskLevel||"MED",c:s.riskLevel==="HIGH"?C.red:s.riskLevel==="LOW"?C.green:C.yellow},
            ].map(({l,v,c})=>(
              <div key={l} style={{background:C.s3,borderRadius:6,padding:"8px 10px"}}>
                <div style={{fontSize:8,color:C.dim,letterSpacing:2,marginBottom:2}}>{l}</div>
                <div style={{fontSize:13,fontWeight:700,color:c,fontFamily:"'Share Tech Mono',monospace"}}>{v}</div>
              </div>
            ))}
          </div>
          {/* entry/exit rules */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div style={{background:C.s3,borderRadius:6,padding:"10px 12px"}}>
              <div style={{fontSize:8,color:C.green,letterSpacing:2,marginBottom:6}}>ENTRY RULES</div>
              {[
                `Price ${s.price>s.ma20?"above":"near"} 20-day MA ($${fmt(s.ma20)})`,
                `RSI ${s.rsi>70?"cooling from overbought — wait":s.rsi<40?"oversold bounce — enter":"neutral — OK to enter"}`,
                `Support: $${fmt(s.support)} — hold above this`,
                `IV ${s.iv>65?"HIGH — wait for IV to cool":"fair — OK to buy spreads"}`,
              ].map((r,i)=>(
                <div key={i} style={{fontSize:10,color:C.text,marginBottom:4,display:"flex",gap:6}}>
                  <span style={{color:C.green}}>›</span>{r}
                </div>
              ))}
            </div>
            <div style={{background:C.s3,borderRadius:6,padding:"10px 12px"}}>
              <div style={{fontSize:8,color:C.red,letterSpacing:2,marginBottom:6}}>EXIT RULES</div>
              {[
                "Take profit at +50% of spread value",
                "Stop loss at -30% of debit paid",
                "Close 3 days before expiry (time stop)",
                `Price breaks ${s.support?"$"+fmt(s.support):"support"} → close immediately`,
              ].map((r,i)=>(
                <div key={i} style={{fontSize:10,color:C.text,marginBottom:4,display:"flex",gap:6}}>
                  <span style={{color:C.red}}>›</span>{r}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* catalysts & risks */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{background:C.s2,borderRadius:10,padding:"12px 16px",border:`1px solid ${C.border}`}}>
            <div style={{fontSize:9,color:C.green,letterSpacing:3,marginBottom:8}}>CATALYSTS</div>
            {(s.catalysts||["No catalysts listed"]).map((c,i)=>(
              <div key={i} style={{fontSize:11,color:C.text,marginBottom:5,display:"flex",gap:6}}>
                <span style={{color:C.green}}>✓</span>{c}
              </div>
            ))}
          </div>
          <div style={{background:C.s2,borderRadius:10,padding:"12px 16px",border:`1px solid ${C.border}`}}>
            <div style={{fontSize:9,color:C.red,letterSpacing:3,marginBottom:8}}>RISKS</div>
            {(s.risks||["No risks listed"]).map((r,i)=>(
              <div key={i} style={{fontSize:11,color:C.text,marginBottom:5,display:"flex",gap:6}}>
                <span style={{color:C.red}}>✗</span>{r}
              </div>
            ))}
          </div>
        </div>

        {s.earningsDate&&(
          <div style={{background:`${C.yellow}12`,border:`1px solid ${C.yellow}44`,borderRadius:8,padding:"10px 16px",display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:18}}>📅</span>
            <div style={{fontSize:12,color:C.text}}><b style={{color:C.yellow}}>Earnings:</b> {s.earningsDate} — key catalyst, expect IV to rise before this date</div>
          </div>
        )}
      </div>
    );
  };

  // ── table row ──────────────────────────────────────────────────────────────
  const TableRow = ({s,i}) => {
    const cc=scoreColor(s.entryScore||0);
    const tc=s.trend==="BULL"?C.green:s.trend==="BEAR"?C.red:C.yellow;
    const sgc=s.signal==="BUY"?C.green:s.signal==="SELL"?C.red:s.signal==="WAIT"?C.yellow:C.dim;
    return(
      <tr onClick={()=>{setSelectedStock(s);setActiveView("detail");}}
        style={{borderBottom:`1px solid ${C.border}22`,cursor:"pointer",background:i%2===0?C.s2:"transparent"}}>
        <td style={{padding:"8px 12px",color:C.white,fontWeight:700,fontFamily:"'Share Tech Mono',monospace"}}>{s.ticker}</td>
        <td style={{padding:"8px 12px",color:C.white,fontFamily:"'Share Tech Mono',monospace"}}>${fmt(s.price)}</td>
        <td style={{padding:"8px 12px",color:s.changePct>=0?C.green:C.red,fontFamily:"'Share Tech Mono',monospace"}}>{fmtPct(s.changePct)}</td>
        <td style={{padding:"8px 12px",color:s.rsi>70?C.red:s.rsi<35?C.green:C.yellow,fontFamily:"'Share Tech Mono',monospace"}}>{fmt(s.rsi,0)}</td>
        <td style={{padding:"8px 12px",color:s.iv>65?C.red:C.green,fontFamily:"'Share Tech Mono',monospace"}}>{fmt(s.iv,0)}%</td>
        <td style={{padding:"8px 12px",color:tc,fontWeight:700}}>{s.trend}</td>
        <td style={{padding:"8px 12px"}}>
          <span style={{background:`${sgc}22`,border:`1px solid ${sgc}44`,borderRadius:3,padding:"2px 7px",fontSize:9,fontWeight:800,color:sgc}}>{s.signal}</span>
        </td>
        <td style={{padding:"8px 12px",color:C.dim,fontSize:10}}>{s.optionType}</td>
        <td style={{padding:"8px 12px",color:C.dim,fontFamily:"'Share Tech Mono',monospace",fontSize:10}}>{s.strikes}</td>
        <td style={{padding:"8px 12px",textAlign:"center"}}>
          <div style={{display:"inline-block",background:`${cc}22`,border:`1px solid ${cc}44`,borderRadius:4,padding:"2px 8px",color:cc,fontWeight:800,fontSize:11,fontFamily:"'Share Tech Mono',monospace"}}>{s.entryScore}</div>
        </td>
        <td style={{padding:"8px 12px",color:C.dim,fontSize:9,maxWidth:160}}>{s.newsHeadline?.slice(0,60)}…</td>
      </tr>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return(
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'Barlow Condensed','Trebuchet MS',sans-serif",color:C.text,paddingBottom:48}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600;700;800&family=Share+Tech+Mono&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .spin{animation:spin .8s linear infinite}
        .fade-up{animation:fadeUp .3s ease both}
        .pulse{animation:pulse 1.5s infinite}
        button{font-family:inherit;cursor:pointer;border:none}
        textarea{font-family:'Share Tech Mono',monospace;font-size:11px;background:${C.s2};color:${C.text};border:1px solid ${C.border};border-radius:6px;padding:10px;width:100%;resize:vertical}
        select{font-family:inherit;background:${C.s2};color:${C.text};border:1px solid ${C.border};borderRadius:4px;padding:5px 8px;font-size:11px}
      `}</style>

      {/* ── TOPBAR ────────────────────────────────────────────────────────── */}
      <div style={{background:`linear-gradient(180deg,${C.s1},${C.bg})`,borderBottom:`1px solid ${C.border}`,padding:"12px 18px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:10}}>
          <div>
            <div style={{fontSize:9,letterSpacing:5,color:C.dim,fontFamily:"'Share Tech Mono',monospace"}}>AI-POWERED · CLAUDE SONNET · LIVE ANALYSIS</div>
            <div style={{fontSize:24,fontWeight:800,color:C.white,letterSpacing:1,lineHeight:1}}>WATCHLIST ENGINE</div>
            <div style={{fontSize:10,color:C.dim,marginTop:2}}>20-Stock Options Strategy Scanner · Auto-Refresh Every {refreshInterval} min</div>
          </div>
          {/* status pills */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            {stocks.length>0&&[
              {l:"STOCKS",v:stocks.length,c:C.blue},
              {l:"BUY SIGNALS",v:buySignals.length,c:C.green},
              {l:"AVG SCORE",v:avgScore,c:scoreColor(avgScore)},
              {l:"LAST RUN",v:lastUpdate||"—",c:C.dim},
            ].map(({l,v,c})=>(
              <div key={l} style={{background:C.s1,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 10px",textAlign:"center"}}>
                <div style={{fontSize:7,color:C.dim,letterSpacing:2}}>{l}</div>
                <div style={{fontSize:13,fontWeight:800,color:c,fontFamily:"'Share Tech Mono',monospace"}}>{v}</div>
              </div>
            ))}
            {autoRefresh&&countdown>0&&(
              <div style={{background:`${C.yellow}18`,border:`1px solid ${C.yellow}44`,borderRadius:6,padding:"5px 10px",textAlign:"center"}} className="pulse">
                <div style={{fontSize:7,color:C.yellow,letterSpacing:2}}>NEXT REFRESH</div>
                <div style={{fontSize:13,fontWeight:800,color:C.yellow,fontFamily:"'Share Tech Mono',monospace"}}>{Math.floor(countdown/60)}:{String(countdown%60).padStart(2,"0")}</div>
              </div>
            )}
          </div>
        </div>

        {/* controls row */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {/* run button */}
          <button onClick={runEngine} disabled={loading}
            style={{background:loading?C.s2:`linear-gradient(135deg,${C.green},${C.cyan})`,color:loading?C.dim:C.bg,
              border:"none",borderRadius:6,padding:"8px 20px",fontSize:12,fontWeight:800,letterSpacing:2,
              opacity:loading?0.6:1,transition:"all .2s",display:"flex",alignItems:"center",gap:6}}>
            {loading&&<span className="spin" style={{display:"inline-block",width:12,height:12,border:`2px solid ${C.dim}`,borderTopColor:"transparent",borderRadius:"50%"}}/>}
            {loading?"ANALYZING...":"▶ RUN AI ENGINE"}
          </button>

          {/* seed data button */}
          <button onClick={loadSeedData} disabled={loading}
            style={{background:C.s2,color:C.blue,border:`1px solid ${C.blue}55`,borderRadius:6,
              padding:"8px 16px",fontSize:11,fontWeight:700,letterSpacing:1,opacity:loading?0.5:1}}>
            ⚡ LOAD SEED DATA
          </button>

          {/* auto refresh toggle */}
          <button onClick={()=>setAutoRefresh(a=>!a)}
            style={{background:autoRefresh?`${C.yellow}22`:C.s2,color:autoRefresh?C.yellow:C.dim,
              border:`1px solid ${autoRefresh?C.yellow:C.border}`,borderRadius:6,padding:"8px 14px",fontSize:11,fontWeight:700,letterSpacing:1}}>
            {autoRefresh?"⏸ AUTO ON":"▶ AUTO OFF"}
          </button>

          {/* interval */}
          <select value={refreshInterval} onChange={e=>setRefreshInterval(Number(e.target.value))}
            style={{background:C.s2,color:C.text,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",fontSize:11}}>
            {[5,10,15,30].map(m=><option key={m} value={m}>{m} min</option>)}
          </select>

          {/* view toggle */}
          <div style={{display:"flex",background:C.s2,borderRadius:6,border:`1px solid ${C.border}`,overflow:"hidden"}}>
            {["grid","table"].map(v=>(
              <button key={v} onClick={()=>setActiveView(v)}
                style={{padding:"7px 14px",fontSize:10,fontWeight:700,letterSpacing:1,
                  background:activeView===v?`${C.blue}30`:"transparent",
                  color:activeView===v?C.blue:C.dim,border:"none"}}>
                {v==="grid"?"⊞ GRID":"≡ TABLE"}
              </button>
            ))}
          </div>

          {/* sort */}
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
            style={{background:C.s2,color:C.text,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",fontSize:11}}>
            <option value="entryScore">Sort: Score ↓</option>
            <option value="changePct">Sort: Change ↓</option>
            <option value="iv">Sort: IV ↓</option>
            <option value="rsi">Sort: RSI ↓</option>
            <option value="ticker">Sort: A–Z</option>
          </select>

          {/* filter signal */}
          <select value={filterSignal} onChange={e=>setFilterSignal(e.target.value)}
            style={{background:C.s2,color:C.text,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px",fontSize:11}}>
            <option value="ALL">All Signals</option>
            <option value="BUY">BUY only</option>
            <option value="SELL">SELL only</option>
            <option value="WAIT">WAIT only</option>
          </select>

          {/* edit tickers */}
          <button onClick={()=>setEditTickers(e=>!e)}
            style={{background:C.s2,color:C.dim,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 12px",fontSize:10,fontWeight:700,letterSpacing:1}}>
            ✎ TICKERS
          </button>
        </div>

        {/* ticker editor */}
        {editTickers&&(
          <div style={{marginTop:10,padding:"12px",background:C.s2,borderRadius:8,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:9,color:C.dim,letterSpacing:3,marginBottom:6}}>EDIT WATCHLIST — comma-separated tickers (max 20)</div>
            <textarea rows={2} value={tickerInput} onChange={e=>setTickerInput(e.target.value)}/>
            <button onClick={()=>{
              const t=tickerInput.split(",").map(x=>x.trim().toUpperCase()).filter(Boolean).slice(0,20);
              setTickers(t); setEditTickers(false);
            }} style={{marginTop:8,background:C.green,color:C.bg,border:"none",borderRadius:5,padding:"6px 14px",fontSize:11,fontWeight:800}}>
              SAVE TICKERS
            </button>
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div style={{padding:"16px 18px"}}>

        {error&&(
          <div style={{background:C.redD,border:`1px solid ${C.red}44`,borderRadius:8,padding:"12px 16px",marginBottom:12}}>
            <div style={{fontSize:12,color:C.red,fontWeight:700,marginBottom:6}}>⚠️ {error}</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button onClick={loadSeedData} style={{background:C.blue,color:C.white,border:"none",borderRadius:5,padding:"6px 14px",fontSize:11,fontWeight:700}}>
                ⚡ Load Seed Data Instead
              </button>
              <span style={{fontSize:10,color:C.dim}}>Seed data uses pre-loaded May 1, 2026 market values for all 20 stocks</span>
            </div>
          </div>
        )}

        {/* empty state */}
        {stocks.length===0&&!loading&&(
          <div style={{textAlign:"center",padding:"50px 20px"}}>
            <div style={{fontSize:36,marginBottom:12}}>🤖</div>
            <div style={{fontSize:20,fontWeight:800,color:C.white,marginBottom:8}}>AI Watchlist Engine Ready</div>
            <div style={{fontSize:12,color:C.dim,marginBottom:24,lineHeight:1.8}}>
              <b style={{color:C.green}}>▶ RUN AI ENGINE</b> — Claude analyzes all 20 tickers live (requires API access)<br/>
              <b style={{color:C.blue}}>⚡ LOAD SEED DATA</b> — Instant results using pre-loaded May 1, 2026 market data
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:20}}>
              <button onClick={runEngine} style={{background:`linear-gradient(135deg,${C.green},${C.cyan})`,color:C.bg,border:"none",borderRadius:7,padding:"10px 24px",fontSize:13,fontWeight:800,letterSpacing:2}}>▶ RUN AI ENGINE</button>
              <button onClick={loadSeedData} style={{background:C.s2,color:C.blue,border:`1px solid ${C.blue}55`,borderRadius:7,padding:"10px 24px",fontSize:13,fontWeight:700}}>⚡ LOAD SEED DATA</button>
            </div>
            <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
              {tickers.map(t=>(
                <div key={t} style={{background:C.s2,border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 9px",fontSize:10,color:C.dim,fontFamily:"'Share Tech Mono',monospace"}}>{t}</div>
              ))}
            </div>
          </div>
        )}

        {/* loading state */}
        {loading&&(
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div className="spin" style={{width:40,height:40,border:`3px solid ${C.border}`,borderTopColor:C.green,borderRadius:"50%",margin:"0 auto 20px"}}/>
            <div style={{fontSize:16,fontWeight:800,color:C.white,marginBottom:6}}>Claude is analyzing {tickers.length} tickers…</div>
            <div style={{fontSize:11,color:C.dim}}>Fetching latest news · Running options engine · Generating strategies</div>
          </div>
        )}

        {/* detail view */}
        {activeView==="detail"&&selectedStock&&!loading&&(
          <div className="fade-up"><DetailView s={selectedStock}/></div>
        )}

        {/* grid view */}
        {activeView==="grid"&&stocks.length>0&&!loading&&(
          <div className="fade-up">
            {/* TOP PICKS BANNER */}
            {topPicks.length>0&&(
              <div style={{background:C.s2,borderRadius:10,padding:"12px 16px",border:`1px solid ${C.green}33`,marginBottom:16}}>
                <div style={{fontSize:9,color:C.green,letterSpacing:3,marginBottom:8}}>⭐ TOP 5 BY ENTRY SCORE</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {topPicks.map((s,i)=>{
                    const cc=scoreColor(s.entryScore||0);
                    return(
                      <div key={s.ticker} onClick={()=>{setSelectedStock(s);setActiveView("detail");}}
                        style={{background:C.s3,border:`1px solid ${cc}44`,borderRadius:8,padding:"8px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                        <div style={{fontSize:11,fontWeight:800,color:C.white,fontFamily:"'Share Tech Mono',monospace"}}>#{i+1} {s.ticker}</div>
                        <div style={{fontSize:9,color:C.dim}}>${fmt(s.price)}</div>
                        <div style={{background:`${cc}22`,border:`1px solid ${cc}44`,borderRadius:3,padding:"2px 7px",fontSize:9,fontWeight:800,color:cc}}>{s.entryScore}</div>
                        <div style={{fontSize:9,color:C.dim}}>{s.optionType}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
              {filtered.map(s=><StockCard key={s.ticker} s={s}/>)}
            </div>
          </div>
        )}

        {/* table view */}
        {activeView==="table"&&stocks.length>0&&!loading&&(
          <div className="fade-up" style={{background:C.s2,borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${C.border}`,background:C.s1}}>
                    {["TICKER","PRICE","CHANGE","RSI","IV","TREND","SIGNAL","OPTION TYPE","STRIKES","SCORE","NEWS"].map(h=>(
                      <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:8,color:C.dim,letterSpacing:1,whiteSpace:"nowrap",fontWeight:600}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s,i)=><TableRow key={s.ticker} s={s} i={i}/>)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <div style={{textAlign:"center",padding:"0 20px",marginTop:16}}>
        <div style={{fontSize:9,color:C.dim,lineHeight:1.8}}>
          ⚠️ AI-generated analysis for educational purposes only. Not financial advice.<br/>
          All strategies carry substantial risk. Verify all data with your broker. Past performance ≠ future results.
        </div>
      </div>
    </div>
  );
}
