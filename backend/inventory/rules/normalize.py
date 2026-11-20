"""Normalization of messy BlueTide values: codes, statuses, pack sizes, dates, units."""

import re
from datetime import date, datetime
from typing import Literal

from .constants import DEAD_PREFIX, KG_TO_LB

_PACK_MULTI = re.compile(r"^(\d+(?:\.\d+)?)\s*[x/]\s*(\d+(?:\.\d+)?)\s*(?:lb|#)", re.IGNORECASE)
_PACK_SINGLE = re.compile(
    r"^(\d+(?:\.\d+)?)\s*(?:lb|#)(?!\s*block)(?:\s*(?:cs|case))?$", re.IGNORECASE
)
_PACK_KG = re.compile(r"^(\d+(?:\.\d+)?)\s*kg$", re.IGNORECASE)


def canonical_code(raw: str) -> str:
    return raw.strip().upper()


def is_dead_code(code: str) -> bool:
    return canonical_code(code).startswith(DEAD_PREFIX)


def normalize_status(raw: str | None) -> Literal["active", "discontinued"]:
    value = (raw or "").strip().lower()
    return "discontinued" if value in {"disc", "discontinued"} else "active"


def parse_lbs_per_case(pack_size: str | None) -> float | None:
    """Pounds per case from free text like '10 lb cs', '4x2.5lb', '10/2#', '5kg'.

    Returns None for catch-weight, per-lb, bulk-block or blank values (no case conversion).
    """
    text = (pack_size or "").strip()
    if not text:
        return None
    if match := _PACK_MULTI.match(text):
        return float(match.group(1)) * float(match.group(2))
    if match := _PACK_KG.match(text):
        return float(match.group(1)) * KG_TO_LB
    if match := _PACK_SINGLE.match(text):
        return float(match.group(1))
    return None


def parse_date(raw: str | None) -> date | None:
    text = (raw or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def to_planning_qty(
    qty: float, uom: str, planning_uom: str, lbs_per_case: float | None
) -> float | None:
    """Convert a quantity to the item's planning unit (CS or LB); None if it cannot be done."""
    if uom == planning_uom:
        return qty
    if lbs_per_case is None:
        return None
    if uom == "LB" and planning_uom == "CS":
        return qty / lbs_per_case
    if uom == "CS" and planning_uom == "LB":
        return qty * lbs_per_case
    return None
