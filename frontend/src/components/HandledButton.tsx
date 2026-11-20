"use client";

import { useState } from "react";
import { apiFetch, jsonBody } from "@/lib/api";

export function HandledButton({
  code,
  handled,
  onChanged,
}: {
  code: string;
  handled: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/items/${code}/handled`, {
        method: "POST",
        ...jsonBody({
          note,
          qty: qty ? Number(qty) : null,
          expected_date: date || null,
        }),
      });
      setOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    setBusy(true);
    try {
      await apiFetch(`/items/${code}/handled`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (handled) {
    return (
      <button
        onClick={undo}
        disabled={busy}
        className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-foreground"
      >
        Undo “handled”
      </button>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-accent"
      >
        ✓ I’ve handled this
      </button>
    );
  }

  const field = "w-full rounded-md border border-line bg-background px-2 py-1.5 text-sm";
  return (
    <div className="w-full space-y-2 rounded-lg border border-line bg-surface p-3">
      <p className="text-sm text-muted">
        Tell the screen about an order it can’t see yet (e.g. phoned in, not in BlueTide).
      </p>
      <input
        className={field}
        placeholder="Note, e.g. phoned Bien Xanh Tuesday"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className={field}
          type="number"
          min="0"
          placeholder="Quantity (optional)"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <input
          className={field}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Expected arrival"
        />
      </div>
      <p className="text-xs text-muted">
        Add a quantity and arrival date and it counts as stock on the way. Without them the item
        is just parked for 14 days.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background"
        >
          Save
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}
