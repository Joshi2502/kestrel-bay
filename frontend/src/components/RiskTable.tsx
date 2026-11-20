import Link from "next/link";
import { arrivalDate, daysBetween, qtyParts, relativeDate, shortDate } from "@/lib/format";
import { type Dir, type Params, type RiskSort, withParams } from "@/lib/sort";
import type { ItemRowData } from "@/lib/types";
import { whyAction, whyArrival, whyGap, whyOrderQty, whyRunOut } from "@/lib/why";
import { GapBar } from "./GapBar";
import { PlainHeader, SortHeader } from "./SortHeader";
import { Why } from "./Why";

const DEFAULT_DIR: Record<RiskSort, Dir> = { urgency: "asc", item: "asc", order: "desc" };

function actionText(row: ItemRowData, asOf: string): string {
  if (!row.order_by_date) return "No order needed";
  return row.order_by_date <= asOf ? "Order today" : `Order by ${shortDate(row.order_by_date)}`;
}

export function RiskTable({
  rows,
  asOf,
  sort,
  dir,
  params,
  here,
  scaleMax,
}: {
  rows: ItemRowData[];
  asOf: string;
  sort: RiskSort;
  dir: Dir;
  params: Params;
  here: string;
  scaleMax: number;
}) {
  const head = (key: RiskSort, label: string, align: "left" | "right" = "left") => {
    const active = sort === key;
    const nextDir: Dir = active ? (dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[key];
    return (
      <SortHeader
        label={label}
        href={withParams(params, { sort: key, dir: nextDir })}
        active={active}
        dir={dir}
        align={align}
      />
    );
  };
  const itemHref = (code: string) => `/items/${encodeURIComponent(code)}?from=${encodeURIComponent(here)}`;
  const nameLink = "font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-offset-[-2px]";

  return (
    <>
      <table className="hidden w-full md:table">
        <thead>
          <tr>
            {head("item", "Item")}
            {head("urgency", "Runs out", "right")}
            <PlainHeader label="Reorder lands" align="right" />
            <PlainHeader label="Gap" />
            {head("order", "Suggested order", "right")}
            <PlainHeader label="What to do" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const runsIn = row.run_out_date ? daysBetween(asOf, row.run_out_date) : null;
            const lands = arrivalDate(row, asOf);
          const landsIn = daysBetween(asOf, lands);
            const order = qtyParts(row.suggested_qty, row.uom);
            return (
              <tr key={row.code} className="relative border-b border-border align-top hover:bg-raised focus-within:bg-raised">
                <td className="py-3 pr-4">
                  <Link href={itemHref(row.code)} className={nameLink}>
                    {row.description}
                  </Link>
                  <div className="text-xs text-muted">
                    {row.code} · {row.vendor_name}
                  </div>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="relative z-10 inline-block">
                    <Why content={whyRunOut(row, asOf, here)}>{row.run_out_date ? shortDate(row.run_out_date) : "—"}</Why>
                  </span>
                  <div className="text-xs text-muted">{row.run_out_date ? relativeDate(row.run_out_date, asOf) : ""}</div>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="relative z-10 inline-block">
                    <Why content={whyArrival(row, asOf, here)}>{shortDate(lands)}</Why>
                  </span>
                  <div className="text-xs text-muted">{relativeDate(lands, asOf)}</div>
                </td>
                <td className="w-44 py-3 pr-4">
                  <div className="pt-2">
                    <GapBar runsInDays={runsIn} landsInDays={landsIn} scaleMax={scaleMax} />
                  </div>
                  <div className="relative z-10 mt-1 text-xs">
                    <Why content={whyGap(row, asOf, here)}>
                      <span className={row.days_late > 0 ? "text-critical" : "text-muted"}>
                        {row.days_late > 0 ? `${row.days_late} days short` : "Lands in time"}
                      </span>
                    </Why>
                  </div>
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className="relative z-10 inline-block">
                    <Why content={whyOrderQty(row, asOf, here)}>
                      {row.suggested_qty > 0 ? (
                        <>
                          {order.value} <span className="text-muted">{order.unit}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </Why>
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className="relative z-10 inline-block">
                    <Why content={whyAction(row, asOf, here)}>{actionText(row, asOf)}</Why>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="md:hidden">
        {rows.map((row) => {
          const runsIn = row.run_out_date ? daysBetween(asOf, row.run_out_date) : null;
          const lands = arrivalDate(row, asOf);
          const landsIn = daysBetween(asOf, lands);
          return (
            <li key={row.code} className="relative border-b border-border py-3">
              <Link href={itemHref(row.code)} className={nameLink}>
                {row.description}
              </Link>
              <div className="text-xs text-muted">
                {row.code} · {row.vendor_name}
              </div>
              <div className="mt-2">
                <GapBar runsInDays={runsIn} landsInDays={landsIn} scaleMax={scaleMax} />
              </div>
              <div className="relative z-10 mt-1 flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                <Why content={whyGap(row, asOf, here)}>
                  <span className={row.days_late > 0 ? "text-critical" : "text-muted"}>
                    {row.days_late > 0 ? `${row.days_late} days short` : "Lands in time"}
                  </span>
                </Why>
                <Why content={whyAction(row, asOf, here)}>{actionText(row, asOf)}</Why>
              </div>
              <div className="relative z-10 mt-1 text-xs text-muted">
                Runs out{" "}
                <Why content={whyRunOut(row, asOf, here)}>{row.run_out_date ? shortDate(row.run_out_date) : "—"}</Why>
                {" · reorder lands "}
                <Why content={whyArrival(row, asOf, here)}>{shortDate(lands)}</Why>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
