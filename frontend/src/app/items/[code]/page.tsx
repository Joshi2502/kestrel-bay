"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DemandChart } from "@/components/DemandChart";
import { Header } from "@/components/Header";
import { HandledButton } from "@/components/HandledButton";
import { StuckList } from "@/components/StuckList";
import { apiFetch } from "@/lib/api";
import { longDate, monthLabel, qty, shortDate } from "@/lib/format";
import type { ItemDetail } from "@/lib/types";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function ItemPage() {
  const { code } = useParams<{ code: string }>();
  const [d, setD] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await apiFetch<ItemDetail>(`/items/${code}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this item");
    }
  }, [code]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (error) return <p className="p-6 text-danger">{error}</p>;
  if (!d) return <p className="p-6 text-muted">Loading…</p>;

  const tone =
    d.verdict?.status === "order_now"
      ? "bg-danger-bg text-danger"
      : d.verdict?.status === "watch"
        ? "bg-warn-bg text-warn"
        : "bg-calm-bg text-calm";

  return (
    <>
      <Header title={d.description} subtitle={`${d.code} · ${d.vendor_name}, ${d.country}`} back={{ href: "/", label: "Monday screen" }} />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-4">
        <div className={`rounded-lg p-4 ${tone}`}>
          <p className="text-lg font-semibold">
            {d.verdict ? d.verdict.headline : "Not planned: no live demand for this item"}
          </p>
          {d.verdict && d.verdict.suggested_qty > 0 && d.verdict.status !== "handled" && (
            <p className="mt-1">Suggested order: about {qty(d.verdict.suggested_qty, d.uom)}</p>
          )}
          {d.handled && (
            <p className="mt-1 text-sm">
              Marked handled{d.handled.note && `: “${d.handled.note}”`} until {longDate(d.handled.expires_on)}.
            </p>
          )}
        </div>

        {d.verdict && (
          <HandledButton code={d.code} handled={d.verdict.status === "handled"} onChanged={load} />
        )}

        <Card title="The math">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {d.math.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Card>

        <Card title="What you have">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">Where</th>
                  <th className="py-1 pr-3 font-medium">Lot</th>
                  <th className="py-1 pr-3 text-right font-medium">Qty</th>
                  <th className="py-1 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {d.lots.map((lot) => (
                  <tr key={`${lot.location}-${lot.lot_no}`} className={`border-t border-line ${lot.status !== "sellable" ? "text-muted" : ""}`}>
                    <td className="py-1 pr-3">
                      {lot.location}
                      {lot.status === "hold" && " (on hold, not counted)"}
                      {lot.status === "damaged" && " (damaged, ignored)"}
                    </td>
                    <td className="py-1 pr-3">{lot.is_adjustment ? `${lot.lot_no} (adjustment)` : lot.lot_no}</td>
                    <td className="py-1 pr-3 text-right">{qty(lot.qty, lot.uom)}</td>
                    <td className="py-1">{lot.expiry_date ? longDate(lot.expiry_date) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {d.committed_by_month.length > 0 && (
          <Card title="Already promised to customers">
            <ul className="text-sm">
              {d.committed_by_month.map((c) => {
                const [y, m] = c.month.split("-").map(Number);
                return (
                  <li key={c.month}>
                    {monthLabel(y, m)}: {qty(c.qty, d.uom)} on open orders
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {d.incoming.length > 0 && (
          <Card title="Coming in">
            <ul className="space-y-1 text-sm">
              {d.incoming.map((i) => (
                <li key={`${i.source}-${i.ref}`}>
                  <span className="font-medium">{qty(i.qty, d.uom)}</span> {i.source === "dana" ? "(you phoned in)" : `on ${i.ref}`}, arriving {shortDate(i.eta)}
                  {i.overdue && i.vendor_said && (
                    <span className="text-warn"> — vendor said {shortDate(i.vendor_said)}, still open, so we assume {shortDate(i.eta)}</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {d.history.length > 0 && (
          <Card title="What you sell: last year and what to expect">
            <DemandChart history={d.history} forecast={d.forecast} />
          </Card>
        )}

        {d.stuck.length > 0 && (
          <Card title="Stuck stock on this item">
            <StuckList rows={d.stuck} />
          </Card>
        )}
      </main>
    </>
  );
}
