# Kestrel Bay — Inventory for Dana

Sneha Joshi's take-home project. **Not a client/agency project: no company branding, no references to anyone else's org or accounts.** LICENSE and authorship are Sneha Joshi.

## Git & GitHub rules (non-negotiable)
- Account: **Joshi2502** only — run `gh auth status` and confirm it is active before any push/PR. Never push with any other logged-in `gh` account.
- Repo: https://github.com/Joshi2502/kestrel-bay (private). Identity (repo-local): `Sneha Joshi <sjoshi32@hawk.iit.edu>`.
- Repo-local `credential.helper` is `!gh auth git-credential` so pushes use the active `gh` account.
- **No `Co-Authored-By` trailers and no "Generated with Claude Code" lines** in commits or PRs.
- `project-creation.sh` is a local-only reference (git-excluded) — never commit it.

## What this is
One Monday screen for Dana (VP Purchasing): (1) what will run out before a reorder can arrive, (2) what stock we're stuck with. Every number must be traceable. Spec: `docs/superpowers/specs/2026-11-19-dana-inventory-design.md`. Plan: `docs/superpowers/plans/2026-11-19-dana-inventory.md`. Kickoff transcript: `context/meetings/`.

## Stack & layout
- `backend/` Django 5.2 + DRF (uv). Settings split `config/settings/{base,dev,prod,test}.py`. App `inventory/`; pure business rules in `inventory/rules/`.
- `frontend/` Next.js (App Router, TS, Tailwind). **Its Next.js version has breaking changes — read `frontend/node_modules/next/dist/docs/` before writing frontend code.**
- `data/` BlueTide CSV exports (never edit). Loaded once by `manage.py load_kestrel_data`.
- Deploy: Vercel (frontend + backend as two projects) + Neon Postgres.

## Rules that matter
- "Today" is `settings.AS_OF_DATE` (2026-11-16). Never `date.today()` in logic.
- Sellable = locations NB/PVD/HCS only. QA-HOLD shown separately; DAMAGED ignored.
- Business rules live in `inventory/rules/` as pure functions with one test per data trap.
- TDD: failing test first. No Celery/Redis/Sentry.

## Commands
`make install | dev | dev-frontend | migrate | load-data | test | lint | typecheck | check-all`

## Build status
See `.superpowers/sdd/2026-11-19-dana-inventory/progress.md` (local ledger) and `git log`. Update this section as tasks complete.
- [x] Task 1 scaffold
