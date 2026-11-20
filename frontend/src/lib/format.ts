import type { Uom } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
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

export function qty(value: number, uom: Uom | string): string {
  const unit = uom === "LB" ? "lbs" : "cs";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${unit}`;
}

export function money(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function weeks(days: number): string {
  return `${Math.round(days / 7)} wks`;
}
