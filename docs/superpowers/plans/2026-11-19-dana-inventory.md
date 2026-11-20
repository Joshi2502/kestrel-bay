# Dana's Monday Inventory Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed web app where Dana logs in on Monday and sees what will run out before a reorder can arrive, what stock she's stuck with, and why — built from the raw BlueTide CSVs in `data/`.

**Architecture:** Django + DRF API over Postgres; all business logic in pure, unit-tested functions under `backend/inventory/rules/` that take plain dataclasses, with a thin service layer that reads the ORM and feeds them. A one-time management command normalizes the CSVs into tables. Next.js frontend proxies `/api/*` to Django via rewrites so session + CSRF cookies are same-origin. Both deploy to Vercel; DB is Neon Postgres.

**Tech Stack:** Python 3.12, uv, Django 5.2, DRF, drf-spectacular, django-environ, psycopg 3, pytest/pytest-django/factory-boy, ruff, mypy+django-stubs · Next.js (App Router, TS, Tailwind, npm), Recharts · Vercel, Neon Postgres, GitHub Actions, gitleaks.

**Spec:** `docs/superpowers/specs/2026-11-19-dana-inventory-design.md` — read it first; section refs (§) below point into it.

## Global Constraints

- **No reference to Benmore, Benmore-Studio, Aditya, Niture, ArkashJ, or any Gitleaks license key anywhere in the repo.** `project-creation.sh` is local-only (git-excluded) — read it for structure, never copy branding. LICENSE: `Copyright 2026 Sneha Joshi. All rights reserved.` + the same proprietary paragraph.
- Git: author `Sneha Joshi <sjoshi32@hawk.iit.edu>` (already in repo-local config), push via GitHub account **Joshi2502** (`gh auth status` must show it active). Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (or whichever model is executing).
- "Today" is `AS_OF_DATE = date(2026, 11, 16)` from settings (`env("AS_OF_DATE", default="2026-11-16")`). Never call `date.today()` in business logic.
- Python ≥3.12; Django `>=5.2,<6.0`; ruff line-length 100, rules `E,F,I,N,W,UP,B,SIM`; coverage `fail_under = 80`; tests use `config.settings.test` (SQLite in-memory).
- No Celery, Redis, Sentry, Docker deploy, or Claude review workflow.
- Sellable locations: `NB`, `PVD`, `HCS`. Hold: `QA-HOLD`. Not counted: `DAMAGED`.
- Planning-excluded vendors: `BBD`, `OCN`, `HCS`. Excluded storage: `FRESH`. Dead prefix: `ZZ-`.
- Seed lead/safety days: BXE 84/14, AFS 42/14, MNP 14/7, ASP 28/7, DLC 21/7.
- Thresholds (named constants in `inventory/rules/constants.py`): `SHELF_LINE_MONTHS = 6`, `DORMANT_DAYS = 120`, `STOCKOUT_MIN_GAP_DAYS = 10`, `LONG_COVER_DAYS = 180`, `ORDER_NOW_WINDOW_DAYS = 7`, `WATCH_WINDOW_DAYS = 28`, `COVER_WINDOW_DAYS = 28`, `OVERDUE_ETA_IMPORT_DAYS = 14`, `OVERDUE_ETA_DOMESTIC_DAYS = 7`, `LEVEL_WINDOW_DAYS = 56`, `LEVEL_CLAMP = (0.7, 1.3)`, `HANDLED_DEFAULT_DAYS = 14`, `IMPORT_VENDORS = {"BXE", "AFS"}`.
- UI copy: plain words ("cases", "lbs", "order by", "out around"), no jargon ("SKU", "safety stock" → "buffer").

## Review Focus

1. **Lowercase/space-padded duplicate codes** (`shr-1620 `, `Sal-Por6`, `COD-LOIN `) — SHR-1620 must total 480 sellable cs, not 400. → test in Task 4.
2. **Mixed-unit lots** (CAL-RING NB 132 LB, LOB-T56 LB lots) — must convert, not add raw. → CAL-RING 353, LOB-T56 83 in Task 4.
3. **Past-due open POs** (PO-260376, -260394, -260407) — must not be counted as on hand; ETA = today+14. → Task 6.
4. **Censored December** for SHR-1620 — forecast for Dec 2026 must be ~490, not 157. → Task 5.
5. **Dana marks an item handled, then reloads** — it must stay handled (persisted) and drop out of Order Now; un-handling restores it. → Task 8.

---

## File Structure

