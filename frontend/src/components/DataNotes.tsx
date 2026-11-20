import { groupedInt } from "@/lib/format";
import type { DataNote } from "@/lib/types";

export function DataNotes({ notes }: { notes: DataNote[] }) {
  return (
    <details className="border-y border-border py-3">
      <summary className="cursor-pointer text-sm font-medium">How the numbers were cleaned ({notes.length} notes)</summary>
      <p className="mt-2 text-sm text-muted">
        BlueTide’s exports count things that aren’t really there. This is what was left out or fixed before anything was
        added up.
      </p>
      <ul className="mt-2 divide-y divide-border text-sm">
        {notes.map((n) => (
          <li key={n.kind} className="flex justify-between gap-4 py-1.5">
            <span>{n.message}</span>
            <span className="shrink-0 font-medium">{groupedInt(n.count)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
