from dataclasses import dataclass, field

from ..value_objects.greeks import Greeks
from .position import Position


@dataclass
class Book:
    positions: list[Position] = field(default_factory=list)

    def add_position(self, position: Position) -> None:
        self.positions.append(position)

    def remove_position(self, index: int) -> None:
        self.positions.pop(index)

    def is_empty(self) -> bool:
        return len(self.positions) == 0

    def aggregate_greeks(self, greeks_per_position: list[Greeks]) -> Greeks:
        """Agrège les Greeks de toutes les positions du book."""
        if not greeks_per_position:
            return Greeks(0.0, 0.0, 0.0, 0.0, 0.0)
        result = greeks_per_position[0]
        for g in greeks_per_position[1:]:
            result = result + g
        return result
