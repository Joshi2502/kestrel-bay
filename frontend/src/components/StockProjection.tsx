"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { groupedInt, shortDate } from "@/lib/format";

export interface StockProjectionProps {
  points: { date: string; qty: number }[];
  runOut: string | null;
  lands: string;
  unit: string;
}

const tick = { fill: "var(--muted)", fontSize: 12, fontVariantNumeric: "tabular-nums" } as const;

export function StockProjection({ points, runOut, lands, unit }: StockProjectionProps) {
  const landsFirst = runOut === null || lands < runOut;
  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={tick} stroke="var(--border-strong)" minTickGap={56} />
          <YAxis tickFormatter={groupedInt} tick={tick} stroke="var(--border-strong)" width={52} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { date: string; qty: number };
              return (
                <div className="rounded-sm border border-border-strong bg-raised px-3 py-2 text-sm shadow-pop">
                  <div className="text-xs text-muted">{shortDate(p.date)}</div>
                  <div className="font-medium">
                    {groupedInt(p.qty)} {unit}
                    <span className="text-muted"> projected</span>
                  </div>
                </div>
              );
            }}
          />
          <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1.5} />
          <ReferenceLine
            x={lands}
            stroke="var(--muted)"
            strokeDasharray="4 4"
            label={{ value: `Reorder lands ${shortDate(lands)}`, position: landsFirst ? "insideTopLeft" : "insideTopRight", fill: "var(--muted)", fontSize: 12 }}
          />
          {runOut && (
            <ReferenceLine
              x={runOut}
              stroke="var(--critical)"
              strokeDasharray="4 4"
              label={{ value: `Runs out ${shortDate(runOut)}`, position: landsFirst ? "insideTopRight" : "insideTopLeft", fill: "var(--critical)", fontSize: 12 }}
            />
          )}
          <Line type="linear" dataKey="qty" stroke="var(--text)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
