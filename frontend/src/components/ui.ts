// Shared class strings so buttons and fields look the same everywhere.
export const btn =
  "inline-flex items-center justify-center rounded-sm border border-border-strong px-3 py-1.5 text-sm font-medium transition-colors duration-[120ms] hover:bg-raised disabled:opacity-60";
export const btnPrimary =
  "inline-flex items-center justify-center rounded-sm bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast transition-opacity duration-[120ms] hover:opacity-90 disabled:opacity-60";
export const field =
  "w-full rounded-sm border border-border-strong bg-surface px-3 py-2 text-base text-text placeholder:text-muted";

// Netflix-style tile: fixed size so rows line up and nothing shifts while loading.
export const tile =
  "group relative flex h-72 w-[78vw] max-w-[17rem] shrink-0 snap-start flex-col rounded-md border border-border bg-surface p-4 transition-colors duration-[120ms] hover:bg-raised focus-within:bg-raised sm:w-64";
export const tileLink =
  "line-clamp-2 shrink-0 font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-offset-[-2px]";
