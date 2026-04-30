import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface Script {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  language: string;
  active: boolean;
  createdAt: string;
  content?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  SIGNAL:   '#00ff88',
  SCREENER: '#00d4ff',
  OPTIONS:  '#a78bfa',
  STRATEGY: '#fbbf24',
};

const CATEGORY_ICONS: Record<string, string> = {
  SIGNAL:   '🎯',
  SCREENER: '🔍',
  OPTIONS:  '⚙️',
  STRATEGY: '📋',
};

export default function ScriptsTab({ isAdmin }: { isAdmin: boolean }) {
  const [scripts, setScripts]       = useState<Script[]>([]);
  const [selected, setSelected]     = useState<Script | null>(null);
  const [loading, setLoading]       = useState(true);
  const [copied, setCopied]         = useState(false);
  const [filter, setFilter]         = useState<string>('ALL');
  const [loadingContent, setLoadingContent] = useState(false);

  const FILTERS = ['ALL', 'SIGNAL', 'SCREENER', 'OPTIONS', 'STRATEGY'];

  useEffect(() => {
    setLoading(true);
    api.scripts.getAll()
      .then(r => setScripts(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openScript = async (s: Script) => {
    if (s.content) { setSelected(s); return; }
    setLoadingContent(true);
    try {
      const r = await api.scripts.getById(s.id);
      const full = r.data;
      setScripts(prev => prev.map(x => x.id === full.id ? full : x));
      setSelected(full);
    } catch {}
    setLoadingContent(false);
  };

  const copyToClipboard = () => {
    if (!selected?.content) return;
    navigator.clipboard.writeText(selected.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const filtered = filter === 'ALL' ? scripts : scripts.filter(s => s.category === filter);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 12, alignItems: 'start' }}>

      {/* Left: script list */}
      <div>
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '5px 12px', borderRadius: 6, fontSize: 10, fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer', background: filter === f ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.03)', border: filter === f ? '1px solid rgba(0,255,136,0.5)' : '1px solid rgba(255,255,255,0.07)', color: filter === f ? '#00ff88' : '#3d5a6e', letterSpacing: 1 }}>
              {f}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ color: '#3d5a6e', fontSize: 12, padding: 20, textAlign: 'center' }}>Loading scripts…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ color: '#1a2a35', fontSize: 12, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.2 }}>📜</div>
            No scripts found — backend may still be starting up
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(s => {
            const col = CATEGORY_COLORS[s.category] || '#94a3b8';
            const isOpen = selected?.id === s.id;
            return (
              <div key={s.id} onClick={() => openScript(s)}
                style={{ background: isOpen ? `${col}10` : 'rgba(255,255,255,0.018)', border: `1px solid ${isOpen ? col + '40' : 'rgba(255,255,255,0.06)'}`, borderLeft: `3px solid ${col}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[s.category] || '📄'}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#c8d6e0', flex: 1 }}>{s.name}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 8, fontWeight: 700, background: `${col}18`, border: `1px solid ${col}40`, color: col, letterSpacing: 1 }}>{s.category}</span>
                  <span style={{ fontSize: 9, color: '#2a4050', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 4 }}>v{s.version}</span>
                </div>
                <div style={{ fontSize: 11, color: '#3d5a6e', lineHeight: 1.5, paddingLeft: 22 }}>{s.description}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6, paddingLeft: 22, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: '#1e3040', letterSpacing: 1 }}>{s.language}</span>
                  <span style={{ fontSize: 9, color: '#1e3040' }}>·</span>
                  <span style={{ fontSize: 9, color: isOpen ? col : '#00ff8840', fontWeight: 700 }}>{isOpen ? '▶ OPEN' : 'click to view'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: script viewer */}
      {selected && (
        <div style={{ position: 'sticky', top: 0, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#00ff88', flex: 1 }}>{selected.name} <span style={{ color: '#2a4050', fontWeight: 400 }}>v{selected.version}</span></span>
            <button onClick={copyToClipboard}
              style={{ padding: '5px 12px', background: copied ? 'rgba(0,255,136,0.2)' : 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 6, color: '#00ff88', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer', fontWeight: 700 }}>
              {copied ? '✓ COPIED' : '⎘ COPY'}
            </button>
            <button onClick={() => setSelected(null)}
              style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, color: '#3d5a6e', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer' }}>
              ✕
            </button>
          </div>

          {/* Paste instructions */}
          <div style={{ padding: '8px 16px', background: 'rgba(0,212,255,0.05)', borderBottom: '1px solid rgba(0,212,255,0.1)', fontSize: 10, color: '#00d4ff' }}>
            TradingView → Pine Editor → New → Paste → Add to Chart → Create Alert → Webhook: <code style={{ color: '#00ff88' }}>https://stockagentify.com/webhook</code>
          </div>

          {/* Content */}
          {loadingContent && (
            <div style={{ padding: 20, color: '#3d5a6e', fontSize: 11 }}>Loading script content…</div>
          )}
          {selected.content && (
            <pre style={{ margin: 0, padding: '14px 16px', color: '#7aada8', fontSize: 11, lineHeight: 1.6, overflowX: 'auto', overflowY: 'auto', maxHeight: '65vh', fontFamily: 'JetBrains Mono, Fira Code, monospace', whiteSpace: 'pre' }}>
              {selected.content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}