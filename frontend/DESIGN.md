# Kestrel Bay — Design direction: "Quiet ledger"

Cool paper, ink-dark numerals, hairline rules, almost no fills. It reads like an accountant's tape that
happens to be interactive. Teal means "you can act here", and nothing else.

Audience: Dana (VP Purchasing, laptop-first, decides what to reorder) and Walt (CEO, phone glance, five seconds).
Feel: calm, trustworthy, instant. Not: cluttered, jargon-heavy, alarmist.

Scope: frontend only. No backend, endpoint or calculation changes. Every number still comes from the same API field;
only how it is shown and explained changes.

## Decisions taken on the owner's behalf (revisit if they go wrong)
1. Data is fetched in Server Components with streaming. The session cookie is forwarded to Django server-side.
2. Daily usage and days of cover are derived for display only, from fields the API already returns (see "Derived figures").
3. No separate product brief was supplied; framing comes from the owner's earlier answers (above).

## Tokens

All colours are OKLCH CSS variables in `globals.css`, exposed to Tailwind v4 via `@theme`. No raw hex in components.
Neutrals are tinted toward the teal hue (~200–215). Dark mode is re-tuned, not inverted. Every text/background
pair was checked against WCAG AA (4.5:1 text, 3:1 UI) in both themes.

| Token | Light | Dark |
|---|---|---|
| `bg` | 0.975 0.006 200 | 0.17 0.012 210 |
| `surface` | 0.995 0.003 200 | 0.21 0.014 210 |
| `raised` | 0.99 0.004 200 | 0.25 0.015 210 |
| `border` | 0.90 0.01 200 | 0.30 0.015 210 |
| `border-strong` | 0.62 0.025 205 | 0.55 0.03 208 |
| `text` | 0.22 0.02 215 | 0.93 0.01 200 |
| `muted` | 0.46 0.02 210 | 0.72 0.02 205 |
| `accent` | 0.447 0.073 210.6 (#0f5f6b) | 0.74 0.09 205 |
| `accent-contrast` | 0.98 0.01 200 | 0.18 0.02 210 |
| `critical` / `critical-bg` | 0.50 0.17 32 / 0.955 0.03 35 | 0.78 0.12 35 / 0.28 0.05 35 |
| `watch` / `watch-bg` | 0.46 0.10 75 / 0.955 0.05 88 | 0.82 0.10 85 / 0.28 0.05 85 |
| `stuck` / `stuck-bg` | 0.46 0.075 255 / 0.95 0.022 255 | 0.78 0.07 255 / 0.26 0.03 255 |

Severity is never colour alone: a shape plus a word.
- critical: filled square, "Runs out before reorder". The only strong colour on the screen.
- watch: half-filled square, "Tight".
- stuck: hollow circle, "Stuck". Cool blue, not red: a money problem, not an emergency.

Theme: light / dark / system toggle. Choice persisted in a `theme` cookie, read in the root layout so the server
renders the right theme (`data-theme` on `<html>`, no flash). `system` follows `prefers-color-scheme`.

Type (next/font, display swap, only the weights used):
- Source Serif 4 (OFL): 400, 600. Only for the one headline sentence.
- IBM Plex Sans (OFL): 400, 500, 600. Everything else. IBM Plex Mono (OFL, 400) only inside "why" formulas.
- Scale ≈1.2: `--text-xs 12`, `sm 13`, `base 14`, `md 17`, `lg 20`, `xl 24`, `2xl 29` (px). Dense UI, so it tops out low.
- Every number: `font-variant-numeric: tabular-nums`, right-aligned in columns, units in muted text.
- Headings use `text-wrap: balance`.

Space, shape, motion
- 4px spacing scale only. Two radii: `--radius-sm 4px`, `--radius-md 8px`. Two shadows max: `--shadow-pop` (popover) and `--shadow-sheet`.
- Depth comes from borders and surface steps. Motion is 120ms / 200ms, one easing, transform and opacity only,
  and fully off under `prefers-reduced-motion`.

## Formatting (single source: `src/lib/format.ts`)
Every number goes through it: `qty`, `money`, `days`, `percent`, `relativeDate`, `shortDate`, `longDate`.
- Quantity: thousands grouped with a comma, 0 decimals, unit in muted text (`480 cs`, `1,200 lbs`).
- Currency: `$117,599` in tables, `$118k` in the headline strip. Never mixed within one table.
- Days: `9 days`, `1 day`. Lead time is always shown in days (never weeks), because the gap is in days.
- Dates: `Nov 29` within the current year, `Nov 29, 2027` otherwise. Weekday only in the headline.

## Derived figures (display only)
- Daily use = `demand_next_30d / 30` (API field already returned), shown for reference only.
- Days of cover = API `run_out_date` − as-of date (no division). Items with no run-out show "Past the window".
- "Runs out in N days" and "reorder lands in N days" are date differences from API dates.
- As-of date on the item page is the first point of the API `projection` series (the item payload has no as_of).

## Component inventory
- `Why` (client): a number that explains itself. Quiet dotted underline on hover/focus. Desktop: native `popover`
  anchored to the number. Phone: bottom sheet via `<dialog>`. Contents in order: sentence, ruled input ledger,
  formula, as-of, link to the item. Enter/Space opens, Esc closes, focus returns, `aria-expanded`/`aria-controls`.
- `Severity`: shape + word marker.
- `Num`: formatted, tabular, unit muted, optionally wrapped in `Why`.
- `DataTable`: sticky header, right-aligned numerics, row hover, whole row links to the item.
- `HeadlineStrip` (server): sentence plus 2–3 figures as a typographic strip.
- `GapBar`: days of cover vs lead time, one thin inline bar.
- `ThemeToggle` (client leaf), `Button`, `Skeleton`, `EmptyState`, `ErrorState`.
- Chart (`StockProjection`, Recharts, lazy): projected stock, zero line, reorder-arrival marker. No gradients.

## Do
- Lead with the sentence, then the table. Say "runs out before reorder arrives", not "stockout risk".
- Keep technical terms inside the "why" panel with a plain definition.
- Right-align numbers; keep units muted; keep decimals consistent per unit.
- State good news plainly ("Everything else is covered").

## Don't
- No gradients, glass, glows, blobs, noise, emoji, sparkle badges or "AI insight".
- No row of identical KPI cards, donut/gauge charts, count-up animation, pulsing or flashing.
- No exclamation marks, all-caps warnings, or red outside "runs out before reorder".
- No raw hex in components, no off-scale spacing, no third radius or shadow.
- No component libraries; no new dependency over ~15KB gzipped without asking.

## Copy decisions made
- The first table is titled "Order now", not "Runs out before reorder arrives": the backend puts an item there when its
  last day to order is within 7 days, even if it would not run out first (e.g. Lobster Meat). The headline counts only
  true run-outs (`days_late > 0`).
- The retired "demand by month" bar chart is gone; the one chart is projected stock.

## Needs backend (not built; fallbacks noted)
- Last-updated timestamp (API gives only the fixed as-of date). Fallback: show "As of {date}".
- Stuck stock: days on hand, last sale date, suggested action. Fallback: show what `reasons`/`detail` already say.
- Past stock movements for an item. Fallback: show incoming POs and open orders only.
- A real stock-over-time series with the reorder marker: the existing `projection` array is used as is.
