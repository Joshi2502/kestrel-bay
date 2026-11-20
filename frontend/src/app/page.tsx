import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DataNotes } from "@/components/DataNotes";
import { HeadlineStrip } from "@/components/HeadlineStrip";
import { RiskTile } from "@/components/RiskTile";
import { ScrollRow } from "@/components/ScrollRow";
import { PageSkeleton } from "@/components/Skeleton";
import { StuckTile } from "@/components/StuckTile";
import { arrivalDate, daysBetween, groupedInt, money } from "@/lib/format";
import { getDashboard } from "@/lib/server-api";
import { type Params, sortStuck, withParams } from "@/lib/sort";

function Section({ id, title, count, hint, children }: { id: string; title: string; count?: number; hint: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="text-md font-semibold">
        {title}
        {count !== undefined && <span className="ml-2 font-normal text-muted">{count}</span>}
      </h2>
      <p className="mb-3 max-w-2xl text-sm text-muted">{hint}</p>
      {children}
    </section>
  );
}

async function Dashboard({ params }: { params: Params }) {
  const data = await getDashboard();
  const here = withParams(params, {});
  const stuck = sortStuck(data.stuck, "value", "desc");

  const all = [...data.order_now, ...data.watch];
  const scaleMax = Math.max(
    1,
    ...all.map((r) =>
      Math.max(daysBetween(data.as_of, arrivalDate(r, data.as_of)), r.run_out_date ? daysBetween(data.as_of, r.run_out_date) : 0),
    ),
  );
  const nothingAtRisk = data.order_now.length === 0 && data.watch.length === 0;

  return (
    <>
      <HeadlineStrip data={data} />

      {nothingAtRisk ? (
        <section className="rounded-md border border-border bg-surface p-6">
          <h2 className="font-serif text-lg">Nothing to order this week.</h2>
          <p className="mt-1 max-w-xl text-muted">
            Every item has enough stock, on hand or on the way, to last until a new order could arrive.
          </p>
        </section>
      ) : (
        <>
          {data.order_now.length > 0 && (
            <Section
              id="order-now"
              title="Order now"
              count={data.order_now.length}
              hint="Stock runs out before a reorder placed today could arrive, or the last day to order is this week."
            >
              <ScrollRow label="Order now">
                {data.order_now.map((row) => (
                  <RiskTile key={row.code} row={row} asOf={data.as_of} here={here} scaleMax={scaleMax} section="order" />
                ))}
              </ScrollRow>
            </Section>
          )}
          {data.watch.length > 0 && (
            <Section id="watch" title="Watch" count={data.watch.length} hint="Tight but recoverable. Order within the next four weeks.">
              <ScrollRow label="Watch">
                {data.watch.map((row) => (
                  <RiskTile key={row.code} row={row} asOf={data.as_of} here={here} scaleMax={scaleMax} section="watch" />
                ))}
              </ScrollRow>
            </Section>
          )}
        </>
      )}

      <p className="text-sm text-muted">
        Everything else is covered: {groupedInt(data.ok_count)} other items have stock that lasts past the planning window.
        {data.handled.length > 0 && ` ${data.handled.length} more are marked handled.`}
      </p>

      {stuck.length > 0 && (
        <Section
          id="stuck"
          title="Stuck stock"
          count={stuck.length}
          hint={`${money(data.stuck_total_value)} at cost, biggest first. Shelf life under six months, too much on hand, or not selling. Stock at Harbor Cold Storage costs pallet fees every month.`}
        >
          <ScrollRow label="Stuck stock">
            {stuck.map((row, i) => (
              <StuckTile key={`${row.code}-${row.lot_no ?? ""}-${row.location ?? ""}-${i}`} row={row} asOf={data.as_of} here={here} />
            ))}
          </ScrollRow>
        </Section>
      )}

      <DataNotes notes={data.data_notes} />
    </>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-6">
        <Suspense fallback={<PageSkeleton />}>
          <Dashboard params={params} />
        </Suspense>
      </main>
    </>
  );
}
