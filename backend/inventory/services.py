"""Glue between the database and the pure rules: builds the dashboard and item-detail payloads."""

from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from django.conf import settings
from django.db.models import Min

from .models import DataNote, HandledFlag, InventoryLot, Item, PurchaseOrderLine, SalesLine
from .rules.constants import (
    COVER_WINDOW_DAYS,
    HANDLED_DEFAULT_DAYS,
    HOLD_LOCATION,
    LONG_COVER_DAYS,
    SELLABLE_LOCATIONS,
)
from .rules.demand import (
    MonthDemand,
    daily_series,
    detect_stockouts,
    forecast_month,
    is_dormant,
    level_factor,
    monthly_history,
)
from .rules.normalize import to_planning_qty
from .rules.position import (
    Incoming,
    Position,
    committed_by_month,
    incoming_from_po,
    late_from_po,
    summarize_lots,
)
from .rules.stuck import LotInfo, StuckRow, stuck_rows
from .rules.verdict import EXTRA_HORIZON_DAYS, Verdict, compute_verdict, daily_consumption

DEFAULT_LEAD_DAYS = 28
MIN_FORECAST_DAYS = LONG_COVER_DAYS + 10


def _iso(day: date | None) -> str | None:
    return day.isoformat() if day else None


def _short(day: date) -> str:
    return f"{day:%b} {day.day}"


def _qty_text(qty: float, uom: str) -> str:
    if uom == "LB":
        return f"{qty:,.0f} lbs"
    return f"{round(qty):,} cases"


def _num(qty: float, uom: str) -> float:
    return round(qty, 1) if uom == "LB" else round(qty)


@dataclass
class ItemPlan:
    item: Item
    lead_days: int
    safety_days: int
    lots: list[InventoryLot]
    position: Position
    history: list[MonthDemand]
    stockouts: list[tuple[date, date]]
    level: float
    forecast_by_month: dict[tuple[int, int], float]
    consumption: dict[date, float]
    handled: HandledFlag | None
    dormant: bool
    dead_reason: str | None
    verdict: Verdict | None
    horizon_days: int


class _Data:
    """Everything the planner reads, fetched in a handful of queries."""

    def __init__(self, as_of: date, item_codes: list[str] | None = None) -> None:
        self.as_of = as_of
        item_filter = {"item_id__in": item_codes} if item_codes else {}
        self.items = list(
            Item.objects.select_related("vendor").filter(
                **({"code__in": item_codes} if item_codes else {})
            )
        )
        self.history_start = SalesLine.objects.aggregate(first=Min("order_date"))["first"] or as_of
        self.lots: dict[str, list[InventoryLot]] = defaultdict(list)
        for lot in InventoryLot.objects.filter(**item_filter):
            self.lots[lot.item_id].append(lot)
        self.clean: dict[str, list[tuple[date, float]]] = defaultdict(list)
        for code, ship, qty in SalesLine.objects.filter(
            is_clean_demand=True, ship_date__lt=as_of, **item_filter
        ).values_list("item_id", "ship_date", "qty"):
            self.clean[code].append((ship, qty))
        self.open_lines: dict[str, list[tuple[date, float, str]]] = defaultdict(list)
        for code, ship, qty, uom in SalesLine.objects.filter(
            status="OPEN", exclusion_reason="", **item_filter
        ).values_list("item_id", "ship_date", "qty", "uom"):
            self.open_lines[code].append((max(ship, as_of), qty, uom))
        self.pos: dict[str, list[PurchaseOrderLine]] = defaultdict(list)
        for po in PurchaseOrderLine.objects.filter(status="Open", **item_filter):
            self.pos[po.item_id].append(po)
        self.handled: dict[str, HandledFlag] = {}
        flags = HandledFlag.objects.filter(active=True, expires_on__gte=as_of, **item_filter)
        for flag in flags.order_by("created_at"):
            self.handled[flag.item_id] = flag


def _converter(uom: str, item: Item) -> Callable[[float], float]:
    """Quantity converter into the item's planning unit (unchanged if it can't be converted)."""

    def convert(qty: float) -> float:
        converted = to_planning_qty(qty, uom, item.planning_uom, item.lbs_per_case)
        return qty if converted is None else converted

    return convert


