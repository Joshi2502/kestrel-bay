"""Stock position: sellable on-hand, commitments, and incoming purchase orders (spec §3.3-3.5)."""

from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

from .constants import (
    DAMAGED_LOCATION,
    HOLD_LOCATION,
    IMPORT_VENDORS,
    OVERDUE_ETA_DOMESTIC_DAYS,
    OVERDUE_ETA_IMPORT_DAYS,
    SELLABLE_LOCATIONS,
)


@dataclass
class Incoming:
    source: Literal["po", "dana"]
    ref: str
    qty: float
    eta: date
    vendor_said: date | None
    overdue: bool


@dataclass
class Position:
    sellable: float
    on_hold: float
    damaged: float
    by_location: dict[str, float]
    committed_by_month: dict[tuple[int, int], float] = field(default_factory=dict)
    incoming: list[Incoming] = field(default_factory=list)


def summarize_lots(lots: Iterable[tuple[str, float]]) -> Position:
    """Split (location, planning-qty) pairs into sellable / on hold / damaged."""
    by_location: dict[str, float] = defaultdict(float)
    on_hold = damaged = 0.0
    for location, qty in lots:
        if location in SELLABLE_LOCATIONS:
            by_location[location] += qty
        elif location == HOLD_LOCATION:
            on_hold += qty
        elif location == DAMAGED_LOCATION:
            damaged += qty
    return Position(
        sellable=sum(by_location.values()),
        on_hold=on_hold,
        damaged=damaged,
        by_location=dict(by_location),
    )


def committed_by_month(lines: Iterable[tuple[date, float]]) -> dict[tuple[int, int], float]:
    """Open (booked, not shipped) sales quantity by ship month."""
    totals: dict[tuple[int, int], float] = defaultdict(float)
    for ship_date, qty in lines:
        totals[(ship_date.year, ship_date.month)] += qty
    return dict(totals)


def corrected_eta(expected: date, as_of: date, vendor_code: str) -> tuple[date, bool]:
    """A PO still open past its expected date has not arrived; push its ETA out (spec §3.5)."""
    if expected >= as_of:
        return expected, False
    days = OVERDUE_ETA_IMPORT_DAYS if vendor_code in IMPORT_VENDORS else OVERDUE_ETA_DOMESTIC_DAYS
    return as_of + timedelta(days=days), True


def incoming_from_po(
    po_no: str,
    qty_ordered: float,
    qty_received: float,
    expected: date,
    vendor_code: str,
    as_of: date,
    to_planning: Callable[[float], float],
) -> Incoming | None:
    outstanding = qty_ordered - qty_received
    if outstanding <= 0:
        return None
    eta, overdue = corrected_eta(expected, as_of, vendor_code)
    return Incoming(
        "po", po_no, to_planning(outstanding), eta, expected if overdue else None, overdue
    )
