import io, base64, warnings, math, time
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
import pandas as pd
import requests
import yfinance as yf
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

warnings.filterwarnings('ignore')

# Yahoo Finance blocks datacenter IPs without a browser User-Agent
_SESSION = requests.Session()
_SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
})

BG='#0d1117'; PANEL='#161b22'; BORDER='#30363d'; MUTED='#8b949e'
BLUE='#58a6ff'; GREEN='#3fb950'; RED='#ff7b72'; YELLOW='#f0c040'
PURPLE='#d2a8ff'; CYAN='#39d353'; ORANGE='#ffa657'


def _clean(v):
    if isinstance(v, dict): return {k: _clean(x) for k, x in v.items()}
    if isinstance(v, list): return [_clean(x) for x in v]
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)): return None
    if isinstance(v, (np.floating, np.integer)):
        f = float(v)
        return None if (math.isnan(f) or math.isinf(f)) else f
    return v


# ── Indicator helpers ─────────────────────────────────────────────────────────

def _rsi(c, p=14):
    d=c.diff(); g=d.where(d>0,0).rolling(p).mean()
    l=(-d.where(d<0,0)).rolling(p).mean()
    return 100 - 100/(1+g/l)

def _macd(c, f=12, s=26, sig=9):
    m=c.ewm(span=f,adjust=False).mean()-c.ewm(span=s,adjust=False).mean()
    sl=m.ewm(span=sig,adjust=False).mean()
    return m, sl, m-sl

def _bb(c, p=20, std=2):
    sma=c.rolling(p).mean(); sd=c.rolling(p).std()
    return sma, sma+std*sd, sma-std*sd

def _stoch(h, l, c, k=14, d=3):
    ll=l.rolling(k).min(); hh=h.rolling(k).max()
    kl=100*(c-ll)/(hh-ll+1e-10)
    return kl, kl.rolling(d).mean()

def _vwap(h, l, c, v):
    tp=(h+l+c)/3
    return (tp*v).cumsum()/(v.cumsum()+1e-10)

def _obv(c, v):
    return (np.sign(c.diff()).fillna(0)*v).cumsum()

def _atr(h, l, c, p=14):
    tr=pd.concat([h-l,(h-c.shift()).abs(),(l-c.shift()).abs()],axis=1).max(axis=1)
    return tr.rolling(p).mean()

def _sar(high_a, low_a, af0=0.02, af_max=0.20):
    n=len(high_a); sar=np.full(n,np.nan)
    up=True; af=af0; ep=low_a[0]; sar[0]=high_a[0]
    for i in range(1,n):
        ps=sar[i-1]
        if up:
            sar[i]=ps+af*(ep-ps)
            sar[i]=min(sar[i], low_a[max(0,i-1)], low_a[max(0,i-2)])
            if low_a[i]<sar[i]: up=False;af=af0;ep=low_a[i];sar[i]=ep
            elif high_a[i]>ep:  ep=high_a[i];af=min(af+af0,af_max)
        else:
            sar[i]=ps+af*(ep-ps)
            sar[i]=max(sar[i], high_a[max(0,i-1)], high_a[max(0,i-2)])
            if high_a[i]>sar[i]: up=True;af=af0;ep=high_a[i];sar[i]=ep
            elif low_a[i]<ep:   ep=low_a[i];af=min(af+af0,af_max)
    return sar, up

def _fib(lo, hi):
    d=hi-lo
    return {'0%':hi,'23.6%':hi-0.236*d,'38.2%':hi-0.382*d,
            '50.0%':hi-0.500*d,'61.8%':hi-0.618*d,'78.6%':hi-0.786*d,'100%':lo}


# ── Candlestick pattern detection ─────────────────────────────────────────────

