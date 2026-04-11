import type { Env } from "./env";

export interface UserRow {
  id: string;
  display_name: string;
  email: string | null;
  api_key_hash: string;
  created_at: number;
  last_publish_at: number | null;
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
  user: { id: string; display_name: string; email: string | null; api_key_hash: string },
): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO users (id, display_name, email, api_key_hash, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(user.id, user.display_name, user.email, user.api_key_hash, now)
    .run();
}

export async function updateUserApiKeyHash(
  env: Env,
  userId: string,
  apiKeyHash: string,
): Promise<void> {
  await env.DB.prepare("UPDATE users SET api_key_hash = ? WHERE id = ?")
    .bind(apiKeyHash, userId)
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
  opts: { listed: boolean; tagline: string | null; display_name: string | null; bytes_used: number },
): Promise<void> {
  await env.DB.prepare(
    `UPDATE worlds
     SET listed = ?, tagline = ?, display_name = COALESCE(?, display_name),
         bytes_used = ?, last_publish_at = ?
     WHERE slug = ?`,
  )
    .bind(
      opts.listed ? 1 : 0,
      opts.tagline,
      opts.display_name,
      opts.bytes_used,
      Date.now(),
      slug,
    )
    .run();
}

export async function deleteWorld(env: Env, slug: string): Promise<void> {
  await env.DB.prepare("DELETE FROM worlds WHERE slug = ?").bind(slug).run();
}
