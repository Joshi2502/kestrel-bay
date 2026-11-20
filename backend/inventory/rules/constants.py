"""Named thresholds for the planning rules. See design spec §3."""

SELLABLE_LOCATIONS = frozenset({"NB", "PVD", "HCS"})
HOLD_LOCATION = "QA-HOLD"
DAMAGED_LOCATION = "DAMAGED"

NON_SUPPLIER_VENDORS = frozenset({"BBD", "OCN", "HCS"})
IMPORT_VENDORS = frozenset({"BXE", "AFS"})
DEAD_PREFIX = "ZZ-"

SHELF_LINE_MONTHS = 6
DORMANT_DAYS = 120
STOCKOUT_MIN_GAP_DAYS = 10
LONG_COVER_DAYS = 180
ORDER_NOW_WINDOW_DAYS = 7
WATCH_WINDOW_DAYS = 28
COVER_WINDOW_DAYS = 28
OVERDUE_ETA_IMPORT_DAYS = 14
OVERDUE_ETA_DOMESTIC_DAYS = 7
LEVEL_WINDOW_DAYS = 56
LEVEL_CLAMP = (0.7, 1.3)
HANDLED_DEFAULT_DAYS = 14

KG_TO_LB = 2.20462

# Seed planning numbers (vendor code -> (lead_time_days, safety_days)). Dana can edit them in the app.
VENDOR_SEEDS: dict[str, tuple[int | None, int]] = {
    "BXE": (84, 14),
    "AFS": (42, 14),
    "MNP": (14, 7),
    "ASP": (28, 7),
    "DLC": (21, 7),
}