```
.gitignore  .dockerignore  gitleaks.toml  .pre-commit-config.yaml  Makefile  README.md  LICENSE
docker-compose.yml                      # local postgres only
.github/workflows/ci.yml
context/meetings/kickoff-call-transcript.md   # moved from root (git mv)
context/features/  context/flows/             # .gitkeep
data/*.csv                                    # unchanged, source for loader
backend/
  pyproject.toml  uv.lock  requirements.txt  vercel.json  manage.py  .env.example
  api/index.py                         # Vercel WSGI entry: `from config.wsgi import application as app`
  config/settings/{__init__,base,dev,prod,test}.py  config/urls.py  config/wsgi.py
  inventory/
    models.py  admin.py
    rules/constants.py   rules/normalize.py   rules/demand.py
    rules/position.py    rules/verdict.py     rules/stuck.py
    loader.py                          # CSV → models; returns LoadReport
    management/commands/load_kestrel_data.py
    services.py                        # ORM → rules → dict payloads
    views.py  serializers.py  urls.py
  tests/
    conftest.py  test_health.py
    rules/test_normalize.py  rules/test_demand.py  rules/test_position.py
    rules/test_verdict.py    rules/test_stuck.py
    test_loader.py  test_services.py  test_api.py
frontend/
  next.config.ts  .env.example  vercel.json(optional)
  src/lib/api.ts  src/lib/types.ts
  src/app/login/page.tsx  src/app/page.tsx  src/app/items/[code]/page.tsx  src/app/vendors/page.tsx
  src/components/{ItemRow,StuckRow,DataNotes,DemandChart,HandledButton,Header}.tsx
```

---

### Task 1: De-branded scaffold (repo standards from the template)

**Files:** everything root-level above; `backend/` skeleton (`config/`, settings split, `/health/`, `inventory` app empty, `tests/conftest.py`, `tests/test_health.py`); `frontend/` via create-next-app; `context/`.

**Interfaces:** Produces `make install|dev|dev-frontend|migrate|test|lint|typecheck|check-all|load-data`, settings module `config.settings.{dev,prod,test}`, `settings.AS_OF_DATE: date`.

- [ ] **Step 1:** Reproduce `project-creation.sh` steps 4–12 by hand in this repo (no clone, no repo creation), with these deltas: Django app named `inventory` (not `api`); drop `celery[redis]`, `redis`, `sentry-sdk` deps and all their settings/compose services; add no data libraries (no pandas, no dateutil) — the loader uses stdlib `csv` and `datetime.strptime` for the two date formats. `base.py` adds `AS_OF_DATE = date.fromisoformat(env("AS_OF_DATE", default="2026-11-16"))`, DRF default auth `SessionAuthentication`, default permission `IsAuthenticated`, `CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=["http://localhost:3000"])`. `prod.py`: `DATABASES = {"default": env.db("DATABASE_URL")}` with `CONN_MAX_AGE = 0`, `SECURE_SSL_REDIRECT = False` (Vercel terminates TLS) but `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")`, secure cookies on, `SESSION_COOKIE_SAMESITE = "Lax"`. `docker-compose.yml`: `db` service only (postgres:17-alpine, db/user `kestrel_bay`, pw `kestrel_bay_dev`). CI: template jobs minus docker-build and claude review; gitleaks job without `GITLEAKS_LICENSE`. Makefile: template targets plus `load-data: cd backend && uv run python manage.py load_kestrel_data --dir ../data`. `git mv kickoff-call-transcript.md context/meetings/`.
- [ ] **Step 2:** Keep the take-home `README.md` content as a "Brief" section at the bottom of the new README; top of README: project name "Kestrel Bay — Inventory for Dana", Quick Start, Stack, Commands, and an empty `## Assumptions` heading (filled in Task 10).
- [ ] **Step 3:** Run `make install && cd backend && uv run pytest && uv run ruff check . && uv run mypy . && uv run python manage.py check` → all pass (3 health tests). `cd frontend && npx tsc --noEmit` passes.
- [ ] **Step 4:** `grep -riE 'benmore|aditya|niture|arkash|798620' . --exclude-dir={node_modules,.venv,.git} --exclude=project-creation.sh` → no output.
- [ ] **Step 5:** Commit `chore: scaffold Django + Next.js project` and push.

---

### Task 2: Normalization rules (pure functions)

**Files:** Create `backend/inventory/rules/constants.py`, `backend/inventory/rules/normalize.py`; Test `backend/tests/rules/test_normalize.py`.

**Interfaces — Produces:**
- `canonical_code(raw: str) -> str`
- `normalize_status(raw: str | None) -> Literal["active", "discontinued"]`
- `parse_lbs_per_case(pack_size: str | None) -> float | None` (None for catch wt / per lb / block / blank)
- `parse_date(raw: str | None) -> date | None` (accepts `YYYY-MM-DD` and `MM/DD/YYYY`)
- `to_planning_qty(qty: float, uom: str, planning_uom: str, lbs_per_case: float | None) -> float | None` (None if conversion impossible)
- `is_dead_code(code: str) -> bool` (`ZZ-` prefix)

