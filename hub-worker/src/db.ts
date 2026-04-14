import type { Env } from "./env";

export type UserTier = "full" | "publish";

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
  },
): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO users (id, display_name, email, api_key_hash, created_at, tier) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(user.id, user.display_name, user.email, user.api_key_hash, now, user.tier)
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
