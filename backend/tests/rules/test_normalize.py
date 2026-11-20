from datetime import date

import pytest

from inventory.rules.normalize import (
    canonical_code,
    is_dead_code,
    normalize_status,
    parse_date,
    parse_lbs_per_case,
    to_planning_qty,
)


@pytest.mark.parametrize(
    "raw,exp",
    [("shr-1620 ", "SHR-1620"), ("Sal-Por6", "SAL-POR6"), ("COD-LOIN ", "COD-LOIN")],
)
def test_canonical_code(raw, exp):
    assert canonical_code(raw) == exp


@pytest.mark.parametrize(
    "raw,exp",
    [
        ("Active", "active"),
        ("A", "active"),
        ("active", "active"),
        ("", "active"),
        (None, "active"),
        ("DISC", "discontinued"),
        ("Discontinued", "discontinued"),
    ],
)
def test_normalize_status(raw, exp):
    assert normalize_status(raw) == exp


@pytest.mark.parametrize(
    "raw,exp",
    [
        ("10 lb cs", 10),
        ("10lb", 10),
        ("10#", 10),
        ("15 lb case", 15),
        ("30lb", 30),
        ("5 lb cs", 5),
        ("10 LB CS", 10),
        ("20 lb cs", 20),
        ("6x2.2lb", 13.2),
        ("4x2.5lb", 10),
        ("5x2lb", 10),
        ("5 x 2 lb", 10),
        ("10/2#", 20),
        ("5x2#", 10),
        ("10x2lb", 20),
        ("6x1lb", 6),
        ("6x2lb", 12),
        ("5kg", 11.02),
        ("catch wt", None),
        ("per lb", None),
        ("16.5 lb block", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_lbs_per_case(raw, exp):
    result = parse_lbs_per_case(raw)
    if exp is None:
        assert result is None
    else:
        assert result == pytest.approx(exp, abs=0.01)


def test_parse_date_both_formats():
    assert parse_date("2026-01-04") == date(2026, 1, 4)
    assert parse_date("01/04/2026") == date(2026, 1, 4)
    assert parse_date("") is None
    assert parse_date(None) is None


def test_to_planning_qty():
    assert to_planning_qty(132, "LB", "CS", 13.2) == pytest.approx(10)
    assert to_planning_qty(5, "CS", "CS", 10) == 5
    assert to_planning_qty(2, "CS", "LB", 10) == 20
    assert to_planning_qty(5, "LB", "CS", None) is None


def test_is_dead_code():
    assert is_dead_code("ZZ-SCL-0002")
    assert not is_dead_code("SHR-1620")
