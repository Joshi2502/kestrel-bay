import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { HandledButton } from "@/components/HandledButton";
import { LazyStockProjection } from "@/components/LazyStockProjection";
import { Severity } from "@/components/Severity";
import { PageSkeleton } from "@/components/Skeleton";
import { StuckTable } from "@/components/StuckTable";
import { Why } from "@/components/Why";
import { arrivalDate, days, longDate, monthLabel, perDay, qty, qtyParts, shortDate, daysBetween } from "@/lib/format";
import { getItem } from "@/lib/server-api";
import type { ItemDetail } from "@/lib/types";
import { itemWhy } from "@/lib/why";

const th = "py-2 pr-4 text-xs font-medium text-muted";

function safeBack(from: string | undefined): string {
  return from && /^\/(?!\/)/.test(from) ? from : "/";
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-l border-border py-1 pl-4 first:border-l-0 first:pl-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold">{children}</dd>
    </div>
  );
}

function Status({ d }: { d: ItemDetail }) {
  const v = d.verdict;
  if (!v) return <span className="text-sm text-muted">Not planned: no live demand for this item</span>;
  if (v.status === "handled") return <span className="text-sm font-medium">Handled: you told the screen about this</span>;
  if (v.status === "order_now" && v.days_late > 0) return <Severity kind="critical" />;
  if (v.status === "order_now") return <Severity kind="watch" label="Order this week" />;
  if (v.status === "watch") return <Severity kind="watch" label="Tight: order within four weeks" />;
  return <span className="text-sm text-muted">Covered past the planning window</span>;
}

