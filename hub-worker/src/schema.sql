-- Arcanum Hub D1 schema
-- Run with: wrangler d1 execute arcanum-hub --local --file=./src/schema.sql
--
-- This file describes the target shape of the schema. For existing
-- deployments, apply the diff files under src/migrations/ instead of
-- rerunning this — CREATE TABLE IF NOT EXISTS won't alter columns.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT,
  api_key_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_publish_at INTEGER,
  -- Lifetime hub-AI quotas. Counters are decoupled from key rotation;
  -- admins zero them via POST /admin/users/<id>/reset-usage.
  images_used INTEGER NOT NULL DEFAULT 0,
  images_quota INTEGER NOT NULL DEFAULT 500,
  prompts_used INTEGER NOT NULL DEFAULT 0,
  prompts_quota INTEGER NOT NULL DEFAULT 1000,
  -- Tier: 'demo' (anonymous trial, tiny quotas, FLUX-only, no publish),
  -- 'full' (email-verified self-signup, moderate quotas, FLUX-only, publish),
  -- 'playtester' (admin-invited, high quotas, all models, publish),
  -- 'publish' (BYOK user, publish-only, no hub AI).
  tier TEXT NOT NULL DEFAULT 'full',
  -- Email-verified users can publish. Demo users can't until they
  -- verify an email (which promotes them to tier='full').
  email_verified INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_api_key_hash ON users(api_key_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Pending email verifications for self-signup and demo→full upgrades.
CREATE TABLE IF NOT EXISTS verification_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  existing_user_id TEXT,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_expires ON verification_codes(expires_at);

-- Per-IP rate-limit log for signup endpoints.
CREATE TABLE IF NOT EXISTS signup_attempts (
  ip TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_time ON signup_attempts(ip, attempted_at);

CREATE TABLE IF NOT EXISTS worlds (
  slug TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT,
  listed INTEGER NOT NULL DEFAULT 0,
  tagline TEXT,
  last_publish_at INTEGER,
  bytes_used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  -- Discovery metadata (migration 0003). Populated server-side on
  -- publish from the uploaded showcase.json.
  article_count INTEGER NOT NULL DEFAULT 0,
  map_count INTEGER NOT NULL DEFAULT 0,
  image_count INTEGER NOT NULL DEFAULT 0,
  cover_image_hash TEXT,
  tags TEXT,
  author_display_name TEXT,
  description TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_worlds_user_id ON worlds(user_id);
CREATE INDEX IF NOT EXISTS idx_worlds_listed ON worlds(listed, last_publish_at);
