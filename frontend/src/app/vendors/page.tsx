import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { serverFetch } from "@/lib/server-api";
import type { Vendor } from "@/lib/types";
import { VendorForm } from "./VendorForm";

export default async function VendorsPage() {
  const vendors = await serverFetch<Vendor[]>("/vendors");
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <div>
          <Link href="/" className="text-sm text-accent hover:underline">
            ← Monday screen
          </Link>
          <h1 className="mt-2 text-xl font-semibold">Lead times</h1>
          <p className="max-w-xl text-sm text-muted">
            What you know that BlueTide doesn’t. Change a number and the Monday screen re-plans straight away. The buffer is extra
            days of stock on top of the lead time, because ships slip.
          </p>
        </div>
        <ul className="border-t border-border">
          {vendors.map((v) => (
            <VendorForm key={v.code} vendor={v} />
          ))}
        </ul>
      </main>
    </>
  );
}
