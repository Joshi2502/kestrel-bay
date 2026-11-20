"""One-time load of the raw BlueTide CSV exports into normalized tables (design spec §3)."""

import csv
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path

from django.db import transaction

from .models import (
    Customer,
    DataNote,
    InventoryLot,
    Item,
    PurchaseOrderLine,
    SalesLine,
    Vendor,
)
from .rules.constants import NON_SUPPLIER_VENDORS, VENDOR_SEEDS
from .rules.normalize import (
    canonical_code,
    is_dead_code,
    normalize_status,
    parse_date,
    parse_lbs_per_case,
    to_planning_qty,
)

TRANSFER_CUSTOMER = "INT01"
ONE_OFF_CUSTOMER = "CRU01"


@dataclass
class LoadReport:
    counts: dict[str, int] = field(default_factory=dict)
    notes: list[DataNote] = field(default_factory=list)


def _read(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def _int_or_none(raw: str | None) -> int | None:
    try:
        return int((raw or "").strip())
    except ValueError:
        return None


def _decimal_or_none(raw: str | None) -> Decimal | None:
    text = (raw or "").strip()
    return Decimal(text) if text else None


def _load_vendors(rows: list[dict[str, str]]) -> None:
    for row in rows:
        code = row["vendor_code"].strip()
        system_lead = _int_or_none(row["lead_time_days"])
        seed_lead, seed_safety = VENDOR_SEEDS.get(code, (system_lead, 7))
        vendor, created = Vendor.objects.update_or_create(
            code=code,
            defaults={
                "name": row["vendor_name"],
                "country": row["country"],
                "lead_time_days_system": system_lead,
                "is_supplier": code not in NON_SUPPLIER_VENDORS,
            },
        )
        if created:  # never overwrite Dana's edits on reload
            vendor.lead_time_days = seed_lead
            vendor.safety_days = seed_safety
            vendor.save(update_fields=["lead_time_days", "safety_days"])


def _load_items(rows: list[dict[str, str]], notes: Counter[str]) -> None:
    seen: set[str] = set()
    for row in rows:
        code = canonical_code(row["item_code"])
        if code in seen:
            notes["merged_codes"] += 1
            continue
        seen.add(code)
        status = normalize_status(row["status"])
        storage = row["storage"].strip().upper()
        if storage == "FRESH":
            scope_reason = "fresh"
        elif is_dead_code(code):
            scope_reason = "dead_code"
        elif status == "discontinued":
            scope_reason = "discontinued"
        else:
            scope_reason = ""
        Item.objects.update_or_create(
            code=code,
            defaults={
                "description": row["description"].strip(),
                "category": row["category"].strip().title(),
                "storage": storage,
                "pack_size_raw": row["pack_size"],
                "lbs_per_case": parse_lbs_per_case(row["pack_size"]),
                "planning_uom": row["sell_uom"].strip().upper() or "CS",
                "vendor_id": row["vendor_code"].strip() or None,
                "shelf_life_months": _int_or_none(row["shelf_life_months"]),
                "status_raw": row["status"],
                "status": status,
                "in_scope": scope_reason == "",
                "scope_reason": scope_reason,
            },
        )


def _load_inventory(rows: list[dict[str, str]], items: dict[str, Item], notes: Counter[str]) -> int:
    latest = max(row["snapshot_date"] for row in rows)
    lots: list[InventoryLot] = []
    for row in rows:
        if row["snapshot_date"] != latest:
            continue
        qty = float(row["qty"])
        if qty == 0:
            continue
        code = canonical_code(row["item_code"])
        item = items[code]
        qty_planning = to_planning_qty(qty, row["uom"], item.planning_uom, item.lbs_per_case)
        if qty_planning is None:
            notes["unconvertible_qty"] += 1
        is_adjustment = row["lot_no"].startswith("ADJ-")
        if is_adjustment:
            notes["adjustments"] += 1
        lots.append(
            InventoryLot(
                item=item,
                location=row["location"],
                lot_no=row["lot_no"],
                qty=qty,
                uom=row["uom"],
                qty_planning=qty_planning,
                pack_date=parse_date(row["pack_date"]),
                expiry_date=parse_date(row["expiry_date"]),
                received_date=parse_date(row["received_date"]),
                unit_cost=_decimal_or_none(row["unit_cost"]),
                snapshot_date=date.fromisoformat(latest),
                is_adjustment=is_adjustment,
            )
        )
    InventoryLot.objects.bulk_create(lots)
    return len(lots)


def _load_purchase_orders(
    rows: list[dict[str, str]], items: dict[str, Item], notes: Counter[str]
) -> int:
    seen: set[tuple[str, ...]] = set()
    lines: list[PurchaseOrderLine] = []
    for row in rows:
        key = tuple(row.values())
        if key in seen:
            notes["deduped_po_lines"] += 1
            continue
        seen.add(key)
        lines.append(
            PurchaseOrderLine(
                po_no=row["po_no"],
                line_no=int(row["line_no"]),
                vendor_id=row["vendor_code"].strip(),
                item=items[canonical_code(row["item_code"])],
                order_date=parse_date(row["order_date"]),
                expected_date=parse_date(row["expected_date"]),
                qty_ordered=float(row["qty_ordered"]),
                qty_received=float(row["qty_received"] or 0),
                uom=row["uom"],
                status=row["status"],
                unit_cost=_decimal_or_none(row["unit_cost"]),
            )
        )
    PurchaseOrderLine.objects.bulk_create(lines)
    return len(lines)


def _classify_sale(row: dict[str, str], item: Item, qty: float, price: Decimal) -> tuple[bool, str]:
    """Return (is_clean_demand, exclusion_reason). Order of checks matters (spec §3.6)."""
    if row["status"] == "CANCELLED":
        return False, "cancelled"
    if qty < 0:
        return False, "credit"
    if price == 0:
        return False, "sample"
    if row["customer_code"] == TRANSFER_CUSTOMER:
        return False, "transfer"
    if row["customer_code"] == ONE_OFF_CUSTOMER:
        return False, "one_off"
    if not item.in_scope:
        return False, "out_of_scope"
    return row["status"] == "INVOICED", ""


def _load_sales(rows: list[dict[str, str]], items: dict[str, Item], notes: Counter[str]) -> int:
    lines: list[SalesLine] = []
    for row in rows:
        item = items.get(canonical_code(row["item_code"]))
        if item is None:
            notes["unknown_item_sales"] += 1
            continue
        qty = float(row["qty"])
        price = Decimal(row["unit_price"])
        clean, reason = _classify_sale(row, item, qty, price)
        if reason:
            notes[f"excluded_{reason}"] += 1
        order_date = parse_date(row["order_date"])
        ship_date = parse_date(row["ship_date"]) or order_date
        assert order_date is not None and ship_date is not None
        lines.append(
            SalesLine(
                order_no=row["order_no"],
                line_no=int(row["line_no"]),
                order_date=order_date,
                ship_date=ship_date,
                customer_code=row["customer_code"],
                customer_name=row["customer_name"],
                item=item,
                qty=qty,
                uom=row["uom"],
                unit_price=price,
                status=row["status"],
                is_clean_demand=clean,
                exclusion_reason=reason,
            )
        )
    SalesLine.objects.bulk_create(lines)
    return len(lines)


NOTE_TEXT = {
    "merged_codes": "Duplicate item rows merged into the clean code (case/space differences)",
    "deduped_po_lines": "Identical duplicate purchase-order lines counted once",
    "unconvertible_qty": "Inventory rows whose units could not be converted",
    "adjustments": "Negative ADJ lots netted against on-hand stock",
    "unknown_item_sales": "Sales lines for items missing from the item list (skipped)",
    "excluded_cancelled": "Cancelled sales lines left out of demand",
    "excluded_credit": "Customer credits (negative sales) left out of demand",
    "excluded_sample": "Zero-dollar sample orders left out of demand",
    "excluded_transfer": "Transfers to Providence (TRANSFER - PVD) left out of demand",
    "excluded_one_off": "One-off cruise-line order left out of demand",
    "excluded_out_of_scope": "Sales of fresh / dead items left out of planning",
}


@transaction.atomic
def load_all(data_dir: Path, as_of: date) -> LoadReport:
    """Replace all BlueTide-derived rows. Dana's HandledFlag rows and vendor edits are kept."""
    notes: Counter[str] = Counter()

    InventoryLot.objects.all().delete()
    PurchaseOrderLine.objects.all().delete()
    SalesLine.objects.all().delete()
    Customer.objects.all().delete()
    DataNote.objects.all().delete()

    _load_vendors(_read(data_dir / "vendors.csv"))
    _load_items(_read(data_dir / "items.csv"), notes)
    items = {item.code: item for item in Item.objects.all()}

    Customer.objects.bulk_create(
        Customer(
            code=row["customer_code"],
            name=row["customer_name"],
            customer_type=row["customer_type"],
        )
        for row in _read(data_dir / "customers.csv")
    )
    counts = {
        "vendors": Vendor.objects.count(),
        "items": len(items),
        "customers": Customer.objects.count(),
        "inventory_lots": _load_inventory(_read(data_dir / "inventory_on_hand.csv"), items, notes),
        "po_lines": _load_purchase_orders(_read(data_dir / "purchase_orders.csv"), items, notes),
        "sales_lines": _load_sales(_read(data_dir / "sales_lines.csv"), items, notes),
    }

    data_notes = [
        DataNote(kind=kind, message=NOTE_TEXT.get(kind, kind), count=count)
        for kind, count in sorted(notes.items())
    ]
    DataNote.objects.bulk_create(data_notes)
    return LoadReport(counts=counts, notes=data_notes)
