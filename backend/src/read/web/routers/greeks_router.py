from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.read.adapters.market_data.yahoo_finance_adapter import YahooFinanceAdapter
from src.shared.domain.entities.option_contract import (
    OptionContract,
    OptionType,
    Underlying,
)
from src.write.adapters.pricing.black_scholes_adapter import BlackScholesAdapter

router = APIRouter(prefix="/greeks", tags=["Greeks"])
market_adapter = YahooFinanceAdapter()
pricer = BlackScholesAdapter()


class GreeksRequest(BaseModel):
    ticker: str
    option_type: str  # "call" or "put"
    strike: float
    maturity: date
    quantity: float = 1.0


class GreeksResponse(BaseModel):
    ticker: str
    spot: float
    option_type: str
    strike: float
    price: float
    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float


@router.post("/greeks", response_model=GreeksResponse)
def get_greeks(request: GreeksRequest):
    try:
        market_data = market_adapter.get_market_data(request.ticker.upper())

        contract = OptionContract(
            underlying=Underlying(ticker=request.ticker.upper()),
            option_type=OptionType.CALL if request.option_type == "call" else OptionType.PUT,
            strike=request.strike,
            maturity=request.maturity,
            quantity=request.quantity,
        )

        greeks = pricer.greeks(contract, market_data)
        price = pricer.price(contract, market_data)

        return GreeksResponse(
            ticker=request.ticker.upper(),
            spot=market_data.spot,
            option_type=request.option_type,
            strike=request.strike,
            price=round(price, 4),
            delta=round(greeks.delta, 4),
            gamma=round(greeks.gamma, 6),
            vega=round(greeks.vega, 4),
            theta=round(greeks.theta, 4),
            rho=round(greeks.rho, 4),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
