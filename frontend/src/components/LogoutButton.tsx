"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button type="button" onClick={logout} className="text-muted hover:text-text">
      Log out
    </button>
  );
}
