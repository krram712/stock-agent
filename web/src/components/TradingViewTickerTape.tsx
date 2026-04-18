import { useEffect, useRef } from 'react';

export default function TradingViewTickerTape() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'NASDAQ:AAPL',  title: 'Apple' },
        { proName: 'NASDAQ:NVDA',  title: 'NVIDIA' },
        { proName: 'NASDAQ:MSFT',  title: 'Microsoft' },
        { proName: 'NASDAQ:TSLA',  title: 'Tesla' },
        { proName: 'NASDAQ:AMZN',  title: 'Amazon' },
        { proName: 'NASDAQ:META',  title: 'Meta' },
        { proName: 'NASDAQ:GOOGL', title: 'Alphabet' },
        { proName: 'NYSE:JPM',     title: 'JPMorgan' },
        { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
        { proName: 'FOREXCOM:NSXUSD', title: 'NASDAQ 100' },
        { proName: 'BITSTAMP:BTCUSD', title: 'Bitcoin' },
        { proName: 'BITSTAMP:ETHUSD', title: 'Ethereum' },
      ],
      showSymbolLogo: true,
      colorTheme: 'dark',
      isTransparent: true,
      displayMode: 'adaptive',
      locale: 'en',
    });

    containerRef.current.appendChild(script);
  }, []);

  return (
    <div style={{
      borderBottom: '1px solid rgba(0,255,136,0.08)',
      background: 'rgba(0,0,0,0.4)',
      overflow: 'hidden',
    }}>
      <div className="tradingview-widget-container" ref={containerRef} style={{ height: 46 }}>
        <div className="tradingview-widget-container__widget" />
      </div>
    </div>
  );
}

