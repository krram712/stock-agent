// ============================================================
// React hook — consumes TradingView signals from webhook server
// Usage: const { signals, latestSignal, isConnected } = useTradingViewSignals("AAPL")
// ============================================================
import { useState, useEffect, useRef } from 'react';

export interface TVSignal {
  id: number;
  ticker: string;
  action: 'BUY' | 'SELL';
  score: number;
  verdict: string;
  price: number;
  rsi: number;
  macd_hist: number;
  cmf: number;
  adx: number;
  pattern: string;
  timeframe: string;
  timestamp: string;
}

const WEBHOOK_BASE = process.env.REACT_APP_WEBHOOK_URL || 'http://localhost:3001';

export function useTradingViewSignals(ticker?: string) {
  const [signals, setSignals]         = useState<TVSignal[]>([]);
  const [latestSignal, setLatest]     = useState<TVSignal | null>(null);
  const [isConnected, setConnected]   = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Load existing signals
  useEffect(() => {
    const url = ticker
      ? `${WEBHOOK_BASE}/signals?ticker=${ticker}&limit=20`
      : `${WEBHOOK_BASE}/signals?limit=20`;
    fetch(url).then(r => r.json()).then(data => {
      setSignals(data);
      if (data.length > 0) setLatest(data[0]);
    }).catch(console.error);
  }, [ticker]);

  // Real-time SSE stream
  useEffect(() => {
    const es = new EventSource(`${WEBHOOK_BASE}/stream`);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (event) => {
      const signal: TVSignal = JSON.parse(event.data);
      if (ticker && signal.ticker !== ticker.toUpperCase()) return;
      setSignals(prev => [signal, ...prev.slice(0, 49)]);
      setLatest(signal);
    };

    return () => { es.close(); setConnected(false); };
  }, [ticker]);

  return { signals, latestSignal, isConnected };
}
