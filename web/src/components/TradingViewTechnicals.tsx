import { useEffect, useRef } from 'react';

interface Props {
  ticker: string;
}

export default function TradingViewTechnicals({ ticker }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      interval: '1D',
      width: '100%',
      isTransparent: true,
      height: 450,
      symbol: ticker,
      showIntervalTabs: true,
      displayMode: 'single',
      locale: 'en',
      colorTheme: 'dark',
    });

    containerRef.current.appendChild(script);
  }, [ticker]);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.018)',
      border: '1px solid rgba(0,212,255,0.12)',
      borderLeft: '3px solid #00d4ff',
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,212,255,0.08)' }}>
        <span style={{ color: '#00d4ff', fontSize: 13, fontWeight: 700 }}>
          📊 TradingView Technical Analysis
        </span>
      </div>
      <div className="tradingview-widget-container" ref={containerRef}>
        <div className="tradingview-widget-container__widget" />
      </div>
    </div>
  );
}

