import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Dashboard, ItemDetail } from "./types";

// Server Components call Django directly and forward the visitor's session cookie.
// Mutations still go through the browser (/api proxy) so CSRF stays same-origin.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function serverFetch<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${BACKEND_URL}/api${path}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) redirect("/login");
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error(`The data service answered ${response.status}`);
  return (await response.json()) as T;
}

// Identical GETs in one render are memoized by Next, so the headline and the tables share one request.
export const getDashboard = () => serverFetch<Dashboard>("/dashboard");
export const getItem = (code: string) => serverFetch<ItemDetail>(`/items/${encodeURIComponent(code)}`);
