import type { Env } from "../env";
import type { UserRow, UserTier } from "../db";
import {
  bumpVerificationAttempts,
  deleteVerificationCode,
  getUserByEmail,
  getUserById,
  getVerificationCode,
  listWorldsForUser,
  promoteUserToFull,
  recordSignupAttempt,
  upsertVerificationCode,
  updateUserApiKeyHash,
} from "../db";
import {
  clientIp,
  error,
  generateApiKey,
  generateVerificationCode,
  isValidEmail,
  json,
  normalizeEmail,
  sha256Hex,
} from "../util";
import { sendEmail, verificationEmail } from "../email";
import { verifyTurnstile } from "../turnstile";

// ─── Account endpoints ───────────────────────────────────────────────
//
// All require Bearer auth (authenticateUser at the router). The
// upgrade flow lets a demo user promote to full via email
// verification — we pass the user.id in the pending record so the
// verify step knows to promote instead of creating a new account.

const cors = { origin: "*" } as const;
const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_TTL_MIN = 15;
const MAX_CODE_ATTEMPTS = 5;

function toAccountView(user: UserRow) {
  return {
    id: user.id,
    displayName: user.display_name,
    email: user.email,
    emailVerified: Boolean(user.email_verified),
    tier: user.tier as UserTier,
    createdAt: user.created_at,
    lastPublishAt: user.last_publish_at,
    canPublish: Boolean(user.email_verified) && user.tier !== "demo",
    usage: {
      imagesUsed: user.images_used,
      imagesQuota: user.images_quota,
      promptsUsed: user.prompts_used,
      promptsQuota: user.prompts_quota,
    },
  };
}

// ─── GET /account ────────────────────────────────────────────────────

export async function getAccount(_req: Request, env: Env, user: UserRow): Promise<Response> {
  const worlds = await listWorldsForUser(env, user.id);
  return json(
    {
      account: toAccountView(user),
      worlds: worlds.map((w) => ({
        slug: w.slug,
        displayName: w.display_name,
        listed: Boolean(w.listed),
        lastPublishAt: w.last_publish_at,
        bytesUsed: w.bytes_used,
      })),
    },
    {},
    cors,
  );
}

// ─── POST /account/rotate-key ────────────────────────────────────────

export async function rotateKey(_req: Request, env: Env, user: UserRow): Promise<Response> {
  const { plain, hash } = await generateApiKey(user.tier);
  await updateUserApiKeyHash(env, user.id, hash);
  return json({ apiKey: plain }, {}, cors);
}

// ─── POST /account/upgrade/request ───────────────────────────────────

export async function upgradeRequest(req: Request, env: Env, user: UserRow): Promise<Response> {
  if (user.tier !== "demo") {
    return error(400, "This account is already verified.", cors);
  }

  let body: { email?: string; displayName?: string; turnstileToken?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error(400, "Invalid JSON body", cors);
  }

  const email = normalizeEmail((body.email ?? "").trim());
  const displayName = (body.displayName ?? "").trim() || user.display_name;
  if (!isValidEmail(email)) return error(400, "Enter a valid email address.", cors);

  const ip = clientIp(req);
  const turnstile = await verifyTurnstile(env, body.turnstileToken, ip);
  if (!turnstile.ok) {
    return error(400, `Verification failed: ${turnstile.reason ?? "unknown"}`, cors);
  }

  // Don't let two demo accounts upgrade to the same email.
  const owned = await getUserByEmail(env, email);
  if (owned && owned.id !== user.id) {
    return error(
      409,
      "That email already has an account. Use the existing account's API key instead.",
      cors,
    );
  }

  await recordSignupAttempt(env, ip);

  const code = generateVerificationCode();
  const codeHash = await sha256Hex(code);
  await upsertVerificationCode(env, {
    email,
    code_hash: codeHash,
    display_name: displayName,
    existing_user_id: user.id,
    expires_at: Date.now() + CODE_TTL_MS,
  });

  const mail = verificationEmail(code, CODE_TTL_MIN);
  const sent = await sendEmail(env, email, mail.subject, mail.html, mail.text);
  if (!sent.ok) {
    return error(502, `Could not send verification email: ${sent.error ?? "unknown"}`, cors);
  }
  return json({ ok: true, email, expiresInMinutes: CODE_TTL_MIN }, {}, cors);
}

// ─── POST /account/upgrade/verify ────────────────────────────────────

export async function upgradeVerify(req: Request, env: Env, user: UserRow): Promise<Response> {
  if (user.tier !== "demo") {
    return error(400, "This account is already verified.", cors);
  }

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
  if (!pending || pending.existing_user_id !== user.id) {
    return error(400, "No verification in progress for that email.", cors);
  }
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

  const { plain, hash } = await generateApiKey("full");
  await promoteUserToFull(env, user.id, email, pending.display_name, hash);
  await deleteVerificationCode(env, email);
  const fresh = await getUserById(env, user.id);
  if (!fresh) return error(500, "Upgrade succeeded but user unreadable", cors);
  return json({ apiKey: plain, account: toAccountView(fresh) }, {}, cors);
}
