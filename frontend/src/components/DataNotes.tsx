import type { DataNote } from "@/lib/types";

export function DataNotes({ notes }: { notes: DataNote[] }) {
  return (
    <details className="rounded-lg border border-line bg-surface p-3">
      <summary className="cursor-pointer font-medium">
        How the numbers were cleaned ({notes.length} notes)
      </summary>
      <p className="mt-2 text-sm text-muted">
        BlueTide’s exports count things that aren’t really there. This is what was left out or fixed
        before anything was added up.
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {notes.map((n) => (
          <li key={n.kind} className="flex justify-between gap-3">
            <span>{n.message}</span>
            <span className="shrink-0 font-semibold">{n.count.toLocaleString("en-US")}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
