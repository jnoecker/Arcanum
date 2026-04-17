import type { Env } from "./env";

// ─── Cloudflare Turnstile verification ───────────────────────────────
//
// Frontend (landing + creator onboarding) renders the Turnstile
// widget using TURNSTILE_SITE_KEY and POSTs the resulting token to
// our signup endpoints. This module verifies that token with
// Cloudflare's siteverify endpoint.
//
// If no secret key is configured we treat verification as disabled
// (useful in dev against wrangler dev + local D1). Don't ship a
// production deploy without a secret.

export interface TurnstileResult {
  ok: boolean;
  /** Machine-readable reason if ok=false, for UI messaging. */
  reason?: string;
}

export async function verifyTurnstile(
  env: Env,
  token: string | null | undefined,
  remoteIp: string,
): Promise<TurnstileResult> {
  // Dev/disabled: no secret configured, treat every call as valid
  // but log it so "why did my signup skip verification?" is at least
  // discoverable in wrangler tail.
  if (!env.TURNSTILE_SECRET_KEY) {
    console.log("[turnstile] disabled — no TURNSTILE_SECRET_KEY set");
    return { ok: true };
  }
  if (!token) return { ok: false, reason: "missing_token" };

  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", token);
  if (remoteIp && remoteIp !== "unknown") form.set("remoteip", remoteIp);

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  if (!resp.ok) {
    return { ok: false, reason: `siteverify_${resp.status}` };
  }
  const data = (await resp.json()) as { success?: boolean; "error-codes"?: string[] };
  if (data.success) return { ok: true };
  const reason = data["error-codes"]?.[0] ?? "turnstile_failed";
  return { ok: false, reason };
}
