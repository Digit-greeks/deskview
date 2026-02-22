from fastapi import APIRouter, HTTPException, Query
from src.read.adapters.market_data.yahoo_finance_adapter import YahooFinanceAdapter
from pydantic import BaseModel
import yfinance as yf

router = APIRouter(prefix="/api", tags=["market-data"])
adapter = YahooFinanceAdapter()


class MarketDataResponse(BaseModel):
    ticker: str
    spot: float
    implied_vol: float
    risk_free_rate: float
    dividend_yield: float


@router.get("/market-data/{ticker}", response_model=MarketDataResponse)
def get_market_data(ticker: str):
    try:
        data = adapter.get_market_data(ticker.upper())
        return MarketDataResponse(
            ticker=ticker.upper(),
            spot=data.spot,
            implied_vol=data.implied_vol,
            risk_free_rate=data.risk_free_rate,
            dividend_yield=data.dividend_yield,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/maturities/{ticker}")
def get_maturities(ticker: str):
    try:
        maturities = adapter.get_available_maturities(ticker.upper())
        return {"ticker": ticker.upper(), "maturities": maturities}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/price-history/{ticker}")
def get_price_history(ticker: str, period: str = Query(default="3mo")):
    try:
        stock = yf.Ticker(ticker.upper())
        hist = stock.history(period=period)
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No price history for {ticker}")
        
        # Filter out NaN values and convert to list
        data = []
        for idx, row in hist.iterrows():
            close = float(row["Close"])
            if not (close != close):  # Check if NaN (NaN != NaN is True)
                data.append({"date": idx.strftime("%Y-%m-%d"), "close": round(close, 2)})
        
        if not data:
            raise HTTPException(status_code=404, detail=f"No valid price data for {ticker}")
        
        return {"ticker": ticker.upper(), "data": data, "period": period}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))