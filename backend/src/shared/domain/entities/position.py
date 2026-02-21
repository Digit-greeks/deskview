from dataclasses import dataclass
from .option_contract import OptionContract


@dataclass(frozen=True)
class Position:
    contract: OptionContract
    entry_price: float  # Prix auquel la position a été ouverte

    @property
    def is_long(self) -> bool:
        return self.contract.quantity > 0

    @property
    def notional(self) -> float:
        return abs(self.contract.quantity) * self.entry_price