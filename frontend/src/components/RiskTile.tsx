import Link from "next/link";
import { arrivalDate, daysBetween, qtyParts, shortDate } from "@/lib/format";
import type { ItemRowData } from "@/lib/types";
import { whyAction, whyArrival, whyGap, whyOrderQty, whyRunOut } from "@/lib/why";
import { GapBar } from "./GapBar";
import { Severity } from "./Severity";
import { tile, tileLink } from "./ui";
import { Why } from "./Why";

export function actionText(row: ItemRowData, asOf: string): string {
  if (row.gap_days > 0) return "Chase the order on the way";
  if (!row.order_by_date) return "No order needed";
  return row.order_by_date <= asOf ? "Order today" : `Order by ${shortDate(row.order_by_date)}`;
}

export function RiskTile({
  row,
  asOf,
  here,
  scaleMax,
  section,
}: {
  row: ItemRowData;
  asOf: string;
  here: string;
  scaleMax: number;
  section: "order" | "watch";
}) {
  const dip = row.gap_days > 0;
  const lands = dip && row.next_eta ? row.next_eta : arrivalDate(row, asOf);
  const runsIn = row.run_out_date ? daysBetween(asOf, row.run_out_date) : null;
  const order = qtyParts(row.suggested_qty, row.uom);
  const late = row.days_late > 0;
  const href = `/items/${encodeURIComponent(row.code)}?from=${encodeURIComponent(here)}`;
  const cell = "relative z-10 inline-block";
  const label = "text-xs text-muted";
  return (
    <li className={tile}>
      {late ? (
        <Severity kind="critical" />
      ) : dip ? (
        <Severity kind="watch" label="Brief dip, order on the way" />
      ) : (
        <Severity kind="watch" label={section === "order" ? "Order this week" : "Tight"} />
      )}
      <Link href={href} className={`${tileLink} mt-2`}>
        {row.description}
      </Link>
      <div className="text-xs text-muted">
        {row.code} · {row.vendor_name}
      </div>
      {row.late_pos.length > 0 && (
        <div className="mt-1 text-xs text-muted">
          {row.only_late_po_cover ? "Only a late order covers this" : "Late order, not counted"}:{" "}
          {row.late_pos.map((p) => p.ref).join(", ")}. Arrival unknown.
        </div>
      )}

      <div className="mt-3">
        <GapBar runsInDays={runsIn} landsInDays={daysBetween(asOf, lands)} scaleMax={scaleMax} />
        <div className={`${cell} mt-1`}>
          <Why content={whyGap(row, asOf, here)}>
            {late ? (
              <>
                <span className="text-2xl font-semibold text-critical">{row.days_late}</span>{" "}
                <span className="text-sm text-muted">days short</span>
              </>
            ) : dip ? (
              <>
                <span className="text-2xl font-semibold">{row.gap_days}</span>{" "}
                <span className="text-sm text-muted">{row.gap_days === 1 ? "day" : "days"} short, then it lands</span>
              </>
            ) : (
              <span className="text-md font-semibold">Lands in time</span>
            )}
          </Why>
        </div>
      </div>

      <dl className="mt-auto grid pt-3 grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className={label}>Runs out</dt>
          <dd className={cell}>
            <Why content={whyRunOut(row, asOf, here)}>{row.run_out_date ? shortDate(row.run_out_date) : "—"}</Why>
          </dd>
        </div>
        <div>
          <dt className={label}>{dip ? "On the way lands" : "Reorder lands"}</dt>
          <dd className={cell}>
            <Why content={whyArrival(row, asOf, here)}>{shortDate(lands)}</Why>
          </dd>
        </div>
        <div>
          <dt className={label}>Suggested</dt>
          <dd className={cell}>
            <Why content={whyOrderQty(row, asOf, here)}>
              {row.suggested_qty > 0 ? (
                <>
                  {order.value} <span className="text-muted">{order.unit}</span>
                </>
              ) : (
                "—"
              )}
            </Why>
          </dd>
        </div>
        <div>
          <dt className={label}>What to do</dt>
          <dd className={cell}>
            <Why content={whyAction(row, asOf, here)}>{actionText(row, asOf)}</Why>
          </dd>
        </div>
      </dl>
    </li>
  );
}