- [ ] **Step 1: Write failing tests**

```python
@pytest.mark.parametrize("raw,exp", [("shr-1620 ", "SHR-1620"), ("Sal-Por6", "SAL-POR6"), ("COD-LOIN ", "COD-LOIN")])
def test_canonical_code(raw, exp): assert canonical_code(raw) == exp

@pytest.mark.parametrize("raw,exp", [("Active","active"),("A","active"),("active","active"),("","active"),(None,"active"),
                                     ("DISC","discontinued"),("Discontinued","discontinued")])
def test_normalize_status(raw, exp): assert normalize_status(raw) == exp

@pytest.mark.parametrize("raw,exp", [("10 lb cs",10),("10lb",10),("10#",10),("15 lb case",15),("30lb",30),("5 lb cs",5),
    ("10 LB CS",10),("20 lb cs",20),("6x2.2lb",13.2),("4x2.5lb",10),("5x2lb",10),("5 x 2 lb",10),("10/2#",20),("5x2#",10),
    ("10x2lb",20),("6x1lb",6),("6x2lb",12),("5kg",11.02),("catch wt",None),("per lb",None),("16.5 lb block",None),("",None),(None,None)])
def test_parse_lbs_per_case(raw, exp):
    r = parse_lbs_per_case(raw); assert (r is None and exp is None) or r == pytest.approx(exp, abs=0.01)

def test_parse_date_both_formats():
    assert parse_date("2026-01-04") == date(2026,1,4); assert parse_date("01/04/2026") == date(2026,1,4); assert parse_date("") is None

def test_to_planning_qty():
    assert to_planning_qty(132, "LB", "CS", 13.2) == pytest.approx(10)
    assert to_planning_qty(5, "CS", "CS", 10) == 5
    assert to_planning_qty(2, "CS", "LB", 10) == 20
    assert to_planning_qty(5, "LB", "CS", None) is None

def test_is_dead_code(): assert is_dead_code("ZZ-SCL-0002") and not is_dead_code("SHR-1620")
```

- [ ] **Step 2:** `cd backend && uv run pytest tests/rules/test_normalize.py -v` → FAIL (import error).
- [ ] **Step 3:** Implement. `5kg` → `5 * 2.20462`; `NxM` / `N x M` / `N/M` with `lb|#` → N×M; single number + `lb|#|LB` → that number. Put all §Global thresholds in `constants.py`.
- [ ] **Step 4:** Re-run → PASS.
- [ ] **Step 5:** Commit `feat: normalization rules for BlueTide exports`.

---

### Task 3: Models

**Files:** Modify `backend/inventory/models.py`, `backend/inventory/admin.py`; migration `0001_initial`.

**Interfaces — Produces** (field names are contracts for Tasks 4–8):
- `Vendor(code PK str, name, country, lead_time_days_system: int|None, lead_time_days: int|None, safety_days: int, is_supplier: bool)`
- `Item(code PK str, description, category, storage, pack_size_raw, lbs_per_case: float|None, planning_uom: "CS"|"LB", vendor FK, shelf_life_months: int|None, status_raw, status, in_scope: bool, scope_reason: str)` — `scope_reason` ∈ `""|"fresh"|"dead_code"|"discontinued"`
- `InventoryLot(item FK, location, lot_no, qty: float, uom, qty_planning: float|None, pack_date, expiry_date: date|None, received_date, unit_cost: Decimal|None, snapshot_date, is_adjustment: bool)`
- `PurchaseOrderLine(po_no, line_no, vendor FK, item FK, order_date, expected_date, qty_ordered, qty_received, uom, status, unit_cost)` — `unique_together (po_no, line_no)`
- `SalesLine(order_no, line_no, order_date, ship_date, customer_code, customer_name, item FK, qty, uom, unit_price, status, is_clean_demand: bool, exclusion_reason: str)` — reasons `""|"cancelled"|"credit"|"sample"|"transfer"|"one_off"|"out_of_scope"`
- `HandledFlag(item FK, note: str, qty: float|None, expected_date: date|None, created_at, expires_on: date, active: bool)`
- `DataNote(kind: str, message: str, count: int)`

- [ ] **Step 1:** Write models + register all in admin. `uv run python manage.py makemigrations inventory` → creates `0001_initial`.
- [ ] **Step 2:** `uv run pytest` still green; `manage.py check` clean.
- [ ] **Step 3:** Commit `feat: inventory data model`.

---

### Task 4: Loader (CSV → DB, once)

**Files:** Create `backend/inventory/loader.py`, `backend/inventory/management/commands/load_kestrel_data.py`; Test `backend/tests/test_loader.py`.

