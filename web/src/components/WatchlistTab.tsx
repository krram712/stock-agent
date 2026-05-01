import React, { useState } from 'react';
import { api } from '../services/api';

interface Watchlist {
  id: string;
  name: string;
  tickers: string[];
}

interface Props {
  watchlists: Watchlist[];
  onTickerSelect: (ticker: string) => void;
  onRefresh: () => void;
}

export default function WatchlistTab({ watchlists, onTickerSelect, onRefresh }: Props) {
  const [creating, setCreating]         = useState(false);
  const [newName, setNewName]           = useState('');
  const [newTickers, setNewTickers]     = useState('');
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editTickers, setEditTickers]   = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const handleCreate = async () => {
    const name = newName.trim();
    const tickers = newTickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      await api.watchlists.create({ name, tickers });
      setNewName('');
      setNewTickers('');
      setCreating(false);
      onRefresh();
    } catch {
      setError('Failed to create watchlist.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.watchlists.delete(id);
      onRefresh();
    } catch {
      setError('Failed to delete watchlist.');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (wl: Watchlist) => {
    setEditingId(wl.id);
    setEditTickers(wl.tickers.join(', '));
  };

  const handleSaveTickers = async (id: string) => {
    const tickers = editTickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    setLoading(true);
    setError(null);
    try {
      await api.watchlists.updateTickers(id, tickers);
      setEditingId(null);
      onRefresh();
    } catch {
      setError('Failed to update tickers.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#00d4ff', fontWeight: 700, letterSpacing: 2 }}>👁 WATCHLISTS</div>
        <button
          onClick={() => { setCreating(c => !c); setError(null); }}
          style={{ padding: '6px 14px', background: creating ? 'rgba(0,212,255,0.12)' : 'transparent', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 6, color: '#00d4ff', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700 }}>
          {creating ? '✕ Cancel' : '+ New Watchlist'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, padding: '8px 14px', marginBottom: 10, fontSize: 11, color: '#ef4444' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, color: '#2a4050', marginBottom: 10 }}>NEW WATCHLIST</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#2a4050', marginBottom: 4, letterSpacing: 1 }}>NAME</div>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. AI Semis"
                style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: 6, padding: '8px 10px', color: '#c8d6e0', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
              />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#2a4050', marginBottom: 4, letterSpacing: 1 }}>TICKERS (comma-separated)</div>
              <input
                value={newTickers}
                onChange={e => setNewTickers(e.target.value.toUpperCase())}
                placeholder="NVDA, AMD, AVGO, TSM"
                style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: 6, padding: '8px 10px', color: '#c8d6e0', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={loading || !newName.trim()}
              style={{ padding: '8px 18px', background: loading || !newName.trim() ? 'rgba(0,212,255,0.03)' : 'rgba(0,212,255,0.14)', border: '1px solid rgba(0,212,255,0.4)', borderRadius: 6, color: loading || !newName.trim() ? '#2a4050' : '#00d4ff', fontSize: 11, fontFamily: 'inherit', cursor: loading || !newName.trim() ? 'not-allowed' : 'pointer', fontWeight: 700, alignSelf: 'flex-start' }}>
              {loading ? '⟳ Creating...' : '✓ Create'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {watchlists.length === 0 && !creating && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#1a2a35' }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.2 }}>👁</div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>No watchlists yet</div>
          <div style={{ fontSize: 10, color: '#0e1e26' }}>Click <b style={{ color: '#00d4ff' }}>+ New Watchlist</b> to get started</div>
        </div>
      )}

      {/* Watchlist cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {watchlists.map(wl => (
          <div key={wl.id} style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(0,212,255,0.12)', borderLeft: '3px solid #00d4ff', borderRadius: 10, padding: '14px 16px' }}>

            {/* Watchlist header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#00d4ff' }}>{wl.name}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => editingId === wl.id ? setEditingId(null) : startEdit(wl)}
                  style={{ padding: '4px 10px', background: editingId === wl.id ? 'rgba(0,212,255,0.12)' : 'transparent', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 5, color: '#00d4ff', fontSize: 9, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700 }}>
                  {editingId === wl.id ? '✕ Cancel' : '✎ Edit'}
                </button>
                <button
                  onClick={() => handleDelete(wl.id)}
                  disabled={loading}
                  style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, color: '#ef4444', fontSize: 9, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700 }}>
                  ✕ Delete
                </button>
              </div>
            </div>

            {/* Edit mode */}
            {editingId === wl.id ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={editTickers}
                  onChange={e => setEditTickers(e.target.value.toUpperCase())}
                  placeholder="NVDA, AMD, AVGO"
                  style={{ flex: 1, minWidth: 200, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 6, padding: '7px 10px', color: '#c8d6e0', fontSize: 11, fontFamily: 'inherit', outline: 'none' }}
                />
                <button
                  onClick={() => handleSaveTickers(wl.id)}
                  disabled={loading}
                  style={{ padding: '7px 14px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.4)', borderRadius: 6, color: '#00ff88', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700 }}>
                  {loading ? '⟳' : '✓ Save'}
                </button>
              </div>
            ) : (
              /* Ticker chips */
              <div>
                {wl.tickers.length === 0 ? (
                  <span style={{ fontSize: 10, color: '#1a2a35' }}>No tickers — click Edit to add some</span>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {wl.tickers.map(t => (
                      <button
                        key={t}
                        onClick={() => onTickerSelect(t)}
                        title="Click to analyze"
                        style={{ padding: '4px 10px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 5, color: '#00d4ff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                        onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'rgba(0,212,255,0.18)'; }}
                        onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'rgba(0,212,255,0.08)'; }}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 9, color: '#1a2a35' }}>
                  {wl.tickers.length} ticker{wl.tickers.length !== 1 ? 's' : ''} · click any to run analysis
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}