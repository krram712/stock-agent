import { useState, useEffect, useRef, useCallback } from "react";
import { apiClient } from "../services/api";

// ─── Axiom palette ────────────────────────────────────────────────────────────
const C = {
  bg:"#06101a", s1:"#0a1628", s2:"rgba(255,255,255,0.018)", s3:"rgba(255,255,255,0.03)",
  border:"rgba(255,255,255,0.06)", bright:"rgba(255,255,255,0.09)",
  green:"#00ff88", greenD:"rgba(0,255,136,0.08)",
  red:"#ef4444",  redD:"rgba(239,68,68,0.08)",
  yellow:"#fbbf24",yellowD:"rgba(251,191,36,0.08)",
  blue:"#00d4ff", blueD:"rgba(0,212,255,0.08)",
  purple:"#a78bfa",purpleD:"rgba(167,139,250,0.08)",
  text:"#c8d6e0", dim:"#3d5a6e", dark:"#2a4050", white:"#e8f4ff",
  font:"'JetBrains Mono','Fira Code',monospace",
};

const DEFAULT_TICKERS = [
  "NVDA","AAPL","MSFT","AMZN","GOOGL",
  "META","TSLA","AMD","AVGO","TSM",
  "PLTR","ARM","SMCI","MU","MRVL",
  "SPY","QQQ","SOFI","COIN","NFLX",
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface OptionStrategy {
  type: string; legs: string; expiry: string;
  debit: string; maxProfit: string; breakeven: string;
  risk: string; color: string; icon: string; verdict: string;
}

interface StockData {
  ticker: string; price: number; change: number; changePct: number;
  rsi: number; iv: number;
  trend: "BULL"|"BEAR"|"SIDEWAYS"; signal: "BUY"|"SELL"|"WAIT"|"HOLD";
  ma20: number; support: number; resistance: number;
  sector: string; earningsDate: string;
  entryScore: number; riskLevel: "LOW"|"MEDIUM"|"HIGH";
  optionType: string; strikes: string; expiry: string;
  newsHeadline: string; weekStrategy: string; monthStrategy: string;
  catalysts: string[]; risks: string[];
  lastUpdated: string; strategy?: OptionStrategy;
}

// ─── Maths helpers ────────────────────────────────────────────────────────────
function normalCDF(x: number): number {
  const a=[0.254829592,-0.284496736,1.421413741,-1.453152027,1.061405429],p=0.3275911,s=x<0?-1:1;
  x=Math.abs(x); const t=1/(1+p*x);
  return 0.5*(1+s*(1-((((a[4]*t+a[3])*t+a[2])*t+a[1])*t+a[0])*t*Math.exp(-x*x)));
}
function bsCall(S:number,K:number,T:number,sig:number,r=0.045):number {
  if(T<=0) return Math.max(S-K,0);
  const d1=(Math.log(S/K)+(r+.5*sig*sig)*T)/(sig*Math.sqrt(T));
  return S*normalCDF(d1)-K*Math.exp(-r*T)*normalCDF(d1-sig*Math.sqrt(T));
}
function calcDelta(S:number,K:number,T:number,sig:number,r=0.045):number {
  if(T<=0) return S>K?1:0;
  return normalCDF((Math.log(S/K)+(r+.5*sig*sig)*T)/(sig*Math.sqrt(T)));
}
function fmt(n:number|null|undefined,d=2):string { return n==null?"—":Number(n).toFixed(d); }
function fmtPct(n:number|null):string { return n==null?"—":`${n>=0?"+":""}${fmt(n,2)}%`; }
function fmtD(n:number):string { return `$${fmt(n,2)}`; }
const nowStr=()=>new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
function scoreColor(s:number):string { return s>=75?C.green:s>=50?C.yellow:C.red; }

// ─── Option strategy builder ──────────────────────────────────────────────────
function buildStrategy(ticker:string,price:number,iv:number,rsi:number,trend:string,dte=30):OptionStrategy {
  const atm=Math.round(price/5)*5, otm2=atm+15, itm=atm-5, otm1=atm+5;
  if(trend==="BULL"&&rsi<65&&iv<65) return {
    type:"Bull Call Spread",legs:`Buy $${atm}C / Sell $${otm2}C`,expiry:`${dte}DTE`,
    debit:fmtD(bsCall(price,atm,dte/365,iv/100)-bsCall(price,otm2,dte/365,iv/100)),
    maxProfit:fmtD((otm2-atm-(bsCall(price,atm,dte/365,iv/100)-bsCall(price,otm2,dte/365,iv/100)))*100),
    breakeven:fmtD(atm+(bsCall(price,atm,dte/365,iv/100)-bsCall(price,otm2,dte/365,iv/100))),
    risk:"Defined",color:C.green,icon:"↗",verdict:"BUY SPREAD",
  };
  if(trend==="BULL"&&rsi>=65) return {
    type:"Wait for Pullback",legs:`Target: $${itm}C / $${atm}C spread`,expiry:`${dte}DTE`,
    debit:"—",maxProfit:"—",breakeven:"—",risk:"Not yet",color:C.yellow,icon:"⏸",verdict:"WAIT ENTRY",
  };
  if(trend==="BEAR"&&iv>50) return {
    type:"Bear Put Spread",legs:`Buy $${atm}P / Sell $${atm-15}P`,expiry:`${dte}DTE`,
    debit:fmtD(bsCall(price,atm,dte/365,iv/100)-bsCall(price,atm-15,dte/365,iv/100)),
    maxProfit:fmtD(15*100),breakeven:fmtD(atm-2),risk:"Defined",color:C.red,icon:"↘",verdict:"BUY PUT SPREAD",
  };
  if(trend==="SIDEWAYS") return {
    type:"Iron Condor",legs:`Sell $${atm-10}P/$${otm1}C, Buy $${atm-15}P/$${otm2}C`,expiry:`${dte}DTE`,
    debit:"Credit ~$2–3",maxProfit:"Premium collected",breakeven:"Range-based",
    risk:"Defined",color:C.purple,icon:"↔",verdict:"SELL CONDOR",
  };
  return { type:"Hold / Monitor",legs:"No clear setup",expiry:"—",debit:"—",maxProfit:"—",
    breakeven:"—",risk:"N/A",color:C.dim,icon:"○",verdict:"MONITOR" };
}

// ─── Seed data (May 1 2026) ───────────────────────────────────────────────────
const SEED: Record<string, Omit<StockData,"ticker"|"change"|"lastUpdated"|"strategy">> = {
  NVDA:{price:199.57,changePct:-4.63,rsi:71,iv:50,trend:"BULL",signal:"WAIT",ma20:181.44,support:195,resistance:216,sector:"Semiconductors",earningsDate:"May 20",entryScore:72,riskLevel:"MEDIUM",optionType:"Bull Call Spread",strikes:"$200/$215",expiry:"May 30",newsHeadline:"NVDA fell 4.6% despite hyperscaler AI capex surge; dip buyers watching $198–200 support zone.",weekStrategy:"Wait for $197–200 hold then enter $200/$215 bull call spread. Stop if breaks $194.",monthStrategy:"Accumulate before May 20 earnings. Target $220+ post-earnings on strong beat.",catalysts:["May 20 earnings","AI capex $1T+","Blackwell demand"],risks:["RSI overbought","Export restrictions","IV crush"]},
  AAPL:{price:271.35,changePct:0.44,rsi:58,iv:28,trend:"BULL",signal:"BUY",ma20:262,support:265,resistance:278,sector:"Technology",earningsDate:"May 1",entryScore:78,riskLevel:"LOW",optionType:"Bull Call Spread",strikes:"$270/$285",expiry:"Jun 20",newsHeadline:"Apple rose 0.4% as services revenue hit record $26B; AI iPhone upgrade cycle gaining momentum.",weekStrategy:"Hold above $265 support. Buy $270/$285 call spread on any dip to $266–268.",monthStrategy:"Services + India expansion = undervalued. Add on dips below $265 for June expiry spreads.",catalysts:["AI iPhone cycle","Services growth","India expansion"],risks:["China slowdown","Valuation","FX headwinds"]},
  MSFT:{price:421,changePct:-3.1,rsi:62,iv:32,trend:"BULL",signal:"WAIT",ma20:405,support:410,resistance:435,sector:"Technology",earningsDate:"Apr 30",entryScore:68,riskLevel:"LOW",optionType:"Bull Call Spread",strikes:"$420/$440",expiry:"Jun 20",newsHeadline:"Microsoft fell 3% post-earnings as Azure growth of 33% missed 35% estimate; AI Copilot adoption strong.",weekStrategy:"Watch $410 support. If holds, enter $420/$440 spread. Cut if breaks $408.",monthStrategy:"Azure re-acceleration expected in Q4. Buy dips for June spreads. Target $440.",catalysts:["Azure AI workloads","Copilot enterprise","GitHub momentum"],risks:["Azure miss","High valuation","AI competition"]},
  AMZN:{price:226,changePct:2.1,rsi:55,iv:35,trend:"BULL",signal:"BUY",ma20:210,support:218,resistance:238,sector:"E-Commerce/Cloud",earningsDate:"May 1",entryScore:82,riskLevel:"MEDIUM",optionType:"Bull Call Spread",strikes:"$225/$245",expiry:"Jun 20",newsHeadline:"Amazon surged 2% after AWS revenue beat at $32B; advertising and grocery showing strong momentum.",weekStrategy:"Strong entry zone here. Buy $225/$245 call spread. Stop at $218 break.",monthStrategy:"AWS acceleration + advertising = $240+ by June. Scale in over two weeks.",catalysts:["AWS beat","Ad revenue","Prime membership"],risks:["Capex guidance","Regulation","AWS competition"]},
  GOOGL:{price:382,changePct:9.97,rsi:72,iv:38,trend:"BULL",signal:"WAIT",ma20:352,support:368,resistance:395,sector:"Technology",earningsDate:"Apr 29",entryScore:65,riskLevel:"MEDIUM",optionType:"Bull Call Spread",strikes:"$380/$400",expiry:"Jun 20",newsHeadline:"Alphabet surged 10% on Q1 beat; Search ad revenue +12% and Google Cloud grew 28% YoY.",weekStrategy:"RSI extended after 10% pop. Wait for $370–375 dip, then enter $380/$400 spread.",monthStrategy:"Search + Cloud momentum real. Target $395–400 June. Enter only on pullbacks.",catalysts:["Search AI","Cloud 28% growth","YouTube ads"],risks:["RSI overbought","AI competition","Regulation"]},
  META:{price:611,changePct:-8.55,rsi:48,iv:45,trend:"SIDEWAYS",signal:"WAIT",ma20:580,support:590,resistance:640,sector:"Technology",earningsDate:"Apr 30",entryScore:55,riskLevel:"MEDIUM",optionType:"Iron Condor",strikes:"$580P/$640C",expiry:"May 30",newsHeadline:"Meta dropped 8.5% on capex guidance raise to $72B; core ad business strong but investors spooked.",weekStrategy:"Watch $590 support. Iron condor $580/$640 if it stabilizes. Avoid directional bets now.",monthStrategy:"Ad business strong, capex fear overdone. Re-enter bull spread if stabilizes $590–600.",catalysts:["Ad revenue growth","Llama AI","AR/VR progress"],risks:["$72B capex","Regulation","Valuation"]},
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

function generateFallback(ticker: string): StockData {
  const seed = SEED[ticker];
  if (seed) return { ...seed, ticker, change: parseFloat((seed.price * seed.changePct / 100).toFixed(2)), lastUpdated: nowStr() };
  const price = 100 + Math.random() * 200;
  return {
    ticker, price: parseFloat(price.toFixed(2)),
    change: parseFloat(((Math.random()-.5)*8).toFixed(2)),
    changePct: parseFloat(((Math.random()-.5)*4).toFixed(2)),
    rsi: Math.round(40+Math.random()*30), iv: Math.round(30+Math.random()*30),
    trend: (["BULL","SIDEWAYS","BEAR"] as const)[Math.floor(Math.random()*3)],
    signal: (["BUY","WAIT","HOLD"] as const)[Math.floor(Math.random()*3)],
    ma20: parseFloat((price*.95).toFixed(2)), support: parseFloat((price*.92).toFixed(2)),
    resistance: parseFloat((price*1.08).toFixed(2)), sector:"Unknown", earningsDate:"TBD",
    entryScore: Math.round(40+Math.random()*40), riskLevel:"MEDIUM",
    optionType:"Bull Call Spread", strikes:`$${Math.round(price)}/$${Math.round(price*1.08)}`,
    expiry:"Jun 20", newsHeadline:`${ticker} — no recent news available.`,
    weekStrategy:"Insufficient data. Monitor price action before entering.",
    monthStrategy:"Insufficient data. Wait for clearer setup.",
    catalysts:["Earnings upcoming"], risks:["Data unavailable"], lastUpdated: nowStr(),
  };
}

// Fetch real quote + technicals from the backend for a batch of tickers
async function fetchRealData(tickers: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {};
  await Promise.allSettled(
    tickers.map(async ticker => {
      try {
        const [quoteRes, techRes] = await Promise.allSettled([
          apiClient.get(`/api/v1/stocks/${ticker}/quote`),
          apiClient.get(`/api/v1/stocks/${ticker}/technicals`),
        ]);
        const quote = quoteRes.status === "fulfilled" ? quoteRes.value.data : {};
        const tech  = techRes.status  === "fulfilled" ? techRes.value.data  : {};
        results[ticker] = { ...quote, ...tech };
      } catch { results[ticker] = {}; }
    })
  );
  return results;
}

async function callClaudeAPI(tickerBatch: string[], realData: Record<string, any>): Promise<StockData[]> {
  const res = await fetch("/watchlist-analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers: tickerBatch, realData }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function analyzeTickersWithClaude(tickers: string[]): Promise<StockData[]> {
  const results: StockData[] = [];
  for (const batch of [tickers.slice(0,10), tickers.slice(10,20)]) {
    if (!batch.length) continue;
    try {
      const realData = await fetchRealData(batch);
      results.push(...await callClaudeAPI(batch, realData));
    } catch (e: any) {
      batch.forEach(t => results.push(generateFallback(t)));
    }
  }
  const returned = new Set(results.map(r => r.ticker));
  tickers.forEach(t => { if (!returned.has(t)) results.push(generateFallback(t)); });
  return results.map(s => ({ ...s, lastUpdated: nowStr() }));
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function WatchlistEngine() {
  const [tickers, setTickers]       = useState<string[]>(DEFAULT_TICKERS);
  const [stocks, setStocks]         = useState<StockData[]>([]);
  const [loading, setLoading]       = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string|null>(null);
  const [error, setError]           = useState<string|null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [selectedStock, setSelectedStock] = useState<StockData|null>(null);
  const [activeView, setActiveView] = useState<"grid"|"table"|"detail">("grid");
  const [filterSignal, setFilterSignal] = useState("ALL");
  const [sortBy, setSortBy]         = useState("entryScore");
  const [countdown, setCountdown]   = useState(0);
  const [editTickers, setEditTickers] = useState(false);
  const [tickerInput, setTickerInput] = useState(DEFAULT_TICKERS.join(", "));
  const intervalRef  = useRef<ReturnType<typeof setInterval>|null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const runEngine = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await analyzeTickersWithClaude(tickers);
      setStocks(result.map(s => ({ ...s, strategy: buildStrategy(s.ticker,s.price,s.iv,s.rsi,s.trend), lastUpdated: nowStr() })));
      setLastUpdate(nowStr());
    } catch(e:any) {
      setError(`${e.message}. Use ⚡ Seed Data for instant results.`);
    } finally { setLoading(false); }
  }, [tickers]);

  const loadSeedData = useCallback(() => {
    setStocks(tickers.map(t => { const s=generateFallback(t); return { ...s, strategy: buildStrategy(t,s.price,s.iv,s.rsi,s.trend) }; }));
    setLastUpdate(nowStr()); setError(null);
  }, [tickers]);

  useEffect(() => {
    if (autoRefresh) {
      setCountdown(refreshInterval*60);
      intervalRef.current  = setInterval(() => { runEngine(); setCountdown(refreshInterval*60); }, refreshInterval*60*1000);
      countdownRef.current = setInterval(() => setCountdown(c => c>0?c-1:0), 1000);
    } else {
      if (intervalRef.current)  clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(0);
    }
    return () => { if(intervalRef.current) clearInterval(intervalRef.current); if(countdownRef.current) clearInterval(countdownRef.current); };
  }, [autoRefresh, refreshInterval, runEngine]);

  const filtered = stocks
    .filter(s => filterSignal==="ALL" || s.signal===filterSignal)
    .sort((a,b) => {
      if(sortBy==="entryScore") return (b.entryScore||0)-(a.entryScore||0);
      if(sortBy==="changePct")  return (b.changePct||0)-(a.changePct||0);
      if(sortBy==="iv")         return (b.iv||0)-(a.iv||0);
      if(sortBy==="rsi")        return (b.rsi||0)-(a.rsi||0);
      return a.ticker.localeCompare(b.ticker);
    });

  const topPicks   = [...stocks].sort((a,b)=>(b.entryScore||0)-(a.entryScore||0)).slice(0,5);
  const buySignals = stocks.filter(s=>s.signal==="BUY");
  const avgScore   = stocks.length ? Math.round(stocks.reduce((a,b)=>a+(b.entryScore||0),0)/stocks.length) : 0;

  // ── Stock card ──────────────────────────────────────────────────────────────
  const StockCard = ({ s }: { s: StockData }) => {
    const sc  = s.entryScore||0;
    const cc  = scoreColor(sc);
    const tc  = s.trend==="BULL"?C.green:s.trend==="BEAR"?C.red:C.yellow;
    const sgc = s.signal==="BUY"?C.green:s.signal==="SELL"?C.red:s.signal==="WAIT"?C.yellow:C.dim;
    return (
      <div onClick={()=>{ setSelectedStock(s); setActiveView("detail"); }}
        style={{ background:C.s2, border:`1px solid ${sc>=75?cc+"44":C.border}`, borderRadius:10,
          padding:"12px 14px", cursor:"pointer", transition:"all .2s",
          boxShadow:sc>=75?`0 0 16px ${cc}18`:"none" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:C.white, fontFamily:C.font }}>{s.ticker}</div>
            <div style={{ fontSize:9, color:C.dark, marginTop:1 }}>{s.sector}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.white, fontFamily:C.font }}>${fmt(s.price)}</div>
            <div style={{ fontSize:10, color:s.changePct>=0?C.green:C.red }}>{fmtPct(s.changePct)}</div>
          </div>
        </div>
        <div style={{ marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
            <span style={{ fontSize:8, color:C.dim, letterSpacing:2 }}>ENTRY SCORE</span>
            <span style={{ fontSize:11, fontWeight:800, color:cc, fontFamily:C.font }}>{sc}</span>
          </div>
          <div style={{ background:C.border, borderRadius:3, height:3 }}>
            <div style={{ background:`linear-gradient(90deg,${C.blue},${cc})`, width:`${sc}%`, height:"100%", borderRadius:3, transition:"width .5s" }}/>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, marginBottom:8 }}>
          {[
            { l:"RSI",  v:fmt(s.rsi,0),      c:s.rsi>70?C.red:s.rsi<35?C.green:C.yellow },
            { l:"IV",   v:`${fmt(s.iv,0)}%`, c:s.iv>65?C.red:C.green },
            { l:"TREND",v:s.trend,            c:tc },
          ].map(({ l,v,c }) => (
            <div key={l} style={{ background:C.s3, borderRadius:4, padding:"4px 6px", textAlign:"center" }}>
              <div style={{ fontSize:7, color:C.dim, letterSpacing:1 }}>{l}</div>
              <div style={{ fontSize:10, fontWeight:700, color:c, fontFamily:C.font }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ background:`${sgc}22`, border:`1px solid ${sgc}44`, borderRadius:4, padding:"3px 8px", fontSize:9, fontWeight:800, color:sgc, letterSpacing:2 }}>{s.signal}</div>
          <div style={{ fontSize:9, color:C.dim, maxWidth:120, textAlign:"right", lineHeight:1.3 }}>{s.optionType} · {s.strikes}</div>
        </div>
        {s.newsHeadline && (
          <div style={{ marginTop:8, fontSize:9, color:C.dim, lineHeight:1.4, borderTop:`1px solid ${C.border}`, paddingTop:6,
            display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as any, overflow:"hidden" }}>
            📰 {s.newsHeadline}
          </div>
        )}
      </div>
    );
  };

  // ── Detail view ─────────────────────────────────────────────────────────────
  const DetailView = ({ s }: { s: StockData }) => {
    const cc = scoreColor(s.entryScore||0);
    const tc = s.trend==="BULL"?C.green:s.trend==="BEAR"?C.red:C.yellow;
    const T=(30/365), sig=(s.iv||50)/100;
    const atm=Math.round((s.price||100)/5)*5, otm=atm+15;
    const netDebit=Math.max(bsCall(s.price,atm,T,sig)-bsCall(s.price,otm,T,sig),0.01);
    const spreadDelta=calcDelta(s.price,atm,T,sig)-calcDelta(s.price,otm,T,sig);
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <button onClick={()=>{ setSelectedStock(null); setActiveView("grid"); }}
            style={{ background:C.s2, border:`1px solid ${C.border}`, borderRadius:6, padding:"6px 12px", color:C.dim, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:C.font }}>← BACK</button>
          <div>
            <span style={{ fontSize:20, fontWeight:800, color:C.white, fontFamily:C.font }}>{s.ticker}</span>
            <span style={{ fontSize:12, color:C.dim, marginLeft:10 }}>{s.sector}</span>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
            <div style={{ background:`${cc}22`, border:`1px solid ${cc}44`, borderRadius:6, padding:"6px 12px", textAlign:"center" }}>
              <div style={{ fontSize:8, color:C.dim }}>SCORE</div>
              <div style={{ fontSize:18, fontWeight:800, color:cc }}>{s.entryScore}</div>
            </div>
            <div style={{ background:`${tc}22`, border:`1px solid ${tc}44`, borderRadius:6, padding:"6px 12px", textAlign:"center" }}>
              <div style={{ fontSize:8, color:C.dim }}>TREND</div>
              <div style={{ fontSize:13, fontWeight:800, color:tc }}>{s.trend}</div>
            </div>
          </div>
        </div>

        <div style={{ background:C.s2, borderRadius:10, padding:"14px 18px", border:`1px solid ${C.border}`, display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
          {[
            { l:"PRICE",    v:`$${fmt(s.price)}`,        c:C.white },
            { l:"CHANGE",   v:fmtPct(s.changePct),        c:s.changePct>=0?C.green:C.red },
            { l:"RSI(14)",  v:fmt(s.rsi,0),               c:s.rsi>70?C.red:s.rsi<35?C.green:C.yellow },
            { l:"IV",       v:`${fmt(s.iv,0)}%`,          c:s.iv>65?C.red:C.green },
            { l:"20-DAY MA",v:`$${fmt(s.ma20)}`,          c:s.price>s.ma20?C.green:C.red },
          ].map(({ l,v,c }) => (
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:8, color:C.dim, letterSpacing:2 }}>{l}</div>
              <div style={{ fontSize:15, fontWeight:800, color:c, fontFamily:C.font }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ background:C.s2, borderRadius:10, padding:"12px 16px", border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:9, color:C.dim, letterSpacing:3, marginBottom:6 }}>LATEST NEWS</div>
          <div style={{ fontSize:12, color:C.text, lineHeight:1.6 }}>📰 {s.newsHeadline||"No news available"}</div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div style={{ background:C.s2, borderRadius:10, padding:"14px 16px", border:`1px solid ${C.yellow}44`, borderLeft:`3px solid ${C.yellow}` }}>
            <div style={{ fontSize:9, color:C.yellow, letterSpacing:3, marginBottom:8 }}>1-WEEK STRATEGY</div>
            <div style={{ fontSize:12, color:C.text, lineHeight:1.6 }}>{s.weekStrategy||"—"}</div>
          </div>
          <div style={{ background:C.s2, borderRadius:10, padding:"14px 16px", border:`1px solid ${C.green}44`, borderLeft:`3px solid ${C.green}` }}>
            <div style={{ fontSize:9, color:C.green, letterSpacing:3, marginBottom:8 }}>1-MONTH STRATEGY</div>
            <div style={{ fontSize:12, color:C.text, lineHeight:1.6 }}>{s.monthStrategy||"—"}</div>
          </div>
        </div>

        <div style={{ background:C.s2, borderRadius:10, padding:"14px 18px", border:`1px solid ${C.blue}44` }}>
          <div style={{ fontSize:9, color:C.blue, letterSpacing:3, marginBottom:10 }}>RECOMMENDED OPTION STRATEGY</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:10 }}>
            {[
              { l:"STRATEGY",     v:s.optionType||"—",            c:C.blue },
              { l:"STRIKES",      v:s.strikes||"—",               c:C.white },
              { l:"EXPIRY",       v:s.expiry||"30DTE",            c:C.dim },
              { l:"EST DEBIT",    v:fmtD(netDebit),               c:C.yellow },
              { l:"SPREAD DELTA", v:fmt(spreadDelta,3),           c:C.purple },
              { l:"RISK LEVEL",   v:s.riskLevel||"MED",           c:s.riskLevel==="HIGH"?C.red:s.riskLevel==="LOW"?C.green:C.yellow },
            ].map(({ l,v,c }) => (
              <div key={l} style={{ background:C.s3, borderRadius:6, padding:"8px 10px" }}>
                <div style={{ fontSize:8, color:C.dim, letterSpacing:2, marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:13, fontWeight:700, color:c, fontFamily:C.font }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <div style={{ background:C.s3, borderRadius:6, padding:"10px 12px" }}>
              <div style={{ fontSize:8, color:C.green, letterSpacing:2, marginBottom:6 }}>ENTRY RULES</div>
              {[
                `Price ${s.price>s.ma20?"above":"near"} 20-day MA ($${fmt(s.ma20)})`,
                `RSI ${s.rsi>70?"cooling from overbought — wait":s.rsi<40?"oversold bounce — enter":"neutral — OK to enter"}`,
                `Support: $${fmt(s.support)} — hold above this`,
                `IV ${s.iv>65?"HIGH — wait for IV to cool":"fair — OK to buy spreads"}`,
              ].map((r,i) => (
                <div key={i} style={{ fontSize:10, color:C.text, marginBottom:4, display:"flex", gap:6 }}>
                  <span style={{ color:C.green }}>›</span>{r}
                </div>
              ))}
            </div>
            <div style={{ background:C.s3, borderRadius:6, padding:"10px 12px" }}>
              <div style={{ fontSize:8, color:C.red, letterSpacing:2, marginBottom:6 }}>EXIT RULES</div>
              {[
                "Take profit at +50% of spread value",
                "Stop loss at -30% of debit paid",
                "Close 3 days before expiry (time stop)",
                `Price breaks $${fmt(s.support)} → close immediately`,
              ].map((r,i) => (
                <div key={i} style={{ fontSize:10, color:C.text, marginBottom:4, display:"flex", gap:6 }}>
                  <span style={{ color:C.red }}>›</span>{r}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div style={{ background:C.s2, borderRadius:10, padding:"12px 16px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:9, color:C.green, letterSpacing:3, marginBottom:8 }}>CATALYSTS</div>
            {(s.catalysts||[]).map((c,i) => (
              <div key={i} style={{ fontSize:11, color:C.text, marginBottom:5, display:"flex", gap:6 }}><span style={{ color:C.green }}>✓</span>{c}</div>
            ))}
          </div>
          <div style={{ background:C.s2, borderRadius:10, padding:"12px 16px", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:9, color:C.red, letterSpacing:3, marginBottom:8 }}>RISKS</div>
            {(s.risks||[]).map((r,i) => (
              <div key={i} style={{ fontSize:11, color:C.text, marginBottom:5, display:"flex", gap:6 }}><span style={{ color:C.red }}>✗</span>{r}</div>
            ))}
          </div>
        </div>

        {s.earningsDate && s.earningsDate !== "N/A" && (
          <div style={{ background:`${C.yellow}12`, border:`1px solid ${C.yellow}44`, borderRadius:8, padding:"10px 16px", display:"flex", gap:10, alignItems:"center" }}>
            <span style={{ fontSize:16 }}>📅</span>
            <div style={{ fontSize:12, color:C.text }}><b style={{ color:C.yellow }}>Earnings:</b> {s.earningsDate} — expect IV to rise before this date</div>
          </div>
        )}
      </div>
    );
  };

  // ── Table row ───────────────────────────────────────────────────────────────
  const TableRow = ({ s, i }: { s: StockData; i: number }) => {
    const cc  = scoreColor(s.entryScore||0);
    const tc  = s.trend==="BULL"?C.green:s.trend==="BEAR"?C.red:C.yellow;
    const sgc = s.signal==="BUY"?C.green:s.signal==="SELL"?C.red:s.signal==="WAIT"?C.yellow:C.dim;
    return (
      <tr onClick={()=>{ setSelectedStock(s); setActiveView("detail"); }}
        style={{ borderBottom:`1px solid ${C.border}`, cursor:"pointer", background:i%2===0?C.s2:"transparent" }}>
        <td style={{ padding:"8px 12px", color:C.white, fontWeight:700, fontFamily:C.font }}>{s.ticker}</td>
        <td style={{ padding:"8px 12px", color:C.white, fontFamily:C.font }}>${fmt(s.price)}</td>
        <td style={{ padding:"8px 12px", color:s.changePct>=0?C.green:C.red, fontFamily:C.font }}>{fmtPct(s.changePct)}</td>
        <td style={{ padding:"8px 12px", color:s.rsi>70?C.red:s.rsi<35?C.green:C.yellow, fontFamily:C.font }}>{fmt(s.rsi,0)}</td>
        <td style={{ padding:"8px 12px", color:s.iv>65?C.red:C.green, fontFamily:C.font }}>{fmt(s.iv,0)}%</td>
        <td style={{ padding:"8px 12px", color:tc, fontWeight:700 }}>{s.trend}</td>
        <td style={{ padding:"8px 12px" }}>
          <span style={{ background:`${sgc}22`, border:`1px solid ${sgc}44`, borderRadius:3, padding:"2px 7px", fontSize:9, fontWeight:800, color:sgc }}>{s.signal}</span>
        </td>
        <td style={{ padding:"8px 12px", color:C.dim, fontSize:10 }}>{s.optionType}</td>
        <td style={{ padding:"8px 12px", color:C.dim, fontFamily:C.font, fontSize:10 }}>{s.strikes}</td>
        <td style={{ padding:"8px 12px", textAlign:"center" }}>
          <span style={{ background:`${cc}22`, border:`1px solid ${cc}44`, borderRadius:4, padding:"2px 8px", color:cc, fontWeight:800, fontSize:11, fontFamily:C.font }}>{s.entryScore}</span>
        </td>
        <td style={{ padding:"8px 12px", color:C.dim, fontSize:9, maxWidth:160 }}>{s.newsHeadline?.slice(0,60)}…</td>
      </tr>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:C.font }}>
      {/* Controls */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:12, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>
        <button onClick={runEngine} disabled={loading}
          style={{ background:loading?C.s2:`linear-gradient(135deg,${C.green},${C.blue})`, color:loading?C.dim:"#06101a",
            border:"none", borderRadius:6, padding:"8px 18px", fontSize:11, fontWeight:800, letterSpacing:2,
            opacity:loading?0.6:1, cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:6 }}>
          {loading && <span style={{ width:10, height:10, border:`2px solid ${C.dim}`, borderTopColor:"transparent", borderRadius:"50%", display:"inline-block", animation:"spin .8s linear infinite" }}/>}
          {loading?"ANALYZING...":"▶ RUN AI ENGINE"}
        </button>

        <button onClick={loadSeedData} disabled={loading}
          style={{ background:C.s2, color:C.blue, border:`1px solid ${C.blue}44`, borderRadius:6, padding:"8px 14px", fontSize:11, fontWeight:700, cursor:"pointer", opacity:loading?0.5:1 }}>
          ⚡ SEED DATA
        </button>

        <button onClick={()=>setAutoRefresh(a=>!a)}
          style={{ background:autoRefresh?`${C.yellow}18`:C.s2, color:autoRefresh?C.yellow:C.dim,
            border:`1px solid ${autoRefresh?C.yellow:C.border}`, borderRadius:6, padding:"8px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
          {autoRefresh?"⏸ AUTO ON":"▶ AUTO OFF"}
        </button>

        <select value={refreshInterval} onChange={e=>setRefreshInterval(Number(e.target.value))}
          style={{ background:C.s2, color:C.text, border:`1px solid ${C.border}`, borderRadius:5, padding:"7px 10px", fontSize:11, fontFamily:C.font }}>
          {[5,10,15,30].map(m=><option key={m} value={m}>{m} min</option>)}
        </select>

        <div style={{ display:"flex", background:C.s2, borderRadius:6, border:`1px solid ${C.border}`, overflow:"hidden" }}>
          {(["grid","table"] as const).map(v=>(
            <button key={v} onClick={()=>setActiveView(v)}
              style={{ padding:"7px 12px", fontSize:10, fontWeight:700, letterSpacing:1, cursor:"pointer",
                background:activeView===v?`${C.blue}22`:"transparent", color:activeView===v?C.blue:C.dim, border:"none" }}>
              {v==="grid"?"⊞ GRID":"≡ TABLE"}
            </button>
          ))}
        </div>

        <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
          style={{ background:C.s2, color:C.text, border:`1px solid ${C.border}`, borderRadius:5, padding:"7px 10px", fontSize:11, fontFamily:C.font }}>
          <option value="entryScore">Sort: Score ↓</option>
          <option value="changePct">Sort: Change ↓</option>
          <option value="iv">Sort: IV ↓</option>
          <option value="rsi">Sort: RSI ↓</option>
          <option value="ticker">Sort: A–Z</option>
        </select>

        <select value={filterSignal} onChange={e=>setFilterSignal(e.target.value)}
          style={{ background:C.s2, color:C.text, border:`1px solid ${C.border}`, borderRadius:5, padding:"7px 10px", fontSize:11, fontFamily:C.font }}>
          <option value="ALL">All Signals</option>
          <option value="BUY">BUY only</option>
          <option value="WAIT">WAIT only</option>
          <option value="HOLD">HOLD only</option>
        </select>

        <button onClick={()=>setEditTickers(e=>!e)}
          style={{ background:C.s2, color:C.dim, border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 10px", fontSize:10, fontWeight:700, cursor:"pointer" }}>
          ✎ TICKERS
        </button>

        {stocks.length>0 && (
          <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
            {[
              { l:"STOCKS",      v:stocks.length,      c:C.blue },
              { l:"BUY SIGNALS", v:buySignals.length,  c:C.green },
              { l:"AVG SCORE",   v:avgScore,            c:scoreColor(avgScore) },
            ].map(({ l,v,c })=>(
              <div key={l} style={{ background:C.s2, border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 10px", textAlign:"center" }}>
                <div style={{ fontSize:7, color:C.dim, letterSpacing:2 }}>{l}</div>
                <div style={{ fontSize:12, fontWeight:800, color:c, fontFamily:C.font }}>{v}</div>
              </div>
            ))}
            {autoRefresh&&countdown>0&&(
              <div style={{ background:`${C.yellow}12`, border:`1px solid ${C.yellow}44`, borderRadius:6, padding:"4px 10px", textAlign:"center" }}>
                <div style={{ fontSize:7, color:C.yellow, letterSpacing:2 }}>NEXT</div>
                <div style={{ fontSize:12, fontWeight:800, color:C.yellow, fontFamily:C.font }}>{Math.floor(countdown/60)}:{String(countdown%60).padStart(2,"0")}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ticker editor */}
      {editTickers && (
        <div style={{ background:C.s2, borderRadius:8, border:`1px solid ${C.border}`, padding:"12px 14px", marginBottom:12 }}>
          <div style={{ fontSize:9, color:C.dim, letterSpacing:3, marginBottom:6 }}>EDIT WATCHLIST — comma-separated (max 20)</div>
          <textarea rows={2} value={tickerInput} onChange={e=>setTickerInput(e.target.value)}
            style={{ width:"100%", background:"rgba(0,0,0,0.3)", color:C.text, border:`1px solid ${C.border}`, borderRadius:6, padding:8, fontSize:11, fontFamily:C.font, resize:"vertical" }}/>
          <button onClick={()=>{ setTickers(tickerInput.split(",").map(x=>x.trim().toUpperCase()).filter(Boolean).slice(0,20)); setEditTickers(false); }}
            style={{ marginTop:8, background:C.green, color:"#06101a", border:"none", borderRadius:5, padding:"6px 14px", fontSize:11, fontWeight:800, cursor:"pointer" }}>
            SAVE TICKERS
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background:C.redD, border:`1px solid ${C.red}44`, borderRadius:8, padding:"12px 16px", marginBottom:12 }}>
          <div style={{ fontSize:12, color:C.red, fontWeight:700, marginBottom:6 }}>⚠️ {error}</div>
          <button onClick={loadSeedData} style={{ background:C.blue, color:"#06101a", border:"none", borderRadius:5, padding:"6px 14px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            ⚡ Load Seed Data Instead
          </button>
        </div>
      )}

      {/* Empty state */}
      {stocks.length===0 && !loading && (
        <div style={{ textAlign:"center", padding:"40px 20px" }}>
          <div style={{ fontSize:28, marginBottom:12, opacity:0.2 }}>📊</div>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:8 }}>AI Watchlist Engine Ready</div>
          <div style={{ fontSize:11, color:C.dim, marginBottom:20, lineHeight:1.8 }}>
            <b style={{ color:C.green }}>▶ RUN AI ENGINE</b> — Claude analyzes all {tickers.length} tickers live<br/>
            <b style={{ color:C.blue }}>⚡ SEED DATA</b> — Instant results with pre-loaded May 2026 data
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <button onClick={runEngine} style={{ background:`linear-gradient(135deg,${C.green},${C.blue})`, color:"#06101a", border:"none", borderRadius:7, padding:"10px 22px", fontSize:12, fontWeight:800, letterSpacing:2, cursor:"pointer" }}>▶ RUN AI ENGINE</button>
            <button onClick={loadSeedData} style={{ background:C.s2, color:C.blue, border:`1px solid ${C.blue}44`, borderRadius:7, padding:"10px 22px", fontSize:12, fontWeight:700, cursor:"pointer" }}>⚡ SEED DATA</button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign:"center", padding:"50px 20px" }}>
          <div style={{ width:36, height:36, border:`3px solid ${C.border}`, borderTopColor:C.green, borderRadius:"50%", margin:"0 auto 16px", animation:"spin .8s linear infinite" }}/>
          <div style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:6 }}>Claude is analyzing {tickers.length} tickers…</div>
          <div style={{ fontSize:11, color:C.dim }}>Batching into 2×10 · running options engine · generating strategies</div>
        </div>
      )}

      {/* Detail view */}
      {activeView==="detail" && selectedStock && !loading && <DetailView s={selectedStock}/>}

      {/* Grid view */}
      {activeView==="grid" && stocks.length>0 && !loading && (
        <div>
          {topPicks.length>0 && (
            <div style={{ background:C.s2, borderRadius:10, padding:"12px 16px", border:`1px solid ${C.green}22`, marginBottom:14 }}>
              <div style={{ fontSize:9, color:C.green, letterSpacing:3, marginBottom:8 }}>⭐ TOP 5 BY ENTRY SCORE</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {topPicks.map((s,i)=>{
                  const cc=scoreColor(s.entryScore||0);
                  return (
                    <div key={s.ticker} onClick={()=>{ setSelectedStock(s); setActiveView("detail"); }}
                      style={{ background:C.s3, border:`1px solid ${cc}44`, borderRadius:8, padding:"7px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:11, fontWeight:800, color:C.white, fontFamily:C.font }}>#{i+1} {s.ticker}</span>
                      <span style={{ fontSize:9, color:C.dim }}>${fmt(s.price)}</span>
                      <span style={{ background:`${cc}22`, border:`1px solid ${cc}44`, borderRadius:3, padding:"2px 6px", fontSize:9, fontWeight:800, color:cc }}>{s.entryScore}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:10 }}>
            {filtered.map(s=><StockCard key={s.ticker} s={s}/>)}
          </div>
        </div>
      )}

      {/* Table view */}
      {activeView==="table" && stocks.length>0 && !loading && (
        <div style={{ background:C.s2, borderRadius:10, border:`1px solid ${C.border}`, overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${C.border}`, background:C.s1 }}>
                  {["TICKER","PRICE","CHANGE","RSI","IV","TREND","SIGNAL","OPTION TYPE","STRIKES","SCORE","NEWS"].map(h=>(
                    <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:8, color:C.dim, letterSpacing:1, whiteSpace:"nowrap", fontWeight:600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{filtered.map((s,i)=><TableRow key={s.ticker} s={s} i={i}/>)}</tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}