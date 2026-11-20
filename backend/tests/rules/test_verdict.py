from datetime import date, timedelta

import pytest

from inventory.rules.position import Incoming
from inventory.rules.verdict import compute_verdict, daily_consumption
from tests.conftest import AS_OF


def steady(per_day: float, days: int = 400) -> dict[date, float]:
    return {AS_OF + timedelta(days=d): per_day for d in range(days)}


def verdict(sellable, cons, lead=84, safety=14, incoming=(), handled=False, uom="CS"):
    return compute_verdict(sellable, list(incoming), cons, AS_OF, lead, safety, handled, uom)


def test_runs_out_before_lead_time_is_order_now_and_late():
    v = verdict(100, steady(10))
    assert v.run_out_date == AS_OF + timedelta(10)
    assert v.status == "order_now"
    assert v.order_by_date == AS_OF + timedelta(10 - 84)
    assert v.earliest_arrival == AS_OF + timedelta(84)
    assert v.days_late == 74


def test_incoming_po_delays_runout():
    po = Incoming("po", "P", 500, AS_OF + timedelta(5), None, False)
    v = verdict(100, steady(10), lead=14, safety=7, incoming=[po])
    assert v.run_out_date == AS_OF + timedelta(60)


def test_watch_window():
    v = verdict(400, steady(10), lead=14, safety=7)  # runs out +40 -> order by +26
    assert v.run_out_date == AS_OF + timedelta(40)
    assert v.status == "watch"
    assert v.days_late == 0


def test_ok_when_stock_outlasts_horizon():
    v = verdict(1_000_000, steady(10), lead=14, safety=7)
    assert v.run_out_date is None
    assert v.order_by_date is None
    assert v.status == "ok"


def test_order_now_boundary_is_seven_days():
    v = verdict(300, steady(10), lead=14, safety=7)  # runs out +30 -> order by +16 (watch)
    assert v.status == "watch"
    v = verdict(210, steady(10), lead=14, safety=7)  # runs out +21 -> order by +7 (order now)
    assert v.status == "order_now"


def test_handled_overrides_an_urgent_item():
    assert verdict(100, steady(10), handled=True).status == "handled"


def test_handled_does_not_hide_an_item_that_is_fine():
    assert verdict(1_000_000, steady(10), lead=14, safety=7, handled=True).status == "ok"


def test_committed_not_double_counted():
    cons = daily_consumption(
        AS_OF, date(2026, 12, 31), {(2026, 11): 300, (2026, 12): 300}, {(2026, 12): 500}
    )
    assert sum(v for d, v in cons.items() if d.month == 12) == pytest.approx(500)
    assert sum(v for d, v in cons.items() if d.month == 11) == pytest.approx(300 * 15 / 30)


def test_committed_larger_than_forecast_in_current_month_wins():
    cons = daily_consumption(AS_OF, date(2026, 11, 30), {(2026, 11): 100}, {(2026, 11): 90})
    assert sum(cons.values()) == pytest.approx(90)  # 100 * 15/30 = 50 < 90 booked


def test_suggested_qty_covers_buffer_window_and_rounds_up_cases():
    v = verdict(100, steady(10), lead=14, safety=7)
    assert v.suggested_qty == 400  # 35 days * 10 consumption + 50 short at arrival
    v = verdict(0, steady(2.55), lead=14, safety=7)
    assert v.suggested_qty == 128  # 127.5 -> whole cases
    v = verdict(0, steady(2.55), lead=14, safety=7, uom="LB")
    assert v.suggested_qty == 127.5


def test_no_suggestion_when_well_stocked():
    assert verdict(1000, steady(10), lead=14, safety=7).suggested_qty == 0


def test_projection_series_starts_today():
    v = verdict(100, steady(10), lead=14, safety=7)
    assert v.projection[0] == (AS_OF, 90.0)
