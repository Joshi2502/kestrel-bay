"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, jsonBody } from "@/lib/api";
import { btn, btnPrimary, field } from "./ui";

export function HandledButton({ code, handled }: { code: string; handled: boolean }) {
  const router = useRouter();
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
        ...jsonBody({ note, qty: qty ? Number(qty) : null, expected_date: date || null }),
      });
      setOpen(false);
      router.refresh();
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
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (handled) {
    return (
      <button type="button" onClick={undo} disabled={busy} className={btn}>
        Undo “handled”
      </button>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btn}>
        I’ve handled this
      </button>
    );
  }
  return (
    <div className="w-full max-w-xl space-y-3 border border-border bg-surface p-4 rounded-md">
      <p className="text-sm text-muted">Tell the screen about an order it can’t see yet (for example phoned in, not in BlueTide).</p>
      <input className={field} placeholder="Note, e.g. phoned Bien Xanh Tuesday" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Note" />
      <div className="grid grid-cols-2 gap-3">
        <input className={field} type="number" min="0" placeholder="Quantity (optional)" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity" />
        <input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Expected arrival" />
      </div>
      <p className="text-xs text-muted">
        Add a quantity and an arrival date and it counts as stock on the way. Without them the item is just parked for 14 days.
      </p>
      {error && <p className="text-sm text-critical">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={save} disabled={busy} className={btnPrimary}>
          Save
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btn}>
          Cancel
        </button>
      </div>
    </div>
  );
}
