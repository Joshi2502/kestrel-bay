import Link from "next/link";
import { money, qtyParts, shortDate } from "@/lib/format";
import { type Dir, type Params, type StuckSort, withParams } from "@/lib/sort";
import type { StuckRowData } from "@/lib/types";
import { whyStuckValue } from "@/lib/why";
import { PlainHeader, SortHeader } from "./SortHeader";
import { Severity } from "./Severity";
import { Why } from "./Why";

const REASON_WORDS: Record<StuckRowData["reasons"][number], string> = {
  expired: "Expired",
  expiring: "Under 6 months of shelf life left",
  long: "More than 6 months of stock",
  dead: "Not selling",
};
const DEFAULT_DIR: Record<StuckSort, Dir> = { value: "desc", qty: "desc", expiry: "asc" };

export function reasonText(row: StuckRowData): string {
  return row.reasons.map((r) => REASON_WORDS[r]).join(" · ");
}

export function StuckTable({
  rows,
  asOf,
  sort,
  dir,
  params,
  here,
}: {
  rows: StuckRowData[];
  asOf: string;
  sort: StuckSort;
  dir: Dir;
  params: Params;
  here: string;
}) {
  const head = (key: StuckSort, label: string, align: "left" | "right" = "right") => {
    const active = sort === key;
    const nextDir: Dir = active ? (dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[key];
    return (
      <SortHeader
        label={label}
        href={withParams(params, { ssort: key, sdir: nextDir })}
        active={active}
        dir={dir}
        align={align}
      />
    );
  };
  const itemHref = (code: string) => `/items/${encodeURIComponent(code)}?from=${encodeURIComponent(here)}`;
  const nameLink = "font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-offset-[-2px]";
  const where = (r: StuckRowData) => (r.at_hcs ? "Harbor Cold Storage" : (r.location ?? "—"));
  const key = (r: StuckRowData, i: number) => `${r.code}-${r.lot_no ?? ""}-${r.location ?? ""}-${i}`;

  return (
    <>
      <table className="hidden w-full md:table">
        <thead>
          <tr>
            <PlainHeader label="Item" />
            <PlainHeader label="Where" />
            <PlainHeader label="Why it is stuck" />
            {head("qty", "Quantity")}
            {head("value", "Value at cost")}
            {head("expiry", "Expires")}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const q = qtyParts(r.qty, r.uom);
            return (
              <tr key={key(r, i)} className="relative border-b border-border align-top hover:bg-raised focus-within:bg-raised">
                <td className="py-3 pr-4">
                  <Link href={itemHref(r.code)} className={nameLink}>
                    {r.description}
                  </Link>
                  <div className="text-xs text-muted">
                    {r.code}
                    {r.lot_no ? ` · lot ${r.lot_no}` : ""}
                  </div>
                </td>
                <td className="py-3 pr-4 text-muted">{where(r)}</td>
                <td className="py-3 pr-4">
                  <Severity kind="stuck" label={reasonText(r)} />
                </td>
                <td className="py-3 pr-4 text-right">
                  {q.value} <span className="text-muted">{q.unit}</span>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="relative z-10 inline-block">
                    <Why content={whyStuckValue(r, asOf, here)}>{money(r.value_at_cost)}</Why>
                  </span>
                </td>
                <td className="py-3 pr-4 text-right text-muted">{r.expiry_date ? shortDate(r.expiry_date) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="md:hidden">
        {rows.map((r, i) => (
          <li key={key(r, i)} className="relative border-b border-border py-3">
            <Link href={itemHref(r.code)} className={nameLink}>
              {r.description}
            </Link>
            <div className="text-xs text-muted">
              {r.code} · {where(r)}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-4 text-sm">
              <Severity kind="stuck" label={reasonText(r)} />
              <span className="relative z-10">
                <Why content={whyStuckValue(r, asOf, here)}>{money(r.value_at_cost)}</Why>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
