from datetime import date

import pytest

from inventory.rules.position import (
    Incoming,
    committed_by_month,
    corrected_eta,
    incoming_from_po,
    summarize_lots,
)
from tests.conftest import AS_OF


def test_overdue_import_po():
    assert corrected_eta(date(2026, 9, 14), AS_OF, "BXE") == (date(2026, 11, 30), True)


def test_overdue_domestic_po():
    assert corrected_eta(date(2026, 11, 1), AS_OF, "MNP") == (date(2026, 11, 23), True)


def test_future_po_untouched():
    assert corrected_eta(date(2026, 12, 28), AS_OF, "BXE") == (date(2026, 12, 28), False)


def test_po_expected_today_is_not_overdue():
    assert corrected_eta(AS_OF, AS_OF, "MNP") == (AS_OF, False)


def test_partial_po_outstanding():
    inc = incoming_from_po("PO-260376", 1000, 600, date(2026, 9, 14), "BXE", AS_OF, lambda q: q)
    assert inc is not None
    assert inc.qty == 400
    assert inc.overdue
    assert inc.eta == date(2026, 11, 30)
    assert inc.vendor_said == date(2026, 9, 14)
    assert inc.source == "po"


def test_fully_received_po_is_none():
    assert incoming_from_po("X", 10, 10, date(2026, 12, 1), "MNP", AS_OF, lambda q: q) is None


def test_po_quantity_goes_through_unit_converter():
    inc = incoming_from_po("P", 100, 0, date(2026, 12, 1), "MNP", AS_OF, lambda q: q / 10)
    assert inc == Incoming("po", "P", 10.0, date(2026, 12, 1), None, False)


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
