import type { StuckRowData } from "./types";

export type Dir = "asc" | "desc";
export type StuckSort = "value" | "qty" | "expiry";
export type Params = Record<string, string | string[] | undefined>;

/** Same query string with some keys replaced; used so sort links and "back" keep state. */
export function withParams(params: Params, patch: Record<string, string | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined) q.set(k, value);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `/?${s}` : "/";
}

const sign = (dir: Dir) => (dir === "asc" ? 1 : -1);

export function sortStuck(rows: StuckRowData[], key: StuckSort, dir: Dir): StuckRowData[] {
  const out = [...rows];
  out.sort((a, b) => {
    if (key === "value") return (a.value_at_cost - b.value_at_cost) * sign(dir);
    if (key === "qty") return (a.qty - b.qty) * sign(dir);
    return (a.expiry_date ?? "9999").localeCompare(b.expiry_date ?? "9999") * sign(dir);
  });
  return out;
}
