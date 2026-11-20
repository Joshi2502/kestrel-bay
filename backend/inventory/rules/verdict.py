"""Run-out verdict: when stock runs out, when to order by, and how much (spec §3.9)."""

import calendar
import math
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from .constants import COVER_WINDOW_DAYS, ORDER_NOW_WINDOW_DAYS, WATCH_WINDOW_DAYS
from .position import Incoming

Status = Literal["order_now", "watch", "ok", "handled"]
EXTRA_HORIZON_DAYS = 30


@dataclass
class Verdict:
    status: Status
    run_out_date: date | None
    order_by_date: date | None
    earliest_arrival: date
    days_late: int
    suggested_qty: float
    projection: list[tuple[date, float]]


def daily_consumption(
    as_of: date,
    horizon_end: date,
    forecast_by_month: dict[tuple[int, int], float],
    committed_by_month: dict[tuple[int, int], float],
) -> dict[date, float]:
    """Expected units shipped per day. Booked orders are part of the month's demand, so each
    month uses max(forecast, booked) rather than forecast + booked (spec §3.4)."""
    out: dict[date, float] = {}
    cursor = as_of
    while cursor <= horizon_end:
        year, month = cursor.year, cursor.month
        days_in_month = calendar.monthrange(year, month)[1]
        month_end = date(year, month, days_in_month)
        remaining = (month_end - cursor).days + 1
        forecast_part = forecast_by_month.get((year, month), 0.0) * remaining / days_in_month
        total = max(forecast_part, committed_by_month.get((year, month), 0.0))
        per_day = total / remaining
        last = min(month_end, horizon_end)
        for offset in range((last - cursor).days + 1):
            out[cursor + timedelta(days=offset)] = per_day
        cursor = month_end + timedelta(days=1)
    return out


def _round_up(qty: float, planning_uom: str) -> float:
    if qty <= 0:
        return 0
    if planning_uom == "LB":
        return math.ceil(qty * 10 - 1e-9) / 10
    return math.ceil(qty - 1e-9)


def compute_verdict(
    sellable: float,
    incoming: list[Incoming],
    consumption: dict[date, float],
    as_of: date,
    lead_days: int,
    safety_days: int,
    handled: bool,
    planning_uom: str,
) -> Verdict:
    horizon_days = lead_days + safety_days + COVER_WINDOW_DAYS + EXTRA_HORIZON_DAYS
    arrivals: dict[date, float] = {}
    for entry in incoming:
        arrivals[entry.eta] = arrivals.get(entry.eta, 0.0) + entry.qty

    projection: list[tuple[date, float]] = []
    position = sellable
    for offset in range(horizon_days + 1):
        day = as_of + timedelta(days=offset)
        position += arrivals.get(day, 0.0) - consumption.get(day, 0.0)
        projection.append((day, position))

    run_out = next((day for day, qty in projection if qty < 0), None)
    earliest_arrival = as_of + timedelta(days=lead_days)
    order_by = run_out - timedelta(days=lead_days) if run_out else None
    days_late = max(0, (earliest_arrival - run_out).days) if run_out else 0

    if order_by is None:
        status: Status = "ok"
    elif order_by <= as_of + timedelta(days=ORDER_NOW_WINDOW_DAYS):
        status = "order_now"
    elif order_by <= as_of + timedelta(days=WATCH_WINDOW_DAYS):
        status = "watch"
    else:
        status = "ok"
    if handled and status != "ok":
        status = "handled"

    at_arrival = projection[lead_days][1]
    window_end = earliest_arrival + timedelta(days=safety_days + COVER_WINDOW_DAYS)
    needed = sum(
        consumption.get(earliest_arrival + timedelta(days=i), 0.0)
        for i in range((window_end - earliest_arrival).days)
    )
    suggested = _round_up(needed - at_arrival, planning_uom)

    return Verdict(status, run_out, order_by, earliest_arrival, days_late, suggested, projection)
