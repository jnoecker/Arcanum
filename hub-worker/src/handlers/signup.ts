import type { Env } from "../env";
import {
  countRecentSignupAttempts,
  createUser,
  deleteVerificationCode,
  getUserByEmail,
  getUserById,
  getVerificationCode,
  promoteUserToFull,
  pruneOldSignupAttempts,
  recordSignupAttempt,
  bumpVerificationAttempts,
  upsertVerificationCode,
  type UserTier,
} from "../db";
import {
  clientIp,
  error,
  generateApiKey,
  generateVerificationCode,
  isValidEmail,
  json,
  newId,
  normalizeEmail,
  sha256Hex,
} from "../util";
import { sendEmail, verificationEmail } from "../email";
import { verifyTurnstile } from "../turnstile";

// ─── Signup flow ─────────────────────────────────────────────────────
//
// Two paths, one worker:
//
//   POST /signup/demo    — Turnstile only. Creates a demo-tier user
//                          with tight quotas and no publish rights.
//   POST /signup/request — Turnstile + email. Sends a 6-digit code
//                          and stashes a pending record.
//   POST /signup/verify  — email + code. Creates a full-tier user
//                          (or upgrades a demo user that's already
//                          signed in, via existing_user_id on the
//                          pending record).
//
// Rate limit: per-IP rolling window counted in signup_attempts. A
// single window covers both /demo and /request so we can't be spun
// up by alternating endpoints.

const SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 1h
const SIGNUP_MAX_PER_WINDOW = 3;
const SIGNUP_RETAIN_MS = 24 * 60 * 60 * 1000; // prune after 24h

const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_TTL_MIN = 15;
const MAX_CODE_ATTEMPTS = 5;

const cors = { origin: "*" } as const;

// ─── POST /signup/demo ───────────────────────────────────────────────

export async function signupDemo(req: Request, env: Env): Promise<Response> {
  let body: { turnstileToken?: string; displayName?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error(400, "Invalid JSON body", cors);
  }

  const ip = clientIp(req);
  const rate = await enforceSignupRateLimit(env, ip);
  if (rate) return rate;

  const turnstile = await verifyTurnstile(env, body.turnstileToken, ip);
  if (!turnstile.ok) {
    return error(400, `Verification failed: ${turnstile.reason ?? "unknown"}`, cors);
  }

  await recordSignupAttempt(env, ip);

  const displayName = (body.displayName ?? "").trim() || "Demo User";
  const id = newId();
  const { plain, hash } = await generateApiKey("demo");

  try {
    await createUser(env, {
      id,
      display_name: displayName,
      email: null,
      api_key_hash: hash,
      tier: "demo",
      email_verified: false,
    });
  } catch (e) {
    return error(500, `Failed to create demo user: ${String(e)}`, cors);
  }

  const user = await getUserById(env, id);
  if (!user) return error(500, "User created but not readable", cors);

  return json(
    {
      apiKey: plain,
      user: {
        id: user.id,
        displayName: user.display_name,
        tier: user.tier as UserTier,
        email: user.email,
        emailVerified: Boolean(user.email_verified),
        imagesQuota: user.images_quota,
        promptsQuota: user.prompts_quota,
      },
    },
    { status: 201 },
    cors,
  );
}

// ─── POST /signup/request ────────────────────────────────────────────

export async function signupRequest(req: Request, env: Env): Promise<Response> {
  let body: { email?: string; displayName?: string; turnstileToken?: string; existingApiKey?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error(400, "Invalid JSON body", cors);
  }

  const rawEmail = (body.email ?? "").trim();
  const email = normalizeEmail(rawEmail);
  const displayName = (body.displayName ?? "").trim();
  if (!isValidEmail(email)) return error(400, "Enter a valid email address.", cors);
  if (!displayName) return error(400, "Display name is required.", cors);

  const ip = clientIp(req);
  const rate = await enforceSignupRateLimit(env, ip);
  if (rate) return rate;

  const turnstile = await verifyTurnstile(env, body.turnstileToken, ip);
  if (!turnstile.ok) {
    return error(400, `Verification failed: ${turnstile.reason ?? "unknown"}`, cors);
  }

  // If an existing demo user is upgrading, we need to tie the
  // pending code to their user_id so the verify step upgrades that
  // record instead of creating a fresh one. Auth happens via the
  // bearer token on the existing-key path, but we accept a plain
  // key here too so the web landing page (which may have a key in
  // localStorage) can request an upgrade without its own Bearer
  // header dance.
  let existingUserId: string | null = null;
  const rawExisting = (body.existingApiKey ?? "").trim();
  if (rawExisting) {
    const hash = await sha256Hex(rawExisting);
    const existing = await env.DB
      .prepare("SELECT id, tier, email FROM users WHERE api_key_hash = ?")
      .bind(hash)
      .first<{ id: string; tier: string; email: string | null }>();
    if (existing) {
      if (existing.tier !== "demo") {
        return error(400, "This account is already verified.", cors);
      }
      existingUserId = existing.id;
    }
    // Unknown key is silently ignored — we still send the code so an
    // attacker can't probe for valid keys via this endpoint.
  }

  // Reject if another user already owns that email (unless the
  // upgrading demo user is the match). Don't leak which emails are
  // taken — bail with a generic message.
  if (!existingUserId) {
    const taken = await getUserByEmail(env, email);
    if (taken) {
      return error(
        409,
        "That email already has an account. Sign in with your existing API key instead.",
        cors,
      );
    }
  }

  await recordSignupAttempt(env, ip);

  const code = generateVerificationCode();
  const codeHash = await sha256Hex(code);
  await upsertVerificationCode(env, {
    email,
    code_hash: codeHash,
    display_name: displayName,
    existing_user_id: existingUserId,
    expires_at: Date.now() + CODE_TTL_MS,
  });

  const mail = verificationEmail(code, CODE_TTL_MIN);
  const sent = await sendEmail(env, email, mail.subject, mail.html, mail.text);
  if (!sent.ok) {
    return error(502, `Could not send verification email: ${sent.error ?? "unknown"}`, cors);
  }

  return json({ ok: true, email, expiresInMinutes: CODE_TTL_MIN }, {}, cors);
}

