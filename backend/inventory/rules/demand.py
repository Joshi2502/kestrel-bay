"""Demand history, stockout correction and seasonal forecast (design spec §3.6-3.7)."""

import calendar
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta

from .constants import DORMANT_DAYS, LEVEL_CLAMP, LEVEL_WINDOW_DAYS, STOCKOUT_MIN_GAP_DAYS


@dataclass
class MonthDemand:
    year: int
    month: int
    actual: float
    corrected: float
    stockout_days: int
    partial: bool


def daily_series(lines: Iterable[tuple[date, float]]) -> dict[date, float]:
    daily: dict[date, float] = defaultdict(float)
    for day, qty in lines:
        daily[day] += qty
    return dict(daily)


def _days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _sells_most_weeks(sale_days: list[date], start: date, end: date) -> bool:
    total_weeks = (end - start).days // 7 + 1
    weeks_with_sales = {(day - start).days // 7 for day in sale_days if start <= day <= end}
    return len(weeks_with_sales) * 2 >= total_weeks


def detect_stockouts(
    daily: dict[date, float], start: date, end: date, min_gap: int = STOCKOUT_MIN_GAP_DAYS
) -> list[tuple[date, date]]:
    """Runs of >= min_gap silent days *between* two sale days, for items that sell most weeks.

    A silence at the end of the window is dormancy, not a stockout, so it is not reported.
    """
    sale_days = sorted(day for day, qty in daily.items() if start <= day <= end and qty > 0)
    if not sale_days or not _sells_most_weeks(sale_days, start, end):
        return []
    gaps = []
    for before, after in zip(sale_days, sale_days[1:], strict=False):
        silent = (after - before).days - 1
        if silent >= min_gap:
            gaps.append((before + timedelta(days=1), after - timedelta(days=1)))
    return gaps


def monthly_history(
    daily: dict[date, float],
    start: date,
    end: date,
    stockouts: list[tuple[date, date]],
) -> list[MonthDemand]:
    history: list[MonthDemand] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        days = _days_in_month(year, month)
        first, last = date(year, month, 1), date(year, month, days)
        partial = first < start or last > end
        actual = sum(
            qty for day, qty in daily.items() if first <= day <= last and start <= day <= end
        )
        out_days = 0
        for gap_start, gap_end in stockouts:
            lo, hi = max(gap_start, first), min(gap_end, last)
            if lo <= hi:
                out_days += (hi - lo).days + 1
        in_stock_days = days - out_days
        if out_days and not partial and in_stock_days > 0:
            corrected = actual / in_stock_days * days
        else:
            corrected = actual
        history.append(MonthDemand(year, month, actual, corrected, out_days, partial))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return history


def level_factor(daily: dict[date, float], as_of: date) -> float:
    """Recent pace vs the same weeks last year, clamped. 1.0 when last year isn't fully covered."""
    recent_start = as_of - timedelta(days=LEVEL_WINDOW_DAYS)
    prior_start = recent_start - timedelta(days=365)
    if not daily or min(daily) > prior_start:
        return 1.0
    recent = sum(qty for day, qty in daily.items() if recent_start <= day < as_of)
    prior_end = prior_start + timedelta(days=LEVEL_WINDOW_DAYS)
    prior = sum(qty for day, qty in daily.items() if prior_start <= day < prior_end)
    if prior <= 0:
        return 1.0
    low, high = LEVEL_CLAMP
    return max(low, min(high, recent / prior))


def forecast_month(history: list[MonthDemand], year: int, month: int, level: float) -> float:
    """Same calendar month last year (stockout-corrected) x level; else the average daily rate."""
    for entry in history:
        if (entry.year, entry.month) == (year - 1, month) and not entry.partial:
            return entry.corrected * level
    full = [m for m in history if not m.partial]
    if not full:
        return 0.0
    mean_rate = sum(m.corrected / _days_in_month(m.year, m.month) for m in full) / len(full)
    return mean_rate * _days_in_month(year, month) * level


def is_dormant(daily: dict[date, float], as_of: date) -> bool:
    cutoff = as_of - timedelta(days=DORMANT_DAYS)
    return not any(day >= cutoff and qty > 0 for day, qty in daily.items())
