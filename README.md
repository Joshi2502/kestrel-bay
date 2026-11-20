# Kestrel Bay — Inventory for Dana

A small web app that gives Kestrel Bay Seafood's VP of Purchasing one Monday-morning screen:
what will run out before a new order could arrive, and what stock the company is stuck with.
Built from the raw BlueTide exports in `data/`.

## Quick Start

```bash
make install      # backend + frontend dependencies
make db-up        # local Postgres (docker)
make migrate
make load-data    # one-time CSV load
make dev          # Django on :8000
make dev-frontend # Next.js on :3000
```

## Stack

- **Backend:** Django 5.x + Django REST Framework (Python 3.12, uv)
- **Frontend:** Next.js (App Router) + TypeScript + TailwindCSS
- **Database:** PostgreSQL (Neon in production)
- **Hosting:** Vercel

## Commands

```bash
make test        # backend tests
make lint        # ruff
make typecheck   # mypy
make check-all   # lint + typecheck + test + secret scan
```

API docs: http://localhost:8000/api/schema/swagger/

## Live app

- **Live link:** _(added after deploy)_
- **Demo login:** `dana` / `kestrel-monday`

## How it works

One screen answers Dana's two Monday questions. Every figure drills down to the lots, orders and
sales behind it, and she can tell it things BlueTide doesn't know (real lead times, "I've already
ordered this"). Business rules are pure, unit-tested functions in `backend/inventory/rules/`; the
full reasoning is in `docs/superpowers/specs/2026-11-19-dana-inventory-design.md`.

## Assumptions

Where the exports and the kickoff call left something open, this is what I decided.

**Dates and scope**
- "Today" is **Monday Nov 16, 2026** (set in config, never the computer's clock).
- Fresh/day-boat items (`FR-*`) are out: Dana said she doesn't need help there. Marco's asks
  (availability, pricing, routes, emails) are out too.
- `ZZ-*` items are dead whatever their status says. Statuses `A`, `active`, blank → active;
  `DISC`, `Discontinued` → discontinued.
- An active item with no real sales for 120 days is **dormant** (PAN-1012, SHR-6170, TIL-FIL). It
  gets no run-out verdict; any stock shows under Stuck stock.

**Stock**
- Only the **latest nightly snapshot** (Nov 15) counts; the file holds two nights.
- Sellable = New Bedford, Providence, Harbor. **QA-HOLD** is shown but not counted (it may come
  back). **DAMAGED** is ignored. Location doesn't matter for ordering, only for Harbor's storage cost.
- Duplicate item codes that differ only in case/spaces (`shr-1620 `, `Sal-Por6`, `COD-LOIN `) are
  merged into the clean code; their stock and sales are added to it.
- Lots received in pounds for case items (CAL-RING, LOB-T56) are converted with the case weight
  parsed from the free-text pack size (`6x2.2lb`, `10 lb cs`, `10/2#`, `5kg`, ...).
- Negative `ADJ-*` rows are inventory adjustments and net against on-hand; zero-quantity lots are dropped.

**Demand**
- Real demand = invoiced lines with a positive quantity and price. Left out: cancelled lines,
  credits (negative sales), $0 samples, `TRANSFER - PVD`, and the one-off cruise-line order.
  Counts are shown on the dashboard under "How the numbers were cleaned".
- Demand is dated by ship date.
- **Booked-but-unshipped orders** are already promised. Each month's expected shipping is the larger
  of the forecast and what's booked, never both added together.
- **Stockouts:** when an item that normally sells every week goes 10+ days with no sales between two
  sales, that's treated as being out of stock, and the month's demand is scaled to the in-stock
  days. This is what stops last December's shrimp stockout from understating this December.
- **Forecast** = the same calendar month last year (stockout-corrected). That carries Lent and the
  holidays. A pace factor (last 8 weeks vs the same 8 weeks last year, limited to 0.7–1.3) exists but
  stays at 1.0 here, because the history starts 2025-10-29 and doesn't cover the prior-year window.

**Orders on the way**
- Only `Open` PO lines count. Exact duplicate lines are counted once. Outstanding =
  ordered − received, so a part-received PO still counts its remainder.
- A PO still open past its expected date hasn't arrived. Its arrival is re-estimated at today + 14
  days (imports) or + 7 days (domestic), and the screen says what the vendor originally said.
- "I've handled this" with a quantity and date counts as stock on the way; without them it parks the
  item for 14 days.

**Lead times and buffers** (editable in the app)

| Vendor | Lead time | Buffer |
|---|---|---|
| Bien Xanh (Vietnam) | 84 days (10–12 weeks; BlueTide's 56 is stale) | 14 days |
| Austral Frío (Chile) | 42 days (blank in BlueTide) | 14 days |
| Maritime Northern Pack (Canada) | 14 days | 7 days |
| Aleutian Shore (Alaska) | 28 days | 7 days |
| Downeast Lobster (Maine) | 21 days ("2-3 wks" in BlueTide) | 7 days |

**Verdicts**
- Run-out = first day projected stock goes below zero. Order-by = run-out − lead time.
- **Order now** = order-by is within 7 days (or already past). **Watch** = within 28 days.
- Suggested quantity covers the buffer plus 28 days after the order would arrive, rounded up to
  whole cases.

**Stuck stock**
- Lots with under **6 months** of shelf life left (nobody will take them), including already-expired
  lots; item-level "too much stock" above 180 days of cover (only the part not already flagged);
  and dead/dormant items. Valued at cost. Harbor stock is listed first.

## Original brief

> # Kestrel Bay Seafood: take-home
> 
> **Treat Monday, November 16, 2026 as today.** The kickoff call was the week before (Nov 10), and the data runs to the Nov 15 snapshot. Use Nov 16 for anything date-based (expiry, run-out, lead times), not your computer's clock.
> 
> 1. Read `kickoff-call-transcript.md`. That's the customer, and the requirements.
> 2. `data/` holds the exports Kestrel Bay sent after the call, exactly as they came out of their system.
> 3. The task, timing and what to submit are in the email we sent. Questions: email me and I'll answer as Dana would, or make a reasonable assumption and write it down.