def _plan_item(item: Item, data: _Data) -> ItemPlan:
    as_of = data.as_of
    vendor = item.vendor
    lead = (
        (vendor.lead_time_days or vendor.lead_time_days_system or DEFAULT_LEAD_DAYS)
        if vendor
        else DEFAULT_LEAD_DAYS
    )
    safety = vendor.safety_days if vendor else 7
    lots = data.lots[item.code]
    position = summarize_lots((lot.location, lot.qty_planning or 0.0) for lot in lots)

    daily = daily_series(data.clean[item.code])
    end = as_of - timedelta(days=1)
    stockouts = detect_stockouts(daily, data.history_start, end)
    history = monthly_history(daily, data.history_start, end, stockouts)
    level = level_factor(daily, as_of)
    dormant = is_dormant(daily, as_of)

    if item.scope_reason in ("dead_code", "discontinued"):
        dead_reason: str | None = item.scope_reason
    elif item.in_scope and dormant:
        dead_reason = "dormant"
    else:
        dead_reason = None

    horizon_days = max(MIN_FORECAST_DAYS, lead + safety + COVER_WINDOW_DAYS + EXTRA_HORIZON_DAYS)
    horizon_end = as_of + timedelta(days=horizon_days)
    forecast_by_month: dict[tuple[int, int], float] = {}
    year, month = as_of.year, as_of.month
    while (year, month) <= (horizon_end.year, horizon_end.month):
        forecast_by_month[(year, month)] = (
            0.0 if dead_reason else forecast_month(history, year, month, level)
        )
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)

    committed_lines = []
    for ship, qty, uom in data.open_lines[item.code]:
        converted = to_planning_qty(qty, uom, item.planning_uom, item.lbs_per_case)
        committed_lines.append((ship, qty if converted is None else converted))
    position.committed_by_month = committed_by_month(committed_lines)

    for po in data.pos[item.code]:
        if po.expected_date is None:
            continue
        args = (
            po.po_no,
            po.qty_ordered,
            po.qty_received,
            po.expected_date,
            as_of,
            _converter(po.uom, item),
        )
        if incoming := incoming_from_po(*args):
            position.incoming.append(incoming)
        elif late := late_from_po(*args):
            position.late.append(late)
    flag = data.handled.get(item.code)
    if flag and flag.qty and flag.expected_date:
        position.incoming.append(
            Incoming(
                "dana",
                flag.note or "Phoned in",
                flag.qty,
                max(flag.expected_date, as_of),
            )
        )
    position.incoming.sort(key=lambda i: i.eta)

    consumption = daily_consumption(
        as_of, horizon_end, forecast_by_month, position.committed_by_month
    )
    verdict = None
    if item.in_scope and not dormant:
        verdict = compute_verdict(
            position.sellable,
            position.incoming,
            consumption,
            as_of,
            lead,
            safety,
            flag is not None,
            item.planning_uom,
            late_qty=sum(late.qty for late in position.late),
        )
    return ItemPlan(
        item,
        lead,
        safety,
        lots,
        position,
        history,
        stockouts,
        level,
        forecast_by_month,
        consumption,
        flag,
        dormant,
        dead_reason,
        verdict,
        horizon_days,
    )


def _stuck_for(plan: ItemPlan, as_of: date) -> list[StuckRow]:
    if plan.item.scope_reason == "fresh":
        return []
    rate = (
        sum(plan.consumption.get(as_of + timedelta(days=i), 0.0) for i in range(LONG_COVER_DAYS))
        / LONG_COVER_DAYS
    )
    lots = [
        LotInfo(
            lot.location,
            lot.lot_no,
            lot.qty,
            lot.uom,
            lot.qty_planning,
            lot.expiry_date,
            float(lot.unit_cost) if lot.unit_cost is not None else None,
        )
        for lot in plan.lots
    ]
    return stuck_rows(
        plan.item.code,
        plan.item.description,
        plan.item.planning_uom,
        lots,
        plan.dead_reason,
        rate,
        as_of,
    )