**Interfaces:**
- Consumes: Task 2 functions, Task 3 models.
- Produces: `load_all(data_dir: Path, as_of: date) -> LoadReport` (dataclass with `counts: dict[str,int]`, `notes: list[DataNote]`); command `load_kestrel_data --dir <path>` (atomic; deletes all rows of these models then reloads; leaves `HandledFlag` rows untouched unless `--reset-handled`).

Rules applied (spec §3.1–3.6): canonicalize codes everywhere; items master keeps the first row per canonical code (the clean one); vendor seeds per Global Constraints (`is_supplier=False` for BBD/OCN/HCS); `in_scope=False` for storage FRESH / ZZ- / discontinued; inventory keeps only max `snapshot_date`, skips `qty == 0`, marks `ADJ-*` `is_adjustment=True`; `qty_planning` via `to_planning_qty`; POs drop exact duplicate rows before insert (record a DataNote); sales clean-demand classification in this order: `status=="CANCELLED"`→cancelled, `qty<0`→credit, `unit_price==0`→sample, `customer_code=="INT01"`→transfer, `customer_code=="CRU01"`→one_off, item not in scope→out_of_scope, `status=="INVOICED"`→clean; OPEN lines stay `is_clean_demand=False, exclusion_reason=""` (they are commitments, Task 6). DataNotes for: merged codes, deduped PO lines, each exclusion count, unconvertible quantities.

- [ ] **Step 1: Write failing tests** (run loader against the real `data/` dir; path via `Path(settings.BASE_DIR).parent / "data"`):

```python
@pytest.fixture
def loaded(db): return load_all(DATA_DIR, date(2026, 11, 16))

def sellable(code): return sum(l.qty_planning for l in InventoryLot.objects.filter(item_id=code, location__in=["NB","PVD","HCS"]))

def test_duplicate_codes_merged(loaded):
    assert not Item.objects.filter(code__in=["shr-1620 ", "Sal-Por6", "COD-LOIN "]).exists()
    assert sellable("SHR-1620") == 480

def test_mixed_units_converted(loaded):
    assert sellable("CAL-RING") == pytest.approx(353); assert sellable("LOB-T56") == pytest.approx(83)

def test_adjustments_net_and_latest_snapshot_only(loaded):
    assert sellable("COD-FIL") == 206
    assert set(InventoryLot.objects.values_list("snapshot_date", flat=True)) == {date(2026, 11, 15)}

def test_scope(loaded):
    assert not Item.objects.get(code="ZZ-SCL-0002").in_scope
    assert not Item.objects.get(code="FR-COD").in_scope
    assert Item.objects.get(code="SHR-1620").in_scope

def test_po_dedupe_and_open(loaded):
    assert PurchaseOrderLine.objects.filter(status="Open").count() == 14
    assert PurchaseOrderLine.objects.filter(po_no="PO-260439").count() == 1

def test_sales_classification(loaded):
    c = Counter(SalesLine.objects.values_list("exclusion_reason", flat=True))
    assert c["cancelled"] == 294 and c["credit"] == 76 and c["sample"] == 104 and c["transfer"] == 378 and c["one_off"] == 2
    assert SalesLine.objects.filter(status="OPEN").count() == 180

def test_mixed_dates_parsed(loaded):
    assert SalesLine.objects.filter(order_no="SO-242785").first().order_date == date(2026, 1, 4)

def test_vendor_seeds(loaded):
    v = Vendor.objects.get(code="BXE"); assert (v.lead_time_days, v.safety_days, v.lead_time_days_system) == (84, 14, 56)
    assert Vendor.objects.get(code="AFS").lead_time_days == 42
    assert not Vendor.objects.get(code="HCS").is_supplier

def test_reload_is_idempotent_and_keeps_handled(loaded):
    HandledFlag.objects.create(item_id="SHR-1620", note="phoned", expires_on=date(2026,11,30), active=True)
    load_all(DATA_DIR, date(2026, 11, 16))
    assert InventoryLot.objects.count() == loaded.counts["inventory_lots"] and HandledFlag.objects.count() == 1
```

Note on counts: sales exclusion numbers above are mutually exclusive in the stated order; if a line is both cancelled and $0 it counts as cancelled — verify the exact numbers once with the implementation and keep the test pinned to them (credit 76 / sample 104 / transfer 378 / cruise 2 / cancelled 294 were measured independently). `test_po_dedupe_and_open`: 16 raw open lines − 2 duplicates = 14.

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with stdlib `csv` (`utf-8-sig`, files are CRLF), `bulk_create`, inside `transaction.atomic()`.
- [ ] **Step 4:** Run → PASS. Also `make load-data` against local Postgres succeeds and prints counts.
- [ ] **Step 5:** Commit `feat: one-time CSV loader with normalization`.

---

### Task 5: Demand history, stockout correction, forecast

**Files:** Create `backend/inventory/rules/demand.py`; Test `backend/tests/rules/test_demand.py`.

