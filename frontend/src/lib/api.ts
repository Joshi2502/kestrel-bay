export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

export async function ensureCsrf(): Promise<void> {
  if (!readCookie("csrftoken")) {
    await fetch("/api/auth/csrf", { credentials: "include" });
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (method !== "GET") {
    await ensureCsrf();
    headers.set("X-CSRFToken", readCookie("csrftoken") ?? "");
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`/api${path}`, { ...init, method, headers, credentials: "include" });

  if ((response.status === 401 || response.status === 403) && !path.startsWith("/auth/")) {
    // Hard navigation on purpose: drops any stale client state when the session has ended.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new ApiError(response.status, "Please sign in");
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === "object" ? firstMessage(body) : null;
    throw new ApiError(response.status, detail ?? "Something went wrong");
  }
  return body as T;
}

function firstMessage(body: Record<string, unknown>): string | null {
  if (typeof body.detail === "string") return body.detail;
  for (const value of Object.values(body)) {
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return null;
}

export function jsonBody(value: unknown): RequestInit {
  return { body: JSON.stringify(value) };
}