def _stuck_dict(row: StuckRow) -> dict[str, Any]:
    return {
        "code": row.item_code,
        "description": row.description,
        "location": row.location,
        "lot_no": row.lot_no,
        "qty": round(row.qty, 1),
        "uom": row.uom,
        "value_at_cost": row.value_at_cost,
        "reasons": row.reasons,
        "expiry_date": _iso(row.expiry_date),
        "at_hcs": row.at_hcs,
        "detail": row.detail,
    }


def _late_clause(plan: ItemPlan) -> str:
    late = plan.position.late
    if not late:
        return ""
    refs = ", ".join(f"{p.ref} (vendor said {_short(p.vendor_said)})" for p in late)
    if plan.verdict and plan.verdict.only_late_po_cover:
        return f". Only a late order could cover this: {refs} is still open, arrival unknown"
    return f". Late and not counted: {refs} is still open, arrival unknown"


def _headline(plan: ItemPlan, as_of: date) -> str:
    return _base_headline(plan, as_of) + _late_clause(plan)


def _base_headline(plan: ItemPlan, as_of: date) -> str:
    v = plan.verdict
    assert v is not None
    if v.run_out_date is None:
        return f"Stock is fine for at least the next {plan.horizon_days // 30} months"
    out = _short(v.run_out_date)
    if v.gap_days > 0:
        rescue = min(
            (i for i in plan.position.incoming if i.eta > v.run_out_date), key=lambda i: i.eta
        )
        days = f"{v.gap_days} day" + ("" if v.gap_days == 1 else "s")
        return (
            f"Dips below zero around {out} for {days}, until {rescue.ref} lands "
            f"{_short(rescue.eta)}. No new order needed"
        )
    if v.days_late > 0:
        return (
            f"Out around {out}. An order placed today lands {_short(v.earliest_arrival)}, "
            f"{v.days_late} days too late"
        )
    assert v.order_by_date is not None
    when = "today" if v.order_by_date <= as_of else _short(v.order_by_date)
    return f"Out around {out}. Order by {when}"


def _row(plan: ItemPlan, as_of: date) -> dict[str, Any]:
    item, v, pos = plan.item, plan.verdict, plan.position
    assert v is not None
    uom = item.planning_uom
    incoming_total = sum(i.qty for i in pos.incoming)
    next_eta = min((i.eta for i in pos.incoming), default=None)
    demand_30 = sum(plan.consumption.get(as_of + timedelta(days=i), 0.0) for i in range(30))
    return {
        "code": item.code,
        "description": item.description,
        "category": item.category,
        "vendor_name": item.vendor.name if item.vendor else "",
        "country": item.vendor.country if item.vendor else "",
        "lead_days": plan.lead_days,
        "safety_days": plan.safety_days,
        "uom": uom,
        "sellable": _num(pos.sellable, uom),
        "on_hold": _num(pos.on_hold, uom),
        "committed_total": _num(sum(pos.committed_by_month.values()), uom),
        "incoming_total": _num(incoming_total, uom),
        "next_eta": _iso(next_eta),
        "demand_next_30d": _num(demand_30, uom),
        "status": v.status,
        "run_out_date": _iso(v.run_out_date),
        "order_by_date": _iso(v.order_by_date),
        "earliest_arrival": _iso(v.earliest_arrival),
        "days_late": v.days_late,
        "gap_days": v.gap_days,
        "suggested_qty": v.suggested_qty,
        "handled_note": plan.handled.note if plan.handled else None,
        "headline": _headline(plan, as_of),
        "late_pos": [
            {"ref": p.ref, "qty": _num(p.qty, uom), "vendor_said": p.vendor_said.isoformat()}
            for p in pos.late
        ],
        "only_late_po_cover": v.only_late_po_cover,
    }


def _overdue_po_count(as_of: date) -> int:
    return PurchaseOrderLine.objects.filter(status="Open", expected_date__lt=as_of).count()


