"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btnPrimary, field } from "@/components/ui";
import { apiFetch, jsonBody } from "@/lib/api";
import type { Vendor } from "@/lib/types";

export function VendorForm({ vendor }: { vendor: Vendor }) {
  const router = useRouter();
  const [lead, setLead] = useState(String(vendor.lead_time_days ?? ""));
  const [safety, setSafety] = useState(String(vendor.safety_days));
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    setStatus("Saving…");
    try {
      await apiFetch(`/vendors/${vendor.code}`, {
        method: "PATCH",
        ...jsonBody({ lead_time_days: Number(lead), safety_days: Number(safety) }),
      });
      setStatus("Saved");
      router.refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <li className="border-b border-border py-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{vendor.name}</h2>
        <span className="text-sm text-muted">{vendor.country}</span>
      </div>
      <p className="text-sm text-muted">BlueTide says {vendor.lead_time_days_system ? `${vendor.lead_time_days_system} days` : "nothing"}</p>
      <div className="mt-3 flex flex-wrap items-end gap-4 text-sm">
        <label>
          Real lead time (days)
          <input className={`${field} mt-1 block w-28`} type="number" min="0" max="365" value={lead} onChange={(e) => setLead(e.target.value)} />
        </label>
        <label>
          Extra buffer (days)
          <input className={`${field} mt-1 block w-28`} type="number" min="0" max="365" value={safety} onChange={(e) => setSafety(e.target.value)} />
        </label>
        <button type="button" onClick={save} className={btnPrimary}>
          Save
        </button>
        {status && (
          <span role="status" className="text-muted">
            {status}
          </span>
        )}
      </div>
    </li>
  );
}
