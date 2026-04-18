import { useEffect, useRef } from 'react';

interface Props {
  ticker: string;
  interval?: '1' | '5' | '15' | '30' | '60' | 'D' | 'W' | 'M';
  height?: number;
}

let tvScriptLoadingPromise: Promise<void> | null = null;

function loadTVScript(): Promise<void> {
  if (!tvScriptLoadingPromise) {
    tvScriptLoadingPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.id = 'tradingview-widget-loading-script';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.type = 'text/javascript';
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }
  return tvScriptLoadingPromise;
}

export default function TradingViewChart({ ticker, interval = 'D', height = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    loadTVScript().then(() => {
      if (!containerRef.current || !(window as any).TradingView) return;

      // Clean up previous widget
      if (widgetRef.current) {
        try { widgetRef.current.remove?.(); } catch {}
      }
      containerRef.current.innerHTML = '';

      widgetRef.current = new (window as any).TradingView.widget({
        autosize: true,
        symbol: ticker,
        interval,
        timezone: 'America/New_York',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#0a1929',
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        container_id: containerRef.current.id,
        backgroundColor: '#06101a',
        gridColor: 'rgba(0,255,136,0.04)',
        studies: [
          'MASimple@tv-basicstudies',
          'RSI@tv-basicstudies',
          'MACD@tv-basicstudies',
          'BB@tv-basicstudies',
        ],
        show_popup_button: true,
        popup_width: '1000',
        popup_height: '650',
        withdateranges: true,
        allow_symbol_change: true,
        details: true,
        hotlist: true,
        calendar: true,
      });
    });

    return () => {
      if (widgetRef.current) {
        try { widgetRef.current.remove?.(); } catch {}
      }
    };
  }, [ticker, interval]);

  const containerId = `tv-chart-${ticker}`;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.018)',
      border: '1px solid rgba(0,255,136,0.12)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid rgba(0,255,136,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ color: '#00ff88', fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>
          📈 TRADINGVIEW CHART
        </span>
        <span style={{
          background: 'rgba(0,255,136,0.1)',
          border: '1px solid rgba(0,255,136,0.25)',
          color: '#00ff88',
          fontSize: 10,
          padding: '2px 8px',
          borderRadius: 4,
          letterSpacing: 1,
        }}>
          {ticker}
        </span>
      </div>
      <div
        id={containerId}
        ref={containerRef}
        style={{ height, width: '100%' }}
      />
    </div>
  );
}