**Interfaces — Produces:**
- `@dataclass MonthDemand: year:int; month:int; actual:float; corrected:float; stockout_days:int; partial:bool`
- `daily_series(lines: Iterable[tuple[date, float]]) -> dict[date, float]`
- `detect_stockouts(daily: dict[date,float], start: date, end: date, min_gap: int = STOCKOUT_MIN_GAP_DAYS) -> list[tuple[date, date]]` — only for items with sales on ≥ 50% of weeks in [start,end]; a gap is ≥ `min_gap` consecutive zero days strictly between two sale days.
- `monthly_history(daily, start, end, stockouts) -> list[MonthDemand]` — corrected = actual / in-stock-days × days-in-month when stockout_days > 0; `partial=True` for months not fully inside [start,end].
- `level_factor(daily, as_of: date) -> float` — sum(last 56 days) ÷ sum(same 56 days a year earlier), clamped to `LEVEL_CLAMP`, `1.0` if prior window has < 56 days of history or zero.
- `forecast_month(history: list[MonthDemand], year: int, month: int, level: float) -> float` — corrected value of same month prior year × level; if prior-year month is partial or missing, use mean daily rate of all full months × days-in-month × level.
- `is_dormant(daily, as_of) -> bool` — no sales in last `DORMANT_DAYS`.

- [ ] **Step 1: Failing tests** — synthetic unit tests plus one real-data test using the Task 4 loader:

```python
def test_stockout_detected_and_corrected():
    d = {date(2025,12,1)+timedelta(days=i): 15.7 for i in range(10)}  # Dec 1–10
    d[date(2026,1,3)] = 17.0
    gaps = detect_stockouts(d, date(2025,12,1), date(2026,1,3))
    assert gaps == [(date(2025,12,11), date(2026,1,2))]
    dec = next(m for m in monthly_history(d, date(2025,12,1), date(2026,1,3), gaps) if m.month == 12)
    assert dec.stockout_days == 21 and dec.corrected == pytest.approx(157 / 10 * 31)

def test_level_factor_clamped():
    ...  # prior window 100/day, last window 200/day → 1.3

def test_forecast_uses_same_month_last_year(): ...  # Dec 2025 corrected 486.7, level 1.0 → forecast_month(..., 2026, 12, 1.0) == 486.7

def test_real_shr1620_december(loaded):   # uses loader fixture from test_loader via conftest
    # build daily from clean SalesLine rows (ship_date, qty) for SHR-1620
    assert 450 <= forecast_month(hist, 2026, 12, lvl) <= 560

def test_real_lent_lift(loaded):  # COD-LOIN March 2027 forecast ≥ 1.8 × its Jan 2027 forecast
def test_real_dormant(loaded):    # is_dormant True for PAN-1012, SHR-6170, TIL-FIL; False for SHR-1620
```
Move the `loaded` fixture into `tests/conftest.py` so Tasks 5–8 share it.

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: seasonal demand forecast with stockout correction`.

---

### Task 6: Position & incoming (on-hand, commitments, POs with corrected ETA)

**Files:** Create `backend/inventory/rules/position.py`; Test `backend/tests/rules/test_position.py`.

**Interfaces — Produces:**
- `@dataclass Incoming: source: Literal["po","dana"]; ref: str; qty: float; eta: date; vendor_said: date|None; overdue: bool`
- `@dataclass Position: sellable: float; on_hold: float; damaged: float; by_location: dict[str,float]; committed_by_month: dict[tuple[int,int], float]; incoming: list[Incoming]`
- `corrected_eta(expected: date, as_of: date, vendor_code: str) -> tuple[date, bool]` — `(expected, False)` if expected ≥ as_of else `(as_of + 14d if vendor in IMPORT_VENDORS else as_of + 7d, True)`.
- `incoming_from_po(po_no, qty_ordered, qty_received, expected, vendor_code, as_of, uom→planning converter) -> Incoming | None` (None when outstanding ≤ 0)

- [ ] **Step 1: Failing tests**

```python
def test_overdue_import_po(): assert corrected_eta(date(2026,9,14), AS_OF, "BXE") == (date(2026,11,30), True)
def test_overdue_domestic_po(): assert corrected_eta(date(2026,11,1), AS_OF, "MNP") == (date(2026,11,23), True)
def test_future_po_untouched(): assert corrected_eta(date(2026,12,28), AS_OF, "BXE") == (date(2026,12,28), False)
def test_partial_po_outstanding(): assert incoming_from_po("PO-260376",1000,600,date(2026,9,14),"BXE",AS_OF,lambda q:q).qty == 400
def test_fully_received_po_none(): assert incoming_from_po("X",10,10,date(2026,12,1),"MNP",AS_OF,lambda q:q) is None
```
- [ ] **Steps 2–5:** fail → implement → pass → commit `feat: stock position and corrected PO ETAs`.

---

### Task 7: Verdict (run-out, order-by, status, suggested qty)

**Files:** Create `backend/inventory/rules/verdict.py`; Test `backend/tests/rules/test_verdict.py`.

**Interfaces — Produces:**
- `@dataclass Verdict: status: Literal["order_now","watch","ok","handled"]; run_out_date: date|None; order_by_date: date|None; earliest_arrival: date; days_late: int; suggested_qty: float; projection: list[tuple[date, float]]`
- `daily_consumption(as_of, horizon_end, forecast_by_month: dict[(y,m),float], committed_by_month: dict[(y,m),float]) -> dict[date, float]` — for each month, total = `max(forecast_remaining, committed)`, where for the current month `forecast_remaining = forecast × remaining_days/days_in_month`; spread evenly over the month's remaining days. (Spec §3.4: never forecast + committed.)
- `compute_verdict(sellable: float, incoming: list[Incoming], consumption: dict[date,float], as_of: date, lead_days: int, safety_days: int, handled: bool, planning_uom: str) -> Verdict`
  - projection day by day from `as_of` to `as_of + lead + safety + COVER_WINDOW_DAYS + 30`
  - run_out = first day projected < 0; order_by = run_out − lead; earliest_arrival = as_of + lead; days_late = max(0, (earliest_arrival − run_out).days)
  - status: handled → "handled"; order_by ≤ as_of + 7 → "order_now"; ≤ as_of + 28 → "watch"; else "ok"
  - suggested = max(0, consumption over [earliest_arrival, earliest_arrival + safety + 28] − projected(earliest_arrival)), ceil to integer for CS, 1 decimal for LB.

- [ ] **Step 1: Failing tests**

```python
def test_runs_out_before_lead_time_is_order_now_and_late():
    cons = {AS_OF + timedelta(d): 10.0 for d in range(400)}
    v = compute_verdict(100, [], cons, AS_OF, lead_days=84, safety_days=14, handled=False, planning_uom="CS")
    assert v.run_out_date == AS_OF + timedelta(10) and v.status == "order_now" and v.days_late == 74

