// ─── Hub admin API client ────────────────────────────────────────────
//
// Talks to the Cloudflare Worker at `api.<HUB_ROOT_DOMAIN>`. The base URL
// is controlled by VITE_HUB_API_URL at build time. All calls attach the
// `X-Admin-Key` header from sessionStorage.

const ADMIN_KEY_STORAGE = "arcanum-hub-admin-key";

export const API_BASE: string =
  import.meta.env.VITE_HUB_API_URL?.replace(/\/+$/, "") ?? "http://127.0.0.1:8787/api";

export function getStoredAdminKey(): string | null {
  return sessionStorage.getItem(ADMIN_KEY_STORAGE);
}

export function setStoredAdminKey(key: string): void {
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
}

export function clearStoredAdminKey(): void {
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

// ─── Response types ──────────────────────────────────────────────────

export interface HubWorldSummary {
  slug: string;
  listed: boolean;
  lastPublishAt: number | null;
  bytesUsed: number;
}

export interface HubUsage {
  imagesUsed: number;
  imagesQuota: number;
  promptsUsed: number;
  promptsQuota: number;
}

export type HubUserTier = "full" | "publish";

export interface HubUser {
  id: string;
  displayName: string;
  email: string | null;
  createdAt: number;
  lastPublishAt: number | null;
  tier: HubUserTier;
  usage: HubUsage;
  worlds: HubWorldSummary[];
}

export interface HubWorldAdmin {
  slug: string;
  userId: string;
  displayName: string | null;
  listed: boolean;
  tagline: string | null;
  lastPublishAt: number | null;
  bytesUsed: number;
  createdAt: number;
}

// ─── Low-level request helper ────────────────────────────────────────

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { adminKey: string },
): Promise<T> {
  const { adminKey, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("X-Admin-Key", adminKey);
  if (rest.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─── Endpoint wrappers ───────────────────────────────────────────────

export async function listUsers(adminKey: string): Promise<HubUser[]> {
  const res = await request<{ users: HubUser[] }>("/admin/users", {
    method: "GET",
    adminKey,
  });
  return res.users;
}

export async function createUser(
  adminKey: string,
  payload: { displayName: string; email: string | null; tier: HubUserTier },
): Promise<{ user: HubUser; apiKey: string }> {
  return await request<{ user: HubUser; apiKey: string }>("/admin/users", {
    method: "POST",
    adminKey,
    body: JSON.stringify(payload),
  });
}

/**
 * Change a user's tier. The worker auto-rotates their API key when
 * the tier actually changes, so `apiKey` will be non-null in that
 * case and must be shown to the operator (the old key is dead).
 * `apiKey` is null when the requested tier already matches.
 */
export async function setUserTier(
  adminKey: string,
  userId: string,
  tier: HubUserTier,
): Promise<{ user: HubUser; apiKey: string | null; unchanged?: boolean }> {
  return await request<{ user: HubUser; apiKey: string | null; unchanged?: boolean }>(
    `/admin/users/${encodeURIComponent(userId)}/tier`,
    {
      method: "POST",
      adminKey,
      body: JSON.stringify({ tier }),
    },
  );
}

export async function deleteUser(adminKey: string, userId: string): Promise<void> {
  await request<void>(`/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    adminKey,
  });
}

export async function regenerateKey(
  adminKey: string,
  userId: string,
): Promise<{ apiKey: string }> {
  return await request<{ apiKey: string }>(
    `/admin/users/${encodeURIComponent(userId)}/regenerate-key`,
    { method: "POST", adminKey },
  );
}

export async function updateQuotas(
  adminKey: string,
  userId: string,
  quotas: { imagesQuota?: number; promptsQuota?: number },
): Promise<{ user: HubUser }> {
  return await request<{ user: HubUser }>(
    `/admin/users/${encodeURIComponent(userId)}/quotas`,
    {
      method: "POST",
      adminKey,
      body: JSON.stringify(quotas),
    },
  );
}

export async function deleteWorld(adminKey: string, slug: string): Promise<void> {
  await request<void>(`/admin/worlds/${encodeURIComponent(slug)}`, {
    method: "DELETE",
    adminKey,
  });
}

export { ApiError };
