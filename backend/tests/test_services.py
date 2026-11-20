from datetime import date

from inventory.models import HandledFlag
from inventory.services import build_dashboard, build_item_detail
from tests.conftest import AS_OF


def codes(rows):
    return [r["code"] for r in rows]


def test_shr1620_is_order_now(loaded):
    row = next(r for r in build_dashboard(AS_OF)["order_now"] if r["code"] == "SHR-1620")
    assert row["sellable"] == 480
    assert row["on_hold"] == 80
    assert row["days_late"] > 0
    assert row["suggested_qty"] > 0


def test_every_planned_item_lands_in_exactly_one_group(loaded):
    d = build_dashboard(AS_OF)
    total = len(d["order_now"]) + len(d["watch"]) + len(d["handled"]) + d["ok_count"]
    assert total == 30  # 45 items - 6 fresh - 6 old-system ZZ - 3 dormant


def test_fresh_and_dead_items_never_get_a_verdict(loaded):
    d = build_dashboard(AS_OF)
    for group in ("order_now", "watch", "handled"):
        assert not any(c.startswith(("FR-", "ZZ-")) for c in codes(d[group]))


def test_handled_moves_item(loaded):
    HandledFlag.objects.create(
        item_id="SHR-1620", note="phoned Tue", expires_on=date(2026, 11, 30), active=True
    )
    d = build_dashboard(AS_OF)
    assert "SHR-1620" in codes(d["handled"]) and "SHR-1620" not in codes(d["order_now"])
    assert next(r for r in d["handled"] if r["code"] == "SHR-1620")["handled_note"] == "phoned Tue"


def test_expired_handled_flag_ignored(loaded):
    HandledFlag.objects.create(
        item_id="SHR-1620", note="old", expires_on=date(2026, 11, 10), active=True
    )
    assert "SHR-1620" in codes(build_dashboard(AS_OF)["order_now"])


def test_inactive_handled_flag_ignored(loaded):
    HandledFlag.objects.create(
        item_id="SHR-1620", note="undone", expires_on=date(2026, 12, 30), active=False
    )
    assert "SHR-1620" in codes(build_dashboard(AS_OF)["order_now"])


def test_danas_phoned_in_order_counts_as_incoming(loaded):
    HandledFlag.objects.create(
        item_id="SHR-1620",
        note="phoned",
        qty=1000,
        expected_date=date(2026, 12, 20),
        expires_on=date(2026, 12, 30),
        active=True,
    )
    incoming = build_item_detail("SHR-1620", AS_OF)["incoming"]
    assert any(i["source"] == "dana" and i["qty"] == 1000 for i in incoming)


def test_item_detail_explains(loaded):
    d = build_item_detail("SHR-1620", AS_OF)
    assert d["on_hold"] == 80
    assert any("480" in s for s in d["math"])
    assert d["lots"] and {lot["status"] for lot in d["lots"]} >= {"sellable", "hold"}
    assert d["history"] and d["projection"]


def test_overdue_po_shown(loaded):
    incoming = build_item_detail("PAN-0709", AS_OF)["incoming"][0]
    assert incoming["overdue"] is True
    assert incoming["qty"] == 400
    assert incoming["eta"] == "2026-11-30"
    assert incoming["vendor_said"] == "2026-09-14"


def test_stuck_rows(loaded):
    stuck = build_dashboard(AS_OF)["stuck"]
    assert stuck[0]["at_hcs"]
    assert not any(r["code"].startswith("FR-") for r in stuck)
    assert not any(r["location"] in ("QA-HOLD", "DAMAGED") for r in stuck)
    by_lot = {r["lot_no"]: r for r in stuck if r["lot_no"]}
    assert "expired" in by_lot["L250303-01"]["reasons"] and by_lot["L250303-01"]["at_hcs"]
    assert "expired" in by_lot["L241202-01"]["reasons"]
    for lot_no in ("L260706-01", "L260706-02", "L260817-01"):
        assert "expiring" in by_lot[lot_no]["reasons"], lot_no
    dead = {r["code"] for r in stuck if "dead" in r["reasons"]}
    assert {"ZZ-SHR-0001", "TIL-FIL", "SHR-6170"} <= dead


def test_stuck_total_is_sum_of_rows(loaded):
    d = build_dashboard(AS_OF)
    assert abs(d["stuck_total_value"] - sum(r["value_at_cost"] for r in d["stuck"])) < 0.01


def test_data_notes_include_overdue_pos_and_merges(loaded):
    notes = {n["kind"]: n["count"] for n in build_dashboard(AS_OF)["data_notes"]}
    assert notes["merged_codes"] == 3
    assert notes["overdue_pos"] == 3
