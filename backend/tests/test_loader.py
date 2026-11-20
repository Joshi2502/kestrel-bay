from collections import Counter
from datetime import date

import pytest

from inventory.loader import load_all
from inventory.models import HandledFlag, InventoryLot, Item, PurchaseOrderLine, SalesLine, Vendor
from tests.conftest import AS_OF, DATA_DIR


def sellable(code):
    lots = InventoryLot.objects.filter(item_id=code, location__in=["NB", "PVD", "HCS"])
    return sum(lot.qty_planning for lot in lots)


def test_duplicate_codes_merged(loaded):
    assert not Item.objects.filter(code__in=["shr-1620 ", "Sal-Por6", "COD-LOIN "]).exists()
    assert sellable("SHR-1620") == 480


def test_mixed_units_converted(loaded):
    assert sellable("CAL-RING") == pytest.approx(353)
    assert sellable("LOB-T56") == pytest.approx(83)


def test_adjustments_net_and_latest_snapshot_only(loaded):
    assert sellable("COD-FIL") == 206
    assert set(InventoryLot.objects.values_list("snapshot_date", flat=True)) == {date(2026, 11, 15)}
    assert InventoryLot.objects.filter(is_adjustment=True).count() == 3


def test_zero_quantity_lots_skipped(loaded):
    assert not InventoryLot.objects.filter(qty=0).exists()


def test_scope(loaded):
    assert not Item.objects.get(code="ZZ-SCL-0002").in_scope
    assert Item.objects.get(code="ZZ-SCL-0002").scope_reason == "dead_code"
    assert not Item.objects.get(code="FR-COD").in_scope
    assert Item.objects.get(code="FR-COD").scope_reason == "fresh"
    assert Item.objects.get(code="SHR-1620").in_scope


def test_po_dedupe_and_open(loaded):
    assert PurchaseOrderLine.objects.filter(status="Open").count() == 14
    assert PurchaseOrderLine.objects.filter(po_no="PO-260439").count() == 1


def test_sales_classification(loaded):
    reasons = Counter(SalesLine.objects.values_list("exclusion_reason", flat=True))
    assert reasons["cancelled"] == 294
    assert reasons["credit"] == 76
    assert reasons["sample"] == 104
    assert reasons["transfer"] == 378
    assert reasons["one_off"] == 2
    assert SalesLine.objects.filter(status="OPEN").count() == 180


def test_mixed_dates_parsed(loaded):
    line = SalesLine.objects.filter(order_no="SO-242785").first()
    assert line.order_date == date(2026, 1, 4)
    assert line.ship_date == date(2026, 1, 6)


def test_vendor_seeds(loaded):
    bxe = Vendor.objects.get(code="BXE")
    assert (bxe.lead_time_days, bxe.safety_days, bxe.lead_time_days_system) == (84, 14, 56)
    assert Vendor.objects.get(code="AFS").lead_time_days == 42
    assert Vendor.objects.get(code="DLC").lead_time_days == 21
    assert not Vendor.objects.get(code="HCS").is_supplier


def test_reload_is_idempotent_and_keeps_handled(loaded):
    HandledFlag.objects.create(
        item_id="SHR-1620", note="phoned", expires_on=date(2026, 11, 30), active=True
    )
    again = load_all(DATA_DIR, AS_OF)
    assert InventoryLot.objects.count() == loaded.counts["inventory_lots"]
    assert again.counts == loaded.counts
    assert HandledFlag.objects.count() == 1