def build_dashboard(as_of: date | None = None) -> dict[str, Any]:
    as_of = as_of or settings.AS_OF_DATE
    data = _Data(as_of)
    groups: dict[str, list[dict[str, Any]]] = {"order_now": [], "watch": [], "handled": []}
    ok_count = 0
    stuck: list[StuckRow] = []
    for item in data.items:
        plan = _plan_item(item, data)
        stuck.extend(_stuck_for(plan, as_of))
        if plan.verdict is None:
            continue
        if plan.verdict.status == "ok":
            ok_count += 1
        else:
            groups[plan.verdict.status].append(_row(plan, as_of))
    for rows in groups.values():
        rows.sort(key=lambda r: (r["order_by_date"] or "9999", r["code"]))
    stuck.sort(key=lambda r: (not r.at_hcs, -r.value_at_cost))

    notes = [
        {"kind": n.kind, "message": n.message, "count": n.count}
        for n in DataNote.objects.order_by("kind")
    ]
    overdue = _overdue_po_count(as_of)
    if overdue:
        notes.append(
            {
                "kind": "overdue_pos",
                "message": "Open POs past the vendor's expected date: the date is the original "
                "quote and nobody updates it, so they are listed as late with no arrival date "
                "and are not counted as stock on the way",
                "count": overdue,
            }
        )
    return {
        "as_of": as_of.isoformat(),
        **groups,
        "ok_count": ok_count,
        "stuck": [_stuck_dict(r) for r in stuck],
        "stuck_total_value": round(sum(r.value_at_cost for r in stuck), 2),
        "data_notes": notes,
    }


def _math(plan: ItemPlan, as_of: date) -> list[str]:
    item, pos, v = plan.item, plan.position, plan.verdict
    uom = item.planning_uom
    lines = []
    have = f"You have {_qty_text(pos.sellable, uom)} you can sell right now"
    if pos.on_hold > 0:
        have += f" ({_qty_text(pos.on_hold, uom)} more is on QA hold and isn't counted)"
    lines.append(have + ".")
    if pos.damaged > 0:
        lines.append(f"{_qty_text(pos.damaged, uom)} is damaged and ignored.")
    if pos.committed_by_month:
        lines.append(
            f"{_qty_text(sum(pos.committed_by_month.values()), uom)} is already promised on "
            "open orders that haven't shipped."
        )
    for inc in pos.incoming:
        if inc.source == "dana":
            lines.append(
                f"{_qty_text(inc.qty, uom)} you phoned in (not in BlueTide yet), "
                f"expected {_short(inc.eta)}."
            )
        else:
            lines.append(f"{_qty_text(inc.qty, uom)} on {inc.ref}, due {_short(inc.eta)}.")
    for late in pos.late:
        lines.append(
            f"{_qty_text(late.qty, uom)} on {late.ref} is late: the vendor said "
            f"{_short(late.vendor_said)} and it is still open. It is probably on the way but "
            "nobody knows when, so it is not counted in the run-out date."
        )
    for entry in plan.history:
        if entry.stockout_days:
            lines.append(
                f"Sales in {date(entry.year, entry.month, 1):%b %Y} were adjusted up from "
                f"{_qty_text(entry.actual, uom)} to {_qty_text(entry.corrected, uom)} because "
                f"you were out of stock for {entry.stockout_days} days."
            )
    if v:
        demand = sum(plan.consumption.get(as_of + timedelta(days=i), 0.0) for i in range(30))
        lines.append(
            f"At the expected pace you'll ship about {_qty_text(demand, uom)} in the next 30 days."
        )
        weeks = round(plan.lead_days / 7)
        if v.run_out_date:
            lines.append(
                f"At that pace you run out around {_short(v.run_out_date)}. This vendor takes "
                f"about {weeks} weeks, so an order placed today arrives "
                f"{_short(v.earliest_arrival)}."
            )
        else:
            lines.append("That is enough to cover you past the end of the planning window.")
    elif plan.dead_reason:
        lines.append("This item isn't planned: it has no live demand, so any stock is stuck stock.")
    return lines