def _candle_pattern(o_a, h_a, l_a, c_a):
    if len(c_a) < 3:
        return 'Insufficient data', 'neutral'
    c1o, c1h, c1l, c1c = float(o_a[-2]), float(h_a[-2]), float(l_a[-2]), float(c_a[-2])
    c2o, c2h, c2l, c2c = float(o_a[-1]), float(h_a[-1]), float(l_a[-1]), float(c_a[-1])
    r2    = c2h - c2l
    body2 = abs(c2c - c2o)
    bull2 = c2c > c2o
    body1 = abs(c1c - c1o)
    bull1 = c1c > c1o
    if r2 < 1e-10:
        return 'Flat candle', 'neutral'
    bp = body2 / r2
    lw = min(c2o, c2c) - c2l
    uw = c2h - max(c2o, c2c)
    if bp < 0.10:
        return 'Doji (Indecision)', 'neutral'
    if lw > body2 * 2.5 and uw < body2 * 0.5 and bp > 0.12:
        return 'Hammer (Bullish Reversal)', 'bull'
    if uw > body2 * 2.5 and lw < body2 * 0.5 and bp > 0.12:
        return 'Shooting Star (Bearish)', 'bear'
    if bull2 and not bull1 and body2 > body1 and c2o < c1c and c2c > c1o:
        return 'Bullish Engulfing', 'bull'
    if not bull2 and bull1 and body2 > body1 and c2o > c1c and c2c < c1o:
        return 'Bearish Engulfing', 'bear'
    if bp > 0.85:
        return ('Bullish Marubozu (Strong)', 'bull') if bull2 else ('Bearish Marubozu (Strong)', 'bear')
    return ('Bullish Candle', 'bull') if bull2 else ('Bearish Candle', 'bear')


# ── 17-factor confluence scoring ──────────────────────────────────────────────

