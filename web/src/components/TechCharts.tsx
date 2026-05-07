import React from 'react';
import {
  ResponsiveContainer, ComposedChart, BarChart, LineChart,
  Line, Area, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Legend,
} from 'recharts';

interface ChartPoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
  sma20: number | null;
  sma50: number | null;
  bb_upper: number | null;
  bb_lower: number | null;
  vwap: number | null;
  rsi: number | null;
  stoch_k: number | null;
  stoch_d: number | null;
  macd: number | null;
  signal: number | null;
  hist: number | null;
}

interface Props {
  data: ChartPoint[];
  levels?: {
    stop?: number; t1?: number; t2?: number;
    support?: number; resistance?: number;
  };
}

const BG     = '#0d1117';
const BORDER = '#30363d';
const MUTED  = '#8b949e';
const GRID   = '#1a2332';
const BLUE   = '#58a6ff';
const GREEN  = '#3fb950';
const RED    = '#ff7b72';
const YELLOW = '#f0c040';
const ORANGE = '#ffa657';
const PURPLE = '#d2a8ff';

const TT_STYLE = {
  backgroundColor: '#161b22',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  fontSize: 11,
  fontFamily: 'JetBrains Mono, Fira Code, monospace',
  color: '#c8d6e0',
};

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d: string) {
  const parts = d.split('-');
  return `${MONTHS[+parts[1]]} ${+parts[2]}`;
}

