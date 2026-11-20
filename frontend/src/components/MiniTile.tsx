// Small fact block for the item page: orders coming in, stock on hand, promised orders.
export function MiniTile({
  title,
  value,
  unit,
  lines,
  muted = false,
}: {
  title: string;
  value: string;
  unit?: string;
  lines: string[];
  muted?: boolean;
}) {
  return (
    <li className={`w-44 shrink-0 snap-start rounded-md border border-border bg-surface p-3 ${muted ? "text-muted" : ""}`}>
      <div className="text-xs text-muted">{title}</div>
      <div className="mt-1 text-lg font-semibold">
        {value} {unit && <span className="text-sm font-normal text-muted">{unit}</span>}
      </div>
      {lines.map((line) => (
        <div key={line} className="text-xs text-muted">
          {line}
        </div>
      ))}
    </li>
  );
}
