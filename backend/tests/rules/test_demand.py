from datetime import date, timedelta

import pytest
from django.db.models import Min

from inventory.models import Item, SalesLine
from inventory.rules.demand import (
    MonthDemand,
    daily_series,
    detect_stockouts,
    forecast_month,
    is_dormant,
    level_factor,
    monthly_history,
)
from tests.conftest import AS_OF


def test_daily_series_sums_same_day():
    d = daily_series([(date(2026, 1, 1), 2.0), (date(2026, 1, 1), 3.0), (date(2026, 1, 2), 1.0)])
    assert d == {date(2026, 1, 1): 5.0, date(2026, 1, 2): 1.0}


def test_stockout_detected_and_corrected():
    d = {date(2025, 12, 1) + timedelta(days=i): 15.7 for i in range(10)}  # Dec 1-10
    d[date(2026, 1, 3)] = 17.0
    gaps = detect_stockouts(d, date(2025, 12, 1), date(2026, 1, 3))
    assert gaps == [(date(2025, 12, 11), date(2026, 1, 2))]
    history = monthly_history(d, date(2025, 12, 1), date(2026, 1, 3), gaps)
    dec = next(m for m in history if m.month == 12)
    assert dec.stockout_days == 21
    assert dec.corrected == pytest.approx(157 / 10 * 31)
    assert dec.actual == pytest.approx(157)
    assert not dec.partial


def test_slow_items_are_not_flagged_as_stockouts():
    d = {date(2026, 1, 1): 5.0, date(2026, 3, 1): 5.0, date(2026, 5, 1): 5.0}
    assert detect_stockouts(d, date(2026, 1, 1), date(2026, 5, 31)) == []


def test_trailing_silence_is_not_a_stockout():
    d = {date(2026, 1, 1) + timedelta(days=i): 4.0 for i in range(60)}
    assert detect_stockouts(d, date(2026, 1, 1), date(2026, 6, 30)) == []


def test_partial_months_flagged_and_not_extrapolated():
    d = {date(2025, 10, 29): 3.0, date(2025, 10, 30): 4.0}
    history = monthly_history(d, date(2025, 10, 29), date(2025, 11, 15), [])
    assert [(m.year, m.month, m.partial) for m in history] == [(2025, 10, True), (2025, 11, True)]
    assert history[0].corrected == history[0].actual == 7.0


def test_level_factor_clamped():
    prior_start = AS_OF - timedelta(days=56 + 365)
    d = {prior_start + timedelta(days=i): 100.0 for i in range(56)}  # same 8 weeks last year
    d |= {AS_OF - timedelta(days=56) + timedelta(days=i): 200.0 for i in range(56)}
    assert level_factor(d, AS_OF) == pytest.approx(1.3)
    d2 = {k: (50.0 if k >= AS_OF - timedelta(days=56) else 100.0) for k in d}
    assert level_factor(d2, AS_OF) == pytest.approx(0.7)


def test_level_factor_is_one_without_a_full_prior_window():
    d = {date(2025, 10, 29) + timedelta(days=i): 10.0 for i in range(383)}
    assert level_factor(d, AS_OF) == 1.0


def test_forecast_uses_same_month_last_year():
    history = [MonthDemand(2025, 12, 150.0, 486.7, 21, False)]
    assert forecast_month(history, 2026, 12, 1.0) == pytest.approx(486.7)
    assert forecast_month(history, 2026, 12, 1.2) == pytest.approx(486.7 * 1.2)


def test_forecast_falls_back_to_average_rate_when_prior_month_missing():
    history = [
        MonthDemand(2025, 11, 300.0, 300.0, 0, False),
        MonthDemand(2025, 12, 310.0, 310.0, 0, False),
    ]
    expected = (300 / 30 + 310 / 31) / 2 * 31
    assert forecast_month(history, 2026, 8, 1.0) == pytest.approx(expected)


def test_dormant():
    recent = {AS_OF - timedelta(days=5): 3.0}
    old = {AS_OF - timedelta(days=200): 3.0}
    assert not is_dormant(recent, AS_OF)
    assert is_dormant(old, AS_OF)
    assert is_dormant({}, AS_OF)


def _clean_daily(code):
    rows = SalesLine.objects.filter(
        item_id=code, is_clean_demand=True, ship_date__lt=AS_OF
    ).values_list("ship_date", "qty")
    return daily_series(rows)


def _history(code):
    start = SalesLine.objects.aggregate(first=Min("order_date"))["first"]
    daily = _clean_daily(code)
    end = AS_OF - timedelta(days=1)
    return daily, monthly_history(daily, start, end, detect_stockouts(daily, start, end)), start


def test_real_shr1620_december_is_stockout_corrected(loaded):
    daily, history, start = _history("SHR-1620")
    gaps = detect_stockouts(daily, start, AS_OF - timedelta(days=1))
    assert any(a.month == 12 and (b - a).days >= 15 for a, b in gaps)
    dec_2025 = next(m for m in history if (m.year, m.month) == (2025, 12))
    assert dec_2025.actual < 250 < dec_2025.corrected  # censored sales vs corrected demand
    forecast = forecast_month(history, 2026, 12, level_factor(daily, AS_OF))
    assert 450 <= forecast <= 650


def test_real_lent_lift(loaded):
    daily, history, _ = _history("COD-LOIN")
    level = level_factor(daily, AS_OF)
    assert forecast_month(history, 2027, 3, level) >= 1.8 * forecast_month(history, 2027, 1, level)


def test_real_dormant_items(loaded):
    for code in ("PAN-1012", "SHR-6170", "TIL-FIL"):
        assert is_dormant(_clean_daily(code), AS_OF), code
    assert not is_dormant(_clean_daily("SHR-1620"), AS_OF)


def test_real_only_shr1620_has_a_stockout(loaded):
    start = SalesLine.objects.aggregate(first=Min("order_date"))["first"]
    flagged = []
    for item in Item.objects.filter(in_scope=True):
        daily = _clean_daily(item.code)
        if detect_stockouts(daily, start, AS_OF - timedelta(days=1)):
            flagged.append(item.code)
    assert flagged == ["SHR-1620"]
