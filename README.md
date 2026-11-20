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

## Assumptions

_(Filled in as rules land — see `docs/superpowers/specs/2026-11-19-dana-inventory-design.md` §3.)_

## Original brief

> # Kestrel Bay Seafood: take-home
> 
> **Treat Monday, November 16, 2026 as today.** The kickoff call was the week before (Nov 10), and the data runs to the Nov 15 snapshot. Use Nov 16 for anything date-based (expiry, run-out, lead times), not your computer's clock.
> 
> 1. Read `kickoff-call-transcript.md`. That's the customer, and the requirements.
> 2. `data/` holds the exports Kestrel Bay sent after the call, exactly as they came out of their system.
> 3. The task, timing and what to submit are in the email we sent. Questions: email me and I'll answer as Dana would, or make a reasonable assumption and write it down.
