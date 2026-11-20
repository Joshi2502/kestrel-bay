"use client";

import { useCallback, useEffect, useState } from "react";
import { DataNotes } from "@/components/DataNotes";
import { Header } from "@/components/Header";
import { ItemRow } from "@/components/ItemRow";
import { StuckList } from "@/components/StuckList";
import { apiFetch } from "@/lib/api";
import { money, weekdayDate } from "@/lib/format";
import type { Dashboard, ItemRowData } from "@/lib/types";

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${tone}`}>
      <div className="text-2xl font-semibold leading-tight">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Rows({ rows, onChanged }: { rows: ItemRowData[]; onChanged: () => void }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <ItemRow key={row.code} row={row} onChanged={onChanged} />
      ))}
    </ul>
  );
}

export default function Home() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Dashboard>("/dashboard"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the dashboard");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (error) return <p className="p-6 text-danger">{error}</p>;
  if (!data) return <p className="p-6 text-muted">Loading Monday’s numbers…</p>;

  return (
    <>
      <Header title="Kestrel Bay" subtitle={weekdayDate(data.as_of)} />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="to order now" value={String(data.order_now.length)} tone="bg-danger-bg text-danger" />
          <Stat label="to watch" value={String(data.watch.length)} tone="bg-warn-bg text-warn" />
          <Stat label="stuck at cost" value={money(data.stuck_total_value)} tone="bg-calm-bg text-calm" />
        </div>

        <Section
          title="Order now"
          hint="Will run out before a new order could get here, counting what is already on the way."
        >
          {data.order_now.length ? (
            <Rows rows={data.order_now} onChanged={load} />
          ) : (
            <p className="text-muted">Nothing is urgent.</p>
          )}
        </Section>

        {data.watch.length > 0 && (
          <Section title="Watch" hint="Order within the next four weeks.">
            <Rows rows={data.watch} onChanged={load} />
          </Section>
        )}

        {data.handled.length > 0 && (
          <details className="rounded-lg border border-line bg-surface p-3">
            <summary className="cursor-pointer font-medium">
              Handled ({data.handled.length}): you’ve told the screen about these
            </summary>
            <div className="mt-3">
              <Rows rows={data.handled} onChanged={load} />
            </div>
          </details>
        )}

        <p className="text-sm text-muted">
          {data.ok_count} other items are fine: their stock lasts past the planning window.
        </p>

        <Section
          title="Stuck stock"
          hint="Sellable stock nobody will take soon: under six months of shelf life left, too much on hand, or dead items. Harbor stock costs pallet fees every month."
        >
          <StuckList rows={data.stuck} />
        </Section>

        <DataNotes notes={data.data_notes} />
      </main>
    </>
  );
}
