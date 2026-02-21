from dataclasses import dataclass
from datetime import date
from enum import Enum


class OptionType(Enum):
    CALL = "call"
    PUT = "put"


@dataclass(frozen=True)
class Underlying:
    ticker: str
    currency: str = "USD"


@dataclass(frozen=True)
class OptionContract:
    underlying: Underlying
    option_type: OptionType
    strike: float
    maturity: date
    quantity: float  # positif = long, négatif = short

    def is_call(self) -> bool:
        return self.option_type == OptionType.CALL

    def is_long(self) -> bool:
        return self.quantity > 0