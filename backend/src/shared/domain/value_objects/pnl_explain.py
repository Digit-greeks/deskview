from dataclasses import dataclass


@dataclass(frozen=True)
class PnLExplain:
    delta_pnl: float
    gamma_pnl: float
    vega_pnl: float
    theta_pnl: float

    @property
    def total_pnl(self) -> float:
        return self.delta_pnl + self.gamma_pnl + self.vega_pnl + self.theta_pnl
