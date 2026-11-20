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
- `frontend/` Next.js 16 (App Router, TS, Tailwind v4, Recharts). **Its Next.js version has breaking changes — read `frontend/node_modules/next/dist/docs/` before writing frontend code.** Design system and rules: `frontend/DESIGN.md` ("Quiet ledger"). Read it before any UI change.
- `data/` BlueTide CSV exports (never edit). Loaded once by `manage.py load_kestrel_data`.
- Deploy: Vercel (frontend + backend as two projects) + Neon Postgres.

## Rules that matter
- "Today" is `settings.AS_OF_DATE` (2026-11-16). Never `date.today()` in logic.
- Sellable = locations NB/PVD/HCS only. QA-HOLD shown separately; DAMAGED ignored.
- Business rules live in `inventory/rules/` as pure functions with one test per data trap.
- TDD: failing test first. No Celery/Redis/Sentry.

## Frontend rules (see frontend/DESIGN.md)
- Pages are Server Components that fetch Django directly via `src/lib/server-api.ts` (session cookie forwarded). Client components only at small leaves (Why popover, theme toggle, scroll row, handled/vendor forms, chart). Mutations go through the browser `/api` proxy.
- UI is Netflix-style scrolling tile rows (`ScrollRow`, `RiskTile`, `StuckTile`, `MiniTile`), not tables or lists. Keep it that way.
- Every number goes through `src/lib/format.ts`; every explainable number is wrapped in `Why` (content built in `src/lib/why.ts` from API fields only).
- Tokens are OKLCH CSS variables in `globals.css`; no raw hex, no Tailwind default palette. Severity = shape + word, never colour alone. No gradients, glass, emoji, pulsing.
- Never change backend calculations from a frontend task. Wanted-but-missing data is listed in DESIGN.md "Needs backend".
- Theme is a `theme` cookie (light/dark/none=system) read in the root layout.

## Commands
`make install | dev | dev-frontend | migrate | load-data | test | lint | typecheck | check-all`
Frontend (from `frontend/`): `npm test` (node:test on `src/lib/*.test.ts`), `npm run lint`, `npx tsc --noEmit`, `npm run build`. CI runs all four.

## Deploy
- Frontend: push to `main` auto-deploys (Vercel git-connected, Root Directory `frontend`). Don't run `vercel deploy` inside `frontend/`.
- Backend: not git-linked. From `backend/`: `vercel deploy --prod`. Neon creds are in the Vercel project env; never print them.
- Local run against real data: scratch SQLite (`DATABASE_URL=sqlite:///<path> manage.py migrate && load_kestrel_data --dir ../data`), `runserver 8000`, `npm run build && npx next start -p 3000`.

## Build status
See `.superpowers/sdd/2026-11-19-dana-inventory/progress.md` (local ledger) and `git log`. Update this section as tasks complete.
- [x] Tasks 1–9 done (backend rules + API + login, frontend UI)
- [x] Frontend redesign (branch `frontend/redesign`, merged to `main`, live): Quiet ledger tokens, light/dark/auto toggle, "why" popover/sheet on every number, headline sentence + figure strip, tile rows, item page with stock-projection chart, server-side fetching with skeleton/error states.
- [ ] Open for next session: owner decisions in DESIGN.md ("Copy decisions made"); needs-backend items (last-updated timestamp, stuck days-on-hand/last-sale/suggested action, stock movements); optional git-link for the backend Vercel project; known nits (no login throttling, dashboard recomputes ~15k rows per request, chart marker labels tight on phones, only tested in Chrome).
- [x] Task 10 deployed. Frontend https://kestrel-bay-rosy.vercel.app, API https://kestrel-bay-api-eta.vercel.app (Vercel team "Sneha Joshi's projects"), Neon DB `kestrel-bay-db`. Frontend project is git-connected (Joshi2502/kestrel-bay, `main`, Root Directory `frontend`): a push to `main` deploys it. The backend project is NOT git-linked: redeploy it from `backend/` with `vercel deploy --prod`. Do not run `vercel deploy` from inside `frontend/` any more (Root Directory would double up). Demo login dana / kestrel-monday.