def build_item_detail(code: str, as_of: date | None = None) -> dict[str, Any]:
    as_of = as_of or settings.AS_OF_DATE
    data = _Data(as_of, [code])
    if not data.items or data.items[0].scope_reason == "fresh":
        raise Item.DoesNotExist(code)
    plan = _plan_item(data.items[0], data)
    item, pos = plan.item, plan.position
    uom = item.planning_uom

    def status_of(location: str) -> str:
        if location in SELLABLE_LOCATIONS:
            return "sellable"
        return "hold" if location == HOLD_LOCATION else "damaged"

    lots = sorted(
        (
            {
                "location": lot.location,
                "lot_no": lot.lot_no,
                "qty": lot.qty,
                "uom": lot.uom,
                "expiry_date": _iso(lot.expiry_date),
                "unit_cost": float(lot.unit_cost) if lot.unit_cost is not None else None,
                "status": status_of(lot.location),
                "is_adjustment": lot.is_adjustment,
            }
            for lot in plan.lots
        ),
        key=lambda x: (x["status"] != "sellable", x["location"], x["lot_no"]),
    )
    row = _row(plan, as_of) if plan.verdict else None
    next_months = []
    for (year, month), qty in sorted(plan.forecast_by_month.items())[:7]:
        next_months.append({"year": year, "month": month, "qty": _num(qty, uom)})
    flag = plan.handled
    return {
        "code": item.code,
        "description": item.description,
        "category": item.category,
        "uom": uom,
        "vendor_name": item.vendor.name if item.vendor else "",
        "country": item.vendor.country if item.vendor else "",
        "lead_days": plan.lead_days,
        "safety_days": plan.safety_days,
        "planned": plan.verdict is not None,
        "verdict": row,
        "sellable": _num(pos.sellable, uom),
        "on_hold": _num(pos.on_hold, uom),
        "damaged": _num(pos.damaged, uom),
        "lots": lots,
        "committed_by_month": [
            {"month": f"{y}-{m:02d}", "qty": _num(q, uom)}
            for (y, m), q in sorted(pos.committed_by_month.items())
        ],
        "incoming": [
            {
                "source": i.source,
                "ref": i.ref,
                "qty": _num(i.qty, uom),
                "eta": i.eta.isoformat(),
                "vendor_said": None,
                "overdue": False,
            }
            for i in pos.incoming
        ]
        + [
            {
                "source": "po",
                "ref": late.ref,
                "qty": _num(late.qty, uom),
                "eta": None,
                "vendor_said": late.vendor_said.isoformat(),
                "overdue": True,
            }
            for late in pos.late
        ],
        "history": [
            {
                "year": h.year,
                "month": h.month,
                "actual": _num(h.actual, uom),
                "corrected": _num(h.corrected, uom),
                "stockout_days": h.stockout_days,
                "partial": h.partial,
            }
            for h in plan.history
        ],
        "forecast": next_months,
        "level_factor": round(plan.level, 2),
        "stockouts": [{"start": a.isoformat(), "end": b.isoformat()} for a, b in plan.stockouts],
        "projection": [
            {"date": d.isoformat(), "qty": round(q, 1)}
            for d, q in (plan.verdict.projection if plan.verdict else [])
        ],
        "math": _math(plan, as_of),
        "handled": (
            {
                "note": flag.note,
                "qty": flag.qty,
                "expected_date": _iso(flag.expected_date),
                "expires_on": flag.expires_on.isoformat(),
            }
            if flag
            else None
        ),
        "stuck": [_stuck_dict(r) for r in _stuck_for(plan, as_of)],
    }


def set_handled(
    code: str,
    note: str,
    qty: float | None,
    expected_date: date | None,
    as_of: date | None = None,
) -> HandledFlag:
    as_of = as_of or settings.AS_OF_DATE
    item = Item.objects.get(code=code)
    HandledFlag.objects.filter(item=item, active=True).update(active=False)
    return HandledFlag.objects.create(
        item=item,
        note=note,
        qty=qty,
        expected_date=expected_date,
        expires_on=expected_date or as_of + timedelta(days=HANDLED_DEFAULT_DAYS),
        active=True,
    )
