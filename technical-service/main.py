from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from analyzer import analyze, scan

app = FastAPI(title="Axiom Technical Analysis Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_WATCHLIST = ["NVDA","AAPL","MSFT","TSLA","AMZN","META","GOOGL","AMD","AVGO","PLTR"]


@app.get("/analyze/{ticker}")
def get_analysis(ticker: str, period: str = "6mo"):
    try:
        return analyze(ticker.upper(), period)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/scan")
def get_scan(tickers: str = ",".join(DEFAULT_WATCHLIST), period: str = "6mo"):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    return scan(ticker_list, period)


@app.get("/health")
def health():
    return {"status": "ok"}