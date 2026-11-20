"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export function Header({
  title,
  subtitle,
  back,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
}) {
  const router = useRouter();

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          {back && (
            <Link href={back.href} className="text-sm text-accent hover:underline">
              ← {back.label}
            </Link>
          )}
          <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <nav className="flex shrink-0 items-center gap-4 text-sm">
          <Link href="/vendors" className="text-accent hover:underline">
            Lead times
          </Link>
          <button onClick={logout} className="text-muted hover:text-foreground">
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
