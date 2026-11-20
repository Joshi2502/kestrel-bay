"use client";

import { useState } from "react";

type Choice = "light" | "dark" | "system";
const CHOICES: { value: Choice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "system", label: "Auto" },
  { value: "dark", label: "Dark" },
];

function persist(choice: Choice) {
  document.cookie = `theme=${choice}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeToggle({ initial }: { initial: Choice }) {
  const [choice, setChoice] = useState<Choice>(initial);

  function pick(next: Choice) {
    setChoice(next);
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    persist(next);
  }

  return (
    <div role="radiogroup" aria-label="Colour theme" className="inline-flex rounded-sm border border-border text-xs">
      {CHOICES.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={choice === c.value}
          onClick={() => pick(c.value)}
          className={`px-2 py-1 transition-colors duration-[120ms] first:rounded-l-sm last:rounded-r-sm ${
            choice === c.value ? "bg-accent text-accent-contrast" : "text-muted hover:text-text"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