def _score(c, h, l, o, rsi_s, macd_s, sig_s, hist_s, stoch_k, stoch_d,
           sma20, sma50, sma200, bb_up, bb_lo, vwap_s, obv_s, atr_s, sar_up, v):

    p     = float(c.iloc[-1])
    r     = float(rsi_s.iloc[-1])
    m     = float(macd_s.iloc[-1])
    sig   = float(sig_s.iloc[-1])
    hist  = float(hist_s.iloc[-1])
    histp = float(hist_s.iloc[-2]) if len(hist_s) > 2 else hist
    sk    = float(stoch_k.iloc[-1])
    sdv   = float(stoch_d.iloc[-1])
    s20   = float(sma20.iloc[-1])
    s50   = float(sma50.iloc[-1])  if pd.notna(sma50.iloc[-1])  else p
    s200  = float(sma200.iloc[-1]) if pd.notna(sma200.iloc[-1]) else p
    ub    = float(bb_up.iloc[-1])
    lb    = float(bb_lo.iloc[-1])
    vw    = float(vwap_s.iloc[-1])

    score     = 0
    reasons   = []
    checklist = []

    def add(label, status, detail, pts):
        nonlocal score
        score += pts
        checklist.append({'label': label, 'status': status, 'detail': detail, 'points': pts})

    # ── TREND ─────────────────────────────────────────────────────────────────
    if p > s50:
        add('Price > SMA50', 'bull', f'${p:.2f} above SMA50 ${s50:.2f} (+{((p/s50-1)*100):.1f}%)', 1)
    else:
        add('Price < SMA50', 'bear', f'${p:.2f} below SMA50 ${s50:.2f} ({((p/s50-1)*100):.1f}%)', -1)

    if p > s200:
        add('Price > SMA200', 'bull', f'${p:.2f} above SMA200 ${s200:.2f} (+{((p/s200-1)*100):.1f}%)', 1)
    else:
        add('Price < SMA200', 'bear', f'${p:.2f} below SMA200 ${s200:.2f} ({((p/s200-1)*100):.1f}%)', -1)

    sma50_clean  = sma50.dropna()
    sma200_clean = sma200.dropna()
    if len(sma50_clean) >= 2 and len(sma200_clean) >= 2:
        if s50 > s200:
            cross  = (sma50 > sma200) & (sma50.shift(1) <= sma200.shift(1))
            recent = bool(cross.tail(20).any())
            if recent:
                add('Golden Cross (Recent!)', 'bull', 'SMA50 just crossed above SMA200 — strong signal', 3)
                reasons.append('Golden Cross!')
            else:
                add('Golden Cross Active', 'bull', 'SMA50 above SMA200 — bull trend confirmed', 2)
                reasons.append('Golden Cross active')
        else:
            cross  = (sma50 < sma200) & (sma50.shift(1) >= sma200.shift(1))
            recent = bool(cross.tail(20).any())
            if recent:
                add('Death Cross (Recent!)', 'bear', 'SMA50 just crossed below SMA200 — strong signal', -3)
                reasons.append('Death Cross!')
            else:
                add('Death Cross Active', 'bear', 'SMA50 below SMA200 — bear trend confirmed', -2)
                reasons.append('Death Cross active')

    win5h = h.rolling(5).max().dropna()
    win5l = l.rolling(5).min().dropna()
    if len(win5h) >= 8:
        ph = win5h.tail(6).values
        pl = win5l.tail(6).values
        hh  = all(ph[i] >= ph[i-1] for i in range(1, len(ph)))
        hl  = all(pl[i] >= pl[i-1] for i in range(1, len(pl)))
        lh  = all(ph[i] <= ph[i-1] for i in range(1, len(ph)))
        ll  = all(pl[i] <= pl[i-1] for i in range(1, len(pl)))
        if hh and hl:
            add('Higher Highs & Higher Lows', 'bull', 'Classic uptrend — each swing higher than last', 2)
            reasons.append('HH+HL uptrend')
        elif lh and ll:
            add('Lower Highs & Lower Lows', 'bear', 'Classic downtrend — each swing lower than last', -2)
            reasons.append('LH+LL downtrend')
        else:
            add('Price Structure Ranging', 'neutral', 'Mixed highs/lows — consolidation or reversal', 0)

    if p > vw:
        add('Above VWAP', 'bull', f'Price ${p:.2f} > VWAP ${vw:.2f} (+{((p/vw-1)*100):.2f}%) — institutions long', 1)
    else:
        add('Below VWAP', 'bear', f'Price ${p:.2f} < VWAP ${vw:.2f} ({((p/vw-1)*100):.2f}%) — institutions short', -1)

    if sar_up:
        add('SAR Uptrend', 'bull', 'SAR dots below price — bullish trailing stop active', 1)
    else:
        add('SAR Downtrend', 'bear', 'SAR dots above price — bearish trailing stop active', -1)

    # ── MOMENTUM ──────────────────────────────────────────────────────────────
    if r < 30:
        add('RSI Oversold', 'bull', f'RSI {r:.1f} — extreme oversold, high reversal probability', 3)
        reasons.append(f'RSI oversold {r:.0f}')
    elif 40 <= r <= 65:
        add('RSI Bull Zone (40-65)', 'bull', f'RSI {r:.1f} — ideal bull momentum range', 2)
        reasons.append(f'RSI healthy {r:.0f}')
    elif r > 70:
        add('RSI Overbought', 'bear', f'RSI {r:.1f} — extreme overbought, pullback likely', -3)
        reasons.append(f'RSI overbought {r:.0f}')
    elif r > 65:
        add('RSI Elevated (65-70)', 'bear', f'RSI {r:.1f} — approaching overbought territory', -1)
    else:
        add('RSI Weak (<40)', 'bear', f'RSI {r:.1f} — below neutral, bearish bias', -1)

    r5    = float(rsi_s.iloc[-6]) if len(rsi_s) > 6 else r
    delta = r - r5
    if delta > 2 and r < 70:
        add('RSI Rising', 'bull', f'RSI up {delta:.1f} pts over 5 bars — momentum building', 1)
        reasons.append('RSI rising')
    elif delta < -2 and r > 30:
        add('RSI Falling', 'bear', f'RSI down {abs(delta):.1f} pts over 5 bars — momentum fading', -1)
        reasons.append('RSI falling')

    if len(c) >= 20 and len(rsi_s) >= 20:
        p20   = c.tail(20);    r20   = rsi_s.tail(20)
        p_lo  = float(p20.iloc[:-1].min()); p_hi = float(p20.iloc[:-1].max())
        r_lo  = float(r20.iloc[:-1].min()); r_hi = float(r20.iloc[:-1].max())
        cur_p = float(p20.iloc[-1]);        cur_r = float(r20.iloc[-1])
        if cur_p < p_lo * 0.995 and cur_r > r_lo + 3:
            add('RSI Bullish Divergence', 'bull', 'Price new low but RSI did not — reversal signal', 2)
            reasons.append('Bullish RSI divergence')
        elif cur_p > p_hi * 1.005 and cur_r < r_hi - 3:
            add('RSI Bearish Divergence', 'bear', 'Price new high but RSI did not — exhaustion signal', -2)
            reasons.append('Bearish RSI divergence')

    if m > sig:
        add('MACD Bullish Cross', 'bull', f'MACD {m:.3f} > Signal {sig:.3f} — buy momentum', 2)
        reasons.append('MACD bullish')
    else:
        add('MACD Bearish Cross', 'bear', f'MACD {m:.3f} < Signal {sig:.3f} — sell momentum', -2)
        reasons.append('MACD bearish')

    if m > 0:
        add('MACD Above Zero', 'bull', f'MACD {m:.3f} — positive territory', 1)
    else:
        add('MACD Below Zero', 'bear', f'MACD {m:.3f} — negative territory', -1)

    if hist > 0 and hist > histp:
        add('MACD Histogram Expanding+', 'bull', f'Histogram {hist:.3f} > {histp:.3f} — buying acceleration', 1)
        reasons.append('Momentum accelerating')
    elif hist < 0 and hist < histp:
        add('MACD Histogram Expanding−', 'bear', f'Histogram {hist:.3f} < {histp:.3f} — selling acceleration', -1)
        reasons.append('Selling accelerating')

    if sk < 20 and sdv < 20:
        add('Stoch Both Oversold (<20)', 'bull', f'%K {sk:.0f} & %D {sdv:.0f} — maximum oversold', 2)
        reasons.append(f'Stoch oversold {sk:.0f}')
    elif sk > 80 and sdv > 80:
        add('Stoch Both Overbought (>80)', 'bear', f'%K {sk:.0f} & %D {sdv:.0f} — maximum overbought', -2)
        reasons.append(f'Stoch overbought {sk:.0f}')
    elif sk > sdv and sk < 80:
        add('Stoch %K > %D (Bullish)', 'bull', f'%K {sk:.0f} above %D {sdv:.0f}', 1)
    elif sk < sdv and sk > 20:
        add('Stoch %K < %D (Bearish)', 'bear', f'%K {sk:.0f} below %D {sdv:.0f}', -1)

    # ── VOLUME ────────────────────────────────────────────────────────────────
    if len(obv_s) >= 10:
        obv_slope = float(obv_s.iloc[-1]) - float(obv_s.iloc[-10])
        if obv_slope > 0:
            add('OBV Rising (Accumulation)', 'bull', 'Smart money buying — OBV trending up', 1)
        else:
            add('OBV Falling (Distribution)', 'bear', 'Smart money selling — OBV trending down', -1)

    if len(c) >= 20:
        rc   = c.tail(20); rv = v.tail(20); diff = rc.diff()
        up_v = float(rv[diff > 0].mean()) if (diff > 0).any() else 0.0
        dn_v = float(rv[diff < 0].mean()) if (diff < 0).any() else 0.0
        if up_v > 0 and dn_v > 0:
            ratio = up_v / dn_v
            if ratio > 1.25:
                add('Bullish Volume Dominance', 'bull', f'Up-day avg {up_v/1e6:.1f}M vs Down {dn_v/1e6:.1f}M (×{ratio:.1f}x)', 2)
                reasons.append('Buying volume dominant')
            elif ratio < 0.80:
                add('Bearish Volume Dominance', 'bear', f'Down-day avg {dn_v/1e6:.1f}M vs Up {up_v/1e6:.1f}M (÷{1/ratio:.1f}x)', -2)
                reasons.append('Selling volume dominant')
            else:
                add('Volume Balanced', 'neutral', f'Up {up_v/1e6:.1f}M ≈ Down {dn_v/1e6:.1f}M — no clear bias', 0)

    # ── VOLATILITY ────────────────────────────────────────────────────────────
    bb_mid = (ub + lb) / 2
    if p < lb:
        add('Below BB Lower Band', 'bull', 'Price below lower BB — statistically oversold bounce setup', 2)
        reasons.append('Below BB lower')
    elif p > ub:
        add('Above BB Upper Band', 'bear', 'Price above upper BB — statistically overbought fade setup', -2)
        reasons.append('Above BB upper')
    elif p > bb_mid:
        add('Above BB Midline (SMA20)', 'bull', f'Price ${p:.2f} > SMA20 ${s20:.2f}', 1)
    else:
        add('Below BB Midline (SMA20)', 'bear', f'Price ${p:.2f} < SMA20 ${s20:.2f}', -1)

    if len(atr_s) >= 20:
        atr_now = float(atr_s.iloc[-1]); atr_avg = float(atr_s.tail(20).mean())
        if atr_avg > 0:
            if atr_now < atr_avg * 0.75:
                if score > 0:
                    add('ATR Squeeze → Bull Breakout', 'bull', f'ATR ${atr_now:.2f} << avg ${atr_avg:.2f} — coiling for breakout', 1)
                else:
                    add('ATR Squeeze → Bear Breakdown', 'bear', f'ATR ${atr_now:.2f} << avg ${atr_avg:.2f} — coiling for breakdown', -1)
            elif atr_now > atr_avg * 1.5:
                add('ATR Spike (High Volatility)', 'neutral', f'ATR ${atr_now:.2f} >> avg ${atr_avg:.2f} — extreme volatility', 0)

    # ── CANDLESTICK ───────────────────────────────────────────────────────────
    if len(o) >= 3:
        cpat, cstatus = _candle_pattern(o.values, h.values, l.values, c.values)
        pts = 1 if cstatus == 'bull' else (-1 if cstatus == 'bear' else 0)
        add(f'Candle: {cpat}', cstatus, 'Last-bar candlestick pattern', pts)
        if cstatus in ('bull', 'bear'):
            reasons.append(cpat)

    bull_n   = sum(1 for x in checklist if x['status'] == 'bull')
    bear_n   = sum(1 for x in checklist if x['status'] == 'bear')
    total    = bull_n + bear_n
    conf_pct = int(bull_n / total * 100) if total > 0 else 50

    if   score >= 16: action, color = 'STRONG BUY',  '#00ff88'
    elif score >= 9:  action, color = 'BUY',          '#3fb950'
    elif score >= 3:  action, color = 'MILD BUY',     '#7ee787'
    elif score >= -2: action, color = 'HOLD / WAIT',  '#f0c040'
    elif score >= -9: action, color = 'MILD SELL',    '#ffa657'
    elif score >= -16:action, color = 'SELL',         '#ff7b72'
    else:             action, color = 'STRONG SELL',  '#ff0000'

    return action, color, score, reasons, checklist, bull_n, bear_n, conf_pct