def test_incoming_po_delays_runout():
    v = compute_verdict(100, [Incoming("po","P",500,AS_OF+timedelta(5),None,False)], cons, AS_OF, 14, 7, False, "CS")
    assert v.run_out_date == AS_OF + timedelta(60)

def test_watch_window(): ...  # run_out = AS_OF+40, lead 14 → order_by AS_OF+26 → "watch"
def test_ok(): ...            # run_out beyond horizon → run_out None, status "ok"
def test_handled_overrides(): ...  # same as first test with handled=True → "handled"
def test_committed_not_double_counted():
    c = daily_consumption(AS_OF, date(2026,12,31), {(2026,11):300,(2026,12):300}, {(2026,12):500})
    assert sum(v for d,v in c.items() if d.month==12) == pytest.approx(500)
    assert sum(v for d,v in c.items() if d.month==11) == pytest.approx(300*15/30)
def test_suggested_qty_rounds_up_cases(): ...
```
- [ ] **Steps 2–5:** fail → implement → pass → commit `feat: run-out verdict and suggested order qty`.

---

### Task 8: Stuck stock + services + API + auth

**Files:** Create `backend/inventory/rules/stuck.py`, `backend/inventory/services.py`, `backend/inventory/views.py`, `backend/inventory/serializers.py`, `backend/inventory/urls.py`; Modify `backend/config/urls.py`; Tests `backend/tests/rules/test_stuck.py`, `backend/tests/test_services.py`, `backend/tests/test_api.py`.

**Interfaces:**
- `stuck.py`: `@dataclass StuckRow: item_code; description; location; lot_no: str|None; qty: float; uom; value_at_cost: float; reasons: list[Literal["expired","expiring","long","dead"]]; expiry_date: date|None; at_hcs: bool; sellable_before_line: float|None; detail: str`
  `stuck_rows(lots, item, forecast_daily_total_until: Callable[[date], float], cover_days: float|None, as_of) -> list[StuckRow]` — expiring = expiry < as_of + 6 months; expired = expiry < as_of; long = cover_days > 180 (one row per item with excess qty = sellable − 180 days of forecast); dead = item not in_scope for dead_code/discontinued, or dormant.
  Sort: `at_hcs` desc, then `value_at_cost` desc.
- `services.py`: `build_dashboard(as_of: date) -> dict` and `build_item_detail(code: str, as_of: date) -> dict` — shapes exactly as spec §7; dashboard rows include `code, description, vendor_name, country, lead_days, sellable, incoming_total, next_eta, monthly_forecast_next, run_out_date, order_by_date, days_late, suggested_qty, uom, status, handled_note`. Item detail adds `lots[]` (with location, qty, uom, expiry, status sellable|hold|damaged), `committed_by_month`, `incoming[]`, `history[] (MonthDemand + forecast)`, `projection[]`, `math: list[str]` (3–5 plain sentences, e.g. "You have 480 cases you can sell (80 more on QA hold).").
  Expire `HandledFlag` where `expires_on < as_of` (treat as inactive).
- API (DRF, session auth, `IsAuthenticated` except login): `POST /api/auth/login` `{username,password}` → 200/400; `POST /api/auth/logout`; `GET /api/auth/me`; `GET /api/auth/csrf` (sets csrftoken cookie, `ensure_csrf_cookie`); `GET /api/dashboard`; `GET /api/items/<code>`; `POST /api/items/<code>/handled` `{note?, qty?, expected_date?}` (expires_on = expected_date or as_of+14); `DELETE /api/items/<code>/handled`; `GET /api/vendors`; `PATCH /api/vendors/<code>` `{lead_time_days?, safety_days?}` (ints 0–365).
- Demo user: data migration `0002_demo_user` creating user from `DANA_USERNAME` / `DANA_PASSWORD` env (defaults `dana` / `kestrel-monday` for dev; README documents them).

- [ ] **Step 1: Failing tests**

```python
# test_stuck.py (real data via loaded fixture + services)
def test_expired_salmon_lot_flagged(loaded):  rows = build_dashboard(AS_OF)["stuck"]
    assert any(r["lot_no"]=="L250303-01" and "expired" in r["reasons"] and r["at_hcs"] for r in rows)
