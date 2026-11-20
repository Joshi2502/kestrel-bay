"""Stuck stock: lots nobody will take soon, over-long cover, and dead items (spec §3.10)."""

import calendar
from dataclasses import dataclass
from datetime import date

from .constants import LONG_COVER_DAYS, SELLABLE_LOCATIONS, SHELF_LINE_MONTHS


@dataclass
class LotInfo:
    location: str
    lot_no: str
    qty: float  # as stored, in `uom`
    uom: str
    qty_planning: float | None
    expiry_date: date | None
    unit_cost: float | None  # per `uom`


@dataclass
class StuckRow:
    item_code: str
    description: str
    location: str | None
    lot_no: str | None
    qty: float
    uom: str
    value_at_cost: float
    reasons: list[str]
    expiry_date: date | None
    at_hcs: bool
    detail: str


def six_month_line(as_of: date) -> date:
    month_index = as_of.month - 1 + SHELF_LINE_MONTHS
    year, month = as_of.year + month_index // 12, month_index % 12 + 1
    return date(year, month, min(as_of.day, calendar.monthrange(year, month)[1]))


def _value(qty: float, unit_cost: float | None) -> float:
    return round(qty * unit_cost, 2) if unit_cost else 0.0


DEAD_DETAIL = {
    "dead_code": "Old-system item (ZZ code): it can't be ordered or sold",
    "discontinued": "Marked discontinued but still in the building",
    "dormant": "Active item with no real sales in the last 4 months",
}


def stuck_rows(
    item_code: str,
    description: str,
    planning_uom: str,
    lots: list[LotInfo],
    dead_reason: str | None,
    daily_rate: float,
    as_of: date,
) -> list[StuckRow]:
    """Stuck rows for one item. Only sellable-location lots with stock count; a lot appears at
    most once (dead / expired / expiring), and 'long' covers only the remaining excess."""
    line = six_month_line(as_of)
    sellable = [
        lot
        for lot in lots
        if lot.location in SELLABLE_LOCATIONS and lot.qty > 0 and (lot.qty_planning or 0) > 0
    ]
    rows: list[StuckRow] = []
    flagged_planning_qty = 0.0

    for lot in sellable:
        reasons: list[str] = []
        detail = ""
        if dead_reason:
            reasons.append("dead")
            detail = DEAD_DETAIL[dead_reason]
        if lot.expiry_date and lot.expiry_date < as_of:
            reasons.append("expired")
            detail = detail or f"Expired {lot.expiry_date:%b %-d, %Y}"
        elif lot.expiry_date and lot.expiry_date < line:
            reasons.append("expiring")
            detail = detail or f"Expires {lot.expiry_date:%b %-d, %Y} — inside the 6-month line"
        if not reasons:
            continue
        flagged_planning_qty += lot.qty_planning or 0
        rows.append(
            StuckRow(
                item_code,
                description,
                lot.location,
                lot.lot_no,
                lot.qty,
                lot.uom,
                _value(lot.qty, lot.unit_cost),
                reasons,
                lot.expiry_date,
                lot.location == "HCS",
                detail,
            )
        )

    if not dead_reason and daily_rate > 0 and sellable:
        total = sum(lot.qty_planning or 0 for lot in sellable)
        excess = total - daily_rate * LONG_COVER_DAYS - flagged_planning_qty
        if excess > 0:
            costed = [lot for lot in sellable if lot.unit_cost]
            cost_qty = sum(lot.qty_planning or 0 for lot in costed)
            avg_cost = (
                sum(lot.qty * (lot.unit_cost or 0) for lot in costed) / cost_qty if cost_qty else 0
            )
            hcs = any(lot.location == "HCS" for lot in sellable)
            days = round(total / daily_rate)
            rows.append(
                StuckRow(
                    item_code,
                    description,
                    None,
                    None,
                    round(excess, 1),
                    planning_uom,
                    _value(excess, avg_cost),
                    ["long"],
                    None,
                    hcs,
                    f"About {days} days of stock at the expected pace — more than "
                    f"{LONG_COVER_DAYS} days is sitting",
                )
            )

    rows.sort(key=lambda r: (not r.at_hcs, -r.value_at_cost))
    return rows
