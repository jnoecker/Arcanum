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
  -- Lifetime hub-AI quotas, tied to the api_key_hash. On key rotation
  -- the *_used counters are reset to 0, giving the legit user a fresh
  -- allowance while invalidating any leaked copy of the old key.
  images_used INTEGER NOT NULL DEFAULT 0,
  images_quota INTEGER NOT NULL DEFAULT 500,
  prompts_used INTEGER NOT NULL DEFAULT 0,
  prompts_quota INTEGER NOT NULL DEFAULT 5000
);

CREATE INDEX IF NOT EXISTS idx_users_api_key_hash ON users(api_key_hash);

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
