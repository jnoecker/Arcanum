// ─── Arcanum Hub API client (frontend) ───────────────────────────────
//
// Minimal fetch wrapper used by onboarding + settings UI. Talks
// directly to api.arcanum-hub.com (CORS: *). For Tauri, the webview
// allows cross-origin fetch by default as long as the response
// carries the right headers. The hub's util.corsHeaders() does.
//
// All endpoints return JSON. On non-2xx we try to surface
// `body.error` (or `body.message`) so the UI can show a useful toast.

const DEFAULT_HUB_API_URL = "https://api.arcanum-hub.com";

export interface HubUser {
  id: string;
  displayName: string;
  tier: "demo" | "full" | "publish" | "playtester";
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
  tier: "demo" | "full" | "publish" | "playtester";
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

function baseUrl(override?: string): string {
  const url = (override ?? DEFAULT_HUB_API_URL).trim().replace(/\/+$/, "");
  return url || DEFAULT_HUB_API_URL;
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

export interface HubConfig {
  turnstileSiteKey: string;
}

export async function fetchHubConfig(apiUrl?: string): Promise<HubConfig> {
  const resp = await fetch(`${baseUrl(apiUrl)}/config`);
  return await readJson<HubConfig>(resp);
}

// ─── Signup ──────────────────────────────────────────────────────────

export interface SignupResult {
  apiKey: string;
  user: HubUser;
  upgraded?: boolean;
}

export async function signupDemo(
  input: { displayName?: string; turnstileToken?: string },
  apiUrl?: string,
): Promise<SignupResult> {
  const resp = await fetch(`${baseUrl(apiUrl)}/signup/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await readJson<SignupResult>(resp);
}

export async function signupRequest(
  input: { email: string; displayName: string; turnstileToken?: string; existingApiKey?: string },
  apiUrl?: string,
): Promise<{ ok: boolean; email: string; expiresInMinutes: number }> {
  const resp = await fetch(`${baseUrl(apiUrl)}/signup/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await readJson(resp);
}

export async function signupVerify(
  input: { email: string; code: string },
  apiUrl?: string,
): Promise<SignupResult> {
  const resp = await fetch(`${baseUrl(apiUrl)}/signup/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return await readJson<SignupResult>(resp);
}

// ─── Account ─────────────────────────────────────────────────────────

function authHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function fetchAccount(
  apiKey: string,
  apiUrl?: string,
): Promise<{ account: HubAccount; worlds: HubWorldSummary[] }> {
  const resp = await fetch(`${baseUrl(apiUrl)}/account`, { headers: authHeaders(apiKey) });
  return await readJson(resp);
}

export async function rotateKey(
  apiKey: string,
  apiUrl?: string,
): Promise<{ apiKey: string }> {
  const resp = await fetch(`${baseUrl(apiUrl)}/account/rotate-key`, {
    method: "POST",
    headers: authHeaders(apiKey),
  });
  return await readJson(resp);
}

export async function upgradeRequest(
  apiKey: string,
  input: { email: string; displayName?: string; turnstileToken?: string },
  apiUrl?: string,
): Promise<{ ok: boolean; email: string; expiresInMinutes: number }> {
  const resp = await fetch(`${baseUrl(apiUrl)}/account/upgrade/request`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(input),
  });
  return await readJson(resp);
}

export async function upgradeVerify(
  apiKey: string,
  input: { email: string; code: string },
  apiUrl?: string,
): Promise<{ apiKey: string; account: HubAccount }> {
  const resp = await fetch(`${baseUrl(apiUrl)}/account/upgrade/verify`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify(input),
  });
  return await readJson(resp);
}
