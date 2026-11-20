"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { WhyContent } from "@/lib/why";

// Any number that can explain itself. A native popover gives Esc, light-dismiss and focus return;
// below 640px the same element is styled as a bottom sheet (see .why-pop in globals.css).
export function Why({ content, children }: { content: WhyContent; children: React.ReactNode }) {
  const id = useId();
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function onToggle(event: React.SyntheticEvent<HTMLDivElement>) {
    const isOpen = (event.nativeEvent as ToggleEvent).newState === "open";
    setOpen(isOpen);
    const pop = popRef.current;
    const btn = btnRef.current;
    if (!isOpen || !pop || !btn) return;
    const rect = btn.getBoundingClientRect();
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = rect.bottom + 6;
    const top = below + height > window.innerHeight ? Math.max(8, rect.top - 6 - height) : below;
    pop.style.setProperty("--why-left", `${left}px`);
    pop.style.setProperty("--why-top", `${top}px`);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        popoverTarget={id}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        className="cursor-help rounded-sm text-left underline decoration-dotted decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-[120ms] hover:decoration-muted focus-visible:decoration-muted"
      >
        {children}
        <span className="sr-only"> (why this number)</span>
      </button>
      <div ref={popRef} id={id} popover="auto" role="dialog" aria-label="Why this number" className="why-pop" onToggle={onToggle}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <p className="text-base font-medium">{content.sentence}</p>
          <button
            type="button"
            popoverTarget={id}
            popoverTargetAction="hide"
            className="shrink-0 rounded-sm px-1 text-sm text-muted hover:text-text"
          >
            Close
          </button>
        </div>
        <dl className="divide-y divide-border border-y border-border text-sm">
          {content.inputs.map((input) => (
            <div key={`${input.label}-${input.source}`} className="py-2">
              <div className="flex justify-between gap-4">
                <dt>{input.label}</dt>
                <dd className="text-right font-medium">{input.value}</dd>
              </div>
              <p className="text-xs text-muted">{input.source}</p>
            </div>
          ))}
        </dl>
        <p className="mt-3 rounded-sm bg-surface p-2 font-mono text-xs leading-5 text-muted">{content.formula}</p>
        <div className="mt-3 flex items-center justify-between gap-4 text-xs text-muted">
          <span>As of {content.asOf}</span>
          <Link href={content.href} className="text-sm font-medium text-accent hover:underline">
            {content.hrefLabel ?? "Open the full item"} →
          </Link>
        </div>
      </div>
    </>
  );
}
