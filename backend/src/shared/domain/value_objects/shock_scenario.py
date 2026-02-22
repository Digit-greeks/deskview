from dataclasses import dataclass


@dataclass(frozen=True)
class ShockScenario:
    spot_shock: float = 0.0  # ex: -0.05 = -5% sur le spot
    vol_shock: float = 0.0  # ex: +0.03 = +3 points de vol
    rate_shock: float = 0.0  # ex: +0.0025 = +25 bps
    time_decay_days: float = 0.0  # avancer dans le temps de N jours