def test_chilean_salmon_expiring(loaded): # SAL-POR6 lots L260706-01/-02, L260817-01 all "expiring" (expiry Feb–Apr 2027)
def test_dead_items_at_hcs(loaded):      # ZZ-SHR-0001 (35 cs) and TIL-FIL (140 cs) present with "dead"
def test_hcs_sorted_first(loaded):       # first row at_hcs is True
def test_fresh_not_listed(loaded):        # no FR-* in stuck or order lists

# test_services.py
def test_shr1620_order_now(loaded):
    row = next(r for r in build_dashboard(AS_OF)["order_now"] if r["code"]=="SHR-1620"); assert row["sellable"] == 480
def test_handled_moves_item(loaded):
    HandledFlag.objects.create(item_id="SHR-1620", note="phoned Tue", expires_on=date(2026,11,30), active=True)
    d = build_dashboard(AS_OF); assert "SHR-1620" in [r["code"] for r in d["handled"]] and "SHR-1620" not in [r["code"] for r in d["order_now"]]
def test_expired_handled_flag_ignored(loaded): # expires_on 2026-11-10 → back in order_now
def test_item_detail_explains(loaded):
    d = build_item_detail("SHR-1620", AS_OF); assert d["on_hold"] == 80 and any("480" in s for s in d["math"])
def test_overdue_po_shown(loaded): # build_item_detail("PAN-0709")["incoming"][0] has overdue True, qty 400, eta 2026-11-30

# test_api.py
def test_requires_login(api_client): assert api_client.get("/api/dashboard").status_code in (401, 403)
def test_login_then_dashboard(api_client, loaded, user): ...
def test_handled_roundtrip(auth_client, loaded):  # POST → dashboard handled; DELETE → back; persists across requests
def test_patch_vendor_changes_verdict(auth_client, loaded): # BXE lead 84→28 changes SHR-1620 order_by_date
def test_patch_vendor_validates(auth_client, loaded): # lead_time_days=-1 → 400
def test_unknown_item_404(auth_client, loaded)
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (services read ORM once per request: prefetch lots/POs/sales per item; ~40 items is fine). **Step 4:** `uv run pytest` all green, coverage ≥ 80%; `ruff`, `mypy` clean. Swagger at `/api/schema/swagger/` renders.
- [ ] **Step 5:** Commit `feat: dashboard, item detail and settings API with login`.

---

### Task 9: Frontend

**Files:** `frontend/next.config.ts`, `frontend/src/lib/{api,types}.ts`, pages and components per File Structure.

**Interfaces:** Consumes Task 8 endpoints. `next.config.ts` `rewrites()` → `[{ source: "/api/:path*", destination: `${process.env.BACKEND_URL}/api/:path*/` }]` (Django needs trailing slash — or set `APPEND_SLASH` and make DRF urls slash-optional with `re_path`; pick one and be consistent). `api.ts`: `apiFetch<T>(path, init?)` — `credentials: "include"`, sends `X-CSRFToken` from the `csrftoken` cookie on non-GET, redirects to `/login` on 401/403.

