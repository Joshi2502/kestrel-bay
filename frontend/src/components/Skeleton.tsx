// Static (non-animated) placeholders sized like the real content, so nothing shifts when data lands.
export function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded-sm bg-border ${className}`} aria-hidden="true" />;
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Bar className="h-14 w-full max-w-2xl" />
      <div className="mt-6 flex gap-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Bar className="h-7 w-16" />
            <Bar className="h-4 w-24" />
          </div>
        ))}
      </div>
      <Bar className="mt-10 h-5 w-40" />
      <div className="mt-3 border-y border-border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex h-[69px] items-center border-b border-border last:border-b-0">
            <Bar className="h-4 w-1/3" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading Monday’s numbers</span>
    </div>
  );
}
