import { cookies } from "next/headers";
import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { ThemeToggle } from "./ThemeToggle";

export async function AppHeader() {
  const saved = (await cookies()).get("theme")?.value;
  const theme = saved === "light" || saved === "dark" ? saved : "system";
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="whitespace-nowrap font-serif text-md font-semibold">
          Kestrel Bay
        </Link>
        <nav className="flex items-center gap-3 whitespace-nowrap text-sm sm:gap-4">
          <Link href="/vendors" className="text-muted hover:text-text">
            Lead times
          </Link>
          <ThemeToggle initial={theme} />
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
