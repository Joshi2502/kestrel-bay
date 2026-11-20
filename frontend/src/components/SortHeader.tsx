import Link from "next/link";
import type { Dir } from "@/lib/sort";

export function SortHeader({
  label,
  href,
  active,
  dir,
  align = "left",
}: {
  label: string;
  href: string;
  active: boolean;
  dir: Dir;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`sticky top-0 bg-bg py-2 pr-4 text-xs font-medium text-muted ${align === "right" ? "text-right" : "text-left"}`}
    >
      <Link href={href} scroll={false} className="hover:text-text">
        {label}
        {active && <span aria-hidden="true"> {dir === "asc" ? "↑" : "↓"}</span>}
      </Link>
    </th>
  );
}

export function PlainHeader({ label, align = "left" }: { label: string; align?: "left" | "right" }) {
  return (
    <th scope="col" className={`sticky top-0 bg-bg py-2 pr-4 text-xs font-medium text-muted ${align === "right" ? "text-right" : "text-left"}`}>
      {label}
    </th>
  );
}