# ── Main analyze function ─────────────────────────────────────────────────────

def _fetch(ticker: str, period: str) -> pd.DataFrame:
    """Fetch OHLCV data with browser session to bypass VPS IP blocks."""
    for attempt in range(4):
        try:
            df = yf.Ticker(ticker, session=_SESSION).history(period=period, auto_adjust=True)
            if not df.empty:
                return df
        except Exception:
            pass
        try:
            df = yf.download(ticker, period=period, progress=False,
                             auto_adjust=True, session=_SESSION)
            if not df.empty:
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)
                return df
        except Exception:
            pass
        if attempt < 3:
            time.sleep(2 ** attempt)   # 1s, 2s, 4s
    return pd.DataFrame()


def analyze(ticker: str, period: str = '6mo') -> dict:
    df = _fetch(ticker, period)
    if df.empty:
        raise ValueError(f'No data for {ticker}')

    o = df['Open'].squeeze();  c = df['Close'].squeeze()
    h = df['High'].squeeze();  l = df['Low'].squeeze()
    v = df['Volume'].squeeze(); dates = c.index

    sma20, bb_up, bb_lo = _bb(c)
    sma50  = c.rolling(50).mean()
    sma200 = c.rolling(200).mean()
    rsi_s  = _rsi(c)
    macd_s, sig_s, hist_s = _macd(c)
    stoch_k, stoch_d = _stoch(h, l, c)
    vwap_s = _vwap(h, l, c, v)
    obv_s  = _obv(c, v)
    atr_s  = _atr(h, l, c)
    sar_a, sar_up = _sar(h.values, l.values)
    sar_s  = pd.Series(sar_a, index=dates)

    n   = min(60, len(c))
    fib = _fib(float(c.iloc[-n:].min()), float(c.iloc[-n:].max()))

    action, a_color, score, reasons, checklist, bull_n, bear_n, conf_pct = _score(
        c, h, l, o, rsi_s, macd_s, sig_s, hist_s,
        stoch_k, stoch_d, sma20, sma50, sma200, bb_up, bb_lo,
        vwap_s, obv_s, atr_s, sar_up, v)

    price = float(c.iloc[-1])
    atr_v = float(atr_s.iloc[-1])
    stop  = round(price - 1.5 * atr_v, 2)
    t1    = round(price + 2.0 * atr_v, 2)
    t2    = round(price + 3.5 * atr_v, 2)
    t3    = round(price + 5.0 * atr_v, 2)
    risk  = round(price - stop, 2)
    rr    = round((t1 - price) / risk, 1) if risk > 0 else 0

    resist = float(c.rolling(10).max().dropna().tail(5).mean())
    supp   = float(c.rolling(10).min().dropna().tail(5).mean())

    rsi_buy   = (rsi_s > 30)    & (rsi_s.shift(1) <= 30)
    macd_buy  = (hist_s > 0)    & (hist_s.shift(1) <= 0)
    stoch_buy = (stoch_k > 20)  & (stoch_k.shift(1) <= 20)
    buy_sig   = rsi_buy | macd_buy | stoch_buy

    rsi_sell   = (rsi_s < 70)   & (rsi_s.shift(1) >= 70)
    macd_sell  = (hist_s < 0)   & (hist_s.shift(1) >= 0)
    stoch_sell = (stoch_k < 80) & (stoch_k.shift(1) >= 80)
    sell_sig   = rsi_sell | macd_sell | stoch_sell

    def to_signals(mask):
        return [{'date': str(d.date()), 'price': round(float(c[d]), 2)}
                for d in dates[mask][-20:]]

    result = {
        'ticker':       ticker,
        'period':       period,
        'price':        price,
        'action':       action,
        'action_color': a_color,
        'score':        score,
        'reasons':      reasons,
        'confluence': {
            'bull_count': bull_n,
            'bear_count': bear_n,
            'bull_pct':   conf_pct,
            'checklist':  checklist,
        },
        'levels': {
            'stop': stop, 't1': t1, 't2': t2, 't3': t3,
            'risk': risk, 'rr': rr,
            'resistance': round(resist, 2),
            'support':    round(supp, 2),
        },
        'indicators': {
            'rsi':       round(float(rsi_s.iloc[-1]),  1),
            'macd':      round(float(macd_s.iloc[-1]), 3),
            'signal':    round(float(sig_s.iloc[-1]),  3),
            'hist':      round(float(hist_s.iloc[-1]), 3),
            'stoch_k':   round(float(stoch_k.iloc[-1]), 1),
            'stoch_d':   round(float(stoch_d.iloc[-1]), 1),
            'atr':       round(atr_v, 2),
            'vwap':      round(float(vwap_s.iloc[-1]), 2),
            'obv':       int(obv_s.iloc[-1]),
            'sma20':     round(float(sma20.iloc[-1]),  2),
            'sma50':     round(float(sma50.iloc[-1]),  2),
            'sma200':    round(float(sma200.iloc[-1]), 2),
            'bb_upper':  round(float(bb_up.iloc[-1]),  2),
            'bb_lower':  round(float(bb_lo.iloc[-1]),  2),
            'sar':       round(float(sar_s.iloc[-1]),  2),
            'sar_trend': 'uptrend' if sar_up else 'downtrend',
        },
        'fibonacci':    {k: round(fv, 2) for k, fv in fib.items()},
        'buy_signals':  to_signals(buy_sig),
        'sell_signals': to_signals(sell_sig),
    }
    return _clean(result)


# ── Watchlist scan ────────────────────────────────────────────────────────────

def _scan_one(t: str, period: str) -> dict:
    try:
        d = analyze(t, period)
        return {
            'ticker':    d['ticker'],
            'price':     d['price'],
            'action':    d['action'],
            'color':     d['action_color'],
            'score':     d['score'],
            'bull_pct':  d['confluence']['bull_pct'],
            'rsi':       d['indicators']['rsi'],
            'stoch_k':   d['indicators']['stoch_k'],
            'macd_bull': d['indicators']['macd'] > d['indicators']['signal'],
            'sar_trend': d['indicators']['sar_trend'],
            'stop':      d['levels']['stop'],
            't1':        d['levels']['t1'],
            't2':        d['levels']['t2'],
            'risk':      d['levels']['risk'],
            'rr':        d['levels']['rr'],
        }
    except Exception as e:
        return {'ticker': t, 'action': 'ERROR', 'color': '#666', 'score': 0,
                'bull_pct': 50, 'error': str(e)}


def scan(tickers: list, period: str = '6mo') -> list:
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(_scan_one, t, period): t for t in tickers}
        rows = [f.result() for f in as_completed(futures)]
    return sorted(rows, key=lambda x: x.get('score', 0), reverse=True)