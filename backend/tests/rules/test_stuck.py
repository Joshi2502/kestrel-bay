from datetime import date

from inventory.rules.stuck import LotInfo, six_month_line, stuck_rows
from tests.conftest import AS_OF


def lot(loc="NB", no="L1", qty=100.0, expiry=date(2028, 1, 1), cost=10.0, uom="CS"):
    return LotInfo(loc, no, qty, uom, qty, expiry, cost)


def rows(lots, dead=None, rate=1.0, uom="CS"):
    return stuck_rows("X", "Test item", uom, lots, dead, rate, AS_OF)


def test_six_month_line():
    assert six_month_line(AS_OF) == date(2027, 5, 16)
    assert six_month_line(date(2026, 8, 31)) == date(2027, 2, 28)


def test_lot_inside_six_months_is_expiring_but_boundary_is_not():
    r = rows([lot(no="A", expiry=date(2027, 5, 15)), lot(no="B", expiry=date(2027, 5, 16))])
    assert [(x.lot_no, x.reasons) for x in r if "expiring" in x.reasons] == [("A", ["expiring"])]


def test_past_expiry_is_expired_not_expiring():
    r = rows([lot(expiry=date(2026, 10, 20))])
    assert r[0].reasons == ["expired"]
    assert r[0].value_at_cost == 1000.0


def test_hold_and_damaged_lots_are_ignored():
    assert rows([lot(loc="QA-HOLD", expiry=date(2026, 1, 1)), lot(loc="DAMAGED")]) == []


def test_dead_item_flags_every_sellable_lot():
    r = rows([lot(loc="HCS")], dead="dead_code", rate=0.0)
    assert r[0].reasons == ["dead"] and r[0].at_hcs


def test_long_stock_makes_one_item_row_for_the_excess_only():
    r = rows([lot(qty=1000.0, expiry=date(2028, 1, 1))], rate=2.0)  # 500 days of cover
    assert len(r) == 1
    assert r[0].reasons == ["long"] and r[0].lot_no is None
    assert r[0].qty == 640  # 1000 on hand - 180 days * 2/day
    assert r[0].value_at_cost == 6400.0


def test_long_does_not_double_count_lots_already_expiring():
    expiring = lot(no="E", qty=900.0, expiry=date(2027, 2, 1))
    fine = lot(no="F", qty=100.0, expiry=date(2028, 1, 1))
    r = rows([expiring, fine], rate=2.0)  # 1000 on hand, 640 excess, 900 already flagged
    assert [x.reasons for x in r] == [["expiring"]]


def test_rows_sorted_hcs_first_then_value():
    r = rows(
        [
            lot(no="N", qty=1000.0, expiry=date(2026, 1, 1)),
            lot(loc="HCS", no="H", qty=1.0, expiry=date(2026, 1, 1)),
        ]
    )
    assert [x.lot_no for x in r] == ["H", "N"]


def test_no_demand_means_no_long_flag():
    assert rows([lot(qty=1000.0)], rate=0.0) == []
