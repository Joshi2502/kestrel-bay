# Kestrel Bay — Dana's Monday Inventory Screen: Design

Owner: Sneha Joshi · Written 2026-11-19 · Project "today" = **Monday 2026-11-16**

## 1. Intent

Dana Okafor (VP Purchasing, Kestrel Bay Seafood) spends half of every Monday reconciling BlueTide exports in Excel to answer two questions:

1. **What will run out before a new order could arrive?** (the 16/20 shrimp stockout last December is the canonical failure)
2. **What am I stuck with?** (aging Chilean salmon; long stock paying pallet fees at Harbor Cold Storage; dead items)

Success (Walt, CEO): *one screen on Monday morning that tells us what to order and what we're stuck with, and it has to be right.* "Right" means it counts only sellable stock and real demand. Dana must understand it within ~1 minute with no training, on a laptop or phone, and be able to click any number to see *why*. She must be able to tell it things BlueTide doesn't know ("I've handled this one", real lead times).

Deliverable: small working web app (backend + DB + frontend), deployed to a live link. One-time CSV load is fine — no ETL pipeline.

## 2. Goals / Non-goals / Anti-goals

**Goals**
- Monday screen with two sections: **Order Now / At Risk** and **Stuck Stock**.
- Item drill-down: sellable on-hand by location and lot, committed open orders, open POs (with corrected ETAs), monthly demand history and forecast, and the arithmetic behind the verdict.
- Dana's inputs that persist: per-item "I've handled this" (with optional note/qty/date), per-vendor real lead time and safety days.
- Login (single shared account for Dana; demo creds documented for reviewers).
- Live on Vercel.
- A written ASSUMPTIONS section (README) — the take-home asks for reasonable assumptions to be written down.

**Non-goals (v1)**
- Fresh / day-boat items (vendor BBD, storage FRESH). Excluded entirely.
- Marco's needs: availability lookup, pricing (`price_list.csv` loaded? **no** — not needed), routes, email drafting.
- Live BlueTide integration, re-uploads, ETL, multi-user roles, PO creation/sending.
- Celery/Redis/background jobs.

**Anti-goals (failure even if it "works")**
- Counting QA-HOLD, DAMAGED, ZZ items, transfers, samples, credits, cancelled lines, or the cruise one-off as stock/demand.
- Mixing CS and LB without conversion.
- Double-counting duplicate PO lines or treating past-due open POs as already arrived.
- Forecasting December from last December's censored (stocked-out) sales.
- A screen that needs explanation; a verdict Dana can't trace.

## 3. Data rules (the core of "it has to be right")

All rules live in one Python module (`inventory/rules.py` or similar) with unit tests per rule. "Today" is a setting `AS_OF_DATE = 2026-11-16`, never the system clock.

### 3.1 Item identity & scope
- Canonical item code = `strip().upper()`. Merge rows for `shr-1620 `, `Sal-Por6`, `COD-LOIN ` into `SHR-1620`, `SAL-POR6`, `COD-LOIN` everywhere (inventory, sales). Items master: keep the first/clean row (the one with UPC, bin, shelf life) as the record.
- Status normalize: `Active|A|active|''` → active; `DISC|Discontinued` → discontinued.
- **Out of planning scope**: storage `FRESH` / vendor `BBD`; `ZZ-*` codes (dead regardless of status, incl. `ZZ-SCL-0002` marked Active); discontinued.
- **Dormant** (derived): active item with no *clean* demand in the last 120 days (PAN-1012, SHR-6170, TIL-FIL). Not in run-out list; any stock shows in Stuck Stock as "no sales since <month>".
- ZZ / dormant / discontinued stock with qty > 0 → Stuck Stock ("dead item").

### 3.2 Units
- Parse `pack_size` → lbs per case: `10 lb cs`, `10lb`, `10#`, `15 lb case`, `30lb`, `5 lb cs` → N; `6x2.2lb`, `4x2.5lb`, `5x2lb`, `5 x 2 lb`, `10/2#`, `5x2#` → a×b; `5kg` → 11.02; `16.5 lb block`, `catch wt`, `per lb` → item tracked in LB (no case conversion needed).
- Each item has a **planning unit** = its `sell_uom` (CS for most; LB for SAL-SIDE, SAL-SIDE-SK, POL-BLK).
- Inventory/PO quantities in the other unit are converted to the planning unit (e.g., CAL-RING NB lot 132 LB ÷ 13.2 = 10 CS; LOB-T56 LB lots ÷ 10). If a conversion is impossible, the row is surfaced as a data warning, not silently dropped.

