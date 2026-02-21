from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class MarketData:
    spot: float
    implied_vol: float
    risk_free_rate: float
    dividend_yield: float = 0.0
    timestamp: datetime = None