async function Item({ code, from }: { code: string; from: string }) {
  const d = await getItem(code);
  const asOf = d.projection[0]?.date ?? null;
  const v = d.verdict;
  const w = asOf ? itemWhy(d, asOf) : null;
  const onWay = d.incoming.reduce((s, i) => s + i.qty, 0);
  const sellable = qtyParts(d.sellable, d.uom);
  const way = qtyParts(onWay, d.uom);
  const lands = v && asOf ? arrivalDate(v, asOf) : null;
  const runsIn = v?.run_out_date && asOf ? daysBetween(asOf, v.run_out_date) : null;
  const handled = v?.status === "handled";

  return (
    <>
      <div>
        <Link href={from} className="text-sm text-accent hover:underline">
          ← Monday screen
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{d.description}</h1>
        <p className="text-sm text-muted">
          {d.code} · {d.vendor_name}, {d.country}
        </p>
      </div>

      <section className="space-y-3">
        <Status d={d} />
        {v && <p className="max-w-3xl font-serif text-lg">{v.headline}</p>}
        {v && v.suggested_qty > 0 && !handled && <p>Suggested order: about {qty(v.suggested_qty, d.uom)}.</p>}
        {d.handled && (
          <p className="text-sm text-muted">
            Marked handled{d.handled.note && `: “${d.handled.note}”`} until {longDate(d.handled.expires_on)}.
          </p>
        )}
        {v && <HandledButton code={d.code} handled={handled} />}
      </section>

      <dl className="grid grid-cols-2 gap-y-4 border-y border-border py-3 sm:grid-cols-5">
        <Cell label="On hand">
          {w ? <Why content={w.onHand}>{sellable.value}</Why> : sellable.value} <span className="text-sm font-normal text-muted">{sellable.unit}</span>
        </Cell>
        <Cell label="On the way">
          {w ? <Why content={w.onWay}>{way.value}</Why> : way.value} <span className="text-sm font-normal text-muted">{way.unit}</span>
        </Cell>
        <Cell label="Daily use">{w && v ? <Why content={w.dailyUse}>{perDay(v.demand_next_30d / 30, d.uom)}</Why> : "—"}</Cell>
        <Cell label="Lead time">
          {w ? <Why content={w.lead}>{days(d.lead_days)}</Why> : days(d.lead_days)}
        </Cell>
        <Cell label="Days of cover">
          {w && runsIn !== null ? <Why content={w.cover}>{days(runsIn)}</Why> : <span className="text-muted">Past the window</span>}
        </Cell>
      </dl>

      {d.projection.length > 0 && lands && (
        <section>
          <h2 className="text-md font-semibold">Stock over time</h2>
          <p className="mb-2 max-w-2xl text-sm text-muted">
            {v?.run_out_date
              ? `Projected stock reaches zero on ${shortDate(v.run_out_date)}. A reorder placed today lands ${shortDate(lands)}.`
              : `Projected stock stays above zero. A reorder placed today would land ${shortDate(lands)}.`}
          </p>
          <LazyStockProjection
            points={d.projection}
            runOut={v?.run_out_date ?? null}
            lands={lands}
            unit={d.uom === "LB" ? "lbs" : "cs"}
          />
        </section>
      )}

      {d.incoming.length > 0 && (
        <section>
          <h2 className="text-md font-semibold">Coming in</h2>
          <table className="mt-2 w-full border-t border-border">
            <thead>
              <tr className="text-left">
                <th className={th}>Order</th>
                <th className={`${th} text-right`}>Quantity</th>
                <th className={`${th} text-right`}>Arrives</th>
                <th className={th}>Note</th>
              </tr>
            </thead>
            <tbody>
              {d.incoming.map((i) => {
                const q = qtyParts(i.qty, d.uom);
                return (
                  <tr key={`${i.source}-${i.ref}`} className="border-b border-border align-top">
                    <td className="py-2 pr-4">{i.source === "dana" ? "You phoned in" : i.ref}</td>
                    <td className="py-2 pr-4 text-right">
                      {q.value} <span className="text-muted">{q.unit}</span>
                    </td>
                    <td className="py-2 pr-4 text-right">{shortDate(i.eta)}</td>
                    <td className="py-2 pr-4 text-sm text-muted">
                      {i.overdue && i.vendor_said ? `Vendor said ${shortDate(i.vendor_said)}, still open, so we assume ${shortDate(i.eta)}` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2 className="text-md font-semibold">What you have</h2>
        <table className="mt-2 w-full border-t border-border">
          <thead>
            <tr className="text-left">
              <th className={th}>Where</th>
              <th className={th}>Lot</th>
              <th className={`${th} text-right`}>Quantity</th>
              <th className={`${th} text-right`}>Expires</th>
            </tr>
          </thead>
          <tbody>
            {d.lots.map((lot) => {
              const q = qtyParts(lot.qty, lot.uom);
              return (
                <tr key={`${lot.location}-${lot.lot_no}`} className={`border-b border-border ${lot.status !== "sellable" ? "text-muted" : ""}`}>
                  <td className="py-2 pr-4">
                    {lot.location}
                    {lot.status === "hold" && " (on hold, not counted)"}
                    {lot.status === "damaged" && " (damaged, ignored)"}
                  </td>
                  <td className="py-2 pr-4">{lot.is_adjustment ? `${lot.lot_no} (adjustment)` : lot.lot_no}</td>
                  <td className="py-2 pr-4 text-right">
                    {q.value} <span className="text-muted">{q.unit}</span>
                  </td>
                  <td className="py-2 pr-4 text-right">{lot.expiry_date ? longDate(lot.expiry_date) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {d.committed_by_month.length > 0 && (
        <section>
          <h2 className="text-md font-semibold">Already promised to customers</h2>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {d.committed_by_month.map((c) => {
              const [y, m] = c.month.split("-").map(Number);
              return (
                <li key={c.month} className="flex justify-between py-2">
                  <span>{monthLabel(y, m)}</span>
                  <span>{qty(c.qty, d.uom)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {d.stuck.length > 0 && asOf && (
        <section>
          <h2 className="text-md font-semibold">Stuck stock on this item</h2>
          <div className="mt-2 border-t border-border">
            <StuckTable rows={d.stuck} asOf={asOf} sort="value" dir="desc" params={{}} here={`/items/${d.code}`} />
          </div>
        </section>
      )}

      <section id="math" className="scroll-mt-4">
        <h2 className="text-md font-semibold">How these numbers are worked out</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {d.math.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ code }, { from }] = await Promise.all([params, searchParams]);
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6">
        <Suspense fallback={<PageSkeleton rows={3} />}>
          <Item code={code} from={safeBack(from)} />
        </Suspense>
      </main>
    </>
  );
}