### 3.3 On-hand
- Use only the **latest `snapshot_date`** in the file (2026-11-15).
- **Sellable** = locations NB, PVD, HCS. **QA-HOLD** shown separately as "on hold — may come back" (not counted). **DAMAGED** not counted (shown in drill-down, greyed).
- Zero-qty lots ignored. Negative `ADJ-*` rows (no expiry) are inventory adjustments: they **net against the item's sellable total** at that location, and are not lots.
- Location is irrelevant for ordering (all stock pooled); it matters only for HCS cost.

### 3.4 Committed (open sales orders)
- Sales lines with `status = OPEN` (180 lines, ship 11-16 → 12-15) are stock already spoken for: subtract from available. Exclude INT01 transfers and $0 lines from committed too (transfers aren't customer demand).
- To avoid double counting: forecast demand for the period covered by booked orders is `max(forecast, booked)` per month, not forecast + booked. (Booked Nov/Dec orders are *part of* Nov/Dec demand.)

### 3.5 Incoming (open POs)
- Keep `status = Open` only (drop Received, Closed, Cancelled).
- Dedupe exact duplicate rows (PO-260439 L1, PO-260445 L1).
- Outstanding = `qty_ordered − qty_received` (PO-260376: 400 of 1,000), converted to planning unit.
- **ETA correction**: `eta = expected_date` if it is ≥ today; if past-due (still open ⇒ not arrived), `eta = today + 14 days` for imports (BXE, AFS), `today + 7 days` for domestic — shown as "Overdue — vendor said <date>". Never counted as already on hand.
- Dana's "I've handled this" entries can carry an optional qty + expected date; they then count as incoming like a PO (labelled "Dana: phoned in, not in BlueTide").

### 3.6 Clean demand (history)
From `sales_lines.csv`, keep lines where: `status = INVOICED`, `qty > 0`, `unit_price > 0`, customer ≠ `INT01` (TRANSFER - PVD), customer ≠ `CRU01` (cruise one-off), item in planning scope. Exclude `CM-*` credits (negative). Parse mixed dates (`YYYY-MM-DD` and 51 rows of `MM/DD/YYYY`). Use `ship_date` as the demand date (falls back to order_date).

History spans 2025-10-29 → 2026-11-15. Partial months (Oct 2025, Nov 2026) are handled by daily rates, not monthly totals.

**Stockout correction (censored demand)**: for items that normally sell most weeks, a run of ≥ 10 consecutive days with zero clean sales while the item was active is treated as a stockout. That month's demand = observed daily rate on in-stock days × days in month. This catches SHR-1620 Dec 11 – Jan 2 (157 observed ≈ 490 corrected). Corrections are shown in the drill-down ("Dec 2025 adjusted: out of stock Dec 11–Jan 2").

### 3.7 Forecast
Only one year of history ⇒ no trend model. Forecast daily demand for a future date in month *m* = **same calendar month last year** (corrected) ÷ days in month, scaled by a **level factor** = (clean demand last 8 weeks) ÷ (same 8 weeks last year), clamped to [0.7, 1.3]. Level factor is 1.0 where the prior-year window is unavailable. This captures Lent (March whitefish ≈ 2×) and holidays (Dec crab/shrimp/lobster) — exactly what Dana adjusts for in her head — and is explainable in one sentence: *"Last December you sold ~490 cases; you're running about the same pace as last year."*

### 3.8 Lead times & safety stock (editable by Dana, seeded as below)
| Vendor | Seed lead time | Safety days | Source |
|---|---|---|---|
| BXE Bien Xanh (Vietnam) | 84 | 14 | Dana: 10–12 wks; system's 56 is stale |
| AFS Austral Frío (Chile) | 42 | 14 | Dana: ~6 wks; blank in system |
| MNP Maritime Northern (Canada) | 14 | 7 | Dana: ~2 wks |
| ASP Aleutian Shore (Alaska) | 28 | 7 | system |
| DLC Downeast Lobster (Maine) | 21 | 7 | system "2-3 wks" |
BBD (fresh), OCN (old), HCS (cold storage, not a supplier) excluded from planning.

### 3.9 Run-out verdict (per item)
Simulate day by day from today to today + lead + safety + 30 days:
`projected(d) = sellable_on_hand − committed(shipped by d) + incoming(eta ≤ d) − forecast(today..d)`.
- **Run-out date** = first d where projected < 0.
- **Order-by date** = run-out date − lead time.
- Status:
  - **Order now** — order-by date ≤ today + 7 (this week) or already past ("you're late: earliest arrival <today+lead>, gap of N days").
  - **Watch** — order-by within 8–28 days.
  - **OK** — otherwise.
  - **Handled** — Dana marked it handled (stays visible in a collapsed group; auto-expires after its date or 14 days).
- **Suggested qty** = forecast over (lead + safety + 28-day cover window) − projected position at arrival, rounded up to whole cases. Shown as a suggestion, not an order.

### 3.10 Stuck stock
Three reasons, a lot can carry more than one:
1. **Expiring** — sellable lot with `expiry_date < today + 6 months` (2027-05-16). Already-expired lots flagged "expired" (SAL-POR8 HCS L250303-01, SHR-4150 PVD L241202-01). Main story: SAL-POR6/POR8 Chilean salmon, ~1,400+ CS.
2. **Long** — item's sellable on-hand covers > 180 days of forecast demand (or excess over lead+safety+90 days). Show the excess quantity and $ at cost.
3. **Dead** — ZZ / discontinued / dormant items with stock.
Each row shows qty, $ at cost (`qty × unit_cost`), and an **HCS badge** when the stock is at Harbor (sorted to the top — "worst case" per Walt). Expiring lots also show "can sell ~N before the 6-month line" (forecast between today and the line) to separate fixable from lost.

### 3.11 Data warnings panel
A small, collapsible "Data notes" list on the dashboard: merged duplicate item codes, unconvertible units, overdue POs, deduped PO lines, stockout corrections, excluded counts (transfers, samples, credits, cruise). This is the trust-builder: "nobody trusts the current reports".

## 4. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Django + DRF + Postgres API, Next.js frontend; analytics computed per request in Python from normalized tables** | Matches the project template; ~40 items × 1 year is tiny, so per-request computation is fast (<200 ms) and Dana's edits apply instantly | **Chosen** |
| B. Precompute verdicts into tables at load time | Faster reads, but every Dana edit needs a recompute path; more moving parts | Rejected |
| C. Next.js-only (API routes + Postgres), no Django | Simplest deploy, but abandons the template stack the user asked to follow | Rejected |

Hosting (user chose Vercel): **two Vercel projects from the same repo** — `frontend/` (Next.js) and `backend/` (Django on Vercel's Python runtime via WSGI) — plus **Neon Postgres** (Vercel Marketplace, free). The frontend uses Next.js `rewrites` to proxy `/api/*` to the backend, so the browser sees one origin and Django session + CSRF cookies just work. Fallback if Django-on-Vercel misbehaves: backend on Render free tier, frontend unchanged.

## 5. Stack & project standards (from the template, de-branded)

Taken from the template script, with **no Benmore / Aditya references anywhere** (no org name, no license key, no skills-repo clone, LICENSE in Sneha Joshi's name):
- Repo layout: `backend/`, `frontend/`, `context/` (meetings: kickoff transcript; features), `.github/workflows/`, root `Makefile`, `.gitignore`, `.dockerignore`, `gitleaks.toml`, `.pre-commit-config.yaml` (ruff + gitleaks), `README.md`, `LICENSE`.
- Backend: Python 3.12, `uv`, Django 5.2, DRF, drf-spectacular (Swagger at `/api/schema/swagger/`), django-cors-headers, django-environ, psycopg 3, whitenoise, gunicorn, python-json-logger. Settings split `config/settings/{base,dev,prod,test}.py`; `/health/` endpoint. **Dropped**: celery, redis, sentry (optional DSN hook may stay inert).
- Tests: pytest + pytest-django + pytest-cov (fail_under 80) + factory-boy; test settings use SQLite in-memory. Rules module gets the heaviest coverage — one test per data trap in §3.
- Quality: ruff (E,F,I,N,W,UP,B,SIM; line 100), mypy with django-stubs.
- Frontend: Next.js (App Router, TypeScript, Tailwind, `src/`, `@/*` alias), npm.
- Makefile targets: install, dev, dev-frontend, migrate, makemigrations, shell, lint, format, typecheck, test, test-cov, security-scan, check-all, load-data, clean.
- CI (GitHub Actions): ruff check/format, mypy, pytest, gitleaks (personal repo — no license secret needed), `manage.py check`, frontend `tsc --noEmit` + lint. Docker files kept minimal for local Postgres (`docker-compose.yml` with `db` only) — not used for deploy. Claude review workflow omitted.
- Git: author Sneha Joshi <sjoshi32@hawk.iit.edu>, account Joshi2502, commit trailers per session rules.

## 6. Data model (sketch)

- `Vendor(code, name, country, lead_time_days_system, lead_time_days, safety_days, is_supplier)`
- `Item(code, description, category, storage, pack_size_raw, lbs_per_case, planning_uom, vendor, shelf_life_months, status_raw, status, in_scope)`
- `InventoryLot(item, location, lot_no, qty, uom, qty_planning, pack_date, expiry_date, received_date, unit_cost, snapshot_date, is_adjustment)`
- `PurchaseOrderLine(po_no, line_no, vendor, item, order_date, expected_date, qty_ordered, qty_received, uom, status, unit_cost)` — unique on (po_no, line_no) after dedupe
- `SalesLine(order_no, line_no, order_date, ship_date, customer_code, item, qty, uom, unit_price, status)` + `is_clean_demand`, `exclusion_reason`
- `Customer(code, name, type)`
- `HandledFlag(item, note, qty, expected_date, created_at, expires_on, active)` — Dana's "I've handled this"
- `LoadReport(...)` / data-warning rows written by the loader

Loader: `manage.py load_kestrel_data --dir data/` (idempotent: truncate + reload), runs the normalization in §3, records warnings. Run once against Neon.

## 7. API (sketch)

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (session; CSRF)
- `GET /api/dashboard` → `{as_of, order_now[], watch[], handled[], ok_count, stuck[], data_notes[]}`
- `GET /api/items/{code}` → item detail: on-hand by location & lot (sellable / hold / damaged), committed, incoming (with ETA corrections), monthly history (raw vs clean vs corrected), forecast by month, projection series, verdict math
- `POST/DELETE /api/items/{code}/handled`
- `GET/PATCH /api/vendors` (lead time, safety days)

## 8. Frontend (sketch)

Mobile-first, plain language, no jargon ("cases", "lbs", "weeks").

```
Kestrel Bay · Monday Nov 16                       [Lead times] [Log out]
┌ ORDER NOW (4) ───────────────────────────────────────────────┐
│ 16/20 Shrimp  SHR-1620  Out ~Dec 20 · order by TODAY (late)  │
│   Vietnam 12 wks · have 400 cs · coming 600 Dec 28 · ~490/mo │
│   Suggest ~1,150 cs                    [I've handled this ✓] │
│ ...                                                          │
├ WATCH (6) ─ order within 4 weeks ────────────────────────────┤
├ HANDLED (1) ─ collapsed ─────────────────────────────────────┤
├ STUCK STOCK  $xxx,xxx at cost ───────────────────────────────┤
│ [HCS] Atl Salmon 6oz  1,050 cs  expires Feb–Apr 2027  $63k   │
│ [HCS] Tilapia  140 cs  no sales since Apr  $3.7k             │
├ Data notes (9) ▸ ────────────────────────────────────────────┤
```
Item page: big verdict sentence at the top, then "What you have" (by location/lot, hold/damaged greyed), "What's spoken for", "What's coming" (overdue ETAs flagged), a simple demand chart (last year actual vs forecast, Lent/holiday visible, stockout-corrected month marked), and "The math" in one short block. Lead-time settings page: vendor table, editable inline.

## 9. Left to the builder
- Exact parsing regexes, thresholds for dormant (120 d) / stockout (10 d) / long (180 d) as named constants.
- Chart library (keep light — e.g., Recharts) and visual styling.
- Vercel config details for Django (`vercel.json`, `api/index.py` WSGI entry, static via whitenoise or none needed).
- Seed demo user via env vars (`DANA_USERNAME`, `DANA_PASSWORD`) in a data migration or the loader.

## 10. Decisions log
- Repo: `Joshi2502/kestrel-bay` (private); `project-creation.sh` removed from history and kept local only (git-excluded).
- Hosting: Vercel (frontend + backend) + Neon Postgres. *(user)*
- Login: single shared account. *(user)*
- Lead times & safety days per §3.8. *(user approved)*
- Deadline: 1–3 days; aim to ship fast. *(user)*
- Everything else in §3 marked as builder's/Claude's call, documented in README Assumptions.