// ─── POST /signup/verify ─────────────────────────────────────────────

export async function signupVerify(req: Request, env: Env): Promise<Response> {
  let body: { email?: string; code?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error(400, "Invalid JSON body", cors);
  }

  const email = normalizeEmail((body.email ?? "").trim());
  const code = (body.code ?? "").trim();
  if (!isValidEmail(email)) return error(400, "Enter a valid email address.", cors);
  if (!/^\d{6}$/.test(code)) return error(400, "Enter the 6-digit code from the email.", cors);

  const pending = await getVerificationCode(env, email);
  if (!pending) return error(400, "No verification in progress for that email.", cors);

  if (pending.expires_at < Date.now()) {
    await deleteVerificationCode(env, email);
    return error(400, "That code has expired. Request a new one.", cors);
  }
  if (pending.attempts >= MAX_CODE_ATTEMPTS) {
    await deleteVerificationCode(env, email);
    return error(429, "Too many attempts. Request a new code.", cors);
  }

  const candidateHash = await sha256Hex(code);
  if (candidateHash !== pending.code_hash) {
    await bumpVerificationAttempts(env, email);
    return error(400, "That code doesn't match. Try again.", cors);
  }

  // Upgrade path: demo user becoming full.
  if (pending.existing_user_id) {
    const existing = await getUserById(env, pending.existing_user_id);
    if (!existing) {
      await deleteVerificationCode(env, email);
      return error(410, "The account you're upgrading no longer exists.", cors);
    }
    const { plain, hash } = await generateApiKey("full");
    await promoteUserToFull(env, existing.id, email, pending.display_name, hash);
    await deleteVerificationCode(env, email);
    const fresh = await getUserById(env, existing.id);
    if (!fresh) return error(500, "Upgrade succeeded but user unreadable", cors);
    return json(
      {
        apiKey: plain,
        upgraded: true,
        user: {
          id: fresh.id,
          displayName: fresh.display_name,
          tier: fresh.tier as UserTier,
          email: fresh.email,
          emailVerified: Boolean(fresh.email_verified),
          imagesQuota: fresh.images_quota,
          promptsQuota: fresh.prompts_quota,
        },
      },
      {},
      cors,
    );
  }

  // Fresh signup.
  const id = newId();
  const { plain, hash } = await generateApiKey("full");
  try {
    await createUser(env, {
      id,
      display_name: pending.display_name,
      email,
      api_key_hash: hash,
      tier: "full",
      email_verified: true,
    });
  } catch (e) {
    return error(500, `Failed to create user: ${String(e)}`, cors);
  }
  await deleteVerificationCode(env, email);
  const user = await getUserById(env, id);
  if (!user) return error(500, "User created but not readable", cors);

  return json(
    {
      apiKey: plain,
      upgraded: false,
      user: {
        id: user.id,
        displayName: user.display_name,
        tier: user.tier as UserTier,
        email: user.email,
        emailVerified: Boolean(user.email_verified),
        imagesQuota: user.images_quota,
        promptsQuota: user.prompts_quota,
      },
    },
    { status: 201 },
    cors,
  );
}

// ─── Shared: per-IP rate limit ──────────────────────────────────────

async function enforceSignupRateLimit(env: Env, ip: string): Promise<Response | null> {
  // Best-effort prune so signup_attempts doesn't grow forever; we
  // don't wait on it failing.
  try {
    await pruneOldSignupAttempts(env, SIGNUP_RETAIN_MS);
  } catch {
    // ignore
  }
  const count = await countRecentSignupAttempts(env, ip, SIGNUP_WINDOW_MS);
  if (count >= SIGNUP_MAX_PER_WINDOW) {
    return error(429, "Too many signup attempts from this network. Try again later.", cors);
  }
  return null;
}
