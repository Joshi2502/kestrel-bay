import Link from "next/link";
import { money, qtyParts, shortDate } from "@/lib/format";
import type { StuckRowData } from "@/lib/types";
import { whyStuckValue } from "@/lib/why";
import { Severity } from "./Severity";
import { tile, tileLink } from "./ui";
import { Why } from "./Why";

const REASON_WORDS: Record<StuckRowData["reasons"][number], string> = {
  expired: "Expired",
  expiring: "Under 6 months of shelf life left",
  long: "More than 6 months of stock",
  dead: "Not selling",
};

export function reasonText(row: StuckRowData): string {
  return row.reasons.map((r) => REASON_WORDS[r]).join(" · ");
}

export function StuckTile({ row, asOf, here }: { row: StuckRowData; asOf: string; here: string }) {
  const q = qtyParts(row.qty, row.uom);
  const href = `/items/${encodeURIComponent(row.code)}?from=${encodeURIComponent(here)}`;
  const cell = "relative z-10 inline-block";
  const label = "text-xs text-muted";
  return (
    <li className={tile}>
      <div className="line-clamp-2">
        <Severity kind="stuck" label={reasonText(row)} />
      </div>
      <Link href={href} className={`${tileLink} mt-1`}>
        {row.description}
      </Link>
      <div className="text-xs text-muted">
        {row.code}
        {row.lot_no ? ` · lot ${row.lot_no}` : ""}
      </div>
      <div className="mt-3">
        <span className={`${cell} text-2xl font-semibold`}>
          <Why content={whyStuckValue(row, asOf, here)}>{money(row.value_at_cost)}</Why>
        </span>{" "}
        <span className="text-sm text-muted">at cost</span>
      </div>
      <dl className="mt-auto grid pt-3 grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className={label}>Quantity</dt>
          <dd>
            {q.value} <span className="text-muted">{q.unit}</span>
          </dd>
        </div>
        <div>
          <dt className={label}>Expires</dt>
          <dd>{row.expiry_date ? shortDate(row.expiry_date) : "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className={label}>Where</dt>
          <dd>{row.at_hcs ? "Harbor Cold Storage" : (row.location ?? "—")}</dd>
        </div>
      </dl>
    </li>
  );
}
