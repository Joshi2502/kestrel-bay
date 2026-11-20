import type { Uom } from "./types";

// Single source of number formatting. Every figure on screen goes through here.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NBSP = " ";

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

export function groupedInt(value: number): string {
  return Math.round(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Quantity as number + unit, e.g. "480 cs", "1,200 lbs". */
export function qtyParts(value: number, uom: Uom | string): { value: string; unit: string } {
  return { value: groupedInt(value), unit: uom === "LB" ? "lbs" : "cs" };
}

export function qty(value: number, uom: Uom | string): string {
  const p = qtyParts(value, uom);
  return `${p.value}${NBSP}${p.unit}`;
}

/** Whole dollars in tables: $117,599. */
export function money(value: number): string {
  return `$${groupedInt(value)}`;
}

/** Compact dollars for headlines: $118k, $1.2M. */
export function moneyShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return money(value);
}

export function days(value: number): string {
  const n = Math.round(value);
  return `${groupedInt(n)}${NBSP}${Math.abs(n) === 1 ? "day" : "days"}`;
}

export function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = parts(iso);
  return `${MONTHS[m - 1]} ${d}`;
}

export function longDate(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "Nov 29" within the reference year, "Nov 29, 2027" otherwise. */
export function dateIn(iso: string, asOf: string): string {
  return parts(iso)[0] === parts(asOf)[0] ? shortDate(iso) : longDate(iso);
}

export function weekdayDate(iso: string): string {
  const [y, m, d] = parts(iso);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  return `${weekday}, ${MONTHS[m - 1]} ${d}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ’${String(year).slice(2)}`;
}

function toUtc(iso: string): number {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86_400_000);
}

/** "in 9 days", "today", "3 days ago" relative to the as-of date. */
export function relativeDate(iso: string, asOf: string): string {
  const n = daysBetween(asOf, iso);
  if (n === 0) return "today";
  return n > 0 ? `in ${days(n)}` : `${days(-n)} ago`;
}

export function addDays(iso: string, n: number): string {
  return new Date(toUtc(iso) + n * 86_400_000).toISOString().slice(0, 10);
}

/** The API's earliest arrival, or today + lead time when it is absent (same rule the backend uses). */
export function arrivalDate(row: { earliest_arrival: string | null; lead_days: number }, asOf: string): string {
  return row.earliest_arrival ?? addDays(asOf, row.lead_days);
}

/** Units per day: one decimal under 10, whole numbers above, so "4.3 cs/day" and "16 cs/day" read evenly. */
export function perDay(value: number, uom: Uom | string): string {
  const unit = uom === "LB" ? "lbs" : "cs";
  const shown = value < 10 ? value.toFixed(1) : groupedInt(value);
  return `${shown}${NBSP}${unit}/day`;
}
