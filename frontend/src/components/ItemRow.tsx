import Link from "next/link";
import type { ItemRowData } from "@/lib/types";
import { qty, shortDate, weeks } from "@/lib/format";
import { HandledButton } from "./HandledButton";

const TONE = {
  order_now: "border-l-danger",
  watch: "border-l-warn",
  handled: "border-l-calm",
  ok: "border-l-good",
} as const;

export function ItemRow({ row, onChanged }: { row: ItemRowData; onChanged: () => void }) {
  return (
    <li className={`rounded-lg border border-line border-l-4 bg-surface p-3 ${TONE[row.status]}`}>
      <Link href={`/items/${row.code}`} className="block">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold">{row.description}</h3>
          <span className="shrink-0 text-xs text-muted">{row.code}</span>
        </div>
        <p className="mt-0.5 text-sm font-medium">{row.headline}</p>
        <p className="mt-1 text-sm text-muted">
          Have {qty(row.sellable, row.uom)}
          {row.committed_total > 0 && <> · {qty(row.committed_total, row.uom)} promised</>}
          {row.incoming_total > 0 && (
            <>
              {" "}
              · {qty(row.incoming_total, row.uom)} on the way
              {row.next_eta && ` (next ${shortDate(row.next_eta)})`}
            </>
          )}{" "}
          · ~{qty(row.demand_next_30d, row.uom)} to ship in 30 days
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {row.vendor_name}, {row.country} · {weeks(row.lead_days)} to arrive
          {row.suggested_qty > 0 && row.status !== "handled" && (
            <>
              {" "}
              · <span className="font-medium text-foreground">suggest ~{qty(row.suggested_qty, row.uom)}</span>
            </>
          )}
        </p>
        {row.handled_note && (
          <p className="mt-1 text-sm text-muted">Your note: “{row.handled_note}”</p>
        )}
      </Link>
      <div className="mt-2 flex">
        <HandledButton code={row.code} handled={row.status === "handled"} onChanged={onChanged} />
      </div>
    </li>
  );
}
