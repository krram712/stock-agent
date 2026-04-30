import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Fundamentals {
  ticker: string;
  peRatio: number;
  pegRatio: number;
  pbRatio: number;
  revenueGrowthYoy: number;
  netMargin: number;
  roe: number;
  debtToEquity: number;
  dividendYield: number;
  eps: number;
  analystTarget: number;
  upsideToTarget: number;
  buyPercentage: number;
}

function metricColor(value: number, good: 'high' | 'low', thresholds: [number, number]): string {
  const [warn, ok] = thresholds;
  if (good === 'high') {
    if (value >= ok) return '#00ff88';
    if (value >= warn) return '#fbbf24';
    return '#ef4444';
  } else {
    if (value <= ok) return '#00ff88';
    if (value <= warn) return '#fbbf24';
    return '#ef4444';
  }
}

interface MetricTileProps {
  label: string;
  value: string;
  color: string;
  sub?: string;
}

function MetricTile({ label, value, color, sub }: MetricTileProps) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.018)', border: `1px solid ${color}20`, borderTop: `2px solid ${color}`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 8, letterSpacing: 1, color: '#2a4050', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: '#3d5a6e', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function FinvizPanel({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Fundamentals | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setData(null);
    api.stocks.fundamentals(ticker)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  const COLOR = '#34d399';

  return (
    <div style={{ background: 'rgba(255,255,255,0.018)', border: `1px solid ${COLOR}20`, borderLeft: `3px solid ${COLOR}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: COLOR, fontFamily: 'monospace', textAlign: 'left' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>🏛 Fundamentals — {ticker}</span>
        <span style={{ fontSize: 9, opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${COLOR}15` }}>
          {loading && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '12px 0' }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR, opacity: 0.5 }} />)}
              <span style={{ fontSize: 10, color: '#3d5a6e', marginLeft: 4 }}>loading fundamentals…</span>
            </div>
          )}

          {data && (<>
            {/* Valuation */}
            <div style={{ fontSize: 8, letterSpacing: 2, color: '#2a4050', margin: '12px 0 6px' }}>VALUATION</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 6, marginBottom: 10 }}>
              <MetricTile label="P/E RATIO"   value={data.peRatio?.toFixed(1)}  color={metricColor(data.peRatio, 'low', [35, 25])}  sub="trailing" />
              <MetricTile label="PEG RATIO"   value={data.pegRatio?.toFixed(2)} color={metricColor(data.pegRatio, 'low', [2, 1])}    sub="growth adj" />
              <MetricTile label="P/B RATIO"   value={data.pbRatio?.toFixed(2)}  color={metricColor(data.pbRatio, 'low', [8, 4])}     sub="price/book" />
              <MetricTile label="EPS"         value={`$${data.eps?.toFixed(2)}`} color={data.eps > 0 ? '#00ff88' : '#ef4444'}        sub="trailing" />
            </div>

            {/* Profitability */}
            <div style={{ fontSize: 8, letterSpacing: 2, color: '#2a4050', margin: '10px 0 6px' }}>PROFITABILITY</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 6, marginBottom: 10 }}>
              <MetricTile label="NET MARGIN"  value={`${data.netMargin?.toFixed(1)}%`}      color={metricColor(data.netMargin, 'high', [10, 20])}      />
              <MetricTile label="ROE"         value={`${data.roe?.toFixed(1)}%`}             color={metricColor(data.roe, 'high', [12, 20])}            sub="return on equity" />
              <MetricTile label="REV GROWTH"  value={`${data.revenueGrowthYoy?.toFixed(1)}%`} color={metricColor(data.revenueGrowthYoy, 'high', [5, 15])} sub="YoY" />
              <MetricTile label="DIV YIELD"   value={`${data.dividendYield?.toFixed(2)}%`}  color={data.dividendYield > 0 ? '#fbbf24' : '#3d5a6e'}     />
            </div>

            {/* Risk */}
            <div style={{ fontSize: 8, letterSpacing: 2, color: '#2a4050', margin: '10px 0 6px' }}>RISK & ANALYST</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 6, marginBottom: 12 }}>
              <MetricTile label="DEBT/EQUITY" value={data.debtToEquity?.toFixed(2)}          color={metricColor(data.debtToEquity, 'low', [1.5, 0.8])} />
              <MetricTile label="ANALYST TGT" value={data.analystTarget > 0 ? `$${data.analystTarget?.toFixed(0)}` : 'N/A'} color="#00d4ff" />
              <MetricTile label="UPSIDE"      value={`${data.upsideToTarget?.toFixed(1)}%`}  color={data.upsideToTarget > 0 ? '#00ff88' : '#ef4444'}   />
              <MetricTile label="BUY %"       value={`${data.buyPercentage?.toFixed(0)}%`}   color={metricColor(data.buyPercentage, 'high', [50, 65])} sub="analysts" />
            </div>

            {/* Buy consensus bar */}
            <div style={{ fontSize: 8, letterSpacing: 2, color: '#2a4050', marginBottom: 6 }}>ANALYST CONSENSUS</div>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 4, height: 8, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ height: '100%', width: `${Math.min(100, data.buyPercentage)}%`, background: `linear-gradient(90deg, #00ff88, #00d4ff)`, borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#3d5a6e' }}>
              <span>0% buy</span>
              <span style={{ color: '#00ff88' }}>{data.buyPercentage?.toFixed(0)}% analysts bullish</span>
              <span>100%</span>
            </div>
          </>)}
        </div>
      )}
    </div>
  );
}