import type { Env } from "./env";

export type UserTier = "full" | "publish" | "demo";

export interface UserRow {
  id: string;
  display_name: string;
  email: string | null;
  api_key_hash: string;
  created_at: number;
  last_publish_at: number | null;
  images_used: number;
  images_quota: number;
  prompts_used: number;
  prompts_quota: number;
  tier: UserTier;
  email_verified: number;
}

// Default lifetime quotas by tier. Demo is deliberately tight — just
// enough to experience the features end-to-end without costing real
// money. Full is what email-verified signups get; publish is BYOK.
export const DEFAULT_QUOTAS: Record<UserTier, { images: number; prompts: number }> = {
  demo: { images: 10, prompts: 20 },
  full: { images: 500, prompts: 5000 },
  publish: { images: 0, prompts: 0 },
};

export interface VerificationCodeRow {
  email: string;
  code_hash: string;
  display_name: string;
  existing_user_id: string | null;
  expires_at: number;
  attempts: number;
  created_at: number;
}

export interface WorldRow {
  slug: string;
  user_id: string;
  display_name: string | null;
  listed: number;
  tagline: string | null;
  last_publish_at: number | null;
  bytes_used: number;
  created_at: number;
  // Discovery metadata (migration 0003). All derived from the uploaded
  // showcase.json on each publish; never authored by the creator directly.
  article_count: number;
  map_count: number;
  image_count: number;
  cover_image_hash: string | null;
  /** JSON-encoded string[] of aggregated article tags, or null. */
  tags: string | null;
  author_display_name: string | null;
  description: string | null;
}

// ─── Users ───────────────────────────────────────────────────────────

export async function getUserByApiKeyHash(env: Env, hash: string): Promise<UserRow | null> {
  return await env.DB.prepare("SELECT * FROM users WHERE api_key_hash = ?")
    .bind(hash)
    .first<UserRow>();
}

export async function getUserById(env: Env, id: string): Promise<UserRow | null> {
  return await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
}

export async function listUsers(env: Env): Promise<UserRow[]> {
  const res = await env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all<UserRow>();
  return res.results ?? [];
}

