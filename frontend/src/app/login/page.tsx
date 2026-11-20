"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, ensureCsrf, jsonBody } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ensureCsrf();
      await apiFetch("/auth/login", { method: "POST", ...jsonBody({ username, password }) });
      await ensureCsrf();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-md border border-line bg-background px-3 py-2";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Kestrel Bay</h1>
      <p className="mb-6 text-muted">Monday ordering screen</p>
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-line bg-surface p-4">
        <label className="block text-sm">
          Username
          <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label className="block text-sm">
          Password
          <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button disabled={busy} className="w-full rounded-md bg-accent px-3 py-2 font-medium text-background">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
