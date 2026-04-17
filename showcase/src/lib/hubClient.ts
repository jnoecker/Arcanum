// ─── Hub API client for the landing SPA ──────────────────────────────
//
// Mirrors creator/src/lib/hubClient.ts. We duplicate rather than
// share because showcase is a separate build target with no import
// path into the creator package. Any protocol change needs to be
// applied in both files.

const DEFAULT_HUB_API_URL = "https://api.arcanum-hub.com";

export interface HubUser {
  id: string;
  displayName: string;
  tier: "demo" | "full" | "publish";
  email: string | null;
  emailVerified: boolean;
  imagesQuota: number;
  promptsQuota: number;
}

export interface HubAccount {
  id: string;
  displayName: string;
  email: string | null;
  emailVerified: boolean;
  tier: "demo" | "full" | "publish";
  createdAt: number;
  lastPublishAt: number | null;
  canPublish: boolean;
  usage: {
    imagesUsed: number;
    imagesQuota: number;
    promptsUsed: number;
    promptsQuota: number;
  };
}

export interface HubWorldSummary {
  slug: string;
  displayName: string | null;
  listed: boolean;
  lastPublishAt: number | null;
  bytesUsed: number;
}

function baseUrl(): string {
  // On the hub root, the worker answers api.* for us. In dev we can
  // override via VITE_HUB_API_URL if needed.
  const override = (import.meta.env.VITE_HUB_API_URL as string | undefined)?.trim();
  return (override ?? DEFAULT_HUB_API_URL).replace(/\/+$/, "");
}

async function readJson<T>(resp: Response): Promise<T> {
  const text = await resp.text();
  if (!resp.ok) {
    let msg = `Hub ${resp.status}`;
    try {
      const body = JSON.parse(text) as { error?: string; message?: string };
      msg = body.error ?? body.message ?? msg;
    } catch {
      if (text) msg = `${msg}: ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
  }
  return JSON.parse(text) as T;
}

export async function fetchHubConfig(): Promise<{ turnstileSiteKey: string }> {
  const resp = await fetch(`${baseUrl()}/config`);
  return await readJson(resp);
}

export async function signupDemo(input: {
  displayName?: string;
  turnstileToken?: string;
}): Promise<{ apiKey: string; user: HubUser }> {
  const resp = await fetch(`${baseUrl()}/signup/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await readJson(resp);
}

export async function signupRequest(input: {
  email: string;
  displayName: string;
  turnstileToken?: string;
  existingApiKey?: string;
}): Promise<{ ok: boolean; email: string; expiresInMinutes: number }> {
  const resp = await fetch(`${baseUrl()}/signup/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await readJson(resp);
}

export async function signupVerify(input: {
  email: string;
  code: string;
}): Promise<{ apiKey: string; user: HubUser; upgraded: boolean }> {
  const resp = await fetch(`${baseUrl()}/signup/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await readJson(resp);
}

function authHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function fetchAccount(
  apiKey: string,
): Promise<{ account: HubAccount; worlds: HubWorldSummary[] }> {
  const resp = await fetch(`${baseUrl()}/account`, { headers: authHeaders(apiKey) });
  return await readJson(resp);
}

export async function rotateKey(apiKey: string): Promise<{ apiKey: string }> {
  const resp = await fetch(`${baseUrl()}/account/rotate-key`, {
    method: "POST",
    headers: authHeaders(apiKey),
  });
  return await readJson(resp);
}

export async function upgradeRequest(
  apiKey: string,
  input: { email: string; displayName?: string; turnstileToken?: string },
): Promise<{ ok: boolean; email: string; expiresInMinutes: number }> {
  const resp = await fetch(`${baseUrl()}/account/upgrade/request`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(input),
  });
  return await readJson(resp);
}

export async function upgradeVerify(
  apiKey: string,
  input: { email: string; code: string },
): Promise<{ apiKey: string; account: HubAccount }> {
  const resp = await fetch(`${baseUrl()}/account/upgrade/verify`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(input),
  });
  return await readJson(resp);
}

// ─── Local persistence for "sign in with your key" ──────────────────
// Keeping the key in localStorage on arcanum-hub.com is comparable to
// the creator's on-disk settings. Users can paste it in once and come
// back to the account page.

const KEY_STORAGE = "arcanum-hub-api-key";

export function loadStoredKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function storeKey(apiKey: string): void {
  try {
    localStorage.setItem(KEY_STORAGE, apiKey);
  } catch {
    // ignore (Safari private mode, etc.)
  }
}

export function clearStoredKey(): void {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {
    // ignore
  }
}
