from datetime import date

import pytest

from inventory.rules.position import (
    Incoming,
    LateIncoming,
    committed_by_month,
    incoming_from_po,
    late_from_po,
    summarize_lots,
)
from tests.conftest import AS_OF


def test_overdue_po_has_no_assumed_arrival_date():
    late = late_from_po("PO-260376", 1000, 600, date(2026, 9, 14), AS_OF, lambda q: q)
    assert late == LateIncoming("PO-260376", 400, date(2026, 9, 14))


def test_overdue_po_is_not_counted_as_dated_incoming():
    assert incoming_from_po("P", 10, 0, date(2026, 9, 14), AS_OF, lambda q: q) is None


def test_po_expected_today_is_not_overdue():
    assert late_from_po("P", 10, 0, AS_OF, AS_OF, lambda q: q) is None
    assert incoming_from_po("P", 10, 0, AS_OF, AS_OF, lambda q: q) is not None


def test_future_po_is_dated_incoming():
    inc = incoming_from_po("PO-1", 1000, 600, date(2026, 12, 28), AS_OF, lambda q: q)
    assert inc is not None
    assert inc.qty == 400
    assert inc.eta == date(2026, 12, 28)
    assert inc.source == "po"
    assert late_from_po("PO-1", 1000, 600, date(2026, 12, 28), AS_OF, lambda q: q) is None


def test_fully_received_po_is_none():
    assert incoming_from_po("X", 10, 10, date(2026, 12, 1), AS_OF, lambda q: q) is None
    assert late_from_po("X", 10, 10, date(2026, 9, 1), AS_OF, lambda q: q) is None


def test_po_quantity_goes_through_unit_converter():
    inc = incoming_from_po("P", 100, 0, date(2026, 12, 1), AS_OF, lambda q: q / 10)
    assert inc == Incoming("po", "P", 10.0, date(2026, 12, 1))


def test_summarize_lots_splits_sellable_hold_damaged():
    lots = [("NB", 100.0), ("PVD", 20.0), ("HCS", 5.0), ("QA-HOLD", 80.0), ("DAMAGED", 4.0)]
    summary = summarize_lots(lots)
    assert summary.sellable == 125
    assert summary.on_hold == 80
    assert summary.damaged == 4
    assert summary.by_location == {"NB": 100.0, "PVD": 20.0, "HCS": 5.0}


def test_summarize_lots_nets_negative_adjustments():
    assert summarize_lots([("NB", 154.0), ("NB", -2.0)]).sellable == pytest.approx(152)


def test_committed_by_month():
    lines = [(date(2026, 11, 20), 5.0), (date(2026, 11, 30), 3.0), (date(2026, 12, 2), 4.0)]
    assert committed_by_month(lines) == {(2026, 11): 8.0, (2026, 12): 4.0}
