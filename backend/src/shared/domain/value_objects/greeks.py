from dataclasses import dataclass


@dataclass(frozen=True)
class Greeks:
    delta: float
    gamma: float
    vega: float
    theta: float
    rho: float

    def scale(self, quantity: float) -> "Greeks":
        """Scale Greeks by position quantity."""
        return Greeks(
            delta=self.delta * quantity,
            gamma=self.gamma * quantity,
            vega=self.vega * quantity,
            theta=self.theta * quantity,
            rho=self.rho * quantity,
        )

    def __add__(self, other: "Greeks") -> "Greeks":
        """Aggregate Greeks across positions."""
        return Greeks(
            delta=self.delta + other.delta,
            gamma=self.gamma + other.gamma,
            vega=self.vega + other.vega,
            theta=self.theta + other.theta,
            rho=self.rho + other.rho,
        )
