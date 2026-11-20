"use client";

import { useEffect, useRef, useState } from "react";

// A horizontally scrolling row of tiles. Touch and trackpad scroll natively; the arrows are for mouse users.
export function ScrollRow({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    const observer = new ResizeObserver(update); // fires once on observe, so the initial state is set too
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, []);

  function scroll(direction: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  }

  const arrow =
    "absolute top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md border border-border-strong bg-raised text-lg shadow-pop transition-opacity duration-[120ms] hover:bg-surface sm:flex";
  return (
    <div className="relative">
      <ul
        ref={ref}
        aria-label={label}
        className="-mx-4 flex snap-x snap-proximity gap-3 overflow-x-auto px-4 pb-3 [scroll-padding-inline:16px] sm:-mx-6 sm:px-6 sm:[scroll-padding-inline:24px]"
      >
        {children}
      </ul>
      {edge.left && (
        <button type="button" aria-label={`Scroll ${label} left`} onClick={() => scroll(-1)} className={`${arrow} left-0 sm:-left-2`}>
          ‹
        </button>
      )}
      {edge.right && (
        <button type="button" aria-label={`Scroll ${label} right`} onClick={() => scroll(1)} className={`${arrow} right-0 sm:-right-2`}>
          ›
        </button>
      )}
    </div>
  );
}
