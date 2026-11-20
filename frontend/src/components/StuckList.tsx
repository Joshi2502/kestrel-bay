"use client";

import Link from "next/link";
import { useState } from "react";
import type { StuckRowData } from "@/lib/types";
import { longDate, money, qty } from "@/lib/format";

const BADGE: Record<string, { label: string; className: string }> = {
  expired: { label: "Expired", className: "bg-danger-bg text-danger" },
  expiring: { label: "Under 6 months left", className: "bg-warn-bg text-warn" },
  long: { label: "Too much stock", className: "bg-calm-bg text-calm" },
  dead: { label: "Dead item", className: "bg-calm-bg text-calm" },
};

export function StuckList({ rows, limit = 8 }: { rows: StuckRowData[]; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <div>
      <ul className="space-y-2">
        {shown.map((row, i) => (
          <li key={`${row.code}-${row.lot_no ?? "all"}-${i}`} className="rounded-lg border border-line bg-surface p-3">
            <Link href={`/items/${row.code}`} className="block">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{row.description}</h3>
                <span className="shrink-0 font-semibold">{money(row.value_at_cost)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                {row.at_hcs && (
                  <span className="rounded bg-danger-bg px-1.5 py-0.5 text-xs font-semibold text-danger">
                    Harbor — paying storage
                  </span>
                )}
                {row.reasons.map((reason) => (
                  <span key={reason} className={`rounded px-1.5 py-0.5 text-xs font-medium ${BADGE[reason].className}`}>
                    {BADGE[reason].label}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-sm text-muted">
                {qty(row.qty, row.uom)}
                {row.lot_no && <> · lot {row.lot_no}</>}
                {row.location && <> · {row.location}</>}
                {row.expiry_date && <> · expires {longDate(row.expiry_date)}</>}
              </p>
              <p className="text-sm text-muted">{row.detail}</p>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > limit && (
        <button onClick={() => setAll(!all)} className="mt-2 text-sm text-accent hover:underline">
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
