"use client";

import { btnPrimary } from "@/components/ui";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-4">
      <h1 className="font-serif text-xl">We couldn’t load the numbers.</h1>
      <p className="mt-2 text-muted">
        The data service didn’t answer. Nothing has been changed, and your handled notes and lead times are safe. Try
        again in a moment.
      </p>
      <div className="mt-4">
        <button type="button" onClick={() => retry()} className={btnPrimary}>
          Try again
        </button>
      </div>
    </main>
  );
}