export async function createUser(
  env: Env,
  user: {
    id: string;
    display_name: string;
    email: string | null;
    api_key_hash: string;
    tier: UserTier;
    email_verified?: boolean;
    images_quota?: number;
    prompts_quota?: number;
  },
): Promise<void> {
  const now = Date.now();
  const quotas = DEFAULT_QUOTAS[user.tier];
  const imagesQuota = user.images_quota ?? quotas.images;
  const promptsQuota = user.prompts_quota ?? quotas.prompts;
  const verified = user.email_verified ? 1 : 0;
  await env.DB.prepare(
    `INSERT INTO users (id, display_name, email, api_key_hash, created_at, tier,
       email_verified, images_quota, prompts_quota)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      user.id,
      user.display_name,
      user.email,
      user.api_key_hash,
      now,
      user.tier,
      verified,
      imagesQuota,
      promptsQuota,
    )
    .run();
}

export async function getUserByEmail(env: Env, email: string): Promise<UserRow | null> {
  return await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
}

/**
 * Promote a demo user to full tier. Rotates the API key (zeroing
 * usage counters), attaches the verified email + display name, and
 * bumps quotas to full defaults. All-in-one so callers don't have to
 * juggle half-upgraded states.
 */
export async function promoteUserToFull(
  env: Env,
  userId: string,
  email: string,
  displayName: string,
  apiKeyHash: string,
): Promise<void> {
  const { images, prompts } = DEFAULT_QUOTAS.full;
  await env.DB.prepare(
    `UPDATE users
       SET tier = 'full',
           email = ?,
           display_name = ?,
           email_verified = 1,
           api_key_hash = ?,
           images_used = 0,
           prompts_used = 0,
           images_quota = ?,
           prompts_quota = ?
     WHERE id = ?`,
  )
    .bind(email, displayName, apiKeyHash, images, prompts, userId)
    .run();
}

export async function updateUserApiKeyHash(
  env: Env,
  userId: string,
  apiKeyHash: string,
): Promise<void> {
  // Rotating a key resets both AI quotas. The whole point of the
  // "lifetime + reset on rotation" design: the old key is dead, so
  // whoever had it can't burn more; the new key gets a fresh allowance.
  await env.DB.prepare(
    "UPDATE users SET api_key_hash = ?, images_used = 0, prompts_used = 0 WHERE id = ?",
  )
    .bind(apiKeyHash, userId)
    .run();
}

// Tier changes always auto-rotate the key — the prefix encodes the
// tier as a UX hint for the creator, so changing tier without
// rotating would leave a stale prefix that misleads the client.
// Counters reset alongside the rotation, same as updateUserApiKeyHash.
export async function updateUserTierAndKey(
  env: Env,
  userId: string,
  tier: UserTier,
  apiKeyHash: string,
): Promise<void> {
  await env.DB.prepare(
    "UPDATE users SET tier = ?, api_key_hash = ?, images_used = 0, prompts_used = 0 WHERE id = ?",
  )
    .bind(tier, apiKeyHash, userId)
    .run();
}

export async function incrementImageUsage(env: Env, userId: string): Promise<void> {
  await env.DB.prepare("UPDATE users SET images_used = images_used + 1 WHERE id = ?")
    .bind(userId)
    .run();
}

export async function incrementPromptUsage(env: Env, userId: string): Promise<void> {
  await env.DB.prepare("UPDATE users SET prompts_used = prompts_used + 1 WHERE id = ?")
    .bind(userId)
    .run();
}

export async function setUserQuotas(
  env: Env,
  userId: string,
  quotas: { images_quota?: number; prompts_quota?: number },
): Promise<void> {
  const sets: string[] = [];
  const vals: (number | string)[] = [];
  if (typeof quotas.images_quota === "number") {
    sets.push("images_quota = ?");
    vals.push(quotas.images_quota);
  }
  if (typeof quotas.prompts_quota === "number") {
    sets.push("prompts_quota = ?");
    vals.push(quotas.prompts_quota);
  }
  if (sets.length === 0) return;
  vals.push(userId);
  await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...vals)
    .run();
}

export async function touchUserPublish(env: Env, userId: string): Promise<void> {
  await env.DB.prepare("UPDATE users SET last_publish_at = ? WHERE id = ?")
    .bind(Date.now(), userId)
    .run();
}

export async function deleteUser(env: Env, userId: string): Promise<void> {
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
}

// ─── Worlds ──────────────────────────────────────────────────────────

export async function getWorldBySlug(env: Env, slug: string): Promise<WorldRow | null> {
  return await env.DB.prepare("SELECT * FROM worlds WHERE slug = ?").bind(slug).first<WorldRow>();
}

export async function listWorldsForUser(env: Env, userId: string): Promise<WorldRow[]> {
  const res = await env.DB.prepare("SELECT * FROM worlds WHERE user_id = ? ORDER BY created_at DESC")
    .bind(userId)
    .all<WorldRow>();
  return res.results ?? [];
}

export async function listListedWorlds(env: Env): Promise<WorldRow[]> {
  const res = await env.DB.prepare(
    "SELECT * FROM worlds WHERE listed = 1 AND last_publish_at IS NOT NULL ORDER BY last_publish_at DESC",
  ).all<WorldRow>();
  return res.results ?? [];
}

export async function listAllWorlds(env: Env): Promise<WorldRow[]> {
  const res = await env.DB.prepare("SELECT * FROM worlds ORDER BY created_at DESC").all<WorldRow>();
  return res.results ?? [];
}

export async function createWorld(
  env: Env,
  world: { slug: string; user_id: string; display_name: string | null },
): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO worlds (slug, user_id, display_name, listed, created_at) VALUES (?, ?, ?, 0, ?)",
  )
    .bind(world.slug, world.user_id, world.display_name, now)
    .run();
}

export async function updateWorldPublish(
  env: Env,
  slug: string,
  opts: {
    listed: boolean;
    tagline: string | null;
    display_name: string | null;
    bytes_used: number;
    article_count: number;
    map_count: number;
    image_count: number;
    cover_image_hash: string | null;
    tags: string | null;
    author_display_name: string | null;
    description: string | null;
  },
): Promise<void> {
  await env.DB.prepare(
    `UPDATE worlds
     SET listed = ?, tagline = ?, display_name = COALESCE(?, display_name),
         bytes_used = ?, last_publish_at = ?,
         article_count = ?, map_count = ?, image_count = ?,
         cover_image_hash = ?, tags = ?,
         author_display_name = ?, description = ?
     WHERE slug = ?`,
  )
    .bind(
      opts.listed ? 1 : 0,
      opts.tagline,
      opts.display_name,
      opts.bytes_used,
      Date.now(),
      opts.article_count,
      opts.map_count,
      opts.image_count,
      opts.cover_image_hash,
      opts.tags,
      opts.author_display_name,
      opts.description,
      slug,
    )
    .run();
}

export async function deleteWorld(env: Env, slug: string): Promise<void> {
  await env.DB.prepare("DELETE FROM worlds WHERE slug = ?").bind(slug).run();
}

// ─── Verification codes ──────────────────────────────────────────────

export async function upsertVerificationCode(
  env: Env,
  row: {
    email: string;
    code_hash: string;
    display_name: string;
    existing_user_id: string | null;
    expires_at: number;
  },
): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO verification_codes
       (email, code_hash, display_name, existing_user_id, expires_at, attempts, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(email) DO UPDATE SET
       code_hash = excluded.code_hash,
       display_name = excluded.display_name,
       existing_user_id = excluded.existing_user_id,
       expires_at = excluded.expires_at,
       attempts = 0,
       created_at = excluded.created_at`,
  )
    .bind(row.email, row.code_hash, row.display_name, row.existing_user_id, row.expires_at, now)
    .run();
}

export async function getVerificationCode(
  env: Env,
  email: string,
): Promise<VerificationCodeRow | null> {
  return await env.DB.prepare("SELECT * FROM verification_codes WHERE email = ?")
    .bind(email)
    .first<VerificationCodeRow>();
}

export async function bumpVerificationAttempts(env: Env, email: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE verification_codes SET attempts = attempts + 1 WHERE email = ?",
  )
    .bind(email)
    .run();
}

export async function deleteVerificationCode(env: Env, email: string): Promise<void> {
  await env.DB.prepare("DELETE FROM verification_codes WHERE email = ?").bind(email).run();
}

// ─── Signup rate-limiting ────────────────────────────────────────────

export async function recordSignupAttempt(env: Env, ip: string): Promise<void> {
  await env.DB.prepare("INSERT INTO signup_attempts (ip, attempted_at) VALUES (?, ?)")
    .bind(ip, Date.now())
    .run();
}

export async function countRecentSignupAttempts(
  env: Env,
  ip: string,
  windowMs: number,
): Promise<number> {
  const since = Date.now() - windowMs;
  const row = await env.DB.prepare(
    "SELECT COUNT(*) as n FROM signup_attempts WHERE ip = ? AND attempted_at >= ?",
  )
    .bind(ip, since)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Prune entries older than retainMs — called opportunistically. */
export async function pruneOldSignupAttempts(env: Env, retainMs: number): Promise<void> {
  const cutoff = Date.now() - retainMs;
  await env.DB.prepare("DELETE FROM signup_attempts WHERE attempted_at < ?").bind(cutoff).run();
}
