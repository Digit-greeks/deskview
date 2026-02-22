from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from src.read.adapters.market_data.yahoo_finance_adapter import YahooFinanceAdapter

router = APIRouter(prefix="/market-data", tags=["Market Data"])
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
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/maturities/{ticker}")
def get_maturities(ticker: str):
    try:
        maturities = adapter.get_available_maturities(ticker.upper())
        return {"ticker": ticker.upper(), "maturities": maturities}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/price-history/{ticker}")
def get_price_history(ticker: str, period: str = Query(default="3mo")):
    try:
        data = adapter.get_price_history(ticker.upper(), period=period)
        return {"ticker": ticker.upper(), "data": data, "period": period}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
