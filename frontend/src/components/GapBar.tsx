import { days } from "@/lib/format";

// Days until stock runs out (dark) against days until a reorder could land. The red part is the gap.
export function GapBar({ runsInDays, landsInDays, scaleMax }: { runsInDays: number | null; landsInDays: number; scaleMax: number }) {
  const covered = Math.max(0, runsInDays ?? landsInDays);
  const coveredPct = Math.min(100, (covered / scaleMax) * 100);
  const landsPct = Math.min(100, (landsInDays / scaleMax) * 100);
  const gap = runsInDays !== null && landsInDays > runsInDays;
  const label = gap
    ? `Stock lasts ${days(covered)}; a reorder lands in ${days(landsInDays)}.`
    : `Stock lasts ${days(covered)}; a reorder lands in ${days(landsInDays)}, in time.`;
  return (
    <div role="img" aria-label={label} className="relative h-1.5 w-full min-w-16 rounded-sm bg-border">
      <div className="absolute inset-y-0 left-0 rounded-sm bg-border-strong" style={{ width: `${coveredPct}%` }} />
      {gap && (
        <div
          className="absolute inset-y-0 rounded-sm bg-critical"
          style={{ left: `${coveredPct}%`, width: `${Math.max(0, landsPct - coveredPct)}%` }}
        />
      )}
    </div>
  );
}