function xTicks(data: ChartPoint[], maxTicks = 7): string[] {
  if (data.length === 0) return [];
  const step = Math.max(1, Math.floor(data.length / maxTicks));
  const ticks: string[] = [];
  for (let i = 0; i < data.length; i += step) ticks.push(data[i].date);
  if (ticks[ticks.length - 1] !== data[data.length - 1].date)
    ticks.push(data[data.length - 1].date);
  return ticks;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 4px 6px', marginBottom: 6 }}>
      <div style={{ fontSize: 9, color: MUTED, letterSpacing: 2, paddingLeft: 10, marginBottom: 4, textTransform: 'uppercase' as const }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function TechCharts({ data, levels }: Props) {
  if (!data || data.length === 0) return null;

  const ticks = xTicks(data);
  const xAxis = (
    <XAxis
      dataKey="date"
      tickFormatter={fmtDate}
      ticks={ticks}
      tick={{ fill: MUTED, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
      axisLine={{ stroke: BORDER }}
      tickLine={false}
    />
  );

  const margin = { top: 4, right: 12, bottom: 4, left: 56 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── 1. Price + BB + VWAP + SMAs ─────────────────────────────── */}
      <Section title="Price  ·  BB  ·  VWAP  ·  SMA20  ·  SMA50">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            {xAxis}
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: MUTED, fontSize: 10 }}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              axisLine={{ stroke: BORDER }} tickLine={false}
            />
            <Tooltip
              contentStyle={TT_STYLE}
              labelStyle={{ color: MUTED, marginBottom: 4 }}
              formatter={(v: number, name: string) => [`$${v?.toFixed(2)}`, name]}
            />
            {/* BB fill channel */}
            <Area dataKey="bb_upper" stroke={BLUE} strokeWidth={1} strokeDasharray="4 3"
              fill={BLUE} fillOpacity={0.06} dot={false} name="BB Upper" legendType="none" />
            <Area dataKey="bb_lower" stroke={BLUE} strokeWidth={1} strokeDasharray="4 3"
              fill={BG} fillOpacity={1} dot={false} name="BB Lower" legendType="none" />
            {/* SMAs */}
            <Line dataKey="sma20" stroke={YELLOW} strokeWidth={1.5} dot={false} name="SMA20" />
            <Line dataKey="sma50" stroke={ORANGE} strokeWidth={1.5} dot={false} name="SMA50" />
            {/* VWAP */}
            <Line dataKey="vwap" stroke={PURPLE} strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="VWAP" />
            {/* Price (on top) */}
            <Area dataKey="close" stroke={BLUE} strokeWidth={2} fill={BLUE} fillOpacity={0.10} dot={false} name="Close" />
            {/* Trade levels */}
            {levels?.support    && <ReferenceLine y={levels.support}    stroke={GREEN} strokeDasharray="4 4" label={{ value: 'Supp', fill: GREEN, fontSize: 9, position: 'insideTopLeft' }} />}
            {levels?.resistance && <ReferenceLine y={levels.resistance} stroke={RED}   strokeDasharray="4 4" label={{ value: 'Res',  fill: RED,   fontSize: 9, position: 'insideTopLeft' }} />}
            {levels?.stop       && <ReferenceLine y={levels.stop} stroke={RED}   strokeWidth={1.5} strokeDasharray="2 5" label={{ value: 'Stop', fill: RED,   fontSize: 9, position: 'insideTopLeft' }} />}
            {levels?.t1         && <ReferenceLine y={levels.t1}  stroke={GREEN} strokeWidth={1.5} strokeDasharray="2 5" label={{ value: 'T1',  fill: GREEN, fontSize: 9, position: 'insideTopLeft' }} />}
            <Legend
              wrapperStyle={{ fontSize: 10, color: MUTED, paddingTop: 4, fontFamily: 'JetBrains Mono, monospace' }}
              formatter={(v: string) => <span style={{ color: MUTED }}>{v}</span>}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Section>

      {/* ── 2. Volume ───────────────────────────────────────────────── */}
      <Section title="Volume">
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={data} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            {xAxis}
            <YAxis
              tick={{ fill: MUTED, fontSize: 10 }}
              tickFormatter={(v: number) => `${(v / 1e6).toFixed(0)}M`}
              axisLine={{ stroke: BORDER }} tickLine={false}
            />
            <Tooltip
              contentStyle={TT_STYLE}
              labelStyle={{ color: MUTED }}
              formatter={(v: number) => [`${(v / 1e6).toFixed(2)}M`, 'Volume']}
            />
            <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={(d.close ?? 0) >= (d.open ?? 0) ? GREEN : RED} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Section>

      {/* ── 3. RSI ──────────────────────────────────────────────────── */}
      <Section title="RSI (14)">
        <ResponsiveContainer width="100%" height={110}>
          <LineChart data={data} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            {xAxis}
            <YAxis domain={[0, 100]} tick={{ fill: MUTED, fontSize: 10 }} axisLine={{ stroke: BORDER }} tickLine={false} />
            <Tooltip contentStyle={TT_STYLE} labelStyle={{ color: MUTED }} formatter={(v: number) => [v?.toFixed(1), 'RSI']} />
            <ReferenceLine y={70} stroke={RED}   strokeDasharray="4 4" label={{ value: '70', fill: RED,   fontSize: 9, position: 'insideTopRight' }} />
            <ReferenceLine y={50} stroke={BORDER} strokeDasharray="2 4" />
            <ReferenceLine y={30} stroke={GREEN} strokeDasharray="4 4" label={{ value: '30', fill: GREEN, fontSize: 9, position: 'insideBottomRight' }} />
            <Line dataKey="rsi" stroke={BLUE} strokeWidth={2} dot={false} name="RSI" />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      {/* ── 4. Stochastic ───────────────────────────────────────────── */}
      <Section title="Stochastic (14, 3, 3)">
        <ResponsiveContainer width="100%" height={110}>
          <LineChart data={data} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            {xAxis}
            <YAxis domain={[0, 100]} tick={{ fill: MUTED, fontSize: 10 }} axisLine={{ stroke: BORDER }} tickLine={false} />
            <Tooltip contentStyle={TT_STYLE} labelStyle={{ color: MUTED }} formatter={(v: number, name: string) => [v?.toFixed(1), name]} />
            <ReferenceLine y={80} stroke={RED}   strokeDasharray="4 4" label={{ value: '80', fill: RED,   fontSize: 9, position: 'insideTopRight' }} />
            <ReferenceLine y={20} stroke={GREEN} strokeDasharray="4 4" label={{ value: '20', fill: GREEN, fontSize: 9, position: 'insideBottomRight' }} />
            <Line dataKey="stoch_k" stroke={GREEN}  strokeWidth={2}   dot={false} name="%K" />
            <Line dataKey="stoch_d" stroke={ORANGE} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="%D" />
            <Legend wrapperStyle={{ fontSize: 10, color: MUTED, paddingTop: 2, fontFamily: 'JetBrains Mono, monospace' }} formatter={(v: string) => <span style={{ color: MUTED }}>{v}</span>} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      {/* ── 5. MACD ─────────────────────────────────────────────────── */}
      <Section title="MACD (12, 26, 9)">
        <ResponsiveContainer width="100%" height={120}>
          <ComposedChart data={data} margin={margin}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            {xAxis}
            <YAxis tick={{ fill: MUTED, fontSize: 10 }} tickFormatter={(v: number) => v.toFixed(2)} axisLine={{ stroke: BORDER }} tickLine={false} />
            <Tooltip contentStyle={TT_STYLE} labelStyle={{ color: MUTED }} formatter={(v: number, name: string) => [v?.toFixed(3), name]} />
            <ReferenceLine y={0} stroke={BORDER} />
            <Bar dataKey="hist" name="Hist" radius={[2, 2, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={(d.hist ?? 0) >= 0 ? GREEN : RED} fillOpacity={0.75} />
              ))}
            </Bar>
            <Line dataKey="macd"   stroke={BLUE}   strokeWidth={2}   dot={false} name="MACD" />
            <Line dataKey="signal" stroke={ORANGE} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Signal" />
            <Legend wrapperStyle={{ fontSize: 10, color: MUTED, paddingTop: 2, fontFamily: 'JetBrains Mono, monospace' }} formatter={(v: string) => <span style={{ color: MUTED }}>{v}</span>} />
          </ComposedChart>
        </ResponsiveContainer>
      </Section>

    </div>
  );
}