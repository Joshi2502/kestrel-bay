"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { apiFetch, jsonBody } from "@/lib/api";
import type { Vendor } from "@/lib/types";

function VendorRow({ vendor }: { vendor: Vendor }) {
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
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not save");
    }
  }

  const field = "w-20 rounded-md border border-line bg-background px-2 py-1";
  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{vendor.name}</h2>
        <span className="text-sm text-muted">{vendor.country}</span>
      </div>
      <p className="text-sm text-muted">
        BlueTide says {vendor.lead_time_days_system ? `${vendor.lead_time_days_system} days` : "nothing"}
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-3 text-sm">
        <label>
          Real lead time (days)
          <input className={`${field} mt-1 block`} type="number" min="0" max="365" value={lead} onChange={(e) => setLead(e.target.value)} />
        </label>
        <label>
          Extra buffer (days)
          <input className={`${field} mt-1 block`} type="number" min="0" max="365" value={safety} onChange={(e) => setSafety(e.target.value)} />
        </label>
        <button onClick={save} className="rounded-md bg-accent px-3 py-1.5 font-medium text-background">
          Save
        </button>
        {status && <span className="text-muted">{status}</span>}
      </div>
    </li>
  );
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);

  useEffect(() => {
    void apiFetch<Vendor[]>("/vendors").then(setVendors);
  }, []);

  return (
    <>
      <Header title="Lead times" subtitle="What you know that BlueTide doesn’t" back={{ href: "/", label: "Monday screen" }} />
      <main className="mx-auto max-w-4xl space-y-3 px-4 py-4">
        <p className="text-sm text-muted">
          Change a number and the Monday screen re-plans straight away. The buffer is extra days of
          stock on top of the lead time, because ships slip.
        </p>
        {vendors ? (
          <ul className="space-y-2">
            {vendors.map((v) => (
              <VendorRow key={v.code} vendor={v} />
            ))}
          </ul>
        ) : (
          <p className="text-muted">Loading…</p>
        )}
      </main>
    </>
  );
}
