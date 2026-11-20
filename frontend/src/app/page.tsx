import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DataNotes } from "@/components/DataNotes";
import { HeadlineStrip } from "@/components/HeadlineStrip";
import { RiskTable } from "@/components/RiskTable";
import { PageSkeleton } from "@/components/Skeleton";
import { StuckTable } from "@/components/StuckTable";
import { arrivalDate, daysBetween, groupedInt, money } from "@/lib/format";
import { getDashboard } from "@/lib/server-api";
import { type Params, one, pick, sortRisk, sortStuck, withParams } from "@/lib/sort";

function Section({ id, title, hint, children }: { id: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="text-md font-semibold">{title}</h2>
      <p className="max-w-2xl text-sm text-muted">{hint}</p>
      <div className="mt-3 border-t border-border">{children}</div>
    </section>
  );
}

async function Dashboard({ params }: { params: Params }) {
  const data = await getDashboard();
  const sort = pick(one(params, "sort"), ["urgency", "item", "order"] as const, "urgency");
  const dir = pick(one(params, "dir"), ["asc", "desc"] as const, "asc");
  const ssort = pick(one(params, "ssort"), ["value", "qty", "expiry"] as const, "value");
  const sdir = pick(one(params, "sdir"), ["asc", "desc"] as const, "desc");
  const here = withParams(params, {});

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
        <section className="border-y border-border py-6">
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
              hint="Stock runs out before a reorder placed today could arrive, or the last day to order is this week."
            >
              <RiskTable
                rows={sortRisk(data.order_now, sort, dir)}
                asOf={data.as_of}
                sort={sort}
                dir={dir}
                params={params}
                here={here}
                scaleMax={scaleMax}
              />
            </Section>
          )}
          {data.watch.length > 0 && (
            <Section id="watch" title="Watch" hint="Tight but recoverable. Order within the next four weeks.">
              <RiskTable
                rows={sortRisk(data.watch, sort, dir)}
                asOf={data.as_of}
                sort={sort}
                dir={dir}
                params={params}
                here={here}
                scaleMax={scaleMax}
              />
            </Section>
          )}
        </>
      )}

      <p className="text-sm text-muted">
        Everything else is covered: {groupedInt(data.ok_count)} other items have stock that lasts past the planning window.
        {data.handled.length > 0 && ` ${data.handled.length} more are marked handled.`}
      </p>

      {data.stuck.length > 0 && (
        <Section
          id="stuck"
          title="Stuck stock"
          hint={`${money(data.stuck_total_value)} at cost. Shelf life under six months, too much on hand, or not selling. Stock at Harbor Cold Storage costs pallet fees every month.`}
        >
          <StuckTable rows={sortStuck(data.stuck, ssort, sdir)} asOf={data.as_of} sort={ssort} dir={sdir} params={params} here={here} />
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