Pages (client components; mobile-first; Tailwind; no component library):
- `/login` — username/password form; calls `/api/auth/csrf` then login.
- `/` — header "Kestrel Bay · Monday, Nov 16" + Lead times link + Log out. Sections in this order: **Order now** (red), **Watch** (amber), **Handled** (collapsed, grey), **Stuck stock** (total $ at cost in header; HCS badge), **Data notes** (collapsed). Each item row is one tap target to `/items/[code]`, with the one-line verdict ("Out around Dec 20 · order by today — 74 days late") and an inline "I've handled this" button that opens a tiny form (note, optional qty, optional expected date).
- `/items/[code]` — verdict sentence on top; "The math" list (`math[]`); "What you have" table by location/lot (hold/damaged greyed, expiry shown, inside-6-month lots highlighted); "Spoken for" by month; "Coming in" (overdue rows: "Vendor said Sep 14 — still open, assuming Nov 30"); `DemandChart` (Recharts bar: last-year actual, corrected overlay where stockout, forecast next 6 months); handled toggle.
- `/vendors` — table of suppliers: country, BlueTide lead time (read-only), real lead time (editable), buffer days (editable); save per row.

- [ ] **Step 1:** Build pages against local backend (`make dev` + `make dev-frontend`, `BACKEND_URL=http://localhost:8000`).
- [ ] **Step 2:** `npx tsc --noEmit` and `npm run lint` pass; `npm run build` succeeds.
- [ ] **Step 3:** Manual check at 375px width and desktop: login → dashboard → SHR-1620 detail shows 480 sellable / 80 on hold / 600 coming Dec 28 → mark handled → reload → still handled → un-handle. Change BXE lead time → dashboard updates.
- [ ] **Step 4:** Commit `feat: Monday dashboard, item drill-down and lead-time settings UI`.

---

### Task 10: Deploy to Vercel + README assumptions

**Files:** `backend/vercel.json`, `backend/api/index.py`, `backend/requirements.txt`, `frontend/.env.example`, `README.md`.

- [ ] **Step 1:** Backend Vercel config:
  - `backend/api/index.py`: `from config.wsgi import application as app`
  - `backend/vercel.json`: `{"builds":[{"src":"api/index.py","use":"@vercel/python"}],"routes":[{"src":"/(.*)","dest":"api/index.py"}]}`
  - `uv export --no-dev --no-hashes --format requirements-txt > requirements.txt` (add a `make requirements` target).
- [ ] **Step 2:** Neon: create a free Postgres (Vercel Marketplace → Neon) and attach to the backend project. Backend env: `DJANGO_SETTINGS_MODULE=config.settings.prod`, `SECRET_KEY` (generate), `DATABASE_URL` (Neon, `?sslmode=require`), `ALLOWED_HOSTS=<backend>.vercel.app`, `CSRF_TRUSTED_ORIGINS=https://<frontend>.vercel.app`, `DANA_USERNAME`, `DANA_PASSWORD`, `AS_OF_DATE=2026-11-16`.
- [ ] **Step 3:** From local, with `DATABASE_URL` pointing at Neon: `uv run python manage.py migrate && uv run python manage.py load_kestrel_data --dir ../data` → counts printed.
- [ ] **Step 4:** Create two Vercel projects from `Joshi2502/kestrel-bay` (Vercel account must be connected to the **Joshi2502** GitHub account): root dirs `backend/` and `frontend/`. Frontend env `BACKEND_URL=https://<backend>.vercel.app`. Deploy both. If Django-on-Vercel fails (cold-start limits, size), fall back to Render free web service for backend only — frontend unchanged except `BACKEND_URL`.
- [ ] **Step 5:** Smoke test live: `curl https://<backend>/health/` → `{"status":"healthy"}`; log in on the frontend URL on a phone; run the Task 9 Step 3 checklist on prod.
- [ ] **Step 6:** README: live link, demo login, how to run locally, and **Assumptions** — one bullet per rule in spec §3 (today = Nov 16; latest snapshot; hold/damaged excluded; code merges; unit conversion; ADJ netting; PO dedupe and overdue ETA; demand exclusions with counts; stockout correction; forecast method; lead/safety seeds; dormant/long/expiring thresholds; fresh out of scope; Marco out of scope).
- [ ] **Step 7:** Final checks: `make check-all` green; CI green on GitHub; brand grep from Task 1 Step 4 empty. Commit `chore: Vercel deploy config and README` and push.

---

## Self-review notes
- Spec coverage: §3.1–3.3 → T2/T4; §3.4 → T6/T7; §3.5 → T4/T6; §3.6–3.7 → T5; §3.8 → T4/T8 (PATCH); §3.9 → T7; §3.10 → T8; §3.11 → T4 (DataNote) + T9; §5 → T1; §6 → T3; §7 → T8; §8 → T9; deploy → T10.
- Review Focus tests live in T4 (1, 2), T6 (3), T5 (4), T8 (5).
