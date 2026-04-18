import { useEffect, useRef } from 'react';

interface Props {
  ticker: string;
}

export default function TradingViewMiniChart({ ticker }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [[ticker, `${ticker}|1D`]],
      chartOnly: false,
      width: '100%',
      height: 200,
      locale: 'en',
      colorTheme: 'dark',
      autosize: true,
      showVolume: true,
      showMA: true,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
      scalePosition: 'right',
      scaleMode: 'Normal',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '10',
      noTimeScale: false,
      valuesTracking: '1',
      changeMode: 'price-and-percent',
      chartType: 'area',
      maLineColor: '#2962FF',
      maLineWidth: 1,
      maLength: 9,
      lineWidth: 2,
      lineType: 0,
      isTransparent: true,
      lineColor: '#00ff88',
      topColor: 'rgba(0,255,136,0.28)',
      bottomColor: 'rgba(0,255,136,0)',
    });

    containerRef.current.appendChild(script);
  }, [ticker]);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.015)',
      border: '1px solid rgba(0,255,136,0.1)',
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      <div className="tradingview-widget-container" ref={containerRef}>
        <div className="tradingview-widget-container__widget" />
      </div>
    </div>
  );
}

