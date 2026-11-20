"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthForecast, MonthHistory } from "@/lib/types";
import { monthLabel } from "@/lib/format";

interface Point {
  label: string;
  sold: number | null;
  expected: number | null;
  adjusted: boolean;
}

export function DemandChart({
  history,
  forecast,
}: {
  history: MonthHistory[];
  forecast: MonthForecast[];
}) {
  const data: Point[] = [
    ...history
      .filter((h) => !h.partial || h.actual > 0)
      .map((h) => ({
        label: monthLabel(h.year, h.month) + (h.partial ? "*" : ""),
        sold: h.corrected,
        expected: null,
        adjusted: h.stockout_days > 0,
      })),
    ...forecast.slice(1).map((f) => ({
      label: monthLabel(f.year, f.month),
      sold: null,
      expected: f.qty,
      adjusted: false,
    })),
  ];
  const hasAdjusted = data.some((d) => d.adjusted);

  return (
    <div>
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} width={44} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8 }}
              formatter={(value) => Math.round(Number(value)).toLocaleString("en-US")}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="sold" stackId="demand" name="Sold (real demand)" fill="var(--accent)" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.adjusted ? "var(--warn)" : "var(--accent)"} />
              ))}
            </Bar>
            <Bar dataKey="expected" stackId="demand" name="Expected" fill="var(--muted)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted">
        * month still in progress.
        {hasAdjusted && " Amber bars: you ran out of stock that month, so the real demand is shown, not the lower sales."}
      </p>
    </div>
  );
}
